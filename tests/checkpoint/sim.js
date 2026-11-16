// نقطة حفظ سجلّ المراجعات: محاكاة سنوات بنشاط مرتفع. REF = main بلا حدّ للسجل (المرجع)، OLD = main (يحذف عند 60000)، NEW = هذا الفرع (يطوي)
// NEW يُحفظ ويُعاد تحميله بصيغة الخادم (السجل مضغوط بالثواني + وثيقة نقطة الحفظ)، ويُنقل إلى «جهاز» جديد دوريًا
const vm=require('vm'),fs=require('fs'),path=require('path');
const [,,ROOT,OLDF,NEWF,YEARS]=process.argv;const PK=fs.readFileSync(path.join(ROOT,'server/worker.src.js'),'utf8').split('\n').filter(l=>/^function (un)?pack(Log|QA)/.test(l)).join('\n');
let NOW=Date.parse('2026-11-16T06:00:00Z');
class FD extends Date{constructor(...a){a.length?super(...a):super(NOW)}static now(){return NOW}}
function load(src,kind){const c={console,Math,Date:FD,JSON,Array,Object,String,Number,Set,Map,Intl};vm.createContext(c);
  vm.runInContext('let P={},LOG=[],QLOG=[],QA=[],BUY=[],R={bank:0,ach:[],lv:1,ts:0},LG={tier:0,w:"",hist:[],ts:0},EN={v:30,t:0,u:Date.parse("2040-01-01")},STN=[],STV=0,GIFTS=[],CW=0;'+src+'\n'+PK+`
  this.X={applyEv,econ:()=>{EC=null;return econ()},get P(){return P},get LOG(){return LOG},get CK(){return typeof CK==='undefined'?null:CK},
   save(){return {core:JSON.stringify({P,QLOG,BUY,R,LG,EN,STN,STV}),log:JSON.stringify(packLog(LOG)),ck:typeof CK!=='undefined'&&CK?JSON.stringify(CK):""}},
   load(s){const c=JSON.parse(s.core);P=c.P;QLOG=c.QLOG;BUY=c.BUY;R=c.R;LG=c.LG;EN=c.EN;STN=c.STN;STV=c.STV;LOG=unpackLog(JSON.parse(s.log));if(typeof CK!=='undefined')CK=s.ck?JSON.parse(s.ck):null;EC=null}};`,c);c.X.kind=kind;return c.X}
