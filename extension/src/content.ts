// Corre en cada página. Solo mira tres cosas: la dirección, el título y si hay
// campos de clave o de tarjeta. No lee lo que escribes ni el contenido.
import type { Mensaje, Respuesta } from "./mensajes";

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
    "display:flex;gap:14px;align-items:center;padding:14px 18px;background:#151923;color:#f1eadd;border-bottom:4px solid #ff5c7a;font:16px/1.4 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5)";
  const texto = document.createElement("div");
  texto.style.cssText = "flex:1;min-width:0";
  const h = document.createElement("strong");
  h.textContent = "SScuDo: " + titulo;
  h.style.cssText = "display:block;color:#ff5c7a;font-size:17px";
  const p = document.createElement("span");
  p.textContent = detalle;
  texto.append(h, p);
  const cerrar = document.createElement("button");
  cerrar.textContent = "Entendido";
  cerrar.style.cssText = "flex:none;font:inherit;font-weight:600;padding:9px 14px;border-radius:8px;border:1px solid #3f4763;background:#232838;color:#f1eadd;cursor:pointer";
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

if (window.top === window) {
  revisar();
  // Los formularios de clave a veces aparecen después de cargar.
  window.setTimeout(revisar, 2500);
}
