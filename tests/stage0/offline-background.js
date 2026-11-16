window.__rl=0;doReload=async()=>{window.__rl++;try{sessionStorage.setItem("muf_vrl",JSON.stringify({sv:VMIS&&VMIS.sv,t:Date.now()}))}catch(e){}};
try{sessionStorage.removeItem("muf_vrl")}catch(e){};RLD=false
applyServer=function(){};let NET='off',CALLS=0;const SUM={gems:5,xp:1,lv:1,rest:1,need:80,streak:1,today:false};
const _f=window.fetch;window.fetch=function(u,o){if(String(u).includes('/sync')){CALLS++;if(NET==='off')return Promise.reject(new TypeError('Failed to fetch'));return Promise.resolve(new Response(JSON.stringify({core:'{}',log:'null',qa:'null',rej:[],cv:'zzzzzzzzzz',sum:SUM}),{status:200}))}return _f.apply(this,arguments)};
// 1) بلا إنترنت مع أحداث لم تُزامن
EVQ.push({type:'rate',k:'x',r:2,t:Date.now()});await syncNow();
T('بلا إنترنت: الأحداث باقية ولا إعادة',EVQ.length>0&&window.__rl===0,'محاولات '+CALLS+' evq '+EVQ.length+' rl '+window.__rl+' err '+syncErr);
// المستخدم يعرف أن هناك تحديثًا لكنه بلا إنترنت: زر التحديث لا يعيد التحميل
VMIS={sv:'zzzzzzzzzz',sum:SUM};verBar();document.getElementById('vbarGo').click();await sleep(400);
T('زر «تحديث الآن» بلا إنترنت ومع أحداث معلّقة: لا إعادة',window.__rl===0&&EVQ.length>0,'rl '+window.__rl+' evq '+EVQ.length);
// 2) عودة الاتصال: المزامنة أولًا ثم الإعادة
NET='on';dispatchEvent(new Event('online'));await sleep(1500);
T('عودة الاتصال: وصلت الأحداث ثم أُعيد التحميل مرة واحدة',EVQ.length===0&&window.__rl===1,'إعادة '+window.__rl+' evq '+EVQ.length+' calls '+CALLS+' err '+syncErr+' syncing '+syncing+' vm '+JSON.stringify(VMIS));
// 3) العودة من الخلفية بعد غياب طويل بلا أحداث
try{sessionStorage.removeItem("muf_vrl")}catch(e){};RLD=false;VMIS=null;UPD=false;window.__rl=0;lastSync=Date.now()-11*60e3;const c0=CALLS;
Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));await sleep(1500);
T('العودة من الخلفية بعد 10 دقائق: مزامنة تكشف الاختلاف ثم إعادة',CALLS>c0&&window.__rl===1,'طلبات '+(CALLS-c0)+' · إعادة '+window.__rl);
// 4) العودة من الخلفية أثناء درس
try{sessionStorage.removeItem("muf_vrl")}catch(e){};RLD=false;VMIS=null;UPD=false;window.__rl=0;lastSync=Date.now()-11*60e3;STS={x:1};
document.dispatchEvent(new Event('visibilitychange'));await sleep(1500);
T('العودة من الخلفية أثناء درس: لا إعادة، والشريط ظاهر',window.__rl===0&&!!document.getElementById('vbar'));
STS=null;
// 5) حدث جديد أثناء انتظار الإعادة
EVQ.push({type:'rate',k:'y',r:2,t:Date.now()});NET='off';verCheck({cv:'zzzzzzzzzz',sum:SUM});T('حدث جديد لم يُزامن: لا إعادة',window.__rl===0);
NET='on';await syncNow();await sleep(300);T('بعد وصوله: إعادة',window.__rl===1&&EVQ.length===0);
window.fetch=_f;
