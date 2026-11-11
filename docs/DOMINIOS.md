# Dominios oficiales: qué está comprobado

SScuDo marca como **imitación** un enlace que usa el nombre de una entidad fuera de sus dominios.
Por eso un dominio mal puesto en `src/engine/brands.ts` tiene dos costos: si falta uno real, un enlace
legítimo sale en rojo; si sobra uno falso, una estafa pasa como oficial.

Regla: **no se agrega un dominio sin una fuente que no sea el propio mensaje**, y se anota aquí.

## Comprobados (noviembre de 2026)

Cada uno aparece en un documento de la propia entidad, del Estado o de otra entidad regulada.
`tests/dominios.test.ts` fija estas direcciones: si alguna deja de reconocerse, la prueba falla.

| Entidad | Dominio | Dónde se comprobó |
|---|---|---|
| BCP | `viabcp.com`, `bcp.com.pe` | Web del banco; correos de Yape para negocios |
| Yape | `yape.com.pe` | Citado por el BCRP (revista Moneda n.º 201) |
| Plin | `plin.pe` | Términos y condiciones de BBVA y de Financiera Confianza |
| Interbank | `interbank.pe` | Web del banco |
| BBVA | `bbva.pe`, `bbva.com.pe`, `bbva.com` | Documentos alojados en los tres |
| Scotiabank | `scotiabank.com.pe` | Web del banco |
| Banco de la Nación | `bn.com.pe` | Documentos de Multired Virtual |
| BanBif | `banbif.com.pe` | Web del banco |
| Banco Pichincha | `pichincha.pe` | Web del banco |
| Banco Falabella | `bancofalabella.pe` | Web del banco |
| AFP Integra | `afpintegra.pe` | Preguntas frecuentes de la Asociación de AFP |
| Prima AFP | `prima.com.pe` | Agencia virtual |
| AFP Habitat | `afphabitat.com.pe` | Asociación de AFP; presentación ante el Congreso |
| Profuturo | `profuturo.com.pe` | Agencia virtual |
| Asociación de AFP | `asociacionafp.pe`, `solicitaretiroafp.pe` | Documento de retiro 2024 de la Asociación |
| AFPnet (empleadores) | `afpnet.com.pe` | Guías de trámite |
| Estado | cualquier `*.gob.pe` | Dominio reservado al Estado peruano |
| Serpost | `serpost.com.pe` | Web y correos de atención |
| Claro | `claro.com.pe`, `tiendaclaro.pe` | Listados de tráfico del sector |
| Movistar | `movistar.com.pe` | Listados de tráfico del sector |
| Entel | `entel.pe` | Listados de tráfico del sector |
| Bitel | `bitel.com.pe` | Listados de tráfico del sector |

## En la lista, sin comprobar con fuente

Están en `brands.ts` porque son los que se usan, pero falta anotar una fuente. Paso 3 de la hoja de ruta.

`interbank.com.pe`, `mibanco.com.pe`, `falabella.com.pe`, `ripley.com.pe`, `bancoripley.com.pe`,
`olvacourier.com`, `dhl.com`, `mercadolibre.com.pe`, `mercadopago.com.pe`.

## Conocidos que NO están

- `mihabitatdigital.com` (zona privada de AFP Habitat): solo lo cita una guía de terceros. Mientras no
  se confirme, un enlace ahí se analiza como cualquier otro dominio (no se marca por el nombre, porque
  no contiene "afp").
- Sitios de campaña que una entidad crea para un trámite puntual (por ejemplo
  `afphabitat-seguimientoretiro.pe`, usado en 2020). Tienen la misma forma que una imitación y SScuDo
  **los marcará**. Es un límite aceptado: la recomendación de entrar escribiendo la dirección sigue
  siendo correcta.

## Cómo comprobar uno nuevo

1. Busca el dominio en un documento de la entidad (términos y condiciones, PDF de tarifas), de la SBS,
   del BCRP o de un organismo `gob.pe`. Una nota de prensa sola no basta.
2. Agrégalo a `brands.ts` y una fila a la tabla de arriba.
3. Agrega una dirección real a `OFICIALES` en `tests/dominios.test.ts` y corre `npm test`.
