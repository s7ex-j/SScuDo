import { describe, expect, it } from "vitest";
import { analyze } from "../src/engine";
import { fold, toOriginal } from "../src/engine/normalize";
import { extractUrls } from "../src/engine/urls";

describe("normalización", () => {
  it("quita tildes y trucos de escritura sin perder posiciones", () => {
    const original = "¡G4naste el prem1o! Códi​go";
    const f = fold(original);
    expect(f.text).toContain("ganaste el premio");
    expect(f.text).toContain("codigo");
    const i = f.text.indexOf("codigo");
    const [s, e] = toOriginal(f, i, i + 6);
    expect(original.slice(s, e)).toBe("Códi​go");
  });
  it("no toca montos ni fechas", () => {
    expect(fold("S/ 350 el 10/11 a las 18:42").text).toBe("s/ 350 el 10/11 a las 18:42");
  });
});

describe("enlaces", () => {
  it("separa el dominio real de los subdominios", () => {
    const [u] = extractUrls("entra a https://yape.com.pe.desbloqueo-cuenta.online/x");
    expect(u.registrable).toBe("desbloqueo-cuenta.online");
    expect(u.subdomain).toBe("yape.com.pe");
    expect(u.impersonates?.id).toBe("yape");
  });
  it("reconoce dominios oficiales y sus subdominios", () => {
    const [a] = extractUrls("https://www.viabcp.com/canales");
    expect(a.official?.id).toBe("bcp");
    const [b] = extractUrls("www.sunat.gob.pe");
    expect(b.official?.id).toBe("sunat");
    expect(b.registrable).toBe("sunat.gob.pe");
  });
  it("detecta dominios casi iguales al oficial", () => {
    const [u] = extractUrls("https://interbanck.pe/login");
    expect(u.findings.map((f) => f.id)).toContain("url_parecido");
  });
  it("no confunde decimales ni frases con dominios", () => {
    expect(extractUrls("saqué 17.5 y llegué.Avísame, pagué S/ 12.50")).toHaveLength(0);
  });
  it("trata el alojamiento gratuito como dominio de un tercero", () => {
    const [u] = extractUrls("yape-bonos.web.app");
    expect(u.registrable).toBe("yape-bonos.web.app");
    expect(u.findings.map((f) => f.id)).toContain("url_alojamiento_gratis");
  });
  it("marca la arroba que esconde el destino", () => {
    const [u] = extractUrls("https://www.viabcp.com@acceso-seguro.top/login");
    expect(u.host).toBe("acceso-seguro.top");
    expect(u.findings.map((f) => f.id)).toContain("url_arroba");
  });
});

describe("informe", () => {
  it("un texto vacío no genera veredicto", () => {
    expect(analyze("   ").empty).toBe(true);
  });
  it("los tramos marcados caen dentro del mensaje", () => {
    const texto = "BCP: Tu cuenta ha sido bloqueada. Verifica tus datos en https://viabcp-seguridad.com/login";
    const a = analyze(texto);
    for (const f of a.findings) for (const [s, e] of f.spans) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(e).toBeLessThanOrEqual(texto.length);
      expect(e).toBeGreaterThan(s);
    }
  });
  it("siempre dice lo que no revisó", () => {
    expect(analyze("hola").unchecked.length).toBeGreaterThan(0);
  });
});
