// اختبارات وحدة لقواعد المرحلة الأولى (التحقّق من التذكّر) على core.js الحالي، ببيانات اصطناعية فقط.
// الاستعمال: node unit.mjs <core_new.js> <core_old.js>
import vm from 'node:vm';import fs from 'node:fs';
const [NEW,OLD]=process.argv.slice(2);const out=[];const T=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?' → '+x:''));
const DAY=864e5,T0=Date.parse('2026-12-01T17:00:00Z');   // 18:00 بتوقيت برلين
function mk(file,patch=s=>s){const c={console,Math,JSON,Array,Object,String,Number,Set,Map,Date};vm.createContext(c);
  vm.runInContext('var P={},LOG=[],QLOG=[],QA=[],BUY=[],R={bank:0,ach:[],lv:1,ts:0},LG={tier:0,w:"",hist:[],ts:0},EN={v:30,t:0,u:9e15},STN=[],STV=0,GIFTS=[];'
    +patch(fs.readFileSync(file,'utf8')).replace(/^const /gm,'var ').replace(/^let /gm,'var ')+';this.X={get P(){return P},set P(v){P=v},get LOG(){return LOG},set LOG(v){LOG=v},get R(){return R},set R(v){R=v},get CK(){return CK}}',c);return c}
const cfg=(c,s)=>c.applyCfg(s===undefined?null:{srs:s});
const ON={on:1,t0:T0-30*DAY,u:['u1'],p:.15,max:5};
// كلمة في صندوق محدّد، موعدها اليوم، وآخر تقييم محسوب لها «عرفتها»
function seed(c,k,box,t){c.X.P[k]={box,due:t-1000,t:t-c.IV[box]*DAY};c.X.LOG.push([t-c.IV[box]*DAY,k,2,0])}
const rate=(c,k,r,t,v)=>c.applyEv({type:'rate',k,r,t,...(v?{v}:{})},t,{server:true});
const fresh=(s=ON,uid=true)=>{const c=mk(NEW);if(s==='none')c.applyCfg(null);else cfg(c,s);c.SRSU=uid;c.EC=null;return c};

// 1) جدول النزول
const exp={3:1,4:2,5:2,6:3,7:3,8:4};
for(const b of [3,4,5,6,7,8]){const c=fresh(),t=T0;seed(c,'w',b,t);const r=rate(c,'w',1,t,-1),p=c.X.P.w;
  T(`النزول: الصندوق ${b} ← ${exp[b]} بموعد +${c.IV[exp[b]]} يوم`,r===true&&p.box===exp[b]&&p.due===t+c.IV[exp[b]]*DAY&&c.X.R.vf.length===1,`صندوق ${p.box} · موعد +${(p.due-t)/DAY} · أرشيف ${(c.X.R.vf||[]).length}`)}
// 2) «نسيت» مع v=-1 = «نسيت» العادية، بلا أرشيف
{const c=fresh();seed(c,'w',6,T0);rate(c,'w',0,T0,-1);T('«نسيت» بعد الفشل: الصندوق 0 كما اليوم، ولا أرشيف',c.X.P.w.box===0&&!(c.X.R.vf||[]).length)}
// 3) «عرفتها»/«سهلة» مع v=-1 مرفوضة حين تكون الميزة مفعّلة
{const c=fresh();seed(c,'w',6,T0);const a=rate(c,'w',2,T0,-1),b=rate(c,'w',3,T0+1000,-1);T('v=-1 مع «عرفتها» أو «سهلة»: مرفوضة (verify) ولا يتغيّر شيء',a==='verify'&&b==='verify'&&c.X.P.w.box===6&&c.X.LOG.length===1,a+','+b)}
// 4) الميزة غير مفعّلة: v تُتجاهل
for(const [n,s,u,t] of [['المفتاح مطفأ',{...ON,on:0},true,T0],['الحساب ليس في القائمة',ON,false,T0],['الحدث قبل t0',{...ON,t0:T0+DAY},true,T0],['لا إعداد srs أصلًا','none',true,T0]]){
  const c=fresh(s,u);seed(c,'w',6,t);const r1=rate(c,'w',1,t,-1);const c2=fresh(s,u);seed(c2,'w',6,t);const r2=rate(c2,'w',3,t,-1);
  T(`${n}: v تُتجاهل («صعبة» عادية، و«سهلة» مقبولة)`,r1===true&&c.X.P.w.box===6&&!(c.X.R.vf||[]).length&&r2===true&&c2.X.P.w.box===8,`${c.X.P.w.box} / ${c2.X.P.w.box}`)}
