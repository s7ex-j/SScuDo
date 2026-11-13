import { BRANDS, isOfficialHost } from "./brands";
import { fold } from "./normalize";
import type { Brand, Finding, Level, UrlReport } from "./types";
import { extractUrls } from "./urls";

// Análisis de una página abierta en el navegador (lo usa la extensión).
// Igual que el resto del motor: no hace peticiones, solo mira la dirección y
// tres datos de la página (título, si pide clave, si pide tarjeta).

export type PageLevel = Level | "oficial" | "no_aplica";

export interface PageInput {
  url: string;
  title?: string;
  hasPassword?: boolean;
  hasCard?: boolean;
}

export interface PageReport {
  level: PageLevel;
  url: UrlReport | null;
  brand: Brand | null;
  findings: Finding[];
  headline: string;
  detail: string;
}

const DECISIVAS = new Set(["url_marca_en_dominio", "url_parecido", "url_arroba", "url_letras_raras"]);
const SENSIBLES = new Set<Brand["kind"]>(["banco", "billetera", "estado", "pensiones"]);

function esPrivado(host: string): boolean {
  return host === "localhost" || host.endsWith(".local") || host.endsWith(".localhost") || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
}

const nada = (level: PageLevel, headline: string, detail: string): PageReport => ({ level, url: null, brand: null, findings: [], headline, detail });

export function analyzePage(input: PageInput): PageReport {
  if (!/^https?:\/\//i.test(input.url)) return nada("no_aplica", "Aquí no hay nada que revisar", "SScuDo solo revisa páginas web.");
  const u = extractUrls(input.url.split(/[?#]/)[0])[0];
  if (!u) return nada("no_aplica", "Aquí no hay nada que revisar", "No pude leer esta dirección.");
  if (esPrivado(u.host)) return nada("no_aplica", "Página local", "Es una dirección de tu propia red o equipo.");

  if (u.official) {
    return {
      level: "oficial",
      url: u,
      brand: u.official,
      findings: u.findings,
      headline: `Dominio oficial de ${u.official.name}`,
      detail: `${u.registrable} está en la lista de dominios oficiales de SScuDo.`,
    };
  }

  // En una página ya abierta, que la ruta nombre a una marca es normal (noticias,
  // tiendas), y el acortador ya se resolvió: esas dos señales no cuentan aquí.
  const findings = u.findings.filter((f) => f.id !== "url_acortado" && f.id !== "url_marca_en_ruta");
  let brand = findings.some((f) => f.id === "url_marca_en_dominio" || f.id === "url_parecido") ? u.impersonates : null;

  // La página pide una clave o una tarjeta y se presenta con el nombre de un
  // banco, billetera o entidad pública, pero no está en su dominio.
  if ((input.hasPassword || input.hasCard) && input.title) {
    const titulo = fold(input.title).text;
    const b = BRANDS.find((x) => {
      if (!SENSIBLES.has(x.kind) || isOfficialHost(u.host, x)) return false;
      x.mention.lastIndex = 0;
      return x.mention.test(titulo);
    });
    if (b) {
      brand = brand ?? b;
      findings.push({
        id: "pagina_pide_clave_marca",
        category: "suplantacion",
        weight: 40,
        title: `Pide ${input.hasCard ? "datos de tarjeta" : "una clave"} a nombre de ${b.name}, fuera de su dominio`,
        detail: `El título de la página menciona a ${b.name}, pero estás en ${u.registrable}, que no está entre sus dominios oficiales.`,
        spans: [],
      });
    }
  }

  return pageVerdict(u, brand, findings);
}

/** Puntaje y titular a partir de los hallazgos de una página que no es oficial. */
export function pageVerdict(u: UrlReport, brand: Brand | null, findings: Finding[]): PageReport {
  const score = findings.reduce((s, f) => s + Math.max(0, f.weight), 0);
  const decisiva = findings.some((f) => DECISIVAS.has(f.id));
  const level: Level = decisiva || score >= 55 ? "alto" : score >= 22 ? "sospechoso" : "sin_senales";
  findings.sort((a, b) => b.weight - a.weight);

  if (level === "alto") {
    return {
      level,
      url: u,
      brand,
      findings,
      headline: brand ? `Esta página imita a ${brand.name}` : "Esta página tiene marcas claras de estafa",
      detail: `El dominio real es ${u.registrable}. No escribas claves, códigos ni datos de tarjeta aquí.`,
    };
  }
  if (level === "sospechoso") {
    return { level, url: u, brand, findings, headline: "Página sospechosa", detail: `El dominio real es ${u.registrable}. Comprueba que sea el sitio que buscabas antes de escribir datos.` };
  }
  return { level, url: u, brand: null, findings, headline: "No encontré señales", detail: `El dominio real es ${u.registrable}. No lo conozco: eso no lo vuelve seguro ni peligroso.` };
}
