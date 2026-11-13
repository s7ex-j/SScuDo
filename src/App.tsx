import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { analyze, CAMPAIGNS, isShortener } from "./engine";
import type { Analysis, Campaign, Category, Finding, Level, UrlReport } from "./engine";
import { Term } from "./term/Term";
import type { TermMood } from "./term/Term";
import { EJEMPLOS } from "./ui/ejemplos";
import { cargarComunidad, enviarReporte, reportesActivos } from "./reportes";
import type { Comunidad } from "./reportes";
import { revisarPagina, vistaPreviaActiva } from "./pagina";
import type { PaginaRevisada, Respuesta } from "./pagina";

type Vista = "revisar" | "campanas" | "pagina";

// Puente con la app de Android (android/). En la web no existe.
interface PuenteAndroid {
  estado(): string; // JSON: { notificaciones, enlaces, avisos }
  abrirAccesoNotificaciones(): void;
  pedirRevisorDeEnlaces(): void;
  pedirPermisoAvisos(): void;
  /** ¿Hay texto copiado? Solo mira si existe, sin leerlo. */
  hayCopiado?(): boolean;
  leerCopiado?(): string;
}
const android = (window as unknown as { SScuDoAndroid?: PuenteAndroid }).SScuDoAndroid;

/** Lo que llega en el fragmento (#texto=... o #pagina=...). El fragmento nunca viaja a un servidor. */
function delFragmento(): { tipo: "texto" | "pagina"; valor: string } | null {
  const m = /^#(texto|pagina)=(.*)$/s.exec(location.hash);
  if (!m) return null;
  try {
    return { tipo: m[1] as "texto" | "pagina", valor: decodeURIComponent(m[2]) };
  } catch {
    return null;
  }
}

function Ajuste({ on, titulo, texto, accion, boton }: { on: boolean; titulo: string; texto: string; accion: () => void; boton: string }) {
  return (
    <li className={`ajuste ${on ? "ajuste-on" : ""}`}>
      <div>
        <strong>{titulo}</strong>
        <span>{texto}</span>
      </div>
      {on ? (
        <span className="ajuste-estado">Activo</span>
      ) : (
        <button type="button" className="boton-borde" onClick={accion}>
          {boton}
        </button>
      )}
    </li>
  );
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
      <p className="nota">Las dos son opcionales y se revisan en tu teléfono.</p>
      <ul>
        <Ajuste
          on={e.enlaces}
          titulo="Revisar enlaces antes de abrirlos"
          texto="Al tocar un enlace en WhatsApp o un SMS, SScuDo lo mira primero. Si es un enlace acortado, averigua a dónde lleva."
          accion={() => puente.pedirRevisorDeEnlaces()}
          boton="Activar"
        />
        <Ajuste
          on={e.notificaciones}
          titulo="Avisarme si llega un mensaje de estafa"
          texto="Lee las notificaciones que llegan y te avisa solo si una tiene alta probabilidad de estafa. Android mostrará una advertencia al activarlo."
          accion={() => puente.abrirAccesoNotificaciones()}
          boton="Activar"
        />
        {e.notificaciones && !e.avisos && (
          <Ajuste on={false} titulo="Falta permitir los avisos" texto="Sin este permiso SScuDo detecta la estafa pero no puede mostrarte la alerta." accion={() => puente.pedirPermisoAvisos()} boton="Permitir" />
        )}
      </ul>
      <p className="nota">
        Atajo: copia un mensaje, baja la cortina de notificaciones y toca <strong>Revisar copiado</strong>. Si no lo ves, agrégalo con el lápiz de los ajustes rápidos.
      </p>
    </section>
  );
}

