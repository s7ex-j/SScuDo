# Agregar una campaña, una señal o una marca

## Campaña (`src/engine/campaigns.ts`)

1. Busca una fuente pública (autoridad, banco o prensa) que describa la estafa.
2. Escribe la entrada con tus palabras: `hook`, `how` (pasos), `todo` y `sources`. Sin fuente, deja `sources: []`; no inventes una.
3. Define `match` con las señales que la delatan.
4. Agrega al menos un mensaje de ejemplo a `tests/dataset.ts` con `campana: "<id>"`.

## Señal (`src/engine/signals.ts`)

Regla: cada señal nueva llega con un mensaje de estafa que la dispara y un mensaje normal que no, los dos en `tests/dataset.ts`. Los patrones se escriben sin tildes y en minúsculas.

## Marca (`src/engine/brands.ts`)

Un dominio mal puesto hace que un enlace legítimo se marque como imitación. Comprueba el dominio en la web o la app oficial de la entidad antes de agregarlo.

## Antes de subir

```bash
npm test
npm run build
```

Ningún mensaje legítimo del conjunto puede quedar marcado.
