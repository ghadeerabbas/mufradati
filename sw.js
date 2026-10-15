// عامل الخدمة: يجعل الموقع قابلًا للتثبيت كتطبيق. لا يخزّن شيئًا، فتصلك دائمًا آخر نسخة.
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",e=>{e.respondWith(fetch(e.request))});
