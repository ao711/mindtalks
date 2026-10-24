const CACHE='mindtalks-v8';
const CORE=['./','./index.html','./i18n.js','./app.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const sameOrigin=new URL(req.url).origin===self.location.origin;
  if(sameOrigin){
    // App files: network first so updates show right away; cached copy when offline
    e.respondWith(fetch(req,{cache:'no-store'}).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp))}return r})
      .catch(()=>caches.match(req,{ignoreSearch:true}).then(h=>h||caches.match('./index.html'))));
    return;
  }
  // Fonts and export libraries: cache first
  e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{if(r&&(r.ok||r.type==='opaque')){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp))}return r})));
});
