// إصلاح مهمة «بلا أي خطأ مع تدريبها»: OLD = core.js من main، NEW = هذا الفرع. الخادم يُحاكى بحفظ السجلّ بالثواني كما في worker.src.js
const vm=require('vm'),fs=require('fs'),path=require('path');
const W=fs.readFileSync(path.join(process.argv[2],'server/worker.src.js'),'utf8').split('\n'),PK=W.slice(20,24).join('\n');
let NOW=Date.parse('2026-11-16T07:00:00Z');
class FD extends Date{constructor(...a){a.length?super(...a):super(NOW)}static now(){return NOW}}
function load(f){const c={console,Math,Date:FD,JSON,Array,Object,String,Number,Set,Map,Intl};vm.createContext(c);
  vm.runInContext('let P={},LOG=[],QLOG=[],QA=[],BUY=[],R={bank:0,ach:[],lv:1,ts:0},LG={tier:0,w:"",hist:[],ts:0},EN={v:30,t:0},STN=[],STV=0,GIFTS=[],CW=0;'+fs.readFileSync(f,'utf8')+'\n'+PK+`
  this.X={applyEv,stPerfectAt,dkey,questList:null,get LOG(){return LOG},get R(){return R},get STN(){return STN},
   save(){return {core:JSON.stringify({P,QLOG,BUY,R,LG,EN,STN,STV}),log:JSON.stringify(packLog(LOG)),qa:JSON.stringify(packQA(QA))}},
   load(s){const c=JSON.parse(s.core);P=c.P||{};QLOG=c.QLOG||[];BUY=c.BUY||[];R=Object.assign({bank:0,ach:[],lv:1,ts:0},c.R||{});LG=c.LG||LG;EN=c.EN||EN;STN=c.STN||[];STV=c.STV||0;LOG=unpackLog(JSON.parse(s.log));QA=unpackQA(JSON.parse(s.qa));EC=null},
   loadExact(c){P=c.P;QLOG=c.QLOG;R=c.R;STN=c.STN;STV=c.STV;LOG=c.LOG;EN=c.EN;EC=null},exact(){return JSON.parse(JSON.stringify({P,QLOG,R,STN,STV,LOG,EN}))}};`,c);return c.X}
