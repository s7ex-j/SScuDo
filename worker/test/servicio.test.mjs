// Prueba el servicio completo en local con Miniflare (el mismo motor de
// Cloudflare Workers) y una base D1 en memoria. No toca internet.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { Miniflare } from "miniflare";

const { outputFiles } = await build({ entryPoints: ["src/index.ts"], bundle: true, format: "esm", write: false, target: "es2022" });
const mf = new Miniflare({
  modules: true,
  script: outputFiles[0].text,
  d1Databases: { DB: "sscudo-prueba" },
  bindings: { ORIGENES: "https://s7ex-j.github.io", UMBRAL: "3", SAL: "sal-de-prueba", ADMIN: "clave-admin" },
});
const db = await mf.getD1Database("DB");
for (const s of readFileSync("schema.sql", "utf8").replace(/--.*$/gm, "").split(";").map((x) => x.trim()).filter(Boolean)) await db.prepare(s).run();

const BASE = "http://sscudo.test";
const reportar = (cuerpo, ip, origen = "https://s7ex-j.github.io") =>
  mf.dispatchFetch(`${BASE}/reportes`, { method: "POST", headers: { Origin: origen, "CF-Connecting-IP": ip, "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
const lista = async () => (await (await mf.dispatchFetch(`${BASE}/lista`)).json()).dominios;

let n = 0;
const caso = async (nombre, fn) => { await fn(); n++; console.log("ok  ", nombre); };

await caso("rechaza orígenes que no son la app", async () => {
  assert.equal((await reportar({ dominios: ["bono-yape.top"], nivel: "alto" }, "1.1.1.1", "https://otro.sitio")).status, 403);
});
await caso("rechaza dominios oficiales y sitios conocidos", async () => {
  const r = await reportar({ dominios: ["viabcp.com", "sunat.gob.pe", "google.com", "www.yape.com.pe"], nivel: "alto" }, "1.1.1.1");
  assert.equal(r.status, 400);
});
await caso("rechaza texto que no es un dominio", async () => {
  const r = await reportar({ dominios: ["<script>", "hola mundo", "999 888 777"], nivel: "alto" }, "1.1.1.1");
  assert.equal(r.status, 400);
});
await caso("un solo reporte no aparece en la lista", async () => {
  assert.equal((await reportar({ dominios: ["bono-yape.top"], campana: "falso-bono", nivel: "alto" }, "10.0.0.1")).status, 201);
  assert.deepEqual(await lista(), []);
});
await caso("la misma persona no suma dos veces", async () => {
  for (let i = 0; i < 5; i++) await reportar({ dominios: ["bono-yape.top"], campana: "falso-bono", nivel: "alto" }, "10.0.0.1");
  await reportar({ dominios: ["bono-yape.top"], campana: "falso-bono", nivel: "alto" }, "10.0.0.2");
  assert.deepEqual(await lista(), []);
});
await caso("con tres personas distintas, aparece", async () => {
  await reportar({ dominios: ["bono-yape.top"], campana: "falso-bono", nivel: "alto" }, "10.0.0.3");
  const l = await lista();
  assert.equal(l.length, 1);
  assert.equal(l[0].d, "bono-yape.top");
  assert.equal(l[0].n, 3);
});
await caso("no guarda la IP ni el mensaje", async () => {
  const filas = (await db.prepare("SELECT * FROM reportes").all()).results;
  const todo = JSON.stringify(filas);
  assert.ok(!todo.includes("10.0.0."));
  assert.deepEqual(Object.keys(filas[0]).sort(), ["campana", "creado", "dia", "dominio", "id", "nivel", "quien"]);
});
await caso("cuenta campañas aunque el mensaje no traiga enlace", async () => {
  await reportar({ dominios: [], campana: "codigo-whatsapp", nivel: "alto" }, "10.0.0.9");
  const c = (await (await mf.dispatchFetch(`${BASE}/campanas`)).json()).campanas;
  assert.deepEqual(c.map((x) => x.id).sort(), ["codigo-whatsapp", "falso-bono"]);
  assert.equal(c.find((x) => x.id === "falso-bono").n, 3);
});
await caso("límite diario por persona", async () => {
  let ultimo = 201;
  for (let i = 0; i < 25; i++) ultimo = (await reportar({ dominios: [`dominio-${i}.top`], nivel: "sospechoso" }, "10.9.9.9")).status;
  assert.equal(ultimo, 429);
});
await caso("moderación: exige clave y retira el dominio", async () => {
  const ocultar = (clave) => mf.dispatchFetch(`${BASE}/admin/ocultar`, { method: "POST", headers: { Authorization: `Bearer ${clave}`, "content-type": "application/json" }, body: JSON.stringify({ dominio: "bono-yape.top", motivo: "prueba" }) });
  assert.equal((await ocultar("mala")).status, 401);
  assert.equal((await ocultar("clave-admin")).status, 200);
  assert.deepEqual(await lista(), []);
});
await caso("leer la lista es público (CORS abierto)", async () => {
  const r = await mf.dispatchFetch(`${BASE}/lista`, { headers: { Origin: "https://cualquiera.com" } });
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
});

console.log(`\n${n} casos, todos pasan`);
await mf.dispose();
