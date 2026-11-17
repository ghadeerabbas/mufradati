// محاكاة 10 سنوات: OLD = النسخة الحالية (main)، NEW = الفرع، REF = النسخة الحالية بلا أي قصّ (المرجع «الصحيح»)
const vm=require('vm'),fs=require('fs');
let NOW=Date.parse('2026-11-16T09:00:00Z');
class FD extends Date{constructor(...a){a.length?super(...a):super(NOW)}static now(){return NOW}}
const PRE='let P={},LOG=[],QLOG=[],QA=[],BUY=[],R={bank:0,ach:[],lv:1,ts:0},LG={tier:0,w:"",hist:[],ts:0},EN={v:30,t:0},STN=[],STV=0,GIFTS=[],CW=0;';
function load(f,kind){const c={console,Math,Date:FD,JSON,Array,Object,String,Number,Set,Map,Intl,localStorage:{getItem(){return null},setItem(){}}};vm.createContext(c);
  vm.runInContext(PRE+fs.readFileSync(f,'utf8')+`;this.X={applyEv,econ,pzMonth,QUESTS,dkey,duelDays,lgPush:typeof lgPush==='function'?lgPush:null,
    get R(){return R},set R(v){R=v},get LG(){return LG},set LG(v){LG=v},get STN(){return STN},set EC(v){EC=v},
    dump(){return JSON.stringify({R,LG,STN})},load(j){const o=JSON.parse(j);R=o.R;LG=o.LG;STN=o.STN;EC=null}};`,c);
  c.X.QUESTS.forEach(q=>q.f=()=>999);c.X.kind=kind;return c.X}
const A={OLD:load('core_old.js','old'),NEW:load('core_new.js','new'),REF:load('core_ref.js','ref')};
const rnd=(()=>{let s=12345;return()=>(s=(s*1103515245+12345)%2147483648)/2147483648})();
const out=[],T=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?' → '+x:''));
const INFO=(n,x)=>out.push('INFO '+n+(x!==undefined?' → '+x:''));   // معلومة للعرض فقط: لا تُحسب نجاحًا ولا فشلًا
const resDiff={qd:0,pz:0,ret:0};let k=0;
const end=Date.parse('2037-01-05T09:00:00Z');let snaps=[];
while(NOW<end){
  const r={perf:rnd()<.8,rv:rnd()<.9,dw:rnd()<.9,duel:rnd()<.5,st:rnd()<.6,week:new FD(NOW).getUTCDay()===1,g:Math.floor(rnd()*60)};
  const rets=[];
  for(const X of Object.values(A)){X.EC=null;const ret=[];
    if(r.st)X.STN.push([NOW,5,1]);
    if(r.perf)ret.push(X.applyEv({type:'quest',id:'perf'},NOW,{server:1}));
    if(r.rv)ret.push(X.applyEv({type:'quest',id:'rv15'},NOW,{server:1}));
    ret.push(X.applyEv({type:'quest',id:'perf'},NOW+60e3,{server:1}));   // محاولة تكرار
    if(r.dw)ret.push(X.applyEv({type:'dwin',id:'d'+k},NOW,{server:1,dwinOk:1}));
    if(r.dw&&k%97===0)ret.push(X.applyEv({type:'dwin',id:'d'+(k-1)},NOW,{server:1,dwinOk:1}));   // تكرار فوز قريب
    if(r.duel)ret.push(X.applyEv({type:'duel'},NOW,{server:1,duelOk:1}));
    if(r.week){const h={w:X.dkey(NOW),tier:0,rank:3,n:15,mv:0,g:r.g,xp:100};if(X.kind==='new')X.lgPush(h);else if(X.kind==='old')X.LG.hist=[...X.LG.hist,h].slice(-52);else X.LG.hist=[...X.LG.hist,h]}
    rets.push(JSON.stringify(ret)+'|'+JSON.stringify(X.R.qd.slice(-3))+'|'+JSON.stringify(X.R.pz.slice(-1)));}
  if(rets[1]!==rets[2])resDiff.ret++;
  // إعادة تثبيت أو جهاز آخر: الحالة تُقرأ من الخادم كنص
  if(rnd()<.02){A.NEW.load(A.NEW.dump())}
  k++;NOW+=864e5;
  if(new FD(NOW).getUTCMonth()===0&&new FD(NOW).getUTCDate()===1){const e={};for(const [n,X] of Object.entries(A)){X.EC=null;const c=X.econ();e[n]={earned:c.earned,best:c.s.best,streak:c.s.streak}}snaps.push([X=>X,new FD(NOW).getUTCFullYear(),e])}
}
INFO('أيام المحاكاة',k+' يومًا حتى '+A.NEW.dkey(NOW));
T('المكافآت وردود الأحداث (منح، رفض، تكرار) متطابقة بين الجديدة والمرجع كل يوم',resDiff.ret===0,resDiff.ret+' يومًا مختلفًا');
for(const [,y,e] of snaps)T('1 كانون الثاني '+y+': الجواهر المكتسبة والسلسلة',e.NEW.earned===e.REF.earned&&e.NEW.best===e.REF.best&&e.NEW.streak===e.REF.streak,
  `مرجع ${e.REF.earned} · جديدة ${e.NEW.earned} · حالية ${e.OLD.earned} | أطول سلسلة: مرجع ${e.REF.best} جديدة ${e.NEW.best} حالية ${e.OLD.best}`);
// البازل
const months=new Set(A.REF.R.pz.map(x=>x[0].slice(0,7)));let lostN=0,lostO=0,albR=0,albN=0,albO=0;
for(const m of months){const r=A.REF.pzMonth(m).have,n=A.NEW.pzMonth(m).have,o=A.OLD.pzMonth(m).have;if(r.size!==n.size||[...r].some(i=>!n.has(i)))lostN++;if(r.size!==o.size)lostO++;if(r.size===9)albR++;if(n.size===9)albN++;if(o.size===9)albO++}
T('البازل: كل أشهر الجديدة مطابقة للمرجع',lostN===0,`${months.size} شهرًا · ألبوم: مرجع ${albR} جديدة ${albN} حالية ${albO} · أشهر ناقصة في الحالية ${lostO}`);
const sz=n=>JSON.stringify(A[n].R).length+JSON.stringify(A[n].LG).length;
T('حجم الحالة بعد 10 سنوات',sz('NEW')<sz('REF'),`جديدة ${sz('NEW')} بايت · مرجع بلا قصّ ${sz('REF')} · حالية ${sz('OLD')}`);
T('أطوال السجلات في الجديدة',A.NEW.R.qd.length<=600&&A.NEW.R.dw.length<=2000&&A.NEW.R.dd.length<=400&&A.NEW.R.pz.length<=800&&A.NEW.LG.hist.length<=52,
  `qd ${A.NEW.R.qd.length} dw ${A.NEW.R.dw.length} dd ${A.NEW.R.dd.length} pz ${A.NEW.R.pz.length} hist ${A.NEW.LG.hist.length}`);
T('أيام التحدّي كلها محفوظة',A.NEW.duelDays().length===A.REF.duelDays().length,A.NEW.duelDays().length+' يومًا');
console.log(out.join('\n'));
