const CACHE='boobly-v1.2.8';
const ASSETS=['./','./index.html','./styles.css','./app.js','./database.json','./prompts.json','./presets.json','./manifest.json','./icons/icon-192.png','./icons/icon-512.png','./icons/favicon.png','./icons/preset.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k===CACHE?null:caches.delete(k))))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{const copy=resp.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{}); return resp;}).catch(()=>r))));
