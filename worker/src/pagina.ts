// POST /pagina — revisa una página sin que la persona la abra.
//
// El servicio (no el teléfono) sigue las redirecciones, descarga el HTML y lo
// pasa al mismo motor de SScuDo. Así la página de estafa ve una dirección de
// Cloudflare, no la de quien recibió el enlace.
//
// Privacidad:
// - Solo llega la dirección del enlace. Nunca el mensaje.
// - La dirección no se guarda: solo se cuenta una consulta por huella diaria.
// - Si existe el enlace NAVEGADOR (Browser Rendering), se toma una captura en
//   un navegador de Cloudflare. Sin él, todo funciona igual, sin captura.
import { analyzeHtml, isShortener, registrableOf } from "../../src/engine";

export interface EnvPagina {
  DB: D1Database;
  SAL: string;
  NAVEGADOR?: Fetcher;
}

const MAX_SALTOS = 6;
const MAX_BYTES = 1_500_000;
const MAX_CONSULTAS_DIA = 40;
const AGENTE = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

/** Solo direcciones web públicas: nada de IPs, redes locales ni puertos raros. */
export function direccionPermitida(texto: unknown): URL | null {
  if (typeof texto !== "string" || texto.length > 2000) return null;
  let u: URL;
  try {
    u = new URL(texto.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== "80" && u.port !== "443") return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes(".") || /^[\d.]+$/.test(h) || h.includes(":") || h.startsWith("[")) return null;
  if (/(^|\.)(localhost|local|internal|lan|home|arpa|test|invalid)$/.test(h)) return null;
  return u;
}

async function leerTexto(r: Response): Promise<string> {
  const tipo = r.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml|text\/plain/i.test(tipo) || !r.body) {
    await r.body?.cancel();
    return "";
  }
  const lector = r.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await lector.read();
    if (done) break;
    partes.push(value);
    total += value.length;
  }
  await lector.cancel().catch(() => undefined);
  const todo = new Uint8Array(Math.min(total, MAX_BYTES));
  let i = 0;
  for (const p of partes) {
    const resto = todo.length - i;
    if (resto <= 0) break;
    todo.set(p.subarray(0, resto), i);
    i += Math.min(p.length, resto);
  }
  return new TextDecoder("utf-8").decode(todo);
}

