const CACHE='academy-os-static-v1';
const OFFLINE='/offline.html';
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([OFFLINE,'/academy-icon.svg'])));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  // Never cache any authenticated API response, credentials, classroom, workspace or payment data.
  if(url.pathname.startsWith('/api/'))return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).catch(()=>caches.match(OFFLINE)));
    return;
  }
  if(url.pathname.startsWith('/assets/')||url.pathname==='/academy-icon.svg'){
    event.respondWith(caches.match(req).then(found=>found||fetch(req).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));}
      return response;
    })));
  }
});
