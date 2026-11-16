// اختبار الإصلاحات الثلاثة معًا (perf-quest-fix + rewards-archive + league-bots-floor) — محلي فقط
// OLD = core.js من main، NEW = core.js في هذا الفرع. «الخادم» يُحاكى بحفظ الحالة والسجلّ بالثواني كما في worker.src.js
const vm=require('vm'),fs=require('fs'),path=require('path');
const ROOT=process.argv[2],W=fs.readFileSync(path.join(ROOT,'server/worker.src.js'),'utf8').split('\n'),PK=W.slice(20,24).join('\n');
let NOW=Date.parse('2026-11-16T07:00:00Z');
class FD extends Date{constructor(...a){a.length?super(...a):super(NOW)}static now(){return NOW}}
function load(f){const c={console,Math,Date:FD,JSON,Array,Object,String,Number,Set,Map,Intl};vm.createContext(c);
  vm.runInContext('let P={},LOG=[],QLOG=[],QA=[],BUY=[],R={bank:0,ach:[],lv:1,ts:0},LG={tier:0,w:"",hist:[],ts:0},EN={v:30,t:0},STN=[],STV=0,GIFTS=[],CW=0;'+fs.readFileSync(f,'utf8')+'\n'+PK+`
  this.X={applyEv,stPerfectAt,tableFor,dkey,CFG,QUESTS,pzMonth,lgPush:typeof lgPush==='function'?lgPush:null,
   get R(){return R},get LG(){return LG},set LG(v){LG=v},earned(){EC=null;return econ().earned},
   save(){return {core:JSON.stringify({P,QLOG,BUY,R,LG,EN,STN,STV}),log:JSON.stringify(packLog(LOG)),qa:JSON.stringify(packQA(QA))}},
   load(s){const c=JSON.parse(s.core);P=c.P||{};QLOG=c.QLOG||[];BUY=c.BUY||[];R=Object.assign({bank:0,ach:[],lv:1,ts:0},c.R||{});LG=Object.assign({tier:null,w:"",hist:[],ts:0},c.LG||{});EN=c.EN||{v:30,t:0};STN=c.STN||[];STV=c.STV||0;LOG=unpackLog(JSON.parse(s.log));QA=unpackQA(JSON.parse(s.qa));EC=null}};`,c);return c.X}
const OLD=load(process.argv[3]),NEW=load(process.argv[4]),CLI=load(process.argv[4]),OCLI=load(process.argv[3]);
const out=[],T=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?' → '+x:''));
let rnd=(()=>{let s=777;return()=>(s=(s*1103515245+12345)%2147483648)/2147483648})();
// ===== أ) الدوري: جدول التطبيق = جدول الخادم، والمتعلّمون لا يتغيّرون =====
{let rankDiff=0,rankBig=0,same=0,humansSame=0,minBot=1e9,tieOk=0,ties=0,worse=0,oldDiff=0,N=3000;
 for(let k=0;k<N;k++){const n=1+Math.floor(rnd()*6),docs=[...Array(n)].map((_,i)=>({id:'u'+k+'_'+i,xp:rnd()<.3?[5,10,15,12][i%4]:Math.floor(rnd()*400),tier:Math.floor(rnd()*4),grp:0,name:'n'+i}));
  const prev=docs.map(d=>({...d,xp:Math.floor(rnd()*300)}));const w='2027-'+String(1+k%52).padStart(2,'0')+'-01';const prog=[0,.3,1][k%3];
  const s=NEW.tableFor(docs[0].id,w,docs,prev,prog),c=CLI.tableFor(docs[0].id,w,docs,prev,prog),o=OLD.tableFor(docs[0].id,w,docs,prev,prog),oc=OCLI.tableFor(docs[0].id,w,docs,prev,prog);
  if(JSON.stringify(s)===JSON.stringify(c))same++;if(JSON.stringify(s)!==JSON.stringify(oc))oldDiff++;{const a=s.findIndex(r=>r.id===docs[0].id),b=oc.findIndex(r=>r.id===docs[0].id);if(a!==b){rankDiff++;if(docs[0].xp>=15)rankBig++}}
  const hx=t=>JSON.stringify(t.filter(r=>!r.bot).map(r=>[r.id,r.xp]).sort());if(hx(s)===hx(o))humansSame++;
  s.filter(r=>r.bot).forEach(r=>minBot=Math.min(minBot,r.xp));
  for(let i=1;i<s.length;i++)if(s[i].xp===s[i-1].xp&&s[i].bot!==s[i-1].bot){ties++;if(!s[i-1].bot)tieOk++}
  for(const h of s.filter(r=>!r.bot&&r.xp>=15)){if(s.indexOf(h)>o.findIndex(r=>r.id===h.id))worse++}}
 T('الدوري: جدول التطبيق الجديد = جدول الخادم الجديد',same===N,same+' من '+N);
 T('الدوري: خبرة المتعلّمين الحقيقيين لم تتغيّر',humansSame===N,humansSame+' من '+N);
 T('الدوري: أقل منافس آلي',minBot>=5,minBot);
 T('الدوري: عند التساوي يتقدّم المتعلّم',tieOk===ties,ties+' حالة تساوٍ');
 T('الدوري: من جمع 15 فأكثر لم يتأخر مركزه',worse===0,worse);
 T('الدوري (خطر): تطبيق قديم يعرض جدولًا مختلفًا عن الخادم الجديد',true,oldDiff+' من '+N+' مجموعة (أرقام المنافسين الآليين)');T('الدوري (خطر): تطبيق قديم يعرض مركزًا مختلفًا للمتعلّم',true,rankDiff+' من '+N+'، منها لمن خبرته 15 فأكثر: '+rankBig)}
