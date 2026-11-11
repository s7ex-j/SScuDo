import { analyze, analyzePage } from "../../src/engine";
import type { Finding, PageReport, UrlReport } from "../../src/engine";

const $ = (id: string) => document.getElementById(id)!;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, texto?: string, clase?: string) {
  const e = document.createElement(tag);
  if (texto) e.textContent = texto;
  if (clase) e.className = clase;
  return e;
}

function pintarUrl(u: UrlReport) {
  const d = el("div", undefined, "url" + (u.official ? "" : " ajeno"));
  if (u.scheme) d.append(u.scheme + "://");
  if (u.subdomain) d.append(u.subdomain + ".");
  d.append(el("b", u.registrable));
  if (u.path) d.append(u.path.length > 36 ? u.path.slice(0, 36) + "…" : u.path);
  return d;
}

function pintarHallazgos(fs: Finding[]) {
  const ul = el("ul");
  for (const f of fs.filter((x) => x.weight > 0).slice(0, 5)) {
    const li = el("li");
    li.append(el("strong", f.title), el("span", f.detail));
    ul.append(li);
  }
  return ul;
}

function pintarPagina(r: PageReport) {
  const caja = $("pagina");
  caja.replaceChildren();
  const v = el("div", undefined, "veredicto " + r.level);
  v.append(el("h2", r.headline), el("p", r.detail));
  caja.append(v);
  if (r.url) caja.append(pintarUrl(r.url));
  if (r.level === "alto" || r.level === "sospechoso") caja.append(pintarHallazgos(r.findings));
}

const TITULO = { alto: "Alta probabilidad de estafa", sospechoso: "Sospechoso", sin_senales: "No encontré señales" } as const;

function revisarMensaje(texto: string) {
  const out = $("resultado");
  out.replaceChildren();
  const a = analyze(texto);
  if (a.empty) return;
  const v = el("div", undefined, "veredicto " + a.level);
  v.append(el("h2", TITULO[a.level]), el("p", a.campaign ? `Se parece a: ${a.campaign.name}.` : a.level === "sin_senales" ? "Eso no lo vuelve seguro." : "Comprueba por otro canal antes de hacer algo."));
  out.append(v);
  for (const u of a.urls) out.append(pintarUrl(u));
  out.append(pintarHallazgos(a.findings));
}

async function iniciar() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let informe: PageReport | null = null;
  if (tab?.id !== undefined) {
    const k = `tab-${tab.id}`;
    informe = ((await chrome.storage.session.get(k))[k] as PageReport | undefined) ?? null;
    if (!informe && tab.url) informe = analyzePage({ url: tab.url, title: tab.title });
  }
  pintarPagina(informe ?? analyzePage({ url: "about:blank" }));

  const { pendiente } = await chrome.storage.session.get("pendiente");
  if (typeof pendiente === "string" && pendiente) {
    ($("texto") as HTMLTextAreaElement).value = pendiente;
    revisarMensaje(pendiente);
    await chrome.storage.session.remove("pendiente");
    chrome.action.setBadgeText({ text: "" });
  }
  $("revisar").addEventListener("click", () => revisarMensaje(($("texto") as HTMLTextAreaElement).value));
}

iniciar();
