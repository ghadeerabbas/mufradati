// تكامل المرحلة الأولى: شيفرة الخادم الحقيقية (الحالية والمنشورة RELEASED) مع قاعدة في الذاكرة وتطبيقات مُحاكاة. بيانات اصطناعية فقط.
import {T,out,app,user,station,adv,memfs,post,ctl} from '../integration/it.mjs';
const DAY=864e5,BASE=Date.parse('2026-12-01T17:00:00Z');const day=n=>{ctl.NOW=BASE+n*DAY};
const SRS=(o={})=>({srs:{on:1,t0:BASE-DAY,u:['s1','s2','s4','s5','s6','s7','s8','s9'],p:.15,max:5,...o}});
const setCfg=async c=>{await memfs.commit([{path:'config/app',data:{v:JSON.stringify(c)}}]);adv(61e3)};   // الخادم يقرأ الإعداد كل دقيقة على الأكثر
const rate=(A,k,r,v)=>{adv(2000);return A.ev({type:'rate',k,r,...(v?{v}:{})})};
const srv=async uid=>{const d=await memfs.get(`users/${uid}/data/core`);return JSON.parse(d.data.v)};
// متعلّم بخمس كلمات في الصندوق 3، موعدها اليوم d0+7
async function ready(uid,kind='new',d0=0){day(d0);await user(uid);const A=app(kind,uid);A.cfg(SRS());A.srsU(true);await A.sync();await station(A);await A.sync();
  const ks=Object.keys(A.P);day(d0+1);for(const k of ks)rate(A,k,2);await A.sync();day(d0+3);for(const k of ks)rate(A,k,2);await A.sync();day(d0+7);return {A,ks}}
