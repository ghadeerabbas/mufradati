// الحفظ المحلي: الدوال الحقيقية من index.html (الحفظ، والتحميل عند الفتح، وتطبيق حالة الخادم، وفحص ملفات المناهج)
// مع تخزين وهمي محدود السعة يبقى بين «إغلاق» التطبيق و«فتحه»، وخادم مُحاكى بسيط يجمع الأحداث. لا متصفح ولا شبكة.
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'../..');const src=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const cut=(a,b)=>{const i=src.indexOf(a),j=src.indexOf(b,i);if(i<0||j<0)throw new Error('لم يُعثر على: '+a);return src.slice(i,j)};
const line=re=>{const m=src.match(re);if(!m)throw new Error('لم يُعثر على: '+re);return m[0]};
const CODE=[
 line(/function st\(k,v\)\{[^\n]*?\}\}/),line(/const jget=[^\n]*/),line(/function unpackLog[^\n]*/),line(/function unpackQA[^\n]*/),
 cut('function loadState(){','// الحفظ المحلي:'),cut('let STFAIL=0','const key=w=>w.de.trim().toLowerCase();'),
 cut('function applyServer(j){','// محطة بدأت ولم تنتهِ'),cut('function wordsOk(t){','function applyWords(d){'),
 cut('function ev(e){','// حالة الحساب كما حفظها الخادم')].join('\n');   // ev الحقيقية (برفضها أثناء إنقاذ الحفظ)

// تخزين محدود السعة (بالمحارف، كما في المتصفح): setItem يرمي خطأ الامتلاء ويُبقي القيمة القديمة
function mkLS(Q){const m=new Map();const used=()=>{let n=0;for(const[k,v]of m)n+=k.length+v.length;return n};
 return {Q,get length(){return m.size},key:i=>[...m.keys()][i]??null,getItem:k=>m.has(k)?m.get(k):null,removeItem:k=>{m.delete(k)},
  setItem(k,v){v=String(v);const old=m.get(k);if(used()-(old!=null?k.length+old.length:0)+k.length+v.length>this.Q)throw Object.assign(new Error('Quota'),{name:'QuotaExceededError'});m.set(k,v)},used,m}}

// أحداث مُحاكاة: «rate» يضيف عنصرًا إلى السجل ويغيّر تقدّم الكلمة، و«ans» يضيف عنصرًا إلى سجلّ الإجابات
function applyEvStub(ctx){return function(e){if(e.type==='rate'){ctx.LOG.push([e.t,e.k,e.r,0]);ctx.P[e.k]=(ctx.P[e.k]||0)+1}else if(e.type==='ans')ctx.QA.push([e.t,e.k,1]);return true}}

// جهاز: يُنشأ مع تخزين (يبقى بعد الإغلاق)، ويعطي دوال الصفحة الحقيقية
function device(ls,uid='U',opt={}){
 const calls={toast:0,rep:[],sync:0};let now=opt.now||Date.parse('2026-11-24T10:00:00Z');
 const body=`let UID=${JSON.stringify(uid)},COURSE='k3',COURSES={k3:{file:'words-k3.json'},a1:{file:'words-a1.json'}};const K=n=>"muf_"+UID+"_"+n;
 let P={},LOG=[],QLOG=[],QA=[],BUY=[],S={},E={},R={},LG={},EN={v:30,t:0},STN=[],STV=0,EVQ=[],CK=null,LGC=null,EC=null,PREFLAST="";
 const DEF_S={},DEF_E={};const migrateLG=()=>{},applyLook=()=>{},leagueNews=()=>{},staleStation=()=>{};
 const isAdmin=()=>!!opt.admin;const ctx={get LOG(){return LOG},get QA(){return QA},get P(){return P}};const applyEv=mk(ctx);
 const syncFree=()=>{},markStudied=()=>{},questWatch=()=>{};let SELF;
 // المزامنة المُحاكاة: تنجح فقط إن كان الجهاز متصلًا (opt.online) وله خادم (opt.srv)
 const syncNow=async()=>{await null;if(!(opt.online&&opt.online()&&opt.srv))return false;opt.srv.sync(SELF);return true};
 ${CODE}
 const api={loadState,save,applyServer,wordsOk,lsNow,lsSize,loadWords,ev,
  async settle(){for(let i=0;i<50&&STRESC;i++)await new Promise(r=>setTimeout(r,0))},get STRESC(){return STRESC},get STBLK(){return STBLK},get STSTALE(){return STSTALE},
  get EVQ(){return EVQ},set EVQ(v){EVQ=v},get LOG(){return LOG},get QA(){return QA},get P(){return P},
  get STFAIL(){return STFAIL},get STKF(){return STKF},get STWARN(){return STWARN},get LSZ(){return LSZ}};SELF=api;return api;`;
 const Dt={now:()=>now};
 const fetchStub=opt.fetch||(async()=>({ok:false}));
 const applyWords=d=>{calls.applied=d};
 const f=new Function('localStorage','toast','repErr','schedSync','mk','opt','Date','fetch','DP','applyWords','queue','STS','GM','refresh','econ','renderHeader',body);
 const A=f(ls,()=>calls.toast++,m=>calls.rep.push(m),()=>calls.sync++,applyEvStub,opt,Dt,fetchStub,'',applyWords,[],null,null,()=>{},()=>{},()=>{});
 A.calls=calls;A.tick=ms=>{now+=ms};return A}