// 5) التدريب (قبل الموعد، أو الكلمة رُوجعت اليوم): لا نزول
{const c=fresh();c.X.P.w={box:6,due:T0+5*DAY,t:T0-25*DAY};c.X.LOG.push([T0-25*DAY,'w',2,0]);rate(c,'w',1,T0,-1);
 T('قبل الموعد: لا نزول ولا أرشيف',c.X.P.w.box===6&&!(c.X.R.vf||[]).length,c.X.P.w.box)}
// 6) إعادة إرسال الحدث نفسه، وتقييم ثانٍ للكلمة في اليوم نفسه
{const c=fresh();seed(c,'w',6,T0);rate(c,'w',1,T0,-1);const r2=rate(c,'w',1,T0,-1),r3=rate(c,'w',1,T0+3600e3,-1);
 T('الحدث نفسه مرتين ثم تقييم ثالث في اليوم: نزول واحد ومدخل أرشيف واحد',c.X.P.w.box===3&&c.X.R.vf.length===1,`ردّ الثاني ${r2} · الثالث ${r3} · صندوق ${c.X.P.w.box} · أرشيف ${c.X.R.vf.length}`)}
// 7) إعادة الحساب تطابق P، والمكافآت لا تأتي مبكرة، على 40 كلمة و300 يوم
function longSim(c,seedN=1){let h=seedN>>>0;const rnd=()=>{h=h+0x6D2B79F5|0;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296};
  const mx={};let fails=0;
  for(let i=0;i<40;i++){const k='k'+i,t=T0-40*DAY+i*60e3;c.X.P[k]={box:1,due:t+DAY,t};c.X.LOG.push([t,k,2,1]);mx[k]=1}
  for(let d=-39;d<300;d++){let n=0;for(let i=0;i<40;i++){const k='k'+i,t=T0+d*DAY+(n++)*20e3,p=c.X.P[k];if(c.dkey(t)<c.dkey(p.due))continue;
      const x=rnd();let r,v;if(p.box>=3&&x<.25){v=-1;r=rnd()<.7?1:0;fails++}else r=x<.3?0:x<.4?1:x<.8?2:3;
      const res=rate(c,k,r,t,v);if(res!==true)throw new Error('رفض '+res);if(r===0)rate(c,k,2,t+5000);mx[k]=Math.max(mx[k],c.X.P[k].box)}}
  return {mx,fails}}
{const c=fresh();const {mx,fails}=longSim(c);const S=c.ckState();c.replayLog(S,c.X.LOG);let diff=0;for(const k in c.X.P)if(S.box[k]!==c.X.P[k].box)diff++;
 T('إعادة الحساب: صندوق كل كلمة = صندوقها في P (40 كلمة، 300 يوم)',diff===0&&fails>50,'اختلاف '+diff+' · نزول '+c.X.R.vf.length+' · فشل '+fails);
 const r7=Object.keys(mx).filter(k=>mx[k]>=7).length,r4=Object.keys(mx).filter(k=>mx[k]>=4).length;
 T('مكافأة الرسوخ والحفظ: فقط للكلمات التي بلغت الصندوق 7 أو 4 فعلًا',S.r7.size===r7&&S.r4.size===r4,`رسوخ ${S.r7.size}/${r7} · حفظ ${S.r4.size}/${r4}`);
 // دون الأرشيف كانت المكافآت ستختلف: دليل أن الفحص يختبر شيئًا
 const R0=c.X.R;c.X.R={...R0,vf:[]};const S2=c.ckState();c.replayLog(S2,c.X.LOG);let d2=0;for(const k in c.X.P)if(S2.box[k]!==c.X.P[k].box)d2++;c.X.R=R0;
 T('الفحص السابق حسّاس: بلا الأرشيف تختلف الصناديق',d2>0,'اختلاف '+d2);
 // مفتاح الإيقاف لا يغيّر الماضي
 c.EC=null;const e1=c.econ();cfg(c,{...ON,on:0});c.EC=null;const e2=c.econ();c.SRSU=false;c.EC=null;const e3=c.econ();
 T('الإيقاف (on:0 أو حذف الحساب من القائمة): الخبرة والجواهر والحفظ كما هي',e1.xp===e2.xp&&e2.xp===e3.xp&&e1.gems===e3.gems&&e1.s.mem===e3.s.mem&&e1.s.mast===e3.s.mast,`${e1.xp}/${e2.xp}/${e3.xp}`)}
