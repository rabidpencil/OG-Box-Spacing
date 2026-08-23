/* Chalk Line service worker.

   The page itself is fetched network-first, so whenever the phone has signal
   it gets whatever is currently on GitHub Pages. Offline it falls straight
   back to the cached copy. That means you no longer have to bump anything to
   push a change out — but bumping CACHE on a release is still good hygiene,
   because it clears out stale icons and manifest.                            */
const CACHE = "chalkline-v3";

const CORE     = ["./", "./index.html", "./manifest.webmanifest"];
const OPTIONAL = ["./icon-192.png", "./icon-512.png"];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return c.addAll(CORE).then(function(){
        return Promise.all(OPTIONAL.map(function(u){
          return c.add(u).catch(function(){ return null; });
        }));
      });
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; })
                            .map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  if(e.request.method !== "GET") return;

  const isPage = e.request.mode === "navigate" || e.request.destination === "document";

  if(isPage){
    // Online: always take the live copy and refresh the cache with it.
    // Offline: serve the last good one.
    e.respondWith(
      fetch(e.request).then(function(res){
        if(res && res.ok){
          const copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put("./index.html", copy); });
        }
        return res;
      }).catch(function(){
        return caches.match("./index.html").then(function(hit){
          return hit || caches.match("./");
        });
      })
    );
    return;
  }

  // Everything else (icons, manifest) is cache-first — it barely changes.
  e.respondWith(
    caches.match(e.request).then(function(hit){
      if(hit) return hit;
      return fetch(e.request).then(function(res){
        if(res && res.ok){
          const copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
        }
        return res;
      }).catch(function(){ return caches.match("./index.html"); });
    })
  );
});
