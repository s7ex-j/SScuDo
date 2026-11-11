import { describe, expect, it } from "vitest";
import { analyze } from "../src/engine";
import { ESTAFAS, LEGITIMOS } from "./dataset";

const ORDEN = { sin_senales: 0, sospechoso: 1, alto: 2 } as const;

describe("mensajes de estafa", () => {
  for (const c of ESTAFAS) {
    it(`${c.id} → al menos "${c.esperado}"`, () => {
      const a = analyze(c.texto);
      expect(ORDEN[a.level], `nivel ${a.level}, puntaje ${a.score}: ${a.findings.map((f) => f.id).join(", ")}`).toBeGreaterThanOrEqual(ORDEN[c.esperado]);
      if (c.campana) expect(a.campaign?.id).toBe(c.campana);
    });
  }
});

describe("mensajes legítimos", () => {
  for (const c of LEGITIMOS) {
    it(`${c.id} → sin señales`, () => {
      const a = analyze(c.texto);
      expect(a.level, `puntaje ${a.score}: ${a.findings.map((f) => f.id).join(", ")}`).toBe("sin_senales");
    });
  }
});

describe("resumen", () => {
  it("imprime la medición", () => {
    const e = ESTAFAS.filter((c) => c.esperado !== "sin_senales").map((c) => analyze(c.texto).level);
    const l = LEGITIMOS.map((c) => analyze(c.texto).level);
    const alto = e.filter((x) => x === "alto").length;
    const sosp = e.filter((x) => x === "sospechoso").length;
    const fp = l.filter((x) => x !== "sin_senales").length;
    console.log(`\nESTAFAS (${e.length}): alto ${alto}, sospechoso ${sosp}, sin señales ${e.length - alto - sosp}`);
    console.log(`LEGÍTIMOS (${l.length}): marcados por error ${fp}\n`);
    expect(true).toBe(true);
  });
});
