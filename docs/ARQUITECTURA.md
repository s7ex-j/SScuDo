# Arquitectura

Una sola idea sostiene todo: **el análisis es un motor de reglas en TypeScript que no usa red ni IA**,
y cada cliente (web, extensión, Android) es una cáscara delgada alrededor del mismo motor.

```
                    src/engine/  (TypeScript puro, sin DOM, sin red)
                    analyze(texto) · analyzePage(página)
                              │
      ┌───────────────┬───────┴────────┬──────────────────────┐
   Web / PWA       Extensión        Android                 Pruebas
   src/App.tsx     extension/       android/                tests/
   (React)         (Manifest V3)    (Kotlin + WebView)      (vitest)
      │               │                │
      └───────────────┴────────────────┘
                      │  opcional, apagado por defecto
              worker/  Cloudflare Worker + D1
              (reportes: solo dominio + campaña + nivel)
```

## Piezas

| Pieza | Carpeta | Se construye con | Sale a |
|---|---|---|---|
| Motor | `src/engine/` | — (lo importan los demás) | — |
| Página de presentación | `index.html`, `src/landing/` | `npm run build` | `dist/index.html` |
| App web / PWA | `app/index.html`, `src/App.tsx`, `public/` | `npm run build` | `dist/app/` |
| Extensión | `extension/` | `npm run build:ext` | `dist-extension/` |
| Android | `android/` + `src/engine/embebido.ts` | `npm run build:android`, luego Gradle | APK |
| Servicio de reportes | `worker/` | `wrangler` | Cloudflare |

## El motor (`src/engine/`)

Orden en que trabaja `analyze(mensaje)`:

1. `normalize.ts` — pliega el texto (tildes, caracteres invisibles, números por letras) y guarda un mapa
   de posiciones para poder resaltar el texto **original**.
2. `urls.ts` — extrae enlaces y los descompone: dominio registrable, subdominio, marca que imita,
   acortador, alojamiento gratuito, TLD de riesgo, `@` en la dirección, IP, punycode, parecido por
   distancia de edición.
3. `brands.ts` — entidades y sus dominios oficiales (ver `docs/DOMINIOS.md`).
4. `signals.ts` — patrones con peso (urgencia, pedir clave, premio, pago por adelantado…).
5. `campaigns.ts` — estafas conocidas con sus fuentes; `matchCampaign` decide cuál se parece.
6. `analyze.ts` — suma, aplica combinaciones y decide el nivel.

Niveles: `alto` (≥ 55), `sospechoso` (≥ 22), `sin_senales`. **Nunca existe un nivel "seguro"**: no ver
señales no demuestra nada, y la interfaz lo dice así.

`page.ts` (`analyzePage`) es la variante para páginas: usa la dirección, el título y si hay campos de
clave o tarjeta. Devuelve además `oficial` y `no_aplica`.

`embebido.ts` expone el motor como `globalThis.SScuDo` para Android.

## Reglas de diseño que no se negocian

1. **Nada sale del dispositivo para analizar.** El mensaje no se envía a ningún servidor.
2. **Nunca decir "es seguro".**
3. **Cada veredicto se explica**: qué frase, qué parte del enlace, por qué.
4. **Un falso positivo cuesta más que un fallo**: si SScuDo marca al banco real, la gente deja de
   creerle. Toda regla nueva se prueba contra los mensajes legítimos.
5. **Las reglas se afinan con `tests/dataset.ts` y se miden con `tests/reserva.ts`**, que no se mira
   mientras se afina. Si se usa la reserva para ajustar, hay que escribir una reserva nueva.
6. **Ejemplos inventados, dominios ficticios.** Ningún mensaje de prueba apunta a un sitio real de estafa.
7. **Sin lectura de pantalla en Android.** El permiso de accesibilidad daría acceso a todo lo que la
   persona ve; no se justifica. Se usan enlaces, notificaciones y compartir (ver `docs/ANDROID.md`).
8. **Term**: solo el SVG de `src/term/`, con su propia licencia. El código 3D de term-studio no entra aquí.

## Web y PWA

Dos entradas de Vite (`vite.config.ts`): la página de presentación y la app. Base `./` para que funcione
en GitHub Pages y dentro del APK. El texto puede llegar por el fragmento `#texto=` (no viaja al servidor)
o por "Compartir" (`share_target` en `public/manifest.webmanifest`, atendido por `public/sw.js`).

## Extensión

`content.ts` mira la página (dirección, título, campos de clave/tarjeta) → `background.ts` llama a
`analyzePage` y pone la insignia → `popup.ts` explica. Menú contextual para revisar texto seleccionado.
Permisos: `activeTab`, `contextMenus`, `storage`. No pide acceso a todos los sitios.

## Android

- `MainActivity` — la interfaz es la misma web, servida desde los recursos del APK con
  `WebViewAssetLoader`.
- `Motor.kt` — un WebView sin interfaz con la red bloqueada que ejecuta `assets/motor.js`.
- `LinkActivity` — se puede elegir como navegador predeterminado: revisa el enlace y lo pasa al
  navegador real. Si el motor tarda más de 1,5 s, deja pasar.
- `NotifListener` — avisa solo cuando una notificación da nivel `alto`.
- `Puente.kt` — lo que la web puede pedirle a Android (`window.SScuDoAndroid`).

## Reportes (`worker/`)

Apagado hasta que exista la variable `SSCUDO_API`. Guarda dominio, campaña, nivel y una huella diaria
con sal; un dominio se publica cuando lo reportan 3 personas distintas en 30 días. Los clientes
descargan la lista y comparan **en el dispositivo**. Detalle en `docs/REPORTES.md`.

## Publicación

| Flujo | Se dispara con | Hace |
|---|---|---|
| `ci.yml` | cada push | tipos, pruebas, compila web, extensión y APK |
| `pages.yml` | push a `main` | publica `dist/` en GitHub Pages |
| `release.yml` | cambio en el archivo `VERSION` | crea la versión con `sscudo.apk` y `sscudo-extension.zip` |
| `servicio.yml` | manual | despliega el Worker (necesita los secretos de Cloudflare) |
