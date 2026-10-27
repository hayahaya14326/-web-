/* V25: network-first cache with quota-safe fallback and optional soundtrack assets. */
const CACHE='hitotsubu-v34-compact-mobile';
const ASSETS=["./","./index.html","./manifest.webmanifest","./privacy.html","./assets/app.js","./assets/pet_system.js","./assets/pets.css","./assets/v33_clarity.css","./assets/v34_compact.css","./assets/v34_compact.js","./assets/pets/common.webp","./assets/pets/uncommon.webp","./assets/pets/rare.webp","./assets/pets/epic.webp","./assets/pets/legendary.webp","./assets/pets/god.webp","./assets/beyond_visual.js","./assets/data.js","./assets/editorial.js","./assets/engine.js","./assets/expansion.js","./assets/forge_workshop.js","./assets/game.css","./assets/huge.js","./assets/icons/icon-192.png","./assets/icons/icon-512.png","./assets/immersion.js","./assets/music/01_first_light.mp3","./assets/music/02_stellar_awakening.mp3","./assets/music/03_beyond_infinity.mp3","./assets/score.js","./assets/stellar_system.js","./assets/stellar_ui.js","./assets/v10_constellations.js","./assets/v9_mechanics.js","./assets/v22_quality.js","./assets/v23_tier.css","./assets/v23_tier_operations.js","./assets/v28_universal_cycle.js","./assets/v28_cycle.css"];
// Music is optional to cache: limited storage must not block first-time installation.
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 const shell=ASSETS.filter(path=>!path.endsWith('.mp3'));
 const music=ASSETS.filter(path=>path.endsWith('.mp3'));
 await cache.addAll(shell);
 await Promise.allSettled(music.map(path=>cache.add(path)));
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('infinity-forge-')||key.startsWith('hitotsubu-'))&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||req.headers.has('range'))return;
 const url=new URL(req.url),scope=new URL(self.registration.scope);
 if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try{const res=await fetch(req);if(res.ok&&res.type==='basic'){try{await cache.put(req,res.clone())}catch(cacheError){/* storage full: online requests must still succeed */}}return res}
  catch(err){const found=await cache.match(req,{ignoreSearch:true});if(found)return found;
   if(req.mode==='navigate'){const shell=await cache.match('./index.html');if(shell)return shell;}
   throw err;}
 })());
});
