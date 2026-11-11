import type { Brand, Campaign, Finding } from "./types";

// Catálogo de campañas de estafa que circulan en el Perú.
//
// Cada entrada se escribe con palabras propias a partir de fuentes públicas
// (se enlazan en `sources`). Si una campaña no tiene fuente, no se inventa:
// se deja la lista vacía. Para agregar una: docs/AGREGAR_CAMPANA.md.

interface Ctx {
  ids: Set<string>;
  brands: Set<string>;
  kinds: Set<Brand["kind"]>;
  text: string; // normalizado
  hasUrl: boolean;
}

interface Entry extends Campaign {
  /** 0 = no aplica. Gana la entrada con el número más alto. */
  match: (c: Ctx) => number;
}

const has = (c: Ctx, ...ids: string[]) => ids.some((i) => c.ids.has(i));

const ENTRIES: Entry[] = [
  {
    id: "codigo-whatsapp",
    name: "El código que \"llegó por error\"",
    hook: "Un contacto te pide que le reenvíes un código de 6 dígitos que te acaba de llegar por SMS.",
    how: [
      "Alguien intenta registrar tu WhatsApp en su celular. Para lograrlo necesita el código que WhatsApp te manda a ti.",
      "Te escribe, muchas veces desde la cuenta ya robada de un conocido, diciendo que el código era suyo.",
      "Si se lo das, pierdes tu cuenta y la usan para pedir plata a tus contactos.",
    ],
    todo: [
      "No reenvíes el código a nadie, tampoco a un familiar.",
      "Activa la verificación en dos pasos en WhatsApp (Ajustes, Cuenta).",
      "Avísale por llamada a la persona cuyo número te escribió: es probable que le hayan robado la cuenta.",
    ],
    sources: [{ title: "El Tiempo: si recibes este mensaje en WhatsApp, podría ser una estafa", url: "https://eltiempo.pe/uncategorized/si-recibes-este-mensaje-en-whatsapp-no-respondas-podria-ser-una-estafa/" }],
    detectable: true,
    match: (c) => (has(c, "codigo_por_error") ? 10 : 0),
  },
  {
    id: "falso-bono",
    name: "El bono que no existe",
    hook: "Un mensaje anuncia un bono (a veces \"Bono Yape\") y trae un enlace para consultar con tu DNI.",
    how: [
      "El mensaje circula por WhatsApp, Facebook o SMS con un monto llamativo y una fecha de cobro.",
      "El enlace abre una página que copia la de Yape o la del Estado y pide DNI, celular y datos de tarjeta o claves.",
      "Con esos datos entran a tu billetera o a tu banca por internet.",
    ],
    todo: [
      "No abras el enlace y no lo reenvíes.",
      "Los bonos del Estado se consultan solo en páginas que terminan en gob.pe.",
      "Si ya pusiste tus datos, llama a tu banco de inmediato y cambia tus claves.",
    ],
    sources: [{ title: "El Tiempo: alertan sobre el falso bono Yape", url: "https://eltiempo.pe/bonos-y-subsidios/falso-bono-yape-2025-alertan-sobre-nueva-modalidad-de-estafa-digital/" }],
    detectable: true,
    match: (c) => (has(c, "premio_bono") ? 7 + (c.hasUrl ? 1 : 0) : 0),
  },
  {
    id: "retiro-afp-cts",
    name: "El retiro de AFP o CTS por enlace",
    hook: "Un SMS dice que ya puedes registrar o cobrar tu retiro de AFP o CTS entrando a un enlace.",
    how: [
      "Aprovechan cada anuncio de retiro de fondos, cuando millones de personas esperan un mensaje así.",
      "El enlace lleva a una copia de la página de la AFP o del banco y pide tus credenciales.",
      "Con ellas cambian la cuenta de destino o entran a tu banca.",
    ],
    todo: [
      "Entra a la web de tu AFP escribiendo tú la dirección, nunca desde un SMS.",
      "Las AFP y los bancos no piden claves por mensaje.",
      "Ante la duda, llama al número que figura en tu estado de cuenta.",
    ],
    sources: [{ title: "Centro Nacional de Seguridad Digital: comunicado sobre phishing y retiro de fondos", url: "https://munichosica.pe/wp-content/uploads/2024/09/COMUNICADO_016_2024-CNSDFP.pdf" }],
    detectable: true,
    match: (c) => (c.brands.has("afp") && (c.hasUrl || has(c, "pide_datos", "premio_reembolso", "pago_previo")) ? 8 : 0),
  },
  {
    id: "reembolso-falso",
    name: "El reembolso automático",
    hook: "Un correo o mensaje dice que tienes un reembolso pendiente y que lo cobres desde un enlace.",
    how: [
      "Llega con los colores y el logo de Yape, de un banco o de SUNAT.",
      "El enlace abre una página idéntica a la real que pide número de tarjeta, vencimiento y CVV \"para depositarte\".",
      "Para devolverte plata nadie necesita tu CVV: con eso compran por internet a tu nombre.",
    ],
    todo: [
      "No ingreses los datos de tu tarjeta.",
      "Márcalo como phishing o spam en tu correo.",
      "Si quieres comprobarlo, pregunta por los canales que aparecen en la app oficial.",
    ],
    sources: [{ title: "Infomercado: correos falsos suplantan a Yape y prometen reembolsos", url: "https://infomercado.pe/fraude-digital-en-peru-correos-falsos-suplantan-a-yape-y-prometen-reembolsos-para-robar-datos/" }],
    detectable: true,
    match: (c) => (has(c, "premio_reembolso") ? 6 + (c.hasUrl ? 1 : 0) : 0),
  },
  {
    id: "cuenta-bloqueada",
    name: "\"Tu cuenta ha sido bloqueada\"",
    hook: "Un SMS o correo, a nombre de tu banco o billetera, dice que bloquearon tu cuenta por actividad sospechosa.",
    how: [
      "El mensaje te asusta y te da un enlace o un teléfono para \"solucionarlo\".",
      "La página o el falso asesor te piden usuario, clave y el código que te llega por SMS.",
      "Ese código es el que autoriza las transferencias con las que vacían la cuenta.",
    ],
    todo: [
      "Abre tú la app del banco: si la cuenta funciona, el mensaje era falso.",
      "No llames al número del mensaje. Usa el del reverso de tu tarjeta.",
      "Si diste datos, pide el bloqueo al banco en ese momento.",
    ],
    sources: [{ title: "América TV: las estafas más comunes con Yape y cómo evitarlas", url: "https://www.americatv.com.pe/noticias/amp/util-e-interesante/cuales-son-estafas-mas-comunes-yape-y-como-evitarlas-n520592" }],
    detectable: true,
    match: (c) => (has(c, "amenaza_bloqueo", "amenaza_actividad") && (c.kinds.has("banco") || c.kinds.has("billetera") || c.hasUrl) ? 6 : 0),
  },
  {
    id: "yape-por-error",
    name: "El yapeo \"por error\" o con comprobante falso",
    hook: "Alguien dice que te yapeó de más o por equivocación y te pide devolver la diferencia.",
    how: [
      "Te manda una captura de un comprobante que parece real. Hay apps que las fabrican.",
      "Insiste en que la notificación \"está demorando\" para que no revises tu saldo.",
      "Si devuelves, esa plata sí sale de tu cuenta: la suya nunca llegó.",
    ],
    todo: [
      "Mira tu saldo y tus movimientos dentro de la app, no la captura.",
      "Si el dinero no aparece, no devuelvas nada.",
      "Si de verdad llegó plata por error, pídele que lo gestione con su banco.",
    ],
    sources: [{ title: "Perú Retail: cómo funciona la modalidad del \"falso Yape\"", url: "https://www.peru-retail.com/cuidado-con-el-falso-yape-como-funciona-esta-nueva-modalidad-de-estafa-a-comerciantes/" }],
    detectable: true,
    match: (c) => (has(c, "devolucion_por_error") ? 9 : 0),
  },
  {
    id: "familiar-numero-nuevo",
    name: "\"Hola, cambié de número\"",
    hook: "Un número desconocido se presenta como tu hijo, tu mamá o tu jefe y al rato pide una transferencia.",
    how: [
      "Empieza pidiéndote que guardes el número nuevo. A veces usa la foto real de la persona.",
      "Después aparece una urgencia: una deuda, una compra, un accidente.",
      "Pide que yapees o transfieras a una cuenta de un tercero y promete devolverlo pronto.",
    ],
    todo: [
      "Llama al número de siempre de esa persona antes de hacer nada.",
      "Hazle una pregunta que solo ella sabría responder.",
      "No transfieras a cuentas a nombre de desconocidos.",
    ],
    sources: [{ title: "El Tiempo: si recibes este mensaje en WhatsApp, podría ser una estafa", url: "https://eltiempo.pe/uncategorized/si-recibes-este-mensaje-en-whatsapp-no-respondas-podria-ser-una-estafa/" }],
    detectable: true,
    match: (c) => (has(c, "numero_nuevo") ? (has(c, "pide_plata") ? 9 : 5) : 0),
  },
  {
    id: "empleo-falso",
    name: "El trabajo de dar likes",
    hook: "Te ofrecen por WhatsApp un trabajo desde casa con pago diario, a nombre de una empresa conocida.",
    how: [
      "Las primeras \"tareas\" sí te las pagan, con montos chicos, para que confíes.",
      "Luego te piden recargar o \"invertir\" para desbloquear tareas mejor pagadas.",
      "Cuando quieres retirar, aparecen comisiones nuevas. La plata no vuelve.",
    ],
    todo: [
      "No respondas ni entres a los grupos de Telegram que te mandan.",
      "Ningún trabajo real te cobra por empezar.",
      "Bloquea y reporta el número en WhatsApp.",
    ],
    sources: [{ title: "ESET: falsas ofertas de empleo por WhatsApp en Latinoamérica", url: "https://dinero.com.sv/?p=40691" }],
    detectable: true,
    match: (c) => {
      const n = ["empleo_oferta", "empleo_pago", "empleo_tareas"].filter((i) => c.ids.has(i)).length;
      return n >= 2 ? 8 : n === 1 && has(c, "numero_extranjero", "llamar_numero", "premio_dinero_facil") ? 5 : 0;
    },
  },
  {
    id: "paquete-retenido",
    name: "El paquete que no pudieron entregar",
    hook: "Un SMS a nombre de un courier dice que tu paquete está retenido y que actualices tu dirección o pagues una tasa.",
    how: [
      "Llega aunque no hayas pedido nada: se envía en masa.",
      "El enlace pide tus datos y un pago pequeño con tarjeta \"para reprogramar la entrega\".",
      "El cobro pequeño es la excusa: lo que buscan son los datos de la tarjeta.",
    ],
    todo: [
      "Si esperas un envío, revisa el seguimiento en la web del courier con tu código.",
      "No pagues tasas desde un enlace recibido por mensaje.",
    ],
    sources: [],
    detectable: true,
    match: (c) => (has(c, "paquete") && (c.hasUrl || has(c, "pago_previo") || c.kinds.has("courier")) ? 7 : 0),
  },
  {
    id: "entidad-publica",
    name: "La multa o la devolución a nombre del Estado",
    hook: "Un mensaje a nombre de SUNAT, el SAT u otra entidad anuncia una multa, una deuda o una devolución con un enlace.",
    how: [
      "Usa el miedo a una sanción o la ilusión de una devolución de impuestos.",
      "El enlace no termina en gob.pe, aunque lleve el nombre de la entidad.",
      "La página pide Clave SOL, datos de tarjeta o un pago inmediato.",
    ],
    todo: [
      "Las notificaciones de SUNAT llegan a tu Buzón Electrónico, dentro de sunat.gob.pe.",
      "Comprueba cualquier deuda entrando tú a la página oficial.",
    ],
    sources: [],
    detectable: true,
    match: (c) => (c.kinds.has("estado") && has(c, "amenaza_legal", "premio_reembolso", "pide_datos", "amenaza_bloqueo") ? 6 : 0),
  },
  {
    id: "inversion-garantizada",
    name: "La inversión que siempre gana",
    hook: "Te invitan a un grupo o plataforma que promete un porcentaje fijo de ganancia diaria o semanal.",
    how: [
      "Te muestran capturas de ganancias de otros \"inversionistas\".",
      "Al inicio la plataforma marca ganancias y hasta te deja retirar un poco.",
      "Cuando pones más dinero, el retiro se bloquea o la plataforma desaparece.",
    ],
    todo: [
      "Desconfía de cualquier ganancia garantizada.",
      "Revisa si la empresa está autorizada por la SBS o la SMV antes de poner plata.",
    ],
    sources: [],
    detectable: true,
    match: (c) => (has(c, "inversion") ? 7 : 0),
  },
  {
    id: "soporte-remoto",
    name: "El \"asesor\" que te pide instalar una app",
    hook: "Alguien que dice ser del banco o de soporte te pide instalar una app de acceso remoto o un archivo .apk.",
    how: [
      "Te convence de que hay un problema con tu cuenta o tu equipo.",
      "La app le deja ver y manejar tu pantalla.",
      "Mientras hablas con él, entra a tus apps de banco y aprueba operaciones.",
    ],
    todo: [
      "No instales nada que te pidan por llamada o mensaje.",
      "Si ya lo hiciste, apaga el internet del celular, desinstala la app y llama a tu banco.",
    ],
    sources: [],
    detectable: true,
    match: (c) => (has(c, "acceso_remoto") ? 8 : 0),
  },
  {
    id: "qrishing",
    name: "El QR cambiado (QRishing)",
    hook: "Un código QR pegado encima del original en un local, o enviado por mensaje, lleva el pago o tus datos a otra persona.",
    how: [
      "En comercios, pegan un QR propio sobre el del negocio y los pagos van a su cuenta.",
      "Por mensaje, el QR abre una página falsa igual que lo haría un enlace.",
    ],
    todo: [
      "Antes de pagar, lee el nombre del destinatario que muestra tu app.",
      "Si un QR te abre una página que pide claves, ciérrala.",
    ],
    sources: [{ title: "Infobae: QRishing, la estafa con códigos QR fraudulentos", url: "https://www.infobae.com/peru/2025/08/12/qrishing-la-nueva-estafa-a-traves-de-codigos-qr-fraudulentos-como-identificarlos-y-evitar-caer-en-este-tipo-de-enganos/" }],
    detectable: false,
    match: () => 0,
  },
];

function strip(e: Entry): Campaign {
  const { match: _match, ...rest } = e;
  return rest;
}

export const CAMPAIGNS: Campaign[] = ENTRIES.map(strip);

export function matchCampaign(findings: Finding[], brands: Brand[], text: string, hasUrl: boolean): Campaign | null {
  const ctx: Ctx = {
    ids: new Set(findings.map((f) => f.id)),
    brands: new Set(brands.map((b) => b.id)),
    kinds: new Set(brands.map((b) => b.kind)),
    text,
    hasUrl,
  };
  let best: Entry | null = null;
  let top = 0;
  for (const e of ENTRIES) {
    const s = e.match(ctx);
    if (s > top) {
      top = s;
      best = e;
    }
  }
  return best ? strip(best) : null;
}
