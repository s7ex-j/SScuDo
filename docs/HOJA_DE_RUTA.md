# Hoja de ruta

Lo que falta, en orden. Cada paso dice quién lo hace, qué archivos toca y cómo se sabe que quedó bien.
No hay decisiones pendientes: si algo de aquí cambia, se cambia primero este archivo.

**Quién:** `J` = Jharol (necesita su teléfono, su cuenta o una clave) · `C` = se hace en una sesión de
Claude Code con el repo · `J+C` = Jharol entrega algo y Claude lo integra.

## Estado al 11 de noviembre de 2026

Publicado y funcionando: motor (112 pruebas), app web y PWA, página de presentación, extensión,
APK v0.2.0. Construido pero **no comprobado en condiciones reales**: el APK en un teléfono, el servicio
de reportes en Cloudflare, el menú contextual de la extensión, "Compartir" hacia la PWA.

## Fase 1 — Comprobar lo que ya existe (no se escribe código nuevo)

| # | Quién | Paso | Cómo se comprueba |
|---|---|---|---|
| 1 | J | Instalar `sscudo.apk` en un Android (en Android 13+: Ajustes → Apps → SScuDo → ⋮ → "Permitir ajustes restringidos" antes de activar notificaciones). Seguir la lista de `docs/ANDROID.md`, sección "Lista de comprobación". | Las 6 casillas marcadas. Lo que falle se anota como issue con captura. |
| 2 | J | Instalar la extensión desde `sscudo-extension.zip` (chrome://extensions → modo desarrollador → "Cargar descomprimida"). Abrir el banco real, seleccionar un texto y usar clic derecho → "Revisar con SScuDo". | El banco sale como oficial; el menú abre el resultado. |
| 3 | C | Buscar fuente para los dominios de la sección "sin comprobar" de `docs/DOMINIOS.md`; mover cada uno a la tabla o quitarlo de `brands.ts`. | `npm test` pasa; la sección queda vacía. |
| 4 | C | Corregir lo que falló en 1 y 2. | Jharol repite solo el punto que falló. |

## Fase 2 — Firmar y encender los reportes

| # | Quién | Paso | Cómo se comprueba |
|---|---|---|---|
| 5 | J | Crear la llave de firma con `keytool` y guardar los 4 secretos `ANDROID_KEYSTORE_*` (pasos exactos en `docs/ANDROID.md`). **Guardar una copia de la llave fuera del repo**: si se pierde, nadie puede actualizar la app instalada. | El flujo "Release" termina en verde y el APK se instala sobre el anterior sin desinstalar. |
| 6 | J | En Cloudflare: crear un token ("Workers Scripts: Edit" + "D1: Edit"). Guardar en GitHub los secretos `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SSCUDO_SAL`, `SSCUDO_ADMIN`. Ejecutar el flujo "Servicio de reportes". | El flujo termina en verde y muestra la dirección `https://sscudo.<cuenta>.workers.dev`. Abrir `<dirección>/lista` devuelve un JSON con `"dominios": []`. |
| 7 | J | Guardar esa dirección como **variable** del repo `SSCUDO_API` y volver a ejecutar "Pages". | En la app web aparece el botón "Reportar esta estafa" bajo un resultado con señales. |
| 8 | C | Conectar la extensión a la lista: en `extension/src/background.ts` descargar `/lista` una vez al día (`chrome.alarms` + `chrome.storage.local`), y en `analyzePage` aceptar un conjunto de dominios reportados que suba el nivel a `alto` con el motivo "reportado por la comunidad". Agregar `alarms` a los permisos. | Prueba nueva en `tests/pagina.test.ts`; con el Worker local (`node worker/test/local.mjs`) un dominio reportado 3 veces se marca en la extensión. |
| 9 | C | Lo mismo en Android: `Motor.kt` recibe la lista (descargada por `MainActivity` como mucho una vez al día, solo con Wi‑Fi o datos disponibles) y la pasa a `resumenPagina`. | `LinkActivity` marca un dominio de la lista local de prueba. |
| 10 | C | Subir `VERSION` a `0.3.0` (dispara el release). | Aparece la versión 0.3.0 con los dos archivos. |

## Fase 3 — Que detecte mejor (trabajo continuo, mismo ciclo siempre)

| # | Quién | Paso | Cómo se comprueba |
|---|---|---|---|
| 11 | J+C | Jharol reenvía mensajes reales de estafa (capturas o texto, con datos personales tapados). Claude los pasa a `tests/reales.ts` cambiando el dominio por uno ficticio de la misma forma. | Archivo nuevo con su prueba; el README informa el resultado **del primer intento**, sin ajustar antes. |
| 12 | C | Para cada fallo: generalizar la regla en `signals.ts` o `campaigns.ts` (nunca una regla hecha para un solo mensaje), correr todo. | 0 falsos positivos en los legítimos de `dataset.ts` y `reserva.ts`. |
| 13 | C | Cada campaña nueva sigue `docs/AGREGAR_CAMPANA.md` (con fuente pública). | La campaña aparece en "Estafas conocidas" con su fuente. |

## Fase 4 — Distribución (opcional, cuando lo anterior esté firme)

| # | Quién | Paso | Nota |
|---|---|---|---|
| 14 | J | Publicar la extensión en Chrome Web Store (pago único de registro de desarrollador). | Subir `sscudo-extension.zip`; la ficha usa las capturas de `public/capturas/`. |
| 15 | J | Publicar en Google Play. | Requiere cuenta de desarrollador y declarar el uso del acceso a notificaciones; Play puede pedir un video. Mientras tanto el APK de GitHub sirve. |
| 16 | C | Reel de presentación con Term (repo term-studio). | Solo después del paso 1: no se anuncia algo que no se probó en un teléfono. |

## Fuera de alcance (decidido, no reabrir)

- Leer la pantalla con el servicio de accesibilidad.
- Mandar mensajes a un servidor o a un modelo de IA para analizarlos.
- Un veredicto "seguro".
- iOS nativo (la PWA cubre iPhone).
