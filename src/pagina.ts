// Cliente de POST /pagina (worker/src/pagina.ts): revisa una página sin abrirla
// en el dispositivo. Solo se envía la dirección del enlace, nunca el mensaje.
import { analyzeHtml } from "./engine";
import type { PageData, Punto } from "./engine";

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
  puntos: Punto[];
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

/** Lo que deja la app de Android tras abrir la página en su navegador aislado. */
export interface RevisionLocal {
  pedida: string;
  final: string;
  cadena: string[];
  html: string;
  texto: string;
  captura: string | null;
  creado: string | null;
  safeBrowsing: { amenaza: string | null } | null;
}

/** Analiza en el dispositivo una página que Android ya cargó. No usa red. */
export function analizarLocal(l: RevisionLocal): PaginaRevisada {
  const r = analyzeHtml({ url: l.final, html: l.html, texto: l.texto, cadena: l.cadena, creado: l.creado, safeBrowsing: l.safeBrowsing ?? undefined });
  return {
    pedida: l.pedida,
    final: l.final,
    cadena: l.cadena,
    estado: 200,
    error: l.html || l.safeBrowsing?.amenaza ? null : "La página no terminó de cargar: revisé lo que alcancé a ver.",
    nivel: r.level,
    titulo: r.headline,
    detalle: r.detail,
    dominio: r.registrable,
    entidad: r.brand?.name ?? null,
    motivos: r.findings.filter((f) => f.weight > 0).map((f) => ({ titulo: f.title, detalle: f.detail })),
    datos: r.datos,
    puntos: r.puntos,
    captura: l.captura,
    capturaNota: l.captura ? null : "No se pudo tomar la captura.",
  };
}
