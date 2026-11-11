// Service worker de SScuDo.
// 1) Deja la app disponible sin conexión.
// 2) Recibe textos compartidos desde otras apps ("Compartir → SScuDo") sin que
//    salgan del dispositivo: el mensaje se guarda en la caché local y la app lo
//    lee al abrirse. Nunca viaja en la URL ni a un servidor.

const CACHE = "sscudo-v1";
const BUZON = "sscudo-compartido";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", "./manifest.webmanifest"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== BUZON).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.method === "POST" && url.pathname.endsWith("/compartir")) {
    e.respondWith(
      (async () => {
        const form = await req.formData();
        const partes = [form.get("title"), form.get("text"), form.get("url")].filter((x) => typeof x === "string" && x.trim());
        const buzon = await caches.open(BUZON);
        await buzon.put("./__mensaje", new Response(partes.join("\n")));
        return Response.redirect("./?compartido=1", 303);
      })(),
    );
    return;
  }
  if (req.method !== "GET") return;

  // Navegación: primero la red (para recibir versiones nuevas), caché si no hay.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put("./", copia));
          return res;
        })
        .catch(() => caches.match("./").then((r) => r || Response.error())),
    );
    return;
  }
  // Recursos: caché primero, y se refresca por detrás.
  e.respondWith(
    caches.match(req).then((hit) => {
      const red = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
          }
          return res;
        })
        .catch(() => hit || Response.error());
      return hit || red;
    }),
  );
});
