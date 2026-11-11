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
| Interbank | `interbank.com.pe` | Citado en un estudio de medios de pago de PromPerú (`repositorio.promperu.gob.pe`). No se comprobó desde aquí que el dominio siga respondiendo |
| Mibanco | `mibanco.com.pe` | Tarifario de depósitos alojado en el dominio, emitido bajo la Res. SBS 3274-2017; registro LEI corroborado con SUNAT (RUC 20382036655) |
| BBVA | `bbva.pe`, `bbva.com.pe`, `bbva.com` | Documentos alojados en los tres |
| Scotiabank | `scotiabank.com.pe` | Web del banco |
| Banco de la Nación | `bn.com.pe` | Documentos de Multired Virtual |
| BanBif | `banbif.com.pe` | Web del banco |
| Banco Pichincha | `pichincha.pe` | Web del banco |
| Banco Falabella | `bancofalabella.pe` | Web del banco |
| Falabella (tienda) | `falabella.com.pe` | Documentos para inversionistas de Saga Falabella alojados en el dominio; pie de Falabella.com S.A.C. |
| Banco Ripley | `bancoripley.com.pe` | Contratos aprobados por la SBS alojados en el dominio (productos financieros, mayo 2022) |
| Ripley (tienda) | `ripley.com.pe` | Condiciones de membresía de la Tarjeta Ripley, PDF de Banco Ripley (enlaza `simple.ripley.com.pe`) |
| AFP Integra | `afpintegra.pe` | Preguntas frecuentes de la Asociación de AFP |
| Prima AFP | `prima.com.pe` | Agencia virtual |
| AFP Habitat | `afphabitat.com.pe` | Asociación de AFP; presentación ante el Congreso |
| Profuturo | `profuturo.com.pe` | Agencia virtual |
| Asociación de AFP | `asociacionafp.pe`, `solicitaretiroafp.pe` | Documento de retiro 2024 de la Asociación |
| AFPnet (empleadores) | `afpnet.com.pe` | Guías de trámite |
| Estado | cualquier `*.gob.pe` | Dominio reservado al Estado peruano |
| Serpost | `serpost.com.pe` | Web y correos de atención |
| Olva Courier | `olvacourier.com` | Manual de embalaje COM-M-03 y bases de promociones de Olva Courier S.A.C. (RUC 20100686814) alojados en el dominio |
| DHL | `dhl.com` | Guía de aduanas de DHL Express para Perú (enlaza `dhl.com/pe-es`); aviso legal de DHL Express Perú S.A.C. en ese dominio |
| Mercado Libre | `mercadolibre.com.pe`, `mercadolibre.com` | Pie de MercadoLibre Perú S.R.L.; `api.mercadolibre.com` en la documentación oficial para desarrolladores |
| Mercado Pago | `mercadopago.com.pe` | Portal de desarrolladores con pie de MercadoLibre Perú S.R.L.; citado como fuente en un estudio de PromPerú |
| Claro | `claro.com.pe`, `tiendaclaro.pe` | Listados de tráfico del sector |
| Movistar | `movistar.com.pe` | Listados de tráfico del sector |
| Entel | `entel.pe` | Listados de tráfico del sector |
| Bitel | `bitel.com.pe` | Listados de tráfico del sector |

## En la lista, sin comprobar con fuente

Ninguno (vaciada el 11 de noviembre de 2026, paso 3 de la hoja de ruta). Todo dominio nuevo de
`brands.ts` entra directamente a la tabla de arriba con su fuente.

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
