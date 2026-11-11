// Cliente del servicio de reportes (worker/). Si VITE_SSCUDO_API no está
// definido, todo esto queda apagado y la app funciona igual, solo en local.
//
// Privacidad: se descarga la lista completa y se compara en el dispositivo.
// El servicio nunca recibe qué dominio estás mirando, y al reportar no se
// envía el mensaje: solo el dominio del enlace y el tipo de estafa.

const API = (import.meta.env.VITE_SSCUDO_API as string | undefined)?.replace(/\/$/, "") ?? "";
export const reportesActivos = API !== "";

export interface Reportado {
  d: string;
  n: number;
  desde: number;
}
export interface Comunidad {
  dominios: Map<string, Reportado>;
  campanas: Map<string, number>;
}

const CLAVE = "sscudo.comunidad.v1";
const UNA_HORA = 3_600_000;

async function pedir<T>(ruta: string): Promise<T | null> {
  try {
    const r = await fetch(API + ruta);
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function cargarComunidad(): Promise<Comunidad> {
  const vacia: Comunidad = { dominios: new Map(), campanas: new Map() };
  if (!reportesActivos) return vacia;
  type Guardado = { t: number; dominios: Reportado[]; campanas: { id: string; n: number }[] };
  let g: Guardado | null = null;
  try {
    g = JSON.parse(localStorage.getItem(CLAVE) ?? "null");
  } catch {
    g = null;
  }
  if (!g || Date.now() - g.t > UNA_HORA) {
    const [l, c] = await Promise.all([pedir<{ dominios: Reportado[] }>("/lista"), pedir<{ campanas: { id: string; n: number }[] }>("/campanas")]);
    if (l && c) {
      g = { t: Date.now(), dominios: l.dominios, campanas: c.campanas };
      try {
        localStorage.setItem(CLAVE, JSON.stringify(g));
      } catch {
        /* almacenamiento lleno o bloqueado: se sigue sin caché */
      }
    }
  }
  if (!g) return vacia;
  return { dominios: new Map(g.dominios.map((x) => [x.d, x])), campanas: new Map(g.campanas.map((x) => [x.id, x.n])) };
}

export async function enviarReporte(dominios: string[], campana: string | null, nivel: "alto" | "sospechoso"): Promise<"ok" | "limite" | "error"> {
  if (!reportesActivos) return "error";
  try {
    const r = await fetch(API + "/reportes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dominios, campana: campana ?? "", nivel }) });
    return r.status === 201 ? "ok" : r.status === 429 ? "limite" : "error";
  } catch {
    return "error";
  }
}
