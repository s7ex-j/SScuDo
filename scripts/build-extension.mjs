// Arma la extensión en dist-extension/: empaqueta el código y copia lo estático.
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";

const out = "dist-extension";
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

await build({
  entryPoints: { background: "extension/src/background.ts", content: "extension/src/content.ts", popup: "extension/src/popup.ts" },
  bundle: true,
  format: "iife",
  target: "chrome116",
  outdir: out,
  minify: false, // legible a propósito: quien instale puede leer lo que hace
  legalComments: "none",
});

cpSync("extension/manifest.json", `${out}/manifest.json`);
cpSync("extension/popup.html", `${out}/popup.html`);
cpSync("extension/popup.css", `${out}/popup.css`);
cpSync("public/iconos", `${out}/iconos`, { recursive: true });
console.log("Extensión lista en", out);
