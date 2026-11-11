import type { Brand } from "./types";

// Marcas y entidades que las estafas del Perú suplantan con más frecuencia,
// con los dominios que reconocemos como suyos.
//
// IMPORTANTE: un dominio mal puesto aquí hace que un enlace legítimo se marque
// como imitación. Antes de agregar o cambiar uno, compruébalo en la web o la
// app oficial de la entidad. Ver docs/AGREGAR_MARCA.md.
export const BRANDS: Brand[] = [
  // Billeteras
  { id: "yape", name: "Yape", kind: "billetera", mention: /\byape\b/g, hostTokens: ["yape"], loose: true, domains: ["yape.com.pe"] },
  { id: "plin", name: "Plin", kind: "billetera", mention: /\bplin\b/g, hostTokens: ["plin"], domains: ["plin.pe"] },

  // Bancos y financieras
  { id: "bcp", name: "BCP", kind: "banco", mention: /\bbcp\b|\bbanco de credito\b|\bvia ?bcp\b/g, hostTokens: ["viabcp", "bcp"], loose: true, domains: ["viabcp.com"] },
  { id: "interbank", name: "Interbank", kind: "banco", mention: /\binterbank\b/g, hostTokens: ["interbank"], loose: true, domains: ["interbank.pe", "interbank.com.pe"] },
  { id: "bbva", name: "BBVA", kind: "banco", mention: /\bbbva\b/g, hostTokens: ["bbva"], loose: true, domains: ["bbva.pe", "bbva.com"] },
  { id: "scotiabank", name: "Scotiabank", kind: "banco", mention: /\bscotiabank\b/g, hostTokens: ["scotiabank"], loose: true, domains: ["scotiabank.com.pe"] },
  { id: "bn", name: "Banco de la Nación", kind: "banco", mention: /\bbanco de la nacion\b/g, hostTokens: ["bancodelanacion", "banconacion"], loose: true, domains: ["bn.com.pe"] },
  { id: "banbif", name: "BanBif", kind: "banco", mention: /\bbanbif\b/g, hostTokens: ["banbif"], loose: true, domains: ["banbif.com.pe"] },
  { id: "pichincha", name: "Banco Pichincha", kind: "banco", mention: /\bbanco pichincha\b/g, hostTokens: ["pichincha"], loose: true, domains: ["pichincha.pe"] },
  { id: "mibanco", name: "Mibanco", kind: "banco", mention: /\bmibanco\b/g, hostTokens: ["mibanco"], loose: true, domains: ["mibanco.com.pe"] },
  { id: "falabella", name: "Falabella", kind: "banco", mention: /\bfalabella\b/g, hostTokens: ["falabella"], loose: true, domains: ["falabella.com.pe", "bancofalabella.pe"] },
  { id: "ripley", name: "Ripley", kind: "banco", mention: /\bripley\b/g, hostTokens: ["ripley"], loose: true, domains: ["ripley.com.pe", "bancoripley.com.pe"] },

  // Estado: cualquier subdominio de gob.pe cuenta como oficial
  { id: "sunat", name: "SUNAT", kind: "estado", mention: /\bsunat\b/g, hostTokens: ["sunat"], loose: true, domains: ["gob.pe"] },
  { id: "reniec", name: "RENIEC", kind: "estado", mention: /\breniec\b/g, hostTokens: ["reniec"], loose: true, domains: ["gob.pe"] },
  { id: "essalud", name: "EsSalud", kind: "estado", mention: /\bessalud\b/g, hostTokens: ["essalud"], loose: true, domains: ["gob.pe"] },
  { id: "onp", name: "ONP", kind: "estado", mention: /\bonp\b/g, hostTokens: ["onp"], domains: ["gob.pe"] },
  { id: "sat", name: "SAT", kind: "estado", mention: /\bsat (de )?lima\b|\bpapeleta\b/g, hostTokens: [], domains: ["gob.pe"] },
  {
    id: "estado",
    name: "el Estado peruano",
    kind: "estado",
    mention: /\b(gobierno|midis|mef|ministerio|bono (familiar|universal|independiente|del estado|estatal)|pension 65|programa juntos)\b/g,
    hostTokens: ["gobpe", "gobierno"],
    loose: true,
    domains: ["gob.pe"],
  },

  // Pensiones y CTS
  {
    id: "afp",
    name: "tu AFP",
    kind: "pensiones",
    mention: /\bafp\b|\bretiro de (afp|fondos|la cts|cts)\b|\b(retiro|liberacion) de (tu |su )?cts\b/g,
    hostTokens: ["afp"],
    loose: true,
    domains: ["afpintegra.pe", "prima.com.pe", "afphabitat.com.pe", "profuturo.com.pe", "gob.pe"],
  },

  // Envíos
  { id: "serpost", name: "Serpost", kind: "courier", mention: /\bserpost\b/g, hostTokens: ["serpost"], loose: true, domains: ["serpost.com.pe"] },
  { id: "olva", name: "Olva Courier", kind: "courier", mention: /\bolva\b/g, hostTokens: ["olva", "olvacourier"], loose: true, domains: ["olvacourier.com"] },
  { id: "dhl", name: "DHL", kind: "courier", mention: /\bdhl\b/g, hostTokens: ["dhl"], domains: ["dhl.com"] },

  // Telefonía
  { id: "claro", name: "Claro", kind: "telco", mention: /(^|\n)\s*claro\s*:|\bclaro (peru|te informa|te regala)\b/g, hostTokens: ["claroperu", "miclaro"], loose: true, domains: ["claro.com.pe"] },
  { id: "movistar", name: "Movistar", kind: "telco", mention: /\bmovistar\b/g, hostTokens: ["movistar"], loose: true, domains: ["movistar.com.pe"] },
  { id: "entel", name: "Entel", kind: "telco", mention: /\bentel\b/g, hostTokens: ["entel"], domains: ["entel.pe"] },
  { id: "bitel", name: "Bitel", kind: "telco", mention: /\bbitel\b/g, hostTokens: ["bitel"], domains: ["bitel.com.pe"] },

  // Plataformas
  { id: "mercadolibre", name: "Mercado Libre", kind: "plataforma", mention: /\bmercado ?libre\b|\bmercado ?pago\b/g, hostTokens: ["mercadolibre", "mercadopago"], loose: true, domains: ["mercadolibre.com.pe", "mercadolibre.com", "mercadopago.com.pe"] },
  { id: "whatsapp", name: "WhatsApp", kind: "plataforma", mention: /\bwhatsapp\b/g, hostTokens: ["whatsapp"], loose: true, domains: ["whatsapp.com", "wa.me"] },
  { id: "netflix", name: "Netflix", kind: "plataforma", mention: /\bnetflix\b/g, hostTokens: ["netflix"], loose: true, domains: ["netflix.com"] },
  { id: "facebook", name: "Facebook", kind: "plataforma", mention: /\bfacebook\b|\bmeta business\b/g, hostTokens: ["facebook"], loose: true, domains: ["facebook.com", "fb.com", "fb.me", "meta.com"] },
  { id: "instagram", name: "Instagram", kind: "plataforma", mention: /\binstagram\b/g, hostTokens: ["instagram"], loose: true, domains: ["instagram.com"] },
  { id: "paypal", name: "PayPal", kind: "plataforma", mention: /\bpaypal\b/g, hostTokens: ["paypal"], loose: true, domains: ["paypal.com"] },
];

export function isOfficialHost(host: string, brand: Brand): boolean {
  return brand.domains.some((d) => host === d || host.endsWith("." + d));
}

export function officialBrandOf(host: string): Brand | null {
  // gob.pe es de todos los organismos: se devuelve el genérico salvo que el
  // nombre del organismo esté en el propio dominio.
  const hits = BRANDS.filter((b) => isOfficialHost(host, b));
  if (hits.length === 0) return null;
  const named = hits.find((b) => b.hostTokens.some((t) => host.includes(t)));
  return named ?? hits.find((b) => b.id === "estado") ?? hits[0];
}
