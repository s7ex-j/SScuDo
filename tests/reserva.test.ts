import { describe, expect, it } from "vitest";
import { analyze } from "../src/engine";
import { RESERVA_ESTAFAS, RESERVA_LEGITIMOS } from "./reserva";

// No falla por los casos que se le escapan: los cuenta y los imprime.
describe("conjunto de reserva", () => {
  it("mide sin exigir", () => {
    const e = RESERVA_ESTAFAS.map((t) => ({ t, a: analyze(t) }));
    const l = RESERVA_LEGITIMOS.map((t) => ({ t, a: analyze(t) }));
    const alto = e.filter((x) => x.a.level === "alto").length;
    const sosp = e.filter((x) => x.a.level === "sospechoso").length;
    const fp = l.filter((x) => x.a.level !== "sin_senales");
    console.log(`\nRESERVA estafas (${e.length}): alto ${alto}, sospechoso ${sosp}, sin señales ${e.length - alto - sosp}`);
    for (const x of e.filter((x) => x.a.level === "sin_senales")) console.log(`  se escapó [${x.a.score}]: ${x.t.slice(0, 90)}`);
    console.log(`RESERVA legítimos (${l.length}): marcados por error ${fp.length}`);
    for (const x of fp) console.log(`  falso positivo [${x.a.level} ${x.a.score}] ${x.a.findings.map((f) => f.id).join(",")}: ${x.t.slice(0, 80)}`);
    expect(e.length + l.length).toBe(40);
  });
});
