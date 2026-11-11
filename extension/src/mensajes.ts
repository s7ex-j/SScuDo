import type { PageInput, PageReport } from "../../src/engine";

export type Mensaje = { tipo: "pagina"; datos: PageInput } | { tipo: "estado" };
export type Respuesta = { informe: PageReport | null };
