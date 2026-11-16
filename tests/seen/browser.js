// داخل الصفحة (أداة ftest): النبضة لا تحمل «نشاطًا» إلا بعد لمس أو كتابة حقيقية، ونص «آخر ظهور» دقيق بلا تقريب إلى الأعلى
const C=[];const _ap=apiPost;apiPost=async(p,b)=>{if(p==="/fr"&&b&&b.op==="tick"){C.push(b.act);return {nf:0,nin:0}}return _ap(p,b)};
ACT=false;await frTick();T('فتح التطبيق دون لمس: نبضة بلا نشاط',C[C.length-1]===0);
await frTick();T('نبضة ثانية دون لمس: بلا نشاط',C[C.length-1]===0);
document.body.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}));await frTick();T('بعد لمس الشاشة: النبضة التالية تحمل النشاط',C[C.length-1]===1);
await frTick();T('بعدها دون لمس جديد: بلا نشاط',C[C.length-1]===0);
document.dispatchEvent(new KeyboardEvent("keydown",{key:"a"}));await frTick();T('بعد الكتابة: نشاط',C[C.length-1]===1);
// تعذّرت النبضة: يبقى النشاط للنبضة التالية
apiPost=async(p,b)=>{if(p==="/fr"&&b.op==="tick"){C.push(b.act);throw new Error("net")}return _ap(p,b)};
document.body.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}));await frTick();
apiPost=async(p,b)=>{if(p==="/fr"&&b.op==="tick"){C.push(b.act);return {nf:0,nin:0}}return _ap(p,b)};await frTick();
T('نبضة فشلت بسبب الشبكة: النشاط يُرسل مع التي بعدها',C[C.length-2]===1&&C[C.length-1]===1);
clearTimeout(FRT);apiPost=_ap;
const nw=new Date(2026,10,16,15,30).getTime(),ago=m=>seenAgo(nw-m*6e4,nw);
T('30 ثانية',ago(.5)==="آخر ظهور قبل أقل من دقيقة",ago(.5));
T('59 دقيقة',ago(59)==="آخر ظهور قبل 59 دقيقة",ago(59));
T('89 دقيقة: الساعة نفسها لا «قبل 1 ساعة»',ago(89)==="آخر ظهور اليوم الساعة 14:01",ago(89));
T('بعد منتصف الليل: أمس',seenAgo(new Date(2026,10,15,23,10).getTime(),new Date(2026,10,16,0,20).getTime())==="آخر ظهور أمس الساعة 23:10");
T('قبل يومين',seenAgo(new Date(2026,10,14,9,0).getTime(),nw)==="آخر ظهور قبل يومين");
T('وقت في المستقبل (اختلاف ساعة الهاتف): لا رقم سالب',seenAgo(nw+5*6e4,nw)==="آخر ظهور قبل أقل من دقيقة");