const VEREDICTO: Record<Level, { sello: string; resumen: string; term: string }> = {
  alto: {
    sello: "Alta probabilidad de estafa",
    resumen: "Este mensaje junta varias marcas claras de un engaño. No abras el enlace ni respondas.",
    term: "No abras nada. Esto tiene todas las marcas de una estafa.",
  },
  sospechoso: {
    sello: "Sospechoso",
    resumen: "Hay cosas raras. Comprueba por otro canal antes de hacer lo que pide.",
    term: "Aquí hay algo raro. No hagas lo que pide sin comprobarlo por tu cuenta.",
  },
  sin_senales: {
    sello: "Sin señales conocidas",
    resumen: "No vi marcas de las estafas que conozco. Eso no lo vuelve seguro: si te pide plata, claves o códigos, desconfía.",
    term: "No vi nada conocido. Igual: si te pide plata, claves o códigos, desconfía.",
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

type NivelSello = Level | "oficial" | "no_aplica";
const SELLO_PAGINA: Record<NivelSello, string> = {
  alto: "Alta probabilidad de estafa",
  sospechoso: "Sospechoso",
  sin_senales: "Sin señales conocidas",
  oficial: "Dominio oficial",
  no_aplica: "No revisable",
};

/** El veredicto como un sello de tinta: lo único que se anima, una vez. */
function Sello({ nivel, texto }: { nivel: NivelSello; texto: string }) {
  return (
    <div className={`sello sello-${nivel}`} role="img" aria-label={`Resultado: ${texto}`}>
      <span className="sello-marca">SScuDo revisó</span>
      <span className="sello-texto">{texto}</span>
    </div>
  );
}

/** El mensaje original con los tramos sospechosos marcados con resaltador. */
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
function Anatomia({ u, comunidad, alRevisar }: { u: UrlReport; comunidad: Comunidad | null; alRevisar: (url: string) => void }) {
  const rep = comunidad?.dominios.get(u.registrable);
  const acortado = u.kind === "enlace" && isShortener(u.host);
  const completa = u.kind === "enlace" ? (u.scheme ? u.raw : "https://" + u.raw) : null;
  return (
    <div className={`anatomia ${u.official ? "es-oficial" : "es-ajeno"}`}>
      <p className="anatomia-url" translate="no">
        {u.kind === "correo" && <span className="pieza-gris">{u.raw.split("@")[0]}@</span>}
        {u.scheme && <span className="pieza-gris">{u.scheme}://</span>}
        {u.subdomain && <span className="pieza-gris">{u.subdomain}.</span>}
        <span className="pieza-real">{u.registrable}</span>
        {u.path && <span className="pieza-gris">{u.path.length > 40 ? u.path.slice(0, 40) + "…" : u.path}</span>}
      </p>
      <p className="anatomia-nota">
        {u.official ? (
          <>
            <strong>{u.registrable}</strong> es un dominio oficial de {u.official.name}.
          </>
        ) : acortado ? (
          <>Es un enlace acortado: esconde a qué página lleva. Revísalo antes de tocarlo.</>
        ) : (
          <>
            El dominio real es <strong translate="no">{u.registrable}</strong>.{" "}
            {u.subdomain || u.path ? "Lo que va antes y después lo escribe quien armó el enlace: puede decir cualquier cosa." : "Es lo único que dice a quién le pertenece la página."}
          </>
        )}
      </p>
      {rep && <p className="anatomia-comunidad">{rep.n} personas reportaron este dominio en los últimos 30 días. Son reportes de usuarios, no una verificación.</p>}
      {completa && vistaPreviaActiva && !u.official && (
        <button type="button" className="boton-borde" onClick={() => alRevisar(completa)}>
          {acortado ? "Ver a dónde lleva" : "Ver la página sin abrirla"}
        </button>
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

function hostDe(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Resultado de POST /pagina: captura, camino del enlace y lo que dice el código. */
function RevisionPagina({ url, alVolver }: { url: string; alVolver: () => void }) {
  const [resp, setResp] = useState<Respuesta | null>(null);
  useEffect(() => {
    let vivo = true;
    setResp(null);
    revisarPagina(url).then((r) => vivo && setResp(r));
    return () => {
      vivo = false;
    };
  }, [url]);

  return (
    <section className="revision" aria-live="polite">
      <button type="button" className="volver" onClick={alVolver}>
        Volver
      </button>
      <h1>Revisión de la página</h1>
      <p className="revision-url" translate="no">
        {url}
      </p>
      {!resp && (
        <div className="cargando">
          <Term mood="leyendo" size={72} />
          <p>Abriendo la página desde un servidor de SScuDo, no desde tu teléfono. Tarda unos segundos.</p>
        </div>
      )}
      {resp && !resp.ok && <p className="error">{resp.error}</p>}
      {resp && resp.ok && <Informe r={resp.r} />}
    </section>
  );
}

function Informe({ r }: { r: PaginaRevisada }) {
  const d = r.datos;
  const pide = [d.pideClave && "una clave", d.pideTarjeta && "datos de tarjeta", d.pideCodigo && "un código o clave dinámica"].filter(Boolean) as string[];
  const filas: [string, ReactNode][] = [];
  if (r.dominio)
    filas.push([
      "Dominio real",
      <span translate="no" className="dato-dominio">
        {r.dominio}
      </span>,
    ]);
  filas.push(["Qué te pide", pide.length ? pide.join(", ") : "Ningún campo de clave, tarjeta ni código"]);
  if (d.enviaA.length) filas.push(["Envía lo que escribes a", <span translate="no">{d.enviaA.join(", ")}</span>]);
  filas.push(["Antigüedad del dominio", d.diasDominio === null ? "No se pudo consultar" : d.diasDominio < 1 ? "Registrado hoy" : `Registrado hace ${d.diasDominio} ${d.diasDominio === 1 ? "día" : "días"}`]);
  if (d.recursosDe.length) filas.push(["Usa imágenes del sitio de", d.recursosDe.join(", ")]);
  if (d.telefonos.length) filas.push(["Teléfonos en la página", d.telefonos.join(", ")]);
  if (d.whatsapp.length) filas.push(["WhatsApp en la página", d.whatsapp.join(", ")]);
  if (d.correos.length) filas.push(["Correos en la página", <span translate="no">{d.correos.join(", ")}</span>]);
  if (d.titulo) filas.push(["Título de la página", d.titulo]);

  return (
    <>
      <div className="revision-cabeza">
        <Sello nivel={r.nivel} texto={SELLO_PAGINA[r.nivel]} />
        <p className="resumen">
          <strong>{r.titulo}.</strong> {r.detalle}
        </p>
      </div>
      {r.error && <p className="error">{r.error}</p>}

      <div className="revision-cuerpo">
        <figure className="captura">
          {r.captura ? <img src={r.captura} alt={`Captura de ${hostDe(r.final)}`} /> : <div className="captura-vacia">{r.capturaNota ?? "Sin vista previa."}</div>}
          <figcaption>Captura tomada por SScuDo en un navegador aparte. No escribas nada en esa página.</figcaption>
        </figure>

        <div>
          {r.cadena.length > 1 && (
            <div className="bloque">
              <h3>Por dónde pasa el enlace</h3>
              <ol className="camino" translate="no">
                {r.cadena.map((c, i) => (
                  <li key={i} className={i === r.cadena.length - 1 ? "camino-final" : ""}>
                    {hostDe(c)}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="bloque">
            <h3>Lo que dice el código de la página</h3>
            <dl className="datos">
              {filas.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {(d.telefonos.length > 0 || d.whatsapp.length > 0) && <p className="nota">Compara esos números con el que está en el reverso de tu tarjeta o en la web oficial que escribes tú mismo.</p>}
          </div>

          {r.motivos.length > 0 && (
            <div className="bloque">
              <h3>Lo que encontré</h3>
              <ul className="hallazgos">
                {r.motivos.map((m) => (
                  <li key={m.titulo} className="t-rojo">
                    <strong>{m.titulo}</strong>
                    <p>{m.detalle}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <p className="nota">La página se revisó desde Cloudflare: quien la armó no ve tu conexión. SScuDo no guarda la dirección.</p>
    </>
  );
}

function Resultado({ texto, a, comunidad, alRevisar }: { texto: string; a: Analysis; comunidad: Comunidad | null; alRevisar: (url: string) => void }) {
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
    const resumen = [`SScuDo revisó un mensaje: ${v.sello}.`, ...motivos, a.campaign ? `Se parece a: ${a.campaign.name}.` : "", "Revisa el tuyo: " + location.origin + location.pathname]
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
    <section className={`resultado nivel-${a.level}`} aria-live="polite">
      <div className="hoja-revisada">
        <Sello nivel={a.level} texto={v.sello} />
        <div className="hoja">
          <Marcado texto={texto} hallazgos={a.findings} />
        </div>
        {positivos.length > 0 && (
          <p className="leyenda">
            <span>
              <i className="punto m-rojo" />
              enlace o suplantación
            </span>
            <span>
              <i className="punto m-ambar" />
              te pide algo
            </span>
            <span>
              <i className="punto m-arena" />
              presión o promesa
            </span>
          </p>
        )}
        <p className="resumen">{v.resumen}</p>
      </div>

      {a.urls.length > 0 && (
        <div className="bloque">
          <h3>A dónde lleva de verdad</h3>
          {a.urls.map((u) => (
            <Anatomia key={u.span[0]} u={u} comunidad={comunidad} alRevisar={alRevisar} />
          ))}
        </div>
      )}

      {(positivos.length > 0 || atenuantes.length > 0) && (
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
            <p>Reporte recibido. Cuando varias personas reportan lo mismo, SScuDo se lo advierte a quien venga después.</p>
          ) : (
            <>
              <p>
                Se envía solo {reportables.length > 0 ? <>el dominio <strong translate="no">{reportables.join(", ")}</strong> y </> : null}
                el tipo de estafa. Tu mensaje no sale de tu dispositivo.
              </p>
              <button type="button" className="boton-principal boton-rojo" onClick={reportar} disabled={reporte === "enviando"}>
                {reporte === "enviando" ? "Enviando…" : "Reportar esta estafa"}
              </button>
              {reporte === "limite" && <p className="nota">Llegaste al límite de reportes por hoy. Vuelve mañana.</p>}
              {reporte === "error" && <p className="nota">No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.</p>}
            </>
          )}
        </div>
      )}

      <div className="compartir">
        <button type="button" className="boton-borde" onClick={compartir}>
          {copiado ? "Resumen copiado" : "Compartir este resultado"}
        </button>
        <p className="nota">Se comparte el veredicto y los motivos, no el mensaje que pegaste.</p>
      </div>
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
  const [puedePegar, setPuedePegar] = useState(() => !android && typeof navigator !== "undefined" && !!navigator.clipboard?.readText);
  const [hayCopiado, setHayCopiado] = useState(false);
  const [pagina, setPagina] = useState<string | null>(null);
  const [comunidad, setComunidad] = useState<Comunidad | null>(null);
  const resultadoRef = useRef<HTMLDivElement>(null);
  const cajaRef = useRef<HTMLTextAreaElement>(null);
  const vistaAnterior = useRef<Vista>("revisar");

  useEffect(() => {
    cargarComunidad().then(setComunidad);
  }, []);

  const revisar = useCallback((t: string) => {
    const limpio = t.trim();
    if (!limpio) {
      cajaRef.current?.focus();
      return;
    }
    setLeyendo(true);
    setRevisado(null);
    setHayCopiado(false);
    // Pausa corta: Term "lee" y la persona nota que pasó algo.
    window.setTimeout(() => {
      setRevisado({ texto: limpio, a: analyze(limpio) });
      setLeyendo(false);
      requestAnimationFrame(() => resultadoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }, 420);
  }, []);

  const abrirPagina = useCallback((url: string) => {
    setVista((v) => {
      if (v !== "pagina") vistaAnterior.current = v;
      return "pagina";
    });
    setPagina(url);
    window.scrollTo({ top: 0 });
  }, []);

  // Lo que llega en el fragmento: desde la app de Android o un enlace propio.
  useEffect(() => {
    const tomar = () => {
      const f = delFragmento();
      if (!f) return;
      history.replaceState(null, "", location.pathname + location.search);
      if (f.tipo === "pagina") {
        abrirPagina(f.valor);
        return;
      }
      setVista("revisar");
      setTexto(f.valor);
      revisar(f.valor);
    };
    tomar();
    window.addEventListener("hashchange", tomar);
    return () => window.removeEventListener("hashchange", tomar);
  }, [revisar, abrirPagina]);

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

  // En Android: si hay algo copiado, se ofrece revisarlo. Solo se mira si
  // existe; el texto se lee cuando la persona toca el botón.
  useEffect(() => {
    if (!android?.hayCopiado) return;
    const mirar = () => {
      if (document.visibilityState !== "visible") return;
      try {
        setHayCopiado(!!android.hayCopiado?.());
      } catch {
        setHayCopiado(false);
      }
    };
    mirar();
    document.addEventListener("visibilitychange", mirar);
    window.addEventListener("focus", mirar);
    return () => {
      document.removeEventListener("visibilitychange", mirar);
      window.removeEventListener("focus", mirar);
    };
  }, []);

  const revisarCopiado = () => {
    const t = android?.leerCopiado?.() ?? "";
    setHayCopiado(false);
    if (t.trim()) {
      setTexto(t);
      revisar(t);
    }
  };

  const pegar = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setTexto(t);
    } catch {
      setPuedePegar(false);
    }
  };

  const mood: TermMood = leyendo ? "leyendo" : !revisado ? "espera" : revisado.a.level === "alto" ? "alto" : revisado.a.level === "sospechoso" ? "sospechoso" : "calma";
  const frase = leyendo ? "Leyendo…" : revisado ? VEREDICTO[revisado.a.level].term : "Pégame el mensaje, el correo o el enlace que te llegó. Yo lo leo; tú no lo abras.";

  return (
    <div className="app">
      <header className="cabecera">
        <a className="marca" href={android ? "./" : "../"} aria-label="SScuDo, inicio">
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
            <path d="M12 2.5 20 5.4v6.2c0 4.8-3.3 8.3-8 9.9-4.7-1.6-8-5.1-8-9.9V5.4Z" fill="currentColor" />
            <path d="m8.6 9.4 2.6 2.3-2.6 2.3M12.6 14.4h3" fill="none" stroke="var(--papel)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>SScuDo</span>
        </a>
        <nav aria-label="Secciones">
          <button type="button" aria-current={vista === "revisar" ? "page" : undefined} onClick={() => setVista("revisar")}>
            Revisar
          </button>
          <button type="button" aria-current={vista === "campanas" ? "page" : undefined} onClick={() => setVista("campanas")}>
            Estafas conocidas
          </button>
        </nav>
      </header>

      {vista === "pagina" && pagina ? (
        <main>
          <RevisionPagina url={pagina} alVolver={() => setVista(vistaAnterior.current)} />
        </main>
      ) : vista === "campanas" ? (
        <main>
          <section className="catalogo">
            <h1>Estafas que circulan en el Perú</h1>
            <p className="entrada-texto">Cómo funciona cada una y qué hacer si te llega. Toca una para abrirla.</p>
            {[...CAMPAIGNS]
              .sort((x, y) => (comunidad?.campanas.get(y.id) ?? 0) - (comunidad?.campanas.get(x.id) ?? 0))
              .map((c) => (
                <TarjetaCampana key={c.id} c={c} semana={comunidad?.campanas.get(c.id)} />
              ))}
          </section>
        </main>
      ) : (
        <main>
          <section className="entrada">
            <h1>¿Te llegó un mensaje raro?</h1>
            <p className="entrada-texto">Pégalo aquí y te muestro qué tiene de sospechoso, parte por parte. El mensaje se revisa en tu dispositivo y no se envía a ningún lado.</p>

            <div className="term-linea">
              <Term mood={mood} size={84} />
              <p className="globo">{frase}</p>
            </div>

            {hayCopiado && !texto && (
              <div className="copiado">
                <p>Tienes algo copiado. ¿Lo reviso?</p>
                <button type="button" className="boton-principal" onClick={revisarCopiado}>
                  Revisar lo copiado
                </button>
              </div>
            )}

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
                placeholder="En WhatsApp: mantén presionado el mensaje, toca Copiar y pégalo aquí."
                rows={5}
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
              <span>O prueba con un ejemplo inventado:</span>
              <div>
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
            </div>
          </section>

          <div ref={resultadoRef} className="ancla" />
          {revisado && <Resultado key={revisado.texto} texto={revisado.texto} a={revisado.a} comunidad={comunidad} alRevisar={abrirPagina} />}

          {android && !revisado && <Proteccion puente={android} />}
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