// 8) نقطة الحفظ: econ مع الطيّ = econ دون طيّ، والأرشيف يُقصّ
{const big=s=>s.replace('const LOG_MAX=60000,LOG_KEEP=50000','const LOG_MAX=1e9,LOG_KEEP=1e9');
 const small=s=>s.replace('const LOG_MAX=60000,LOG_KEEP=50000','const LOG_MAX=2000,LOG_KEEP=1200');
 const run=p=>{const c=mk(NEW,p);cfg(c,ON);c.SRSU=true;let h=7;const rnd=()=>{h=(h*1103515245+12345)>>>0;return h/4294967296};
   for(let i=0;i<120;i++){const k='z'+i,t=T0-200*DAY+i*1000;c.X.P[k]={box:1,due:t+DAY,t};c.X.LOG.push([t,k,2,1])}
   for(let d=-199;d<120;d++){let n=0;for(let i=0;i<120;i++){const k='z'+i,t=T0+d*DAY+(n++)*20e3,p=c.X.P[k];if(c.dkey(t)<c.dkey(p.due))continue;
     const x=rnd();if(p.box>=3&&x<.3)rate(c,k,1,t,-1);else rate(c,k,x<.4?0:2,t)}}
   c.EC=null;return c};
 const A=run(big),B=run(small);const ea=A.econ(),eb=B.econ();
 const same=ea.xp===eb.xp&&ea.gems===eb.gems&&ea.s.mem===eb.s.mem&&ea.s.mast===eb.s.mast&&ea.s.reviews===eb.s.reviews&&JSON.stringify(A.X.P)===JSON.stringify(B.X.P);
 T('نقطة الحفظ: الحساب بعد الطيّ = الحساب من السجلّ الكامل (مع نزول)',same&&!!B.X.CK,`خبرة ${ea.xp}/${eb.xp} · رسوخ ${ea.s.mast}/${eb.s.mast} · سجلّ ${A.X.LOG.length}/${B.X.LOG.length}`);
 T('نقطة الحفظ: مدخلات الأرشيف المطويّة تُحذف ويبقى ما بعدها',B.X.R.vf.length<A.X.R.vf.length&&B.X.R.vf.every(x=>x[0]*1000>=B.X.CK.t-1000),`${A.X.R.vf.length} → ${B.X.R.vf.length}`)}
// 9) الإعداد: قيم خاطئة لا تكسر شيئًا
{const c=mk(NEW);c.applyCfg({srs:{on:'x',t0:'bad',u:'u1',p:7,max:-3}});const s=c.CFG.srs;T('إعداد srs خاطئ يُصحَّح',s.on===1&&s.t0===0&&Array.isArray(s.u)&&!s.u.length&&s.p===1&&s.max===0,JSON.stringify(s));
 c.applyCfg(null);T('دون إعداد: الميزة مطفأة',c.CFG.srs.on===0&&c.CFG.srs.p===.15&&c.CFG.srs.max===5)}
// 10) core.js المنشور اليوم (القديم) مع بيانات فيها R.vf وأحداث فيها v
{const c=mk(OLD);c.applyCfg({srs:ON});seed(c,'w',6,T0);c.X.R={...c.X.R,vf:[[1,'x']]};let err='';try{c.EC=null;c.econ()}catch(e){err=e.message}
 const r=rate(c,'w',1,T0,-1);T('core.js القديم: يقرأ R.vf دون خطأ، و v=-1 عنده «صعبة» عادية',!err&&r===true&&c.X.P.w.box===6,err||c.X.P.w.box)}
console.log(out.join('\n'));
