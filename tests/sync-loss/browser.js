// المزامنة الجديدة في الصفحة الحقيقية (index.html في Chromium): هوية الحدث، والمرساة الزمنية، والحدث الكبير، والإقرار.
// الخادم مُحاكى بتبديل fetch لطلب /sync داخل الصفحة: يعيد حالة الحساب نفسها، وحالةً لكل حدث (big للأحداث من نوع zzbig).
const CALLS = [];
const fake = (stOf, extra) => { window.fetch = async (u, o) => { if (!String(u).endsWith('/sync')) return new Response('{}');
  const b = JSON.parse(o.body); CALLS.push(b);
  const j = { core: JSON.stringify({ P, QLOG, BUY, R, LG, EN, STN, STV }), log: JSON.stringify(LOG), qa: JSON.stringify(QA), prefs: '', cv: CORE_V,
    sxv: 1, st: stOf(b.evs), now: Date.now(), dn: Math.max(0, ...b.evs.map(e => +e.n || 0)), ...(extra || {}) };
  if (extra && extra.__old) { delete j.sxv; delete j.st; delete j.__old } if (extra && extra.__nost) { delete j.st; delete j.__nost }
  return new Response(JSON.stringify(j), { headers: { 'Content-Type': 'application/json' } }) } };
const realFetch = window.fetch, realRep = window.repErr; const REPS = []; window.repErr = (m) => REPS.push(m);
CFG.sx = { on: 1, u: [], w: CFG.sx.w, ids: 0, uv: 'trust' }; syncFree();
T('المزامنة الجديدة مفعّلة لهذا الحساب في الصفحة', SXU === true);

// 1) هوية الحدث: معرّف جهاز ثابت، وأرقام متزايدة حتى لو رجعت الساعة
{ const d1 = devId(), d2 = devId(); const n1 = nextSeq(); const _n = Date.now; Date.now = () => _n() - 5 * 864e5; const n2 = nextSeq(); Date.now = _n; const n3 = nextSeq();
  T('معرّف الجهاز ثابت ومقبول الشكل', d1 === d2 && /^[A-Za-z0-9_-]{4,40}$/.test(d1), d1);
  T('الأرقام متزايدة رغم إرجاع الساعة 5 أيام', n2 > n1 && n3 > n2, [n1, n2, n3].join(' < ')) }

// 2) المرساة في الصفحة: جسر تطبيق مُحاكى (عدّاد الهاتف ورقم التشغيل)
{ let el = 1e6, boot = '7'; window.MufApp = { elapsed: () => el, bootId: () => boot, speak() { } };
  ANC = null; ancSet(Date.parse('2026-11-25T10:00:00Z'), 0); el += 3600e3;   // ساعة على العدّاد
  T('بعد ساعة: وقت المرساة = وقت الخادم + ساعة', ancNow() === Date.parse('2026-11-25T11:00:00Z'), new Date(ancNow()).toISOString());
  const _n = Date.now; Date.now = () => _n() - 864e5; const a1 = ancNow(); Date.now = _n;
  T('إرجاع ساعة الهاتف يومًا لا يغيّر وقت المرساة', a1 === Date.parse('2026-11-25T11:00:00Z'));
  ANC = null; el += 600e3; T('«إغلاق التطبيق وفتحه» (المرساة تُقرأ من التخزين، والعدّاد مستمر): صالحة', ancNow() === Date.parse('2026-11-25T11:10:00Z'));
  boot = '8'; T('إعادة تشغيل الهاتف (رقم تشغيل جديد): المرساة باطلة', ancNow() === 0);
  boot = '7'; el = 5000; T('عدّاد أصغر من عدّاد المرساة (تشغيل جديد دون رقم مختلف): باطلة', ancNow() === 0);
  boot = ''; T('جسر بلا رقم تشغيل (أندرويد أقدم من 7): عدّاد الصفحة بدلها', monoNow().b[0] === 'p');
  delete window.MufApp; ANC = null; ancSet(Date.parse('2026-11-25T10:00:00Z'), 0);
  T('المتصفح: المرساة صالحة في الصفحة نفسها', ancNow() >= Date.parse('2026-11-25T10:00:00Z'));
  const saved = JSON.parse(localStorage.getItem(K('anc'))); saved.b = 'pXXXXXXXX'; localStorage.setItem(K('anc'), JSON.stringify(saved)); ANC = null;
  T('المتصفح بعد إعادة تحميل الصفحة (معرّف صفحة آخر): باطلة', ancNow() === 0);
  T('المنطقة الزمنية لا تدخل في المرساة (تعتمد على أرقام بالملّي ثانية وحدها)', !/getTimezoneOffset|toLocale/.test(String(ancNow) + String(ancSet) + String(monoNow))) }

