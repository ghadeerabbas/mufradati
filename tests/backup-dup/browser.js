// داخل الصفحة (أداة ftest) بحساب المشرف: كم طلب «نسخة الآن» يُرسل؟
const C=[];let gate=null;const _ap=apiPost;
apiPost=async(p,b)=>{if(p==="/backup"&&b.op==="list")return {items:[]};if(p==="/errs")return {items:[]};
  if(p==="/backup"&&b.op==="now"){C.push(b.rid||"-");await new Promise(r=>gate=r);if(window.__fail){window.__fail=0;throw {error:"net"}}return {key:"bak-x",n:5}}return _ap(p,b)};
document.querySelectorAll("nav button,.panel").forEach(x=>x.classList.remove("on"));$("safe").classList.add("on");await renderSafe();
const btn=()=>$("bkNow");
btn().click();btn().click();btn().click();btn().click();await sleep(50);
T('أربع ضغطات سريعة: طلب واحد',C.length===1,C.length);
await renderSafe();await sleep(50);   // إعادة رسم الصفحة أثناء النسخ (مزامنة أو تغيّر الإعدادات أو العودة إلى الصفحة)
T('بعد إعادة رسم الصفحة أثناء النسخ: الزر معطّل',btn().disabled===true,'معطّل: '+btn().disabled);
btn().click();await sleep(50);T('ضغطة على الزر بعد إعادة الرسم أثناء النسخ: لا طلب ثانٍ',C.length===1,C.length);
window.__fail=1;gate();await sleep(300);
T('بعد خطأ في الشبكة: الزر يعود',btn().disabled===false);
btn().click();await sleep(50);T('إعادة المحاولة بعد الخطأ: بالمعرّف نفسه (فلا تتكرّر النسخة إن كانت قد حُفظت)',C.length===2&&C[1]===C[0]&&C[0]!=="-",C.join(" "));
gate();await sleep(400);btn().click();await sleep(50);T('ضغطة جديدة بعد النجاح: معرّف جديد',C.length===3&&C[2]!==C[0],C.join(" "));
gate();await sleep(200);apiPost=_ap;
