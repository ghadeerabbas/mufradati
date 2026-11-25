// حالات حدّية للمزامنة الجديدة: كل حالة في عملية مستقلة. الاستعمال: node edge.mjs <DIR> <REPO> <case>
// يطبع أسطر PASS/FAIL/INFO. الخادم الحقيقي (worker.js) مع قاعدة بيانات في الذاكرة؛ w_old.mjs = الخادم المنشور (للتراجع).
import { app, user, station, adv, ctl, post, memfs, DB } from '../integration/it.mjs';
const CASE = process.argv[4], DAY = 864e5, out = [];
const T = (n, c, x) => out.push((c ? 'PASS ' : 'FAIL ') + CASE + ': ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)) : ''));
const I = (n, x) => out.push('INFO ' + CASE + ': ' + n + (x !== undefined ? ' → ' + (typeof x === 'string' ? x : JSON.stringify(x)) : ''));
await memfs.commit([{ path: 'config/app', data: { v: JSON.stringify({ sx: { on: 1 } }) } }]);
const due = A => Object.keys(A.P).filter(k => A.P[k].due <= ctl.NOW).sort();
async function learner(uid, days = 3) { await user(uid); const A = app('new', uid);
  for (let d = 0; d < days; d++) { for (let s = 0; s < 4; s++) await station(A); adv(DAY - 4 * 65e3); await A.sync() } return A }
const doc = p => { const d = DB.get(p); return d ? d.data.v : null };
const sxDoc = uid => JSON.parse(doc(`users/${uid}/data/sx`) || '{}');
const unpack = s => { let p = 0; return (s || '').split(',').filter(Boolean).map(d => p += parseInt(d, 36)) };
const idsOf = v => v ? Object.values(v.g || {}).flatMap(unpack) : [];   // الأرقام مجموعة بيوم استلامها
async function srv(uid) { const B = app('new', uid); await B.sync(); const e = B.E();
  return { xp: e.xp, gems: e.gems, streak: e.s.streak, reviews: e.s.reviews, words: Object.keys(B.P).length, quizzes: B.QLOG.length, stations: B.STN.length, energy: B.enNow(ctl.NOW), B, e } }
const send = (uid, evs, dev) => post('/sync', uid, { evs, dev });
const archived = uid => { const o = { qz: [], late: [] }; for (const [p, d] of DB) if (p.startsWith(`users/${uid}/data/sxa`)) { const x = JSON.parse(d.data.v); o.qz.push(...x.qz); o.late.push(...x.late) } return o };
const rate = (k, t, n, d, r = 2) => ({ type: 'rate', k, r, t, n, d });

const C = {
  // فجوات في الأرقام (أحداث رفضها الهاتف نفسه): كلها تُقبل، وإعادتها كلها «وصلت سابقًا»
  async gaps() { const uid = 'gp', A = await learner(uid); const b = await srv(uid); const ks = due(A).slice(0, 6), dev = A.dev();
    const evs = ks.map((k, i) => rate(k, ctl.NOW + i * 20e3, (ctl.NOW + 2e9) + [0, 5, 17, 18, 400, 9999][i], dev)); adv(150e3);
    const j = await send(uid, evs, dev); T('أرقام بفجوات: الستة مقبولة', j.st.join() === 'ok,ok,ok,ok,ok,ok', j.st);
    const j2 = await send(uid, evs, dev); T('إعادتها: الستة «وصلت سابقًا»', j2.st.every(s => s === 'dup'), j2.st);
    const a = await srv(uid); T('المراجعات زادت 6 بالضبط', a.reviews - b.reviews === 6, a.reviews - b.reviews) },

  // ملاحظة ChatGPT 1: أكثر من 500 رقم، ثم يصل حدث برقم أصغر لم يصل من قبل (تبويبان، أو دفعة تأخّرت) → يُقبل ولا يُعدّ مكرّرًا
  async order() { const uid = 'or', dev = 'devOrder1'; await user(uid); const A = app('new', uid); await A.sync(); const base = (ctl.NOW + 2e9);
    const evs = []; for (let i = 0; i < 600; i++) if (i !== 37) evs.push({ type: 'zz', t: ctl.NOW, n: base + i * 10, d: dev, i });
    let st = []; for (let i = 0; i < evs.length; i += 300) st.push(...(await send(uid, evs.slice(i, i + 300), dev)).st);
    T('599 حدثًا من نوع غير معروف: كلها في الحجر (لا حذف)', st.length === 599 && st.every(s => s === 'q'), [st.length, [...new Set(st)]]);
    const late = { type: 'eday', t: ctl.NOW, n: base + 370, d: dev }; const j = await send(uid, [late], dev);
    T('الحدث رقم 37 يصل بعد 599 رقمًا أكبر منه: يُطبَّق (ليس مكرّرًا)', j.st[0] === 'ok', j.st);
    const j2 = await send(uid, [late], dev); T('إعادته: «وصل سابقًا»', j2.st[0] === 'dup', j2.st);
    const sx = sxDoc(uid), ids = idsOf(sx.dv[dev]); T('كل الأرقام الستمئة محفوظة بالضبط', ids.length === 600 && new Set(ids).size === 600, ids.length) },

  // إعادة تثبيت التطبيق: معرّف جهاز جديد. ما لم يُرسل من التثبيت القديم لا يعرفه الخادم (لا يمكن منعه)،
  // لكن إن بقي الهاتف القديم وأرسل لاحقًا، يُقبل مرة واحدة
  async reinstall() { const uid = 'ri', A = await learner(uid); const b = await srv(uid); const ks = due(A);
    for (const k of ks.slice(0, 3)) { A.ev({ type: 'rate', k, r: 2 }); adv(20e3) }   // لم تُرسل
    const B = app('new', uid); await B.sync(); T('التثبيت الجديد بمعرّف مختلف', B.dev() !== A.dev());
    for (const k of ks.slice(3, 6)) { B.ev({ type: 'rate', k, r: 2 }); adv(20e3) } const jb = await B.sync(); T('أحداث التثبيت الجديد مقبولة', jb.st.every(s => s === 'ok'), jb.st);
    const sent = A.EVQ.slice(); const ja = await A.sync(); T('الهاتف القديم أرسل لاحقًا: مقبولة (متأخّرة لكلمات أخرى)', ja.st.every(s => s === 'ok'), ja.st);
    const jr = await send(uid, sent, A.dev()); T('إعادتها: «وصلت سابقًا»', jr.st.every(s => s === 'dup'), jr.st);
    const a = await srv(uid); T('المراجعات زادت 6 بالضبط', a.reviews - b.reviews === 6, a.reviews - b.reviews) },

  // ضياع الردّ عدة مرات، ودفعات متداخلة
  async resendMulti() { const uid = 'rm', A = await learner(uid); ctl.NOW += 3 * 36e5; const b = await srv(uid);
    for (const k of due(A).slice(0, 3)) { A.ev({ type: 'rate', k, r: 2 }); adv(20e3) } A.ev({ type: 'quiz', kind: 's2', ok: 9, total: 10, ms: 30000, full: true }); adv(30e3);
    const evs = A.EVQ.slice(), dev = A.dev(); const r1 = await send(uid, evs, dev); await send(uid, evs, dev); const r3 = await send(uid, evs, dev);
    T('الإرسال الأول مقبول، والثالث كله «وصل سابقًا»', r1.st.every(s => s === 'ok') && r3.st.every(s => s === 'dup'), [r1.st, r3.st]);
    A.ev({ type: 'rate', k: due(A)[5], r: 2 }); const nw = A.EVQ[A.EVQ.length - 1]; adv(20e3);
    const r4 = await send(uid, [evs[2], evs[3], nw], dev); T('دفعة متداخلة: القديمان مكرّران والجديد مقبول', r4.st.join() === 'dup,dup,ok', r4.st);
    const a = await srv(uid); T('النتيجة: 4 مراجعات وتمرين واحد بالضبط', a.reviews - b.reviews === 4 && a.quizzes - b.quizzes === 1, [a.reviews - b.reviews, a.quizzes - b.quizzes]) },

  // الذرّية: فشل الكتابة لا يترك شيئًا نصف محفوظ، والهاتف لا يحذف أحداثه إلا بعد ردّ ناجح لكل حدث فيه حالة
  async atomic() { const uid = 'at', A = await learner(uid); const b = await srv(uid);
    for (const k of due(A).slice(0, 3)) { A.ev({ type: 'rate', k, r: 2 }); adv(20e3) }
    const snap = () => JSON.stringify([...DB].filter(([p]) => p.startsWith(`users/${uid}`)).map(([p, d]) => [p, d.data]));
    const s0 = snap(), orig = memfs.commit; let fails = 1; memfs.commit = async function (ws) { if (fails-- > 0) throw new Error('شبكة'); return orig.call(this, ws) };
    let err = null; try { await A.sync() } catch (e) { err = e.message }
    T('فشل الكتابة: الطلب يفشل، ولا تتغيّر أي وثيقة، والأحداث باقية في الهاتف', err && snap() === s0 && A.EVQ.length === 3, [err && err.slice(0, 20), snap() === s0, A.EVQ.length]);
    const j = await A.sync(); T('إعادة المحاولة: الثلاثة مقبولة مرة واحدة', j.st.join() === 'ok,ok,ok' && !A.EVQ.length, j.st);
    for (const k of due(A).slice(3, 5)) { A.ev({ type: 'rate', k, r: 2 }); adv(20e3) }
    fails = 0; let conf = 1; memfs.commit = async function (ws) { if (conf-- > 0) { const e = new Error('conflict'); e.conflict = true; throw e } return orig.call(this, ws) };
    const j2 = await A.sync(); memfs.commit = orig; T('تعارض كتابة (جهاز آخر كتب في اللحظة نفسها): الخادم يعيد الطلب كله، والحدثان مقبولان مرة واحدة', j2.st.join() === 'ok,ok', j2.st);
    const a = await srv(uid); T('المراجعات زادت 5 بالضبط', a.reviews - b.reviews === 5, a.reviews - b.reviews);
    const sx = sxDoc(uid), ids = idsOf(sx.dv[A.dev()]); T('أرقام الأحداث الخمسة محفوظة في sx مع التقدّم نفسه', A.EVQ.length === 0 && ids.length >= 5, ids.length) },

  // التراجع: الخادم الجديد ← القديم (المنشور) ← الجديد، والتطبيق الجديد طوال الوقت
  async rollback() { const uid = 'rb', A = await learner(uid); const b = await srv(uid); let ks = due(A), p = 0; const pick = n => ks.slice(p, p += n);
    for (const k of pick(3)) { A.ev({ type: 'rate', k, r: 2 }); adv(20e3) } await A.sync(); const sx1 = doc(`users/${uid}/data/sx`);
    ctl.ACTIVE = 'old';
    for (const k of pick(3)) { A.ev({ type: 'rate', k, r: 2 }); adv(20e3) } await A.sync();
    T('الخادم القديم لا يمسّ وثيقة sx', doc(`users/${uid}/data/sx`) === sx1);
    // ضياع ردّ على الخادم القديم ثم إعادة إرسال إليه
    for (const k of pick(2)) { A.ev({ type: 'rate', k, r: 2 }); adv(20e3) } A.ev({ type: 'quiz', kind: 's2', ok: 9, total: 10, ms: 30000, full: true }); adv(30e3);
    const lost = A.EVQ.slice(); await send(uid, lost, A.dev()); adv(30e3); await A.sync();
    const mid = await srv(uid); I('على الخادم القديم: الإعادة رُفضت بالوقت للمراجعات (السلوك القديم)، والتمرين تكرّر؟', { quizzes: mid.quizzes - b.quizzes });
    ctl.ACTIVE = 'new';
    for (const k of pick(3)) { A.ev({ type: 'rate', k, r: 2 }); adv(20e3) } const j = await A.sync(); T('بعد العودة: الأحداث الجديدة مقبولة', j.st.every(s => s === 'ok'), j.st);
    // الحالة الوحيدة الموثّقة: حدث قبله الخادم القديم وضاع ردّه، ثم أُعيد إلى الجديد
    const jr = await send(uid, lost, A.dev()); I('حالات أحداث قبلها القديم ثم أُعيدت إلى الجديد', jr.st);
    const a = await srv(uid);
    T('المراجعات: 11 بالضبط، لا ضياع ولا تكرار (المراجعة المعادة تُعرف متأخّرة لأن الكلمة مسجّلة في وقتها نفسه)', a.reviews - b.reviews === 11, a.reviews - b.reviews);
    I('التمارين بعد الرحلة كلها (المتوقَّع 1؛ الزيادة هي الحالة الموثّقة)', a.quizzes - b.quizzes);
    T('وثيقة sx سليمة وتعرف أجهزتها', !!sxDoc(uid).dv[A.dev()]) },

  // ملاحظة ChatGPT 4: هدية الطاقة اليومية بأيام متداخلة
  // الجهاز الواحد لا يرجع قبل آخر حدث قُبل منه (فيصير «اليوم الأقدم» يومه الأخير ويُعدّ مكرّرًا)، لذلك التداخل الحقيقي بين أجهزة: جهاز مختلف لكل إرسال
  async edayMix() { const uid = 'ed', A = await learner(uid); let n = (ctl.NOW + 2e9), k = 0; const d0 = ctl.NOW;
    const ev = d => ({ type: 'eday', t: d0 - d * DAY, n: ++n, d: 'edev' + (++k) });
    const st = []; for (const d of [0, 2, 0, 1, 2, 1, 0]) { const e = ev(d); st.push((await send(uid, [e], e.d)).st[0]); adv(1e3) }
    T('الأيام 0،2،0،1،2،1،0: تُقبل هدية كل يوم مرة واحدة فقط (الأولى من كل يوم)', st.join() === 'ok,ok,q,ok,q,q,q', st);
    const ok = st.filter(s => s === 'ok').length; T('عدد الهدايا المقبولة = 3 أيام مختلفة', ok === 3, ok) },

  // ملاحظة ChatGPT 4: طاقة الإجابات المتتالية (combo) بأيام متداخلة لا تتجاوز حدّ اليوم (3)
  async comboMix() { const WHY = []; const uid = 'cm', A = await learner(uid); ctl.NOW += 3 * 36e5; await station(A); await station(A); await A.sync();
    let n = (ctl.NOW + 2e9); const d0 = ctl.NOW - 36e5; const ev = (d, i) => ({ type: 'combo', t: d0 - d * DAY + i * 15e3, n: ++n, d: 'cdev' + d });   // جهاز لكل يوم، والإرسال متداخل
    const st = []; for (const [d, i] of [[0, 0], [0, 1], [1, 0], [0, 2], [1, 1], [0, 3], [1, 2], [1, 3], [0, 4]]) { const e = ev(d, i); const j = await send(uid, [e], e.d); st.push(j.st[0]); if (j.rej[0]) WHY.push(j.rej[0][1]); adv(1e3) }
    const okD = d => [[0, 0], [0, 1], [1, 0], [0, 2], [1, 1], [0, 3], [1, 2], [1, 3], [0, 4]].filter((x, i) => x[0] === d && st[i] === 'ok').length;
    T('كل يوم 3 على الأكثر رغم التداخل، ولا يُمنع يوم بسبب الآخر', okD(0) === 3 && okD(1) >= 1 && okD(1) <= 3, { day0: okD(0), day1: okD(1), st, why: WHY }) },

  // ملاحظة ChatGPT 3 + التلاعب بالساعة: لا وقت بعد وقت الخادم، ولا طاقة ولا أيام من المستقبل
  async clockFuture() { const uid = 'cf', A = await learner(uid); ctl.NOW += 3 * 36e5; await station(A); await station(A); await A.sync();
    const s0 = await srv(uid), srvT = ctl.NOW, dev = A.dev(); let n = (ctl.NOW + 2e9); const fut = ctl.NOW + 3 * DAY;   // ساعة الهاتف متقدّمة 3 أيام
    const evs = [{ type: 'stStart', t: fut, n: ++n, d: dev }, { type: 'combo', t: fut + 1e3, n: ++n, d: dev }, { type: 'eday', t: fut + 2e3, n: ++n, d: dev },
      ...due(A).slice(0, 4).map((k, i) => rate(k, fut + 3e3 + i * 20e3, ++n, dev))];
    const j = await send(uid, evs, dev); const a = await srv(uid);
    const B = a.B, maxT = Math.max(...B.LOG.map(x => x[0]), ...B.QLOG.map(x => x[0]), ...B.STN.map(x => x[0]), 0);
    T('لا وقت في السجلات بعد وقت الخادم (السجلّ يُحفظ بالثانية مقرّبًا، فالهامش نصف ثانية كما في المنشور)', maxT <= srvT + 500, [maxT - srvT]);
    T('لا أيام من المستقبل في نشاطه، والسلسلة كما يحسبها اليوم', a.streak <= s0.streak + 1 && !B.LOG.some(x => x[0] > srvT + 500), [s0.streak, a.streak]);
    T('الطاقة لم تُحسب في المستقبل: لا تتجاوز ما يسمح به وقت الخادم', a.energy <= s0.energy + 10 + 2 + 1, { before: s0.energy, after: a.energy, st: j.st });
    I('حالات الأحداث', j.st) },

  async clockBack() { const uid = 'cbk', A = await learner(uid); ctl.NOW += 3 * 36e5; await A.sync(); const s0 = await srv(uid), dev = A.dev(); let n = (ctl.NOW + 2e9);
    const back = ctl.NOW - 3 * DAY; const evs = due(A).slice(0, 10).map((k, i) => rate(k, back + i * 20e3, ++n, dev)); adv(300e3);
    const j = await send(uid, evs, dev); const a = await srv(uid), B = a.B, dl = sxDoc(uid).dv[dev].lt;
    T('ساعة راجعة 3 أيام: المراجعات العشر مقبولة ومسجّلة بعد آخر حدث من الجهاز (لا في الماضي)', j.st.every(s => s === 'ok') && B.LOG.slice(-10).every(x => x[0] >= s0.B.LOG[s0.B.LOG.length - 1][0]), j.st);
    T('السلسلة لم تتغيّر بأيام ماضية', a.streak === s0.streak || a.streak === s0.streak + 1, [s0.streak, a.streak]) },

  // أحداث بوقت هاتف في يوم سابق: مقارنة الخادم الجديد بالقديم (المنشور)
  async missedDay() { const res = {};
    for (const which of ['old', 'new']) { const uid = 'md' + which; ctl.ACTIVE = 'new'; const A = await learner(uid); ctl.NOW += 2 * DAY; ctl.ACTIVE = which; const s0 = await srv(uid); let n = (ctl.NOW + 2e9);
      const y = ctl.NOW - DAY; const evs = due(A).slice(0, 10).map((k, i) => rate(k, y + i * 20e3, ++n, A.dev())); adv(300e3); await send(uid, evs, A.dev()); const a = await srv(uid); res[which] = [s0.streak, a.streak]; ctl.NOW += 5 * DAY }
    I('السلسلة [قبل، بعد]', res);
    T('الجديد ليس أضعف من القديم المنشور في هذه الحالة', res.new[1] <= res.old[1], res) },

  // ملاحظة ChatGPT 5: الحدث في الحجر محفوظ كما وصل تمامًا
  async fullEvent() { const uid = 'fe', A = await learner(uid); const dev = A.dev();
    const e = { type: 'quiz', kind: 's2', ok: 99, total: 10, ms: 30000, full: true, t: ctl.NOW, n: (ctl.NOW + 2e9), d: dev, qa: Array.from({ length: 300 }, (_, i) => ['wort' + i, i % 2]), extra: { a: [1, 2, { b: 'ç' }] } };
    const j = await send(uid, [e], dev); const q = sxDoc(uid).qz.find(x => x[2].n === e.n);
    T('حدث تالف (ok > total) في الحجر بسبب «bad»', j.st[0] === 'q' && q && q[1] === 'bad', j.st);
    T('محفوظ كما وصل تمامًا، بكل حقوله ومنها غير المعروفة', q && JSON.stringify(q[2]) === JSON.stringify(e), q && JSON.stringify(q[2]).length) },

  // ملاحظة ChatGPT 2 + الحدود: 60 جهازًا لا يُحذف أيّ منها، والحجر لا يُحذف بل يُؤرشف
  async devicesArchive() { const uid = 'da'; await user(uid); const A = app('new', uid); await A.sync(); let n = (ctl.NOW + 2e9); const first = { type: 'zz', t: ctl.NOW, n: ++n, d: 'dev00x' };
    await send(uid, [first], 'dev00x'); for (let i = 1; i < 60; i++) await send(uid, [{ type: 'zz', t: ctl.NOW, n: ++n, d: 'dev' + String(i).padStart(2, '0') + 'x' }], 'x');
    T('60 جهازًا: سجلّاتها كلها باقية', Object.keys(sxDoc(uid).dv).length === 60, Object.keys(sxDoc(uid).dv).length);
    const jr = await send(uid, [first], 'dev00x'); T('الجهاز الأول بعد 59 جهازًا: إعادة حدثه «وصل سابقًا»', jr.st[0] === 'dup', jr.st);
    const evs = []; for (let i = 0; i < 700; i++) evs.push({ type: 'zz', t: ctl.NOW, n: ++n, d: 'dev00x', i });
    for (let i = 0; i < 700; i += 300) await send(uid, evs.slice(i, i + 300), 'dev00x');
    const sx = sxDoc(uid), ar = archived(uid), all = [...sx.qz, ...ar.qz];
    T('الحجر: لا يُحذف شيء (760 حدثًا = في الوثيقة + في الأرشيف)', all.length === 760, { doc: sx.qz.length, archive: ar.qz.length, ax: sx.ax });
    T('الحجر في الوثيقة نفسها ضمن الحدّ (300)، والباقي في وثائق أرشيف', sx.qz.length <= 300 && sx.ax >= 1, sx.qz.length);
    ctl.NOW += 120 * DAY; await send(uid, [{ type: 'zz', t: ctl.NOW, n: (ctl.NOW + 2e9), d: 'dev00x' }], 'dev00x');
    const sx2 = sxDoc(uid), ar2 = archived(uid); T('بعد 120 يومًا: لا حذف تلقائي (761)', sx2.qz.length + ar2.qz.length === 761, sx2.qz.length + ar2.qz.length);
    I('حجم وثيقة sx بالبايت', doc(`users/${uid}/data/sx`).length) },

  // تقليم الأرقام بعد مدّة القبول آمن: إعادة حدث قديم جدًا لا تُطبَّق مرة ثانية
  async prune() { const uid = 'pr', A = await learner(uid); const b = await srv(uid); const k = due(A)[0]; A.ev({ type: 'rate', k, r: 2 }); const e = { ...A.EVQ[0] }; await A.sync();
    ctl.NOW += 40 * DAY; A.ev({ type: 'eday' }); await A.sync(); const ids = idsOf(sxDoc(uid).dv[A.dev()]);
    T('بعد 40 يومًا: رقم الحدث القديم حُذف من القائمة', !ids.includes(e.n), ids.length);
    const j = await send(uid, [e], A.dev()); T('إعادة إرساله: إلى الحجر بسبب «old»، لا تطبيق ثانٍ', j.st[0] === 'q' && j.rej[0][1] === 'old', [j.st, j.rej]);
    const a = await srv(uid); T('المراجعات زادت 1 فقط', a.reviews - b.reviews === 1, a.reviews - b.reviews) },
};
await C[CASE](); console.log(out.join('\n'));
