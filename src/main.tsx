import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans-condensed/600.css";
import "@fontsource/ibm-plex-sans-condensed/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
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