// ===== ب) ثلاث سنوات: المهمة والجواهر والألبوم والتكرار، بطلبات منفصلة وإعادة تحميل =====
NEW.QUESTS.find(q=>q.id==='rv15').f=()=>99;
const req=(evs,ctx={})=>{NEW.load(S);const r=evs.map(e=>{NOW=e.t;return NEW.applyEv(e,e.t,{server:true,words:null,...ctx})});S=NEW.save();return r};
let S=(()=>{NEW.load({core:JSON.stringify({EN:{v:30,t:0,u:Date.parse('2040-01-01')},R:{},STN:[]}),log:'null',qa:'null'});return NEW.save()})();
const led={qd:0,dw:0,lg:0},pieces={};let wid=0,did=0,lastE=0,dec=0,perfOk=0,perfBad=0,dupBad=0,days=0;
for(let day=0;day<3*365+5;day++){
  let t=Date.parse('2026-11-16T07:00:00Z')+day*864e5+Math.floor(rnd()*999);const nS=1+Math.floor(rnd()*3);let perfect=0;
  for(let i=0;i<nS;i++){const ws=[0,1,2,3,4].map(()=>'w'+(wid++)),miss=rnd()<.4?[ws[2]]:[];t+=Math.floor(rnd()*300e3)+5e3;
    req([{type:'stStart',t}]);t+=12e3+Math.floor(rnd()*999);req([{type:'stDone',t,words:ws,miss}]);
    const skip=i===nS-1&&rnd()<.25;if(!skip){t+=30e3;req([{type:'quiz',kind:'drill',ok:4,total:5,ms:9000,t}])}if(!miss.length&&!skip)perfect++}
  const d=NEW.dkey(t);
  t+=60e3;const [rp]=req([{type:'quest',id:'perf',t}]);
  if(perfect){if(rp===true){perfOk++;NEW.load(S);const g=NEW.R.qd.at(-1)[2];led.qd+=g;const p=NEW.R.pz.at(-1)[1];if(p>=0)(pieces[d.slice(0,7)]=pieces[d.slice(0,7)]||new Set).add(p)}else perfBad++}else if(rp===true)perfBad++;
  t+=5e3;const [rd]=req([{type:'quest',id:'perf',t}]);if(perfect&&rd!=='dup'){dupBad++;if(dupBad<4)console.log('DUP perf',d,rd)}
  t+=5e3;const [rq]=req([{type:'quest',id:'rv15',t}]);if(rq===true){NEW.load(S);led.qd+=NEW.R.qd.at(-1)[2]}
  for(let j=0;j<2;j++){t+=5e3;const [r]=req([{type:'dwin',id:'duel'+(did++),t}],{dwinOk:true});if(r===true)led.dw+=NEW.CFG.duel.gem;else if(!globalThis.dwr){globalThis.dwr=1;console.log('DWIN',d,r)}}
  t+=5e3;const [r2]=req([{type:'dwin',id:'duel'+(did-1),t}],{dwinOk:true});if(r2!=='dup'){dupBad++;if(dupBad<4)console.log('DUP dwin',d,r2)}
  if(rnd()<.5){t+=5e3;req([{type:'duel',t}],{duelOk:true})}
  if(new FD(t).getUTCDay()===1){NEW.load(S);const g=Math.floor(rnd()*50);NEW.lgPush({w:d,tier:1,rank:3,n:15,mv:0,g,xp:120});led.lg+=g;S=NEW.save()}
  NEW.load(JSON.parse(JSON.stringify(S)));const e=NEW.earned();if(e<lastE)dec++;lastE=e;days++}
