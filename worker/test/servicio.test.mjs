// Prueba el servicio completo en local con Miniflare (el mismo motor de
// Cloudflare Workers) y una base D1 en memoria. No toca internet.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { Miniflare } from "miniflare";

const { outputFiles } = await build({ entryPoints: ["src/index.ts"], bundle: true, format: "esm", write: false, target: "es2022", alias: { "@cloudflare/puppeteer": "./test/puppeteer-falso.mjs" } });
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

// ── POST /pagina ──────────────────────────────────────────────────────────
const revisar = (cuerpo, origen = "https://s7ex-j.github.io") =>
  mf.dispatchFetch(`${BASE}/pagina`, { method: "POST", headers: { Origin: origen, "CF-Connecting-IP": "10.1.1.1", "content-type": "application/json" }, body: JSON.stringify(cuerpo) });

await caso("/pagina rechaza orígenes que no son la app", async () => {
  assert.equal((await revisar({ url: "https://ejemplo.pe" }, "https://otro.sitio")).status, 403);
});
await caso("/pagina rechaza IPs, redes locales y otros esquemas", async () => {
  for (const url of ["http://127.0.0.1/", "http://192.168.1.1/admin", "http://localhost:8080", "file:///etc/passwd", "https://user:pw@ejemplo.pe", "https://ejemplo.pe:8443/", "javascript:alert(1)"]) {
    assert.equal((await revisar({ url })).status, 400, url);
  }
});

// Las funciones de pagina.ts, con un fetch falso: no se toca internet.
const { outputFiles: [pag] } = await build({ entryPoints: ["src/pagina.ts"], bundle: true, format: "esm", write: false, target: "es2022", alias: { "@cloudflare/puppeteer": "./test/puppeteer-falso.mjs" } });
const { mkdtempSync, writeFileSync } = await import("node:fs");
const { join } = await import("node:path");
const { tmpdir } = await import("node:os");
const ruta = join(mkdtempSync(join(tmpdir(), "sscudo-")), "pagina.mjs");
writeFileSync(ruta, pag.text);
const P = await import(ruta);

const COPIA = `<title>BCP | Banca por Internet</title><img src="https://www.viabcp.com/logo.svg">
<form action="https://recolector-datos.top/x.php"><input type="password" name="clave"><input name="token" placeholder="Clave dinámica"></form>
<a href="https://wa.me/51987654321">WhatsApp</a>`;
const pedidos = [];
const falso = async (url) => {
  pedidos.push(url);
  const html = (cuerpo) => new Response(cuerpo, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
  if (url === "https://bit.ly/ejemplo-ficticio") return new Response(null, { status: 301, headers: { location: "https://acorta.example/paso" } });
  if (url === "https://acorta.example/paso") return html(`<meta http-equiv="refresh" content="0;url=https://bcp-seguridad.online/ingreso">`);
  if (url === "https://bcp-seguridad.online/ingreso") return html(COPIA);
  if (url.startsWith("https://rdap.org/domain/bcp-seguridad.online")) return Response.json({ events: [{ eventAction: "registration", eventDate: new Date(Date.now() - 2 * 86_400_000).toISOString() }] });
  if (url === "https://salta.example/") return new Response(null, { status: 302, headers: { location: "http://10.0.0.5/interno" } });
  if (url.startsWith("https://rdap.org/")) return new Response("", { status: 404 });
  return new Response("", { status: 404 });
};

await caso("/pagina sigue el acortador y el refresco, y revisa el destino", async () => {
  const r = await P.revisarPagina({ url: "https://bit.ly/ejemplo-ficticio", captura: false }, "huella-prueba", "2026-11-13", { DB: db, SAL: "x" }, falso);
  assert.equal(r.status, 200);
  assert.deepEqual(r.datos.cadena, ["https://bit.ly/ejemplo-ficticio", "https://acorta.example/paso", "https://bcp-seguridad.online/ingreso"]);
  assert.equal(r.datos.nivel, "alto");
  assert.equal(r.datos.entidad, "BCP");
  assert.equal(r.datos.datos.diasDominio, 2);
  assert.deepEqual(r.datos.datos.enviaA, ["recolector-datos.top"]);
  assert.deepEqual(r.datos.datos.whatsapp, ["+51987654321"]);
  assert.equal(r.datos.captura, null);
});
await caso("/pagina no sigue una redirección hacia la red local", async () => {
  const r = await P.recorrer(new URL("https://salta.example/"), falso);
  assert.equal(r.final, "https://salta.example/");
  assert.match(r.error, /no se puede revisar/);
  assert.ok(!pedidos.some((u) => u.includes("10.0.0.5")));
});
await caso("/pagina no guarda la dirección, solo cuenta consultas", async () => {
  const filas = (await db.prepare("SELECT * FROM consultas").all()).results;
  assert.deepEqual(Object.keys(filas[0]).sort(), ["dia", "n", "quien"]);
  assert.ok(!JSON.stringify(filas).includes("bcp-seguridad"));
});
await caso("/pagina tiene un límite diario por persona", async () => {
  let ultimo = 200;
  for (let i = 0; i < 45; i++) ultimo = (await P.revisarPagina({ url: "https://bcp-seguridad.online/ingreso", captura: false }, "huella-limite", "2026-11-13", { DB: db, SAL: "x" }, falso)).status;
  assert.equal(ultimo, 429);
});
await caso("/pagina sin navegador explica que no hay vista previa", async () => {
  const r = await P.revisarPagina({ url: "https://bcp-seguridad.online/ingreso" }, "huella-foto", "2026-11-13", { DB: db, SAL: "x" }, falso);
  assert.equal(r.datos.captura, null);
  assert.match(r.datos.capturaNota, /no está activada/);
});

console.log(`\n${n} casos, todos pasan`);
await mf.dispose();