// خادم مُحاكى: يحفظ السجل وسجلّ الإجابات والتقدّم، ويعيدها كما يعيدها الخادم الحقيقي بعد كل مزامنة
function server(){const S={log:[],qa:[],P:{}};const ap=applyEvStub({get LOG(){return S.log},get QA(){return S.qa},get P(){return S.P}});
 return {S,sync(A){do{const sent=A.EVQ.slice(0,300);for(const e of sent)ap(e);A.EVQ=A.EVQ.slice(sent.length);   // دفعات من 300 كما في التطبيق
  A.applyServer({core:JSON.stringify({P:S.P}),log:JSON.stringify(S.log),qa:JSON.stringify(S.qa)})}while(A.EVQ.length)}}}

const big=n=>'x'.repeat(n);const out=[];const T=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?' → '+x:''));
const rate=(i,t)=>({type:'rate',k:'w'+i,r:2,t:t||1e12+i});
const stored=(ls,k)=>JSON.parse(ls.getItem('muf_U_'+k)||'null');
// يملأ التخزين حتى يبقى فيه free محرف فقط
const fillTo=(ls,free,k='junk')=>{ls.setItem(k,'');ls.setItem(k,big(Math.max(0,ls.Q-ls.used()-free)))};

(async()=>{
// ١) عادي
{const ls=mkLS(5e6),A=device(ls);A.loadState();for(let i=0;i<20;i++)A.ev(rate(i));
 T('عادي: كل الأحداث المنتظرة والسجل محفوظة، ولا فشل',stored(ls,'evq').length===20&&stored(ls,'log').length===20&&!A.STFAIL&&!A.STKF,stored(ls,'evq').length)}

// ٢) شبه ممتلئ: نسخ المناهج الأخرى والواجهة تُفرَّغ أولًا، ومنهج اليوم يبقى
{const ls=mkLS(400000);ls.setItem('muf_w_words-k3.json',big(100000));ls.setItem('muf_w_words-a1.json',big(100000));ls.setItem('muf_shell',big(50000));
 const A=device(ls);A.loadState();fillTo(ls,600);for(let i=0;i<20;i++)A.ev(rate(i));
 T('شبه ممتلئ: الأحداث محفوظة بعد تفريغ نسخ المناهج الأخرى والواجهة',stored(ls,'evq').length===20&&!A.STFAIL&&ls.m.has('muf_w_words-k3.json')&&!ls.m.has('muf_w_words-a1.json')&&!ls.m.has('muf_shell'),
  JSON.stringify({e:stored(ls,'evq').length,cur:ls.m.has('muf_w_words-k3.json'),oth:ls.m.has('muf_w_words-a1.json')}))}

// ٣) السجل المحلي لا يُحذف إلا بإثبات: (أ) بعد مزامنة → يُحذف ويُحفظ ما ينتظر؛ (ب) لم يزامن هذا الجهاز قط؛ (ج) حساب المشرف؛ (د) وقت مختلف؛ (هـ) محتوى مختلف بالعدد والوقت نفسيهما
async function logCase({sync=true,admin=false,tamper=false,tamperContent=false}){const ls=mkLS(3e6),srv=server(),A=device(ls,'U',{admin});A.loadState();
 for(let i=0;i<3000;i++)A.ev(rate(i,1e12+i*1000));if(sync)srv.sync(A);
 if(tamper){A.LOG[A.LOG.length-1][0]+=1}
 if(tamperContent){A.LOG[1500][2]=0}   // تقييم مختلف في وسط السجلّ: العدد ووقت آخر عنصر كما هما
 const logBefore=ls.getItem('muf_U_log');ls.Q=ls.used()+200;   // الذاكرة تمتلئ تقريبًا
 for(let i=0;i<40;i++){A.ev(rate(5000+i,2e12+i));await A.settle()}
 return {A,ls,srv,logKept:ls.getItem('muf_U_log')!==null,logSame:ls.getItem('muf_U_log')===logBefore,evq:(stored(ls,'evq')||[]).length}}
{const r=await logCase({});T('امتلاء بعد مزامنة: نسخة السجل تُحذف لأنها في الخادم (العدد والوقت والبصمة)، والأحداث الأربعون محفوظة',!r.logKept&&r.evq===40&&!r.A.STFAIL,JSON.stringify({log:r.logKept,evq:r.evq}))}
{const r=await logCase({sync:false});T('امتلاء دون أي مزامنة سابقة: السجل لا يُحذف (لا إثبات أنه في الخادم)',r.logKept&&r.A.STFAIL>0,JSON.stringify({log:r.logKept,sf:r.A.STFAIL}))}
{const r=await logCase({admin:true});T('حساب المشرف (لا يزامن): السجل لا يُحذف',r.logKept,String(r.logKept))}
{const r=await logCase({tamper:true});T('السجل لا يطابق علامة الخادم (وقت): لا يُحذف',r.logKept,String(r.logKept))}
{const r=await logCase({tamperContent:true});T('محتوى مختلف بالعدد ووقت آخر عنصر نفسيهما: البصمة تمنع الحذف',r.logKept,String(r.logKept))}

// ٤) امتلاء ← إغلاق ← فتح دون إنترنت ← مزامنة: لا يضيع شيء
{const r=await logCase({}),ls=r.ls,srv=r.srv;
 const B=device(ls);B.loadState();
 const off={evq:B.EVQ.length,P:Object.keys(B.P).length,log:B.LOG.length};
 T('بعد الإغلاق والفتح دون إنترنت: الأحداث المنتظرة الأربعون موجودة، والتقدّم المحفوظ موجود',off.evq===40&&off.P===3040,JSON.stringify(off));
 out.push('INFO دون إنترنت بعد الفتح: السجل المعروض '+off.log+' عنصرًا (حُذفت نسخته المحلية)، ويعود كاملًا مع المزامنة');
 ls.Q=5e6;srv.sync(B);
 const keys=new Set(srv.S.log.map(x=>x[1]));
 T('بعد المزامنة: كل الأحداث في الخادم (3040)، والسجل المحلي عاد كاملًا، ولا أحداث معلّقة',srv.S.log.length===3040&&keys.has('w5039')&&B.LOG.length===3040&&!B.EVQ.length,JSON.stringify({srv:srv.S.log.length,local:B.LOG.length,q:B.EVQ.length}));
 const C=device(ls);C.loadState();T('فتح ثالث بعد المزامنة: السجل والأحداث محفوظة على الجهاز',C.LOG.length===3040&&C.EVQ.length===0,C.LOG.length)}

// ٥) البند 1 من المراجعة: فشل حفظ الأحداث دون إنترنت ← لا عدم تطابق، وما لم يُحفظ يُعاد إلى المحفوظ ويُبلَّغ
{const ls=mkLS(3e6),srv=server(),A=device(ls,'U',{srv,online:()=>false});A.loadState();for(let i=0;i<30;i++)A.ev(rate(i));
 const old=ls.getItem('muf_U_evq'),oldP=ls.getItem('muf_U_progress'),oldL=ls.getItem('muf_U_log');fillTo(ls,5);
 const r1=A.ev(rate(30));
 T('العمل الذي لم يُحفظ: لا تُكتب أي حالة (التقدّم والسجلّ كما كانا في التخزين)',r1===true&&ls.getItem('muf_U_progress')===oldP&&ls.getItem('muf_U_log')===oldL&&ls.getItem('muf_U_evq')===old,[r1,ls.getItem('muf_U_progress')===oldP]);
 const r2=A.ev(rate(31));T('أثناء الإنقاذ: لا يُقبل عمل جديد («full»)',r2==='full',r2);
 // «إغلاق فوري» قبل اكتمال الإنقاذ: فتح جديد من التخزين
 const B=device(ls);B.loadState();T('إغلاق فوري بعد الفشل: المحفوظ متطابق (30 حدثًا، والتقدّم بلا الكلمتين الجديدتين)',B.EVQ.length===30&&!B.P.w30&&!B.P.w31&&!B.STSTALE,[B.EVQ.length,!!B.P.w30,B.STSTALE]);
 await A.settle();
 T('بعد فشل الإنقاذ (لا اتصال): الذاكرة عادت إلى المحفوظ، وأُبلغ المتعلّم والمشرف',A.EVQ.length===30&&!A.P.w30&&A.calls.toast>=1&&A.calls.rep.some(m=>/evq not saved/.test(m)),[A.EVQ.length,!!A.P.w30,A.calls.toast]);
 T('عدّاد الفشل لم يُفقد بإعادة القراءة',A.STFAIL===1,A.STFAIL);
 ls.removeItem('junk');const r3=A.ev(rate(32));T('بعد تحرير مساحة: العمل يُقبل ويُحفظ',r3===true&&stored(ls,'evq').length===31,[r3,stored(ls,'evq').length])}

// ٥ب) فشل حفظ الأحداث مع اتصال: الإنقاذ يحفظ العمل في الخادم، فلا يضيع شيء
{const ls=mkLS(3e6),srv=server(),A=device(ls,'U',{srv,online:()=>true});A.loadState();for(let i=0;i<30;i++)A.ev(rate(i));srv.sync(A);fillTo(ls,5);
 for(let i=30;i<45;i++){A.ev(rate(i));await A.settle()}
 {const pend=(stored(ls,'evq')||[]).filter(e=>!srv.S.log.some(x=>x[1]===e.k));T('مع اتصال: الأعمال الخمسة عشر كلها محفوظة، في الخادم أو في الأحداث المنتظرة على الجهاز (45)',srv.S.log.length+pend.length===45,[srv.S.log.length,pend.length])}
 const B=device(ls);B.loadState();T('والمحفوظ على الجهاز متطابق بعد الفتح',B.EVQ.every(e=>!srv.S.log.some(x=>x[1]===e.k&&x[0]===e.t))||B.EVQ.length===0,B.EVQ.length)}

// ٦) فشل مفتاح غير الأحداث المنتظرة: يُعدّ ويُبلَّغ، والأحداث محفوظة، والحالة تُعلَّم متأخّرة فتُصحَّح بأول مزامنة
{const ls=mkLS(2e6),A=device(ls);A.loadState();for(let i=0;i<5;i++)A.ev(rate(i));
 const prog=ls.getItem('muf_U_progress');fillTo(ls,600);
 A.P.huge=big(5000);A.ev(rate(6));
 T('التقدّم لم يُحفظ: فشل منفصل، والأحداث المنتظرة محفوظة، والقيمة السابقة باقية',A.STKF===1&&!A.STFAIL&&stored(ls,'evq').length===6&&ls.getItem('muf_U_progress')===prog,JSON.stringify({sk:A.STKF,sf:A.STFAIL,e:stored(ls,'evq').length}));
 T('تقرير واحد يسمّي المفتاح، ومزامنة فورية',A.calls.rep.length===1&&/progress/.test(A.calls.rep[0])&&A.calls.sync>=1,A.calls.rep.join('|'));
 const B=device(ls);B.loadState();T('عند الفتح: الحالة مُعلَّمة متأخّرة عن الأحداث المحفوظة (تُصحَّح بالمزامنة)',B.STSTALE===true,B.STSTALE);
 ls.removeItem('junk');delete A.P.huge;A.ev(rate(7));const C=device(ls);C.loadState();T('بعد حفظ كامل ناجح: لا تأخّر',C.STSTALE===false,C.STSTALE)}

// ٧) الترتيب ومفاتيح الحفظ
{const ls=mkLS(5e6);const order=[];const _s=ls.setItem.bind(ls);ls.setItem=(k,v)=>{order.push(k);_s(k,v)};const A=device(ls);A.loadState();A.ev(rate(1));
 T('الترتيب: الأحداث المنتظرة أول ما يُكتب',order[0]==='muf_U_evq',order.slice(0,3).join(','));
 const keys=['reset','progress','settings','log','ck','qlog','qa','buy','equip','league','energy','stations','stv','evq'];
 T('كل مفاتيح الحفظ السابقة ما زالت تُكتب',keys.every(k=>order.includes('muf_U_'+k)),keys.filter(k=>!order.includes('muf_U_'+k)).join(',')||'كلها')}

// ٨) دقة العدّادات: STFAIL يساوي عدد مرات الحفظ الفاشلة بالضبط، ويبقى بعد إعادة الفتح، ولا ينتقل إلى حساب آخر
{const ls=mkLS(1e6),A=device(ls);A.loadState();A.ev(rate(0));fillTo(ls,30);for(let i=1;i<=7;i++){A.ev(rate(i));await A.settle()}
 T('سبع محاولات فاشلة = 7 بالضبط (كل واحدة أُعيدت إلى المحفوظ)',A.STFAIL===7,A.STFAIL);
 ls.removeItem('junk');A.ev(rate(8));   // تحرّرت مساحة: نجح الحفظ، والعداد لا يزيد
 T('حفظ ناجح بعدها لا يغيّر العداد',A.STFAIL===7,A.STFAIL);
 fillTo(ls,30);A.ev(rate(9));await A.settle();const B=device(ls);B.loadState();
 T('بعد إعادة الفتح: العداد محفوظ على الجهاز (آخر قيمة أمكن كتابتها)',B.STFAIL>=7&&B.STFAIL<=8,B.STFAIL);
 const X=device(ls,'V');X.loadState();T('حساب آخر على الجهاز نفسه يبدأ عداده من الصفر',X.STFAIL===0&&X.STKF===0,X.STFAIL)}

// ٩) دقة حجم التخزين: يطابق العدّ الفعلي مقرّبًا إلى 10 آلاف، ويُعاد قياسه بعد ساعة فقط
{const ls=mkLS(5e6),A=device(ls);A.loadState();ls.setItem('a',big(1234567));const real=ls.used(),v=A.lsNow();
 T('الحجم يطابق العدّ الفعلي (مقرّبًا إلى 10 آلاف محرف)',Math.abs(v-real)<=5000&&v%10000===0,v+' / '+real);
 ls.setItem('b',big(500000));const v2=A.lsNow();A.tick(36e5+1);const v3=A.lsNow();
 T('لا يُعاد القياس قبل ساعة، ويُعاد بعدها',v2===v&&Math.abs(v3-ls.used())<=5000,[v,v2,v3].join(' → '))}

// ١٠) ملفات المناهج: البنية لا JSON وحده
{const A=device(mkLS(5e6));A.loadState();
 const files=fs.readdirSync(ROOT).filter(f=>/^words.*\.json$/.test(f));const okAll=files.filter(f=>A.wordsOk(fs.readFileSync(path.join(ROOT,f),'utf8')));
 T('كل ملفات المناهج الحالية في المستودع مقبولة',okAll.length===files.length&&files.length>0,okAll.length+'/'+files.length);
 const bad={'مقطوع':'{"days":[],"words":[{"de":"a","ar":"b"}','ليس كائنًا':'[1,2]','بلا قائمة كلمات':'{"days":[]}','الكلمات ليست قائمة':'{"words":{}}',
  'كلمة بلا معنى عربي':'{"words":[{"de":"Haus"}]}','كلمة بنص ألماني فارغ':'{"words":[{"de":"  ","ar":"بيت"}]}','الأيام ليست قائمة':'{"days":{},"words":[]}','عنصر ليس كائنًا':'{"words":[null]}','صفحة خطأ HTML':'<html>404</html>'};
 const acc=Object.entries(bad).filter(([n,t])=>A.wordsOk(t)).map(([n])=>n);
 T('الملفات التالفة أو بغير البنية المتوقعة مرفوضة (9 حالات)',!acc.length,acc.join('، ')||'كلها مرفوضة')}
// تحميل المنهج: نسخة محفوظة تالفة تُحذف ويُستعمل ملف الشبكة، وملف شبكة بغير البنية لا يُحفظ
 {const ls=mkLS(5e6);ls.setItem('muf_w_words-k3.json','{"words":{}}');const good='{"days":[],"words":[{"de":"Haus","ar":"بيت"}]}';
  const A=device(ls,'U',{fetch:async()=>({ok:true,text:async()=>good})});A.loadState();await A.loadWords('k3');
  T('نسخة محفوظة بغير البنية: تُستبدل بملف الشبكة السليم',ls.getItem('muf_w_words-k3.json')===good&&A.calls.applied.words.length===1,ls.getItem('muf_w_words-k3.json'))}
 {const ls=mkLS(5e6);const A=device(ls,'U',{fetch:async()=>({ok:true,text:async()=>'{"words":[{"de":"Haus"}]}'})});A.loadState();await A.loadWords('k3');
  T('ملف شبكة بغير البنية: لا يُحفظ، ويُعرض منهج فارغ بدل كلمات ناقصة',ls.getItem('muf_w_words-k3.json')===null&&A.calls.applied.words.length===0,String(ls.getItem('muf_w_words-k3.json')))}
 // الإغلاق المفاجئ أثناء الحفظ: يتوقّف كل شيء عند الكتابة رقم k (كل كتابة بعدها لا تصل التخزين)، لكل k من أول كتابة إلى آخرها،
 // ثم فتح من جديد: المحفوظ إما متّسق (بعلامة sok) وإما معلَّم بأنه قد يتأخّر (STSTALE)، ثم مزامنة: النتيجة صحيحة دون فقد ولا تكرار
 {const setup=()=>{const ls=mkLS(5e6),srv=server(),A=device(ls,'U',{srv,online:()=>false});A.loadState();for(let i=0;i<3;i++)A.ev(rate(i));srv.sync(A);A.ev(rate(3));A.ev(rate(4));return {ls,srv,A}};
  const freeze=(ls,k)=>{let n=0;const si=ls.setItem.bind(ls),ri=ls.removeItem;ls.setItem=function(a,b){if(++n>=k)throw new Error('CRASH');return si(a,b)};ls.removeItem=a=>{if(++n>=k)return;ri(a)};return ()=>n};
  let W;{const {ls,A}=setup();const cnt=freeze(ls,1e9);A.ev(rate(5));W=cnt()}
  const bad=[];let withSok=0,stale=0,keptNew=0;
  for(let k=1;k<=W+1;k++){const {ls,srv,A}=setup();freeze(ls,k);try{A.ev(rate(5))}catch(e){}
   const ls2=mkLS(5e6);for(const [x,v] of ls.m)ls2.m.set(x,v);   // «فتح» التطبيق من جديد على ما وصل التخزين
   const B=device(ls2,'U',{srv,online:()=>true});B.loadState();const q=B.EVQ.map(e=>e.k),sok=!B.STSTALE;
   const exp={...srv.S.P};for(const x of q)exp[x]=(exp[x]||0)+1;const sp=stored(ls2,'progress')||{},sl=(stored(ls2,'log')||[]).length;
   const cons=JSON.stringify(Object.entries(sp).sort())===JSON.stringify(Object.entries(exp).sort())&&sl===srv.S.log.length+q.length;
   if(sok){withSok++;if(!cons)bad.push(k+': غير معلَّم مع عدم تطابق')}else stale++;
   if(q.includes('w5'))keptNew++;
   srv.sync(B);const ks=srv.S.log.map(x=>x[1]),dup=ks.length!==new Set(ks).size;
   const lost=['w0','w1','w2','w3','w4'].filter(x=>!ks.includes(x));
   if(dup||lost.length)bad.push(k+': بعد المزامنة '+(dup?'تكرار ':'')+(lost.length?'فقد '+lost:''));
   if(JSON.stringify(B.P)!==JSON.stringify(srv.S.P)||B.LOG.length!==srv.S.log.length)bad.push(k+': الحالة بعد المزامنة لا تطابق الخادم');
   if(ls2.getItem('muf_U_sok')===null)bad.push(k+': لم تُكتب sok بعد المزامنة')}
  T('إغلاق مفاجئ عند كل كتابة أثناء الحفظ ('+W+' كتابة): المحفوظ متّسق أو معلَّم، والمزامنة تصحّحه دون فقد ولا تكرار',!bad.length,bad.slice(0,3).join(' | ')||JSON.stringify({cases:W+1,withSok,stale,keptNew}));
  T('الحدث الجديد يبقى إن وصل الإغلاقُ بعد حفظ قائمة الأحداث',keptNew===W,keptNew+'/'+W)}
 // فشل بعض مفاتيح الحالة (لا إغلاق) بعد حفظ الأحداث، ثم فتح، ثم مزامنة
 for(const keys of [['log'],['progress','qa'],['energy','league','log']]){const ls=mkLS(5e6),srv=server(),A=device(ls,'U',{srv,online:()=>false});A.loadState();for(let i=0;i<3;i++)A.ev(rate(i));srv.sync(A);
  const si=ls.setItem.bind(ls);ls.setItem=function(a,b){if(keys.some(x=>a==='muf_U_'+x))throw Object.assign(new Error('Quota'),{name:'QuotaExceededError'});return si(a,b)};
  A.ev(rate(3));A.ev({type:'ans',k:'w3',t:2e12});ls.setItem=si;
  const B=device(ls,'U',{srv,online:()=>true});B.loadState();const evq=B.EVQ.length;
  T('فشل المفاتيح ('+keys.join('، ')+'): الأحداث محفوظة، والفتح يعلّم الحالة بأنها قد تتأخّر',evq===2&&B.STSTALE&&ls.getItem('muf_U_sok')===null,[evq,B.STSTALE]);
  srv.sync(B);T('ثم المزامنة: الحالة تطابق الخادم، وكل الأحداث وصلت مرة واحدة، وعادت علامة sok',JSON.stringify(B.P)===JSON.stringify(srv.S.P)&&srv.S.log.length===4&&srv.S.qa.length===1&&B.LOG.length===4&&ls.getItem('muf_U_sok')!==null&&!B.STSTALE,[srv.S.log.length,srv.S.qa.length,B.LOG.length])}
 // sok غائبة بلا أحداث منتظرة: معلَّمة أيضًا (تُطلب مزامنة فورية)، والتنبيه لا يظهر (لا عمل معلّق)
 {const ls=mkLS(5e6),A=device(ls);A.loadState();A.ev(rate(1));A.EVQ=[];A.save();ls.removeItem('muf_U_sok');const B=device(ls);B.loadState();
  T('sok غائبة ولا أحداث منتظرة: الحالة معلَّمة للمزامنة',B.STSTALE===true&&B.EVQ.length===0);
  T('التنبيه مشروط بوجود أحداث منتظرة، والمزامنة تُطلب دائمًا',/if\(STSTALE\)setTimeout\(\(\)=>\{if\(EVQ\.length\)toast\([^;]*;schedSync\(0\)\}/.test(src))}
 console.log(out.join('\n'));if(out.some(l=>l.startsWith('FAIL')))process.exit(1);
})();