// 3) الحدث الكبير لا يعطّل ما بعده، ولا يُحذف: يبقى في قائمة الانتظار بعلامة hold (فيُحفظ أولًا مع الأحداث المنتظرة)
{ fake(evs => evs.map(e => e.type === 'zzbig' ? 'big' : 'ok')); EVQ.length = 0;
  const big = { type: 'zzbig', t: Date.now(), d: devId(), n: nextSeq(), blob: 'x'.repeat(1000) };
  EVQ.push({ type: 'zzok', t: Date.now(), d: devId(), n: nextSeq() }, big, { type: 'zzok', t: Date.now(), d: devId(), n: nextSeq() });
  CALLS.length = 0; const ok = await syncNow(true);
  T('مزامنة فيها حدث «big» بين حدثين: تنجح، وخرج الحدثان العاديان، وبقي الكبير محجوزًا', ok && EVQ.length === 1 && EVQ[0].n === big.n && EVQ[0].hold === 1 && evqN() === 0, [ok, EVQ.length, evqN()]);
  T('بُلِّغ المشرف', REPS.some(m => /too big/.test(m)), REPS.join('|').slice(0, 60));
  save(); T('المحجوز محفوظ على الجهاز مع قائمة الانتظار', JSON.parse(localStorage.getItem(K('evq')) || '[]').some(e => e.n === big.n && e.hold === 1));
  CALLS.length = 0; EVQ.push({ type: 'zzok', t: Date.now(), d: devId(), n: nextSeq() }); const ok2 = await syncNow(true);
  T('المزامنة التالية تعمل، ولا تُرسل المحجوز', ok2 && CALLS.length === 1 && CALLS[0].evs.length === 1 && !CALLS[0].evs.some(e => e.n === big.n) && evqN() === 0, [ok2, CALLS.length && CALLS[0].evs.length, evqN()]);
  T('المحجوز لا يمنع تحديث التطبيق (لا يُعدّ منتظرًا)', reloadSafe ? (evqN() === 0) : true);
  EVQ.length = 0; save() }

// 4) الإقرار: يُفرَّق بين ردّ الخادم القديم (بلا sxv) وردّ ناقص من الخادم الجديد
{ const two = () => { EVQ.length = 0; EVQ.push(evId({ type: 'zzok', t: Date.now() }), evId({ type: 'zzok', t: Date.now() })) };
  fake(evs => evs.slice(1).map(() => 'ok')); two(); await syncNow(true); T('الخادم الجديد بحالات أقل من الأحداث: لا يُحذف شيء', EVQ.length === 2, EVQ.length);
  fake(evs => evs.map(() => 'ok'), { __nost: 1 }); await syncNow(true); T('الخادم الجديد (sxv) بلا st إطلاقًا: لا يُحذف شيء', EVQ.length === 2, EVQ.length);
  fake(evs => 'x', {}); await syncNow(true); T('الخادم الجديد وst ليست قائمة: لا يُحذف شيء', EVQ.length === 2, EVQ.length);
  fake(evs => evs.map(() => 'ok')); await syncNow(true); T('ثم ردّ كامل من الخادم الجديد: حُذفت', EVQ.length === 0, EVQ.length);
  two(); fake(evs => evs.map(() => 'ok'), { __old: 1 }); await syncNow(true); T('الخادم القديم (بلا sxv ولا st): تُحذف المرسلة كما كان', EVQ.length === 0, EVQ.length) }

// 5) ما يرسله التطبيق: الجهاز في الطلب، والمرساة مع الحدث حين تكون صالحة
{ fake(evs => evs.map(() => 'ok')); CALLS.length = 0; delete window.MufApp; ANC = null; ancSet(Date.now(), 0);
  EVQ.push(evId({ type: 'zzok', t: Date.now() })); await syncNow(true);
  T('الطلب يحمل معرّف الجهاز (dev) وساعة الهاتف لحظة الإرسال (ct)', CALLS[0] && CALLS[0].dev === devId() && Math.abs(CALLS[0].ct - Date.now()) < 60e3);
  T('الحدث يحمل المرساة ومصدرها (p: عدّاد الصفحة)', CALLS[0] && CALLS[0].evs[0].a > 0 && CALLS[0].evs[0].ak === 'p', CALLS[0] && [CALLS[0].evs[0].a > 0, CALLS[0].evs[0].ak]);
  T('الردّ يضبط المرساة من وقت الخادم (now)', !!JSON.parse(localStorage.getItem(K('anc')) || 'null')) }
window.fetch = realFetch; window.repErr = realRep;
