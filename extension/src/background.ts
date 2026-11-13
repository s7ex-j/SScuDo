// Service worker de la extensión. Recibe los datos mínimos de cada página
// (dirección, título, si pide clave o tarjeta), los pasa por el motor y pone
// la marca en el icono. Nada sale del navegador: no hay peticiones de red.
import { analyzePage } from "../../src/engine";
import type { PageReport } from "../../src/engine";
import type { Mensaje, Respuesta } from "./mensajes";

const MARCA: Record<PageReport["level"], { texto: string; color: string }> = {
  alto: { texto: "!", color: "#c41e3a" },
  sospechoso: { texto: "?", color: "#9a5f0c" },
  oficial: { texto: "✓", color: "#4a5a78" },
  sin_senales: { texto: "", color: "#4a5a78" },
  no_aplica: { texto: "", color: "#4a5a78" },
};

const clave = (tabId: number) => `tab-${tabId}`;

chrome.runtime.onMessage.addListener((msg: Mensaje, sender, responder: (r: Respuesta) => void) => {
  if (msg.tipo !== "pagina" || sender.tab?.id === undefined || sender.frameId !== 0) return false;
  const tabId = sender.tab.id;
  const informe = analyzePage(msg.datos);
  const m = MARCA[informe.level];
  chrome.action.setBadgeText({ tabId, text: m.texto });
  chrome.action.setBadgeBackgroundColor({ tabId, color: m.color });
  chrome.storage.session.set({ [clave(tabId)]: informe });
  responder({ informe });
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(clave(tabId));
});

// Clic derecho sobre un texto seleccionado o un enlace → revisarlo en la ventanita.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "sscudo-revisar", title: "Revisar con SScuDo", contexts: ["selection", "link"] });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== "sscudo-revisar") return;
  const texto = [info.selectionText, info.linkUrl].filter(Boolean).join("\n");
  await chrome.storage.session.set({ pendiente: texto });
  try {
    await chrome.action.openPopup();
  } catch {
    // Si el navegador no deja abrirla sola, queda un aviso en el icono.
    chrome.action.setBadgeText({ text: "1" });
    chrome.action.setBadgeBackgroundColor({ color: "#1d2a44" });
  }
});
