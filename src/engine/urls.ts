import { BRANDS, isOfficialHost, officialBrandOf } from "./brands";
import { deleet, levenshtein } from "./normalize";
import type { Brand, Finding, Span, UrlReport } from "./types";

// Extrae direcciones web y correos del mensaje y revisa cada una SIN abrirla:
// solo se mira cómo está escrita.

const SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "cutt.ly", "rb.gy", "rebrand.ly", "shorturl.at",
  "tiny.cc", "t.ly", "s.id", "lnkd.in", "buff.ly", "acortar.link", "n9.cl", "shre.ink", "urlz.fr", "v.gd",
  "short.gy", "linktr.ee", "surl.li", "goo.su", "clck.ru", "2cm.es", "forms.gle",
]);

// Terminaciones baratas o gratuitas que abundan en campañas de phishing. No
// son malas por sí solas: suman, no deciden.
const RISKY_TLDS = new Set([
  "top", "xyz", "click", "live", "online", "site", "shop", "icu", "cfd", "sbs", "buzz", "vip", "club", "work",
  "link", "info", "life", "world", "today", "fun", "space", "website", "store", "tk", "ml", "ga", "cf", "gq",
  "cyou", "rest", "quest", "monster", "lat", "bond", "pro", "cc", "ws", "su", "ru", "cn", "zip", "mov",
]);

// Alojamiento gratuito: cualquiera publica ahí una página en minutos.
const FREE_HOSTING = [
  "web.app", "firebaseapp.com", "vercel.app", "netlify.app", "github.io", "pages.dev", "workers.dev", "r2.dev",
  "glitch.me", "herokuapp.com", "onrender.com", "replit.app", "repl.co", "blogspot.com", "wixsite.com",
  "weebly.com", "000webhostapp.com", "godaddysites.com", "square.site", "webflow.io", "framer.app",
  "wordpress.com", "sites.google.com", "typeform.com", "jotform.com", "surge.sh", "ngrok.io", "ngrok-free.app",
  "trycloudflare.com", "duckdns.org", "ddns.net", "hopto.org", "zapto.org",
];

const SECOND_LEVEL = new Set([
  "com.pe", "gob.pe", "org.pe", "edu.pe", "net.pe", "mil.pe", "nom.pe", "com.co", "com.mx", "com.ar", "com.br",
  "com.ec", "com.bo", "com.ve", "com.es", "co.uk", "com.au", "co.jp", "com.cn", "gob.mx", "gov.co",
]);

// Para direcciones escritas sin "http": solo se aceptan terminaciones conocidas,
// así "llegué.Avísame" no pasa por dominio.
const KNOWN_TLDS = new Set([
  "com", "pe", "net", "org", "io", "co", "me", "app", "dev", "ly", "gl", "gy", "mx", "ar", "cl", "br", "es", "us",
  "tv", "ai", "biz", "edu", "gob", "gov", "page", "cloud", "tech", "digital", "email", "gle", "be", "to", "at",
  "id", "sh", "fr", "de", "uk", "eu",
  ...RISKY_TLDS,
]);

const BAIT_WORDS = [
  "bono", "premio", "regalo", "sorteo", "ganador", "reembolso", "devolucion", "verific", "valida", "actualiz",
  "segur", "secure", "login", "signin", "acceso", "cliente", "soporte", "ayuda", "desbloque", "bloqueo", "banca",
  "banking", "cuenta", "tarjeta", "retiro", "consulta", "beneficiari", "confirm", "pago", "multa", "oficial",
];

const FREE_MAIL = new Set(["gmail.com", "hotmail.com", "outlook.com", "outlook.es", "yahoo.com", "yahoo.es", "live.com", "icloud.com", "proton.me", "protonmail.com", "gmx.com"]);

const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"'`]+|(?:[a-z0-9¡-￿](?:[a-z0-9¡-￿-]*[a-z0-9¡-￿])?\.)+[a-z]{2,}(?::\d{2,5})?(?:\/[^\s<>"'`]*)?/gi;
const EMAIL_RE = /[a-z0-9._%+-]+@((?:[a-z0-9-]+\.)+[a-z]{2,})/gi;

function finding(id: string, category: Finding["category"], weight: number, title: string, detail: string, span: Span): Finding {
  return { id, category, weight, title, detail, spans: [span] };
}

function splitHost(host: string): { subdomain: string; registrable: string; tld: string; hosting: string | null } {
  const hosting = FREE_HOSTING.find((h) => host === h || host.endsWith("." + h)) ?? null;
  const labels = host.split(".");
  const tld = labels[labels.length - 1] ?? "";
  let suffixLabels = 1;
  if (hosting && host !== hosting) suffixLabels = hosting.split(".").length;
  else if (labels.length >= 3 && SECOND_LEVEL.has(labels.slice(-2).join("."))) suffixLabels = 2;
  const keep = Math.min(labels.length, suffixLabels + 1);
  const registrable = labels.slice(-keep).join(".");
  const subdomain = labels.slice(0, labels.length - keep).join(".");
  return { subdomain, registrable, tld, hosting };
}