const srcOld=fs.readFileSync(OLDF,'utf8'),srcRef=srcOld.replace('if(LOG.length>60000)LOG=LOG.slice(-60000);','');if(srcRef===srcOld)throw 'ref';
const REF=load(srcRef,'ref'),OLD=load(srcOld,'old');let NEW=load(fs.readFileSync(NEWF,'utf8'),'new');
let rs=1;const rnd=()=>(rs=(rs*1103515245+12345)%2147483648)/2147483648;
const out=[],T=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?' → '+x:''));
const WITH_OLD=(+YEARS||10)<=2;   // الحالية للمقارنة فقط في المحاكاة القصيرة (حذفها عند الحدّ بطيء جدًّا)
const ALL=()=>WITH_OLD?[REF,OLD,NEW]:[REF,NEW];let wid=0,ev=0,diffRet=0,folds=0,lastCkT=0,reloads=0,devices=0,maxLog=0,maxCk=0,maxLogDoc=0;
const fields=e=>({xp:e.xp,lv:e.lv,earned:e.earned,rev:e.s.reviews,mem:e.s.mem,mast:e.s.mast,best:e.s.best,streak:e.s.streak,perfect:e.s.perfect,maxDay:e.s.maxDay,night:e.s.night,early:e.s.early,days:Object.keys(e.per).length,alv:JSON.stringify(e.alv)});
const days=Math.round(365.25*(+YEARS||10));let bad=[],checks=0,oldBad=0,pBad=0;
const t0=Date.now();
for(let day=0;day<days;day++){
  NOW=Date.parse('2026-11-16T05:00:00Z')+day*864e5;const H=[5,8,12,18,22.5][day%5];NOW+=Math.floor(H*3600e3/1000)*1000;   // ساعات مختلفة: فجر وليل أيضًا
  const step=ms=>{NOW+=ms};const both=e=>{const r=ALL().map(X=>JSON.stringify(X.applyEv(e,NOW,{server:true})));if(r[0]!==r[r.length-1])diffRet++;ev++;return r[r.length-1]};
  const VOCAB=+(process.env.VOCAB||1e9);const act=rnd();const nSt=wid>=VOCAB||act<.1?0:1+Math.floor(rnd()*4),nRev=act<.1?Math.floor(rnd()*15):150+Math.floor(rnd()*200);
  for(let i=0;i<nSt;i++){both({type:'stStart'});step(12000);const ws=[0,1,2,3,4].map(()=>'w'+(wid++));both({type:'stDone',words:ws,miss:rnd()<.3?[ws[0]]:[]});step(20000);both({type:'quiz',kind:'drill',ok:4,total:5,ms:9000});step(20000)}
  const keys=Object.keys(NEW.P);
  for(let i=0;i<nRev&&keys.length;i++){let k;for(let a=0;a<4;a++){k=keys[Math.floor(rnd()*keys.length)];if(NEW.P[k].due<=NOW)break}
    const x=rnd(),r=x<.12?0:x<.25?1:x<.85?2:3;both({type:'rate',k,r});step(1000+Math.floor(rnd()*4)*1000)}
  maxLog=Math.max(maxLog,NEW.LOG.length);
  if(NEW.CK&&NEW.CK.t!==lastCkT){folds++;lastCkT=NEW.CK.t;const s=NEW.save();maxCk=Math.max(maxCk,s.ck.length)}
  // حفظ في «الخادم» وإعادة تحميل (أسبوعيًا)، وتغيير الجهاز (شهريًا)
  if(day%7===6){const s=NEW.save();maxLogDoc=Math.max(maxLogDoc,s.log.length);if(day%30===29){NEW=load(fs.readFileSync(NEWF,'utf8'),'new');devices++}NEW.load(JSON.parse(JSON.stringify(s)));reloads++}
  if(day%30===29||day===days-1){checks++;const a=fields(REF.econ()),b=fields(NEW.econ()),o=WITH_OLD?fields(OLD.econ()):a;
    if(JSON.stringify(a)!==JSON.stringify(b))bad.push(day+': '+JSON.stringify(a)+' ≠ '+JSON.stringify(b));if(o.xp!==a.xp)oldBad++;
    if(JSON.stringify(REF.P)!==JSON.stringify(NEW.P))pBad++}
}
const a=fields(REF.econ()),b=fields(NEW.econ()),o=WITH_OLD?fields(OLD.econ()):{};
T('المحاكاة',true,`${days} يومًا · ${ev} حدثًا · ${Math.round((Date.now()-t0)/1000)} ث`);
T('الطيّ حدث مرات',folds>0,folds+' مرة · أطول سجل حيّ '+maxLog);
T('ردود كل الأحداث (قبول ورفض) مطابقة للمرجع',diffRet===0,diffRet);
T('كل الأرقام مطابقة للمرجع في كل فحص شهري',bad.length===0,checks+' فحصًا'+(bad.length?' · أول اختلاف: '+bad[0]:''));
T('حالة الكلمات ومواعيد مراجعتها مطابقة للمرجع',pBad===0,pBad);
T('في النهاية: الخبرة والمستوى والجواهر',a.xp===b.xp&&a.lv===b.lv&&a.earned===b.earned,`مرجع ${a.xp} خبرة، مستوى ${a.lv}، ${a.earned} جوهرة · جديد ${b.xp}، ${b.lv}، ${b.earned} ${WITH_OLD?`· الحالي ${o.xp}، ${o.lv}، ${o.earned}`:''}`);
T('في النهاية: السلسلة والإنجازات',a.best===b.best&&a.streak===b.streak&&a.alv===b.alv&&a.perfect===b.perfect&&a.maxDay===b.maxDay,`أطول سلسلة ${b.best}، مثالية ${b.perfect}، أكثر يوم ${b.maxDay}`);
T('مكافآت الحفظ والرسوخ لم تتكرّر (عدد الكلمات المحفوظة والراسخة)',a.mem===b.mem&&a.mast===b.mast,`محفوظة ${b.mem}، راسخة ${b.mast} ${WITH_OLD?`(الحالي: ${o.mem}، ${o.mast})`:''}`);
if(WITH_OLD)T('الحالي للمقارنة: فحوص فقد فيها خبرة',true,oldBad+' من '+checks);
T('إعادة تحميل وتغيير جهاز',true,reloads+' إعادة · '+devices+' جهاز');
T('الأحجام',maxCk<500000&&maxLogDoc<1000000,`نقطة الحفظ ${Math.round(maxCk/1024)} ك.ب · وثيقة السجل ${Math.round(maxLogDoc/1024)} ك.ب (الحدّ 1024)`);
console.log(out.join('\n'));
