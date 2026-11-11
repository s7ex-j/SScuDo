// Copia la web ya compilada (dist/) y el motor empaquetado a los recursos de
// la app de Android. Correr después de `npm run build`.
import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";

const destino = "android/app/src/main/assets";
if (!existsSync("dist/app/index.html")) throw new Error("Falta dist/: corre primero `npm run build`.");
rmSync(destino, { recursive: true, force: true });
mkdirSync(`${destino}/web`, { recursive: true });
cpSync("dist/app", `${destino}/web/app`, { recursive: true });
cpSync("dist/assets", `${destino}/web/assets`, { recursive: true });
cpSync("dist/iconos", `${destino}/web/iconos`, { recursive: true });
cpSync("dist/manifest.webmanifest", `${destino}/web/manifest.webmanifest`);

await build({ entryPoints: ["src/engine/embebido.ts"], bundle: true, format: "iife", target: "es2019", outfile: `${destino}/motor.js`, legalComments: "none" });
console.log("Recursos de Android listos en", destino);
