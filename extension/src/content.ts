// Corre en cada página. De forma automática solo mira tres cosas: la
// dirección, el título y si hay campos de clave o de tarjeta. El código y el
// texto visible se leen solo cuando abres la ventanita de SScuDo, y se
// analizan ahí mismo, en tu equipo. Nunca lee lo que escribes en los campos.
import type { Lectura, Mensaje, PedidoLectura, Respuesta } from "./mensajes";

function hayCampoTarjeta(): boolean {
  return !!document.querySelector(
    'input[autocomplete^="cc-"], input[name*="card" i], input[name*="tarjeta" i], input[name*="cvv" i], input[name*="cvc" i], input[id*="cvv" i], input[placeholder*="tarjeta" i]',
  );
}

function aviso(titulo: string, detalle: string) {
  if (document.getElementById("sscudo-aviso")) return;
  const host = document.createElement("div");
  host.id = "sscudo-aviso";
  host.style.cssText = "all:initial;position:fixed;top:0;left:0;right:0;z-index:2147483647;";
  const raiz = host.attachShadow({ mode: "closed" });
  const caja = document.createElement("div");
  caja.setAttribute("role", "alert");
  caja.style.cssText =
    "display:flex;gap:14px;align-items:center;padding:14px 18px;background:#fbfcfd;color:#1d2a44;border-bottom:6px double #c41e3a;font:16px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(29,42,68,.25)";
  const texto = document.createElement("div");
  texto.style.cssText = "flex:1;min-width:0";
  const h = document.createElement("strong");
  h.textContent = "SScuDo: " + titulo;
  h.style.cssText = "display:block;color:#c41e3a;font-size:17px";
  const p = document.createElement("span");
  p.textContent = detalle;
  texto.append(h, p);
  const cerrar = document.createElement("button");
  cerrar.textContent = "Entendido";
  cerrar.style.cssText = "flex:none;font:inherit;font-weight:700;padding:9px 14px;border-radius:10px;border:0;background:#1d2a44;color:#fbfcfd;cursor:pointer";
  cerrar.addEventListener("click", () => host.remove());
  caja.append(texto, cerrar);
  raiz.append(caja);
  document.documentElement.append(host);
}

function revisar() {
  const msg: Mensaje = {
    tipo: "pagina",
    datos: {
      url: location.href,
      title: document.title,
      hasPassword: !!document.querySelector('input[type="password"]'),
      hasCard: hayCampoTarjeta(),
    },
  };
  try {
    chrome.runtime.sendMessage(msg, (r: Respuesta | undefined) => {
      if (chrome.runtime.lastError || !r?.informe) return;
      if (r.informe.level === "alto") aviso(r.informe.headline, r.informe.detail);
    });
  } catch {
    /* la extensión se recargó: no pasa nada */
  }
}

// La ventanita pide la página completa: código (sin los valores escritos en
// los campos) y texto visible.
chrome.runtime.onMessage.addListener((msg: PedidoLectura, _remitente, responder: (l: Lectura) => void) => {
  if (msg?.tipo !== "leer" || window.top !== window) return false;
  const copia = document.documentElement.cloneNode(true) as HTMLElement;
  copia.querySelectorAll("input, textarea").forEach((c) => {
    c.removeAttribute("value");
    if (c instanceof HTMLTextAreaElement) c.textContent = "";
  });
  responder({ url: location.href, html: copia.outerHTML.slice(0, 600_000), texto: (document.body?.innerText ?? "").slice(0, 20_000) });
  return false;
});

if (window.top === window) {
  revisar();
  // Los formularios de clave a veces aparecen después de cargar.
  window.setTimeout(revisar, 2500);
}
