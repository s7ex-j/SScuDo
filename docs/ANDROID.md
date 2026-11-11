# App de Android

Código en `android/` (Kotlin, sin dependencias fuera de AndroidX). Android 8 o superior.

## Qué hace

| Función | Cómo | Permiso |
|---|---|---|
| Revisar un mensaje pegado | La misma interfaz de la web, empaquetada en la app | Ninguno |
| "Compartir → SScuDo" y seleccionar texto → "Revisar con SScuDo" | Recibe el texto y lo analiza | Ninguno |
| Revisar enlaces antes de abrirlos | Se elige SScuDo como app para abrir enlaces. Mira la dirección en el momento del toque y la pasa al navegador. Solo se muestra si hay señales | Ser la app de navegador predeterminada |
| Avisar si llega un mensaje de estafa | Lee el texto de las notificaciones entrantes y alerta solo en nivel alto | Acceso a notificaciones |

El motor es el mismo JavaScript de la web (`assets/motor.js`), ejecutado en un WebView sin interfaz y **con la red bloqueada**. No se guarda ni se envía ningún texto.

## Por qué no "vigila la pantalla"

Leer todo lo que aparece en pantalla exige el servicio de accesibilidad: ve contraseñas y todo lo que escribes, es el permiso que usan los troyanos bancarios, Google lo restringe en Play Store para usos que no sean de accesibilidad, y algunas apps de bancos lo detectan y se bloquean. Las dos funciones de arriba cubren los dos caminos por los que llega una estafa (el enlace que tocas y el mensaje que recibes) sin ese costo.

## Consumo

No hay ningún proceso propio corriendo de fondo ni temporizadores. El revisor de enlaces existe solo durante el toque. El lector de notificaciones lo despierta Android cuando llega una notificación; el motor se enciende para analizarla y se apaga a los 90 segundos sin uso.

## Instalar

1. Descarga `sscudo.apk` desde la página o desde Releases y ábrelo.
2. Acepta "instalar apps desconocidas" para tu navegador y, si Play Protect pregunta, "Instalar de todas formas".
3. **Android 13 o superior:** para activar el acceso a notificaciones en una app instalada por APK, primero hay que ir a Ajustes → Apps → SScuDo → menú ⋮ → "Permitir ajustes restringidos". Sin eso, el interruptor aparece bloqueado.

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
