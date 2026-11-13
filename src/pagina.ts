// Cliente de POST /pagina (worker/src/pagina.ts): revisa una página sin abrirla
// en el dispositivo. Solo se envía la dirección del enlace, nunca el mensaje.
import type { PageData } from "./engine";

const API = (import.meta.env.VITE_SSCUDO_API as string | undefined)?.replace(/\/$/, "") ?? "";
export const vistaPreviaActiva = API !== "";

export interface PaginaRevisada {
  pedida: string;
  final: string;
  cadena: string[];
  estado: number;
  error: string | null;
  nivel: "alto" | "sospechoso" | "sin_senales" | "oficial" | "no_aplica";
  titulo: string;
  detalle: string;
  dominio: string | null;
  entidad: string | null;
  motivos: { titulo: string; detalle: string }[];
  datos: PageData;
  captura: string | null;
  capturaNota: string | null;
}

export type Respuesta = { ok: true; r: PaginaRevisada } | { ok: false; error: string };

export async function revisarPagina(url: string): Promise<Respuesta> {
  if (!vistaPreviaActiva) return { ok: false, error: "La revisión de páginas todavía no está encendida en esta versión." };
  try {
    const r = await fetch(API + "/pagina", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
    const d = (await r.json().catch(() => null)) as (PaginaRevisada & { error?: string }) | null;
    if (r.ok && d) return { ok: true, r: d };
    return { ok: false, error: d?.error ?? "El servicio no pudo revisar esa página." };
  } catch {
    return { ok: false, error: "Sin conexión con el servicio. Revisa tu internet e inténtalo otra vez." };
  }
}
