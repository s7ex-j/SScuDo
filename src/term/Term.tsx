// Term, la mascota de @s7ex.git, en versión dibujo (SVG).
// El personaje y su diseño son de Jharol André Vilca Ramos, con todos los
// derechos reservados: ver src/term/LICENSE. La licencia MIT del resto del
// repositorio no cubre este archivo.

export type TermMood = "espera" | "leyendo" | "alto" | "sospechoso" | "calma";

interface Props {
  mood: TermMood;
  size?: number;
}

const PANTALLA: Record<TermMood, string> = {
  espera: "#062A22",
  leyendo: "#062A22",
  alto: "#3A0F1C",
  sospechoso: "#33290A",
  calma: "#062A22",
};

const OJO = "#2DD4EE";
const BOCA = "#E6FFF1";

function Ojos({ mood }: { mood: TermMood }) {
  if (mood === "alto") {
    return (
      <g fill="#FFD9E0">
        <rect x="10" y="12" width="4" height="6" />
        <rect x="18" y="12" width="4" height="6" />
      </g>
    );
  }
  if (mood === "sospechoso") {
    return (
      <g fill="#FFD84D">
        <rect x="10" y="15" width="4" height="2" />
        <rect x="19" y="13" width="2" height="4" />
      </g>
    );
  }
  if (mood === "calma") {
    return (
      <g fill={OJO}>
        <path d="M10 16h1v-1h1v-1h1v1h1v1h-1v-1h-1v1h-1Z" />
        <path d="M18 16h1v-1h1v-1h1v1h1v1h-1v-1h-1v1h-1Z" />
      </g>
    );
  }
  return (
    <g fill={OJO} className={mood === "leyendo" ? "term-ojos-leen" : "term-ojos"}>
      <rect x="11" y="13" width="2" height="4" />
      <rect x="19" y="13" width="2" height="4" />
    </g>
  );
}

function Boca({ mood }: { mood: TermMood }) {
  if (mood === "alto") {
    // "!!"
    return (
      <g fill="#FF5C7A">
        <rect x="14" y="19" width="1" height="2" />
        <rect x="14" y="22" width="1" height="1" />
        <rect x="17" y="19" width="1" height="2" />
        <rect x="17" y="22" width="1" height="1" />
      </g>
    );
  }
  if (mood === "sospechoso") {
    // "?_"
    return (
      <g fill="#FFD84D">
        <path d="M12 19h3v2h-1v1h-1v-1h1v-1h-2Z" />
        <rect x="13" y="23" width="1" height="1" />
        <rect x="16" y="22" width="4" height="1" />
      </g>
    );
  }
  // ">_"
  return (
    <g fill={BOCA}>
      <path d="M13 19h1v1h1v1h-1v1h-1v-1h1v-1h-1Z" />
      <rect x="16" y="21" width="3" height="1" className={mood === "leyendo" ? "term-cursor" : undefined} />
    </g>
  );
}

export function Term({ mood, size = 132 }: Props) {
  return (
    <div className={`term term-${mood}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 32 32" width={size} height={size} shapeRendering="crispEdges">
        {/* cuerpo */}
        <path d="M8 3h16v2h2v2h2v20h-3v3h-3v-3h-3v3h-4v-3h-3v3H9v-3H4V7h2V5h2V3Z" fill="#17A653" />
        <path d="M8 3h16v2h2v2H6V5h2V3Z" fill="#33D777" />
        <path d="M25 9h3v18h-3Z" fill="#0F8442" />
        {/* pantalla */}
        <rect x="6" y="9" width="20" height="16" fill="#0E3B25" />
        <rect x="7" y="10" width="18" height="14" fill={PANTALLA[mood]} />
        {/* lentes de botella */}
        <g shapeRendering="geometricPrecision">
          <circle cx="12" cy="15" r="4.2" fill="#CFF6FF" fillOpacity="0.14" stroke="#0C0F14" strokeWidth="1.5" />
          <circle cx="20" cy="15" r="4.2" fill="#CFF6FF" fillOpacity="0.14" stroke="#0C0F14" strokeWidth="1.5" />
          <path d="M2.5 14.5h5.3M24.2 14.5h5.3M15.6 14.4h0.8" stroke="#0C0F14" strokeWidth="1.3" />
        </g>
        <Ojos mood={mood} />
        <Boca mood={mood} />
      </svg>
    </div>
  );
}
