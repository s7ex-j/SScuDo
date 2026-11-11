// Tipos del motor de análisis. Todo el motor es puro: recibe texto, devuelve
// un informe. No hace peticiones de red ni guarda nada.

export type Level = "alto" | "sospechoso" | "sin_senales";

export type Category =
  | "enlace" // algo raro en la dirección web
  | "suplantacion" // se hace pasar por una marca o entidad
  | "datos" // pide claves, códigos o datos personales
  | "dinero" // pide plata o un pago
  | "amenaza" // asusta: bloqueo, multa, deuda
  | "premio" // promete algo: bono, premio, reembolso
  | "urgencia" // apura para que no pienses
  | "empleo" // oferta de trabajo demasiado buena
  | "contacto" // "cambié de número"
  | "instalacion"; // pide instalar algo o dar acceso remoto

/** Tramo del mensaje original: [inicio, fin). */
export type Span = [number, number];

export interface Finding {
  id: string;
  category: Category;
  /** Peso en el puntaje. Negativo = atenuante (p. ej. enlace a dominio oficial). */
  weight: number;
  title: string;
  detail: string;
  spans: Span[];
}

export interface Brand {
  id: string;
  name: string;
  kind: "billetera" | "banco" | "estado" | "pensiones" | "courier" | "telco" | "plataforma";
  /** Cómo se la menciona en un mensaje (sobre texto sin tildes y en minúsculas). */
  mention: RegExp;
  /** Trozos que la delatan dentro de una dirección web. */
  hostTokens: string[];
  /** Si es true, basta con que el trozo empiece o termine una palabra del dominio. */
  loose?: boolean;
  /** Dominios que reconocemos como oficiales (se aceptan sus subdominios). */
  domains: string[];
}

export interface UrlReport {
  /** Tal como aparece en el mensaje. */
  raw: string;
  span: Span;
  kind: "enlace" | "correo";
  scheme: string | null;
  host: string;
  /** Lo que va antes del dominio real (subdominios). Puede ser "". */
  subdomain: string;
  /** El dominio real: el que alguien registró y controla. */
  registrable: string;
  path: string;
  /** Marca cuyo dominio oficial es este, si lo es. */
  official: Brand | null;
  /** Marca a la que imita sin ser su dominio. */
  impersonates: Brand | null;
  findings: Finding[];
}

export interface CampaignSource {
  title: string;
  url: string;
}

export interface Campaign {
  id: string;
  name: string;
  /** Una línea: qué recibe la víctima. */
  hook: string;
  /** Cómo funciona el engaño, en pasos cortos. */
  how: string[];
  /** Qué hacer si te llega. */
  todo: string[];
  sources: CampaignSource[];
  /** false = no se puede reconocer desde un texto (p. ej. un QR pegado en un local). */
  detectable: boolean;
}

export interface Analysis {
  empty: boolean;
  level: Level;
  /** 0–100. Sirve para ordenar, no es una probabilidad. */
  score: number;
  findings: Finding[];
  urls: UrlReport[];
  brands: Brand[];
  campaign: Campaign | null;
  advice: string[];
  /** Lo que este análisis no revisó. Siempre se muestra. */
  unchecked: string[];
}