function wordsOf(s: string): string[] {
  return s.split(/[^a-z0-9]+/).filter(Boolean);
}

/** ¿El nombre de la marca aparece escrito en esta parte de la dirección? */
function brandIn(part: string, brand: Brand): boolean {
  const words = wordsOf(part);
  return brand.hostTokens.some((t) =>
    words.some((w) => {
      const clean = deleet(w);
      if (w === t || clean === t) return true;
      if (!brand.loose) return false;
      return t.length >= 5 ? clean.includes(t) : clean.startsWith(t) || clean.endsWith(t);
    }),
  );
}

/** ¿Alguna palabra del dominio es casi igual al dominio oficial? ("interbanck", "sunaat") */
function lookalikeOf(host: string, brand: Brand): string | null {
  const targets = new Set<string>();
  for (const d of brand.domains) {
    const first = d.split(".")[0];
    if (first.length >= 5 && first !== "gob") targets.add(first);
  }
  for (const t of brand.hostTokens) if (t.length >= 5) targets.add(t);
  for (const w of wordsOf(host)) {
    for (const t of targets) {
      if (w === t) continue;
      const d = levenshtein(deleet(w), t);
      if (d === 1 || (t.length >= 9 && d === 2)) return w;
    }
  }
  return null;
}

function analyzeHost(raw: string, span: Span, kind: UrlReport["kind"], scheme: string | null, hostRaw: string, path: string, userinfo: boolean, port: string | null): UrlReport {
  const host = hostRaw.toLowerCase().replace(/\.$/, "");
  const { subdomain, registrable, tld, hosting } = splitHost(host);
  const findings: Finding[] = [];
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  const official = isIp ? null : officialBrandOf(host);
  let impersonates: Brand | null = null;

  if (isIp) {
    findings.push(finding("url_ip", "enlace", 32, "El enlace es una dirección numérica", `En vez de un nombre lleva a ${host}. Ninguna empresa ni entidad pública te manda enlaces así.`, span));
  }
  if (userinfo) {
    findings.push(finding("url_arroba", "enlace", 32, "El enlace esconde su destino con una arroba", "Lo que está antes de la @ es de adorno; el navegador va a lo que viene después. Es un truco para que la dirección parezca de otra página.", span));
  }
  if (/(^|\.)xn--/.test(host) || /[^\x00-\x7f]/.test(host)) {
    findings.push(finding("url_letras_raras", "enlace", 28, "El enlace usa letras que imitan a otras", "Hay caracteres de otros alfabetos que se ven casi iguales a los normales. Se usan para copiar el nombre de una página conocida.", span));
  }

  if (!official && !isIp) {
    const everywhere = host + " " + path.toLowerCase();
    for (const b of BRANDS) {
      if (isOfficialHost(host, b)) continue;
      const inHost = brandIn(host, b);
      const fake = inHost ? null : lookalikeOf(host, b);
      if (inHost) {
        impersonates = b;
        findings.push(finding("url_marca_en_dominio", "suplantacion", 42, `Usa el nombre de ${b.name}, pero no es su página`, `El dominio real de este enlace es ${registrable}. ${b.name} no usa ese dominio: quien lo registró puso el nombre para que parezca oficial.`, span));
        break;
      }
      if (fake) {
        impersonates = b;
        findings.push(finding("url_parecido", "suplantacion", 42, `El dominio imita el de ${b.name}`, `"${fake}" está escrito casi igual que el nombre oficial, con una letra cambiada. Es una copia.`, span));
        break;
      }
      if (b.hostTokens.length && brandIn(path.toLowerCase(), b) && everywhere) {
        impersonates = b;
        findings.push(finding("url_marca_en_ruta", "suplantacion", 24, `Menciona a ${b.name} solo en la ruta`, `El nombre aparece después de la barra, pero el dominio real es ${registrable}, que no es de ${b.name}.`, span));
        break;
      }
    }
  }

  if (kind === "enlace") {
    if (SHORTENERS.has(host) || SHORTENERS.has(registrable)) {
      findings.push(finding("url_acortado", "enlace", 12, "Enlace acortado", "Un acortador oculta a qué página lleva. Los bancos y el Estado no los usan para pedirte datos.", span));
    }
    if (hosting && !official) {
      findings.push(finding("url_alojamiento_gratis", "enlace", 15, "Página montada en un servicio gratuito", `${hosting} deja que cualquiera publique una página en minutos y sin identificarse.`, span));
    }
    if (RISKY_TLDS.has(tld) && !official) {
      findings.push(finding("url_terminacion", "enlace", 15, `Termina en .${tld}`, "Es una terminación barata que aparece mucho en páginas de estafa. Por sí sola no prueba nada, pero suma.", span));
    }
    if (!official) {
      const bait = BAIT_WORDS.filter((w) => host.includes(w));
      if (bait.length) {
        findings.push(finding("url_palabras_gancho", "enlace", 10, "El dominio usa palabras gancho", `Lleva "${bait.slice(0, 3).join('", "')}" en el nombre, algo típico de páginas armadas para una campaña.`, span));
      }
      if ((host.match(/-/g) ?? []).length >= 3) {
        findings.push(finding("url_guiones", "enlace", 6, "Dominio con muchos guiones", "Los nombres largos unidos con guiones son habituales en páginas falsas.", span));
      }
      if (subdomain.split(".").filter(Boolean).length >= 3) {
        findings.push(finding("url_subdominios", "enlace", 8, "Demasiados niveles antes del dominio", `Lo que importa es el final: ${registrable}. Lo de adelante puede decir cualquier cosa.`, span));
      }
      if (scheme === "http") {
        findings.push(finding("url_sin_https", "enlace", 5, "Conexión sin cifrar (http)", "Una página que pide datos sin https ya es mala señal.", span));
      }
      if (port && port !== "443" && port !== "80") {
        findings.push(finding("url_puerto", "enlace", 8, "El enlace usa un puerto inusual", "Las páginas normales no necesitan indicar un puerto.", span));
      }
    }
  }

  if (kind === "correo" && !official) {
    if (FREE_MAIL.has(host)) {
      const local = raw.split("@")[0].toLowerCase();
      const b = BRANDS.find((x) => brandIn(local, x));
      if (b) {
        impersonates = b;
        findings.push(finding("correo_gratuito_marca", "suplantacion", 30, `Correo gratuito con el nombre de ${b.name}`, `Una empresa no te escribe desde @${host}. Cualquiera puede crear una cuenta con ese nombre.`, span));
      }
    }
  }

  if (official && findings.length === 0) {
    findings.push(finding("url_oficial", "enlace", -15, `El dominio sí es de ${official.name}`, `${registrable} está en nuestra lista de dominios oficiales. Aun así, entra escribiendo tú la dirección en vez de tocar el enlace.`, span));
  }

  return { raw, span, kind, scheme, host, subdomain, registrable, path, official, impersonates, findings };
}

