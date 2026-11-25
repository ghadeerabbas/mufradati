// قياس وقت المعالج لطلب المزامنة: الخادم المنشور (القديم) مقابل الجديد (المفتاح مطفأ، ومشغَّل)، على الحساب نفسه والأحداث نفسها.
// الطريقة: حساب كبير (سجلّ 50000) يُعاد إلى حالته نفسها قبل كل قياس، وجمع القمامة قبل كل قياس (node --expose-gc)،
// وقت المعالج للعملية (process.cpuUsage) لا وقت الساعة، والتشغيلات متناوبة (قديم، مطفأ، مشغَّل، …) فيصيب أي تشويش الثلاثة بالتساوي.
// Node أسرع من Cloudflare، فالأرقام المطلقة تقريبية؛ المهم النسبة. الاستعمال: node --expose-gc bench.mjs <DIR> <REPO> [مرات]
import { app, user, ctl, post, memfs, DB } from '../integration/it.mjs';
const DAY = 864e5, out = [], REPS = +process.argv[4] || 40;
const I = (n, x) => out.push('INFO bench: ' + n + ' → ' + JSON.stringify(x));
const words = JSON.parse((await import('node:fs')).readFileSync(process.argv[3] + '/words-a1.json', 'utf8')).words.map(w => String(w.de).trim().toLowerCase());
const W = [...new Set(words)];
const cfgDoc = on => ({ path: 'config/app', data: { v: JSON.stringify({ sx: { on } }) } });
// حساب كبير: 50000 عنصر في السجلّ على 300 يوم، وكل الكلمات معروفة
const uid = 'bench'; await user(uid); { const A = app('new', uid); await A.sync() }
{ const start = ctl.NOW - 300 * DAY, K = [], ix = {}, F = []; let p = 0;
  for (let i = 0; i < 50000; i++) { const t = start + i * Math.floor(300 * DAY / 50000), k = W[i % W.length]; if (ix[k] === undefined) { ix[k] = K.length; K.push(k) } const s = Math.round(t / 1000); F.push(s - p, ix[k], 2, i < W.length ? 1 : 0); p = s }
  const P = {}; for (const k of W) P[k] = { box: 3, due: ctl.NOW - DAY, t: start };
  const core = JSON.parse(DB.get(`users/${uid}/data/core`).data.v); core.P = P; core.lf = 1; core.EN = { v: 30, t: ctl.NOW - DAY, lt: ctl.NOW - 1000 };
  await memfs.commit([{ path: `users/${uid}/data/core`, data: { v: JSON.stringify(core) } }, { path: `users/${uid}/data/log`, data: { v: JSON.stringify({ K, F }) } }]) }
const snap = new Map([...DB].filter(([p]) => p.startsWith(`users/${uid}`) || p === `names/${uid}`).map(([p, d]) => [p, JSON.stringify(d)]));
const reset = () => { for (const p of [...DB.keys()]) if (p.startsWith(`users/${uid}/`) && !snap.has(p)) DB.delete(p); for (const [p, d] of snap) DB.set(p, JSON.parse(d)) };
let n = 0; const rates = (cnt, back) => () => Array.from({ length: cnt }, (_, i) => ({ type: 'rate', k: W[(i * 7) % W.length], r: 2, t: ctl.NOW - back + i * 20e3, n: (ctl.NOW + 2e9) + ++n, d: 'benchdev1' }));
const cases = { 'عادية: 10 مراجعات': rates(10, 300e3), 'كبيرة: 300 مراجعة': rates(300, 300 * 21e3), 'متأخّرة: 50 مراجعة أقدم من آخر حدث': rates(50, 2 * DAY) };
const variants = [['قديم', 'old', 0], ['جديد مطفأ', 'new', 0], ['جديد مشغَّل', 'new', 1]];
const cpu = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000 };
const stat = a => { const s = [...a].sort((x, y) => x - y), q = f => s[Math.min(s.length - 1, Math.floor(f * s.length))]; return { med: +q(.5).toFixed(2), p25: +q(.25).toFixed(2), p75: +q(.75).toFixed(2) } };
for (const [name, mk] of Object.entries(cases)) {
  const R = Object.fromEntries(variants.map(v => [v[0], []]));
  for (let r = 0; r < REPS + 5; r++) for (const [label, which, on] of variants) {
    reset(); await memfs.commit([cfgDoc(on)]); ctl.ACTIVE = which; const evs = mk();
    await post('/sync', 'warm' + (r % 2), { evs: [] }).catch(() => 0);   // الإعدادات في الذاكرة (كما في الخادم الدافئ)
    if (globalThis.gc) gc(); const a = cpu(); await post('/sync', uid, { evs, dev: 'benchdev1' }); const d = cpu() - a; if (r >= 5) R[label].push(d) }
  const S = Object.fromEntries(Object.entries(R).map(([k, v]) => [k, stat(v)])), base = S['قديم'].med;
  I(name + ' — وقت المعالج بالملّي ثانية (الوسيط [الربع الأول، الثالث])، ' + REPS + ' مرة', Object.fromEntries(Object.entries(S).map(([k, v]) => [k, `${v.med} [${v.p25}–${v.p75}] (${base ? ((v.med / base - 1) * 100).toFixed(0) : 0}%)`])));
}
console.log(out.join('\n'));
