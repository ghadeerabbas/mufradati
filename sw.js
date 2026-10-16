// عامل الخدمة: يجعل الموقع قابلًا للتثبيت كتطبيق، ويضمن أن تصل دائمًا آخر نسخة.
// صفحات الموقع وملفات الكلمات تُطلب مع التحقق من الخادم في كل مرة، فلا تبقى نسخة قديمة مخزّنة.
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(u.pathname.includes("/audio/")&&u.pathname.endsWith(".mp3"))return;   // ملفات النطق ثابتة: تُترك لذاكرة المتصفح العادية
  if(e.request.method==="GET"&&u.origin===self.location.origin){
    e.respondWith(fetch(e.request,{cache:"no-cache"}).catch(()=>fetch(e.request)));
  }
});
