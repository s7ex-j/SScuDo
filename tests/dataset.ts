// Mensajes de prueba.
//
// OJO: los de estafa NO son capturas reales. Están redactados por nosotros a
// partir de cómo la prensa y las autoridades describen cada campaña, y los
// dominios son inventados. Por eso las cifras de `npm run evaluar` miden si el
// motor hace lo que dice, no su acierto contra estafas reales.

import type { Level } from "../src/engine";

export interface Caso {
  id: string;
  texto: string;
  /** Para estafas: nivel mínimo aceptable. Para legítimos siempre es "sin_senales". */
  esperado: Level;
  campana?: string;
}

export const ESTAFAS: Caso[] = [
  { id: "bono-yape-1", esperado: "alto", campana: "falso-bono", texto: "¡Felicidades! Eres beneficiario del Bono Yape de S/350. Consulta con tu DNI aquí: https://bono-yape-2026.top/consulta" },
  { id: "bono-yape-2", esperado: "alto", campana: "falso-bono", texto: "BONO YAPE 28 y 29 de marzo 💰 Cobra tu bono de 500 soles hoy mismo, link de consulta 👉 yape-bonos.web.app" },
  { id: "bono-estado-1", esperado: "alto", campana: "falso-bono", texto: "Gobierno del Perú: ya puedes cobrar el Bono Familiar de S/ 760. Verifica si eres beneficiario con tu DNI en http://bonofamiliar-gobpe.info" },
  { id: "bono-leet", esperado: "alto", campana: "falso-bono", texto: "Felicidades!! G4naste el b0no y4pe de S/200, c0bra tu bono aqui bit.ly/3xYape" },
  { id: "bloqueo-bcp-1", esperado: "alto", campana: "cuenta-bloqueada", texto: "BCP: Tu cuenta ha sido bloqueada por actividad sospechosa. Verifica tus datos en https://viabcp-seguridad.com/login para evitar el bloqueo definitivo." },
  { id: "bloqueo-interbank", esperado: "alto", campana: "cuenta-bloqueada", texto: "Estimado cliente, Interbank ha detectado un acceso no autorizado. Su tarjeta será suspendida en 24 horas. Ingrese aquí: https://interbanck.pe.seguro-clientes.xyz" },
  { id: "bloqueo-yape", esperado: "alto", campana: "cuenta-bloqueada", texto: "Tu cuenta de Yape ha sido bloqueada por actividad sospechosa. Para solucionarlo ingresa al siguiente enlace: https://yape.com.pe.desbloqueo-cuenta.online" },
  { id: "bloqueo-bbva-llamada", esperado: "sospechoso", campana: "cuenta-bloqueada", texto: "BBVA: Su tarjeta será bloqueada hoy por un consumo no reconocido de S/ 1,850. Llame de inmediato al 01 555 0101 para anularlo." },
  { id: "bloqueo-scotia", esperado: "alto", campana: "cuenta-bloqueada", texto: "Scotiabank informa: detectamos un inicio de sesion desde un dispositivo nuevo. Si no fuiste tu, valida tu clave digital aqui http://scotiabank-pe.verificacion-segura.click" },
  { id: "bloqueo-ip", esperado: "alto", texto: "Su banca por internet fue suspendida. Reactive su acceso en http://185.203.11.7/bancaporinternet/" },
  { id: "reembolso-yape", esperado: "alto", campana: "reembolso-falso", texto: "Yape: tienes un reembolso pendiente de S/ 189.90. Para recibirlo ingresa el número de tu tarjeta, fecha de vencimiento y CVV en https://reembolsos-yape.site" },
  { id: "reembolso-sunat", esperado: "alto", texto: "SUNAT: Tiene una devolución de impuestos pendiente de S/ 842.00. Ingrese sus datos en http://sunat-devoluciones.info/pe para el abono." },
  { id: "multa-sunat", esperado: "alto", campana: "entidad-publica", texto: "SUNAT le informa que registra una deuda pendiente. Evite la cobranza coactiva regularizando hoy en https://sunaat-gob.pe.pagos-online.live" },
  { id: "papeleta", esperado: "alto", texto: "Usted tiene una papeleta pendiente de S/ 428. Pague hoy con 50% de descuento y evite el embargo: https://sat-lima-pagos.cfd/consulta" },
  { id: "codigo-wsp-1", esperado: "alto", campana: "codigo-whatsapp", texto: "Hola, te envié un código de 6 dígitos por SMS por error, ¿me lo pasas porfa? Es urgente" },
  { id: "codigo-wsp-2", esperado: "alto", campana: "codigo-whatsapp", texto: "Amiga disculpa, me equivoqué de número y te va a llegar un código, reenvíamelo por favor" },
  { id: "familiar-1", esperado: "alto", campana: "familiar-numero-nuevo", texto: "Hola mamá, cambié de número, agéndame. Se me malogró el celular. ¿Me puedes yapear 300 soles a este número? Mañana te devuelvo" },
  { id: "familiar-2", esperado: "alto", campana: "familiar-numero-nuevo", texto: "Hola pa, este es mi nuevo número, borra el anterior. Necesito que me deposites 800 soles urgente para pagar una cuenta, te lo devuelvo el viernes" },
  { id: "familiar-solo", esperado: "sin_senales", texto: "Hola tía, cambié de número, guarda este contacto." },
  { id: "yape-error-1", esperado: "sospechoso", campana: "yape-por-error", texto: "Amigo te yapeé 500 soles por error, era para otro número. ¿Me devuelves el yape por favor? Te mando la captura" },
  { id: "yape-error-2", esperado: "sospechoso", campana: "yape-por-error", texto: "Señora le deposité de más por equivocación, eran 50 y le mandé 500. Devuélvame la diferencia por Plin por favor, es urgente" },
  { id: "empleo-1", esperado: "alto", campana: "empleo-falso", texto: "Hola, somos de Recursos Humanos de Mercado Libre. Tenemos trabajo desde casa: gana S/ 300 diarios dando likes a productos. Escríbenos al WhatsApp +63 912 345 6789" },
  { id: "empleo-2", esperado: "sospechoso", campana: "empleo-falso", texto: "Empleo medio tiempo, solo necesitas tu celular. Pago diario de S/150 a S/500 por completar tareas simples. Info por Telegram" },
  { id: "empleo-3", esperado: "sospechoso", campana: "empleo-falso", texto: "Buscamos personal para calificar hoteles en línea. Gana hasta $80 por día, pago inmediato. Más información al WhatsApp +44 7700 900123" },
  { id: "paquete-1", esperado: "alto", campana: "paquete-retenido", texto: "Serpost: su paquete no pudo ser entregado por dirección incorrecta. Actualice su dirección aquí: https://serpost-pe.delivery-track.xyz" },
  { id: "paquete-2", esperado: "sospechoso", campana: "paquete-retenido", texto: "Su envío está retenido en aduanas. Pague la tasa de S/ 6.50 para liberar la entrega: https://entregas-pe.shop/pago" },
  { id: "paquete-dhl", esperado: "alto", campana: "paquete-retenido", texto: "DHL: Tu paquete está en espera por datos incompletos. Confirma la entrega en dhl-express.rastreo-envios.top" },
  { id: "afp-1", esperado: "alto", campana: "retiro-afp-cts", texto: "Retiro AFP 2026: registra tu solicitud de retiro de hasta 4 UIT hoy. Ingresa con tu DNI y clave en https://retiro-afp-peru.online" },
  { id: "afp-2", esperado: "alto", campana: "retiro-afp-cts", texto: "Tu AFP informa: su retiro de fondos fue aprobado. Valide sus datos bancarios para el abono en https://afp-integra.abonos-pe.xyz" },
  { id: "premio-1", esperado: "sospechoso", texto: "¡Ganaste! Tu número fue seleccionado en el sorteo de Claro Perú. Reclama tu premio de S/ 5,000 pagando el costo de envío de S/ 35." },
  { id: "premio-2", esperado: "alto", texto: "Felicitaciones, has sido seleccionado ganador de un iPhone 17. Reclama tu premio en https://sorteo-ripley.premios-peru.vip antes de que expire hoy" },
  { id: "inversion-1", esperado: "sospechoso", campana: "inversion-garantizada", texto: "Únete a nuestro grupo de trading. Rentabilidad garantizada del 8% diario, invierte desde 100 soles y duplica tu dinero en una semana." },
  { id: "inversion-2", esperado: "sospechoso", campana: "inversion-garantizada", texto: "Plataforma de criptomonedas con asesor personal. 15% semanal asegurado. Escríbeme al WhatsApp para más información" },
  { id: "remoto-1", esperado: "sospechoso", campana: "soporte-remoto", texto: "Soporte BCP: detectamos un intento de acceso. Para proteger tu cuenta instala AnyDesk y comparte el código con nuestro asesor." },
  { id: "remoto-apk", esperado: "alto", texto: "Actualiza tu app de Yape a la nueva versión desde este enlace: https://descargas-app.site/yape-v5.apk o tu cuenta será desactivada" },
  { id: "prestamo", esperado: "sospechoso", texto: "Préstamo aprobado de S/ 10,000 sin aval ni Infocorp. Solo deposita S/ 150 de seguro para el desembolso. Responde SI" },
  { id: "correo-gratis", esperado: "alto", texto: "De: soporte.interbank@gmail.com\nEstimado cliente, por seguridad actualice sus datos respondiendo este correo con su usuario y clave." },
  { id: "arroba", esperado: "alto", texto: "Verifica tu cuenta: https://www.viabcp.com@acceso-seguro.top/login" },
  { id: "netflix", esperado: "alto", texto: "Netflix: tu membresía fue suspendida por un problema con el pago. Actualiza tu tarjeta en https://netflix-pagos.cuenta-ayuda.live" },
  { id: "bn-bono", esperado: "alto", texto: "Banco de la Nación: tiene un abono pendiente del bono extraordinario. Active su cuenta DNI ingresando su clave en https://banconacion-cuentadni.online" },
];