const O=load(process.argv[3]),N=load(process.argv[4]);
const out=[],T=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?' → '+x:''));
// طلب إلى «الخادم»: يقرأ الحالة المحفوظة (السجلّ بالثواني)، ويطبّق الأحداث، ثم يحفظ
const req=(X,store,evs)=>{X.load(store);const r=evs.map(e=>{NOW=e.t;return X.applyEv(e,e.t,{server:true,words:null})});return [X.save(),r]};
let rnd=(()=>{let s=4242;return()=>(s=(s*1103515245+12345)%2147483648)/2147483648})();
const init=()=>{const X=N;X.load({core:JSON.stringify({EN:{v:30,t:0,u:Date.parse('2040-01-01')},STN:[],R:{}}),log:'null',qa:'null'});return X.save()};
let sO=init(),sN=init(),wid=0,days=0,stTot=0;
const st={eqPre:0,eqTruth:0,oldLost:0,claimNew:0,claimOld:0,rejNewBad:0,dupNew:0,dupBad:0,pzOnce:0,pzBad:0,stay:0,stayBad:0,recover:0,recoverBad:0};
for(let day=0;day<400;day++){
  const base=Date.parse('2026-11-16T07:00:00Z')+day*864e5+Math.floor(rnd()*999);let t=base;const nS=1+Math.floor(rnd()*4),truth=[];
  for(let i=0;i<nS;i++){
    const ws=[0,1,2,3,4].map(()=>'w'+(wid++)),miss=rnd()<.4?[ws[Math.floor(rnd()*5)]]:[];
    t+=Math.floor(rnd()*600e3);const t0=t;let evs=[{type:'stStart',t:t0}];
    t+=10e3+Math.floor(rnd()*110e3)+Math.floor(rnd()*999);evs.push({type:'stDone',t,words:ws,miss});
    // مراجعة منفصلة في اللحظة نفسها تقريبًا (أسوأ حالة): ليست كلمات جديدة
    const lastDrill=i===nS-1&&rnd()<.3;
    [sO]=req(O,sO,evs);[sN]=req(N,sN,evs);
    for(const [X,k] of [[O,'O'],[N,'N']]){const s=k==='O'?sO:sN;X.load(s);X.LOG.push([t+300,'w0',0,0],[t-400,'w1',2,0],[t+900,'w2',3,2]);const sv=X.save();if(k==='O')sO=sv;else sN=sv}
    if(!lastDrill){t+=20e3;const d=[{type:'quiz',kind:'drill',ok:3,total:5,ms:15000,t}];[sO]=req(O,sO,d);[sN]=req(N,sN,d)}
    truth.push(!miss.length&&!lastDrill);stTot++;
  }
  const d=N.dkey(base),exp=truth.filter(Boolean).length;
  // قبل الحفظ (في الذاكرة بدقّة كاملة): القديمة والجديدة متطابقتان
  // نعيد بناء الحالة الدقيقة من الأحداث مباشرة في سياقين منفصلين
  N.load(sN);const nAfter=N.stPerfectAt(d);O.load(sO);const oAfter=O.stPerfectAt(d);
  if(nAfter===exp)st.eqTruth++;if(oAfter<exp)st.oldLost++;
  // فتح الصندوق في طلب لاحق
  t+=60e3;const q=[{type:'quest',id:'perf',t}];let rO,rN;[sO,rO]=req(O,sO,q);[sN,rN]=req(N,sN,q);
  if(exp>=1){if(rN[0]===true)st.claimNew++;else st.rejNewBad++;if(rO[0]===true)st.claimOld++}else if(rN[0]===true)st.rejNewBad++;
  // تكرار ثم إعادة تحميل
  t+=30e3;const q2=[{type:'quest',id:'perf',t}];let r2;[sN,r2]=req(N,sN,q2);if(exp>=1){if(r2[0]==='dup')st.dupNew++;else st.dupBad++}
  N.load(sN);const pzToday=N.R.pz?N.R.pz.filter(x=>x[0]===d).length:0;if(exp>=1){if(pzToday===1)st.pzOnce++;else st.pzBad++}
  for(let k=0;k<3;k++){N.load(JSON.parse(JSON.stringify(sN)));if(exp>=1){if(N.stPerfectAt(d)>=1)st.stay++;else st.stayBad++}}
  // استعادة: يوم رفض فيه الخادم القديم الصندوق، ثم نُشر الإصلاح في اليوم نفسه
  if(exp>=1&&rO[0]!==true){N.load(sO);NOW=t+1000;const rr=N.applyEv({type:'quest',id:'perf',t:NOW},NOW,{server:true});if(rr===true)st.recover++;else st.recoverBad++}
  days++;
}
T('الأيام والمحطات',true,days+' يومًا، '+stTot+' محطة، مع مراجعات منفصلة قبل المحطة وبعدها بأقل من ثانية');
T('بعد الحفظ وإعادة التحميل: الجديدة = الحقيقة في كل يوم',st.eqTruth===days,st.eqTruth+' من '+days);
T('القديمة للمقارنة: أيام فقدت فيها المهمة',true,st.oldLost);
T('فتح الصندوق في طلب لاحق: الجديدة تقبل كل مستحقّ ولا تقبل غير مستحقّ',st.rejNewBad===0,'قُبل '+st.claimNew+' (القديمة قبلت '+st.claimOld+')');
T('الضغط مرة ثانية يُرفض',st.dupBad===0,st.dupNew+' مرة');
T('قطعة واحدة فقط في اليوم، محفوظة بعد إعادة التحميل',st.pzBad===0,st.pzOnce+' يومًا');
T('1/1 يبقى 1/1 بعد ثلاث إعادات تحميل',st.stayBad===0,st.stay+' مرة');
T('من رفض الخادم القديم صندوقه يستلمه بعد الإصلاح في اليوم نفسه',st.recoverBad===0,st.recover+' يومًا');
// حالات حدّية
{N.load({core:JSON.stringify({EN:{v:30,t:0,u:Date.parse('2040-01-01')},STN:[],R:{}}),log:'null',qa:'null'});let s=N.save();
 const b=Date.parse('2027-03-01T09:00:00.700Z'),mk=(t,miss)=>[{type:'stStart',t:t-10e3},{type:'stDone',t,words:['a'+t,'b'+t,'c'+t,'d'+t,'e'+t],miss}];
 [s]=req(N,s,mk(b,[]));[s]=req(N,s,[{type:'quiz',kind:'drill',ok:5,total:5,ms:9000,t:b+5e3}]);
 [s]=req(N,s,mk(b+16e3,['a'+(b+16e3)]));[s]=req(N,s,[{type:'quiz',kind:'drill',ok:5,total:5,ms:9000,t:b+21e3}]);
 N.load(s);T('محطتان بينهما 16 ثانية، الأولى بلا خطأ والثانية بخطأ',N.stPerfectAt('2027-03-01')===1,N.stPerfectAt('2027-03-01'));
 const b2=Date.parse('2027-03-02T09:00:00.300Z');[s]=req(N,s,mk(b2,['a'+b2]));[s]=req(N,s,[{type:'quiz',kind:'drill',ok:5,total:5,ms:9000,t:b2+5e3}]);
 [s]=req(N,s,mk(b2+15e3,[]));[s]=req(N,s,[{type:'quiz',kind:'drill',ok:5,total:5,ms:9000,t:b2+20e3}]);
 N.load(s);T('أقرب محطتين ممكنتين (15 ثانية: تدريب ثم 10 ثوانٍ)، الأولى بخطأ والثانية بلا خطأ',N.stPerfectAt('2027-03-02')===1,N.stPerfectAt('2027-03-02'));
 const b3=Date.parse('2027-03-03T22:59:59.700Z');[s]=req(N,s,mk(b3,[]));[s]=req(N,s,[{type:'quiz',kind:'drill',ok:5,total:5,ms:9000,t:b3+6e3}]);
 N.load(s);const d3=N.dkey(b3);O.load(s);T('محطة قبل منتصف الليل وتدريبها بعده: لا تُحسب لأي يوم، كما في القاعدة الحالية',N.stPerfectAt(d3)===0&&N.stPerfectAt(N.dkey(b3+6e3))===0,d3);
 const b4=Date.parse('2027-03-04T09:00:00.500Z');[s]=req(N,s,mk(b4,[]));N.load(s);T('بلا تدريب لا تُحسب',N.stPerfectAt('2027-03-04')===0);
}
// قبل الحفظ (الذاكرة بدقّة كاملة): القديمة والجديدة متطابقتان، فالشرط نفسه لم يتغيّر
{const fresh=X=>X.load({core:JSON.stringify({EN:{v:30,t:0,u:Date.parse('2040-01-01')},STN:[],R:{}}),log:'null',qa:'null'});fresh(O);fresh(N);let same=0,tot=0,id=0;
 for(let day=0;day<300;day++){let t=Date.parse('2027-06-01T07:00:00Z')+day*864e5+Math.floor(rnd()*999);const n=1+Math.floor(rnd()*4);
  for(let i=0;i<n;i++){const ws=[0,1,2,3,4].map(()=>'x'+(id++)),miss=rnd()<.4?[ws[0]]:[];t+=Math.floor(rnd()*300e3)+10e3;
   const td=t+12e3+Math.floor(rnd()*999);for(const X of [O,N]){X.applyEv({type:'stStart'},t,{server:true});X.applyEv({type:'stDone',words:ws,miss},td,{server:true})}
   t+=40e3;if(!(i===n-1&&rnd()<.3))for(const X of [O,N])X.applyEv({type:'quiz',kind:'drill',ok:4,total:5,ms:9000},t,{server:true})}
  const d=N.dkey(t);tot++;if(O.stPerfectAt(d)===N.stPerfectAt(d))same++}
 T('بلا حفظ (دقّة كاملة): القديمة والجديدة متطابقتان، فالشرط لم يتغيّر',same===tot,same+' من '+tot)}
console.log(out.join('\n'));
