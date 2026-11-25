// البيئة التجريبية في الخادم: لا رجوع تلقائي إلى الإنتاج. نقص قيمة أو قيمة تشير إلى الإنتاج أو حساب خدمة من مشروع آخر → 503 ولا وصول إلى أي قاعدة بيانات.
// الاستعمال: node env.mjs <worker.js>
const W = (await import(process.argv[2])).default; const out = [];
const T = (n, c, x) => out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' → ' + JSON.stringify(x) : ''));
let fetched = 0; const realFetch = globalThis.fetch; globalThis.fetch = async (...a) => { fetched++; throw new Error('no network in test') };
const sa = p => JSON.stringify({ type: 'service_account', project_id: p });   // دون أي مفتاح: الفحص يقرأ اسم المشروع وحده
const STG = { MUF_ENV: 'staging', FB_PROJECT: 'mufradati-stg', ADMIN_EMAIL: 'stg-admin@mufradati.app', ORIGINS: 'https://mufradati-stg.pages.dev', SITE: 'https://mufradati-stg.pages.dev/', SA: sa('mufradati-stg') };
const call = async (env, path = '/', method = 'GET', origin = 'https://mufradati-stg.pages.dev') => { const r = await W.fetch(new Request('https://api.test' + path, { method, headers: { Origin: origin, 'Content-Type': 'application/json' }, ...(method === 'POST' ? { body: '{}' } : {}) }), env, { waitUntil() { } });
  let j = null; const t = await r.text(); try { j = JSON.parse(t) } catch (e) { } return { s: r.status, j, t, aco: r.headers.get('Access-Control-Allow-Origin') } };
// الإنتاج
let r = await call({}, '/', 'GET', 'https://ghadeerabbas.github.io'); T('الإنتاج بلا متغيّرات: يعمل كما هو', r.s === 200 && r.aco === 'https://ghadeerabbas.github.io', [r.s, r.aco]);
r = await call({ SA: sa('mufradati-406bd') }); T('الإنتاج بحساب خدمة الإنتاج: يعمل', r.s === 200, r.s);
r = await call({ SA: sa('mufradati-stg') }); T('خادم تجريبي نُشر بلا MUF_ENV (حساب خدمة تجريبي): يتوقّف، لا يعمل بقيم الإنتاج', r.s === 503 && /not the production/.test(r.j.detail), r.j);
r = await call({ MUF_ENV: 'stage' }); T('قيمة MUF_ENV غير معروفة: يتوقّف', r.s === 503, r.j);
// التجريبية
for (const k of ['FB_PROJECT', 'ADMIN_EMAIL', 'ORIGINS', 'SITE', 'SA']) { const e = { ...STG }; delete e[k]; r = await call(e); T('التجريبية بلا ' + k + ': يتوقّف (لا رجوع إلى الإنتاج)', r.s === 503 && r.j.detail.includes(k), r.j) }
{ const e = { ...STG, ORIGINS: ' ' }; r = await call(e); T('قيمة فارغة: يتوقّف', r.s === 503, r.j) }
for (const [n, x] of [['مشروع الإنتاج', { FB_PROJECT: 'mufradati-406bd', SA: sa('mufradati-406bd') }], ['نطاق الإنتاج', { ORIGINS: 'https://ghadeerabbas.github.io' }], ['نطاق github.io آخر', { ORIGINS: 'https://other.github.io' }], ['موقع الإنتاج', { SITE: 'https://ghadeerabbas.github.io/mufradati/' }]]) {
  r = await call({ ...STG, ...x }); T('التجريبية تشير إلى ' + n + ': يتوقّف', r.s === 503 && /production/.test(r.j.detail), r.j) }
r = await call({ ...STG, ADMIN_EMAIL: 'admin@mufradati.app' }); T('التجريبية ببريد مشرف الإنتاج: يتوقّف', r.s === 503 && /production/.test(r.j.detail), r.j);
r = await call({ ...STG, ADMIN_EMAIL: 'Admin@Mufradati.App' }); T('ولو بأحرف كبيرة: يتوقّف', r.s === 503 && /production/.test(r.j.detail), r.j);
r = await call({ ...STG, SA: sa('mufradati-406bd') }); T('التجريبية بحساب خدمة الإنتاج: يتوقّف', r.s === 503 && /production|mismatch/.test(r.j.detail), r.j);
r = await call({ ...STG, SA: sa('other-proj') }); T('التجريبية بحساب خدمة مشروع آخر: يتوقّف', r.s === 503 && /mismatch/.test(r.j.detail), r.j);
r = await call({ ...STG, SA: 'not json' }); T('حساب خدمة تالف: يتوقّف', r.s === 503, r.j);
r = await call({ ...STG, ORIGINS: 'http://mufradati-stg.pages.dev' }); T('نطاق بلا https: يتوقّف', r.s === 503 && /malformed/.test(r.j.detail), r.j);
r = await call(STG); T('التجريبية كاملة: تعمل، والنطاق المسموح هو التجريبي وحده', r.s === 200 && r.aco === 'https://mufradati-stg.pages.dev', [r.s, r.aco]);
r = await call(STG, '/', 'GET', 'https://ghadeerabbas.github.io'); T('التجريبية لا تسمح بنطاق الإنتاج', r.aco !== 'https://ghadeerabbas.github.io', r.aco);
r = await call(STG, '/err', 'POST', 'https://ghadeerabbas.github.io'); T('التجريبية ترفض طلبًا من صفحة الإنتاج', r.s === 403, r.s);
r = await call({}, '/', 'GET', 'https://mufradati-stg.pages.dev'); T('وبعدها الإنتاج يعود بقيمه (لا تسرّب بين الطلبات)', r.aco === 'https://ghadeerabbas.github.io', r.aco);
// المهمة الليلية: بيئة غير سليمة لا تفعل شيئًا
fetched = 0; let bak = 0; const env = { ...STG, FB_PROJECT: '', BAK: { put() { bak++ }, get() { bak++ }, list() { bak++ } } };
await W.scheduled({}, env, { waitUntil(p) { return p } }); T('المهمة الليلية ببيئة ناقصة: لا شيء يُقرأ أو يُكتب', fetched === 0 && bak === 0, [fetched, bak]);
globalThis.fetch = realFetch; console.log(out.join('\n')); console.log('__END');
