const V='f1sg-2026-10-05e';
const SHELL=['./','index.html','data.js','app.js','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V&&x!=='f1sg-img').map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.origin===location.origin){
    // หน้าเว็บ: ลองเน็ตก่อน ถ้าไม่มีสัญญาณใช้ที่เก็บไว้
    e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(V).then(c=>c.put(r,cp));return res}).catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match('index.html'))));
    return;
  }
  if(r.destination==='image'){
    // ภาพจากเว็บนอก: เปิดครั้งแรกแล้วเก็บไว้ดูตอนไม่มีสัญญาณ
    e.respondWith(caches.open('f1sg-img').then(c=>c.match(r).then(m=>m||fetch(r).then(res=>{c.put(r,res.clone());return res}))));
  }
});
