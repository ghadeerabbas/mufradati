// سيناريوهات ضياع المراجعات وتكرارها عند المزامنة (المرحلة أ، 24 تشرين الثاني 2026).
// كل تشغيل = سيناريو واحد بوضع واحد في عملية Node مستقلة (التشغيلات المتتالية في عملية واحدة تتلوّث بالوقت المشترك والدوري).
// الاستعمال: node scen.mjs <DIR> <REPO> <scenario> <mode>   ← يطبع سطر JSON واحدًا بالأرقام
import {app,user,station,adv,ctl,post} from '../integration/it.mjs';
const [,, , , SC, MODE] = process.argv;
const DAY = 864e5;
const due = A => Object.keys(A.P).filter(k => A.P[k].due <= ctl.NOW).sort();
async function learner(uid, days = 3) {
  await user(uid); const A = app('new', uid);
  for (let d = 0; d < days; d++) { for (let s = 0; s < 4; s++) await station(A); adv(DAY - 4 * 65e3); await A.sync() }
  return A;
}
async function srv(uid) {
  const B = app('new', uid); await B.sync(); const e = B.E();
  return { xp: e.xp, gems: e.gems, streak: e.s.streak, reviews: e.s.reviews, words: Object.keys(B.P).length, quizzes: B.QLOG.length, stations: B.STN.length, energy: B.enNow(ctl.NOW) };
}
async function drain(A) {
  let n = 0, syncs = 0; const why = {};
  while (A.q && syncs < 60) { const before = A.q; const j = await A.sync(); syncs++;
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
    ctl.NOW = day0 + (n - 1) * DAY + 10 * 36e5; if (!on) rej += (await drain(A)).rejected;
    return { rejected: rej, ...(await srv(uid)) } },
  offline8(m) { return S.offline(m, 8) }, offline30(m) { return S.offline(m, 30) },
  // ضياع الردّ بعد أن حفظ الخادم، ثم إعادة إرسال الدفعة نفسها
  async resend(m) { const uid = 'rs' + m, A = await learner(uid); ctl.NOW += 3 * 36e5;
    for (const k of due(A).slice(0, 3)) { A.ev({ type: 'rate', k, r: 2 }); adv(20e3) }
    await station(A, { syncEach: false }); A.ev({ type: 'quiz', kind: 's2', ok: 9, total: 10, ms: 30000, full: true }); adv(30e3); A.ev({ type: 'combo' }); adv(15e3);
    if (m === 'test') { await post('/sync', uid, { evs: A.EVQ.slice(0, 300) }); adv(40e3) }
    const d = await drain(A); return { resentRejected: d.rejected, ...(await srv(uid)) } },
  // بدء محطة مرتين دون إنهاء الأولى
  async doubleStart(m) { const uid = 'ds' + m, A = await learner(uid); ctl.NOW += 3 * 36e5; await station(A); const b = await srv(uid);
    A.ev({ type: 'stStart' }); adv(5e3); if (m === 'test') { A.ev({ type: 'stStart' }); adv(5e3) }
    await drain(A); const a = await srv(uid); return { energySpent: b.energy - a.energy } },
};
const r = await S[SC](MODE); console.log(JSON.stringify(r));
