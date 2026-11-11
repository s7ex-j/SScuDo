# Cómo funciona el motor

Todo está en `src/engine/` y es código puro: recibe un texto y devuelve un informe. No hace peticiones de red.

1. **Normaliza** (`normalize.ts`): minúsculas, sin tildes, sin caracteres invisibles y sin trucos como `prem1o`. Guarda de qué posición del original salió cada carácter, para poder marcar el mensaje.
2. **Busca señales de texto** (`signals.ts`): expresiones regulares agrupadas por señal (urgencia, amenaza, promesa, pedido de datos, pedido de dinero, empleo, cambio de número, instalación). Cada señal tiene un peso y cuenta una sola vez.
3. **Revisa enlaces y correos sin abrirlos** (`urls.ts`): separa el dominio real de los subdominios y marca direcciones numéricas, arrobas que esconden el destino, letras que imitan a otras, acortadores, alojamiento gratuito, terminaciones frecuentes en phishing, nombres de marcas en dominios ajenos y dominios casi iguales al oficial.
4. **Cruza marcas** (`brands.ts`): si el mensaje habla en nombre de una entidad y el enlace no está entre sus dominios, lo marca.
5. **Puntúa** (`analyze.ts`): suma pesos y agrega puntos por combinaciones (promesa + enlace, datos + enlace, cambio de número + pedido de plata). Umbrales: 55 = alto, 22 = sospechoso. Algunas señales bastan solas para el nivel alto.
6. **Busca la campaña parecida** (`campaigns.ts`) y elige los consejos.

## Lo que el motor no hace

- No abre enlaces ni consulta la antigüedad de un dominio.
- No lee imágenes ni audios.
- No sabe quién te escribió.
- No "entiende" el mensaje: reconoce patrones. Una estafa nueva o bien redactada puede pasar.

Por eso el nivel más bajo se llama "No encontré señales" y nunca "seguro".

## Medición

`npm run evaluar` corre `tests/dataset.ts` y `tests/reserva.ts`. Los mensajes de estafa de esos archivos los redactamos nosotros a partir de descripciones públicas de cada campaña; no son capturas reales. Las cifras dicen si el motor hace lo que promete, no cuánto acierta con estafas reales.
