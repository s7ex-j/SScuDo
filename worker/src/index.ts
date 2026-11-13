// Servicio de reportes de SScuDo.
//
//   POST /reportes        una persona reporta un dominio y/o un tipo de estafa
//   GET  /lista           dominios reportados por varias personas (para comprobar en local)
//   GET  /campanas        cuántos reportes tuvo cada tipo de estafa esta semana
//   POST /admin/ocultar   moderación: retirar un dominio de la lista (requiere clave)
//   POST /admin/mostrar   moderación: deshacer lo anterior
//   POST /pagina          revisa una página sin abrirla en el teléfono (ver pagina.ts)
//
// Decisiones de diseño:
// - No se recibe ni se guarda el mensaje. Solo dominios y el tipo de estafa.
// - No se guardan teléfonos ni nombres: reportar a una persona se presta al abuso.
// - No se guarda la IP. Se guarda una huella que cambia cada día.
// - Un dominio aparece en la lista solo cuando lo reportan UMBRAL personas distintas.
// - Los dominios oficiales y los sitios muy conocidos no se pueden reportar.
// - La app y la extensión descargan la lista y comparan en el dispositivo: el
//   servicio nunca se entera de qué páginas visita cada quien.
import { officialBrandOf } from "../../src/engine/brands";
import { revisarPagina } from "./pagina";

export interface Env {
  DB: D1Database;
  ORIGENES: string;
  UMBRAL: string;
  SAL: string;
  ADMIN: string;
  NAVEGADOR?: Fetcher;
}

const NO_REPORTABLES = [
  "google.com", "youtube.com", "youtu.be", "facebook.com", "instagram.com", "whatsapp.com", "wa.me", "tiktok.com", "x.com", "twitter.com",
  "linkedin.com", "wikipedia.org", "apple.com", "microsoft.com", "live.com", "outlook.com", "gmail.com", "github.com", "amazon.com",
  "zoom.us", "spotify.com", "netflix.com", "telegram.org", "t.me", "bit.ly", "tinyurl.com", "t.co",
];
const NIVELES = new Set(["alto", "sospechoso"]);
const MAX_POR_DIA = 20;
const DIAS_LISTA = 30;

const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...extra } });

function cors(req: Request, env: Env, escritura: boolean): Record<string, string> {
  const origen = req.headers.get("Origin") ?? "";
  if (!escritura) return { "Access-Control-Allow-Origin": "*" };
  const permitidos = env.ORIGENES.split(",").map((s) => s.trim());
  const ok = permitidos.includes(origen) || origen.startsWith("chrome-extension://");
  return ok ? { "Access-Control-Allow-Origin": origen, Vary: "Origin" } : {};
}

export function dominioValido(d: unknown): d is string {
  if (typeof d !== "string" || d.length < 4 || d.length > 100) return false;
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(d)) return false;
  if (officialBrandOf(d)) return false;
  return !NO_REPORTABLES.some((x) => d === x || d.endsWith("." + x));
}

