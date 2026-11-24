const fs=require('fs');const src=fs.readFileSync(require('path').join(__dirname,'../../index.html'),'utf8');
const a=src.indexOf('let STFAIL=0'),b=src.indexOf('const key=w=>w.de.trim().toLowerCase();');const code=src.slice(a,b);
const stLine=src.match(/function st\(k,v\)\{[^\n]*?\}\}/)[0];
function mkLS(Q){const m=new Map();const used=()=>{let n=0;for(const[k,v]of m)n+=k.length+v.length;return n};
 return {get length(){return m.size},key:i=>[...m.keys()][i],getItem:k=>m.has(k)?m.get(k):null,removeItem:k=>m.delete(k),
  setItem(k,v){v=String(v);const old=m.get(k);if(used()-(old!=null?k.length+old.length:0)+k.length+v.length>Q)throw Object.assign(new Error('Quota'),{name:'QuotaExceededError'});m.set(k,v)},used,m}}
function run(Q,pre,evN,logN){const localStorage=mkLS(Q);for(const[k,v]of pre)localStorage.setItem(k,v);
 const calls={toast:0,rep:0,sync:0};let order=[];
 const env={localStorage,UID:'U',COURSE:'k3',COURSES:{k3:{file:'words-k3.json'}},K:x=>'muf_U_'+x,toast:()=>calls.toast++,repErr:()=>calls.rep++,schedSync:()=>calls.sync++,
  EVQ:Array.from({length:evN},(_,i)=>({type:'rate',k:'w'+i,r:2,t:1e12+i})),P:{},EN:{},STN:[],STV:0,R:{},S:{},CK:null,QLOG:[],BUY:[],E:{},LG:{},LOG:Array.from({length:logN},(_,i)=>[1e12+i,'die erdbeere',2,0]),QA:[]};
 const f=new Function(...Object.keys(env),stLine+';'+code.replace(/\blet STFAIL=0,STWARN=false,LSZ=-1;/,'var STFAIL=0,STWARN=false,LSZ=-1;')+';save();save();return {STFAIL,STWARN}');
 const r=f(...Object.values(env));const evq=JSON.parse(localStorage.getItem('muf_U_evq')||'[]').length;
 return {evqInMemory:evN,evqPersisted:evq,logPersisted:JSON.parse(localStorage.getItem('muf_U_log')||'[]').length,courseCurKept:localStorage.m.has('muf_w_words-k3.json'),otherCourseKept:localStorage.m.has('muf_w_words-a1.json'),...r,calls}}
const big=n=>'x'.repeat(n);const out=[];const T=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?' → '+x:''));
let r=run(5e6,[],20,30000);T('عادي: كل الأحداث المنتظرة والسجل محفوظة',r.evqPersisted===20&&r.logPersisted===30000&&!r.STFAIL,r.evqPersisted);
r=run(1.6e6+100,[['muf_w_words-k3.json',big(180000)],['muf_w_words-a1.json',big(170000)],['muf_shell',big(50000)],['muf_U_log',big(1.2e6)]],20,28000);
T('شبه ممتلئ: الأحداث محفوظة بعد تفريغ نسخ المناهج الأخرى والواجهة',r.evqPersisted===20&&!r.STFAIL&&r.courseCurKept&&!r.otherCourseKept,JSON.stringify({e:r.evqPersisted,cur:r.courseCurKept,oth:r.otherCourseKept}));
r=run(1.25e6+100,[['muf_w_words-k3.json',big(180000)],['muf_U_log',big(1.07e6)]],20,25000);
T('ممتلئ بلا نسخ مناهج أخرى: الأحداث محفوظة بعد تفريغ نسخة السجل المحلية',r.evqPersisted===20&&!r.STFAIL&&r.courseCurKept,r.evqPersisted);
r=run(2000,[],200,10);
T('مستحيل: تنبيه واحد، وتقرير واحد، ومزامنة فورية',r.STFAIL===2&&r.STWARN&&r.calls.toast===1&&r.calls.rep===1&&r.calls.sync===2,JSON.stringify(r.calls));
// الترتيب: الأحداث المنتظرة تُكتب قبل أي مفتاح آخر
{const localStorage=mkLS(5e6);const order=[];const _s=localStorage.setItem.bind(localStorage);localStorage.setItem=(k,v)=>{order.push(k);_s(k,v)};
 const env={localStorage,UID:'U',COURSE:'k3',COURSES:{k3:{file:'words-k3.json'}},K:x=>'muf_U_'+x,toast:()=>{},repErr:()=>{},schedSync:()=>{},EVQ:[{type:'rate'}],P:{},EN:{},STN:[],STV:0,R:{},S:{},CK:null,QLOG:[],BUY:[],E:{},LG:{},LOG:[],QA:[]};
 new Function(...Object.keys(env),stLine+';'+code.replace(/\blet STFAIL=0,STWARN=false,LSZ=-1;/,'var STFAIL=0,STWARN=false,LSZ=-1;')+';save()')(...Object.values(env));
 T('الترتيب: الأحداث المنتظرة أول ما يُكتب',order[0]==='muf_U_evq',order.slice(0,3).join(','));
 const keys=['reset','progress','settings','log','ck','qlog','qa','buy','equip','league','energy','stations','stv','evq'];T('كل مفاتيح الحفظ السابقة ما زالت تُكتب',keys.every(k=>order.includes('muf_U_'+k)),keys.filter(k=>!order.includes('muf_U_'+k)).join(',')||'كلها');}
console.log(out.join('\n'));if(out.some(l=>l.startsWith('FAIL')))process.exit(1);
