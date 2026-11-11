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

## Publicarlo (una vez)

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
