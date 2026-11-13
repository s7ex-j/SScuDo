# Hoja de ruta

Lo que falta, en orden. Cada paso dice quién lo hace, qué archivos toca y cómo se sabe que quedó bien.
No hay decisiones pendientes: si algo de aquí cambia, se cambia primero este archivo.

**Quién:** `J` = Jharol (necesita su teléfono, su cuenta o una clave) · `C` = se hace en una sesión de
Claude Code con el repo · `J+C` = Jharol entrega algo y Claude lo integra.

## Estado al 13 de noviembre de 2026

Publicado y funcionando: motor (133 pruebas), app web y PWA, página de presentación, extensión,
APK v0.2.0. Construido pero **no comprobado en condiciones reales**: el servicio de reportes y la
revisión de páginas en Cloudflare, el menú contextual de la extensión, "Compartir" hacia la PWA, y todo
lo agregado el 13/11 (desacortar, portapapeles, botón de ajustes rápidos, nuevo diseño) en un teléfono.

**Primera prueba del APK (13/11, Jharol):** "Compartir" no sirve con texto de WhatsApp ni de Mensajes
(solo dejan reenviar); seleccionar texto → SScuDo funciona pero sale al final del menú (el orden lo pone
Android); los enlaces acortados pasaban sin revisarse (corregido); el aspecto visual no convencía
(rediseñado). La extensión no se probó: el modo de desarrollador de Chrome es gratis; los 5 dólares son
el registro para publicar en la tienda (paso 14).

## Fase 1 — Comprobar lo que ya existe (no se escribe código nuevo)

| # | Quién | Paso | Cómo se comprueba |
|---|---|---|---|
| 1 | J | Instalar `sscudo.apk` en un Android (en Android 13+: Ajustes → Apps → SScuDo → ⋮ → "Permitir ajustes restringidos" antes de activar notificaciones). Seguir la lista de `docs/ANDROID.md`, sección "Lista de comprobación". | Las 6 casillas marcadas. Lo que falle se anota como issue con captura. |
| 2 | J | Instalar la extensión desde `sscudo-extension.zip` (chrome://extensions → modo desarrollador → "Cargar descomprimida"). Abrir el banco real, seleccionar un texto y usar clic derecho → "Revisar con SScuDo". | El banco sale como oficial; el menú abre el resultado. |
| 3 | C | ~~Buscar fuente para los dominios de la sección "sin comprobar" de `docs/DOMINIOS.md`; mover cada uno a la tabla o quitarlo de `brands.ts`.~~ **Hecho el 11/11/2026**: los 9 (y `mercadolibre.com`) tienen fuente. | `npm test` pasa; la sección queda vacía. |
| 4 | C | ~~Corregir lo que falló en 1 y 2.~~ **Hecho el 13/11/2026** para la primera prueba del APK: desacortar en `LinkActivity`, revisar lo copiado (aviso en la app + botón de ajustes rápidos "Revisar copiado"), menú de texto "SScuDo", rediseño. | Jharol instala el APK nuevo (sale en la próxima versión) y repite la lista de `docs/ANDROID.md`. |
| 4b | J | Volver a probar con el APK nuevo y probar la extensión en la PC (no en el celular: Chrome para Android no admite extensiones). | Lista de `docs/ANDROID.md` completa. |

## Fase 2 — Firmar y encender los reportes

| # | Quién | Paso | Cómo se comprueba |
|---|---|---|---|
| 5 | J | Crear la llave de firma con `keytool` y guardar los 4 secretos `ANDROID_KEYSTORE_*` (pasos exactos en `docs/ANDROID.md`). **Guardar una copia de la llave fuera del repo**: si se pierde, nadie puede actualizar la app instalada. | El flujo "Release" termina en verde y el APK se instala sobre el anterior sin desinstalar. |
| 6 | J | En Cloudflare: crear un token ("Workers Scripts: Edit" + "D1: Edit"). Guardar en GitHub los secretos `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SSCUDO_SAL`, `SSCUDO_ADMIN`. Ejecutar el flujo "Servicio de reportes". | El flujo termina en verde y muestra la dirección `https://sscudo.<cuenta>.workers.dev`. Abrir `<dirección>/lista` devuelve un JSON con `"dominios": []`. |
| 7 | J | Guardar esa dirección como **variable** del repo `SSCUDO_API` y volver a ejecutar "Pages". | En la app web aparece el botón "Reportar esta estafa" bajo un resultado con señales, y "Ver la página sin abrirla" bajo cada enlace. |
| 7b | J+C | Comprobar la vista previa: el token de Cloudflare puede necesitar además el permiso **Browser Rendering: Edit** (no se comprobó). Si el despliegue falla por el navegador, agregar el permiso y volver a ejecutar. | Con un enlace acortado de prueba, "Ver a dónde lleva" muestra el camino, la captura y los datos de la página. |
| 8 | C | Conectar la extensión a la lista: en `extension/src/background.ts` descargar `/lista` una vez al día (`chrome.alarms` + `chrome.storage.local`), y en `analyzePage` aceptar un conjunto de dominios reportados que suba el nivel a `alto` con el motivo "reportado por la comunidad". Agregar `alarms` a los permisos. | Prueba nueva en `tests/pagina.test.ts`; con el Worker local (`node worker/test/local.mjs`) un dominio reportado 3 veces se marca en la extensión. |
| 9 | C | Lo mismo en Android: `Motor.kt` recibe la lista (descargada por `MainActivity` como mucho una vez al día, solo con Wi‑Fi o datos disponibles) y la pasa a `resumenPagina`. | `LinkActivity` marca un dominio de la lista local de prueba. |
| 10 | C | Subir `VERSION` a `0.3.0` (dispara el release). Si los pasos 6 y 7 no están hechos, se puede sacar antes una 0.2.1 con lo del 13/11 (el botón de vista previa queda oculto hasta que exista `SSCUDO_API`). | Aparece la versión con los dos archivos. |

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
| 17 | C | Llevar el diseño nuevo a la página de presentación y al popup de la extensión (hoy siguen con el estilo oscuro anterior). | Capturas a 390 y 1440 px. |

## Fuera de alcance (decidido, no reabrir)

- Leer la pantalla con el servicio de accesibilidad.
- Mandar mensajes a un servidor o a un modelo de IA para analizarlos. (Mandar la **dirección** de un
  enlace a `POST /pagina`, a pedido de la persona, sí está permitido desde el 13/11: ver regla 1.)
- Un veredicto "seguro".
- iOS nativo (la PWA cubre iPhone).
