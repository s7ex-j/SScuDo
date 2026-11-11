import type { Category } from "./types";

// Señales de texto. Los patrones se aplican sobre el mensaje normalizado
// (minúsculas, sin tildes, sin "prem1o"). Cada señal cuenta una sola vez
// aunque aparezca varias.
//
// Para agregar una: docs/AGREGAR_SENAL.md. Regla de oro: una señal nueva
// tiene que venir con un mensaje de estafa que la dispare y un mensaje
// normal que NO la dispare, los dos en tests/dataset.ts.

export interface TextSignal {
  id: string;
  category: Category;
  weight: number;
  title: string;
  detail: string;
  patterns: RegExp[];
}

const g = (src: string) => new RegExp(src, "g");

export const SIGNALS: TextSignal[] = [
  // ───────── Urgencia
  {
    id: "urgencia",
    category: "urgencia",
    weight: 10,
    title: "Te apura",
    detail: "Poner un plazo corto es la forma de que actúes sin verificar. Un trámite real no se vence en dos horas por mensaje.",
    patterns: [
      g(String.raw`\burgente(mente)?\b`),
      g(String.raw`\bde inmediato\b|\binmediatamente\b|\bahora mismo\b|\ba la brevedad\b`),
      g(String.raw`\bultim[oa]s? (aviso|oportunidad|dia|horas|llamado|notificacion)\b`),
      g(String.raw`\b(hoy|manana) (vence|caduca|expira|es el ultimo dia)\b`),
      g(String.raw`\b(vence|caduca|expira|valido solo|solo) (hoy|en \d{1,2} ?(horas|hrs|h|minutos|min))\b`),
      g(String.raw`\b(en|dentro de) (las proximas |los proximos )?\d{1,2} ?(horas|hrs|minutos|min)\b`),
      g(String.raw`\bsolo por hoy\b|\bno ignores este\b|\bantes de que sea tarde\b|\bcupos limitados\b`),
    ],
  },

  // ───────── Amenazas
  {
    id: "amenaza_bloqueo",
    category: "amenaza",
    weight: 20,
    title: "Dice que tu cuenta se bloqueó o se va a bloquear",
    detail: "Es el gancho más usado contra clientes de bancos y billeteras. Si fuera cierto, lo verías al entrar tú mismo a la app.",
    patterns: [
      g(String.raw`\b(cuenta|tarjeta|linea|acceso|yape|plin|banca|usuario|perfil|app|aplicativo|clave|whatsapp)\b[^.\n]{0,45}\b(bloquead[oa]|suspendid[oa]|restringid[oa]|inhabilitad[oa]|desactivad[oa]|cancelad[oa]|eliminad[oa]|dada de baja)\b`),
      g(String.raw`\b(sera|seran|fue|ha sido|han sido|quedara|se procedera a|procederemos a) (el )?(bloque|suspen|restrin|desactiv|cancel|inhabilit|elimin)[a-z]+\b`),
      g(String.raw`\b(evit[ae]|para evitar) (el|la|que se) (bloque|suspen|cierre|cancel|desactiv)[a-z]*\b`),
    ],
  },
  {
    id: "amenaza_actividad",
    category: "amenaza",
    weight: 16,
    title: "Habla de actividad sospechosa o un acceso extraño",
    detail: "Busca asustarte para que sigas sus pasos. Los avisos reales no te piden resolverlo desde un enlace del mismo mensaje.",
    patterns: [
      g(String.raw`\b(actividad|operacion|transaccion|movimiento|compra|consumo|cargo)(es)? (sospechos[oa]|inusual|irregular|no reconocid[oa]|no autorizad[oa]|fraudulent[oa])s?\b`),
      g(String.raw`\b(acceso|inicio de sesion|ingreso|intento de ingreso|dispositivo|equipo) (no (autorizado|reconocido)|desconocido|sospechoso|nuevo)\b`),
      g(String.raw`\bsi no (fuiste tu|fue usted|reconoces|reconoce|realizaste|realizo|autorizaste)\b`),
      g(String.raw`\b(detectamos|hemos detectado|se detecto|se ha detectado|registramos)\b[^.\n]{0,60}\b(intento|acceso|actividad|compra|consumo|cargo|transferencia|inicio de sesion)\b`),
    ],
  },
  {
    id: "amenaza_legal",
    category: "amenaza",
    weight: 16,
    title: "Amenaza con una multa, deuda o proceso",
    detail: "SUNAT, la Policía o el Poder Judicial no notifican multas ni denuncias por WhatsApp o SMS con un enlace para pagar.",
    patterns: [
      g(String.raw`\b(multa|papeleta|deuda|infraccion|sancion|orden de pago)s? (pendiente|vencida|electronica|impaga|por pagar|de transito|tributaria|registrada)s?\b`),
      g(String.raw`\b(tiene|tienes|registra|registras|presenta) (una |un )?(multa|papeleta|deuda|infraccion|denuncia|proceso|orden de captura)\b`),
      g(String.raw`\b(embargo|cobranza coactiva|proceso judicial|orden de captura|denuncia en (tu|su) contra|sera denunciad[oa]|acciones legales)\b`),
    ],
  },

  // ───────── Premios y dinero prometido
  {
    id: "premio_bono",
    category: "premio",
    weight: 20,
    title: "Promete un bono",
    detail: "Los bonos del Estado se anuncian en gob.pe y en medios oficiales, no con un enlace que te llega por mensaje. Yape no reparte bonos.",
    patterns: [
      g(String.raw`\bbono\b[^.\n]{0,40}\b(de |por )?(s\/|s\/\.|soles|\d{2,4})\b`),
      g(String.raw`\bbono (yape|plin|bcp|familiar|universal|extraordinario|navideno|del estado|estatal|de apoyo|independiente|alimentario|\d{2,4})\b`),
      g(String.raw`\b(cobra|cobrar|reclama|reclamar|recibe|recibir|activa|activar|consulta|consultar|accede a) (tu|su|el|al|si te toca el) bono\b`),
      g(String.raw`\b(beneficiari[oa]s?|acceder|accedes|aplicas|calificas) (del?|al|para el) (nuevo )?bono\b`),
    ],
  },
  {
    id: "premio_sorteo",
    category: "premio",
    weight: 20,
    title: "Dice que ganaste algo",
    detail: "Nadie gana un sorteo en el que no participó. El siguiente paso suele ser pedirte datos o un pago para \"liberar\" el premio.",
    patterns: [
      g(String.raw`\b(ganaste|has ganado|ha ganado|usted gano|eres (el|la|un[oa] de l[oa]s) ganador(a|es|as)?|ganador(a)? de|result[oa] ganador(a)?)\b`),
      g(String.raw`\b(fuiste|has sido|ha sido|fue|saliste) (seleccionad|elegid|sortead|favorecid)[oa]\b`),
      g(String.raw`\b(estamos|esta|estan) (regalando|sorteando|obsequiando)\b|\b(te regala|te regalamos|regalo de) (s\/|\d|un|una)\b`),
      g(String.raw`\b(reclama|reclamar|retira|retirar|recoge|cobra|cobrar|canjea) (tu|su|el) (premio|regalo|obsequio|recompensa)\b`),
      g(String.raw`\b(premio|sorteo|rifa)\b[^.\n]{0,50}\b(s\/|soles|iphone|celular|moto|auto|viaje|canasta|gift ?card)\b`),
      g(String.raw`\b(iphone|celular|recarga|megas|pasajes?|canasta|gift ?card)s? (totalmente )?gratis\b|\bgratis\b[^.\n]{0,25}\b(iphone|recarga|megas|pasajes?|canasta)\b`),
    ],
  },
  {
    id: "premio_reembolso",
    category: "premio",
    weight: 18,
    title: "Ofrece un reembolso o saldo a tu favor",
    detail: "Ni Yape ni los bancos hacen reembolsos automáticos por enlace, y SUNAT devuelve impuestos solo por su plataforma, con tu Clave SOL.",
    patterns: [
      g(String.raw`\b(reembolso|devolucion|reintegro|abono|saldo|deposito)s? (pendiente|disponible|aprobad[oa]|a (tu|su) favor|por cobrar|sin cobrar|retenid[oa])\b`),
      g(String.raw`\b(tienes|tiene|cuentas con|cuenta con) (un |una )?(reembolso|devolucion|reintegro|saldo a favor|dinero (pendiente|sin cobrar|por cobrar))\b`),
      g(String.raw`\b(devolucion|reembolso) de (impuestos|dinero|tu dinero|su dinero|aportes|comisiones|s\/)\b`),
    ],
  },
  {
    id: "premio_dinero_facil",
    category: "premio",
    weight: 16,
    title: "Promete plata fácil",
    detail: "Si de verdad fuera fácil y sin riesgo, no te lo ofrecería un desconocido por mensaje.",
    patterns: [
      g(String.raw`\b(gana|ganar|genera|generar|consigue|obten) (dinero|ingresos|plata|soles|dolares)( extra| adicionales?)? ?(facil|rapido|desde (casa|tu celular)|sin (salir|invertir|experiencia)|en (minutos|pocos dias))?\b`),
      g(String.raw`\bingresos? (extra|adicional|pasivo)s?\b`),
    ],
  },

  // ───────── Petición de datos
  {
    id: "pide_datos",
    category: "datos",
    weight: 24,
    title: "Pide claves, códigos o datos de tu tarjeta",
    detail: "Ningún banco, billetera ni entidad pública te pide por mensaje tu clave, el código que te llega por SMS, el CVV ni los datos de tu tarjeta.",
    patterns: [
      g(String.raw`\b(ingresa|ingrese|ingresar|digita|digite|coloca|coloque|confirma|confirme|confirmar|valida|valide|validar|verifica|verifique|verificar|actualiza|actualice|actualizar|completa|complete|proporciona|proporcione|brinda|brinde|envia|envie|enviar|enviame|envianos|pasame|pasanos|dame|danos|dicta|dictame|indica|indique|indicame|registra|registre|comparte|comparteme)\b[^.\n]{0,55}\b(clave|contrasena|password|codigo|token|cvv|cvc|pin|dni|numero de (tu |su )?tarjeta|datos|fecha de (vencimiento|caducidad)|usuario y)\b`),
      g(String.raw`\b(clave|codigo|token)( de)? (dinamic[oa]|digital|sms|de 6 digitos|de seis digitos|de 4 digitos|de verificacion|de seguridad|de confirmacion|de internet|secreta)\b[^.\n]{0,60}\b(envia|envie|pasa|pasame|comparte|reenvia|dime|digame|dicta|indica|ingresa|ingrese)\w*`),
    ],
  },
  {
    id: "consulta_dni",
    category: "datos",
    weight: 10,
    title: "Te pide tu DNI para \"consultar\"",
    detail: "Con tu DNI y tu celular ya pueden intentar suplantarte. Las consultas reales se hacen en páginas gob.pe.",
    patterns: [g(String.raw`\b(consulta|consulte|verifica|verifique|revisa|revise|registrate|registrese|ingresa|ingrese)\b[^.\n]{0,40}\bcon (tu|su|el) (numero de )?dni\b`)],
  },
  {
    id: "codigo_por_error",
    category: "datos",
    weight: 60,
    title: "Te pide un código que te llegó a ti",
    detail: "Ese código es la llave de tu WhatsApp o de tu cuenta. Quien te lo pide, aunque sea un contacto conocido, está intentando entrar. No se comparte nunca.",
    patterns: [
      g(String.raw`\b(te|le) (envie|mande|enviaron|llego|llegara|va a llegar|acaba de llegar|debe llegar|llegaria)\b[^.\n]{0,45}\bcodigo\b`),
      g(String.raw`\bcodigo\b[^\n]{0,70}\b(por error|por equivocacion|me lo (pasas|envias|reenvias|mandas|dices|puedes)|pasamelo|reenviamelo|mandamelo|enviamelo)\b`),
      g(String.raw`\b(pasame|reenviame|mandame|enviame|dime|dictame) (el|ese|un|los) (codigo|numeros|digitos)\b`),
      g(String.raw`\bpor error\b[^.\n]{0,50}\bcodigo\b`),
      g(String.raw`\b(te|le) (llegara|va a llegar|llego|acaba de llegar|envie|enviaremos|enviamos|estamos enviando)\b[^.\n]{0,45}\b(codigo|clave|token)\b[^\n]{0,60}\b(dictamel[ao]|pasamel[ao]|dimel[ao]|digamel[ao]|indicamel[ao]|indiquemel[ao]|brindamel[ao]|compartel[ao]|reenvial[ao]|enviamel[ao])\b`),
    ],
  },

  // ───────── Dinero
  {
    id: "pago_previo",
    category: "dinero",
    weight: 24,
    title: "Pide un pago para recibir algo",
    detail: "Pagar una \"tasa\", \"comisión\" o \"costo de envío\" para cobrar un premio, un préstamo o un paquete es el corazón del engaño: el premio no existe.",
    patterns: [
      g(String.raw`\b(deposita|deposite|depositar|transfiere|transfiera|transferir|yapea|yapee|yapear|plinea|abona|abone|abonar|paga|pague|pagar|cancela|cancele|cancelar|pagando|depositando|abonando|cancelando|realiza el pago|realice el pago)\b[^.\n]{0,60}\b(para (liberar|recibir|activar|desbloquear|procesar|continuar|reprogramar|la entrega|el envio|el desembolso|tu retiro|su retiro)|costo de (envio|tramite|gestion|activacion)|tasa|comision|impuesto|arancel|garantia|seguro|gastos (administrativos|de envio|notariales))\b`),
      g(String.raw`\bpago (adelantado|previo|por adelantado|anticipado|unico de activacion)\b|\b(costo|tasa|pago) de (activacion|liberacion|desbloqueo|reprogramacion)\b`),
      g(String.raw`\b(prestamo|credito) (aprobado|preaprobado|inmediato|sin (aval|requisitos|infocorp))\b`),
      g(String.raw`\b(falta|debe|debes|tiene que|tienes que|solo queda) (pagar|abonar|cancelar)\b[^\n]{0,35}\b(aduanas?|tasa|impuesto|envio|arancel|comision|liberacion)\b`),
    ],
  },
  {
    id: "pide_plata",
    category: "dinero",
    weight: 15,
    title: "Pide que le mandes plata",
    detail: "Antes de enviar dinero a alguien que te escribe, llámalo. Una llamada al número de siempre desarma casi todas estas estafas.",
    patterns: [
      g(String.raw`\b(prestame|me prestas|me puedes prestar|me podrias prestar|me haces un prestamo)\b`),
      g(String.raw`\b(me (puedes|podrias|haces el favor de)|puedes|podrias|necesito que me|ayudame a) (yapear|yapees|plinear|depositar|deposites|transferir|transfieras|enviar|envies|girar|mandar)\b`),
      g(String.raw`\b(yapeame|plineame|depositame|transfiereme|girame)\b`),
      g(String.raw`\b(mandame|enviame|pasame|hazme|deposita|yapea|transfiere)\b[^.\n]{0,25}\b(s\/ ?)?\d{2,5}\b[^.\n]{0,20}\b(por yape|por plin|soles|lucas|al yape|a este numero|a esta cuenta)\b`),
      g(String.raw`\b(te (lo )?devuelvo|te pago|te lo repongo) (manana|el lunes|el viernes|en la tarde|mas tarde|apenas|cuando|a fin de mes)\b`),
    ],
  },
  {
    id: "devolucion_por_error",
    category: "dinero",
    weight: 34,
    title: "Dice que te envió plata por error y quiere que la devuelvas",
    detail: "El comprobante que te muestra puede ser falso. Revisa el saldo en tu app, no en una captura. Si de verdad hubo un error, lo resuelve el banco.",
    patterns: [
      g(String.raw`\b(yapee|plinee|deposite|transferi|abone|te (envie|mande) (plata|dinero|un (yape|plin|deposito)|\d+)|te hice un (yape|plin|deposito))\b[^.\n]{0,45}\b(por error|de mas|equivocad[oa]|por equivocacion|a (tu|este) numero sin querer)\b`),
      g(String.raw`\b(por error|me equivoque)\b[^.\n]{0,60}\b(yape|plin|deposit|transfer)\w*`),
      g(String.raw`\b(yapee|plinee|deposite|transferi|envie|mande|abone)\b[^.\n]{0,45}\b(me equivoque|numero equivocado|cuenta equivocada)\b`),
      g(String.raw`\b(devuelveme|devuelvame|me (devuelves|devuelve|regresas|puedes devolver|podrias devolver)|regresame|regreseme|reenviame|reembolseme)\b[^.\n]{0,45}\b(yape|plin|deposito|transferencia|dinero|plata|diferencia|vuelto|monto|soles|s\/)\b`),
    ],
  },
  {
    id: "inversion",
    category: "dinero",
    weight: 24,
    title: "Ofrece una inversión con ganancia asegurada",
    detail: "Ninguna inversión real garantiza ganancias. Si promete un porcentaje fijo diario o semanal, es una pirámide o un robo directo.",
    patterns: [
      g(String.raw`\b(rentabilidad|ganancia|retorno|utilidad|interes)(es)? (garantizad|asegurad|fij[oa] del|diari[oa] del|del \d)\w*`),
      g(String.raw`\b(duplica|triplica|multiplica|haz crecer) (tu|su) (dinero|inversion|capital|plata)\b`),
      g(String.raw`\b\d{1,3} ?% (de (ganancia|rentabilidad|retorno|interes) )?(diario|semanal|mensual|al dia|a la semana|en \d+ (dias|horas))\b`),
      g(String.raw`\binvi(erte|ertes|rtiendo|ertiendo) (desde|solo|apenas|con solo)\b[^.\n]{0,20}\d`),
      g(String.raw`\b(trading|criptomonedas?|bitcoin|usdt|forex)\b[^.\n]{0,70}\b(grupo|senales|mentor|asesor|plataforma|ganancias?)\b`),
    ],
  },

  // ───────── Empleo falso
  {
    id: "empleo_oferta",
    category: "empleo",
    weight: 14,
    title: "Oferta de trabajo que nadie pidió",
    detail: "Las empresas no reclutan por mensajes masivos ni contratan sin entrevista.",
    patterns: [
      g(String.raw`\b(trabajo|empleo|chamba|puesto|vacante)s? (100% )?(desde (casa|tu celular|el celular)|remot[oa]|online|en linea|de medio tiempo|medio tiempo|part ?time|a tiempo parcial|por horas)\b`),
      g(String.raw`\b(recursos humanos|rr\.?hh\.?|reclutador(a)?|area de seleccion|equipo de contratacion)\b`),
      g(String.raw`\b(estamos|estoy) (contratando|buscando (personal|colaboradores|personas))\b|\b(se busca|buscamos) (personal|personas|colaboradores)\b`),
      g(String.raw`\b(tu|su) (cv|curriculum|perfil) (fue|ha sido) (seleccionado|aprobado|preseleccionado)\b`),
      g(String.raw`\bsolo necesitas (un|tu) (celular|telefono)\b`),
    ],
  },
  {
    id: "empleo_pago",
    category: "empleo",
    weight: 20,
    title: "Promete un pago diario alto por casi nada",
    detail: "Así empieza la estafa de las \"tareas\": primero te pagan montos pequeños para ganar tu confianza y después te piden recargar para seguir.",
    patterns: [
      g(String.raw`\b(gana|ganar|ganas|ganaras|sueldo|salario|pago|pagamos|ingresos?|comision(es)?)\b[^.\n]{0,30}(s\/\.?|\$|usd|soles) ?\d[\d.,]*[^.\n]{0,30}\b(diari[oa]s?|al dia|por dia|cada dia|semanal(es)?|por hora|por tarea|por cada)\b`),
      g(String.raw`(s\/\.?|\$|usd) ?\d[\d.,]* ?(-|a|hasta) ?(s\/\.?|\$)? ?\d[\d.,]* ?(soles |dolares )?(diari[oa]s?|al dia|por dia|por hora)\b`),
      g(String.raw`\bpago (diario|inmediato|el mismo dia|al instante)\b`),
      g(String.raw`\b\d{2,5} (soles|dolares|lucas) (diari[oa]s?|al dia|por dia|por hora|por video|por tarea|por cada)\b|\bcobras el mismo dia\b`),
    ],
  },
  {
    id: "empleo_tareas",
    category: "empleo",
    weight: 18,
    title: "El \"trabajo\" es dar likes, calificar o hacer tareas",
    detail: "Nadie paga sueldos por dar \"me gusta\". Es la fachada de la estafa de las tareas.",
    patterns: [
      g(String.raw`\b(dar|dando|da|dale) (likes?|me gusta)\b|\b(calificar|valorar|resenar|puntuar|evaluar) (hoteles|productos|videos|aplicaciones|apps|restaurantes|tiendas)\b`),
      g(String.raw`\b(seguir|suscribirte a) (cuentas|canales)\b|\b(tareas|misiones) (simples|sencillas|faciles|diarias)\b|\bcompletar tareas\b`),
    ],
  },

  // ───────── "Cambié de número"
  {
    id: "numero_nuevo",
    category: "contacto",
    weight: 18,
    title: "Dice que cambió de número",
    detail: "Es la entrada clásica para hacerse pasar por un familiar o un jefe. Llama al número anterior antes de creerle.",
    patterns: [
      g(String.raw`\b(cambie|cambio|he cambiado|estoy cambiando) de (numero|celular|chip|linea|telefono)\b`),
      g(String.raw`\b(este es|es|te escribo de|ahora es|sera) mi (nuevo |otro )?(numero|celular|whatsapp)( nuevo)?\b`),
      g(String.raw`\b(agenda|agendame|guarda|guardame|registra|anota) (este|mi) (nuevo )?(numero|celular|contacto)\b`),
      g(String.raw`\b(borra|elimina) (el|mi) (otro|anterior|antiguo) (numero|contacto)\b`),
      g(String.raw`\bse me (malogro|rompio|perdio|cayo|bloqueo)\b[^.\n]{0,25}\b(celular|telefono|chip)\b|\bme robaron el (celular|telefono)\b`),
      g(String.raw`\bperdi (mi|el) (celular|telefono|chip)\b[^.\n]{0,60}\b(este|otro) (numero|celular)\b|\b(numero|celular|telefono) prestado\b`),
      g(String.raw`\bsoy tu (mama|papa|hij[oa]|herman[oa]|ti[oa]|abuel[oa]|prim[oa]|jefe|jefa)\b`),
    ],
  },

  // ───────── Paquetes
  {
    id: "paquete",
    category: "amenaza",
    weight: 14,
    title: "Dice que tienes un paquete retenido",
    detail: "Si esperas un envío, revisa el seguimiento en la página de la empresa con tu código, no en el enlace del mensaje.",
    patterns: [
      g(String.raw`\b(paquete|envio|encomienda|pedido|orden|compra)\b[^.\n]{0,70}\b(no (pudo|ha podido|se pudo|fue posible) (ser entregad|entregar)|retenid[oa]|en aduanas?|en espera|en el almacen|pendiente de (entrega|pago|confirmacion)|direccion (incorrecta|incompleta|erronea)|datos incompletos)\b`),
      g(String.raw`\b(paquete|envio|encomienda|pedido)\b[^\n]{0,90}\b(sera devuelto|sera retornado|se devolvera|sera destruido)\b`),
      g(String.raw`\b(reprograma|reprograme|reprogramar|actualiza|actualice|confirma|confirme)\b[^.\n]{0,30}\b(la entrega|tu entrega|su entrega|la direccion|tu direccion|su direccion|el envio)\b`),
    ],
  },

  // ───────── Instalar o dar acceso
  {
    id: "acceso_remoto",
    category: "instalacion",
    weight: 30,
    title: "Pide instalar una app o dar acceso a tu equipo",
    detail: "Con AnyDesk, TeamViewer o un .apk de fuera de la tienda, la otra persona controla tu celular y entra a tus apps de banco.",
    patterns: [
      g(String.raw`\b(anydesk|teamviewer|rustdesk|quicksupport|airdroid|acceso remoto|compartir pantalla|comparte (tu|su) pantalla)\b`),
      g(String.raw`\.apk\b`),
      g(String.raw`\b(descarga|descargue|instala|instale|actualiza|actualice)\b[^.\n]{0,35}\b(aplicacion|app|aplicativo|nueva version|certificado|complemento)\b[^.\n]{0,45}\b(enlace|link|aqui|siguiente|adjunt[oa])\b`),
    ],
  },

  // ───────── Señales débiles
  {
    id: "saludo_generico",
    category: "suplantacion",
    weight: 5,
    title: "No te llama por tu nombre",
    detail: "\"Estimado cliente\" sirve para mandarle lo mismo a miles de personas. Tu banco sabe cómo te llamas.",
    patterns: [g(String.raw`\bestimad[oa] (cliente|usuari[oa]|contribuyente|titular|afiliad[oa]|beneficiari[oa]|ciudadan[oa])\b`)],
  },
  {
    id: "empuja_al_enlace",
    category: "urgencia",
    weight: 8,
    title: "Te empuja a tocar el enlace",
    detail: "El mensaje entero existe para que entres a esa página.",
    patterns: [
      g(String.raw`\b(ingresa|ingrese|entra|entre|haz clic|haga clic|dale clic|click|pulsa|pulse|presiona|presione|accede|acceda|abre|abra|consulta|consulte|verifica|verifique|registrate|registrese|inscribete|toca|toque)\b[^.\n]{0,30}\b(aqui|al (siguiente )?(enlace|link)|en el (siguiente )?(enlace|link)|este (enlace|link)|el (enlace|link)|a continuacion)\b`),
      g(String.raw`\b(link|enlace) (de|para) (consulta|registro|cobro|verificacion|pago|activacion)\b`),
    ],
  },
  {
    id: "llamar_numero",
    category: "urgencia",
    weight: 10,
    title: "Te pide llamar o escribir a un número",
    detail: "El número del mensaje lo pone quien lo escribió. Usa el que está en tu tarjeta o en la app oficial.",
    patterns: [
      g(String.raw`\b(llama|llame|llamanos|comunicate|comuniquese|marca|marque|contactanos|contactenos)\b[^.\n]{0,35}\b(al|a este numero|al numero|a la linea|al telefono)\b`),
      g(String.raw`\b(escribenos|escribeme|escribanos|contactanos|contactame|mas informacion|info|informes)\b[^.\n]{0,25}\b(al whatsapp|por whatsapp|a este whatsapp|al telegram|por telegram|al wsp|por wsp)\b`),
    ],
  },
  {
    id: "numero_extranjero",
    category: "contacto",
    weight: 8,
    title: "El número de contacto no es del Perú",
    detail: "Los números peruanos empiezan con +51. Las redes de empleos falsos suelen escribir desde otros países.",
    patterns: [/\+(?!51\b)(?!51\d)\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{2,4}/g],
  },
  {
    id: "cadena",
    category: "urgencia",
    weight: 14,
    title: "Te pide reenviarlo a tus contactos",
    detail: "Así la estafa se reparte sola y llega con la confianza de quien la reenvía. Ninguna promoción real exige compartirla para cobrar.",
    patterns: [g(String.raw`\b(compart[ea](lo)?|reenvia(lo)?|envia(lo)?|pasa(lo)?) (con|a) (\d+|tus|todos tus) (contactos|amigos|grupos|personas)\b`)],
  },
  {
    id: "secreto",
    category: "urgencia",
    weight: 12,
    title: "Te pide no contarle a nadie",
    detail: "Aislarte es parte del método: cualquier persona a la que le cuentes te diría que es una estafa.",
    patterns: [g(String.raw`\bno (le )?(digas|cuentes|comentes|avises) (a nadie|nada a nadie|a tu (familia|esposo|esposa|mama|papa))\b|\b(que quede|mantenlo|esto es) (entre nosotros|en secreto|confidencial)\b`)],
  },
];
