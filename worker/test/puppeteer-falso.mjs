// En las pruebas no hay navegador de Cloudflare: este reemplazo falla siempre.
export default { launch: async () => { throw new Error("sin navegador en pruebas"); } };
