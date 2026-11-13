# App de Android

Código en `android/` (Kotlin, sin dependencias fuera de AndroidX). Android 8 o superior.

## Qué hace

| Función | Cómo | Permiso |
|---|---|---|
| Revisar un mensaje pegado | La misma interfaz de la web, empaquetada en la app | Ninguno |
| Seleccionar texto → "SScuDo" y "Compartir → SScuDo" | Recibe el texto y lo analiza. WhatsApp y Mensajes no dejan compartir el texto de un mensaje: para esos, copiar | Ninguno |
| Revisar lo copiado | Al abrir la app, si hay texto copiado, ofrece revisarlo (solo mira si existe; lo lee al tocar el botón). Botón "Revisar copiado" en los ajustes rápidos | Ninguno |
| Revisar enlaces antes de abrirlos | Se elige SScuDo como app para abrir enlaces. Mira la dirección en el momento del toque y la pasa al navegador. Solo se muestra si hay señales | Ser la app de navegador predeterminada |
| Enlaces acortados | Pregunta al acortador a dónde redirige (solo la cabecera `Location`, sin abrir el destino), revisa el destino y abre el destino ya revisado. Si el acortador no responde, avisa en vez de abrir | Internet |
| Revisar la página | A pedido (desde el aviso de un enlace o un resultado): `PaginaActivity` abre la página en un navegador aislado que no se puede tocar (sin cookies, sin permisos, sin diálogos, sin descargas, solo http/https), lee su código y su texto visible, toma una captura y anota el aviso de Google Safe Browsing. La interfaz lo analiza en el teléfono y lo muestra punto por punto. La página ve la conexión del teléfono, como en cualquier navegador | Internet |
| Avisar si llega un mensaje de estafa | Lee el texto de las notificaciones entrantes y alerta solo en nivel alto | Acceso a notificaciones |

El motor es el mismo JavaScript de la web (`assets/motor.js`), ejecutado en un WebView sin interfaz y **con la red bloqueada**. No se guarda ni se envía ningún texto. Lo único que sale es la dirección de un enlace, en los dos casos de arriba.

## Por qué no "vigila la pantalla"

Leer todo lo que aparece en pantalla exige el servicio de accesibilidad: ve contraseñas y todo lo que escribes, es el permiso que usan los troyanos bancarios, Google lo restringe en Play Store para usos que no sean de accesibilidad, y algunas apps de bancos lo detectan y se bloquean. Las dos funciones de arriba cubren los dos caminos por los que llega una estafa (el enlace que tocas y el mensaje que recibes) sin ese costo.

## Consumo

No hay ningún proceso propio corriendo de fondo ni temporizadores. El revisor de enlaces existe solo durante el toque. El lector de notificaciones lo despierta Android cuando llega una notificación; el motor se enciende para analizarla y se apaga a los 90 segundos sin uso.

## Instalar

1. Descarga `sscudo.apk` desde la página o desde Releases y ábrelo.
2. Acepta "instalar apps desconocidas" para tu navegador y, si Play Protect pregunta, "Instalar de todas formas".
3. **Android 13 o superior:** para activar el acceso a notificaciones en una app instalada por APK, primero hay que ir a Ajustes → Apps → SScuDo → menú ⋮ → "Permitir ajustes restringidos". Sin eso, el interruptor aparece bloqueado.

## Lista de comprobación en un teléfono

Primera prueba: 13/11/2026 con la v0.2.0 (resultados en `docs/HOJA_DE_RUTA.md`). Lo de abajo es para el
APK siguiente. Usa los mensajes de ejemplo de la propia app; no hace falta un mensaje de estafa real.

- [ ] **Abre.** La app inicia con el diseño claro y la pantalla "Revisar" con Term.
- [ ] **Ejemplos.** Toca un ejemplo de estafa → sale el sello "Alta probabilidad de estafa" y las frases
      resaltadas. Toca "Mensaje normal" → sello "Sin señales conocidas".
- [ ] **Copiar en WhatsApp.** Mantén presionado un mensaje → Copiar → abre SScuDo: arriba de la caja
      aparece "Tienes algo copiado. ¿Lo reviso?". Al tocarlo, se revisa.
- [ ] **Botón de ajustes rápidos.** Baja la cortina, toca el lápiz y agrega "Revisar copiado". Copia un
      mensaje, baja la cortina y tócalo: SScuDo abre con el mensaje ya revisado.
- [ ] **Seleccionar texto.** En cualquier app, selecciona un texto → menú ⋮ → "SScuDo".
- [ ] **Enlaces.** Panel "Protección automática" → "Revisar enlaces antes de abrirlos" → elige SScuDo.
      Un enlace normal se abre sin que notes nada. `http://viabcp.com.seguridad-clientes.online/login`
      escrito en Notas muestra el aviso con el sello.
- [ ] **Acortados.** Acorta en bit.ly una dirección normal (por ejemplo una noticia) y tócala: debe
      abrir la noticia (quizás con una pantalla breve "Es un enlace acortado"). Acorta
      `http://viabcp.com.seguridad-clientes.online/login` y tócala: debe salir el aviso con el camino
      `bit.ly ↓ viabcp.com.seguridad-clientes.online`.
- [ ] **Revisar la página.** En el aviso de un enlace, toca "Revisar la página": se ve la página en un
      marco que no se puede tocar y al rato aparece la revisión con captura y "Punto por punto".
      Prueba con una noticia y con una página de login cualquiera.
- [ ] **Notificaciones.** Panel → "Avisarme si llega un mensaje de estafa" (en Android 13+ primero
      "Permitir ajustes restringidos"). Que alguien te envíe por WhatsApp un ejemplo de estafa: llega
      una alerta. Un mensaje normal no genera nada.

Si algo falla, anota el modelo del teléfono, la versión de Android y qué pasó. Para volver atrás:
Ajustes → Apps → Apps predeterminadas → Navegador, y elige el de antes.

Lo que no se puede arreglar desde la app: el lugar de "SScuDo" en el menú de texto (lo ordena Android)
y que WhatsApp no ofrezca "Compartir" para mensajes de texto.

## Límites

- Si el motor tarda más de 1,5 s o falla, el enlace se abre igual. SScuDo no debe dejarte sin navegar.
- El navegador de destino se elige solo: uno conocido (Chrome, Firefox, Brave, Edge, Samsung…) o el primero instalado. Todavía no se puede escoger.
- Las notificaciones traen solo el inicio de los mensajes largos.
- Sin probar en un teléfono real (ver README).

## Compilar

```bash
npm install
npm run build:android                 # web + motor → android/app/src/main/assets
gradle -p android assembleRelease     # Gradle 8.7, JDK 17, Android SDK 34
```

El flujo `.github/workflows/release.yml` hace lo mismo y publica el APK en Releases al subir una etiqueta `v*`.

## Firma (hazlo antes de repartir el APK)

Sin una clave propia, cada compilación sale con una firma de prueba distinta y Android no deja actualizar: hay que desinstalar la versión anterior. Crea tu clave una vez, en tu PC:

```bash
keytool -genkeypair -v -keystore sscudo.jks -alias sscudo -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 sscudo.jks      # en Windows: certutil -encode sscudo.jks salida.txt
```

Guarda en GitHub (Settings → Secrets and variables → Actions) los secretos `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`sscudo`) y `ANDROID_KEY_PASSWORD`. **Guarda el archivo `.jks` y sus contraseñas fuera del repo: si los pierdes no podrás publicar actualizaciones.**
