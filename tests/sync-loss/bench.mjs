// قياس وقت المعالج لطلب المزامنة وحجم وثيقة sx: الخادم المنشور (القديم) مقابل الجديد (المفتاح مطفأ ومشغَّل).
// Node أسرع من Cloudflare، فالأرقام المطلقة تقريبية؛ المهم النسبة بين القديم والجديد على الحساب نفسه والأحداث نفسها.
// الاستعمال: node bench.mjs <DIR> <REPO>
import { app, user, adv, ctl, post, memfs, DB } from '../integration/it.mjs';
const DAY = 864e5, out = [];
const I = (n, x) => out.push('INFO bench: ' + n + ' → ' + JSON.stringify(x));
const cfg = on => memfs.commit([{ path: 'config/app', data: { v: JSON.stringify({ sx: { on } }) } }]);
const words = JSON.parse((await import('node:fs')).readFileSync(process.argv[3] + '/words-a1.json', 'utf8')).words.map(w => String(w.de).trim().toLowerCase());
const uniqW = [...new Set(words)];
// حساب كبير: 50000 عنصر في السجلّ على 300 يوم، وكل الكلمات معروفة
async function bigUser(uid) { await user(uid); const A = app('new', uid); await A.sync();
  const start = ctl.NOW - 300 * DAY, L = []; for (let i = 0; i < 50000; i++) L.push([start + i * Math.floor(300 * DAY / 50000), uniqW[i % uniqW.length], 2, i < uniqW.length ? 1 : 0]);
  const K = [], ix = {}, F = []; let p = 0; for (const [t, k, r, n] of L) { if (ix[k] === undefined) { ix[k] = K.length; K.push(k) } const s = Math.round(t / 1000); F.push(s - p, ix[k], r, n); p = s }
  const P = {}; for (const k of uniqW) P[k] = { box: 3, due: ctl.NOW - DAY, t: start };
  const core = JSON.parse(DB.get(`users/${uid}/data/core`).data.v); core.P = P; core.lf = 1; core.EN = { v: 30, t: ctl.NOW - DAY, lt: ctl.NOW - 1000 };
  await memfs.commit([{ path: `users/${uid}/data/core`, data: { v: JSON.stringify(core) } }, { path: `users/${uid}/data/log`, data: { v: JSON.stringify({ K, F }) } }]) }
const t = async f => { const a = performance.now(); await f(); return performance.now() - a };
const med = a => [...a].sort((x, y) => x - y)[a.length >> 1];
async function run(label, which, on, mk) { ctl.ACTIVE = which; await cfg(on); const ts = [];
  for (let r = 0; r < 7; r++) { const uid = `b${label}${which}${on}${r}`; await bigUser(uid); const evs = mk(uid); ts.push(await t(() => post('/sync', uid, { evs, dev: 'benchdev1' }))) }
  return +med(ts.slice(2)).toFixed(1) }
let n = 0; const rates = (cnt, back) => uid => Array.from({ length: cnt }, (_, i) => ({ type: 'rate', k: uniqW[(i * 7) % uniqW.length], r: 2, t: ctl.NOW - back + i * 20e3, n: ctl.NOW * 10 + ++n, d: 'benchdev1' }));
const cases = { 'مزامنة عادية: 10 مراجعات': rates(10, 300e3), 'دفعة كبيرة: 300 مراجعة': rates(300, 300 * 21e3), 'متأخّرة: 50 مراجعة أقدم من آخر حدث': rates(50, 2 * DAY) };
for (const [name, mk] of Object.entries(cases)) I(name + ' (ملي ثانية، الوسيط) [قديم، جديد مطفأ، جديد مشغَّل]', [await run('x', 'old', 0, mk), await run('y', 'new', 0, mk), await run('z', 'new', 1, mk)]);
// الحجم: جهازان × 30 يومًا × 150 حدثًا (أرقام بالوقت الحقيقي)، و300 في الحجر (تمرين بـ 50 إجابة)، و3000 متأخّرة
{ const sxPack = ids => { let p = 0; return ids.map(v => { const d = (v - p).toString(36); p = v; return d }).join(',') };
  const ids = []; let v = ctl.NOW * 1; for (let i = 0; i < 4500; i++) ids.push(v += 1000 + Math.floor(Math.random() * 600e3));
  const dv = { a: { i: sxPack(ids), lt: v, r0: v, q: v }, b: { i: sxPack(ids), lt: v, r0: v, q: v } };
  const qz = Array.from({ length: 300 }, (_, i) => [v, 'cap', { type: 'quiz', kind: 's2', ok: 9, total: 10, ms: 30000, full: true, t: v, n: v, d: 'dXXXXXXXXXX', qa: Array.from({ length: 50 }, (_, j) => ['wort' + j, 1]) }]);
  const late = Array.from({ length: 3000 }, (_, i) => [v + i * 1000, uniqW[i % uniqW.length], 2]);
  const sz = x => JSON.stringify(x).length;
  I('حجم وثيقة sx بالبايت (حدّ Firestore 1048576؛ حدّ الأرشفة 400000)', { 'أرقام جهازين (9000 رقم)': sz(dv), 'الحجر 300 تمرين': sz(qz), 'متأخّرات 3000': sz(late), 'المجموع': sz({ dv, qz, late }) }) }
console.log(out.join('\n'));
