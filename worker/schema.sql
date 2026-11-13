-- Base de datos de reportes de SScuDo (Cloudflare D1 / SQLite).
-- No guarda mensajes, teléfonos ni direcciones IP: solo dominios, el tipo de
-- estafa y una huella diaria e irreversible de quien reporta.

CREATE TABLE IF NOT EXISTS reportes (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  dominio TEXT NOT NULL,            -- dominio real del enlace, o '-' si el mensaje no traía
  campana TEXT NOT NULL DEFAULT '', -- id del catálogo, o ''
  nivel   TEXT NOT NULL,            -- 'alto' | 'sospechoso'
  quien   TEXT NOT NULL,            -- huella: cambia cada día, no permite volver a la IP
  dia     TEXT NOT NULL,            -- AAAA-MM-DD (UTC)
  creado  INTEGER NOT NULL,
  UNIQUE (dominio, campana, quien, dia)
);
CREATE INDEX IF NOT EXISTS reportes_dominio ON reportes (dominio, creado);
CREATE INDEX IF NOT EXISTS reportes_campana ON reportes (campana, creado);
CREATE INDEX IF NOT EXISTS reportes_quien ON reportes (quien, dia);

-- Moderación: dominios que no deben mostrarse (reporte falso, sitio legítimo).
CREATE TABLE IF NOT EXISTS ocultos (
  dominio TEXT PRIMARY KEY,
  motivo  TEXT NOT NULL DEFAULT '',
  creado  INTEGER NOT NULL
);

-- Revisiones de páginas (POST /pagina): solo se cuenta cuántas hizo cada
-- huella en el día, para poner un límite. La dirección revisada no se guarda.
CREATE TABLE IF NOT EXISTS consultas (
  quien TEXT NOT NULL,
  dia   TEXT NOT NULL,
  n     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (quien, dia)
);