export const LEGITIMOS: Caso[] = [
  { id: "otp-wsp", esperado: "sin_senales", texto: "Tu código de WhatsApp es 482-913. No lo compartas con nadie." },
  { id: "otp-banco", esperado: "sin_senales", texto: "BCP: Tu clave digital para la operación es 771204. No la compartas. Nunca te la pediremos por teléfono." },
  { id: "consumo", esperado: "sin_senales", texto: "BCP: Realizaste un consumo de S/ 45.90 en TAMBO con tu tarjeta Visa ***1234 el 10/11 a las 18:42." },
  { id: "yape-recibido", esperado: "sin_senales", texto: "Yape: Recibiste S/ 25.00 de Maria L. Código de seguridad 412." },
  { id: "consumo-alerta", esperado: "sin_senales", texto: "Interbank: compra por S/ 129.00 en SAGA FALABELLA con tu tarjeta terminada en 8841. Si no reconoces esta operación llámanos." },
  { id: "pedido", esperado: "sin_senales", texto: "Tu pedido de Falabella está en camino. Sigue tu envío en https://www.falabella.com.pe/falabella-pe/myaccount/orders" },
  { id: "olva", esperado: "sin_senales", texto: "Olva Courier: tu envío 001234567 llegará hoy entre las 2 y 6 pm." },
  { id: "sunat-buzon", esperado: "sin_senales", texto: "SUNAT: Tienes una notificación en tu Buzón Electrónico. Revísala ingresando a www.sunat.gob.pe con tu Clave SOL." },
  { id: "familia-1", esperado: "sin_senales", texto: "Hola ma, ya llegué a casa. Mañana te llamo temprano 😘" },
  { id: "familia-2", esperado: "sin_senales", texto: "Oye préstame 20 soles hasta el viernes pe" },
  { id: "familia-3", esperado: "sin_senales", texto: "Pa, ya pagué el recibo de luz. Te mando la captura en un rato." },
  { id: "amigos-yape", esperado: "sin_senales", texto: "Ya te yapeé lo de la pizza, eran 18 soles no?" },
  { id: "trabajo-1", esperado: "sin_senales", texto: "Reunión urgente mañana a las 9am, confirmen asistencia por favor." },
  { id: "trabajo-2", esperado: "sin_senales", texto: "Te paso el informe final. Revisa la sección 3.5 y me dices si falta algo antes de las 6." },
  { id: "video", esperado: "sin_senales", texto: "Mira este video jajaja https://youtu.be/dQw4w9WgXcQ" },
  { id: "repo", esperado: "sin_senales", texto: "Subí los cambios al repo: https://github.com/s7ex-j/theyso revisa el PR cuando puedas" },
  { id: "clases", esperado: "sin_senales", texto: "Chicos, el profe cambió la entrega para el lunes. El link del Zoom es https://zoom.us/j/1234567890" },
  { id: "delivery", esperado: "sin_senales", texto: "Su pedido de Rappi llegará en 15 minutos. El repartidor está en camino." },
  { id: "cita", esperado: "sin_senales", texto: "EsSalud: su cita en Medicina General es el 14/11 a las 10:20. Acérquese con su DNI 20 minutos antes." },
  { id: "claro-que-si", esperado: "sin_senales", texto: "Claro que sí, mañana te confirmo la hora. ¿Te parece a las 4?" },
  { id: "recarga", esperado: "sin_senales", texto: "Entel: tu recarga de S/ 10 fue exitosa. Saldo disponible S/ 12.40. Vigencia 30 días." },
  { id: "vacante-real", esperado: "sin_senales", texto: "Se busca personal para atención en tienda, turno tarde. Presentarse con CV en Av. Larco 345 de lunes a viernes." },
  { id: "premio-broma", esperado: "sin_senales", texto: "Jajaja te ganaste un premio por llegar tarde otra vez" },
  { id: "banco-nuevo-numero", esperado: "sin_senales", texto: "El lunes voy al Banco de la Nación a sacar mi tarjeta nueva, ¿me acompañas?" },
  { id: "noticia", esperado: "sin_senales", texto: "Mira esta nota sobre el bono: https://www.gob.pe/institucion/midis/noticias" },
  { id: "factura", esperado: "sin_senales", texto: "Buenas tardes, le adjunto la factura F001-234 por S/ 1,250.00. El pago es a 30 días. Saludos." },
  { id: "mercado", esperado: "sin_senales", texto: "Compré el regalo de mamá en Mercado Libre, llega el jueves." },
  { id: "decimales", esperado: "sin_senales", texto: "Saqué 17.5 en el examen y el promedio quedó en 15.25. Faltó poco." },
  { id: "plin", esperado: "sin_senales", texto: "¿Tienes Plin? Te mando lo del taxi." },
  { id: "bcp-oficial", esperado: "sin_senales", texto: "BCP: conoce los nuevos horarios de agencias en https://www.viabcp.com/canales-presenciales" },
];