ctl.ACTIVE='new';await setCfg(SRS());
try{

// 1) حساب مفعّل: فشل ثم «صعبة» ← نزول من 3 إلى 1 في الخادم والتطبيق
{const {A,ks}=await ready('s1');const k=ks[0];T('التحضير: الكلمة في الصندوق 3 وموعدها اليوم',A.P[k].box===3&&A.dkey(A.P[k].due)<=A.today(),A.P[k].box);
 rate(A,k,1,-1);const local=A.P[k].box;await A.sync();const S=await srv('s1');
 T('حساب مفعّل: النزول في الهاتف والخادم معًا (3 ← 1)',local===1&&A.P[k].box===1&&S.P[k].box===1&&!A.rej.length,`هاتف ${local} · بعد المزامنة ${A.P[k].box} · خادم ${S.P[k].box} · رفض ${JSON.stringify(A.rej)}`);
 T('حساب مفعّل: مدخل واحد في الأرشيف في الخادم',(S.R.vf||[]).length===1&&S.R.vf[0][1]===k,JSON.stringify(S.R.vf));
 // إعادة إرسال الحدث نفسه مباشرة إلى الخادم
 const ev={type:'rate',k,r:1,v:-1,t:ctl.NOW};const j1=await post('/sync','s1',{evs:[ev]});adv(3000);const j2=await post('/sync','s1',{evs:[{...ev,t:ctl.NOW}]});const S2=await srv('s1');
 T('إعادة إرسال الفشل مرتين: لا نزول ثانٍ ولا مدخل أرشيف ثانٍ',S2.P[k].box===1&&S2.R.vf.length===1,`ردّ ${JSON.stringify(j1.rej)} ${JSON.stringify(j2.rej)} · صندوق ${S2.P[k].box} · أرشيف ${S2.R.vf.length}`);
 // «عرفتها» مع v=-1 مرفوضة
 const k2=ks[1];adv(3000);const j3=await post('/sync','s1',{evs:[{type:'rate',k:k2,r:2,v:-1,t:ctl.NOW}]});const S3=await srv('s1');
 T('الخادم يرفض v=-1 مع «عرفتها»',JSON.stringify(j3.rej).includes('verify')&&S3.P[k2].box===3,JSON.stringify(j3.rej));
 // جهاز ثانٍ يرى الحالة نفسها، والخبرة متطابقة
 await A.sync();const B=app('new','s1');B.cfg(SRS());B.srsU(true);await B.sync();
 T('جهاز ثانٍ: الصناديق والأرشيف والخبرة والجواهر نفسها',JSON.stringify(B.P)===JSON.stringify(A.P)&&JSON.stringify(B.R.vf)===JSON.stringify(A.R.vf)&&B.earned()===A.earned()&&B.xp()===A.xp(),`خبرة ${B.xp()}/${A.xp()} · جواهر ${B.earned()}/${A.earned()}`)}

// 2) مزامنة متأخرة: الجهاز أ يفشل دون إنترنت، والجهاز ب يراجع الكلمة نفسها اليوم ويتزامن أولًا
{const {A,ks}=await ready('s2',  'new',20);const k=ks[0];const B=app('new','s2');B.cfg(SRS());B.srsU(true);await B.sync();
 rate(A,k,1,-1);                       // أ: دون إنترنت
 rate(B,k,2);await B.sync();           // ب: «عرفتها» ← الصندوق 4
 adv(3600e3);await A.sync();const S=await srv('s2');
 T('مزامنة متأخرة في اليوم نفسه: فشل الجهاز أ يُرفض (أقدم من آخر حدث) فلا نزول بعد مراجعة ب',S.P[k].box===4&&!(S.R.vf||[]).length&&A.P[k].box===4,`خادم ${S.P[k].box} · أ ${A.P[k].box} · أرشيف ${(S.R.vf||[]).length} · رفض ${JSON.stringify(A.rej)}`)}

// 3) دون إنترنت ثم مزامنة في اليوم التالي: النزول يُحسب مرة واحدة بوقت الحدث
{const {A,ks}=await ready('s4','new',40);const k=ks[0];rate(A,k,1,-1);rate(A,ks[1],2);const local=JSON.stringify(A.P);
 day(48);await A.sync();const S=await srv('s4');
 T('دون إنترنت يومًا ثم مزامنة: لا رفض، والنزول في الخادم مطابق للهاتف',!A.rej.length&&S.P[k].box===1&&S.R.vf.length===1&&JSON.stringify(A.P)===local,`رفض ${JSON.stringify(A.rej)} · خادم ${S.P[k].box}`);
 await A.sync();await A.sync();const S2=await srv('s4');T('مزامنات إضافية لا تغيّر شيئًا',S2.R.vf.length===1&&S2.P[k].box===1)}

// 4) حساب ليس في القائمة: v تُتجاهل في الخادم حتى لو أرسلها تطبيق يظن أنه مفعّل
{const {A,ks}=await ready('s3','new',60);const k=ks[0];A.srsU(true);rate(A,k,1,-1);await A.sync();const S=await srv('s3');
 T('حساب غير مفعّل: الخادم يعامل الفشل «صعبة» عادية، والهاتف يأخذ حالة الخادم',S.P[k].box===3&&!(S.R.vf||[]).length&&A.P[k].box===3,`خادم ${S.P[k].box} · هاتف ${A.P[k].box}`)}

// 5) مفتاح الإيقاف
{const {A,ks}=await ready('s5','new',80);rate(A,ks[0],1,-1);await A.sync();const e0=A.earned(),x0=A.xp(),S0=await srv('s5');
 await setCfg(SRS({on:0}));A.cfg(SRS({on:0}));await A.sync();const S1=await srv('s5');
 T('الإيقاف: ما نزل يبقى، والخبرة والجواهر كما هي',S1.P[ks[0]].box===1&&S1.R.vf.length===1&&A.earned()===e0&&A.xp()===x0,`خبرة ${x0} → ${A.xp()} · جواهر ${e0} → ${A.earned()}`);
 A.srsU(true);rate(A,ks[1],1,-1);await A.sync();const S2=await srv('s5');
 T('بعد الإيقاف: v الجديدة تُتجاهل («صعبة» عادية)',S2.P[ks[1]].box===3&&S2.R.vf.length===1,`${S2.P[ks[1]].box}`);
 await setCfg(SRS())}

// 6) التطبيق القديم مع الخادم الجديد والميزة مفعّلة لحسابه
{const {A,ks}=await ready('s6','old',100);rate(A,ks[0],1,-1);await A.sync();const S=await srv('s6');
 T('تطبيق قديم + خادم جديد: الحدث يُقبل دون خطأ (والتطبيق القديم لا يرسل v أصلًا)',!A.rej.length&&[1,3].includes(S.P[ks[0]].box),`خادم ${S.P[ks[0]].box} · أرشيف ${(S.R.vf||[]).length}`);
 // تطبيق قديم يقرأ حسابًا فيه R.vf كتبه جهاز جديد
 const N=app('new','s6');N.cfg(SRS());N.srsU(true);await N.sync();rate(N,ks[1],1,-1);await N.sync();const O=app('old','s6');await O.sync();
 T('تطبيق قديم يقرأ حسابًا فيه أرشيف نزول: يعمل، ويرى الصناديق نفسها',JSON.stringify(O.P)===JSON.stringify(N.P),`أرشيف ${(N.R.vf||[]).length}`);
 out.push('INFO تطبيق قديم يقرأ أرشيف النزول: خبرته المحسوبة محليًا '+O.xp()+' والجديد '+N.xp()+' · جواهر '+O.earned()+'/'+N.earned()+' (إن اختلفت، يعرض أرقام الخادم عبر sum)')}

// 7) تطبيق جديد مع الخادم القديم (قبل نشر الخادم)
{ctl.ACTIVE='old';const {A,ks}=await ready('s7','new',120);const k=ks[0];rate(A,k,1,-1);const local=A.P[k].box;await A.sync();const S=await srv('s7');
 T('تطبيق جديد + خادم قديم: لا رفض، والخادم يحسب «صعبة» عادية، والهاتف يأخذ حالته',!A.rej.length&&S.P[k].box===3&&A.P[k].box===3&&!(S.R.vf||[]).length,`هاتف قبل ${local} · بعد ${A.P[k].box} · خادم ${S.P[k].box}`);ctl.ACTIVE='new'}

// 8) حدث قديم أكثر من 7 أيام (دون إنترنت أسبوعًا): يرفضه الخادم كما اليوم، ولا نزول
{const {A,ks}=await ready('s8','new',140);rate(A,ks[0],1,-1);day(156);await A.sync();const S=await srv('s8');
 T('دون إنترنت أكثر من أسبوع: الحدث مرفوض كما اليوم، ولا نزول ولا أرشيف',JSON.stringify(A.rej).includes('time')&&!(S.R.vf||[]).length&&S.P[ks[0]].box===3,JSON.stringify(A.rej))}

// 9) حسابات أخرى لا تتأثر: حساب عادي يراجع بالطريقة نفسها قبل التعديل وبعده
{ctl.ACTIVE='old';const o=await ready('n1','new',160);ctl.ACTIVE='new';const n=await ready('n2','new',160);
 for(const X of [o,n]){rate(X.A,X.ks[0],1);rate(X.A,X.ks[1],3);rate(X.A,X.ks[2],0)}ctl.ACTIVE='old';await o.A.sync();ctl.ACTIVE='new';await n.A.sync();
 const a=await srv('n1'),b=await srv('n2');const box=S=>Object.values(S.P).map(p=>p.box).join(',');
 T('حساب غير مفعّل: الخادم الجديد = الخادم القديم (الصناديق والخبرة والجواهر)',box(a)===box(b)&&o.A.earned()===n.A.earned()&&o.A.xp()===n.A.xp(),box(a)+' / '+box(b)+' · خبرة '+o.A.xp()+'/'+n.A.xp())}
}catch(e){out.push('FAIL خطأ في السيناريو: '+(e&&e.stack||e).toString().split('\n').slice(0,3).join(' | '))}
console.log(out.join('\n'));
