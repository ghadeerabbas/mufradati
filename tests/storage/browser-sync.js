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
// البند 3: حدث كبير محجوز (hold) والذاكرة ممتلئة: يُحفظ أولًا مع الأحداث المنتظرة، ويبقى بعد «الإغلاق والفتح»
window.fetch = async (u, o) => { if (!String(u).endsWith('/sync')) return new Response('{}'); const b = JSON.parse(o.body);
  const j = { core: JSON.stringify({ P, QLOG, BUY, R, LG, EN, STN, STV }), log: JSON.stringify(LOG), qa: JSON.stringify(QA), prefs: '', cv: CORE_V, st: b.evs.map(e => e.type === 'zzbig' ? 'big' : 'ok'), now: Date.now(), dn: 0 };
  return new Response(JSON.stringify(j), { headers: { 'Content-Type': 'application/json' } }) };
{ EVQ.length = 0; const big = evId({ type: 'zzbig', t: Date.now(), blob: 'x'.repeat(2000) }); EVQ.push(big); await syncNow(true);
  T('الحدث الكبير محجوز في قائمة الانتظار', EVQ.length === 1 && EVQ[0].hold === 1 && evqN() === 0);
  const junk2 = []; let ji2 = 0; for (const sz of [50000, 5000, 500, 50]) { try { for (let i = 0; i < 2000; i++) { localStorage.setItem('jk' + ji2, 'x'.repeat(sz)); junk2.push('jk' + ji2++) } } catch (e) { } }
  for (let i = 0; i < 3; i++) EVQ.push(evId({ type: 'zzok', t: Date.now() }));
  const f0 = STFAIL; save(); const stored = JSON.parse(localStorage.getItem(K('evq')) || '[]');
  T('الذاكرة ممتلئة: قائمة الانتظار محفوظة ومعها المحجوز (أو فشلٌ معدود لا صامت)', stored.some(e => e.n === big.n && e.hold === 1) || STFAIL > f0, [stored.length, STFAIL - f0]);
  const failed = STFAIL - f0, reported = REPS.some(m => /evq not saved/.test(m));   // تُقرأ قبل «الإغلاق»: العدّاد نفسه قد لا يُحفظ والذاكرة ممتلئة تمامًا
  const keep = EVQ.slice(); EVQ = []; loadState();   // «إغلاق وفتح»: القراءة من الذاكرة
  T('بعد «الإغلاق والفتح»: المحجوز موجود بعلامته', EVQ.some(e => e.n === big.n && e.hold === 1), [EVQ.length, evqN()]);
  T('والعادية: محفوظة معه، أو فشل حفظها معدود ومُبلَّغ (تنبيه وتقرير ومزامنة فورية، كما في إصلاح الحفظ)', EVQ.filter(e => !e.hold).length === 3 || (failed > 0 && reported), [EVQ.filter(e => !e.hold).length, failed, reported])
  junk2.forEach(k => localStorage.removeItem(k)); EVQ = keep.filter(e => !e.hold).length ? EVQ : keep; await syncNow(true);
  T('المزامنة بعدها ترسل العادية وحدها، والمحجوز باقٍ', evqN() === 0 && EVQ.length === 1 && EVQ[0].hold === 1, [EVQ.length, evqN()]);
  EVQ.length = 0; save() }
window.fetch = realFetch; window.repErr = realRep;
