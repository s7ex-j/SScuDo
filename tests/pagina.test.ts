import { describe, expect, it } from "vitest";
import { analyzePage } from "../src/engine";

describe("análisis de página (extensión)", () => {
  it("reconoce un dominio oficial", () => {
    const r = analyzePage({ url: "https://www.viabcp.com/personas?x=1", title: "BCP", hasPassword: true });
    expect(r.level).toBe("oficial");
    expect(r.brand?.id).toBe("bcp");
  });
  it("marca la imitación en el dominio", () => {
    const r = analyzePage({ url: "https://viabcp.com.seguridad-clientes.online/login" });
    expect(r.level).toBe("alto");
    expect(r.url?.registrable).toBe("seguridad-clientes.online");
  });
  it("marca una página ajena que pide clave a nombre de un banco", () => {
    const r = analyzePage({ url: "https://acceso-clientes.top/ingreso", title: "Interbank | Banca por Internet", hasPassword: true });
    expect(r.level).toBe("alto");
  });
  it("no marca una noticia que solo menciona al banco", () => {
    const r = analyzePage({ url: "https://elcomercio.pe/economia/bcp-anuncia", title: "BCP anuncia nuevas agencias", hasPassword: false });
    expect(r.level).toBe("sin_senales");
  });
  it("no marca sitios comunes", () => {
    for (const url of ["https://www.google.com/search?q=yape", "https://github.com/login", "https://www.wikipedia.org/"]) {
      expect(analyzePage({ url, title: "x", hasPassword: true }).level, url).toBe("sin_senales");
    }
  });
  it("ignora páginas internas y locales", () => {
    expect(analyzePage({ url: "chrome://extensions" }).level).toBe("no_aplica");
    expect(analyzePage({ url: "http://localhost:5173/" }).level).toBe("no_aplica");
    expect(analyzePage({ url: "http://192.168.1.1/" }).level).toBe("no_aplica");
  });
  it("no usa la consulta de la URL (puede traer otras direcciones)", () => {
    const r = analyzePage({ url: "https://www.google.com/url?q=https://bono-yape.top" });
    expect(r.level).toBe("sin_senales");
  });
});