async function huella(ip: string, dia: string, sal: string): Promise<string> {
  const datos = new TextEncoder().encode(`${sal}|${dia}|${ip}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", datos));
  return [...hash.slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function reportar(req: Request, env: Env, h: Record<string, string>): Promise<Response> {
  if (!h["Access-Control-Allow-Origin"]) return json({ error: "origen no permitido" }, 403);
  let cuerpo: { dominios?: unknown; campana?: unknown; nivel?: unknown };
  try {
    const texto = await req.text();
    if (texto.length > 2000) return json({ error: "demasiado grande" }, 413, h);
    cuerpo = JSON.parse(texto);
  } catch {
    return json({ error: "formato inválido" }, 400, h);
  }
  const nivel = String(cuerpo.nivel ?? "");
  if (!NIVELES.has(nivel)) return json({ error: "nivel inválido" }, 400, h);
  const campana = typeof cuerpo.campana === "string" && /^[a-z0-9-]{1,40}$/.test(cuerpo.campana) ? cuerpo.campana : "";
  const pedidos = Array.isArray(cuerpo.dominios) ? cuerpo.dominios.slice(0, 5).map((d) => String(d).toLowerCase()) : [];
  const dominios = [...new Set(pedidos.filter(dominioValido))];
  if (dominios.length === 0 && !campana) return json({ error: "nada que reportar" }, 400, h);

  const ahora = Date.now();
  const dia = new Date(ahora).toISOString().slice(0, 10);
  const quien = await huella(req.headers.get("CF-Connecting-IP") ?? "local", dia, env.SAL ?? "");

  const usados = await env.DB.prepare("SELECT COUNT(*) AS n FROM reportes WHERE quien = ? AND dia = ?").bind(quien, dia).first<{ n: number }>();
  if ((usados?.n ?? 0) >= MAX_POR_DIA) return json({ error: "límite diario alcanzado" }, 429, h);

  const filas = dominios.length ? dominios : ["-"];
  const alta = env.DB.prepare("INSERT OR IGNORE INTO reportes (dominio, campana, nivel, quien, dia, creado) VALUES (?, ?, ?, ?, ?, ?)");
  await env.DB.batch(filas.map((d) => alta.bind(d, campana, nivel, quien, dia, ahora)));
  return json({ ok: true, recibidos: dominios, rechazados: pedidos.filter((d) => !dominios.includes(d)) }, 201, h);
}

async function pagina(req: Request, env: Env, h: Record<string, string>): Promise<Response> {
  if (!h["Access-Control-Allow-Origin"]) return json({ error: "origen no permitido" }, 403);
  const texto = await req.text();
  if (texto.length > 3000) return json({ error: "demasiado grande" }, 413, h);
  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    return json({ error: "formato inválido" }, 400, h);
  }
  const dia = new Date().toISOString().slice(0, 10);
  const quien = await huella(req.headers.get("CF-Connecting-IP") ?? "local", dia, env.SAL ?? "");
  const r = await revisarPagina(cuerpo, quien, dia, env);
  return json(r.datos, r.status, { ...h, "Cache-Control": "no-store" });
}

async function lista(env: Env, h: Record<string, string>): Promise<Response> {
  const umbral = Math.max(2, Number(env.UMBRAL) || 3);
  const desde = Date.now() - DIAS_LISTA * 86_400_000;
  const r = await env.DB.prepare(
    `SELECT dominio AS d, COUNT(DISTINCT quien) AS n, MIN(creado) AS desde, MAX(campana) AS c
       FROM reportes
      WHERE dominio != '-' AND creado >= ? AND dominio NOT IN (SELECT dominio FROM ocultos)
      GROUP BY dominio HAVING n >= ? ORDER BY n DESC LIMIT 2000`,
  )
    .bind(desde, umbral)
    .all<{ d: string; n: number; desde: number; c: string }>();
  return json({ actualizado: Date.now(), umbral, dias: DIAS_LISTA, dominios: r.results }, 200, { ...h, "Cache-Control": "public, max-age=600" });
}

async function campanas(env: Env, h: Record<string, string>): Promise<Response> {
  const desde = Date.now() - 7 * 86_400_000;
  const r = await env.DB.prepare(
    "SELECT campana AS id, COUNT(DISTINCT quien || dia) AS n FROM reportes WHERE campana != '' AND creado >= ? GROUP BY campana ORDER BY n DESC",
  )
    .bind(desde)
    .all<{ id: string; n: number }>();
  return json({ actualizado: Date.now(), dias: 7, campanas: r.results }, 200, { ...h, "Cache-Control": "public, max-age=600" });
}

async function moderar(req: Request, env: Env, ocultar: boolean): Promise<Response> {
  const clave = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  if (!env.ADMIN || clave.length !== env.ADMIN.length || clave !== env.ADMIN) return json({ error: "no autorizado" }, 401);
  const { dominio, motivo } = (await req.json().catch(() => ({}))) as { dominio?: string; motivo?: string };
  if (typeof dominio !== "string" || !dominio) return json({ error: "falta el dominio" }, 400);
  if (ocultar) await env.DB.prepare("INSERT OR REPLACE INTO ocultos (dominio, motivo, creado) VALUES (?, ?, ?)").bind(dominio.toLowerCase(), String(motivo ?? "").slice(0, 200), Date.now()).run();
  else await env.DB.prepare("DELETE FROM ocultos WHERE dominio = ?").bind(dominio.toLowerCase()).run();
  return json({ ok: true });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);
    const escritura = req.method === "POST" || req.method === "OPTIONS";
    const h = cors(req, env, escritura && (pathname === "/reportes" || pathname === "/pagina"));
    try {
      if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...h, "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "content-type", "Access-Control-Max-Age": "86400" } });
      if (req.method === "POST" && pathname === "/reportes") return await reportar(req, env, h);
      if (req.method === "POST" && pathname === "/pagina") return await pagina(req, env, h);
      if (req.method === "GET" && pathname === "/lista") return await lista(env, h);
      if (req.method === "GET" && pathname === "/campanas") return await campanas(env, h);
      if (req.method === "POST" && pathname === "/admin/ocultar") return await moderar(req, env, true);
      if (req.method === "POST" && pathname === "/admin/mostrar") return await moderar(req, env, false);
      if (req.method === "GET" && pathname === "/") return json({ servicio: "sscudo-reportes", version: "0.2.0" }, 200, h);
      return json({ error: "no existe" }, 404, h);
    } catch {
      return json({ error: "error interno" }, 500, h);
    }
  },
};
