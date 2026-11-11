// Normalización: deja el texto en minúsculas, sin tildes y sin trucos de
// escritura ("prem1o", "y4pe", caracteres invisibles), y recuerda de qué
// posición del original salió cada carácter para poder marcar el mensaje.

export interface Folded {
  text: string;
  /** map[i] = posición en el original del carácter i. Tiene un centinela al final. */
  map: number[];
}

const INVISIBLE = /[​-‏⁠﻿­]/;

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
};

const isLetter = (c: string | undefined) => !!c && c >= "a" && c <= "z";

export function fold(original: string): Folded {
  let text = "";
  const map: number[] = [];
  for (let i = 0; i < original.length; i++) {
    const ch = original[i];
    const code = ch.charCodeAt(0);
    let out: string;
    if (code < 128) {
      out = ch.toLowerCase();
    } else if (INVISIBLE.test(ch)) {
      continue; // se usan para partir palabras y esquivar filtros
    } else if (code >= 0xd800 && code <= 0xdfff) {
      out = " "; // mitad de un emoji
    } else {
      const base = ch.normalize("NFD")[0].toLowerCase();
      out = base.length === 1 && base.charCodeAt(0) < 128 ? base : /\s/.test(ch) ? " " : "·";
    }
    text += out;
    map.push(i);
  }
  map.push(original.length);

  // "gan4ste" → "ganaste": solo cuando el símbolo está entre dos letras, para
  // no tocar montos, fechas ni códigos.
  const chars = text.split("");
  for (let i = 1; i < chars.length - 1; i++) {
    const sub = LEET[chars[i]];
    if (sub && isLetter(chars[i - 1]) && (isLetter(chars[i + 1]) || LEET[chars[i + 1]] !== undefined)) {
      chars[i] = sub;
    }
  }
  return { text: chars.join(""), map };
}

/** Convierte un tramo del texto normalizado en un tramo del original. */
export function toOriginal(f: Folded, start: number, end: number): [number, number] {
  const s = f.map[Math.min(start, f.map.length - 1)];
  const last = f.map[Math.max(Math.min(end - 1, f.map.length - 2), 0)];
  return [s, Math.max(last + 1, s)];
}

/** Quita los trucos de escritura de una palabra suelta de un dominio. */
export function deleet(word: string): string {
  return word
    .split("")
    .map((c) => LEET[c] ?? c)
    .join("")
    .replace(/rn/g, "m")
    .replace(/vv/g, "w");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}
