// الحفظ المحلي في الصفحة الحقيقية: ذاكرة ممتلئة فعلًا (حدّ Chromium)، ولا اتصال، وعمل حقيقي عبر ev()، ثم «إغلاق» فوري.
// المطلوب: لا عدم تطابق بين المحفوظ من التقدّم والأحداث، وما لم يُحفظ يُعاد إلى المحفوظ ويُبلَّغ، ولا يُقبل عمل جديد أثناء الإنقاذ.
const realFetch = window.fetch, realRep = window.repErr, REPS = []; window.repErr = m => REPS.push(m);
window.fetch = async (u, o) => { if (String(u).endsWith('/sync')) throw new TypeError('Failed to fetch'); return realFetch(u, o) };   // لا اتصال
// عمل حقيقي يقبله الحساب: تمرين (يُضاف إلى سجلّ التمارين QLOG ويُحفظ في qlog)
const Q = n => ({ type: 'quiz', kind: 's2', ok: 7, total: 10, ms: 30000 + n, full: true, t: Date.now() + n });
stFree(1); stFree(2); save();   // ما يمكن تفريغه يُفرَّغ أولًا، ثم تُملأ الذاكرة: فلا مخرج إلا الفشل
const P0 = QLOG.length, stP = localStorage.getItem(K('qlog')), stQ = localStorage.getItem(K('evq')), stL = localStorage.getItem(K('log')), f0 = STFAIL;
const junk = []; let ji = 0; for (const sz of [50000, 5000, 500, 50, 5]) { try { for (let i = 0; i < 4000; i++) { localStorage.setItem('jf' + ji, 'x'.repeat(sz)); junk.push('jf' + ji++) } } catch (e) { } }
let full = false; try { localStorage.setItem('jfProbe', 'x'.repeat(60)); localStorage.removeItem('jfProbe') } catch (e) { full = true }
T('الذاكرة ممتلئة فعلًا', full, junk.length);
const r1 = ev(Q(1));
T('العمل طُبّق في الذاكرة، ولم يُكتب شيء من الحالة في التخزين (التمارين والأحداث كما كانت؛ والسجلّ كما كان أو حُذفت نسخته المؤكَّدة في الخادم لإفساح المكان)', r1 === true && QLOG.length === P0 + 1 && localStorage.getItem(K('qlog')) === stP && [stL, null].includes(localStorage.getItem(K('log'))) && localStorage.getItem(K('evq')) === stQ, [r1, QLOG.length - P0, localStorage.getItem(K('qlog')) === stP, localStorage.getItem(K('log')) === stL, localStorage.getItem(K('evq')) === stQ]);
const r2 = ev(Q(2));
T('أثناء الإنقاذ لا يُقبل عمل جديد', r2 === 'full', r2);
// «إغلاق فوري» قبل اكتمال الإنقاذ: ما في التخزين متطابق (تقدّم الكلمة كما قبل العمل، والأحداث كما قبله)
{ const sq = JSON.parse(localStorage.getItem(K('qlog')) || '[]'), se = JSON.parse(localStorage.getItem(K('evq')) || '[]'); T('التخزين بعد الإغلاق الفوري متطابق: التمارين المحفوظة بلا العمل الجديد، والأحداث المحفوظة بلا العمل الجديد', sq.length === P0 && !se.some(e => e.ms === 30001), [sq.length, P0]) }
for (let i = 0; i < 100 && STRESC; i++) await sleep(50);
T('بعد فشل الإنقاذ (لا اتصال): الذاكرة عادت إلى المحفوظ', QLOG.length === P0 && !EVQ.some(e => e.ms === 30001) && !STRESC, [QLOG.length - P0, STRESC]);
T('أُبلغ المشرف، وعُدّ الفشل', REPS.some(m => /evq not saved/.test(m)) && STFAIL > f0, [REPS.length, STFAIL - f0]);
T('ظهر للمتعلّم أن آخر عمل لم يُحفظ', document.body.innerText.includes('آخر ما فعلته') && document.body.innerText.includes('ذاكرة الهاتف ممتلئة'), [...document.querySelectorAll('.toast,#toast,[class*=toast]')].map(x => x.innerText).join('|').slice(0, 200));
junk.forEach(x => localStorage.removeItem(x));
const r3 = ev(Q(3));
T('بعد تحرير المساحة: العمل يُقبل ويُحفظ مع حالته', r3 === true && JSON.parse(localStorage.getItem(K('evq'))).some(e => e.ms === 30003) && JSON.parse(localStorage.getItem(K('qlog'))).length === P0 + 1, r3);
window.fetch = realFetch; window.repErr = realRep;
