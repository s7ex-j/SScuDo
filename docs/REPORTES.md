# Reportes de la comunidad

Cuando varias personas reportan el mismo dominio, SScuDo se lo advierte a quien venga después. El servicio está en `worker/` (Cloudflare Workers + base D1).

## Qué se guarda y qué no

| Se guarda | No se guarda |
|---|---|
| El dominio real del enlace | El mensaje |
| El tipo de estafa (id del catálogo) | Teléfonos, nombres, correos |
| El nivel (alto o sospechoso) | La dirección IP |
| Una huella que cambia cada día | Qué páginas visitas |

- Un dominio se muestra solo cuando lo reportan **3 personas distintas** en 30 días.
- La misma persona no suma dos veces el mismo día, y tiene un máximo de 20 reportes diarios.
- Los dominios oficiales y los sitios muy conocidos no se pueden reportar.
- No se reportan teléfonos: señalar a una persona se presta al abuso.
- La app descarga la lista y compara en el dispositivo. El servicio no sabe qué dominio estás mirando.

## Límites conocidos

- Tres personas puestas de acuerdo, o alguien con varias conexiones, pueden meter un dominio legítimo en la lista. Para eso está la moderación (abajo). Hay que revisar la lista con frecuencia.
- La cabecera de origen se puede falsificar fuera de un navegador. La protección real es el umbral, el límite diario y la moderación.
- El texto siempre dice "reportes de usuarios, no una verificación".

## Publicarlo desde GitHub (recomendado)

1. En Cloudflare, crea un token de API (Mi perfil → API Tokens) con permisos de edición sobre **Workers Scripts** y **D1** (y, para la vista previa de páginas, probablemente **Browser Rendering**: no se comprobó; si el despliegue se queja del navegador, agrégalo). Copia también tu **Account ID** (aparece en el panel de Workers).
2. En GitHub: Settings → Secrets and variables → Actions → **Secrets**, crea:
   - `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`
   - `SSCUDO_SAL`: un texto largo al azar
   - `SSCUDO_ADMIN`: tu clave de moderación
3. En la pestaña Actions, abre "Servicio de reportes" y pulsa **Run workflow**. Crea la base, las tablas y despliega.
4. Copia la dirección `https://sscudo-reportes.….workers.dev` que aparece en el paso "Desplegar" y guárdala como **variable** `SSCUDO_API` (misma pantalla, pestaña Variables).
5. Vuelve a publicar: Actions → "Publicar" → Run workflow. Para que el APK también reporte, sube una etiqueta nueva.

Este flujo no se ha ejecutado todavía con credenciales reales: si falla, el registro dirá en qué paso.

## Publicarlo desde tu PC (alternativa)

Necesitas una cuenta de Cloudflare. Revisa los límites del plan gratuito antes de empezar.

```bash
cd worker
npm install
npx wrangler login
npx wrangler d1 create sscudo          # copia el database_id a wrangler.toml
npm run db:crear                       # crea las tablas
npx wrangler secret put SAL            # un texto largo al azar
npx wrangler secret put ADMIN          # tu clave de moderación
npm run deploy                         # imprime la URL del servicio
```

Después, en GitHub: Settings → Secrets and variables → Actions → Variables → nueva variable `SSCUDO_API` con esa URL. El siguiente push publica la web con los reportes activos. Sin esa variable, la app funciona igual pero sin reportes.

## Moderar

```bash
curl -X POST https://TU-SERVICIO/admin/ocultar \
  -H "Authorization: Bearer TU_CLAVE" -H "content-type: application/json" \
  -d '{"dominio":"ejemplo.com","motivo":"sitio legítimo"}'
```

`/admin/mostrar` deshace el cambio.

## Probar en local

```bash
cd worker
npm test                               # 11 casos contra una base en memoria
SEMBRAR=1 node test/local.mjs          # servicio en http://localhost:8787 con datos de ejemplo
# en otra terminal, desde la raíz:
VITE_SSCUDO_API=http://localhost:8787 npm run dev
```

## Revisar una página sin abrirla (`POST /pagina`)

La app manda `{ "url": "..." }` y el servicio, desde Cloudflare:

1. Sigue las redirecciones una por una (también los acortadores y los `<meta http-equiv="refresh">`),
   rechazando IPs, redes locales y puertos raros en cada salto.
2. Descarga el HTML (máximo 1,5 MB) y lo pasa a `analyzeHtml` (`src/engine/html.ts`): qué pide, a qué
   dominio manda los datos, si copia imágenes del sitio oficial de un banco, teléfonos, WhatsApp, correos.
3. Consulta la fecha de registro del dominio en RDAP (`rdap.org`). Algunos dominios `.pe` pueden no
   tener respuesta: se muestra "No se pudo consultar".
4. Si existe el enlace `NAVEGADOR` (Browser Rendering), toma una captura de 390 px. El plan gratuito
   tiene un cupo diario de uso del navegador; al agotarse, responde sin captura y lo dice.

No guarda la dirección: solo cuenta consultas por huella diaria (tabla `consultas`), con un límite de 40
por día.
