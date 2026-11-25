// التوافق في الصفحة الحقيقية بين إصلاح الحفظ المحلي وإصلاح المزامنة: ذاكرة ممتلئة فعلًا (حدّ Chromium)، ثم أحداث بهويّتها، ومزامنة بحالة لكل حدث.
const realFetch = window.fetch, realRep = window.repErr, REPS = []; window.repErr = m => REPS.push(m);
window.fetch = async (u, o) => { if (!String(u).endsWith('/sync')) return new Response('{}'); const b = JSON.parse(o.body);
  const j = { core: JSON.stringify({ P, QLOG, BUY, R, LG, EN, STN, STV }), log: JSON.stringify(LOG), qa: JSON.stringify(QA), prefs: '', cv: CORE_V, st: b.evs.map(() => 'ok'), now: Date.now(), dn: Math.max(0, ...b.evs.map(e => +e.n || 0)) };
  return new Response(JSON.stringify(j), { headers: { 'Content-Type': 'application/json' } }) };
CFG.sx = { on: 1, u: [], w: CFG.sx.w, ids: 0, uv: 'trust' }; syncFree();
// ملء الذاكرة حتى الحدّ الفعلي
const junk = []; let ji = 0; for (const sz of [50000, 5000, 500, 50]) { try { for (let i = 0; i < 2000; i++) { localStorage.setItem('junk' + ji, 'x'.repeat(sz)); junk.push('junk' + ji++) } } catch (e) { } }
let full = false; try { localStorage.setItem('junkProbe', 'x'.repeat(200)); localStorage.removeItem('junkProbe') } catch (e) { full = true }
T('الذاكرة ممتلئة فعلًا', full, junk.length + ' كتلة');
const s0 = SEQ, seqs = []; for (let i = 0; i < 5; i++) { const e = { type: 'zzok', t: Date.now(), d: devId(), n: nextSeq() }; seqs.push(e.n); EVQ.push(e); save() }
T('أرقام الأحداث متزايدة رغم فشل حفظ الرقم نفسه في الذاكرة الممتلئة', seqs.every((n, i) => !i || n > seqs[i - 1]), seqs.map(n => n % 1000).join(','));
T('الحفظ يعمل أو يُعدّ فشله (لا خطأ صامت)', STFAIL > 0 || (JSON.parse(localStorage.getItem(K('evq')) || '[]').length >= 5), [STFAIL, STKF, JSON.parse(localStorage.getItem(K('evq')) || '[]').length]);
const ok = await syncNow(true);
T('المزامنة تنجح والذاكرة ممتلئة، وتُفرغ الأحداث المرسلة', ok && EVQ.length === 0, [ok, EVQ.length]);
junk.forEach(k => localStorage.removeItem(k)); save();
T('بعد تحرير الذاكرة: الحفظ ينجح، وقائمة الانتظار المحفوظة فارغة', JSON.parse(localStorage.getItem(K('evq')) || '[]').length === 0);
const e2 = { type: 'zzok', t: Date.now(), d: devId(), n: nextSeq() }; T('الرقم التالي أكبر من كل ما قبله', e2.n > Math.max(...seqs), e2.n - Math.max(...seqs));
// البند 3: حدث كبير بحجمه الحقيقي (أكبر مما يقبله الخادم، نحو 950 كيلوبايت) محجوز، ثم ذاكرة ممتلئة فعلًا، ولا اتصال، وعمل حقيقي، وإغلاق فوري
let ONLINE = true;
window.fetch = async (u, o) => { if (!String(u).endsWith('/sync')) return new Response('{}'); if (!ONLINE) throw new TypeError('Failed to fetch'); const b = JSON.parse(o.body);
  const j = { core: JSON.stringify({ P, QLOG, BUY, R, LG, EN, STN, STV }), log: JSON.stringify(LOG), qa: JSON.stringify(QA), prefs: '', cv: CORE_V, sxv: 1, st: b.evs.map(e => new TextEncoder().encode(JSON.stringify(e)).length > 900000 ? 'big' : 'ok'), now: Date.now(), dn: 0 };
  return new Response(JSON.stringify(j), { headers: { 'Content-Type': 'application/json' } }) };
{ const Q = n => ({ type: 'quiz', kind: 's2', ok: 7, total: 10, ms: 40000 + n, full: true, t: Date.now() + n });
  EVQ.length = 0; save(); const big = evId({ type: 'quiz', kind: 's2', ok: 1, total: 10, ms: 1, t: Date.now(), blob: 'ع'.repeat(475000) });   // ≈ 950 كيلوبايت بايتًا
  T('الحدث بحجم حقيقي (> 900 كيلوبايت بالبايت)', new TextEncoder().encode(JSON.stringify(big)).length > 900000, new TextEncoder().encode(JSON.stringify(big)).length);
  EVQ.push(big); save(); await syncNow(true);
  T('الخادم ردّه «big»: محجوز في قائمة الانتظار، ومحفوظ على الجهاز', EVQ.length === 1 && EVQ[0].hold === 1 && evqN() === 0 && JSON.parse(localStorage.getItem(K('evq')) || '[]').some(e => e.n === big.n && e.hold === 1));
  stFree(1); stFree(2); save();
  const junk2 = []; let ji2 = 0; for (const sz of [50000, 5000, 500, 50, 5]) { try { for (let i = 0; i < 4000; i++) { localStorage.setItem('jk' + ji2, 'x'.repeat(sz)); junk2.push('jk' + ji2++) } } catch (e) { } }
  ONLINE = false; const q0 = QLOG.length, f0 = STFAIL;
  const r1 = ev(Q(1));
  const se = JSON.parse(localStorage.getItem(K('evq')) || '[]'), sq = JSON.parse(localStorage.getItem(K('qlog')) || '[]');
  T('إغلاق فوري بعد فشل الحفظ دون اتصال: المحفوظ متطابق — المحجوز باقٍ، والعمل الجديد ليس في الأحداث ولا في التمارين المحفوظة', r1 === true && se.length === 1 && se[0].n === big.n && sq.length === q0, [r1, se.length, sq.length - q0]);
  for (let i = 0; i < 100 && STRESC; i++) await sleep(50);
  T('بعد فشل الإنقاذ: الذاكرة عادت إلى المحفوظ (المحجوز وحده، بلا العمل الجديد)، وعُدّ الفشل', EVQ.length === 1 && EVQ[0].hold === 1 && QLOG.length === q0 && STFAIL > f0, [EVQ.length, QLOG.length - q0, STFAIL - f0]);
  junk2.forEach(k => localStorage.removeItem(k)); ONLINE = true; const r2 = ev(Q(2)); await syncNow(true);
  T('بعد عودة المساحة والاتصال: العمل يُقبل ويُرسل، والمحجوز باقٍ لا يُرسل', r2 === true && evqN() === 0 && EVQ.length === 1 && EVQ[0].hold === 1, [r2, evqN(), EVQ.length]);
  EVQ.length = 0; save() }
window.fetch = realFetch; window.repErr = realRep;
