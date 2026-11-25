// سيناريوهات ضياع المراجعات وتكرارها عند المزامنة (المرحلة أ، 24 تشرين الثاني 2026).
// كل تشغيل = سيناريو واحد بوضع واحد في عملية Node مستقلة (التشغيلات المتتالية في عملية واحدة تتلوّث بالوقت المشترك والدوري).
// الاستعمال: node scen.mjs <DIR> <REPO> <scenario> <mode>   ← يطبع سطر JSON واحدًا بالأرقام
import {app,user,station,adv,ctl,post,memfs} from '../integration/it.mjs';
const [,, , , SC, MODE] = process.argv;
const DAY = 864e5;
// المزامنة الجديدة مفعّلة للجميع في هذه المجموعة (مفتاح الإيقاف CFG.sx.on)، للضابط والاختبار معًا
if (process.env.MUF_SX === '1') await memfs.commit([{ path: 'config/app', data: { v: JSON.stringify({ sx: { on: 1 } }) } }]);
// حالة كل حدث كما يعيدها الخادم: ok | late | dup | q (الحجر، مع السبب)؛ والضياع الصامت = حدث أُرسل ولم تعد له حالة
const ST = { ok: 0, late: 0, dup: 0, q: 0, silent: 0, qWhy: {}, qOldStation: 0 };
function tally(sent, j) {
  const st = j.st || [];
  sent.forEach((e, i) => { const s = st[i]; if (!s) { ST.silent++; return } if (s === 'q') { const r = (j.rej || []).find(x => Array.isArray(x) && x[0] === i); const w = r ? String(r[1]) : '?'; ST.q++; ST.qWhy[w] = (ST.qWhy[w] || 0) + 1 } else ST[s] = (ST[s] || 0) + 1 });
}
const due = A => Object.keys(A.P).filter(k => A.P[k].due <= ctl.NOW).sort();
async function learner(uid, days = 3) {
  await user(uid); const A = app('new', uid);
  for (let d = 0; d < days; d++) { for (let s = 0; s < 4; s++) await station(A); adv(DAY - 4 * 65e3); await A.sync() }
  return A;
}
async function srv(uid) {
  const B = app('new', uid); await B.sync(); const e = B.E();
  // مصادر الجواهر مفصّلة (لدراسة الفروق): الدوري، والمحطات، والمستويات وغيرها = الباقي
  const lg = (B.LG.hist || []).reduce((a, h) => a + (h.g || 0), 0) + (+B.LG.hg || 0), stg = B.STN.filter(x => x[2] !== 0).length;
  return { xp: e.xp, gems: e.gems, streak: e.s.streak, reviews: e.s.reviews, words: Object.keys(B.P).length, quizzes: B.QLOG.length, stations: B.STN.length, energy: B.enNow(ctl.NOW),
    gLeague: lg, gStations: stg, gOther: e.gems - lg - stg, lgWeeks: (B.LG.hist || []).length, lgHist: JSON.stringify((B.LG.hist || []).map(h => [h.w, h.tier, h.rank, h.xp, h.mv, h.g])) };
}
async function drain(A) {
  let n = 0, syncs = 0; const why = {};
  while (A.q && syncs < 60) { const before = A.q; const sent = A.EVQ.slice(0, 300); const j = await A.sync(); syncs++; tally(sent, j);
    for (const r of j.rej || []) { const w = Array.isArray(r) ? String(r[1]) : 'bad'; why[w] = (why[w] || 0) + 1; n++ }
    if (A.q >= before && syncs > 50) break }
  return { rejected: n, why, syncs };
}
const S = {
  // ساعة متقدّمة 10 دقائق، 10 مراجعات في جلسة واحدة (مزامنة واحدة في آخرها، كما يفعل التطبيق)
  async clockAhead(m) { const uid = 'ca' + m, A = await learner(uid); const ks = due(A);
    A.ev({ type: 'rate', k: ks[0], r: 2, t: ctl.NOW }); await A.sync(); adv(5e3); const b = await srv(uid);
    const skew = m === 'test' ? 600e3 : 0;
    for (let i = 1; i <= 10; i++) { A.ev({ type: 'rate', k: ks[i], r: 2, t: ctl.NOW + skew }); adv(20e3) }
    const d = await drain(A), a = await srv(uid); return { ...d, reviewsAdded: a.reviews - b.reviews, xpAdded: a.xp - b.xp } },
  // الساعة رجعت 10 دقائق بعد مزامنة بوقت صحيح
  async clockBack(m) { const uid = 'cb' + m, A = await learner(uid); const ks = due(A);
    A.ev({ type: 'rate', k: ks[0], r: 2, t: ctl.NOW }); await A.sync(); adv(5e3); const b = await srv(uid);
    const skew = m === 'test' ? -600e3 : 0;
    for (let i = 1; i <= 10; i++) { A.ev({ type: 'rate', k: ks[i], r: 2, t: ctl.NOW + skew }); adv(20e3) }
    const d = await drain(A), a = await srv(uid); return { ...d, reviewsAdded: a.reviews - b.reviews, xpAdded: a.xp - b.xp } },
  // جهازان: A متصل (اليوم 1 و3)، وB بلا إنترنت 3 أيام ثم يزامن. الضابط: جهاز واحد متصل يفعل الأحداث نفسها
  async twoDevices(m) { const two = m === 'test', uid = 'td' + m, A = await learner(uid); const B = two ? app('new', uid) : A; if (two) await B.sync();
    const pool = due(A); let p = 0; const pick = n => pool.slice(p, p += n); let rej = 0; const day0 = ctl.NOW;
    for (let d = 1; d <= 3; d++) {
      ctl.NOW = day0 + (d - 1) * DAY + 2 * 36e5; if (d !== 2) { for (const k of pick(5)) { A.ev({ type: 'rate', k, r: 2 }); adv(20e3) } rej += (await drain(A)).rejected }
      ctl.NOW = day0 + (d - 1) * DAY + 8 * 36e5; for (const k of pick(5)) { B.ev({ type: 'rate', k, r: 2 }); adv(20e3) }
      await station(B, { syncEach: false }); if (!two) rej += (await drain(B)).rejected }
    ctl.NOW = day0 + 2 * DAY + 12 * 36e5; if (two) rej += (await drain(B)).rejected;
    return { rejected: rej, ...(await srv(uid)) } },
  // جهاز واحد بلا إنترنت N يومًا ثم مزامنة واحدة. الضابط: متصل يوميًا
  async offline(m, n) { const on = m === 'ctrl', uid = 'of' + n + m, A = await learner(uid); const day0 = ctl.NOW; let rej = 0;
    for (let d = 0; d < n; d++) { ctl.NOW = day0 + d * DAY + 3 * 36e5; for (const k of due(A).slice(0, 5)) { A.ev({ type: 'rate', k, r: 2 }); adv(20e3) }
      await station(A, { syncEach: false }); if (on) rej += (await drain(A)).rejected }
    ctl.NOW = day0 + (n - 1) * DAY + 10 * 36e5; if (!on) { const win = e => (['rate','stStart','stDone','stQuit','quiz'].includes(e.type) ? 30 : 7) * DAY; ST.expOld = A.EVQ.filter(e => ctl.NOW - Math.min(e.t, ctl.NOW) > win(e)).length;
      // المحطة في الحجر: كلماتها غير معروفة للخادم، فمراجعاتها اللاحقة تذهب إلى الحجر أيضًا بسبب «word»
      const ow = new Set(A.EVQ.filter(e => e.type === 'stDone' && ctl.NOW - e.t > win(e)).flatMap(e => e.words)); ST.oldSt = A.EVQ.filter(e => e.type === 'stDone' && ctl.NOW - e.t > win(e)).length;
      ST.expWord = A.EVQ.filter(e => e.type === 'rate' && ow.has(e.k)).length; rej += (await drain(A)).rejected }
    return { rejected: rej, ...(await srv(uid)) } },
  offline8(m) { return S.offline(m, 8) }, offline30(m) { return S.offline(m, 30) },
  // ضياع الردّ بعد أن حفظ الخادم، ثم إعادة إرسال الدفعة نفسها
  async resend(m) { const uid = 'rs' + m, A = await learner(uid); ctl.NOW += 3 * 36e5;
    for (const k of due(A).slice(0, 3)) { A.ev({ type: 'rate', k, r: 2 }); adv(20e3) }
    await station(A, { syncEach: false }); A.ev({ type: 'quiz', kind: 's2', ok: 9, total: 10, ms: 30000, full: true }); adv(30e3); A.ev({ type: 'combo' }); adv(15e3);
    if (m === 'test') { const sent = A.EVQ.slice(0, 300); ST.resent = sent.length; tally(sent, await post('/sync', uid, { evs: sent, dev: A.dev() })); ST.ok = ST.late = 0; adv(40e3) }
    const d = await drain(A); return { resentRejected: d.rejected, ...(await srv(uid)) } },
  // القرار 2: مراجعة متأخّرة لكلمة لها مراجعة أحدث من جهاز آخر → نشاط يوم فقط: لا خبرة، ولا تغيير في حالة الكلمة، والحدث محفوظ
  async lateSame(m) { const uid = 'ls' + m, A = await learner(uid); const B = app('new', uid); await B.sync(); const k = due(A)[0];
    const t1 = ctl.NOW; B.ev({ type: 'rate', k, r: 0, t: t1 }); adv(3600e3);   // B بلا إنترنت: «نسيت»
    A.ev({ type: 'rate', k, r: 3 }); await drain(A); const b = await srv(uid), pk = JSON.stringify(A.P[k]); adv(60e3);
    await drain(B); const a = await srv(uid), C = app('new', uid); await C.sync();
    return { xpBefore: b.xp, xpAfter: a.xp, reviewsBefore: b.reviews, reviewsAfter: a.reviews, wordSame: JSON.stringify(C.P[k]) === pk, lateKept: C.LATE.some(x => x[1] === k && x[2] === 0) } },
  // بدء محطة مرتين دون إنهاء الأولى
  async doubleStart(m) { const uid = 'ds' + m, A = await learner(uid); ctl.NOW += 3 * 36e5; await station(A); const b = await srv(uid);
    A.ev({ type: 'stStart' }); adv(5e3); if (m === 'test') { A.ev({ type: 'stStart' }); adv(5e3) }
    await drain(A); const a = await srv(uid); return { energySpent: b.energy - a.energy } },
};
const r = await S[SC](MODE); console.log(JSON.stringify({ ...r, st: ST }));
