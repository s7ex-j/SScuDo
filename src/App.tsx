import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyze, CAMPAIGNS } from "./engine";
import type { Analysis, Campaign, Category, Finding, Level, UrlReport } from "./engine";
import { Term } from "./term/Term";
import type { TermMood } from "./term/Term";
import { EJEMPLOS } from "./ui/ejemplos";
import { cargarComunidad, enviarReporte, reportesActivos } from "./reportes";
import type { Comunidad } from "./reportes";

type Vista = "revisar" | "campanas";

// Puente con la app de Android (android/). En la web no existe.
interface PuenteAndroid {
  estado(): string; // JSON: { notificaciones, enlaces, avisos }
  abrirAccesoNotificaciones(): void;
  pedirRevisorDeEnlaces(): void;
  pedirPermisoAvisos(): void;
}
const android = (window as unknown as { SScuDoAndroid?: PuenteAndroid }).SScuDoAndroid;

/** Texto que llega en el fragmento (#texto=...). El fragmento nunca viaja a un servidor. */
function textoDelFragmento(): string | null {
  const m = /^#texto=(.*)$/s.exec(location.hash);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

function Proteccion({ puente }: { puente: PuenteAndroid }) {
  const leer = () => {
    try {
      return JSON.parse(puente.estado()) as { notificaciones: boolean; enlaces: boolean; avisos: boolean };
    } catch {
      return { notificaciones: false, enlaces: false, avisos: false };
    }
  };
  const [e, setE] = useState(leer);
  useEffect(() => {
    const refrescar = () => setE(leer());
    document.addEventListener("visibilitychange", refrescar);
    window.addEventListener("focus", refrescar);
    const t = window.setInterval(refrescar, 2000);
    return () => {
      document.removeEventListener("visibilitychange", refrescar);
      window.removeEventListener("focus", refrescar);
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="proteccion">
      <h2>Protección automática</h2>
      <p>Las dos son opcionales y todo se revisa en tu teléfono. Nada se guarda ni se envía.</p>
      <div className={`proteccion-fila ${e.enlaces ? "on" : ""}`}>
        <div>
          <strong>Revisar enlaces antes de abrirlos</strong>
          <span>Cuando toques un enlace en WhatsApp o un SMS, SScuDo lo mira primero. Si no ve nada raro, lo abre en tu navegador de siempre al instante.</span>
        </div>
        {e.enlaces ? <em>Activo</em> : <button type="button" onClick={() => puente.pedirRevisorDeEnlaces()}>Activar</button>}
      </div>
      <div className={`proteccion-fila ${e.notificaciones ? "on" : ""}`}>
        <div>
          <strong>Avisarme si llega un mensaje de estafa</strong>
          <span>Lee el texto de las notificaciones que te llegan y te avisa solo si uno tiene alta probabilidad de estafa. Android te mostrará una advertencia fuerte al activarlo: es el permiso de "acceso a notificaciones".</span>
        </div>
        {e.notificaciones ? <em>Activo</em> : <button type="button" onClick={() => puente.abrirAccesoNotificaciones()}>Activar</button>}
      </div>
      {e.notificaciones && !e.avisos && (
        <div className="proteccion-fila">
          <div>
            <strong>Falta permitir los avisos</strong>
            <span>Sin este permiso SScuDo detecta la estafa pero no puede mostrarte la alerta.</span>
          </div>
          <button type="button" onClick={() => puente.pedirPermisoAvisos()}>Permitir</button>
        </div>
      )}
    </section>
  );
}

const VEREDICTO: Record<Level, { titulo: string; resumen: string; term: string; paso: number }> = {
  alto: {
    titulo: "Alta probabilidad de estafa",
    resumen: "Este mensaje junta varias marcas claras de un engaño.",
    term: "No abras nada. Esto tiene todas las marcas de una estafa.",
    paso: 3,
  },
  sospechoso: {
    titulo: "Sospechoso",
    resumen: "Hay cosas raras. Verifica por otro canal antes de hacer algo.",
    term: "Aquí hay algo raro. No hagas lo que pide sin comprobarlo por tu cuenta.",
    paso: 2,
  },
  sin_senales: {
    titulo: "No encontré señales",
    resumen: "No vi marcas de las estafas que conozco. Eso no lo vuelve seguro.",
    term: "No vi nada conocido. Igual: si te pide plata, claves o códigos, desconfía.",
    paso: 1,
  },
};

const TONO: Record<Category, "rojo" | "ambar" | "arena"> = {
  enlace: "rojo",
  suplantacion: "rojo",
  datos: "ambar",
  dinero: "ambar",
  instalacion: "ambar",
  amenaza: "arena",
  premio: "arena",
  urgencia: "arena",
  empleo: "arena",
  contacto: "arena",
};

const CATEGORIA: Record<Category, string> = {
  enlace: "Enlace",
  suplantacion: "Suplantación",
  datos: "Pide datos",
  dinero: "Pide dinero",
  instalacion: "Pide instalar",
  amenaza: "Amenaza",
  premio: "Promesa",
  urgencia: "Presión",
  empleo: "Empleo",
  contacto: "Contacto",
};

/** El mensaje original con los tramos sospechosos marcados. */
function Marcado({ texto, hallazgos }: { texto: string; hallazgos: Finding[] }) {
  const partes = useMemo(() => {
    const prioridad = { rojo: 3, ambar: 2, arena: 1 } as const;
    const tono: (keyof typeof prioridad | null)[] = new Array(texto.length).fill(null);
    for (const h of hallazgos) {
      if (h.weight <= 0) continue;
      const t = TONO[h.category];
      for (const [s, e] of h.spans) {
        for (let i = s; i < e && i < texto.length; i++) {
          const actual = tono[i];
          if (!actual || prioridad[t] > prioridad[actual]) tono[i] = t;
        }
      }
    }
    const out: { t: string; tono: string | null }[] = [];
    let i = 0;
    while (i < texto.length) {
      let j = i;
      while (j < texto.length && tono[j] === tono[i]) j++;
      out.push({ t: texto.slice(i, j), tono: tono[i] });
      i = j;
    }
    return out;
  }, [texto, hallazgos]);

  return (
    <p className="marcado">
      {partes.map((p, k) => (p.tono ? <mark key={k} className={`m-${p.tono}`}>{p.t}</mark> : <span key={k}>{p.t}</span>))}
    </p>
  );
}

/** La dirección partida en piezas: lo que importa es el dominio real. */
function Anatomia({ u, comunidad }: { u: UrlReport; comunidad: Comunidad | null }) {
  const malo = !u.official;
  const rep = comunidad?.dominios.get(u.registrable);
  return (
    <div className={`anatomia ${malo ? "es-ajeno" : "es-oficial"}`}>
      <div className="anatomia-url" translate="no">
        {u.kind === "correo" && <span className="pieza-gris">{u.raw.split("@")[0]}@</span>}
        {u.scheme && <span className="pieza-gris">{u.scheme}://</span>}
        {u.subdomain && <span className="pieza-gris">{u.subdomain}.</span>}
        <span className="pieza-real">{u.registrable}</span>
        {u.path && <span className="pieza-gris">{u.path.length > 40 ? u.path.slice(0, 40) + "…" : u.path}</span>}
      </div>
      <p className="anatomia-nota">
        {u.official ? (
          <>
            <strong>{u.registrable}</strong> es un dominio oficial de {u.official.name}.
          </>
        ) : (
          <>
            El dominio real es <strong translate="no">{u.registrable}</strong>.{" "}
            {u.subdomain || u.path ? "Lo que va antes y después lo escribe quien armó el enlace: puede decir cualquier cosa." : "Es lo único que dice a quién le pertenece la página."}
          </>
        )}
      </p>
      {rep && (
        <p className="anatomia-comunidad">
          {rep.n} personas reportaron este dominio en los últimos 30 días. Son reportes de usuarios, no una verificación.
        </p>
      )}
    </div>
  );
}

function TarjetaCampana({ c, abierta = false, semana }: { c: Campaign; abierta?: boolean; semana?: number }) {
  return (
    <details className="campana" open={abierta}>
      <summary>
        <span className="campana-nombre">{c.name}</span>
        <span className="campana-gancho">{c.hook}</span>
        {semana ? <span className="campana-semana">{semana} {semana === 1 ? "reporte" : "reportes"} esta semana</span> : null}
      </summary>
      <div className="campana-cuerpo">
        <h4>Cómo funciona</h4>
        <ol>
          {c.how.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ol>
        <h4>Qué hacer si te llega</h4>
        <ul>
          {c.todo.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        {!c.detectable && <p className="campana-aviso">Esta no se puede reconocer pegando un texto: hay que mirar a quién le estás pagando.</p>}
        {c.sources.length > 0 && (
          <p className="campana-fuentes">
            Fuente:{" "}
            {c.sources.map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noreferrer noopener">
                {s.title}
              </a>
            ))}
          </p>
        )}
      </div>
    </details>
  );
}

function Resultado({ texto, a, comunidad }: { texto: string; a: Analysis; comunidad: Comunidad | null }) {
  const v = VEREDICTO[a.level];
  const positivos = a.findings.filter((f) => f.weight > 0);
  const atenuantes = a.findings.filter((f) => f.weight < 0);
  const [copiado, setCopiado] = useState(false);
  const [reporte, setReporte] = useState<"no" | "enviando" | "ok" | "limite" | "error">("no");
  const reportables = [...new Set(a.urls.filter((u) => !u.official).map((u) => u.registrable))];

  const reportar = async () => {
    if (a.level === "sin_senales") return;
    setReporte("enviando");
    setReporte(await enviarReporte(reportables, a.campaign?.id ?? null, a.level));
  };

  const compartir = async () => {
    const motivos = positivos.slice(0, 3).map((f) => `• ${f.title}`);
    const resumen = [`SScuDo revisó un mensaje: ${v.titulo}.`, ...motivos, a.campaign ? `Se parece a: ${a.campaign.name}.` : "", "Revisa el tuyo: " + location.origin + location.pathname]
      .filter(Boolean)
      .join("\n");
    try {
      if (navigator.share) await navigator.share({ text: resumen });
      else {
        await navigator.clipboard.writeText(resumen);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2200);
      }
    } catch {
      /* la persona canceló */
    }
  };

  return (
    <section className="resultado" aria-live="polite">
      <div className={`veredicto nivel-${a.level}`}>
        <div className="medidor" role="img" aria-label={`Nivel ${v.paso} de 3`}>
          {[1, 2, 3].map((n) => (
            <span key={n} className={n <= v.paso ? "on" : ""} />
          ))}
        </div>
        <h2>{v.titulo}</h2>
        <p>{v.resumen}</p>
      </div>

      {positivos.length > 0 && (
        <div className="bloque">
          <h3>Tu mensaje, marcado</h3>
          <Marcado texto={texto} hallazgos={a.findings} />
          <p className="leyenda">
            <span><i className="punto m-rojo" />enlace o suplantación</span>
            <span><i className="punto m-ambar" />te pide algo</span>
            <span><i className="punto m-arena" />presión o promesa</span>
          </p>
        </div>
      )}

      {a.urls.length > 0 && (
        <div className="bloque">
          <h3>A dónde lleva de verdad</h3>
          {a.urls.map((u) => (
            <Anatomia key={u.span[0]} u={u} comunidad={comunidad} />
          ))}
        </div>
      )}

      {positivos.length > 0 && (
        <div className="bloque">
          <h3>Lo que encontré</h3>
          <ul className="hallazgos">
            {positivos.map((f) => (
              <li key={f.id} className={`t-${TONO[f.category]}`}>
                <span className="hallazgo-cat">{CATEGORIA[f.category]}</span>
                <strong>{f.title}</strong>
                <p>{f.detail}</p>
              </li>
            ))}
            {atenuantes.map((f) => (
              <li key={f.id} className="t-azul">
                <span className="hallazgo-cat">A favor</span>
                <strong>{f.title}</strong>
                <p>{f.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {a.campaign && (
        <div className="bloque">
          <h3>Se parece a esta estafa conocida</h3>
          <TarjetaCampana c={a.campaign} abierta />
        </div>
      )}

      {a.level !== "sin_senales" && (
        <div className="bloque">
          <h3>Si ya hiciste lo que pedía</h3>
          <ol className="pasos">
            <li>Llama a tu banco ahora, al número que está en tu tarjeta, y pide bloquear la cuenta o la tarjeta.</li>
            <li>Cambia las claves que hayas escrito en esa página.</li>
            <li>Guarda capturas del mensaje y denuncia en la comisaría o en la División de Investigación de Delitos de Alta Tecnología (DIVINDAT) de la Policía.</li>
          </ol>
        </div>
      )}

      <div className="bloque bloque-limites">
        <h3>Lo que no revisé</h3>
        <ul>
          {a.unchecked.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <p>SScuDo reconoce patrones conocidos. Una estafa nueva o bien escrita puede pasar sin que la marque.</p>
      </div>

      {reportesActivos && a.level !== "sin_senales" && (reportables.length > 0 || a.campaign) && (
        <div className="bloque reportar">
          <h3>Avisa a los demás</h3>
          {reporte === "ok" ? (
            <p className="reportar-ok">Reporte recibido. Gracias: cuando varias personas reportan lo mismo, SScuDo se lo advierte a quien venga después.</p>
          ) : (
            <>
              <p>
                Se envía solo {reportables.length > 0 ? <>el dominio <strong translate="no">{reportables.join(", ")}</strong> y </> : null}
                el tipo de estafa. Tu mensaje no sale de tu dispositivo.
              </p>
              <button type="button" className="boton-reportar" onClick={reportar} disabled={reporte === "enviando"}>
                {reporte === "enviando" ? "Enviando…" : "Reportar esta estafa"}
              </button>
              {reporte === "limite" && <p className="reportar-nota">Llegaste al límite de reportes por hoy. Vuelve mañana.</p>}
              {reporte === "error" && <p className="reportar-nota">No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.</p>}
            </>
          )}
        </div>
      )}

      <button type="button" className="boton-secundario" onClick={compartir}>
        {copiado ? "Resumen copiado" : "Compartir este resultado"}
      </button>
      <p className="nota-compartir">Se comparte el veredicto y los motivos, no el mensaje que pegaste.</p>
    </section>
  );
}

async function leerCompartido(): Promise<string | null> {
  try {
    if (!("caches" in window)) return null;
    const buzon = await caches.open("sscudo-compartido");
    const res = await buzon.match("./__mensaje");
    if (!res) return null;
    const t = await res.text();
    await buzon.delete("./__mensaje");
    return t;
  } catch {
    return null;
  }
}

export function App() {
  const [vista, setVista] = useState<Vista>("revisar");
  const [texto, setTexto] = useState("");
  const [revisado, setRevisado] = useState<{ texto: string; a: Analysis } | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [puedePegar, setPuedePegar] = useState(() => typeof navigator !== "undefined" && !!navigator.clipboard?.readText);
  const [comunidad, setComunidad] = useState<Comunidad | null>(null);
  const resultadoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cargarComunidad().then(setComunidad);
  }, []);
  const cajaRef = useRef<HTMLTextAreaElement>(null);

  const revisar = useCallback((t: string) => {
    const limpio = t.trim();
    if (!limpio) {
      cajaRef.current?.focus();
      return;
    }
    setLeyendo(true);
    setRevisado(null);
    // Pausa corta: Term "lee" y la persona nota que pasó algo.
    window.setTimeout(() => {
      setRevisado({ texto: limpio, a: analyze(limpio) });
      setLeyendo(false);
      requestAnimationFrame(() => resultadoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }, 420);
  }, []);

  // Texto que llega en el fragmento: desde la app de Android o un enlace propio.
  useEffect(() => {
    const tomar = () => {
      const t = textoDelFragmento();
      if (!t) return;
      history.replaceState(null, "", location.pathname + location.search);
      setVista("revisar");
      setTexto(t);
      revisar(t);
    };
    tomar();
    window.addEventListener("hashchange", tomar);
    return () => window.removeEventListener("hashchange", tomar);
  }, [revisar]);

  // Texto que llega desde "Compartir → SScuDo" en la app web instalada.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has("compartido")) return;
    history.replaceState(null, "", location.pathname);
    leerCompartido().then((t) => {
      if (t) {
        setTexto(t);
        revisar(t);
      }
    });
  }, [revisar]);

  const pegar = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setTexto(t);
    } catch {
      setPuedePegar(false);
    }
  };

  const mood: TermMood = leyendo ? "leyendo" : !revisado ? "espera" : revisado.a.level === "alto" ? "alto" : revisado.a.level === "sospechoso" ? "sospechoso" : "calma";
  const frase = leyendo
    ? "Leyendo…"
    : revisado
      ? VEREDICTO[revisado.a.level].term
      : "Pégame el mensaje, el correo o el enlace que te llegó. Yo lo leo; tú no lo abras.";

  return (
    <div className="app">
      <header className="cabecera">
        <a className="marca" href={android ? "./" : "../"} aria-label="SScuDo, inicio">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path d="M12 2.5 20 5.4v6.2c0 4.8-3.3 8.3-8 9.9-4.7-1.6-8-5.1-8-9.9V5.4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="m8.6 9.4 2.6 2.3-2.6 2.3M12.6 14.4h3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>SScuDo</span>
        </a>
        <nav aria-label="Secciones">
          <button type="button" className={vista === "revisar" ? "activo" : ""} onClick={() => setVista("revisar")}>
            Revisar
          </button>
          <button type="button" className={vista === "campanas" ? "activo" : ""} onClick={() => setVista("campanas")}>
            Estafas conocidas
          </button>
        </nav>
      </header>

      {vista === "revisar" ? (
        <main>
          <section className="entrada">
            <div className="entrada-titulo">
              <h1>¿Te llegó un mensaje raro?</h1>
              <p>Pégalo aquí y te muestro qué tiene de sospechoso, parte por parte. El análisis ocurre en tu dispositivo: el mensaje no se envía a ningún lado.</p>
            </div>

            <div className="term-linea">
              <Term mood={mood} size={104} />
              <p className={`globo globo-${mood}`}>{frase}</p>
            </div>

            <form
              className="caja"
              onSubmit={(e) => {
                e.preventDefault();
                revisar(texto);
              }}
            >
              <label htmlFor="mensaje">Mensaje, correo o enlace</label>
              <textarea
                id="mensaje"
                ref={cajaRef}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Mantén presionado el mensaje en WhatsApp, toca Copiar y pégalo aquí."
                rows={6}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
              />
              <div className="caja-acciones">
                {puedePegar && (
                  <button type="button" className="boton-plano" onClick={pegar}>
                    Pegar
                  </button>
                )}
                {texto && (
                  <button
                    type="button"
                    className="boton-plano"
                    onClick={() => {
                      setTexto("");
                      setRevisado(null);
                      cajaRef.current?.focus();
                    }}
                  >
                    Borrar
                  </button>
                )}
                <button type="submit" className="boton-principal" disabled={leyendo}>
                  Revisar mensaje
                </button>
              </div>
            </form>

            <div className="ejemplos">
              <span>Prueba con un ejemplo:</span>
              {EJEMPLOS.map((ej) => (
                <button
                  key={ej.etiqueta}
                  type="button"
                  onClick={() => {
                    setTexto(ej.texto);
                    revisar(ej.texto);
                  }}
                >
                  {ej.etiqueta}
                </button>
              ))}
            </div>
          </section>

          {android && !revisado && <Proteccion puente={android} />}

          <div ref={resultadoRef} className="ancla" />
          {revisado && <Resultado key={revisado.texto} texto={revisado.texto} a={revisado.a} comunidad={comunidad} />}
        </main>
      ) : (
        <main>
          <section className="catalogo">
            <h1>Estafas que circulan en el Perú</h1>
            <p>Cómo funciona cada una y qué hacer si te llega. Toca una para abrirla.</p>
            {[...CAMPAIGNS]
              .sort((x, y) => (comunidad?.campanas.get(y.id) ?? 0) - (comunidad?.campanas.get(x.id) ?? 0))
              .map((c) => (
                <TarjetaCampana key={c.id} c={c} semana={comunidad?.campanas.get(c.id)} />
              ))}
          </section>
        </main>
      )}

      <footer className="pie">
        <p>
          SScuDo es un proyecto de <a href="https://www.instagram.com/s7ex.git/" target="_blank" rel="noreferrer noopener">@s7ex.git</a>. Código abierto en{" "}
          <a href="https://github.com/s7ex-j/SScuDo" target="_blank" rel="noreferrer noopener">GitHub</a>.
        </p>
        <p>No reemplaza a tu banco ni a la Policía. Ante una duda, comprueba por un canal oficial.</p>
      </footer>
    </div>
  );
}