/** <meta http-equiv="refresh" content="0;url=..."> — algunos acortadores redirigen así. */
function refrescoMeta(html: string): string | null {
  const m = /<meta[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]*>/i.exec(html.slice(0, 20_000));
  if (!m) return null;
  const c = /content\s*=\s*["']?\s*\d+\s*;\s*url\s*=\s*['"]?([^"'>\s]+)/i.exec(m[0]);
  return c ? c[1] : null;
}

export interface Recorrido {
  final: string;
  cadena: string[];
  estado: number;
  html: string;
  error: string | null;
}

/** Sigue las redirecciones una por una, comprobando cada destino. */
export async function recorrer(inicio: URL, pedir: typeof fetch = fetch): Promise<Recorrido> {
  const cadena = [inicio.toString()];
  let actual = inicio;
  for (let salto = 0; salto <= MAX_SALTOS; salto++) {
    let r: Response;
    try {
      r = await pedir(actual.toString(), {
        method: "GET",
        redirect: "manual",
        headers: { "User-Agent": AGENTE, Accept: "text/html,application/xhtml+xml", "Accept-Language": "es-PE,es;q=0.9" },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      return { final: actual.toString(), cadena, estado: 0, html: "", error: "La página no respondió." };
    }
    const destino = r.status >= 300 && r.status < 400 ? r.headers.get("location") : null;
    let siguiente: string | null = destino;
    let html = "";
    if (!destino) {
      html = await leerTexto(r);
      siguiente = refrescoMeta(html);
      if (!siguiente) return { final: actual.toString(), cadena, estado: r.status, html, error: null };
    } else {
      await r.body?.cancel();
    }
    let proxima: URL | null = null;
    try {
      proxima = direccionPermitida(new URL(siguiente!, actual).toString());
    } catch {
      proxima = null;
    }
    if (!proxima) return { final: actual.toString(), cadena, estado: r.status, html, error: "Redirige a una dirección que no se puede revisar." };
    actual = proxima;
    cadena.push(actual.toString());
  }
  return { final: actual.toString(), cadena, estado: 0, html: "", error: "Demasiadas redirecciones." };
}

/** Fecha de registro del dominio por RDAP (el sucesor público de WHOIS). */
export async function fechaRegistro(dominio: string, pedir: typeof fetch = fetch): Promise<string | null> {
  try {
    const r = await pedir(`https://rdap.org/domain/${encodeURIComponent(dominio)}`, { headers: { Accept: "application/rdap+json" }, signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const d = (await r.json()) as { events?: { eventAction?: string; eventDate?: string }[] };
    return d.events?.find((e) => e.eventAction === "registration")?.eventDate ?? null;
  } catch {
    return null;
  }
}

async function captura(env: EnvPagina, url: string): Promise<{ imagen: string | null; nota: string | null }> {
  if (!env.NAVEGADOR) return { imagen: null, nota: "La vista previa no está activada en este servicio." };
  let navegador: { close(): Promise<void>; newPage(): Promise<any> } | null = null;
  try {
    const { default: puppeteer } = await import("@cloudflare/puppeteer");
    navegador = await puppeteer.launch(env.NAVEGADOR as any);
    const pagina = await navegador!.newPage();
    await pagina.setUserAgent(AGENTE);
    await pagina.setViewport({ width: 390, height: 760, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await pagina.goto(url, { waitUntil: "load", timeout: 12_000 }).catch(() => undefined);
    const b64 = (await pagina.screenshot({ type: "jpeg", quality: 55, encoding: "base64" })) as string;
    return { imagen: `data:image/jpeg;base64,${b64}`, nota: null };
  } catch (e) {
    const limite = /429|limit/i.test(String(e));
    return { imagen: null, nota: limite ? "Se acabó el cupo de vistas previas de hoy. Vuelve a intentarlo mañana." : "No se pudo tomar la vista previa." };
  } finally {
    await navegador?.close().catch(() => undefined);
  }
}

export async function revisarPagina(cuerpo: unknown, quien: string, dia: string, env: EnvPagina, pedir: typeof fetch = fetch): Promise<{ status: number; datos: unknown }> {
  const url = direccionPermitida((cuerpo as { url?: unknown } | null)?.url);
  if (!url) return { status: 400, datos: { error: "Dirección no válida. Solo se revisan páginas web públicas." } };
  const conCaptura = (cuerpo as { captura?: unknown }).captura !== false;

  await env.DB.prepare("INSERT INTO consultas (quien, dia, n) VALUES (?, ?, 1) ON CONFLICT (quien, dia) DO UPDATE SET n = n + 1").bind(quien, dia).run();
  const usadas = await env.DB.prepare("SELECT n FROM consultas WHERE quien = ? AND dia = ?").bind(quien, dia).first<{ n: number }>();
  if ((usadas?.n ?? 0) > MAX_CONSULTAS_DIA) return { status: 429, datos: { error: "Llegaste al límite de revisiones de páginas por hoy." } };

  const rec = await recorrer(url, pedir);
  const final = new URL(rec.final);
  const dominio = registrableOf(final.hostname);
  const [creado, foto] = await Promise.all([
    isShortener(final.hostname) ? Promise.resolve(null) : fechaRegistro(dominio, pedir),
    conCaptura && !rec.error ? captura(env, rec.final) : Promise.resolve({ imagen: null, nota: null }),
  ]);
  const r = analyzeHtml({ url: rec.final, html: rec.html, cadena: rec.cadena, creado });

  return {
    status: 200,
    datos: {
      pedida: url.toString(),
      final: rec.final,
      cadena: rec.cadena,
      estado: rec.estado,
      error: rec.error,
      nivel: r.level,
      titulo: r.headline,
      detalle: r.detail,
      dominio: r.registrable,
      entidad: r.brand?.name ?? null,
      motivos: r.findings.filter((f) => f.weight > 0).map((f) => ({ titulo: f.title, detalle: f.detail })),
      datos: r.datos,
      captura: foto.imagen,
      capturaNota: foto.nota,
    },
  };
}
