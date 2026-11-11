# CLAUDE.md — SScuDo

Revisor de mensajes y páginas de estafa para el Perú. Repo público de Jharol (`s7ex-j`).
Lee esto y `docs/HOJA_DE_RUTA.md`; con eso basta para continuar sin la conversación anterior.

## Qué hacer al empezar

1. `docs/HOJA_DE_RUTA.md` → toma el primer paso marcado `C` que no esté hecho.
2. `npm ci && npm test` (deben pasar todas antes de tocar nada).
3. Al terminar un paso: actualiza la hoja de ruta (estado y fecha) en el mismo commit.

## Mapa

| Necesito… | Archivo |
|---|---|
| Cómo encaja todo | `docs/ARQUITECTURA.md` |
| Qué sigue | `docs/HOJA_DE_RUTA.md` |
| Reglas de detección | `src/engine/signals.ts`, `campaigns.ts`, `analyze.ts` |
| Entidades y dominios oficiales | `src/engine/brands.ts` + `docs/DOMINIOS.md` |
| Análisis de enlaces | `src/engine/urls.ts` |
| Análisis de páginas (extensión, Android) | `src/engine/page.ts` |
| Interfaz de la app | `src/App.tsx`, `src/styles.css` |
| Página de presentación | `index.html`, `src/landing/` |
| Extensión | `extension/` |
| Android | `android/`, `docs/ANDROID.md` |
| Reportes | `worker/`, `src/reportes.ts`, `docs/REPORTES.md` |
| Agregar una estafa conocida | `docs/AGREGAR_CAMPANA.md` |

## Comandos

```bash
npm test                 # todo el motor (vitest)
npm run evaluar          # tabla de aciertos sobre el conjunto de afinado
npm run dev              # web en local
npm run build            # tipos + web (dist/)
npm run build:ext        # extensión (dist-extension/)
npm run build:android    # copia web y motor a android/app/src/main/assets
(cd worker && npm test)  # servicio de reportes con Miniflare
```

El APK solo se compila en GitHub Actions (aquí no hay SDK de Android). Para publicar una versión:
cambia el número en `VERSION` y haz push; no hacen falta etiquetas.

## Reglas que no se rompen

1. **El motor no usa red ni IA** y el texto analizado nunca sale del dispositivo.
2. **Nunca "es seguro".** El mejor resultado posible es "sin señales", con su advertencia.
3. **Cero falsos positivos conocidos**: toda regla nueva se corre contra los legítimos de
   `tests/dataset.ts` y `tests/reserva.ts`. Si uno se marca, la regla no entra.
4. **No afinar contra `tests/reserva.ts`.** Es la medición honesta. Si hubo que mirarla, se escribe otra.
5. **Reglas generales, no parches**: nada de una expresión hecha para que pase un solo mensaje.
6. **Dominios oficiales con fuente**, anotados en `docs/DOMINIOS.md`.
7. **Ejemplos inventados con dominios ficticios.** Nunca enlazar ni copiar un sitio de estafa real.
8. **Solo defensa**: nada que sirva para escribir, enviar o mejorar una estafa.
9. **Sin servicio de accesibilidad** en Android.
10. **Term**: solo el SVG de `src/term/` (licencia propia). No traer código de term-studio.
11. **Credenciales**: la llave de firma y los tokens de Cloudflare los crea Jharol y viven en los
    secretos de GitHub. No se piden, no se escriben en archivos, no se imprimen.
12. **Commits a nombre de Jharol, sin líneas `Co-Authored-By` ni `Claude-Session`.**
13. **No afirmar lo que no se comprobó.** El README dice qué se midió y cómo; si algo no se probó en un
    teléfono, se dice.

## Cómo comprobar cambios de interfaz

Capturas con Chrome sin ventana (puppeteer-core) contra `npm run preview`, en 390 px y 1440 px.
Revisar que no haya desplazamiento horizontal y que el teléfono de la portada no tape texto.
