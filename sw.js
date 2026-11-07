// عامل الخدمة. له وضعان:
// 1) الوضع العادي (الافتراضي لكل المتعلّمين): كما كان تمامًا — تُطلب الصفحة وملفات الموقع من الخادم في كل مرة.
// 2) وضع «العمل بلا إنترنت» (يفعّله المشرف لمتعلّم بعينه أو للجميع): يُفتح التطبيق فورًا من نسخة محفوظة في الهاتف،
//    ويُتحقَّق من النسخة الجديدة في الخلفية، فإن وُجدت حُفظت وأُخبرت الصفحة لتعيد التحميل في وقت مناسب.
// الصفحة ترسل الوضع إلى هنا ({type:"mode",on}). إيقافه يحذف كل ما حُفظ ويعيد الوضع العادي.
const DATA = "muf-data-1", MODEC = "muf-mode";
let MODE = null, PENDING = false;   // PENDING: وصلت نسخة أحدث من التي تعرضها الصفحة المفتوحة

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  // تنظيف نسخ قديمة من الذاكرة إن تغيّر اسمها
  for (const k of await caches.keys()) if (k.startsWith("muf-data-") && k !== DATA) await caches.delete(k);
  await self.clients.claim();
})()));

async function getMode() {
  if (MODE === null) {
    try { const r = await (await caches.open(MODEC)).match("mode"); MODE = r ? (await r.text()) === "on" : false; }
    catch (e) { MODE = false; }
  }
  return MODE;
}
async function setMode(on) {
  MODE = !!on;
  try { await (await caches.open(MODEC)).put("mode", new Response(on ? "on" : "off")); } catch (e) {}
  if (!on) { try { await caches.delete(DATA); } catch (e) {} }
}
self.addEventListener("message", e => {
  const d = e.data || {};
  if (d.type === "mode") e.waitUntil(setMode(d.on));
  // الصفحة تسأل عند اكتمال تحميلها: قد يكون التحديث وصل قبل أن تستمع
  if (d.type === "hello" && PENDING && e.source) e.source.postMessage({ type: "updated" });
});

// ما يتغيّر محتواه دون تغيّر اسمه: يُطلب من الخادم أولًا، والمحفوظ احتياط عند انقطاع الإنترنت
const isData = p => /\/(words[^/]*\.json|courses\.json|manifest\.json|audio\/index\.json)$/.test(p);
// ما لا يتغيّر محتواه (أو يتغيّر اسمه مع كل نسخة): يؤخذ من المحفوظ إن وُجد
const isStatic = (u) => u.origin === self.location.origin
  ? (/\/(fonts|img|icons|audio)\//.test(u.pathname) || (/\.js$/.test(u.pathname) && u.search))
  : u.hostname === "www.gstatic.com";

async function put(req, res) {
  if (res && (res.ok || res.type === "opaque")) { try { await (await caches.open(DATA)).put(req, res.clone()); } catch (e) {} }
  return res;
}
async function cacheFirst(req) {
  const c = await caches.match(req, { cacheName: DATA });
  if (c) return c;
  return put(req, await fetch(req));
}
async function networkFirst(req) {
  try { return await put(req, await fetch(req, { cache: "no-cache" })); }
  catch (e) { const c = await caches.match(req, { cacheName: DATA }); if (c) return c; throw e; }
}
// الصفحة نفسها: تُفتح من المحفوظ فورًا، وتُحدَّث في الخلفية
async function page(e) {
  const key = new Request(self.registration.scope);
  const cache = await caches.open(DATA), old = await cache.match(key), oldCopy = old ? old.clone() : null;   // نسخة للمقارنة، فالأصل يُعطى للصفحة
  PENDING = false;
  const net = fetch(self.registration.scope, { cache: "no-cache" }).then(async r => {
    if (!r.ok) return r;
    const txt = await r.clone().text();
    const prev = oldCopy ? await oldCopy.text() : null;
    await cache.put(key, r.clone());
    if (prev !== null && prev !== txt) {
      PENDING = true;
      for (const c of await self.clients.matchAll({ type: "window" })) c.postMessage({ type: "updated" });
    }
    return r;
  });
  if (old) { e.waitUntil(net.catch(() => {})); return old; }
  return net;
}

self.addEventListener("fetch", e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== "GET") return;
  const same = u.origin === self.location.origin;
  if (!same && u.hostname !== "www.gstatic.com") return;          // قاعدة البيانات والدخول والخادم: لا تُمسّ أبدًا
  // في الوضع العادي تبقى مكتبات Firebase وملفات النطق خارج عامل الخدمة كما كانت
  if (MODE !== true && (!same || (u.pathname.includes("/audio/") && u.pathname.endsWith(".mp3")))) { if (MODE === null) getMode(); return; }
  e.respondWith((async () => {
    if (!(await getMode())) {
      // الوضع العادي: كما كان
      return fetch(req, { cache: "no-cache" }).catch(() => fetch(req));
    }
    const sp = new URL(self.registration.scope).pathname;
    if (req.mode === "navigate" && same && (u.pathname === sp || u.pathname === sp + "index.html")) return page(e);
    if (isStatic(u)) return cacheFirst(req);
    if (same && isData(u.pathname)) return networkFirst(req);
    if (same) return networkFirst(req);
    return fetch(req);
  })());
});
