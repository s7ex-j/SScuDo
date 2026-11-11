import { describe, expect, it } from "vitest";
import { analyze } from "../src/engine";
import { extractUrls } from "../src/engine/urls";

// Direcciones reales que las propias entidades (o el Estado) publican.
// Si alguna deja de reconocerse, un enlace legítimo se marcaría como imitación.
const OFICIALES: [string, string][] = [
  ["https://www.viabcp.com/", "bcp"],
  ["https://www.yape.com.pe/", "yape"],
  ["https://www.plin.pe/", "plin"],
  ["https://interbank.pe/", "interbank"],
  ["https://www.interbank.com.pe/pago-automatico-cargos-cuenta-clientes", "interbank"],
  ["https://www.mibanco.com.pe/", "mibanco"],
  ["https://www.bancofalabella.pe/", "falabella"],
  ["https://www.falabella.com.pe/falabella-pe", "falabella"],
  ["https://www.bancoripley.com.pe/tasas-tarifas-contratos.html", "ripley"],
  ["https://simple.ripley.com.pe/", "ripley"],
  ["https://www.bbva.pe/blog/", "bbva"],
  ["https://bbva.com.pe/content/x.pdf", "bbva"],
  ["https://www.scotiabank.com.pe/", "scotiabank"],
  ["https://www.bn.com.pe/clientes/", "bn"],
  ["https://www.banbif.com.pe/", "banbif"],
  ["https://www.pichincha.pe/", "pichincha"],
  ["https://agenciadigital.afpintegra.pe/", "afp"],
  ["https://agenciavirtual.prima.com.pe/", "afp"],
  ["https://retiro.afphabitat.com.pe/", "afp"],
  ["https://enlinea.profuturo.com.pe/agenciavirtual", "afp"],
  ["https://www.asociacionafp.pe/", "afp"],
  ["https://www.solicitaretiroafp.pe/", "afp"],
  ["https://servicios.sbs.gob.pe/serviciosenlinea", "estado"],
  ["https://www.serpost.com.pe/Cliente/Home", "serpost"],
  ["https://www.olvacourier.com/", "olva"],
  ["https://www.dhl.com/pe-es/home.html", "dhl"],
  ["https://www.mercadolibre.com.pe/", "mercadolibre"],
  ["https://www.mercadopago.com.pe/developers/es/docs", "mercadolibre"],
  ["https://www.entel.pe/", "entel"],
  ["https://www.bitel.com.pe/", "bitel"],
];

describe("dominios oficiales comprobados", () => {
  it.each(OFICIALES)("%s se reconoce como oficial", (url, marca) => {
    const [u] = extractUrls(url);
    expect(u.official?.id).toBe(marca);
    expect(u.impersonates).toBeFalsy();
  });

  it("un aviso con el enlace oficial de retiro de AFP no se marca", () => {
    const r = analyze("AFP Habitat: registra tu solicitud de retiro en https://retiro.afphabitat.com.pe de lunes a viernes.");
    expect(r.level).not.toBe("alto");
  });

  it("la versión chilena de una AFP no cuenta como oficial peruana", () => {
    const [u] = extractUrls("https://www.afphabitat.cl/");
    expect(u.official).toBeFalsy();
  });
});
