// Punto de entrada del motor para la app de Android: se empaqueta en un solo
// archivo (motor.js) y se ejecuta en un WebView sin acceso a la red.
import { analyze } from "./analyze";
import { analyzePage } from "./page";

const api = {
  resumenMensaje(texto: string): string {
    const a = analyze(texto);
    return JSON.stringify({
      nivel: a.level,
      campana: a.campaign?.name ?? null,
      motivos: a.findings.filter((f) => f.weight > 0).slice(0, 3).map((f) => f.title),
    });
  },
  resumenPagina(url: string): string {
    const r = analyzePage({ url });
    return JSON.stringify({
      nivel: r.level,
      titulo: r.headline,
      detalle: r.detail,
      dominio: r.url?.registrable ?? null,
      motivos: r.findings.filter((f) => f.weight > 0).slice(0, 3).map((f) => f.title),
    });
  },
};

(globalThis as unknown as { SScuDo: typeof api }).SScuDo = api;
