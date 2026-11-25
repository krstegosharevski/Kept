/* Kept service worker: the app opens offline after the first visit.
   Network first (3-second timeout), falling back to the cache, and every network response is written back,
   so updates arrive whenever the app opens online. VERSION only needs a bump if this file's cache list changes. */
const VERSION='kept-v10';
const RANK_IDS=['comfort-zone','starter','student','builder','iron-will','stoic','focused']; // the same ids as RANKS in logic.js
const FILES=['./','styles.css','js/ui.js','js/logic.js','js/art.js','js/store.js','js/scene.js','manifest.webmanifest',
  'icons/icon.svg','icons/coin.svg','icons/coin-small.svg','icons/apple-touch-icon.png','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png',
  ...RANK_IDS.flatMap(id=>[`ranks/banner-${id}.svg`,`ranks/badge-${id}.svg`]),'fonts/bricolage-grotesque-800.woff2','fonts/figtree.woff2',
  'themes/themes.js','themes/shop-kept-light.jpg','themes/shop-kept-dark.jpg',
  'themes/vice-city/shop-light.jpg','themes/vice-city/shop-dark.jpg','themes/dig-a-hole/shop-light.jpg','themes/dig-a-hole/shop-dark.jpg','themes/surreal-christmas/shop-light.jpg','themes/surreal-christmas/shop-dark.jpg','themes/barcelona-nights/shop-light.jpg','themes/barcelona-nights/shop-dark.jpg',
  'themes/vice-city/theme.css','themes/dig-a-hole/theme.css','themes/dig-a-hole/moon.svg','themes/dig-a-hole/flyer-pearl.svg','themes/dig-a-hole/flyer-blue.svg','themes/dig-a-hole/peeker.svg',
  'themes/surreal-christmas/theme.css','themes/surreal-christmas/tree.svg','themes/surreal-christmas/puff.svg','themes/surreal-christmas/moon-hat.svg','themes/surreal-christmas/bauble.svg','themes/surreal-christmas/gifts.svg','themes/surreal-christmas/gifts-tree.svg','themes/surreal-christmas/gift.svg',
  'themes/barcelona-nights/theme.css','themes/barcelona-nights/stadium.svg','themes/barcelona-nights/spires.svg','themes/barcelona-nights/flag.svg','themes/barcelona-nights/ball.svg','themes/barcelona-nights/badge.svg']; // each theme's files from app/themes (see themes.js), and the Shop's pictures of each look

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