NEW.load(S);const R_=NEW.R,L_=NEW.LG,sum=(a,i)=>(a||[]).reduce((s,x)=>s+(+x[i]||0),0);
T('ثلاث سنوات',true,days+' يومًا · سجلّات: صناديق '+R_.qd.length+'، فوز '+R_.dw.length+'، أيام تحدٍّ '+R_.dd.length+'، دوري '+L_.hist.length);
T('مهمة البازل تُقبل في كل يوم مستحقّ فقط، بطلب منفصل بعد الحفظ',perfBad===0,perfOk+' يومًا');
T('منع التكرار (الصندوق وفوز التحدي)',dupBad===0);
T('جواهر الصناديق: المطويّ + الباقي = كل ما مُنح',(+R_.qdg||0)+sum(R_.qd,2)===led.qd,led.qd);
T('جواهر تحدّي الأصدقاء: المطويّ + الباقي = كل ما مُنح',(+R_.dwg||0)+sum(R_.dw,1)===led.dw,led.dw);
T('جوائز الدوري: المطويّ + الباقي = كل ما مُنح',(+L_.hg||0)+L_.hist.reduce((s,h)=>s+(h.g||0),0)===led.lg,led.lg);
T('الرصيد المكتسب لا ينقص يومًا بعد إعادة التحميل',dec===0,dec+' يومًا');
let albBad=0;for(const m in pieces){const h=NEW.pzMonth(m).have;if(h.size!==pieces[m].size||[...pieces[m]].some(i=>!h.has(i)))albBad++}
T('الألبوم: قطع كل شهر محفوظة',albBad===0,Object.keys(pieces).length+' شهرًا');
// ===== ج) الحسابات الحالية والتطبيقات القديمة =====
const CUR={core:JSON.stringify({R:{bank:12,ach:[],lv:3,ts:0,qd:[["2026-11-10","rv15",3],["2026-11-12","perf",0]],dw:[["abcd1",10]],dd:["2026-11-08"],pz:[["2026-11-03",0],["2026-11-12",4]]},
  LG:{tier:1,w:"2026-11-16",hist:[{w:"2026-11-02",g:20,tier:0,mv:1}],ts:0},STN:[[Date.parse('2026-11-12T10:00:00.420Z'),5,1]],QLOG:[[Date.parse('2026-11-12T10:01:00Z'),5,5,'drill',9000]],EN:{v:30,t:0}}),
  log:JSON.stringify({K:['a','b','c','d','e'],F:[Math.round(Date.parse('2026-11-12T10:00:00.420Z')/1000),0,2,1,0,1,2,1,0,2,2,1,0,3,2,1,0,4,2,1]}),qa:'null'};
OLD.load(CUR);NEW.load(CUR);
T('حساب حالي: الرصيد نفسه قبل أي حدث',OLD.earned()===NEW.earned(),NEW.earned());
T('حساب حالي: الألبوم نفسه',[...OLD.pzMonth('2026-11').have].sort()+''===[...NEW.pzMonth('2026-11').have].sort()+'');
T('حساب حالي: مهمة البازل ليوم محفوظ (القديم 0، الجديد 1)',NEW.stPerfectAt('2026-11-12')===1,'قديم '+OLD.stPerfectAt('2026-11-12')+' · جديد '+NEW.stPerfectAt('2026-11-12'));
OCLI.load(S);NEW.load(S);
T('تطبيق قديم مع حالة الخادم الجديد (خطر): الرصيد الظاهر',true,'قديم '+OCLI.earned()+' · خادم '+NEW.earned());
console.log(out.join('\n'));
