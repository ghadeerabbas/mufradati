// الحفظ المحلي: الدوال الحقيقية من index.html (الحفظ، والتحميل عند الفتح، وتطبيق حالة الخادم، وفحص ملفات المناهج)
// مع تخزين وهمي محدود السعة يبقى بين «إغلاق» التطبيق و«فتحه»، وخادم مُحاكى بسيط يجمع الأحداث. لا متصفح ولا شبكة.
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'../..');const src=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const cut=(a,b)=>{const i=src.indexOf(a),j=src.indexOf(b,i);if(i<0||j<0)throw new Error('لم يُعثر على: '+a);return src.slice(i,j)};
const line=re=>{const m=src.match(re);if(!m)throw new Error('لم يُعثر على: '+re);return m[0]};
const CODE=[
 line(/function st\(k,v\)\{[^\n]*?\}\}/),line(/const jget=[^\n]*/),line(/function unpackLog[^\n]*/),line(/function unpackQA[^\n]*/),
 cut('function loadState(){','// الحفظ المحلي:'),cut('let STFAIL=0','const key=w=>w.de.trim().toLowerCase();'),
 cut('function applyServer(j){','// محطة بدأت ولم تنتهِ'),cut('function wordsOk(t){','function applyWords(d){')].join('\n');

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
 ${CODE}
 return {loadState,save,applyServer,wordsOk,lsNow,lsSize,loadWords,
  ev(e){applyEv(e);EVQ.push(e);save()},
  get EVQ(){return EVQ},set EVQ(v){EVQ=v},get LOG(){return LOG},get QA(){return QA},get P(){return P},
  get STFAIL(){return STFAIL},get STKF(){return STKF},get STWARN(){return STWARN},get LSZ(){return LSZ}};`;
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

// ١) عادي
{const ls=mkLS(5e6),A=device(ls);A.loadState();for(let i=0;i<20;i++)A.ev(rate(i));
 T('عادي: كل الأحداث المنتظرة والسجل محفوظة، ولا فشل',stored(ls,'evq').length===20&&stored(ls,'log').length===20&&!A.STFAIL&&!A.STKF,stored(ls,'evq').length)}

// ٢) شبه ممتلئ: نسخ المناهج الأخرى والواجهة تُفرَّغ أولًا، ومنهج اليوم يبقى
{const ls=mkLS(400000);ls.setItem('muf_w_words-k3.json',big(100000));ls.setItem('muf_w_words-a1.json',big(100000));ls.setItem('muf_shell',big(50000));
 const A=device(ls);A.loadState();fillTo(ls,600);for(let i=0;i<20;i++)A.ev(rate(i));
 T('شبه ممتلئ: الأحداث محفوظة بعد تفريغ نسخ المناهج الأخرى والواجهة',stored(ls,'evq').length===20&&!A.STFAIL&&ls.m.has('muf_w_words-k3.json')&&!ls.m.has('muf_w_words-a1.json')&&!ls.m.has('muf_shell'),
  JSON.stringify({e:stored(ls,'evq').length,cur:ls.m.has('muf_w_words-k3.json'),oth:ls.m.has('muf_w_words-a1.json')}))}

// ٣) السجل المحلي لا يُحذف إلا بإثبات: (أ) بعد مزامنة → يُحذف ويُحفظ ما ينتظر؛ (ب) لم يزامن هذا الجهاز قط؛ (ج) حساب المشرف؛ (د) السجل لا يطابق علامة الخادم
function logCase({sync=true,admin=false,tamper=false}){const ls=mkLS(3e6),srv=server(),A=device(ls,'U',{admin});A.loadState();
 for(let i=0;i<3000;i++)A.ev(rate(i,1e12+i*1000));if(sync)srv.sync(A);
 if(tamper){A.LOG[A.LOG.length-1][0]+=1}
 const logBefore=ls.getItem('muf_U_log');ls.Q=ls.used()+200;   // الذاكرة تمتلئ تقريبًا
 for(let i=0;i<40;i++)A.ev(rate(5000+i,2e12+i));
 return {A,ls,srv,logKept:ls.getItem('muf_U_log')!==null,logSame:ls.getItem('muf_U_log')===logBefore,evq:(stored(ls,'evq')||[]).length}}
{const r=logCase({});T('امتلاء بعد مزامنة: نسخة السجل تُحذف لأنها في الخادم، والأحداث الأربعون محفوظة',!r.logKept&&r.evq===40&&!r.A.STFAIL,JSON.stringify({log:r.logKept,evq:r.evq}))}
{const r=logCase({sync:false});T('امتلاء دون أي مزامنة سابقة: السجل لا يُحذف أبدًا (لا إثبات أنه في الخادم)',r.logKept&&r.A.STFAIL>0,JSON.stringify({log:r.logKept,sf:r.A.STFAIL}))}
{const r=logCase({admin:true});T('حساب المشرف (لا يزامن): السجل لا يُحذف',r.logKept,String(r.logKept))}
{const r=logCase({tamper:true});T('السجل لا يطابق علامة الخادم: لا يُحذف',r.logKept,String(r.logKept))}

// ٤) امتلاء ← إغلاق ← فتح دون إنترنت ← مزامنة: لا يضيع شيء
{const r=logCase({}),ls=r.ls,srv=r.srv;
 const B=device(ls);B.loadState();   // فتح جديد للتطبيق دون إنترنت: لا مزامنة
 const off={evq:B.EVQ.length,P:Object.keys(B.P).length,log:B.LOG.length};
 T('بعد الإغلاق والفتح دون إنترنت: الأحداث المنتظرة الأربعون موجودة، والتقدّم المحفوظ موجود',off.evq===40&&off.P===3040,JSON.stringify(off));
 out.push('INFO دون إنترنت بعد الفتح: السجل المعروض '+off.log+' عنصرًا (حُذفت نسخته المحلية)، ويعود كاملًا مع المزامنة');
 ls.Q=5e6;srv.sync(B);
 const keys=new Set(srv.S.log.map(x=>x[1]));
 T('بعد المزامنة: كل الأحداث في الخادم (3040)، والسجل المحلي عاد كاملًا، ولا أحداث معلّقة',srv.S.log.length===3040&&keys.has('w5039')&&B.LOG.length===3040&&!B.EVQ.length,JSON.stringify({srv:srv.S.log.length,local:B.LOG.length,q:B.EVQ.length}));
 const C=device(ls);C.loadState();T('فتح ثالث بعد المزامنة: السجل والأحداث محفوظة على الجهاز',C.LOG.length===3040&&C.EVQ.length===0,C.LOG.length)}

// ٥) أحداث قديمة محفوظة ثم فشل حفظ الجديدة: القديمة لا تضيع ولا تُقصّ
{const ls=mkLS(3e6),srv=server(),A=device(ls);A.loadState();for(let i=0;i<30;i++)A.ev(rate(i));
 const old=ls.getItem('muf_U_evq');fillTo(ls,5);   // لم يزامن هذا الجهاز بعد، فلا يُحذف السجل
 for(let i=30;i<45;i++)A.ev(rate(i));
 T('الأحداث الجديدة لم تُحفظ، والقديمة الثلاثون باقية كما هي في التخزين',A.STFAIL===15&&ls.getItem('muf_U_evq')===old&&stored(ls,'evq').length===30,JSON.stringify({sf:A.STFAIL,stored:stored(ls,'evq').length}));
 T('تنبيه واحد للمتعلّم، وتقرير واحد للمشرف، وطلب مزامنة فورية مع كل فشل',A.calls.toast===1&&A.calls.rep.filter(m=>/evq/.test(m)).length===1&&A.calls.sync>=15,JSON.stringify({t:A.calls.toast,r:A.calls.rep.length,s:A.calls.sync}));
 const B=device(ls);B.loadState();ls.removeItem('junk');srv.sync(B);
 T('إغلاق قبل المزامنة ثم فتح: الثلاثون القديمة تصل الخادم (الجديدة كانت في الذاكرة فقط)',srv.S.log.length===30,srv.S.log.length);
 const ls2=mkLS(3e6),srv2=server(),A2=device(ls2);A2.loadState();for(let i=0;i<30;i++)A2.ev(rate(i));fillTo(ls2,5);for(let i=30;i<45;i++)A2.ev(rate(i));srv2.sync(A2);
 T('إن بقي التطبيق مفتوحًا حتى المزامنة: الخمسة والأربعون كلها تصل الخادم',srv2.S.log.length===45,srv2.S.log.length)}

// ٦) فشل مفتاح غير الأحداث المنتظرة: يُعدّ ويُبلَّغ، والقيمة السابقة تبقى، والأحداث محفوظة
{const ls=mkLS(2e6),A=device(ls);A.loadState();for(let i=0;i<5;i++)A.ev(rate(i));
 const prog=ls.getItem('muf_U_progress');fillTo(ls,600);
 A.P.huge=big(5000);A.ev(rate(6));
 T('التقدّم لم يُحفظ: يُعدّ فشلًا منفصلًا، والأحداث المنتظرة محفوظة، والقيمة السابقة باقية',A.STKF===1&&!A.STFAIL&&stored(ls,'evq').length===6&&ls.getItem('muf_U_progress')===prog,JSON.stringify({sk:A.STKF,sf:A.STFAIL,e:stored(ls,'evq').length}));
 T('تقرير واحد يسمّي المفتاح، ومزامنة فورية',A.calls.rep.length===1&&/progress/.test(A.calls.rep[0])&&A.calls.sync>=1,A.calls.rep.join('|'))}

// ٧) الترتيب ومفاتيح الحفظ
{const ls=mkLS(5e6);const order=[];const _s=ls.setItem.bind(ls);ls.setItem=(k,v)=>{order.push(k);_s(k,v)};const A=device(ls);A.loadState();A.ev(rate(1));
 T('الترتيب: الأحداث المنتظرة أول ما يُكتب',order[0]==='muf_U_evq',order.slice(0,3).join(','));
 const keys=['reset','progress','settings','log','ck','qlog','qa','buy','equip','league','energy','stations','stv','evq'];
 T('كل مفاتيح الحفظ السابقة ما زالت تُكتب',keys.every(k=>order.includes('muf_U_'+k)),keys.filter(k=>!order.includes('muf_U_'+k)).join(',')||'كلها')}

// ٨) دقة العدّادات: STFAIL يساوي عدد مرات الحفظ الفاشلة بالضبط، ويبقى بعد إعادة الفتح، ولا ينتقل إلى حساب آخر
{const ls=mkLS(1e6),A=device(ls);A.loadState();A.ev(rate(0));fillTo(ls,30);for(let i=1;i<=7;i++)A.ev(rate(i));
 T('سبع محاولات فاشلة = 7 بالضبط',A.STFAIL===7,A.STFAIL);
 ls.removeItem('junk');A.ev(rate(8));   // تحرّرت مساحة: نجح الحفظ، والعداد لا يزيد
 T('حفظ ناجح بعدها لا يغيّر العداد، والتنبيه يُعاد تفعيله فقط بعد إفراغ الأحداث',A.STFAIL===7,A.STFAIL);
 fillTo(ls,30);A.ev(rate(9));const B=device(ls);B.loadState();
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
(async()=>{
 {const ls=mkLS(5e6);ls.setItem('muf_w_words-k3.json','{"words":{}}');const good='{"days":[],"words":[{"de":"Haus","ar":"بيت"}]}';
  const A=device(ls,'U',{fetch:async()=>({ok:true,text:async()=>good})});A.loadState();await A.loadWords('k3');
  T('نسخة محفوظة بغير البنية: تُستبدل بملف الشبكة السليم',ls.getItem('muf_w_words-k3.json')===good&&A.calls.applied.words.length===1,ls.getItem('muf_w_words-k3.json'))}
 {const ls=mkLS(5e6);const A=device(ls,'U',{fetch:async()=>({ok:true,text:async()=>'{"words":[{"de":"Haus"}]}'})});A.loadState();await A.loadWords('k3');
  T('ملف شبكة بغير البنية: لا يُحفظ، ويُعرض منهج فارغ بدل كلمات ناقصة',ls.getItem('muf_w_words-k3.json')===null&&A.calls.applied.words.length===0,String(ls.getItem('muf_w_words-k3.json')))}
 console.log(out.join('\n'));if(out.some(l=>l.startsWith('FAIL')))process.exit(1);
})();
