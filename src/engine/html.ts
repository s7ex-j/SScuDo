import { analyze } from "./analyze";
import { BRANDS, isOfficialHost } from "./brands";
import { fold } from "./normalize";
import { analyzePage, pageVerdict } from "./page";
import type { PageLevel } from "./page";
import type { Brand, Finding } from "./types";
import { isShortener, registrableOf } from "./urls";

// Lee una página ya cargada por otro (la app de Android en un navegador
// aislado, la extensión en la pestaña abierta o el servicio en Cloudflare).
// Esta función no hace peticiones: recibe el HTML y el texto visible.
//
// Qué mira: si pide clave, tarjeta o códigos; a qué dominio envía esos datos;
// si usa imágenes del sitio oficial de un banco; qué dice el texto visible
// (con las mismas señales que un mensaje); teléfonos, WhatsApp y correos;
// cuántos días tiene el dominio; por dónde pasó el enlace; y, si lo hay, el
// aviso de Google Safe Browsing. Devuelve además una lista punto por punto.

export interface HtmlInput {
  /** Dirección final, después de seguir las redirecciones. */
  url: string;
  html: string;
  /** Direcciones por las que pasó, de la primera a la final. */
  cadena?: string[];
  /** Fecha de registro del dominio (ISO), si se pudo consultar. */
  creado?: string | null;
  /** Texto visible de la página (document.body.innerText), si se renderizó. */
  texto?: string;
  /** Resultado de Google Safe Browsing (solo Android). Ausente = no se consultó. */
  safeBrowsing?: { amenaza: string | null };
  /** Momento de referencia en ms (para pruebas). */
  ahora?: number;
}

export type EstadoPunto = "bien" | "ojo" | "mal" | "sin_datos";

/** Un punto de la revisión: qué se miró y cómo salió. */
export interface Punto {
  id: string;
  titulo: string;
  estado: EstadoPunto;
  detalle: string;
}

export interface PageData {
  titulo: string;
  descripcion: string;
  telefonos: string[];
  whatsapp: string[];
  correos: string[];
  pideClave: boolean;
  pideTarjeta: boolean;
  pideCodigo: boolean;
  /** Dominios que reciben los datos de los formularios, si no son el de la página. */
  enviaA: string[];
  /** Entidades cuyo sitio oficial sirve imágenes o estilos a esta página. */
  recursosDe: string[];
  diasDominio: number | null;
  cadena: string[];
  /** Señales de estafa encontradas en el texto visible. */
  frasesTexto: string[];
}

export interface HtmlReport {
  level: PageLevel;
  headline: string;
  detail: string;
  registrable: string | null;
  brand: Brand | null;
  findings: Finding[];
  datos: PageData;
  puntos: Punto[];
}

const SENSIBLES = new Set<Brand["kind"]>(["banco", "billetera", "estado", "pensiones"]);
const MAX_HTML = 1_500_000;

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ" };

function decodificar(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTIDADES[e] ?? m;
  });
}

function limpio(s: string, max = 200): string {
  return decodificar(s).replace(/\s+/g, " ").trim().slice(0, max);
}

/** Atributos de una etiqueta: <input type="password" name=clave> → { type: "password", name: "clave" }. */
function atributos(etiqueta: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-z_:][-a-z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/gi;
  const cuerpo = etiqueta.replace(/^<\s*[a-z0-9]+/i, "").replace(/\/?>$/, "");
  for (const m of cuerpo.matchAll(re)) out[m[1].toLowerCase()] = decodificar(m[2] ?? m[3] ?? m[4] ?? "");
  return out;
}

function etiquetas(html: string, nombre: string): Record<string, string>[] {
  return [...html.matchAll(new RegExp(`<${nombre}\\b[^>]*>`, "gi"))].map((m) => atributos(m[0]));
}

