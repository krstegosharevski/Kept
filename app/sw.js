/* Kept service worker: the app opens offline after the first visit.
   Network first (3-second timeout), falling back to the cache, and every network response is written back,
   so updates arrive whenever the app opens online. VERSION only needs a bump if this file's cache list changes. */
const VERSION='kept-v2';
const RANK_IDS=['comfort-zone','starter','student','builder','iron-will','stoic','focused']; // the same ids as RANKS in logic.js
const FILES=['./','styles.css','js/ui.js','js/logic.js','js/store.js','js/scene.js','manifest.webmanifest',
  'icons/icon.svg','icons/apple-touch-icon.png','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png',
  ...RANK_IDS.flatMap(id=>[`ranks/banner-${id}.svg`,`ranks/badge-${id}.svg`]),'fonts/bricolage-grotesque-800.woff2','fonts/figtree.woff2'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(VERSION).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET'||new URL(req.url).origin!==location.origin) return;
  e.respondWith((async()=>{
    const cache=await caches.open(VERSION);
    try{
      const res=await Promise.race([fetch(req),new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),3000))]);
      if(res.ok&&!res.redirected) cache.put(req.mode==='navigate'?'./':req,res.clone()); // every page is the one app page
      return res;
    }catch(err){
      return (await cache.match(req.mode==='navigate'?'./':req,{ignoreSearch:true}))||Response.error();
    }
  })());
});
