// حالات المرحلة الثانية: صناديق المهام 30 يومًا، والمرساة الزمنية، والتراجع، وتقليم الأرقام مع تغيير الساعة، وتضخّم الأرقام،
// والأحداث الكبيرة، والحدود بالبايت، وsx في النسخ الاحتياطي والاستعادة والتحقق والحذف. الاستعمال: node edge2.mjs <DIR> <REPO> <case>
import { app, user, station, adv, ctl, post, memfs, DB, env } from '../integration/it.mjs';
const CASE = process.argv[4], DAY = 864e5, out = [];
const T = (n, c, x) => out.push((c ? 'PASS ' : 'FAIL ') + CASE + ': ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)) : ''));
const I = (n, x) => out.push('INFO ' + CASE + ': ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)) : ''));
const cfg = x => memfs.commit([{ path: 'config/app', data: { v: JSON.stringify({ sx: { on: 1, ...x } }) } }]);
await cfg({});
const due = A => Object.keys(A.P).filter(k => A.P[k].due <= ctl.NOW).sort();
async function learner(uid, days = 3, anchor = false) { await user(uid); const A = app('new', uid); A.anchor = anchor;
  for (let d = 0; d < days; d++) { for (let s = 0; s < 4; s++) await station(A); adv(DAY - 4 * 65e3); await A.sync() } return A }
const doc = p => { const d = DB.get(p); return d ? d.data.v : null };
const sxDoc = uid => JSON.parse(doc(`users/${uid}/data/sx`) || '{}');
const ids = (uid, dev) => { const v = (sxDoc(uid).dv || {})[dev] || {}; let a = []; for (const g of Object.values(v.g || {})) { let p = 0; a.push(...g.split(',').filter(Boolean).map(d => p += parseInt(d, 36))) } return { ids: a, lo: v.lo || 0 } };
async function srv(uid) { const B = app('new', uid); await B.sync(); const e = B.E();
  return { xp: e.xp, gems: e.gems, streak: e.s.streak, reviews: e.s.reviews, words: Object.keys(B.P).length, quizzes: B.QLOG.length, stations: B.STN.length, energy: B.enNow(ctl.NOW), B, e } }
const send = (uid, evs, dev) => post('/sync', uid, { evs, dev });
const archDocs = uid => [...DB].filter(([p]) => p.startsWith(`users/${uid}/data/sxa-`));
const bytes = s => Buffer.byteLength(s, 'utf8');

const C = {
  // صناديق المهام: 30 يومًا، والاستحقاق يُتحقَّق منه بنشاط ذلك اليوم، ولا تكرار (ولو من جهاز آخر وبعد 35 يومًا من الصناديق)
  async quest30() { await memfs.commit([{ path: 'config/app', data: { v: JSON.stringify({ sx: { on: 1 }, gems: { quest: [5, 5, 0] } }) } }]); const uid = 'q3', A = await learner(uid); const B = app('new', uid); await B.sync(); const dev = 'questdev2';
    let n = (ctl.NOW + 2e9); const d0 = ctl.NOW - 2 * DAY;   // قبل يومين: يوم فيه محطات مع تدريبها (من learner)
    const q = (id, t, d = dev) => ({ type: 'quest', id, t, n: ++n, d });
    // صندوق مهمة «محطة مع تدريبها» ليوم قديم فيه محطات
    const r1 = await send(uid, [q('st1', d0 + 3600e3)], dev); T('صندوق ليوم قديم مستحَق: مقبول', r1.st[0] === 'ok', [r1.st, r1.rej]);
    const r2 = await send(uid, [q('st1', d0 + 7200e3, 'questdev3')], 'questdev3'); T('الصندوق نفسه لليوم نفسه من جهاز آخر: لا يتكرّر', r2.st[0] === 'q' && r2.rej[0][1] === 'dup', [r2.st, r2.rej]);
    const r3 = await send(uid, [q('rv15', d0 + 3600e3, 'questdev4')], 'questdev4'); T('مهمة «راجع 15 كلمة» ليوم لم يراجع فيه 15: إلى الحجر «notyet»', r3.st[0] === 'q' && r3.rej[0][1] === 'notyet', [r3.st, r3.rej]);
    // 35 يومًا من الصناديق (3 في اليوم أقصى)، ثم إعادة صندوق عمره 29 يومًا من جهاز آخر
    const r4 = await send(uid, [q('st1', d0 - 31 * DAY, 'questdev5')], 'questdev5'); T('صندوق أقدم من 30 يومًا: إلى الحجر «old»', r4.st[0] === 'q' && r4.rej[0][1] === 'old', [r4.st, r4.rej]);
    I('لماذا لا يتكرّر صندوق خلال 30 يومًا', 'الصناديق 3 في اليوم على الأكثر، وسجلّها R.qd يُطوى بعد 600 = 200 يوم، فكل صندوق ضمن مدّة القبول ما زال فيه بعينه') },

  // المرساة: ساعة الهاتف تشير إلى أمس → المرساة تُبقي اليوم الحقيقي
  async anchorMissed() { const res = {};
    for (const mode of ['plain', 'anchor']) { const uid = 'am' + mode; await cfg({}); const A = await learner(uid, 3, mode === 'anchor'); ctl.NOW += 2 * DAY; const s0 = await srv(uid);
      const y = ctl.NOW - DAY; for (const [i, k] of due(A).slice(0, 10).entries()) { A.ev({ type: 'rate', k, r: 2, t: y + i * 20e3 }); adv(20e3) }
      await A.sync(); const a = await srv(uid); const yk = new Date(y + 3600e3).toISOString().slice(0, 10), tk = new Date(ctl.NOW).toISOString().slice(0, 10);
      res[mode] = { streak: [s0.streak, a.streak], yesterday: (a.e.per[yk] || { n: 0 }).n, today: (a.e.per[tk] || { n: 0 }).n }; ctl.NOW += 5 * DAY }
    I('عشر مراجعات بساعة تشير إلى أمس: أين حُسبت؟', res);
    T('بلا مرساة: كما في النسخة المنشورة', res.plain.yesterday === 10, res.plain);
    T('مع المرساة: حُسبت في اليوم الحقيقي، وأمس بقي فارغًا', res.anchor.yesterday === 0 && res.anchor.today === 10, res.anchor) },

  // المرساة والطاقة: ساعة متقدّمة يومًا لا تعطي طاقة امتلأت «في المستقبل»
  async anchorEnergy() { const out2 = {};
    for (const mode of ['plain', 'anchor']) { const uid = 'ae' + mode; const A = await learner(uid, 3, mode === 'anchor'); ctl.NOW += 3 * 36e5; await station(A); await A.sync();   // محطة اليوم الأولى (مجانية) مع تدريبها
      const c = JSON.parse(DB.get(`users/${uid}/data/core`).data.v); c.EN = { ...c.EN, v: 2, t: ctl.NOW }; await memfs.commit([{ path: `users/${uid}/data/core`, data: { v: JSON.stringify(c) } }]);   // طاقة 2 الآن
      const s0 = await srv(uid); A.ev({ type: 'stStart', t: ctl.NOW + DAY }); adv(20e3); const j = await A.sync(); const a = await srv(uid);   // ساعة الهاتف متقدّمة يومًا (الطاقة «ممتلئة» عنده)
      out2[mode] = { before: s0.energy, after: a.energy, st: j.st, why: j.rej } }
    I('بدء محطة بساعة متقدّمة يومًا وطاقة 2', out2);
    T('في الحالتين: إلى الحجر «energy» (الطاقة بوقت الخادم، لا ربح من المستقبل)', ['plain', 'anchor'].every(m => out2[m].st[0] === 'q' && out2[m].why[0][1] === 'energy' && out2[m].after <= out2[m].before + 1), out2) },

  // السياسة "day" لحدث بلا مرساة مقارنةً بـ "trust": أثرها على العمل دون إنترنت
  async policyDay() { const res = {};
    for (const [mode, pol, anc] of [['trust', 'trust', false], ['day', 'day', false], ['dayAnchored', 'day', true]]) {
      await cfg({ uv: pol }); const uid = 'pd' + mode, A = await learner(uid, 3, anc); const day0 = ctl.NOW; const s0 = await srv(uid);
      for (let d = 0; d < 4; d++) { ctl.NOW = day0 + d * DAY + 3 * 36e5; for (const k of due(A).slice(0, 5)) { A.ev({ type: 'rate', k, r: 2 }); adv(20e3) } await station(A, { syncEach: false }) }
      ctl.NOW = day0 + 3 * DAY + 10 * 36e5; let j; const why = {}, stc = {}; do { j = await A.sync(); for (const r of j.rej || []) why[r[1]] = (why[r[1]] || 0) + 1; for (const x of j.st || []) stc[x] = (stc[x] || 0) + 1 } while (A.q); const a = await srv(uid);
      res[mode] = { streak: [s0.streak, a.streak], reviews: a.reviews - s0.reviews, words: a.words - s0.words, st: stc, q: why }; ctl.NOW += 10 * DAY }
    await cfg({});
    I('4 أيام دون إنترنت ثم مزامنة [السلسلة قبل وبعد، مراجعات، كلمات]', res);
    T('مع المرساة لا ثمن للسياسة "day" (مطابقة لـ"trust")', JSON.stringify(res.dayAnchored) === JSON.stringify(res.trust), res);
    T('بلا مرساة وبالسياسة "day": الأيام تُجمع في يوم الاستلام (السلسلة أقصر) — يُعرض للقرار', res.day.streak[1] < res.trust.streak[1], res.day) },

  // البند 2: التراجع إلى الخادم القديم ثم العودة، وتمرين قبله القديم وضاع ردّه ثم أُعيد إلى الجديد → لا تكرار
  async rollbackQuiz() { const uid = 'rq', A = await learner(uid); const b = await srv(uid); let ks = due(A), p = 0; const pick = n => ks.slice(p, p += n);
    ctl.ACTIVE = 'old';
    for (const k of pick(2)) { A.ev({ type: 'rate', k, r: 2 }); adv(20e3) } A.ev({ type: 'quiz', kind: 's2', ok: 9, total: 10, ms: 30123, full: true }); adv(30e3);
    const lost = A.EVQ.slice(); await send(uid, lost, A.dev()); A.done(lost.length); adv(30e3);   // القديم حفظها وضاع الردّ (والهاتف — لنفترض — لم يحذفها: نعيدها يدويًا)
    ctl.ACTIVE = 'new'; for (const k of pick(2)) { A.ev({ type: 'rate', k, r: 2 }); adv(20e3) } await A.sync();
    const jr = await send(uid, lost, A.dev()); const a = await srv(uid);
    T('التمرين المعاد بعد العودة يُعرف بمحتواه: إلى الحجر «dupc»، لا خبرة مرة ثانية', a.quizzes - b.quizzes === 1 && jr.rej.some(r => r[1] === 'dupc'), { quizzes: a.quizzes - b.quizzes, st: jr.st, rej: jr.rej });
    T('المراجعات 4 بالضبط', a.reviews - b.reviews === 4, a.reviews - b.reviews) },

  // البند 2 (الطريق الموصى به): التراجع بالإعدادات (وضع الأرقام وحدها) بدل نشر الخادم القديم → صفر تكرار في كل الأنواع
  async rollbackCfg() { const uid = 'rc', A = await learner(uid); ctl.NOW += 3 * 36e5; const b = await srv(uid); let ks = due(A), p = 0; const pick = n => ks.slice(p, p += n);
    await cfg({ on: 0, ids: 1 });
    for (const k of pick(2)) { A.ev({ type: 'rate', k, r: 2 }); adv(20e3) } await station(A, { syncEach: false }); A.ev({ type: 'quiz', kind: 's2', ok: 9, total: 10, ms: 30123, full: true }); adv(30e3); A.ev({ type: 'combo' }); adv(15e3);
    const lost = A.EVQ.slice(); const j1 = await send(uid, lost, A.dev()); adv(30e3); const j2 = await A.sync();
    T('في وضع الأرقام وحدها: الدفعة المعادة كلها «وصلت سابقًا»', j2.st.every(s => s === 'dup'), j2.st);
    await cfg({}); for (const k of pick(2)) { A.ev({ type: 'rate', k, r: 2 }); adv(20e3) } const j3 = await A.sync(); const jr = await send(uid, lost, A.dev());
    T('بعد إعادة التشغيل: الجديدة مقبولة، والمعادة من وضع الأرقام «وصلت سابقًا»', j3.st.every(s => s === 'ok') && jr.st.every(s => s === 'dup'), [j3.st, jr.st]);
    const a = await srv(uid); T('النتيجة: 4 مراجعات ومحطة وتمرينا المحطة والاختبار بالضبط', a.reviews - b.reviews === 4 + 5 && a.stations - b.stations === 1 && a.quizzes - b.quizzes === 2, [a.reviews - b.reviews, a.stations - b.stations, a.quizzes - b.quizzes]) },

  // البند 3: تقليم الأرقام آمن مع تغيير الساعة وإعادة ضبطها
  async pruneClock() { const uid = 'pc', A = await learner(uid); const b = await srv(uid); const k = due(A)[0]; A.ev({ type: 'rate', k, r: 2 }); const e = JSON.parse(JSON.stringify(A.EVQ[0])); await A.sync();
    ctl.NOW += 40 * DAY; A.ev({ type: 'eday' }); await A.sync(); const x = ids(uid, A.dev());
    T('بعد 40 يومًا (بساعة الخادم): رقم الحدث حُذف وارتفعت أرض الجهاز فوقه', !x.ids.includes(e.n) && x.lo >= e.n, { lo: x.lo, n: e.n });
    for (const [name, f] of [['كما هو', e => e], ['ساعة الهاتف تقول «الآن»', e => ({ ...e, t: ctl.NOW })], ['مرساة مزوّرة «الآن»', e => ({ ...e, t: ctl.NOW, a: ctl.NOW })], ['ساعة أُعيد ضبطها إلى 1970', e => ({ ...e, t: 1000 })]]) {
      const j = await send(uid, [f(e)], A.dev()); T('إعادة الحدث القديم (' + name + '): لا تطبيق (الحجر «old» أول مرة، ثم «وصل سابقًا»)', (j.st[0] === 'q' && j.rej[0][1] === 'old') || j.st[0] === 'dup', [j.st, j.rej]) }
    const a = await srv(uid); T('المراجعات زادت 1 فقط', a.reviews - b.reviews === 1, a.reviews - b.reviews);
    // جهاز فقد رقمه المحفوظ وساعته مُرجَعة: رقم جديد ≤ الأرض → الحجر (يُستعاد)، لا ضياع ولا تكرار
    const k2 = due(A)[1]; const ev2 = { type: 'rate', k: k2, r: 2, t: ctl.NOW, n: x.lo - 5, d: A.dev() }; const j = await send(uid, [ev2], A.dev());
    const inQ = sxDoc(uid).qz.some(q => q[2].n === ev2.n); T('رقم فُقد مع ساعة مُرجَعة: في الحجر لا ضائع', j.st[0] === 'q' && inQ, [j.st, inQ]);
    // ساعة الهاتف قفزت إلى 2030 ثم عادت: الأرقام تبقى متزايدة (أكبر رقم محفوظ)، ولا شيء يُعدّ مكرّرًا خطأً
    const fut = Date.parse('2030-01-01'); A.ev({ type: 'rate', k: due(A)[2], r: 2, t: fut }); adv(20e3); const nFut = A.EVQ[0].n; await A.sync();
    A.ev({ type: 'rate', k: due(A)[3], r: 2 }); const nAfter = A.EVQ[0].n; const j3 = await A.sync();
    T('بعد قفزة الساعة إلى 2030 وعودتها: الرقم التالي أكبر، والحدث مقبول', nAfter > nFut && j3.st[0] === 'ok', [nAfter > nFut, j3.st]) },

  // البند 4: تضخّم قائمة الأرقام نفسها: حدّ لكل جهاز ولكل الأجهزة، والمحذوف مبكّرًا لا يُطبَّق مرة ثانية
  async idsGrowth() { const uid = 'ig'; await user(uid); const A = app('new', uid); await A.sync(); const dev = 'growdev1'; let n = (ctl.NOW + 2e9); const first = [];
    for (let b = 0; b < 60; b++) { const evs = Array.from({ length: 300 }, () => ({ type: 'zz', t: ctl.NOW, n: ++n, d: dev })); if (!b) first.push(evs[0]); await send(uid, evs, dev); adv(1e3) }
    const x = ids(uid, dev), sxb = bytes(doc(`users/${uid}/data/sx`));
    T('18000 حدث من جهاز واحد في يوم: القائمة لا تتجاوز 15000، والأرض ارتفعت', x.ids.length <= 15000 && x.lo > 0, { ids: x.ids.length, lo: x.lo > 0 });
    T('وثيقة sx دون 400 كيلوبايت', sxb <= 400000 + 2000, sxb);
    const j = await send(uid, [{ ...first[0], type: 'eday' }], dev); T('إعادة أول حدث (حُذف رقمه مبكّرًا): الحجر «old»، لا تطبيق', j.st[0] === 'q' && j.rej[0][1] === 'old', [j.st, j.rej]);
    // عشرة أجهزة × 3500 رقم: حدّ كل الأجهزة (300 كيلوبايت للأرقام)
    for (let d = 0; d < 10; d++) { const dv = 'manydev' + d; for (let b = 0; b < 12; b++) { await send(uid, Array.from({ length: 300 }, () => ({ type: 'zz', t: ctl.NOW, n: ++n, d: dv })), dv); } adv(1e3) }
    const sx = sxDoc(uid), idb = bytes(JSON.stringify(sx.dv)), total = bytes(doc(`users/${uid}/data/sx`));
    T('11 جهازًا: أرقامها كلها دون 300 كيلوبايت + هامش، والوثيقة دون حدّ Firestore', idb <= 320000 && total < 1048576, { ids: idb, doc: total });
    I('وثائق الأرشيف (الحجر بلا حذف)', archDocs(uid).length) },

  // البند 5: حدث أكبر من 32 كيلوبايت يُحفظ كاملًا في وثيقة مستقلة؛ وأكبر مما تتّسع له وثيقة: لا إقرار ولا تطبيق
  async bigEvent() { const uid = 'be', A = await learner(uid); const dev = A.dev(); let n = (ctl.NOW + 2e9);
    const mid = { type: 'quiz', kind: 's2', ok: 99, total: 10, ms: 1, t: ctl.NOW, n: ++n, d: dev, qa: Array.from({ length: 300 }, (_, i) => ['ك'.repeat(60) + i, 1]) };
    const j = await send(uid, [mid], dev); const q = sxDoc(uid).qz.find(x => x[2].ref); const full = q && JSON.parse(doc(`users/${uid}/data/${q[2].ref}`)).ev;
    T('حدث 40 كيلوبايت تقريبًا: في الحجر، ومحفوظ كاملًا في وثيقة مستقلة', j.st[0] === 'q' && full && JSON.stringify(full) === JSON.stringify(mid), { st: j.st, bytes: bytes(JSON.stringify(mid)), ref: q && q[2].ref });
    const huge = { type: 'quiz', kind: 's2', ok: 1, total: 10, ms: 1, t: ctl.NOW, n: ++n, d: dev, blob: 'ع'.repeat(500000) };
    const j2 = await send(uid, [huge], dev); T('حدث 1 ميغابايت: الحالة «big» (لا إقرار بحفظه، فلا يحذفه التطبيق)، ولا أثر له', j2.st[0] === 'big' && !sxDoc(uid).qz.some(x => x[2].n === huge.n), j2.st);
    const s1 = doc(`users/${uid}/data/sx`); const j3 = await send(uid, [huge], dev); T('إعادته: «big» مرة أخرى (لم يُسجَّل رقمه كمستلَم)', j3.st[0] === 'big' && doc(`users/${uid}/data/sx`) === s1, j3.st) },

  // البند 7: الحدود بالبايت لا بالمحارف (نصوص عربية: محرف = بايتان)
  async bytesLimit() { const uid = 'bl'; await user(uid); const A = app('new', uid); await A.sync(); const dev = 'bytedev1'; let n = (ctl.NOW + 2e9);
    const ev = () => ({ type: 'zz', t: ctl.NOW, n: ++n, d: dev, note: 'ض'.repeat(1300) });   // نحو 1300 محرف و2600 بايت
    for (let b = 0; b < 2; b++) await send(uid, Array.from({ length: 150 }, ev), dev);
    const s = doc(`users/${uid}/data/sx`); T('300 حدث عربي في الحجر: الوثيقة ≤ 400 كيلوبايت بالبايت (لا بالمحارف)', bytes(s) <= 402000, { chars: s.length, bytes: bytes(s), archives: archDocs(uid).length });
    T('ما زاد نُقل إلى الأرشيف، ولا شيء محذوف', JSON.parse(s).qz.length + archDocs(uid).reduce((a, [, d]) => a + JSON.parse(d.data.v).qz.length, 0) === 300) ;
    // قاعدة الاختبار ترفض أي وثيقة > 1048576 بايت كما يفعل Firestore: نتأكّد أنها تعمل
    let err = ''; try { await memfs.commit([{ path: 'x/y', data: { v: 'ع'.repeat(530000) } }]) } catch (e) { err = e.message } T('قاعدة الاختبار تفرض حدّ Firestore بالبايت', /1 ميغابايت/.test(err), err.slice(0, 40)) },

  // البند 6: sx وأرشيفها في النسخ الاحتياطي، والتحقق الكامل، والاسترجاع، وحذف بيانات الحساب
  async backupSx() { const uid = 'bs', A = await learner(uid); const dev = A.dev(); let n = (ctl.NOW + 2e9);
    await send(uid, Array.from({ length: 300 }, () => ({ type: 'zz', t: ctl.NOW, n: ++n, d: dev, note: 'ض'.repeat(1300) })), dev);
    for (const k of due(A).slice(0, 2)) { A.ev({ type: 'rate', k, r: 2 }); adv(20e3) } await A.sync();
    const ROOT = 'projects/mufradati-406bd/databases/(default)/documents';
    const enc = v => typeof v === 'string' ? { stringValue: v } : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : typeof v === 'boolean' ? { booleanValue: v } : v === null ? { nullValue: null } : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } } : (v && v.ms !== undefined && Object.keys(v).length === 1) ? { timestampValue: new Date(v.ms).toISOString() } : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
    env.__export = async () => { const arr = [...DB].map(([p, d]) => ({ document: { name: ROOT + '/' + p, fields: Object.fromEntries(Object.entries(d.data).map(([k, v]) => [k, enc(v)])), updateTime: d.ut }, readTime: '' })); return { parts: [JSON.stringify(arr)], n: arr.length, users: 1 } };
    const key = (await post('/backup', 'admin', { op: 'now', rid: 'sxBackup0001' })).key;
    const t = await post('/backup', 'admin', { op: 'test', key }); const nA = archDocs(uid).length;
    T('النسخة فيها sx ووثائق أرشيفها', Object.entries(t.per).some(([c]) => c === 'users/…/data') && nA > 0, { per: t.per, archives: nA });
    let v = await post('/backup', 'admin', { op: 'verify', key }); const a0 = v.accts[uid];
    T('تحقق كامل بلا نشاط: sx والأرشيف «same»، والنتيجة مطابقة', a0.docs.sx === 'same' && a0.docs.sxa === 'same' && v.result === 'match', a0.docs);
    for (const k of due(A).slice(2, 3)) { A.ev({ type: 'rate', k, r: 2 }); adv(20e3) } await A.sync();
    v = await post('/backup', 'admin', { op: 'verify', key }); T('بعد مزامنة جديدة: التحقق يرى فرق sx', v.accts[uid].docs.sx === 'diff', v.accts[uid].docs);
    // الاسترجاع: وثيقة sx ليست في النسخة → تُصفَّر لتطابق الحالة المسترجَعة (نختبر دالة الكتابات نفسها؛ الاسترجاع الحقيقي يكتب في Firestore عبر الشبكة)
    { const src = (await import('node:fs')).readFileSync(process.argv[2] + '/w_new.mjs', 'utf8'); const f = src.slice(src.indexOf('function restoreExtra('), src.indexOf('// تفكّ النسخة وتعيد وثائقها'));
      const restoreExtra = new Function('DOCROOT', f + ';return restoreExtra')(ROOT);
      const inBak = new Set([ROOT + '/users/' + uid + '/data/ck']); const W = restoreExtra(inBak, [uid]);
      T('الاسترجاع: sx ليست في النسخة → تُكتب فارغة لتطابق الحالة المسترجَعة؛ وck الموجودة في النسخة لا تُمسّ', W.length === 1 && W[0].update.name.endsWith('/data/sx') && W[0].update.fields.v.stringValue === '{}', W.map(w => w.update.name.split('/').slice(-1)[0]));
      const W2 = restoreExtra(new Set([ROOT + '/users/' + uid + '/data/ck', ROOT + '/users/' + uid + '/data/sx']), [uid]); T('sx في النسخة: تُسترجع منها كما هي (لا كتابة إضافية)', W2.length === 0, W2.length) }
    // الحذف (wipe): الحجر والمتأخّرات ووثائق الأرشيف تُحذف، وسجلّ الأجهزة يبقى (فلا يُطبَّق حدث قديم أُعيد إرساله)
    const before = ids(uid, dev); await post('/wipe', 'admin', { uid }); const sx = sxDoc(uid);
    T('بعد حذف بيانات الحساب: الحجر فارغ ووثائق الأرشيف محذوفة، وأرقام الأجهزة باقية', !sx.qz.length && !archDocs(uid).length && ids(uid, dev).ids.length === before.ids.length, { qz: sx.qz.length, arch: archDocs(uid).length, ids: ids(uid, dev).ids.length });
    v = await post('/backup', 'admin', { op: 'verify', key }); T('التحقق بعد الحذف يرى الفرق في sx والأرشيف', v.accts[uid].docs.sx === 'diff' && v.accts[uid].docs.sxa === 'diff', v.accts[uid].docs) },

  // البند 2: استعادة أحداث حقيقية دون أرض الجهاز، وإعادة التطبيق من الحجر دون تكرار المكافآت
  async reapply() { const uid = 'ra', A = await learner(uid); const dev = A.dev(); ctl.NOW += 3 * 36e5;
    const ks = due(A); A.ev({ type: 'rate', k: ks[0], r: 2 }); const E1 = JSON.parse(JSON.stringify(A.EVQ[0])); adv(20e3);
    A.ev({ type: 'quiz', kind: 's2', ok: 9, total: 10, ms: 30777, full: true }); const Q1 = JSON.parse(JSON.stringify(A.EVQ[1])); await A.sync();
    ctl.NOW += 40 * DAY; A.ev({ type: 'eday' }); await A.sync(); const lo = ids(uid, dev).lo;
    const b = await srv(uid);
    // أ) حدث حقيقي لم يصل، رقمه دون الأرض (جهاز فقد رقمه وساعته مُرجَعة): الحجر، ثم إعادة تطبيق = مراجعة مرة واحدة
    const G = { type: 'rate', k: ks[1], r: 2, t: ctl.NOW - 3600e3, n: lo - 7, d: dev }; let j = await send(uid, [G], dev); T('حقيقي دون الأرض: في الحجر «old»', j.st[0] === 'q' && j.rej[0][1] === 'old', [j.st, j.rej]);
    // ب) الحدثان الأصليان (طُبّقا قبل 40 يومًا) يُعادان بعد حذف رقميهما: الحجر
    j = await send(uid, [E1, Q1], dev); T('إعادة حدثين طُبّقا قبل 40 يومًا: في الحجر', j.st.every(x => x === 'q'), [j.st, j.rej]);
    let L = await post('/sxq', 'admin', { op: 'list', uid }); const find = f => L.qz.find(f);
    const eG = find(r => r.n === G.n), eE = find(r => r.n === E1.n), eQ = find(r => r.n === Q1.n);
    T('لوحة الحجر تعرض الثلاثة', !!(eG && eE && eQ), L.qz.length);
    let r = await post('/sxq', 'admin', { op: 'apply', uid, qid: eG.qid }); let a = await srv(uid);
    T('إعادة الحقيقي: مقبول، والمراجعات +1', r.st === 'ok' && a.reviews - b.reviews === 1, [r, a.reviews - b.reviews]);
    r = await post('/sxq', 'admin', { op: 'apply', uid, qid: eG.qid }); a = await srv(uid);
    T('إعادته مرة ثانية: «applied»، ولا تغيير', r.st === 'q' && r.rej[0][1] === 'applied' && a.reviews - b.reviews === 1, [r, a.reviews - b.reviews]);
    const x0 = a.xp; r = await post('/sxq', 'admin', { op: 'apply', uid, qid: eE.qid }); a = await srv(uid);
    T('إعادة مراجعة طُبّقت من قبل: «late» (نشاط فقط)، بلا خبرة ولا مراجعة', r.st === 'late' && a.xp === x0 && a.reviews - b.reviews === 1, [r, a.xp - x0, a.reviews - b.reviews, { e1t: E1.t, log: a.B.LOG.filter(x => x[1] === E1.k).map(x => [x[0] - E1.t, x[2], x[3]]) }]);
    r = await post('/sxq', 'admin', { op: 'apply', uid, qid: eQ.qid }); a = await srv(uid);
    T('إعادة تمرين طُبّق من قبل: «dupc»، والتمارين كما هي', r.st === 'q' && r.rej[0][1] === 'dupc' && a.quizzes === b.quizzes, [r, a.quizzes - b.quizzes]);
    L = await post('/sxq', 'admin', { op: 'list', uid }); T('نتيجة كل محاولة مسجّلة على مدخلها', L.qz.find(q => q.n === G.n).ap.r === 'ok' && L.qz.find(q => q.n === Q1.n).ap.r === 'dupc');
    // ج) حدث في وثيقة أرشيف
    const G2 = { type: 'rate', k: ks[2], r: 2, t: ctl.NOW - 1800e3, n: lo - 3, d: dev }; await send(uid, [G2], dev); let n = (ctl.NOW + 2e9);
    for (let k = 0; k < 2; k++) await send(uid, Array.from({ length: 160 }, () => ({ type: 'zz', t: ctl.NOW, n: ++n, d: dev })), dev);
    L = await post('/sxq', 'admin', { op: 'list', uid }); let hit = null;
    for (const nm of L.an) { const x = await post('/sxq', 'admin', { op: 'arch', uid, name: nm }); const q = (x.qz || []).find(r => r.n === G2.n); if (q) hit = q }
    T('الحدث انتقل إلى وثيقة أرشيف وتعرضه اللوحة', !!hit, L.an.length);
    r = await post('/sxq', 'admin', { op: 'apply', uid, qid: hit.qid }); a = await srv(uid);
    T('إعادة تطبيقه من الأرشيف: مقبول، والمراجعات +1 (المجموع 2)', r.st === 'ok' && a.reviews - b.reviews === 2, [r, a.reviews - b.reviews]);
    r = await post('/sxq', 'admin', { op: 'apply', uid, qid: hit.qid }); T('ومرة ثانية: «applied»', r.rej && r.rej[0][1] === 'applied', r);
    let err = ''; try { await post('/sxq', uid, { op: 'users' }) } catch (e) { err = e.message } T('متعلّم عادي لا يصل إلى اللوحة', / 403 /.test(err), err.slice(0, 30));
    const U = await post('/sxq', 'admin', { op: 'users' }); T('قائمة الحسابات تعرض حسابه', U.users.some(u => u.uid === uid), U.users.length) },

  // البند 1: عدّاد الصفحة توقّف أثناء نوم الهاتف (المرساة متأخّرة 10 ساعات) والساعة صحيحة → الحدث في وقته الصحيح لا في الماضي
  async anchorSleep() { const uid = 'as', A = await learner(uid); ctl.NOW += 2 * DAY + 12 * 36e5; const dev = A.dev(); let n = (ctl.NOW + 2e9);
    const evs = due(A).slice(0, 10).map((k, i) => ({ type: 'rate', k, r: 2, t: ctl.NOW + i * 20e3, a: ctl.NOW - 10 * 36e5 + i * 20e3, n: ++n, d: dev })); adv(300e3);
    await send(uid, evs, dev); const a = await srv(uid), tk = new Date(ctl.NOW).toISOString().slice(0, 10), yk = new Date(ctl.NOW - DAY).toISOString().slice(0, 10);
    T('المراجعات العشر حُسبت في اليوم الصحيح (لا أمس)', (a.e.per[tk] || { n: 0 }).n === 10 && !(a.e.per[yk] || { n: 0 }).n, { today: (a.e.per[tk] || {}).n, yesterday: (a.e.per[yk] || {}).n }) },

  // البند 3 (الخادم): حدث «big» بين حدثين في الدفعة نفسها: لا يوقف الباقي
  async bigMiddle() { const uid = 'bm', A = await learner(uid); const dev = A.dev(); let n = (ctl.NOW + 2e9); const ks = due(A);
    const evs = [{ type: 'rate', k: ks[0], r: 2, t: ctl.NOW, n: ++n, d: dev }, { type: 'quiz', kind: 's2', ok: 1, total: 10, ms: 1, t: ctl.NOW + 1e3, n: ++n, d: dev, blob: 'ع'.repeat(500000) },
      { type: 'rate', k: ks[1], r: 2, t: ctl.NOW + 20e3, n: ++n, d: dev }]; adv(60e3);
    const j = await send(uid, evs, dev); T('الحالات: مقبول، كبير، مقبول', j.st.join() === 'ok,big,ok', j.st) },

  // البند 1: ساعة متقدّمة يومًا والجهاز دون إنترنت 3 أيام. كل وضع في عملية مستقلة بالوقت نفسه (FC=ok|plain|page|native)، والمقارنة في run.sh
  // FCM=1: تغيير الساعة عدة مرات أثناء العمل دون إنترنت (يوم 0: +ساعتان، يوم 1: +يوم، يوم 2: −يومان، ثم تُصحَّح قبل المزامنة)
  async fcOne() { const mode = process.env.FC, multi = process.env.FCM === '1', uid = 'fc', A = await learner(uid); A.anchor = { ok: false, plain: false, page: 'page', native: 'native' }[mode]; A.skew = mode === 'ok' ? 0 : DAY;
    const SK = multi && mode !== 'ok' ? [2 * 36e5, DAY, -2 * DAY] : null;
    const day0 = ctl.NOW; const s0 = await srv(uid);
    for (let d = 0; d < 3; d++) { ctl.NOW = day0 + d * DAY + 3 * 36e5; if (SK) A.skew = SK[d]; for (const k of due(A).slice(0, 12)) { A.ev({ type: 'rate', k, r: 2 }); adv(20e3) } await station(A, { syncEach: false }) }
    if (SK) A.skew = 0; ctl.NOW = day0 + 2 * DAY + 10 * 36e5; const why = {}, stc = {}; let j; do { const q = A.q; j = await A.sync(); for (const r of j.rej || []) why[r[1]] = (why[r[1]] || 0) + 1; for (const x of j.st || []) stc[x] = (stc[x] || 0) + 1 } while (A.q);
    const a = await srv(uid);
    out.push('FCRES ' + JSON.stringify({ mode, xp: a.xp - s0.xp, gems: a.gems - s0.gems, streak: a.streak, reviews: a.reviews - s0.reviews, stations: a.stations - s0.stations, energy: Math.round(a.energy), ach: [...a.e.got].filter(x => !s0.e.got.has(x)), q: why, st: stc })) },

  // البند 2: إعادة التطبيق مع الضغط المتكرّر، وانقطاع الاتصال (فشل الكتابة، وضياع الردّ)، وتعارض الكتابة
  async reapplyStress() { const uid = 'rs', A = await learner(uid); const dev = A.dev(); ctl.NOW += 3 * 36e5; A.ev({ type: 'eday' }); await A.sync(); ctl.NOW += 40 * DAY; A.ev({ type: 'eday' }); await A.sync();
    const lo = ids(uid, dev).lo, ks = due(A); const b = await srv(uid);
    const G = i => ({ type: 'rate', k: ks[i], r: 2, t: ctl.NOW - 3600e3 + i * 60e3, n: lo - 20 + i, d: dev }); await send(uid, [G(0), G(1), G(2)], dev);
    const L = await post('/sxq', 'admin', { op: 'list', uid }), at = n => L.qz.find(q => q.n === n).qid;
    // ضغط متكرّر: ثلاثة طلبات معًا للمدخل نفسه
    const rr = await Promise.all([0, 1, 2].map(() => post('/sxq', 'admin', { op: 'apply', uid, qid: at(G(0).n) })));
    let a = await srv(uid); T('ثلاث ضغطات معًا: واحدة مقبولة والباقي «applied»، والمراجعات +1', rr.filter(r => r.st === 'ok').length === 1 && rr.filter(r => r.rej && r.rej[0] && r.rej[0][1] === 'applied').length === 2 && a.reviews - b.reviews === 1, rr.map(r => r.st + (r.rej && r.rej[0] ? ':' + r.rej[0][1] : '')));
    // انقطاع: فشل الكتابة → خطأ للمشرف، ولا تغيير؛ ثم إعادة الضغط → مقبول مرة واحدة
    const orig = memfs.commit; let fails = 1; memfs.commit = async function (ws) { if (fails-- > 0) throw new Error('شبكة'); return orig.call(this, ws) };
    let err = ''; try { await post('/sxq', 'admin', { op: 'apply', uid, qid: at(G(1).n) }) } catch (e) { err = e.message } memfs.commit = orig;
    a = await srv(uid); T('فشل الكتابة: خطأ ظاهر، ولا تغيير في الحساب', !!err && a.reviews - b.reviews === 1, [err.slice(0, 25), a.reviews - b.reviews]);
    let r = await post('/sxq', 'admin', { op: 'apply', uid, qid: at(G(1).n) }); a = await srv(uid);
    T('إعادة الضغط بعد الانقطاع: مقبول مرة واحدة', r.st === 'ok' && a.reviews - b.reviews === 2, [r.st, a.reviews - b.reviews]);
    r = await post('/sxq', 'admin', { op: 'apply', uid, qid: at(G(1).n) }); T('ضياع الردّ ثم ضغطة أخرى: «applied»، لا تكرار', r.rej && r.rej[0][1] === 'applied', r);
    // تعارض كتابة (متعلّم يزامن في اللحظة نفسها): الخادم يعيد العملية كلها، ويُطبَّق مرة واحدة
    let conf = 1; memfs.commit = async function (ws) { if (conf-- > 0) { const e = new Error('conflict'); e.conflict = true; throw e } return orig.call(this, ws) };
    r = await post('/sxq', 'admin', { op: 'apply', uid, qid: at(G(2).n) }); memfs.commit = orig; a = await srv(uid);
    T('تعارض كتابة: مقبول مرة واحدة بعد إعادة الخادم', r.st === 'ok' && a.reviews - b.reviews === 3, [r.st, a.reviews - b.reviews]);
    const L2 = await post('/sxq', 'admin', { op: 'list', uid }); T('المدخلات الثلاثة مسجّلة «ok» مرة واحدة لكلٍّ منها', [0, 1, 2].every(i => L2.qz.find(q => q.n === G(i).n).ap.r === 'ok'));
    T('مفاتيح إعادة التطبيق في sx: ثلاثة بلا تكرار', new Set(sxDoc(uid).ap).size === sxDoc(uid).ap.length && sxDoc(uid).ap.length === 3, sxDoc(uid).ap.length) },

  // البند 5: معرّف ثابت. المشرف يعرض القائمة، ثم تنقل مزامنةٌ المدخل إلى الأرشيف، ثم يضغط «إعادة التطبيق» → يُطبَّق المدخل نفسه
  async reapplyArchived() { const uid = 'rv', A = await learner(uid); const dev = A.dev(); ctl.NOW += 3 * 36e5; A.ev({ type: 'eday' }); await A.sync(); ctl.NOW += 40 * DAY; A.ev({ type: 'eday' }); await A.sync();
    const lo = ids(uid, dev).lo, ks = due(A); const b = await srv(uid);
    const G = { type: 'rate', k: ks[0], r: 2, t: ctl.NOW - 3600e3, n: lo - 9, d: dev }; await send(uid, [G], dev);
    const L = await post('/sxq', 'admin', { op: 'list', uid }); const row = L.qz.find(q => q.n === G.n);
    T('كل مدخل له معرّف ثابت', L.qz.every(q => /^q[a-z0-9-]+$/.test(q.qid)) && new Set(L.qz.map(q => q.qid)).size === L.qz.length, L.qz.length);
    let n = (ctl.NOW + 2e9); await send(uid, Array.from({ length: 300 }, () => ({ type: 'zz', t: ctl.NOW, n: ++n, d: dev })), dev);   // أرشفة بين العرض والضغط
    const L2 = await post('/sxq', 'admin', { op: 'list', uid }); T('المدخل انتقل إلى الأرشيف بعد عرض القائمة', !L2.qz.some(q => q.qid === row.qid) && L2.an.length > 0, L2.an.length);
    const [r1, r2] = await Promise.all([post('/sxq', 'admin', { op: 'apply', uid, qid: row.qid }), post('/sxq', 'admin', { op: 'apply', uid, qid: row.qid })]); const a = await srv(uid);
    T('الضغط بالمعرّف (مرتين معًا): المدخل نفسه يُطبَّق مرة واحدة من الأرشيف', [r1, r2].filter(r => r.st === 'ok').length === 1 && a.reviews - b.reviews === 1, [r1.st, r2.st, a.reviews - b.reviews]);
    const r3 = await post('/sxq', 'admin', { op: 'apply', uid, qid: 'qnotthere-0-x' }).catch(e => e.message); T('معرّف غير موجود: «noentry» ولا أثر', /noentry/.test(JSON.stringify(r3)), r3);
    let ar = null; for (const nm of L2.an) { const x = await post('/sxq', 'admin', { op: 'arch', uid, name: nm }); ar = ar || (x.qz || []).find(q => q.qid === row.qid) }
    T('نتيجة إعادة التطبيق تظهر على المدخل في الأرشيف', ar && ar.ap && ar.ap.r === 'ok', ar && ar.ap) },

  // البند 8: التحقق من معرّف الجهاز ورقم الحدث عند الخادم
  async badIds() { const uid = 'bi', A = await learner(uid); const k = due(A)[0], t = ctl.NOW; const b = await srv(uid);
    const cases = [['معرّف جهاز برموز غير مقبولة', { d: 'dev<script>', n: t * 10 }], ['معرّف جهاز قصير', { d: 'ab', n: t * 10 + 1 }], ['معرّف جهاز ليس نصًّا', { d: 12345678, n: t * 10 + 2 }],
      ['رقم سالب', { d: 'devGood1', n: -5 }], ['رقم كسري', { d: 'devGood1', n: 1.5 }], ['رقم نصّي', { d: 'devGood1', n: '123' }], ['رقم أكبر من الآمن', { d: 'devGood1', n: 2 ** 60 }], ['رقم بعيد في المستقبل', { d: 'devGood1', n: t + 500 * DAY }]];
    for (const [name, id] of cases) { const j = await send(uid, [{ type: 'rate', k, r: 2, t, ...id }], 'devGood1'); T(name + ': الحجر «badid»', j.st[0] === 'q' && j.rej[0][1] === 'badid', [j.st, j.rej]) }
    const a = await srv(uid); T('لم يُطبَّق أيّ منها', a.reviews === b.reviews, a.reviews - b.reviews);
    const j = await send(uid, [{ type: 'rate', k, r: 2, t: ctl.NOW + 1e3 }], 'x'); T('حدث بلا هوية إطلاقًا (تطبيق قديم): يُقبل كما كان', j.st[0] === 'ok', j.st) },

  // البند 3: حجم الحدث يُفحص قبل الحجر حتى مع هوية غير صالحة
  async badIdBig() { const uid = 'bb', A = await learner(uid); const k = due(A)[0], t = ctl.NOW;
    const j1 = await send(uid, [{ type: 'rate', k, r: 2, t, d: 'dev<x>', n: t + 1, pad: 'ض'.repeat(500000) }], 'devGood1');
    T('هوية غير صالحة وحجم > 900 كيلوبايت: «big»، لا يدخل الحجر ولا تفشل المزامنة', j1.st[0] === 'big' && sxDoc(uid).qz.length === 0, [j1.st, j1.rej]);
    const j2 = await send(uid, [{ type: 'rate', k, r: 2, t, d: 'dev<x>', n: t + 2, pad: 'ض'.repeat(25000) }], 'devGood1'); const q = sxDoc(uid).qz.at(-1);
    T('هوية غير صالحة وحجم 50 كيلوبايت: الحجر «badid» بوثيقة مرجعية منفصلة', j2.st[0] === 'q' && j2.rej[0][1] === 'badid' && q[2].ref && DB.has(`users/${uid}/data/${q[2].ref}`), [j2.st, q && q[2]]);
    T('وثيقة sx بقيت صغيرة', bytes(doc(`users/${uid}/data/sx`)) < 40000, bytes(doc(`users/${uid}/data/sx`))) },

  // البند 1 (الجولة الأخيرة): أثر الأرض العامة على الأجهزة السليمة والأحداث غير المتزامنة — مقارنة السيناريو نفسه مع طيّ الأجهزة وبدونه
  async gloOne() { const fill = process.env.GF === '1', uid = 'gi', A = await learner(uid, 3, true), B = app('new', uid); await B.sync(); const res = { st: {}, q: {} };
    if (fill) { let n = ctl.NOW; for (let b = 0; b < 7; b++) await send(uid, Array.from({ length: 100 }, (_, i) => ({ type: 'zz', t: ctl.NOW, n: ++n, d: 'gf' + (b * 100 + i) })), 'gf0') }
    const day0 = ctl.NOW;
    // A يدرس 45 يومًا دون اتصال (مراجعات كل يوم، ومحطة كل 5 أيام)؛ B يزامن في اليوم 40 فيُطوى سجلّ A نفسه (خامل) مع الأجهزة الأخرى
    for (let d = 1; d <= 45; d++) { ctl.NOW = day0 + d * DAY; for (const k of due(A).slice(0, 4)) { A.ev({ type: 'rate', k, r: 2 }); adv(20e3) } if (d % 5 === 0) await station(A, { syncEach: false });
      if (d === 40) { B.ev({ type: 'eday' }); await B.sync(); res.devAfterFold = Object.keys(sxDoc(uid).dv).length; res.aFolded = !sxDoc(uid).dv[A.dev()] } }
    let j; do { j = await A.sync(); for (const x of j.st || []) res.st[x] = (res.st[x] || 0) + 1; for (const r of j.rej || []) res.q[r[1]] = (res.q[r[1]] || 0) + 1 } while (A.q);
    const a = await srv(uid); Object.assign(res, { xp: a.xp, gems: a.gems, streak: a.streak, reviews: a.reviews, stations: a.stations, words: a.words, glo: sxDoc(uid).glo || 0, now: ctl.NOW });
    // جهاز جديد ساعته صحيحة، وجهاز جديد ساعته متأخّرة 60 يومًا (الحالة الوحيدة التي تتأثّر)
    const k = due(A)[0]; const r1 = await send(uid, [{ type: 'rate', k, r: 2, t: ctl.NOW, n: ctl.NOW, d: 'newOk01' }], 'newOk01'); res.newOk = r1.st[0];
    const r2 = await send(uid, [{ type: 'rate', k, r: 2, t: ctl.NOW, n: ctl.NOW - 60 * DAY, d: 'newLag01' }], 'newLag01'); res.lag = [r2.st[0], (r2.rej[0] || [])[1] || null];
    const r3 = await send(uid, [{ type: 'rate', k, r: 2, t: ctl.NOW + 60e3, n: Math.max(r2.dn, ctl.NOW - 60 * DAY) + 1, d: 'newLag01' }], 'newLag01'); res.lagNext = r3.st[0]; res.dnGlo = r2.dn >= res.glo;
    out.push('GLRES ' + JSON.stringify(res)) },

  // البند 2 (الجولة الأخيرة): قائمة وثائق الفهرس ai نفسها محدودة — عند بلوغ 50 تنتقل أسماؤها إلى وثيقة الفهرس الجديدة (سلسلة)
  async aiChain() { const uid = 'ac', A = await learner(uid); const G = { type: 'rate', k: due(A)[0], r: 2, t: ctl.NOW - 3600e3, n: 5, d: 'acdev01' };
    { const D0 = sxDoc(uid); D0.glo = 1e6; await memfs.commit([{ path: `users/${uid}/data/sx`, data: { v: JSON.stringify(D0) } }]) }   // جهاز جديد يبدأ بأرض عامة > 5: الحدث إلى الحجر
    await send(uid, [G], 'acdev01'); let L = await post('/sxq', 'admin', { op: 'list', uid }); const qid = L.qz.find(q => q.n === 5).qid;
    let r = await post('/sxq', 'admin', { op: 'apply', uid, qid }); T('إعادة تطبيق أولى: مقبولة', r.st === 'ok', r);
    // 50 وثيقة فهرس قديمة (أولاها تحمل مفتاح إعادة التطبيق الحقيقي واسم أرشيف حقيقي)
    const D = sxDoc(uid), names = Array.from({ length: 50 }, (_, i) => 'sxi-old-' + i), real = D.ap.splice(0), W = [];
    names.forEach((nm, i) => W.push({ path: `users/${uid}/data/${nm}`, data: { v: JSON.stringify({ an: ['sxa-chain-' + i], ap: i === 0 ? real : [], am: {}, at: 1 }) } }));
    W.push({ path: `users/${uid}/data/sxa-chain-0`, data: { v: JSON.stringify({ qz: [], late: [], at: 1 }) } });
    D.ai = names; D.ap.push(...Array.from({ length: 3000 }, (_, i) => 'pad-key-' + i + '-xxxxxxxxxxxx')); W.push({ path: `users/${uid}/data/sx`, data: { v: JSON.stringify(D) } }); await memfs.commit(W);
    A.ev({ type: 'eday' }); await A.sync(); const S = sxDoc(uid), nx = JSON.parse(doc(`users/${uid}/data/${S.ai[0]}`));
    T('بعد النقل: قائمة ai في sx فيها اسم واحد، والوثيقة الجديدة تحمل أسماء الخمسين', S.ai.length === 1 && nx.ai.length === 50, [S.ai.length, nx.ai && nx.ai.length]);
    L = await post('/sxq', 'admin', { op: 'list', uid }); T('اللوحة تقرأ السلسلة كلها (أسماء الأرشيف من الطبقة الثانية)', L.an.includes('sxa-chain-0') && L.an.includes('sxa-chain-49'), L.an.length);
    r = await post('/sxq', 'admin', { op: 'apply', uid, qid }); T('مفتاح إعادة التطبيق في الطبقة الثانية يُرى: «applied»، لا تكرار', r.rej && r.rej[0][1] === 'applied', r);
    const ROOT = 'projects/mufradati-406bd/databases/(default)/documents';
    const enc = v => typeof v === 'string' ? { stringValue: v } : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : typeof v === 'boolean' ? { booleanValue: v } : v === null ? { nullValue: null } : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } } : (v && v.ms !== undefined && Object.keys(v).length === 1) ? { timestampValue: new Date(v.ms).toISOString() } : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
    env.__export = async () => { const arr = [...DB].map(([p, d]) => ({ document: { name: ROOT + '/' + p, fields: Object.fromEntries(Object.entries(d.data).map(([k, v]) => [k, enc(v)])), updateTime: d.ut }, readTime: '' })); return { parts: [JSON.stringify(arr)], n: arr.length, users: 1 } };
    const key = (await post('/backup', 'admin', { op: 'now', rid: 'aiChain00001' })).key; let v = await post('/backup', 'admin', { op: 'verify', key });
    T('التحقق الكامل يقرأ السلسلة: sx والأرشيف «same»', v.accts[uid].docs.sx === 'same' && v.accts[uid].docs.sxa === 'same', v.accts[uid].docs);
    const keep = DB.get(`users/${uid}/data/sxi-old-30`).data; await memfs.commit([{ path: `users/${uid}/data/sxi-old-30`, del: true }]); v = await post('/backup', 'admin', { op: 'verify', key });
    T('وثيقة فهرس من الطبقة الثانية حُذفت: التحقق يرى الفرق', v.accts[uid].docs.sxa === 'diff', v.accts[uid].docs);
    let e = ''; try { await post('/wipe', 'admin', { uid }) } catch (x) { e = x.message } T('وثيقة فهرس مفقودة: الحذف يتوقّف (لا حذف جزئي يترك أرشيفًا يتيمًا)', / 500 /.test(e) && DB.has(`users/${uid}/data/sxi-old-0`), e.slice(0, 60));
    await memfs.commit([{ path: `users/${uid}/data/sxi-old-30`, data: keep }]);   // بعد إعادتها (من النسخة الاحتياطية)
    await post('/wipe', 'admin', { uid }); const left = [...DB.keys()].filter(p => p.startsWith(`users/${uid}/data/sxi-`) || p.startsWith(`users/${uid}/data/sxa-`));
    T('الحذف يمسح السلسلة كلها (51 وثيقة فهرس والأرشيف)', !left.length, left.length) },

  // التراجع والمتأخّرات: on ثم ids:1 ثم إطفاء كامل ثم on، والمتأخّرات لا تُحذف من sx في أي وضع
  async rollbackLate() { const uid = 'rl', A = await learner(uid); const k = due(A)[0], t = ctl.NOW; ctl.NOW += 3 * 36e5;
    await send(uid, [{ type: 'rate', k, r: 2, t: ctl.NOW, n: ctl.NOW, d: 'rlDevA1' }], 'rlDevA1');
    const j1 = await send(uid, [{ type: 'rate', k, r: 2, t: ctl.NOW - 36e5, n: ctl.NOW - 36e5, d: 'rlDevB1' }], 'rlDevB1');
    T('مراجعة أقدم من مراجعة أحدث للكلمة نفسها: «late»', j1.st[0] === 'late', j1.st);
    const day = new Date(ctl.NOW).toISOString().slice(0, 10), per = async () => { adv(61e3); const B = app('new', uid); const j = await B.sync(); const L = JSON.parse(j.late || 'null');   // الإعدادات تُخزَّن في الخادم دقيقة
      return { n: (B.E().per[day] || { n: 0 }).n + L.L.filter(x => new Date(x[0]).toISOString().slice(0, 10) === day).length + (+L.F[day] || 0), L } };   // نشاط اليوم كما تحسبه السلسلة (مع المتأخّرات)
    const on = await per(); await cfg({ on: 0, ids: 1 }); const ids = await per(); await memfs.commit([{ path: 'config/app', data: { v: JSON.stringify({ sx: { on: 0 } }) } }]); const off = await per();
    const kept = sxDoc(uid).late.length; await cfg({}); const back = await per();
    I('مراجعات اليوم وقائمة المتأخّرات في كل وضع', { on: [on.n, on.L.L.length], ids: [ids.n, ids.L.L.length], off: [off.n, off.L.L.length], back: [back.n, back.L.L.length] });
    T('ids:1: المتأخّرة ما زالت محسوبة في نشاط يومها، وتصل الصفحة', ids.n === on.n && ids.L.L.length === 1, [on.n, ids.n]);
    T('إطفاء كامل: الخادم يتجاهلها (سلوك النسخة المنشورة)، ويرسل قائمة فارغة فتطابقه الصفحة', off.n === on.n - 1 && off.L.L.length === 0, [on.n, off.n]);
    T('ولا تُحذف من sx، وتعود كاملة عند إعادة التشغيل', kept === 1 && back.n === on.n && back.L.L.length === 1, [kept, back.n]) },

  // دراسة (مدّة القبول 30 يومًا كما هي): استعادة ما حُجر بعد 45 يومًا دون اتصال. RO=online: المتعلّم نفسه يزامن كل يوم (المرجع)؛
  // RO=asis: دون استعادة؛ RO=queue: إعادة التطبيق بترتيب لوحة الحجر مرة واحدة؛ RO=seq: بترتيب أرقام الأحداث لكل جهاز، مع جولات تُعاد فيها ما رُفض لأن كلمته لم تُتعلَّم بعد
  async roOne() { const mode = process.env.RO, uid = 'ro', A = await learner(uid, 3, true); const day0 = ctl.NOW, res = { mode, st: {}, q: {}, ap: {} };
    for (let d = 1; d <= 45; d++) { ctl.NOW = day0 + d * DAY; for (const k of due(A).slice(0, 4)) { A.ev({ type: 'rate', k, r: 2 }); adv(20e3) } if (d % 5 === 0) await station(A, { syncEach: false }); if (mode === 'online') { let j; do { j = await A.sync() } while (A.q) } }
    let j; do { j = await A.sync(); for (const x of j.st || []) res.st[x] = (res.st[x] || 0) + 1; for (const r of j.rej || []) res.q[r[1]] = (res.q[r[1]] || 0) + 1 } while (A.q);
    if (mode === 'queue' || mode === 'seq') { const L = (await post('/sxq', 'admin', { op: 'list', uid })).qz.filter(q => !q.ap); let todo = mode === 'seq' ? L.sort((a, b) => (a.d > b.d) - (a.d < b.d) || a.n - b.n) : L;
      for (let pass = 0; pass < (mode === 'seq' ? 5 : 1) && todo.length; pass++) { const again = [];
        for (const q of todo) { const r = await post('/sxq', 'admin', { op: 'apply', uid, qid: q.qid }); const why = r.st === 'ok' ? 'ok' : (r.rej[0] || [])[1] || r.st; res.ap[why] = (res.ap[why] || 0) + 1; if (why === 'word') again.push(q) }
        if (again.length === todo.length) break; todo = again; if (again.length) res.ap['word'] -= again.length } }
    const a = await srv(uid); Object.assign(res, { xp: a.xp, gems: a.gems, streak: a.streak, reviews: a.reviews, stations: a.stations, words: a.words });
    out.push('RORES ' + JSON.stringify(res)) },

  // حدّ سجلّات الأجهزة 2000 دون طيّ أرض حديثة: أجهزة بساعات متقدّمة لا تُطوى، وجهاز جديد بعد الحدّ إلى الحجر «devmax»، ثم يُقبل حين يتجاوز الوقت أرضها
  async devCap() { const uid = 'dc', A = await learner(uid); const k = due(A)[0]; let n = ctl.NOW + 200 * DAY; const before = Object.keys(sxDoc(uid).dv).length;
    for (let b = 0; b < 20; b++) await send(uid, Array.from({ length: 100 }, (_, i) => ({ type: 'zz', t: ctl.NOW, n: ++n, d: 'fwd' + (b * 100 + i) })), 'fwd0');
    ctl.NOW += 40 * DAY; A.ev({ type: 'eday' }); await A.sync(); const S = sxDoc(uid), nd = Object.keys(S.dv).length;
    T('أجهزة خاملة أرضها في المستقبل: لا تُطوى، والأرض العامة لم تتقدّم', nd >= 2000 && (S.glo || 0) < ctl.NOW, { devices: nd, glo: S.glo || 0 });
    const r1 = await send(uid, [{ type: 'rate', k, r: 2, t: ctl.NOW, n: ctl.NOW, d: 'newDev01' }], 'newDev01');
    T('جهاز جديد بعد بلوغ الحدّ: الحجر «devmax» (لا يضيع، ولا سجلّ جديد)', r1.st[0] === 'q' && r1.rej[0][1] === 'devmax' && !sxDoc(uid).dv.newDev01, [r1.st, r1.rej]);
    const r0 = await send(uid, [{ type: 'rate', k, r: 2, t: ctl.NOW, n: ctl.NOW + 5, d: A.dev() }], A.dev()); T('الأجهزة المعروفة تعمل كالمعتاد', r0.st[0] === 'ok', r0.st);
    T('حجم وثيقة sx محدود (أقل من 200 كيلوبايت)', bytes(doc(`users/${uid}/data/sx`)) < 200000, bytes(doc(`users/${uid}/data/sx`)));
    const L = await post('/sxq', 'admin', { op: 'list', uid }); const q = L.qz.find(x => x.why === 'devmax' && x.type === 'rate'); const ra = await post('/sxq', 'admin', { op: 'apply', uid, qid: q.qid });
    T('إعادة تطبيقه من اللوحة والحدّ ما زال ممتلئًا: مرفوض «devmax» (إعادة التطبيق لا تتجاوز الحدّ)، ولا سجلّ جديد', ra.st === 'q' && ra.rej[0][1] === 'devmax' && !sxDoc(uid).dv.newDev01 && Object.keys(sxDoc(uid).dv).length <= 2000, ra);
    ctl.NOW += 200 * DAY; A.ev({ type: 'eday' }); await A.sync(); const S2 = sxDoc(uid);
    const rb = await post('/sxq', 'admin', { op: 'apply', uid, qid: q.qid }); T('بعد الطيّ: إعادة تطبيقه مقبولة («ok» أو «late» إن كانت للكلمة مراجعة أحدث)', rb.st === 'ok' || rb.st === 'late', rb);
    T('بعد أن يتجاوز الوقت أرضها: تُطوى إلى 500، والأرض العامة أقدم من مدّة القبول', Object.keys(S2.dv).length <= 502 && S2.glo < ctl.NOW - 32 * DAY, { devices: Object.keys(S2.dv).length, glo: S2.glo });
    const r2 = await send(uid, [{ type: 'rate', k, r: 2, t: ctl.NOW, n: ctl.NOW, d: 'newDev02' }], 'newDev02'); T('ثم جهاز جديد: يُقبل', r2.st[0] === 'ok', r2.st) },

  // سلسلة فهرس أعمق من 64 طبقة: لا تجاهل صامت — اللوحة والحذف يتوقّفان بخطأ واضح، والتحقق «incomplete»؛ و64 طبقة تعمل كاملة
  async deepChain() { const mk = async (uid, depth) => { await user(uid); const A = app('new', uid); A.ev({ type: 'eday' }); await A.sync(); const W = [];
      for (let i = 0; i < depth; i++) W.push({ path: `users/${uid}/data/sxi-deep-${i}`, data: { v: JSON.stringify({ an: ['sxa-deep-' + i], ap: [], am: {}, ai: i + 1 < depth ? ['sxi-deep-' + (i + 1)] : [], at: 1 }) } });
      const D = sxDoc(uid); D.ai = ['sxi-deep-0']; W.push({ path: `users/${uid}/data/sx`, data: { v: JSON.stringify(D) } }); for (let i = 0; i < W.length; i += 400) await memfs.commit(W.slice(i, i + 400)) };
    await mk('dp64', 64); let L = await post('/sxq', 'admin', { op: 'list', uid: 'dp64' }); T('64 طبقة: اللوحة تقرأها كلها', L.an.includes('sxa-deep-0') && L.an.includes('sxa-deep-63'), L.an.length);
    await mk('dp65', 65); let err = ''; try { await post('/sxq', 'admin', { op: 'list', uid: 'dp65' }) } catch (e) { err = e.message }
    T('65 طبقة: اللوحة تتوقّف بخطأ واضح (لا قائمة ناقصة)', / 500 /.test(err) && /sx index depth/.test(err), err.slice(0, 80));
    err = ''; try { await post('/wipe', 'admin', { uid: 'dp65' }) } catch (e) { err = e.message } T('والحذف يتوقّف قبل أي كتابة (لا حذف جزئي)', / 500 /.test(err) && DB.has('users/dp65/data/sxi-deep-64') && DB.has('users/dp65/data/sxi-deep-0'), err.slice(0, 60));
    const ROOT = 'projects/mufradati-406bd/databases/(default)/documents';
    const enc = v => typeof v === 'string' ? { stringValue: v } : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : typeof v === 'boolean' ? { booleanValue: v } : v === null ? { nullValue: null } : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } } : (v && v.ms !== undefined && Object.keys(v).length === 1) ? { timestampValue: new Date(v.ms).toISOString() } : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
    env.__export = async () => { const arr = [...DB].map(([p, d]) => ({ document: { name: ROOT + '/' + p, fields: Object.fromEntries(Object.entries(d.data).map(([k, v]) => [k, enc(v)])), updateTime: d.ut }, readTime: '' })); return { parts: [JSON.stringify(arr)], n: arr.length, users: 1 } };
    const key = (await post('/backup', 'admin', { op: 'now', rid: 'deepChain001' })).key; const v = await post('/backup', 'admin', { op: 'verify', key });
    T('التحقق: 64 طبقة «same»، و65 «incomplete» والنتيجة ليست مطابقة', v.accts.dp64.docs.sxa === 'same' && v.accts.dp65.docs.sxa === 'incomplete' && v.result !== 'match', [v.accts.dp64.docs.sxa, v.accts.dp65.docs.sxa, v.result]) },

  // استعادة جهاز بالترتيب: معاينة بلا كتابة، وتأكيد ببصمة الخطة، وجولات، ومنع التكرار (ضغطتان معًا، وتكرار التشغيل)، وتوقّف عند فهرس مفقود أو تالف
  async restoreDev() { const uid = 'rd', A = await learner(uid, 3, true); const day0 = ctl.NOW, dev = A.dev();
    for (let d = 1; d <= 45; d++) { ctl.NOW = day0 + d * DAY; for (const k of due(A).slice(0, 4)) { A.ev({ type: 'rate', k, r: 2 }); adv(20e3) } if (d % 5 === 0) await station(A, { syncEach: false }) }
    let j; do { j = await A.sync() } while (A.q);
    const dump = () => JSON.stringify([...DB].filter(([p]) => p.startsWith(`users/${uid}/`)).map(([p, d]) => [p, d.ut]).sort());
    const s0 = dump(); const P = await post('/sxq', 'admin', { op: 'restore', uid, dev, mode: 'preview' });
    I('المعاينة', { n: P.n, count: P.count, before: P.before, after: P.after });
    T('المعاينة لا تكتب شيئًا', dump() === s0);
    T('المعاينة: كل ما حُجر لقاعدة الكلمات يُطبَّق في جولة لاحقة، والكلمات والمحطات تزيد', !P.count.word && P.after.words > P.before.words && P.after.stations > P.before.stations, [P.count, P.before, P.after]);
    let e = ''; try { await post('/sxq', 'admin', { op: 'restore', uid, dev, mode: 'run', plan: P.plan }) } catch (x) { e = x.message } T('التنفيذ بلا تأكيد: مرفوض', / 400 /.test(e) && /confirm/.test(e), e.slice(0, 50));
    e = ''; try { await post('/sxq', 'admin', { op: 'restore', uid, dev, mode: 'run', plan: 'x', confirm: true }) } catch (x) { e = x.message } T('ببصمة خطة مختلفة: «stale»', / 409 /.test(e), e.slice(0, 50));
    const run = async () => { let round = 1, calls = 0; for (;;) { calls++; const r = await post('/sxq', 'admin', { op: 'restore', uid, dev, mode: 'run', plan: P.plan, confirm: true, round }); if (r.more) continue; if (r.word && round < 3) { round++; continue } return calls } };
    // ضغطتان معًا (تُنفَّذان تباعًا في الخادم)، ثم تشغيل ثالث بعد الانتهاء
    await Promise.all([run(), run()]); const a1 = await srv(uid); await run(); const a2 = await srv(uid);
    const pick = x => ({ xp: x.xp, reviews: x.reviews, words: x.words, stations: x.stations });
    T('النتيجة الفعلية = المعاينة (الخبرة والمراجعات والكلمات والمحطات)', JSON.stringify(pick(a1)) === JSON.stringify(pick(P.after)), [pick(a1), pick(P.after)]);
    T('ضغطتان معًا ثم تشغيل ثالث: لا شيء يُطبَّق مرتين', JSON.stringify(pick(a2)) === JSON.stringify(pick(a1)), [pick(a1), pick(a2)]);
    const P2 = await post('/sxq', 'admin', { op: 'restore', uid, dev, mode: 'preview' }); T('معاينة بعد التنفيذ: لا شيء يتغيّر', JSON.stringify(P2.after) === JSON.stringify(P2.before), [P2.before, P2.after]);
    // مدخل جديد للجهاز بعد المعاينة: البصمة تتغيّر
    await send(uid, [{ type: 'rate', k: due(A)[0], r: 2, t: ctl.NOW - 40 * DAY, n: ctl.NOW - 40 * DAY, d: dev }], dev);
    e = ''; try { await post('/sxq', 'admin', { op: 'restore', uid, dev, mode: 'run', plan: P2.plan, confirm: true }) } catch (x) { e = x.message } T('حدث جديد للجهاز بعد المعاينة: «stale»، تُعاد المعاينة', / 409 /.test(e), e.slice(0, 50));
    // سلامة الفهرس والأرشيف
    const D = sxDoc(uid); D.ai = ['sxi-gone-1']; await memfs.commit([{ path: `users/${uid}/data/sx`, data: { v: JSON.stringify(D) } }]);
    for (const [name, op] of [['المعاينة', { op: 'restore', uid, dev, mode: 'preview' }], ['اللوحة', { op: 'list', uid }]]) { e = ''; try { await post('/sxq', 'admin', op) } catch (x) { e = x.message } T('وثيقة فهرس مفقودة: ' + name + ' تتوقّف بخطأ واضح', / 500 /.test(e) && /sx index missing/.test(e), e.slice(0, 70)) }
    const before = dump(); e = ''; try { await post('/wipe', 'admin', { uid }) } catch (x) { e = x.message } T('وثيقة فهرس مفقودة: الحذف يتوقّف قبل أي كتابة', / 500 /.test(e) && dump() === before, e.slice(0, 60));
    await memfs.commit([{ path: `users/${uid}/data/sxi-gone-1`, data: { v: '{"an": "not-a-list"' } }]);
    e = ''; try { await post('/sxq', 'admin', { op: 'restore', uid, dev, mode: 'preview' }) } catch (x) { e = x.message } T('وثيقة فهرس تالفة: تتوقّف بخطأ واضح', / 500 /.test(e) && /sx index corrupt/.test(e), e.slice(0, 70));
    e = ''; try { await post('/wipe', 'admin', { uid }) } catch (x) { e = x.message } T('وثيقة فهرس تالفة: الحذف يتوقّف قبل أي كتابة', / 500 /.test(e) && DB.has(`users/${uid}/data/core`), e.slice(0, 60));
    D.ai = []; D.an = [...(D.an || []), 'sxa-gone-1']; await memfs.commit([{ path: `users/${uid}/data/sx`, data: { v: JSON.stringify(D) } }]);
    e = ''; try { await post('/sxq', 'admin', { op: 'restore', uid, dev, mode: 'preview' }) } catch (x) { e = x.message } T('وثيقة أرشيف مفقودة: الاستعادة تتوقّف بخطأ واضح', / 500 /.test(e) && /sx archive missing/.test(e), e.slice(0, 70)) },

  // ردود الخادم الحقيقية (كل الحالات) تمرّ فحص الصفحة syncChk: لا تباعد بين الخادم والصفحة
  async replyChk() { const src = (await import('node:fs')).readFileSync(process.argv[3] + '/index.html', 'utf8');
    const syncChk = new Function(src.slice(src.indexOf('const SX_ST='), src.indexOf('async function syncNow(')) + ';return syncChk')();
    const uid = 'rc', A = await learner(uid); const k = due(A)[0], t = ctl.NOW; let n = ctl.NOW + 2e9;
    const evs = [{ type: 'rate', k, r: 2, t, n: ++n, d: 'rcdev1' }, { type: 'rate', k, r: 2, t, n, d: 'rcdev1' }, { type: 'zz', t, n: ++n, d: 'rcdev1' },
      { type: 'rate', k, r: 2, t: t - 20 * DAY, n: ++n, d: 'rcdev1' }, { type: 'rate', k, r: 2, t, d: 'bad<>', n: ++n }, { type: 'zz', t, n: ++n, d: 'rcdev1', pad: 'ض'.repeat(500000) }];
    const j = await send(uid, evs, 'rcdev1'); T('ردّ فيه حالات متنوّعة يمرّ فحص الصفحة', syncChk(j, evs.length) === '', [j.st, syncChk(j, evs.length)]);
    const j0 = await send(uid, [], 'rcdev1'); T('ردّ بلا أحداث يمرّ فحص الصفحة', syncChk(j0, 0) === '');
    await cfg({ on: 0 }); const j1 = await send(uid, [{ type: 'rate', k, r: 2, t: ctl.NOW }], 'x'); T('والمفتاح مطفأ: يمرّ أيضًا', syncChk(j1, 1) === '', j1.st); await cfg({}) },

  // البند 4: حدود كل مكوّنات sx — سجلّات الأجهزة، وقوائم الفهارس
  async sxBounds() { const uid = 'sb', A = await learner(uid); const k = due(A)[0]; let n = ctl.NOW + 2e9;
    // 700 جهاز، حدث واحد لكل منها، ثم 40 يومًا → خاملة
    n = ctl.NOW; for (let b = 0; b < 7; b++) await send(uid, Array.from({ length: 100 }, (_, i) => ({ type: 'zz', t: ctl.NOW, n: ++n, d: 'mdev' + (b * 100 + i) })), 'mdev0');
    const old = { type: 'rate', k, r: 2, t: ctl.NOW, n: ++n, d: 'mdev3' }; await send(uid, [old], 'mdev3');
    ctl.NOW += 40 * DAY; A.ev({ type: 'eday' }); await A.sync(); const sx = sxDoc(uid), nd = Object.keys(sx.dv).length;
    T('الأجهزة الخاملة ≤ 500، والزائد مطويّ في الأرض العامة (وهي أقدم من كل مدّة قبول)', nd <= 502 && sx.glo >= n - 800 && sx.glo < ctl.NOW - 32 * DAY, { devices: nd, glo: sx.glo });
    const b = await srv(uid); const r1 = await send(uid, [old], 'mdev3'); const a = await srv(uid);
    T('حدث قديم من جهاز مطويّ يُعاد: لا يُطبَّق مرة ثانية', r1.st[0] === 'q' && a.reviews === b.reviews, [r1.st, r1.rej]);
    const r2 = await send(uid, [{ type: 'rate', k, r: 2, t: ctl.NOW, n: ctl.NOW + 5, d: 'brandNew1' }], 'brandNew1');
    T('جهاز جديد بساعة صحيحة: يُقبل (الأرض العامة ليست أمامه)', r2.st[0] === 'ok', [r2.st, r2.rej]);
    // جهاز ساعته متقدّمة سنة لا يرفع الأرض العامة ما دام العدد دون ضعف الحدّ
    await send(uid, [{ type: 'zz', t: ctl.NOW, n: ctl.NOW + 300 * DAY, d: 'futureDev' }], 'futureDev'); ctl.NOW += 40 * DAY; await A.sync();
    T('أرض جهاز في المستقبل لا تُطوى في الأرض العامة', sxDoc(uid).glo < ctl.NOW, sxDoc(uid).glo);
    // الفهارس: مفتاح أُعيد تطبيقه حقيقي، ثم 3000 مفتاح وهمي → يُنقل الأقدم إلى وثيقة فهرس
    const G = { type: 'rate', k: due(A)[1], r: 2, t: ctl.NOW - 3600e3, n: 5, d: 'brandNew1' }; await send(uid, [G], 'brandNew1');
    let L = await post('/sxq', 'admin', { op: 'list', uid }); const qid = L.qz.find(q => q.n === 5).qid;
    let r = await post('/sxq', 'admin', { op: 'apply', uid, qid }); T('إعادة تطبيق قبل النقل: مقبول', r.st === 'ok', r);
    const D = sxDoc(uid); D.ap.push(...Array.from({ length: 3000 }, (_, i) => 'pad-key-' + i + '-xxxxxxxxxxxx')); D.an.push(...Array.from({ length: 300 }, (_, i) => 'sxa-pad-' + i));
    await memfs.commit([{ path: `users/${uid}/data/sx`, data: { v: JSON.stringify(D) } }]);
    A.ev({ type: 'eday' }); await A.sync(); const S = sxDoc(uid), ix = bytes(JSON.stringify([S.an, S.ap, S.am]));
    T('الفهارس في sx ≤ 60 كيلوبايت، والأقدم في وثيقة فهرس', ix <= 60000 && S.ai.length >= 1 && DB.has(`users/${uid}/data/${S.ai[0]}`) && !S.ap.includes(D.ap[0]), { ix, ai: S.ai.length });
    L = await post('/sxq', 'admin', { op: 'list', uid }); T('اللوحة تعرض كل أسماء الأرشيف (ومنها المنقولة)', L.an.includes('sxa-pad-0') && L.an.includes('sxa-pad-299'), L.an.length);
    r = await post('/sxq', 'admin', { op: 'apply', uid, qid }); T('إعادة التطبيق مرة ثانية بعد نقل مفتاحه: «applied»، لا تكرار', r.rej && r.rej[0][1] === 'applied', r);
    await post('/wipe', 'admin', { uid }); const W = sxDoc(uid);
    T('الحذف يمسح وثائق الفهرس والأرشيف كلها', !W.ai.length && ![...DB.keys()].some(p => p.startsWith(`users/${uid}/data/sxi-`) || p.startsWith(`users/${uid}/data/sxa-`)), W.ai) },

  // البند 6: كل ردّ من الخادم الجديد فيه sxv وst كاملة، ولو كان المفتاح مطفأً
  async ackMarker() { const uid = 'am2', A = await learner(uid); const k = due(A)[0];
    const j1 = await send(uid, [{ type: 'rate', k, r: 2, t: ctl.NOW, d: A.dev(), n: (ctl.NOW + 2e9) }], A.dev()); T('المفتاح مشغَّل: sxv وst بطول الدفعة', j1.sxv === 1 && j1.st.length === 1, [j1.sxv, j1.st]);
    await memfs.commit([{ path: 'config/app', data: { v: JSON.stringify({ sx: { on: 0 } }) } }]); adv(20e3);
    const j2 = await send(uid, [{ type: 'rate', k: due(A)[1], r: 2, t: ctl.NOW }, {}, null], A.dev()); T('المفتاح مطفأ: sxv وst بطول الدفعة أيضًا (ومنها الحدث التالف)', j2.sxv === 1 && j2.st.length === 3, [j2.sxv, j2.st]);
    await memfs.commit([{ path: 'config/app', data: { v: JSON.stringify({ sx: { on: 1 } }) } }]) },

  // البند 7: النمو على المدى الطويل (أسوأ من الاستعمال العادي): 3 سنوات، مزامنة يومية، جهاز جديد كل أسبوع (إعادة تثبيت)،
  // وثلاثة أحداث يوميًا إلى الحجر. يُقاس: حجم وثيقة sx، وسجلّات الأجهزة، وأسماء الأرشيف، وعدد الأرقام المحفوظة، ووثائق الأرشيف
  async longTerm() { const uid = 'lt'; await user(uid); const A = app('new', uid); await A.sync(); const snap = [];
    for (let day = 0; day < 3 * 365; day++) { const dev = 'ltdev' + Math.floor(day / 7); let n = ctl.NOW;
      await send(uid, [{ type: 'eday', t: ctl.NOW, d: dev, n: ++n }, ...[1, 2, 3].map(() => ({ type: 'zz', t: ctl.NOW, d: dev, n: ++n }))], dev);
      if ((day + 1) % 365 === 0) { const x = sxDoc(uid), b = bytes(doc(`users/${uid}/data/sx`));
        snap.push({ year: (day + 1) / 365, sxBytes: b, devices: Object.keys(x.dv).length, fullDevices: Object.values(x.dv).filter(v => v.lt).length, archives: x.an.length, ids: Object.values(x.dv).reduce((a, v) => a + Object.values(v.g || {}).join(',').split(',').filter(Boolean).length, 0), qzInDoc: x.qz.length, archiveDocs: archDocs(uid).length }) }
      ctl.NOW += DAY }
    for (const r of snap) I('السنة ' + r.year, r);
    const y3 = snap[2]; T('بعد 3 سنوات: وثيقة sx دون حدّ الأرشفة (400 كيلوبايت) وبعيدة عن حدّ Firestore', y3.sxBytes < 400000, y3.sxBytes);
    T('سجلّات الأجهزة الكاملة (بأرقام) لا تتجاوز أجهزة آخر 32 يومًا، والباقي أرض الجهاز وحدها', y3.fullDevices <= 6, y3.fullDevices);
    T('الأرقام المحفوظة محدودة بآخر 32 يومًا (لا تتراكم)', y3.ids <= 32 * 4 + 8, y3.ids);
    T('الحجر لم يُحذف منه شيء (في الوثيقة + الأرشيف = كل ما دخله)', y3.qzInDoc + archDocs(uid).reduce((a, [, d]) => a + JSON.parse(d.data.v).qz.length, 0) === 3 * 365 * 3, y3.qzInDoc);
    T('وثائق الأرشيف قليلة: دفعة لكل 100 حدث محجور على الأقل (لا وثيقة لكل مزامنة)', y3.archiveDocs <= Math.ceil(3 * 365 * 3 / 100), y3.archiveDocs);
    const perDev = (snap[2].sxBytes - snap[1].sxBytes) / 52; I('نموّ الوثيقة السنوي بالبايت (أجهزة بأرضها فقط وأسماء أرشيف)', { perYear: snap[2].sxBytes - snap[1].sxBytes, perDevice: Math.round(perDev) }) },
};
C.anchorMissedTZ = C.anchorMissed;   // الحالة نفسها بمنطقة زمنية أخرى للعملية (TZ في run.sh): النتيجة يجب أن تكون نفسها
await C[CASE](); console.log(out.join('\n'));
