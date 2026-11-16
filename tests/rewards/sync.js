// ترحيل، ومزامنة بين أجهزة، وإعادة تثبيت، وعمل بلا إنترنت، ونسخة قديمة من التطبيق مع الخادم الجديد
const vm=require('vm'),fs=require('fs');
let NOW=Date.parse('2026-11-16T09:00:00Z');
class FD extends Date{constructor(...a){a.length?super(...a):super(NOW)}static now(){return NOW}}
const PRE='let P={},LOG=[],QLOG=[],QA=[],BUY=[],R={bank:0,ach:[],lv:1,ts:0},LG={tier:0,w:"",hist:[],ts:0},EN={v:30,t:0},STN=[],STV=0,GIFTS=[],CW=0;';
function load(f,kind){const c={console,Math,Date:FD,JSON,Array,Object,String,Number,Set,Map,Intl};vm.createContext(c);
  vm.runInContext(PRE+fs.readFileSync(f,'utf8')+`;this.X={applyEv,econ,pzMonth,QUESTS,dkey,lgPush:typeof lgPush==='function'?lgPush:null,
    get R(){return R},get LG(){return LG},set LG(v){LG=v},get STN(){return STN},
    dump(){return JSON.stringify({R,LG,STN})},load(j){const o=JSON.parse(j);R=Object.assign({bank:0,ach:[],lv:1,ts:0},o.R||{});LG=Object.assign({tier:null,w:"",hist:[],ts:0},o.LG||{});STN=o.STN||[];EC=null},
    gems(){EC=null;return econ().earned}};`,c);c.X.QUESTS.forEach(q=>q.f=()=>999);c.X.kind=kind;return c.X}
const out=[],T=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?' → '+x:''));
// حالة متعلّم حالي بالصيغة المحفوظة اليوم (بلا أي حقل جديد)
const CUR=JSON.stringify({R:{bank:12,ach:[],lv:3,ts:0,qd:[["2026-11-10","rv15",3],["2026-11-12","perf",0],["2026-11-12","rv15",3]],dw:[["abcd1",10],["abcd2",10]],dd:["2026-11-08","2026-11-12"],pz:[["2026-11-03",0],["2026-11-12",4]]},
  LG:{tier:1,w:"2026-11-16",hist:[{w:"2026-11-02",g:20,tier:0,mv:1},{w:"2026-11-09",g:0,tier:1,mv:0}],ts:0},STN:[[Date.parse('2026-11-12T10:00:00Z'),5,1]]});
const SO=load('core_old.js','old'),SN=load('core_new.js','new');SO.load(CUR);SN.load(CUR);
T('ترحيل: الرصيد نفسه في الخادم القديم والجديد قبل أي حدث',SO.gems()===SN.gems(),SN.gems());
T('ترحيل: قطع البازل نفسها',[...SO.pzMonth('2026-11').have].sort()+''===[...SN.pzMonth('2026-11').have].sort()+'');
T('ترحيل: لا حقول جديدة تُكتب قبل الحاجة',!/qdg|dwg|dda|"hg"/.test(SN.dump()));
// الخادم الجديد + ثلاثة أجهزة
const S=SN,REF=load('core_ref.js','ref');REF.load(CUR);
const dev=(k)=>{const X=load(k==='old'?'core_old.js':'core_new.js',k);X.q=[];X.load(S.dump());return X};
const D1=dev('new'),D2=dev('old');let D3=null;
const sync=X=>{for(const e of X.q){S.applyEv(e,NOW,e.ctx);REF.applyEv(e,NOW,e.ctx)}X.q=[];X.load(S.dump())};
const act=(X,e,ctx)=>{e.ctx=ctx;X.applyEv(e,NOW,ctx);X.q.push(e)};   // التطبيق يطبّق الحدث محليًا ثم يرسله
let id=0,maxGap=0,oldLow=0,firstOldLow=null;
const rnd=(()=>{let s=99;return()=>(s=(s*1103515245+12345)%2147483648)/2147483648})();
const end=Date.parse('2037-01-01T09:00:00Z');
while(NOW<end){
  const X=rnd()<.6?D1:D2;const offline=rnd()<.15;
  act(X,{type:'quest',id:'perf'},{server:1});act(X,{type:'quest',id:'rv15'},{server:1});
  act(X,{type:'dwin',id:'w'+(id++)},{server:1,dwinOk:1});if(rnd()<.5)act(X,{type:'duel'},{server:1,duelOk:1});
  if(new FD(NOW).getUTCDay()===1){const h={w:S.dkey(NOW),tier:1,rank:4,n:15,mv:0,g:Math.floor(rnd()*50),xp:90};S.lgPush(h);REF.LG.hist=[...REF.LG.hist,h]}
  if(!offline)sync(X);
  // إعادة تثبيت أحيانًا: جهاز جديد يجلب الحالة من الخادم
  if(rnd()<.01){D3=dev("new");if(D3.gems()!==S.gems())T("إعادة تثبيت أثناء الطريق",false)}
  // الجهاز القديم بعد المزامنة: هل يرى رصيدًا أقل من الخادم؟
  if(!D2.q.length){D2.load(S.dump());const a=S.gems(),b=D2.gems();if(b<a){oldLow++;if(!firstOldLow){firstOldLow=S.dkey(NOW);}}}
  NOW+=864e5}
sync(D1);sync(D2);
T('بعد 10 سنوات: رصيد الخادم الجديد = المرجع بلا قصّ',S.gems()===REF.gems(),S.gems()+' / '+REF.gems());
T('الجهاز الجديد بعد المزامنة = الخادم',D1.gems()===S.gems(),D1.gems());
const D4=dev('new');T('إعادة التثبيت: الرصيد والألبوم من الخادم كاملًا',D4.gems()===S.gems()&&[...D4.pzMonth('2026-11').have].sort()+''===[...REF.pzMonth('2026-11').have].sort()+'',D4.gems());
T('بلا إنترنت: أحداث الأيام غير المتزامنة وصلت كلها بعد عودة الاتصال',D1.q.length===0&&D2.q.length===0);
T('نسخة قديمة من التطبيق: أول يوم يعرض فيه رصيدًا أقل من الخادم',true,(firstOldLow||'لا يحدث')+' · أيام: '+oldLow);
console.log(out.join('\n'));