function hostDe(ref: string, base: URL): string | null {
  try {
    const u = new URL(ref, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

const VISIBLE = (a: Record<string, string>) => !/^(hidden|submit|button|reset|image|checkbox|radio|file)$/i.test(a.type ?? "");
const DESCRIPCION = (a: Record<string, string>) => fold([a.name, a.id, a.placeholder, a.autocomplete, a["aria-label"]].filter(Boolean).join(" ")).text;

const ES_TARJETA = /\b(cc-(number|csc|exp)|card|tarjeta|cvv|cvc|csc|cod(igo)? de seguridad|vencimiento|expira)/;
const ES_CODIGO = /\b(otp|token|clave dinamica|clave sms|codigo (de )?(verificacion|validacion|confirmacion|sms|seguridad)|digital ?pass|pin)\b/;

interface Campos {
  clave: boolean;
  tarjeta: boolean;
  codigo: boolean;
}

function campos(fragmento: string): Campos {
  const c: Campos = { clave: false, tarjeta: false, codigo: false };
  for (const a of etiquetas(fragmento, "input")) {
    if (!VISIBLE(a)) continue;
    const d = DESCRIPCION(a);
    if ((a.type ?? "").toLowerCase() === "password") c.clave = true;
    if (ES_TARJETA.test(d)) c.tarjeta = true;
    else if (ES_CODIGO.test(d)) c.codigo = true;
  }
  return c;
}

function telefonos(texto: string, enlaces: string[]): string[] {
  const out = new Set<string>();
  const poner = (crudo: string) => {
    const d = crudo.replace(/\D/g, "").replace(/^0051/, "51");
    const sin = d.startsWith("51") && d.length === 11 ? d.slice(2) : d;
    if (/^9\d{8}$/.test(sin)) out.add(`${sin.slice(0, 3)} ${sin.slice(3, 6)} ${sin.slice(6)}`);
    else if (/^0?1\d{7}$/.test(sin)) out.add(`(01) ${sin.slice(-7, -4)} ${sin.slice(-4)}`);
    else if (/^0800\d{5}$/.test(sin)) out.add(`0800 ${sin.slice(4)}`);
  };
  for (const h of enlaces) {
    const m = /^tel:(.+)$/i.exec(h.trim());
    if (m) poner(decodeURIComponent(m[1]));
  }
  for (const m of texto.matchAll(/(?<![\d])(?:\+?51[\s.-]?)?9\d{2}[\s.-]?\d{3}[\s.-]?\d{3}(?![\d])/g)) poner(m[0]);
  for (const m of texto.matchAll(/\(0?1\)[\s.-]?\d{3}[\s.-]?\d{4}(?![\d])|\b0800[\s.-]?\d{1,2}[\s.-]?\d{3,4}\b/g)) poner(m[0]);
  return [...out].slice(0, 8);
}

function whatsapp(enlaces: string[]): string[] {
  const out = new Set<string>();
  for (const h of enlaces) {
    const m = /(?:wa\.me\/|api\.whatsapp\.com\/send\/?\?(?:[^#]*&)?phone=|whatsapp:\/\/send\/?\?(?:[^#]*&)?phone=)\+?(\d{8,15})/i.exec(h);
    if (m) out.add("+" + m[1]);
  }
  return [...out].slice(0, 5);
}

function correos(texto: string, enlaces: string[]): string[] {
  const out = new Set<string>();
  for (const h of enlaces) {
    const m = /^mailto:([^?]+)/i.exec(h.trim());
    if (m) out.add(decodeURIComponent(m[1]).toLowerCase());
  }
  for (const m of texto.matchAll(/[a-z0-9._%+-]+@(?:[a-z0-9-]+\.)+[a-z]{2,}/gi)) {
    if (!/\.(png|jpe?g|gif|svg|webp)$/i.test(m[0])) out.add(m[0].toLowerCase());
  }
  return [...out].slice(0, 5);
}

function hallazgo(id: string, category: Finding["category"], weight: number, title: string, detail: string): Finding {
  return { id, category, weight, title, detail, spans: [] };
}

export function analyzeHtml(input: HtmlInput): HtmlReport {
  const html = input.html.slice(0, MAX_HTML);
  const cadena = (input.cadena?.length ? input.cadena : [input.url]).slice(0, 10);
  let base: URL;
  try {
    base = new URL(input.url);
  } catch {
    base = new URL("about:blank");
  }

  const sinCodigo = html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, " ");
  const texto = limpio(sinCodigo.replace(/<[^>]+>/g, " "), 40_000);
  const metas = etiquetas(html, "meta");
  const meta = (clave: string) => metas.find((m) => (m.name ?? m.property ?? "").toLowerCase() === clave)?.content ?? "";
  const titulo = limpio(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "") || limpio(meta("og:title"));
  const h1 = limpio(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(sinCodigo)?.[1]?.replace(/<[^>]+>/g, " ") ?? "");
  const descripcion = limpio(meta("description") || meta("og:description"), 300);
  const nombreSitio = limpio(meta("og:site_name"));

  const enlaces = etiquetas(html, "a").map((a) => a.href ?? "").filter(Boolean);
  const general = campos(sinCodigo);

  // A dónde mandan los datos los formularios que piden clave o códigos.
  const enviaA = new Set<string>();
  const propio = registrableOf(base.hostname || "x.invalid");
  for (const m of sinCodigo.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form\s*>/gi)) {
    const c = campos(m[2]);
    if (!c.clave && !c.codigo) continue;
    const accion = atributos(`<form ${m[1]}>`).action ?? "";
    const h = accion.trim() ? hostDe(accion, base) : null;
    if (h && registrableOf(h) !== propio) enviaA.add(registrableOf(h));
  }

  // Imágenes, estilos o scripts traídos del sitio oficial de una entidad.
  const recursos = [
    ...etiquetas(html, "img").map((a) => a.src ?? ""),
    ...etiquetas(html, "script").map((a) => a.src ?? ""),
    ...etiquetas(html, "link").map((a) => a.href ?? ""),
  ].filter(Boolean);
  const recursosDe = new Set<Brand>();
  for (const r of recursos) {
    const h = hostDe(r, base);
    if (!h) continue;
    const b = BRANDS.find((x) => SENSIBLES.has(x.kind) && isOfficialHost(h, x) && !isOfficialHost(base.hostname, x));
    if (b) recursosDe.add(b);
  }

  // El texto visible, revisado con las mismas señales que un mensaje. Los
  // enlaces y correos de una página son ruido (menús, pies): no cuentan.
  const visible = (input.texto ?? texto).replace(/[ \t]+/g, " ").slice(0, 6000);
  const delTexto = visible.trim()
    ? analyze(visible).findings.filter((f) => f.weight > 0 && !/^(url_|correo_)/.test(f.id) && f.id !== "marca_enlace_ajeno")
    : [];
  const puntajeTexto = delTexto.reduce((n, f) => n + f.weight, 0);
  const nivelTexto = !visible.trim() ? null : puntajeTexto >= 55 ? "alto" : puntajeTexto >= 22 ? "sospechoso" : "sin_senales";

  const ahora = input.ahora ?? Date.now();
  const creado = input.creado ? Date.parse(input.creado) : NaN;
  const diasDominio = Number.isFinite(creado) ? Math.max(0, Math.floor((ahora - creado) / 86_400_000)) : null;

  const datos: PageData = {
    titulo,
    descripcion,
    telefonos: telefonos(texto, enlaces),
    whatsapp: whatsapp(enlaces),
    correos: correos(texto, enlaces),
    pideClave: general.clave,
    pideTarjeta: general.tarjeta,
    pideCodigo: general.codigo,
    enviaA: [...enviaA],
    recursosDe: [...recursosDe].map((b) => b.name),
    diasDominio,
    cadena,
    frasesTexto: delTexto.slice(0, 4).map((f) => f.title),
  };

  const presentacion = [titulo, nombreSitio, h1].filter(Boolean).join(" | ");
  const base0 = analyzePage({ url: input.url, title: presentacion, hasPassword: general.clave || general.codigo, hasCard: general.tarjeta });
  const amenaza = input.safeBrowsing?.amenaza ?? null;
  if (base0.level === "no_aplica" || base0.level === "oficial" || !base0.url) {
    const r = { level: base0.level, headline: base0.headline, detail: base0.detail, registrable: base0.url?.registrable ?? null, brand: base0.brand, findings: base0.findings, datos };
    return { ...r, puntos: puntos(r, base, input, nivelTexto) };
  }

  const findings = [...base0.findings];
  let brand = base0.brand;
  const pideAlgo = general.clave || general.tarjeta || general.codigo;

  if (enviaA.size > 0) {
    findings.push(hallazgo("pagina_envia_a_otro", "datos", 25, "Manda tu clave a otro dominio", `El formulario que pide la clave o el código envía lo que escribes a ${[...enviaA].join(", ")}, no a la página donde estás.`));
  }
  if (general.codigo) {
    findings.push(hallazgo("pagina_pide_codigo", "datos", 18, "Pide un código de verificación o clave dinámica", "Ese código sirve para autorizar operaciones. Un banco nunca te lo pide en una página a la que llegaste por un enlace."));
  }
  if (pideAlgo && recursosDe.size > 0) {
    const b = [...recursosDe][0];
    brand = brand ?? b;
    findings.push(hallazgo("pagina_copia_recursos", "suplantacion", 25, `Usa imágenes del sitio oficial de ${b.name}`, `La página está en ${base0.url.registrable}, pero carga su logo o su diseño desde el sitio de ${b.name}. Así se arman las copias.`));
  }
  if (pideAlgo && base.protocol === "http:") {
    findings.push(hallazgo("pagina_sin_cifrar", "datos", 20, "Pide datos sin conexión cifrada", "La página no usa https: lo que escribas viaja sin protección."));
  }
  if (diasDominio !== null && diasDominio < 180) {
    findings.push(
      diasDominio < 30
        ? hallazgo("dominio_nuevo", "enlace", 30, `El dominio se registró hace ${diasDominio === 1 ? "1 día" : `${diasDominio} días`}`, "Las páginas de estafa duran poco y se crean justo antes de cada campaña. Un banco o una tienda conocida no estrenan dominio para escribirte.")
        : hallazgo("dominio_reciente", "enlace", 12, `El dominio tiene menos de 6 meses (${diasDominio} días)`, "No prueba nada por sí solo, pero las páginas falsas casi siempre son recientes."),
    );
  }
  if (pideAlgo && nivelTexto === "alto") {
    findings.push(hallazgo("pagina_texto_estafa", "datos", 25, "El texto de la página usa frases típicas de estafa", `Mientras te pide datos, dice cosas como: ${delTexto.slice(0, 2).map((f) => `"${f.title.toLowerCase()}"`).join(" y ")}.`));
  }
  if (amenaza) {
    findings.push(hallazgo("safe_browsing", "enlace", 60, "Google la tiene marcada como peligrosa", "Google Safe Browsing, la lista que usan Chrome y Android, tiene esta página registrada como engañosa o dañina."));
  }
  const saltos = new Set(cadena.map((c) => hostDe(c, base)).filter((h): h is string => !!h && !isShortener(h)).map(registrableOf));
  if (saltos.size >= 3) {
    findings.push(hallazgo("pagina_muchos_saltos", "enlace", 8, `El enlace pasó por ${saltos.size} dominios distintos`, "Saltar de página en página sirve para esquivar los filtros que bloquean estafas."));
  }

  const v = pageVerdict(base0.url, brand, findings);
  const r = { level: v.level, headline: v.headline, detail: v.detail, registrable: base0.url.registrable, brand: v.brand, findings: v.findings, datos };
  return { ...r, puntos: puntos(r, base, input, nivelTexto) };
}

/** La revisión punto por punto: qué se miró y cómo salió cada cosa. */
function puntos(r: Omit<HtmlReport, "puntos">, base: URL, input: HtmlInput, nivelTexto: string | null): Punto[] {
  const d = r.datos;
  const oficial = r.level === "oficial";
  const ids = new Set(r.findings.map((f) => f.id));
  const pide = [d.pideClave && "una clave", d.pideTarjeta && "datos de tarjeta", d.pideCodigo && "un código o clave dinámica"].filter(Boolean) as string[];
  const out: Punto[] = [];
  const p = (id: string, titulo: string, estado: EstadoPunto, detalle: string) => out.push({ id, titulo, estado, detalle });

  if (r.level === "no_aplica") return out;

  if (oficial) p("dominio", "Dominio", "bien", `${r.registrable} es un dominio oficial de ${r.brand?.name ?? "una entidad conocida"}.`);
  else if (ids.has("url_marca_en_dominio") || ids.has("url_parecido") || ids.has("pagina_pide_clave_marca") || ids.has("pagina_copia_recursos"))
    p("dominio", "Dominio", "mal", `${r.registrable} se hace pasar por ${r.brand?.name ?? "otra entidad"}, pero no es su dominio.`);
  else if (ids.has("url_alojamiento_gratis") || ids.has("url_terminacion") || ids.has("url_palabras_gancho"))
    p("dominio", "Dominio", "ojo", `${r.registrable}: ${r.findings.filter((f) => /^url_(alojamiento|terminacion|palabras)/.test(f.id)).map((f) => f.title.toLowerCase()).join("; ")}.`);
  else p("dominio", "Dominio", "bien", `${r.registrable} no imita a ninguna entidad que SScuDo conozca. Eso no dice quién está detrás.`);

  if (input.safeBrowsing) {
    p("safe_browsing", "Lista de Google", input.safeBrowsing.amenaza ? "mal" : "bien", input.safeBrowsing.amenaza ? "Google Safe Browsing la marca como peligrosa." : "Google Safe Browsing no la tiene marcada. Las páginas nuevas tardan en entrar a esa lista.");
  }

  if (base.protocol === "http:") p("conexion", "Conexión", pide.length ? "mal" : "ojo", "No usa https: lo que escribas viaja sin cifrar.");
  else p("conexion", "Conexión", "bien", "Usa https. Ojo: las páginas falsas también lo usan, no prueba que sea legítima.");

  if (d.diasDominio === null) p("antiguedad", "Antigüedad del dominio", "sin_datos", "No se pudo consultar cuándo se registró.");
  else p("antiguedad", "Antigüedad del dominio", d.diasDominio < 30 ? "mal" : d.diasDominio < 180 ? "ojo" : "bien", d.diasDominio < 1 ? "Se registró hoy." : `Se registró hace ${d.diasDominio} ${d.diasDominio === 1 ? "día" : "días"}.`);

  if (!pide.length) p("pide", "Qué te pide", "bien", "No tiene campos de clave, tarjeta ni códigos.");
  else p("pide", "Qué te pide", oficial ? "bien" : "ojo", `Pide ${pide.join(", ")}.${oficial ? "" : " Escríbelos solo en la página oficial que abres tú mismo."}`);

  if (pide.length) {
    if (d.enviaA.length) p("envia", "A dónde manda tus datos", "mal", `A ${d.enviaA.join(", ")}, un dominio distinto del que ves.`);
    else p("envia", "A dónde manda tus datos", "bien", "Al mismo dominio de la página (o no se pudo ver: algunas lo hacen por código).");
  }

  if (d.recursosDe.length && !oficial) p("recursos", "Logos e imágenes", pide.length ? "mal" : "ojo", `Carga imágenes o diseño desde el sitio de ${d.recursosDe.join(", ")}.`);

  if (nivelTexto) {
    const estado: EstadoPunto = nivelTexto === "alto" ? "mal" : nivelTexto === "sospechoso" ? "ojo" : "bien";
    p("texto", "Lo que dice el texto", oficial && estado !== "bien" ? "ojo" : estado, d.frasesTexto.length ? `Encontré: ${d.frasesTexto.map((x) => x.toLowerCase()).join("; ")}.` : "No usa las frases típicas de las estafas que conozco.");
  } else {
    p("texto", "Lo que dice el texto", "sin_datos", "No se leyó el texto visible de la página.");
  }

  if (d.cadena.length > 1) {
    const acortada = d.cadena.slice(0, -1).some((c) => {
      try {
        return isShortener(new URL(c).hostname);
      } catch {
        return false;
      }
    });
    p("camino", "Camino del enlace", ids.has("pagina_muchos_saltos") ? "ojo" : acortada ? "ojo" : "bien", `Pasó por ${d.cadena.length - 1} ${d.cadena.length === 2 ? "redirección" : "redirecciones"}${acortada ? ", empezando por un acortador" : ""}.`);
  }

  if (d.telefonos.length || d.whatsapp.length) {
    p("contacto", "Teléfonos de contacto", oficial ? "bien" : "ojo", `${[...d.telefonos, ...d.whatsapp.map((w) => "WhatsApp " + w)].join(", ")}. Compáralos con el número del reverso de tu tarjeta.`);
  }
  return out;
}