export function extractUrls(original: string): UrlReport[] {
  const out: UrlReport[] = [];
  const taken: Span[] = [];
  const free = (s: number, e: number) => !taken.some(([a, b]) => s < b && e > a);

  // Los enlaces con "http" van primero: "https://banco.com@otro.top" no es un correo.
  const conEsquema: Span[] = [];
  for (const m of original.matchAll(/https?:\/\/[^\s<>"'`]+/gi)) {
    const s = m.index ?? 0;
    conEsquema.push([s, s + m[0].length]);
  }
  for (const m of original.matchAll(EMAIL_RE)) {
    const s = m.index ?? 0;
    const e = s + m[0].length;
    if (conEsquema.some(([a, b]) => s < b && e > a)) continue;
    taken.push([s, e]);
    out.push(analyzeHost(m[0], [s, e], "correo", null, m[1], "", false, null));
  }

  for (const m of original.matchAll(URL_RE)) {
    let raw = m[0].replace(/[)\].,;:!?¡¿…"'»]+$/u, "");
    const s = m.index ?? 0;
    const e = s + raw.length;
    if (!raw || !free(s, e)) continue;

    let rest = raw;
    let scheme: string | null = null;
    const sm = /^(https?):\/\//i.exec(rest);
    if (sm) {
      scheme = sm[1].toLowerCase();
      rest = rest.slice(sm[0].length);
    }
    const slash = rest.search(/[/?#]/);
    let authority = slash === -1 ? rest : rest.slice(0, slash);
    const path = slash === -1 ? "" : rest.slice(slash);
    let userinfo = false;
    if (authority.includes("@")) {
      userinfo = true;
      authority = authority.slice(authority.lastIndexOf("@") + 1);
    }
    let port: string | null = null;
    const pm = /:(\d{2,5})$/.exec(authority);
    if (pm) {
      port = pm[1];
      authority = authority.slice(0, -pm[0].length);
    }
    const host = authority.toLowerCase();
    if (!host.includes(".")) continue;
    const tld = host.split(".").pop() ?? "";
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    // Sin "http" ni "www": solo cuenta si la terminación es conocida.
    if (!scheme && !/^www\./i.test(raw) && !isIp && !KNOWN_TLDS.has(tld)) continue;
    if (!isIp && /^\d+$/.test(tld)) continue; // "12.50", "3.5"
    if (!scheme && /^\d+(\.\d+)+$/.test(host)) continue;

    taken.push([s, e]);
    out.push(analyzeHost(raw, [s, e], "enlace", scheme, host, path, userinfo, port));
  }
  return out.sort((a, b) => a.span[0] - b.span[0]);
}
