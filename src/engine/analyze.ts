import { BRANDS, isOfficialHost } from "./brands";
import { matchCampaign } from "./campaigns";
import { fold, toOriginal } from "./normalize";
import { SIGNALS } from "./signals";
import type { Analysis, Brand, Finding, Level, Span } from "./types";
import { extractUrls } from "./urls";

// Umbrales del veredicto. Se ajustan contra tests/dataset.ts; cambiarlos sin
// correr `npm run evaluar` rompe la medición.
const ALTO = 55;
const SOSPECHOSO = 22;

// Señales que por sí solas bastan para el nivel alto.
const DECISIVAS = new Set(["codigo_por_error", "url_marca_en_dominio", "url_parecido", "url_ip", "url_arroba", "url_letras_raras", "correo_gratuito_marca"]);

// Sitios muy conocidos que la gente comparte todo el tiempo: un enlace a ellos
// junto al nombre de un banco no es suplantación.
const NEUTRALES = ["youtube.com", "youtu.be", "google.com", "tiktok.com", "x.com", "twitter.com", "linkedin.com", "wikipedia.org", "apple.com", "microsoft.com", "zoom.us", "spotify.com", "github.com"];
const esNeutral = (host: string) => NEUTRALES.some((d) => host === d || host.endsWith("." + d));

const UNCHECKED = [
  "No abrí el enlace: solo revisé cómo está escrito.",
  "No comprobé quién registró el dominio ni desde cuándo existe.",
  "No verifiqué el número ni el correo que te escribió.",
  "No vi imágenes, audios ni archivos adjuntos.",
];

const GENERAL_ADVICE = [
  "No toques el enlace ni respondas.",
  "No des claves, códigos por SMS ni datos de tarjeta.",
  "Comprueba por tu cuenta: abre la app oficial o llama al número de tu tarjeta.",
];

function emptyAnalysis(): Analysis {
  return { empty: true, level: "sin_senales", score: 0, findings: [], urls: [], brands: [], campaign: null, advice: [], unchecked: UNCHECKED };
}

export function analyze(message: string): Analysis {
  if (!message || !message.trim()) return emptyAnalysis();
  const original = message.slice(0, 6000);
  const f = fold(original);
  const findings: Finding[] = [];

  // 1. Señales de texto
  for (const sig of SIGNALS) {
    const spans: Span[] = [];
    for (const re of sig.patterns) {
      re.lastIndex = 0;
      for (const m of f.text.matchAll(re)) {
        if (m[0].length === 0) continue;
        const start = m.index ?? 0;
        spans.push(toOriginal(f, start, start + m[0].length));
      }
    }
    if (spans.length) {
      findings.push({ id: sig.id, category: sig.category, weight: sig.weight, title: sig.title, detail: sig.detail, spans });
    }
  }

  // 2. Enlaces y correos
  const urls = extractUrls(original);
  for (const u of urls) findings.push(...u.findings);

  // 3. Marcas mencionadas (en el texto o imitadas en un enlace)
  const brands: Brand[] = [];
  const brandSpans = new Map<string, Span[]>();
  for (const b of BRANDS) {
    b.mention.lastIndex = 0;
    const spans: Span[] = [];
    for (const m of f.text.matchAll(b.mention)) {
      const start = m.index ?? 0;
      const span = toOriginal(f, start, start + m[0].length);
      // Una marca escrita dentro del propio enlace no cuenta como mención.
      if (urls.some((u) => span[0] >= u.span[0] && span[1] <= u.span[1])) continue;
      spans.push(span);
    }
    if (spans.length) {
      brands.push(b);
      brandSpans.set(b.id, spans);
    }
  }
  for (const u of urls) {
    for (const b of [u.impersonates, u.official]) if (b && !brands.includes(b)) brands.push(b);
  }

  // 4. Dice ser de una marca, pero el enlace va a otro lado
  const links = urls.filter((u) => u.kind === "enlace");
  const mentioned = brands.filter((b) => brandSpans.has(b.id));
  for (const u of links) {
    if (u.official || u.impersonates || esNeutral(u.host)) continue;
    const b = mentioned.find((x) => !isOfficialHost(u.host, x) && x.kind !== "plataforma");
    if (!b) continue;
    findings.push({
      id: "marca_enlace_ajeno",
      category: "suplantacion",
      weight: 36,
      title: `Habla en nombre de ${b.name}, pero el enlace no es suyo`,
      detail: `El enlace lleva a ${u.registrable}, que no está entre los dominios que reconocemos de ${b.name}.`,
      spans: [u.span, ...(brandSpans.get(b.id) ?? []).slice(0, 1)],
    });
    break;
  }

  // 5. Puntaje
  const ids = new Set(findings.map((x) => x.id));
  const unique = new Map<string, Finding>();
  for (const x of findings) {
    const prev = unique.get(x.id);
    if (prev) prev.spans.push(...x.spans);
    else unique.set(x.id, { ...x, spans: [...x.spans] });
  }
  const list = [...unique.values()];
  let score = list.reduce((sum, x) => sum + x.weight, 0);

  const cats = new Set(list.filter((x) => x.weight > 0).map((x) => x.category));
  const riskyLink = links.some((u) => !u.official);
  // Combinaciones: lo que delata a una estafa es la mezcla, no una palabra.
  if (riskyLink && (cats.has("premio") || cats.has("amenaza"))) score += 15;
  if (riskyLink && cats.has("datos")) score += 15;
  if (cats.has("urgencia") && cats.has("amenaza")) score += 8;
  if (ids.has("numero_nuevo") && (ids.has("pide_plata") || ids.has("pago_previo"))) score += 25;
  if (cats.has("empleo") && (ids.has("numero_extranjero") || ids.has("llamar_numero") || riskyLink)) score += 10;
  if (cats.has("premio") && cats.has("dinero")) score += 12;
  if (ids.has("llamar_numero") && cats.has("amenaza")) score += 8;
  score = Math.max(0, Math.min(100, Math.round(score)));

  let level: Level = score >= ALTO ? "alto" : score >= SOSPECHOSO ? "sospechoso" : "sin_senales";
  if (list.some((x) => DECISIVAS.has(x.id))) {
    level = "alto";
    score = Math.max(score, ALTO);
  }

  list.sort((a, b) => b.weight - a.weight);

  // 6. Campaña conocida y qué hacer
  const campaign = level === "sin_senales" ? null : matchCampaign(list, brands, f.text, links.length > 0);
  const advice = level === "sin_senales" ? [] : campaign ? campaign.todo : GENERAL_ADVICE;

  return { empty: false, level, score, findings: list, urls, brands, campaign, advice, unchecked: UNCHECKED };
}
