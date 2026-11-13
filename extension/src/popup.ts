import { analyze, analyzeHtml, analyzePage, registrableOf } from "../../src/engine";
import type { Finding, HtmlReport, PageReport, Punto, UrlReport } from "../../src/engine";
import type { Lectura, PedidoLectura } from "./mensajes";

const $ = (id: string) => document.getElementById(id)!;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, texto?: string, clase?: string) {
  const e = document.createElement(tag);
  if (texto) e.textContent = texto;
  if (clase) e.className = clase;
  return e;
}

const SELLO: Record<string, string> = {
  alto: "Alta probabilidad de estafa",
  sospechoso: "Sospechoso",
  sin_senales: "Sin señales conocidas",
  oficial: "Dominio oficial",
  no_aplica: "No revisable",
};
const MARCA: Record<Punto["estado"], string> = { bien: "Bien", ojo: "Ojo", mal: "Mal", sin_datos: "Sin datos" };

function sello(nivel: string) {
  const s = el("div", undefined, "sello " + nivel);
  s.setAttribute("role", "img");
  s.setAttribute("aria-label", "Resultado: " + SELLO[nivel]);
  s.append(el("small", "SScuDo revisó"), el("b", SELLO[nivel]));
  return s;
}

function pintarUrl(u: UrlReport) {
  const d = el("p", undefined, "url" + (u.official ? "" : " ajeno"));
  if (u.scheme) d.append(u.scheme + "://");
  if (u.subdomain) d.append(u.subdomain + ".");
  d.append(el("b", u.registrable));
  if (u.path) d.append(u.path.length > 36 ? u.path.slice(0, 36) + "…" : u.path);
  return d;
}

function pintarHallazgos(fs: { title: string; detail: string; weight: number }[]) {
  const ul = el("ul", undefined, "hallazgos");
  for (const f of fs.filter((x) => x.weight > 0).slice(0, 5)) {
    const li = el("li");
    li.append(el("strong", f.title), el("span", f.detail));
    ul.append(li);
  }
  return ul;
}

function pintarPuntos(ps: Punto[]) {
  const ul = el("ul", undefined, "puntos");
  for (const p of ps) {
    const li = el("li", undefined, p.estado);
    const cuerpo = el("div");
    cuerpo.append(el("strong", p.titulo), el("span", p.detalle));
    li.append(el("span", MARCA[p.estado], "marca"), cuerpo);
    ul.append(li);
  }
  return ul;
}

/** Vista rápida (lo que ya calculó el fondo) mientras se lee la página completa. */
function pintarRapido(r: PageReport, cargando: boolean) {
  const caja = $("pagina");
  caja.replaceChildren(sello(r.level), el("h2", r.headline), el("p", r.detail, "detalle"));
  if (r.url) caja.append(pintarUrl(r.url));
  if (cargando && r.level !== "no_aplica") caja.append(el("p", "Leyendo el texto y el código de la página…", "cargando"));
  else if (r.level === "alto" || r.level === "sospechoso") caja.append(pintarHallazgos(r.findings));
}

function pintarCompleto(r: HtmlReport, url: UrlReport | null) {
  const caja = $("pagina");
  caja.replaceChildren(sello(r.level), el("h2", r.headline), el("p", r.detail, "detalle"));
  if (url) caja.append(pintarUrl(url));
  if (r.puntos.length) caja.append(el("h3", "Punto por punto"), pintarPuntos(r.puntos));
  if (r.level === "alto" || r.level === "sospechoso") caja.append(el("h3", "Lo que encontré"), pintarHallazgos(r.findings));
}

/** Fecha de registro del dominio (RDAP). Si no responde, la revisión sigue sin ese dato. */
async function fechaRegistro(dominio: string): Promise<string | null> {
  try {
    const r = await fetch(`https://rdap.org/domain/${encodeURIComponent(dominio)}`, { headers: { Accept: "application/rdap+json" }, signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const d = (await r.json()) as { events?: { eventAction?: string; eventDate?: string }[] };
    return d.events?.find((e) => e.eventAction === "registration")?.eventDate ?? null;
  } catch {
    return null;
  }
}

function leerPestana(tabId: number): Promise<Lectura | null> {
  return new Promise((ok) => {
    try {
      chrome.tabs.sendMessage(tabId, { tipo: "leer" } satisfies PedidoLectura, { frameId: 0 }, (l?: Lectura) => ok(chrome.runtime.lastError ? null : l ?? null));
    } catch {
      ok(null);
    }
  });
}

const TITULO = { alto: "Alta probabilidad de estafa", sospechoso: "Sospechoso", sin_senales: "Sin señales conocidas" } as const;

function revisarMensaje(texto: string) {
  const out = $("resultado");
  out.replaceChildren();
  const a = analyze(texto);
  if (a.empty) return;
  out.append(sello(a.level), el("p", a.campaign ? `Se parece a: ${a.campaign.name}.` : a.level === "sin_senales" ? `${TITULO.sin_senales}. Eso no lo vuelve seguro.` : "Comprueba por otro canal antes de hacer algo.", "detalle"));
  for (const u of a.urls) out.append(pintarUrl(u));
  out.append(pintarHallazgos(a.findings as Finding[]));
}

async function iniciar() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let rapido: PageReport | null = null;
  if (tab?.id !== undefined) {
    const k = `tab-${tab.id}`;
    rapido = ((await chrome.storage.session.get(k))[k] as PageReport | undefined) ?? null;
    if (!rapido && tab.url) rapido = analyzePage({ url: tab.url, title: tab.title });
  }
  rapido = rapido ?? analyzePage({ url: "about:blank" });
  pintarRapido(rapido, rapido.level !== "no_aplica");

  $("revisar").addEventListener("click", () => revisarMensaje(($("texto") as HTMLTextAreaElement).value));
  const { pendiente } = await chrome.storage.session.get("pendiente");
  if (typeof pendiente === "string" && pendiente) {
    ($("texto") as HTMLTextAreaElement).value = pendiente;
    revisarMensaje(pendiente);
    await chrome.storage.session.remove("pendiente");
    chrome.action.setBadgeText({ text: "" });
  }

  if (tab?.id === undefined || rapido.level === "no_aplica") return;
  const lectura = await leerPestana(tab.id);
  if (!lectura) {
    pintarRapido(rapido, false);
    return;
  }
  let creado: string | null = null;
  try {
    creado = await fechaRegistro(registrableOf(new URL(lectura.url).hostname));
  } catch {
    creado = null;
  }
  pintarCompleto(analyzeHtml({ url: lectura.url, html: lectura.html, texto: lectura.texto, creado }), rapido.url);
}

iniciar();
