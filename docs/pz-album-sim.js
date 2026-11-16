const vm=require('vm'),fs=require('fs');
function load(f){const c={console,Math,Date,JSON,Array,Object,String,Number,Set,Map,Intl,localStorage:{getItem(){return null},setItem(){}}};vm.createContext(c);
  vm.runInContext('let P={},LOG=[],QLOG=[],QA=[],BUY=[],R={bank:0,ach:[],lv:1,ts:0},LG={tier:null,w:"",hist:[],ts:0},EN={v:30,t:0},STN=[],STV=0,GIFTS=[],CW=0;'+fs.readFileSync(f,'utf8')+`;this.X={pzFold:typeof pzFold==='function'?pzFold:null,applyEv,pzMonth,get R(){return R},set R(v){R=v},QUESTS,PZ_N,dkey,CFG,econ:()=>0};`,c);c.X.QUESTS.find(q=>q.pz).f=()=>1;return c.X}
const O=load('core_old.js'),N=load('core_new.js');
const rnd=(()=>{let s=7;return()=>(s=(s*1103515245+12345)%2147483648)/2147483648})();
const ok=[];const T=(n,c,x)=>ok.push((c?'PASS ':'FAIL ')+n+(x!==undefined?' → '+x:''));
// 1) ترحيل: بيانات مستخدم حالي (تشرين الثاني 2026) كما هي اليوم
const cur=JSON.stringify({bank:0,ach:[],lv:1,ts:0,pz:[["2026-11-03",0],["2026-11-05",4],["2026-11-09",4],["2026-11-12",7]],qd:[["2026-11-03","perf",0]]});
O.R=JSON.parse(cur);N.R=JSON.parse(cur);
T('ترحيل: قطع تشرين الثاني نفسها قبل أي مطالبة',[...O.pzMonth('2026-11').have].sort()+''===[...N.pzMonth('2026-11').have].sort()+'',[...N.pzMonth('2026-11').have].sort()+'');
// 2) عشر سنوات: نفس الأيام في النسختين، ومرجع كامل بلا قصّ
const REF={'2026-11':new Set([0,4,7])};let day=Date.parse('2026-11-16T10:00:00Z');const end=Date.parse('2036-12-31T10:00:00Z');let claims=0,drawDiff=0,dupOk=0,dupBad=0;
while(day<end){if(rnd()<.8){const d=O.dkey(day);
  const ro=O.applyEv({type:'quest',id:'perf'},day,{server:1}),rn=N.applyEv({type:'quest',id:'perf'},day,{server:1});
  if(ro===true&&rn===true){claims++;const po=O.R.pz[O.R.pz.length-1][1],pn=N.R.pz[N.R.pz.length-1][1];if(po!==pn)drawDiff++;(REF[d.slice(0,7)]=REF[d.slice(0,7)]||new Set);if(pn>=0)REF[d.slice(0,7)].add(pn)}
  // تكرار في اليوم نفسه
  if(N.applyEv({type:'quest',id:'perf'},day+3600e3,{server:1})==='dup')dupOk++;else dupBad++;
  // تغيير الهاتف: الحالة تُقرأ من الخادم كنص JSON
  if(rnd()<.01)N.R=JSON.parse(JSON.stringify(N.R));}
 day+=864e5}
T('عدد المطالبات في 10 سنوات',true,claims);
T('السحب نفسه في النسختين كل يوم',drawDiff===0,drawDiff);
T('منع تكرار المكافأة في اليوم نفسه',dupBad===0,dupOk+' مرة');
const months=Object.keys(REF).sort();let lostN=0,lostO=0,albumN=0,albumO=0,albumRef=0;
for(const m of months){const r=REF[m],n=N.pzMonth(m).have,o=O.pzMonth(m).have;
  if([...r].some(i=>!n.has(i))||n.size!==r.size)lostN++;if([...r].some(i=>!o.has(i)))lostO++;
  if(r.size===9)albumRef++;if(n.size===9)albumN++;if(o.size===9)albumO++}
T('الأشهر',true,months.length+' شهرًا، من '+months[0]+' إلى '+months.at(-1));
T('الجديدة: كل القطع محفوظة لكل شهر',lostN===0,lostN+' شهرًا ناقصًا');
T('الحالية للمقارنة: أشهر فقدت قطعًا',true,lostO);
T('الألبوم الجديد = المرجع',albumN===albumRef,albumN+' من '+albumRef+' (الحالية: '+albumO+')');
T('أول شهر ما زال في الألبوم بعد 10 سنوات',N.pzMonth('2026-11').have.size===REF['2026-11'].size,[...N.pzMonth('2026-11').have].sort()+'');
const sz=JSON.stringify(N.R.pza).length;T('حجم الألبوم بعد 10 سنوات',sz<4000,sz+' بايت، '+Object.keys(N.R.pza).length+' شهرًا');
T('طول سجلّ المطالبات بقي محدودًا',N.R.pz.length<=800,N.R.pz.length);
// 3) تكرار الطيّ لا يغيّر شيئًا، والنسخة القديمة لا تفسد الألبوم

const gs=X=>X.R.qd.reduce((a,x)=>a+(+x[2]||0),0);T('جواهر البازل نفسها في النسختين',JSON.stringify(O.R.qd)===JSON.stringify(N.R.qd),gs(N)+' جوهرة في آخر '+N.R.qd.length+' مطالبة');
const b4=JSON.stringify(N.R.pza);for(let i=0;i<5;i++)N.pzFold();T('تكرار الطيّ لا يغيّر الألبوم',JSON.stringify(N.R.pza)===b4);
// نسخة قديمة من التطبيق تكتب R.pz دون معرفة الألبوم: يبقى الألبوم لأن الخادم وحده يكتب، ولو أعادت قطعًا مكرّرة فالطيّ اتحاد
const save=JSON.stringify(N.R);N.R=JSON.parse(save);N.R.pz=[...N.R.pz,...N.R.pz.slice(0,50)];N.pzFold();T('مطالبات مكرّرة لا تضاعف شيئًا',JSON.stringify(N.R.pza)===b4);
console.log(ok.join('\n'))
