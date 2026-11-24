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
    let n = ctl.NOW * 10; const d0 = ctl.NOW - 2 * DAY;   // قبل يومين: يوم فيه محطات مع تدريبها (من learner)
    const q = (id, t, d = dev) => ({ type: 'quest', id, t, n: ++n, d });
    // صندوق مهمة «محطة مع تدريبها» ليوم قديم فيه محطات
    const r1 = await send(uid, [q('st1', d0 + 3600e3)], dev); T('صندوق ليوم قديم مستحَق: مقبول', r1.st[0] === 'ok', [r1.st, r1.rej]);
    const r2 = await send(uid, [q('st1', d0 + 7200e3, 'questdev3')], 'questdev3'); T('الصندوق نفسه لليوم نفسه من جهاز آخر: لا يتكرّر', r2.st[0] === 'q' && r2.rej[0][1] === 'dup', [r2.st, r2.rej]);
    const r3 = await send(uid, [q('rv15', d0 + 3600e3, 'questdev4')], 'questdev4'); T('مهمة «راجع 15 كلمة» ليوم لم يراجع فيه 15: إلى الحجر «notyet»', r3.st[0] === 'q' && r3.rej[0][1] === 'notyet', [r3.st, r3.rej]);
    // 35 يومًا من الصناديق (3 في اليوم أقصى)، ثم إعادة صندوق عمره 29 يومًا من جهاز آخر
    const r4 = await send(uid, [q('st1', d0 - 31 * DAY, 'questdev5')], 'questdev5'); T('صندوق أقدم من 30 يومًا: إلى الحجر «old»', r4.st[0] === 'q' && r4.rej[0][1] === 'old', [r4.st, r4.rej]);
    I('لماذا لا يتكرّر صندوق خلال 30 يومًا', 'الصناديق 3 في اليوم على الأكثر، وسجلّها R.qd يُطوى بعد 600 = 200 يوم، فكل صندوق ضمن مدّة القبول ما زال فيه بعينه') },

  // المرساة: ساعة الهاتف مُرجَعة إلى أمس لملء يوم فائت → المرساة تُبقي الوقت الحقيقي، فلا يُملأ اليوم
  async anchorMissed() { const res = {};
    for (const mode of ['plain', 'anchor']) { const uid = 'am' + mode; await cfg({}); const A = await learner(uid, 3, mode === 'anchor'); ctl.NOW += 2 * DAY; const s0 = await srv(uid);
      const y = ctl.NOW - DAY; for (const [i, k] of due(A).slice(0, 10).entries()) { A.ev({ type: 'rate', k, r: 2, t: y + i * 20e3 }); adv(20e3) }
      await A.sync(); const a = await srv(uid); const yk = new Date(y + 3600e3).toISOString().slice(0, 10), tk = new Date(ctl.NOW).toISOString().slice(0, 10);
      res[mode] = { streak: [s0.streak, a.streak], yesterday: (a.e.per[yk] || { n: 0 }).n, today: (a.e.per[tk] || { n: 0 }).n }; ctl.NOW += 5 * DAY }
    I('عشر مراجعات بساعة مُرجَعة إلى أمس: أين حُسبت؟', res);
    T('بلا مرساة: حُسبت في أمس (اليوم الفائت يُملأ، كما في المنشور اليوم)', res.plain.yesterday === 10, res.plain);
    T('مع المرساة: حُسبت في اليوم الحقيقي، وأمس بقي فارغًا', res.anchor.yesterday === 0 && res.anchor.today === 10, res.anchor) },

  // المرساة والطاقة: ساعة متقدّمة يومًا لا تعطي طاقة امتلأت «في المستقبل»
  async anchorEnergy() { const out2 = {};
    for (const mode of ['plain', 'anchor']) { const uid = 'ae' + mode; const A = await learner(uid, 3, mode === 'anchor'); ctl.NOW += 3 * 36e5; await station(A); await A.sync();   // محطة اليوم الأولى (مجانية) مع تدريبها
      const c = JSON.parse(DB.get(`users/${uid}/data/core`).data.v); c.EN = { ...c.EN, v: 2, t: ctl.NOW }; await memfs.commit([{ path: `users/${uid}/data/core`, data: { v: JSON.stringify(c) } }]);   // طاقة 2 الآن
      const s0 = await srv(uid); A.ev({ type: 'stStart', t: ctl.NOW + DAY }); adv(20e3); const j = await A.sync(); const a = await srv(uid);   // ساعة الهاتف متقدّمة يومًا (الطاقة «ممتلئة» عنده)
      out2[mode] = { before: s0.energy, after: a.energy, st: j.st, why: j.rej } }
    I('بدء محطة بساعة متقدّمة يومًا وطاقة 2', out2);
    T('في الحالتين: إلى الحجر «energy» (الطاقة بوقت الخادم، لا ربح من المستقبل)', ['plain', 'anchor'].every(m => out2[m].st[0] === 'q' && out2[m].why[0][1] === 'energy' && out2[m].after <= out2[m].before + 1), out2) },

  // السياسة "day" لحدث بلا مرساة: تسدّ ثغرة ملء اليوم الفائت، وثمنها على العمل دون إنترنت بلا مرساة (المتصفح بعد إعادة التحميل)
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
  async idsGrowth() { const uid = 'ig'; await user(uid); const A = app('new', uid); await A.sync(); const dev = 'growdev1'; let n = ctl.NOW * 10; const first = [];
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
  async bigEvent() { const uid = 'be', A = await learner(uid); const dev = A.dev(); let n = ctl.NOW * 10;
    const mid = { type: 'quiz', kind: 's2', ok: 99, total: 10, ms: 1, t: ctl.NOW, n: ++n, d: dev, qa: Array.from({ length: 300 }, (_, i) => ['ك'.repeat(60) + i, 1]) };
    const j = await send(uid, [mid], dev); const q = sxDoc(uid).qz.find(x => x[2].ref); const full = q && JSON.parse(doc(`users/${uid}/data/${q[2].ref}`)).ev;
    T('حدث 40 كيلوبايت تقريبًا: في الحجر، ومحفوظ كاملًا في وثيقة مستقلة', j.st[0] === 'q' && full && JSON.stringify(full) === JSON.stringify(mid), { st: j.st, bytes: bytes(JSON.stringify(mid)), ref: q && q[2].ref });
    const huge = { type: 'quiz', kind: 's2', ok: 1, total: 10, ms: 1, t: ctl.NOW, n: ++n, d: dev, blob: 'ع'.repeat(500000) };
    const j2 = await send(uid, [huge], dev); T('حدث 1 ميغابايت: الحالة «big» (لا إقرار بحفظه، فلا يحذفه التطبيق)، ولا أثر له', j2.st[0] === 'big' && !sxDoc(uid).qz.some(x => x[2].n === huge.n), j2.st);
    const s1 = doc(`users/${uid}/data/sx`); const j3 = await send(uid, [huge], dev); T('إعادته: «big» مرة أخرى (لم يُسجَّل رقمه كمستلَم)', j3.st[0] === 'big' && doc(`users/${uid}/data/sx`) === s1, j3.st) },

  // البند 7: الحدود بالبايت لا بالمحارف (نصوص عربية: محرف = بايتان)
  async bytesLimit() { const uid = 'bl'; await user(uid); const A = app('new', uid); await A.sync(); const dev = 'bytedev1'; let n = ctl.NOW * 10;
    const ev = () => ({ type: 'zz', t: ctl.NOW, n: ++n, d: dev, note: 'ض'.repeat(1300) });   // نحو 1300 محرف و2600 بايت
    for (let b = 0; b < 2; b++) await send(uid, Array.from({ length: 150 }, ev), dev);
    const s = doc(`users/${uid}/data/sx`); T('300 حدث عربي في الحجر: الوثيقة ≤ 400 كيلوبايت بالبايت (لا بالمحارف)', bytes(s) <= 402000, { chars: s.length, bytes: bytes(s), archives: archDocs(uid).length });
    T('ما زاد نُقل إلى الأرشيف، ولا شيء محذوف', JSON.parse(s).qz.length + archDocs(uid).reduce((a, [, d]) => a + JSON.parse(d.data.v).qz.length, 0) === 300) ;
    // قاعدة الاختبار ترفض أي وثيقة > 1048576 بايت كما يفعل Firestore: نتأكّد أنها تعمل
    let err = ''; try { await memfs.commit([{ path: 'x/y', data: { v: 'ع'.repeat(530000) } }]) } catch (e) { err = e.message } T('قاعدة الاختبار تفرض حدّ Firestore بالبايت', /1 ميغابايت/.test(err), err.slice(0, 40)) },

  // البند 6: sx وأرشيفها في النسخ الاحتياطي، والتحقق الكامل، والاسترجاع، وحذف بيانات الحساب
  async backupSx() { const uid = 'bs', A = await learner(uid); const dev = A.dev(); let n = ctl.NOW * 10;
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
    let r = await post('/sxq', 'admin', { op: 'apply', uid, src: 'qz', i: eG.i }); let a = await srv(uid);
    T('إعادة الحقيقي: مقبول، والمراجعات +1', r.st === 'ok' && a.reviews - b.reviews === 1, [r, a.reviews - b.reviews]);
    r = await post('/sxq', 'admin', { op: 'apply', uid, src: 'qz', i: eG.i }); a = await srv(uid);
    T('إعادته مرة ثانية: «applied»، ولا تغيير', r.st === 'q' && r.rej[0][1] === 'applied' && a.reviews - b.reviews === 1, [r, a.reviews - b.reviews]);
    const x0 = a.xp; r = await post('/sxq', 'admin', { op: 'apply', uid, src: 'qz', i: eE.i }); a = await srv(uid);
    T('إعادة مراجعة طُبّقت من قبل: «late» (نشاط فقط)، بلا خبرة ولا مراجعة', r.st === 'late' && a.xp === x0 && a.reviews - b.reviews === 1, [r, a.xp - x0]);
    r = await post('/sxq', 'admin', { op: 'apply', uid, src: 'qz', i: eQ.i }); a = await srv(uid);
    T('إعادة تمرين طُبّق من قبل: «dupc»، والتمارين كما هي', r.st === 'q' && r.rej[0][1] === 'dupc' && a.quizzes === b.quizzes, [r, a.quizzes - b.quizzes]);
    L = await post('/sxq', 'admin', { op: 'list', uid }); T('نتيجة كل محاولة مسجّلة على مدخلها', L.qz.find(q => q.n === G.n).ap.r === 'ok' && L.qz.find(q => q.n === Q1.n).ap.r === 'dupc');
    // ج) حدث في وثيقة أرشيف
    const G2 = { type: 'rate', k: ks[2], r: 2, t: ctl.NOW - 1800e3, n: lo - 3, d: dev }; await send(uid, [G2], dev); let n = ctl.NOW * 10;
    for (let k = 0; k < 2; k++) await send(uid, Array.from({ length: 160 }, () => ({ type: 'zz', t: ctl.NOW, n: ++n, d: dev })), dev);
    L = await post('/sxq', 'admin', { op: 'list', uid }); let hit = null;
    for (const nm of L.an) { const x = await post('/sxq', 'admin', { op: 'arch', uid, name: nm }); const q = (x.qz || []).find(r => r.n === G2.n); if (q) hit = q }
    T('الحدث انتقل إلى وثيقة أرشيف وتعرضه اللوحة', !!hit, L.an.length);
    r = await post('/sxq', 'admin', { op: 'apply', uid, src: hit.src, i: hit.i }); a = await srv(uid);
    T('إعادة تطبيقه من الأرشيف: مقبول، والمراجعات +1 (المجموع 2)', r.st === 'ok' && a.reviews - b.reviews === 2, [r, a.reviews - b.reviews]);
    r = await post('/sxq', 'admin', { op: 'apply', uid, src: hit.src, i: hit.i }); T('ومرة ثانية: «applied»', r.rej && r.rej[0][1] === 'applied', r);
    let err = ''; try { await post('/sxq', uid, { op: 'users' }) } catch (e) { err = e.message } T('متعلّم عادي لا يصل إلى اللوحة', / 403 /.test(err), err.slice(0, 30));
    const U = await post('/sxq', 'admin', { op: 'users' }); T('قائمة الحسابات تعرض حسابه', U.users.some(u => u.uid === uid), U.users.length) },

  // البند 1: عدّاد الصفحة توقّف أثناء نوم الهاتف (المرساة متأخّرة 10 ساعات) والساعة صحيحة → الحدث في وقته الصحيح لا في الماضي
  async anchorSleep() { const uid = 'as', A = await learner(uid); ctl.NOW += 2 * DAY + 12 * 36e5; const dev = A.dev(); let n = ctl.NOW * 10;
    const evs = due(A).slice(0, 10).map((k, i) => ({ type: 'rate', k, r: 2, t: ctl.NOW + i * 20e3, a: ctl.NOW - 10 * 36e5 + i * 20e3, n: ++n, d: dev })); adv(300e3);
    await send(uid, evs, dev); const a = await srv(uid), tk = new Date(ctl.NOW).toISOString().slice(0, 10), yk = new Date(ctl.NOW - DAY).toISOString().slice(0, 10);
    T('المراجعات العشر حُسبت في اليوم الصحيح (لا أمس)', (a.e.per[tk] || { n: 0 }).n === 10 && !(a.e.per[yk] || { n: 0 }).n, { today: (a.e.per[tk] || {}).n, yesterday: (a.e.per[yk] || {}).n }) },

  // البند 3 (الخادم): حدث «big» بين حدثين في الدفعة نفسها: لا يوقف الباقي
  async bigMiddle() { const uid = 'bm', A = await learner(uid); const dev = A.dev(); let n = ctl.NOW * 10; const ks = due(A);
    const evs = [{ type: 'rate', k: ks[0], r: 2, t: ctl.NOW, n: ++n, d: dev }, { type: 'quiz', kind: 's2', ok: 1, total: 10, ms: 1, t: ctl.NOW + 1e3, n: ++n, d: dev, blob: 'ع'.repeat(500000) },
      { type: 'rate', k: ks[1], r: 2, t: ctl.NOW + 20e3, n: ++n, d: dev }]; adv(60e3);
    const j = await send(uid, evs, dev); T('الحالات: مقبول، كبير، مقبول', j.st.join() === 'ok,big,ok', j.st) },
};
C.anchorMissedTZ = C.anchorMissed;   // الحالة نفسها بمنطقة زمنية أخرى للعملية (TZ في run.sh): النتيجة يجب أن تكون نفسها
await C[CASE](); console.log(out.join('\n'));
