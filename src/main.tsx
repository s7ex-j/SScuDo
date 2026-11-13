import React from "react";
import ReactDOM from "react-dom/client";
// Atkinson Hyperlegible: hecha para distinguir letras parecidas (l, 1, I; rn, m),
// justo lo que hace falta para notar un dominio falso. Archivo: el sello y los títulos.
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource/atkinson-hyperlegible-mono/400.css";
import "@fontsource/atkinson-hyperlegible-mono/700.css";
import "@fontsource-variable/archivo/wdth.css";
import "./styles.css";
import { App } from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Dentro de la app de Android no hace falta: los archivos ya están en el teléfono.
const enAndroid = "SScuDoAndroid" in window;
if (import.meta.env.PROD && !enAndroid && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // El service worker vive en la raíz del sitio para poder atender también /app/.
    navigator.serviceWorker.register(new URL("../sw.js", location.href), { scope: "../" }).catch(() => {
      /* sin service worker la app igual funciona; solo no queda sin conexión */
    });
  });
}
