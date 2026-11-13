import type { PageInput, PageReport } from "../../src/engine";

/** Del contenido al fondo: datos mínimos de cada página, para la marca del icono. */
export type Mensaje = { tipo: "pagina"; datos: PageInput } | { tipo: "estado" };
export type Respuesta = { informe: PageReport | null };

/** De la ventanita al contenido: "dame la página completa" (solo al abrir la ventanita). */
export type PedidoLectura = { tipo: "leer" };
export type Lectura = { url: string; html: string; texto: string };
