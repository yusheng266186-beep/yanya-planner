/* 研芽 Service Worker */
const CACHE='yanya-v1';
const ASSETS=[
  './',
  './index.html',
  './manifest.json',
  './assets/style.css',
  './assets/data.js',
  './assets/app.js',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/maskable-512.png',
  'https://fonts.googleapis.com/css2?family=Quicksand:wght@500;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap'
];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS).catch(()=>{})).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  // 缓存优先，回退网络；网络成功则更新缓存（字体等跨域除外放只缓存）
  e.respondWith(
    caches.match(req).then(cached=>{
      const net=fetch(req).then(res=>{
        if(res && res.status===200 && (res.type==='basic'||res.type==='cors')){
          const clone=res.clone();
          caches.open(CACHE).then(c=>c.put(req,clone)).catch(()=>{});
        }
        return res;
      }).catch(()=>cached);
      return cached||net;
    })
  );
});