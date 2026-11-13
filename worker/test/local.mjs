// Levanta el servicio en http://localhost:8787 con una base en memoria, para
// probar la app contra él: `node test/local.mjs` (desde worker/).
// Con SEMBRAR=1 carga reportes de ejemplo.
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { Miniflare } from "miniflare";

const { outputFiles } = await build({ entryPoints: ["src/index.ts"], bundle: true, format: "esm", write: false, target: "es2022", alias: { "@cloudflare/puppeteer": "./test/puppeteer-falso.mjs" } });
const mf = new Miniflare({
  modules: true,
  script: outputFiles[0].text,
  port: 8787,
  d1Databases: { DB: "sscudo-local" },
  bindings: { ORIGENES: "http://localhost:5180,http://localhost:4173", UMBRAL: "3", SAL: "local", ADMIN: "local" },
});
const db = await mf.getD1Database("DB");
for (const s of readFileSync("schema.sql", "utf8").replace(/--.*$/gm, "").split(";").map((x) => x.trim()).filter(Boolean)) await db.prepare(s).run();

if (process.env.SEMBRAR) {
  const rep = (cuerpo, ip) => mf.dispatchFetch("http://x/reportes", { method: "POST", headers: { Origin: "http://localhost:5180", "CF-Connecting-IP": ip, "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
  for (let i = 1; i <= 7; i++) await rep({ dominios: ["bono-yape-2026.top"], campana: "falso-bono", nivel: "alto" }, `10.0.0.${i}`);
  for (let i = 1; i <= 4; i++) await rep({ dominios: [], campana: "codigo-whatsapp", nivel: "alto" }, `10.0.1.${i}`);
}
await mf.ready;
console.log("Servicio de reportes en http://localhost:8787");
