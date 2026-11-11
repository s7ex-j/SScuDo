import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Rutas relativas: el mismo build sirve en GitHub Pages (/SScuDo/) o en cualquier carpeta.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { port: 5180 },
  build: { outDir: "dist", target: "es2021" },
  test: { include: ["tests/**/*.test.ts"] },
});
