// يُشغَّل داخل الصفحة بحساب المشرف (USR=admin): خانة «التحقّق من التذكّر (تجريبي)» في صفحة المتعلّم. لا كتابة حقيقية: الحفظ يُلتقط هنا
(async()=>{
  const out=[],ok=(c,n,d)=>out.push((c?"PASS ":"FAIL ")+n+(d!=null?" → "+d:""));const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  try{
  const SAVED=[];let failNext=false;const oc=db.collection.bind(db);
  db.collection=n=>{const c=oc(n);if(n!=="config")return c;const od=c.doc.bind(c);c.doc=id=>{const d=od(id);d.set=o=>{if(failNext){failNext=false;return Promise.reject({code:"unavailable"})}SAVED.push(o);return Promise.resolve()};return d};return c};
  window.uiConfirm=async()=>true;
  // إعدادات أخرى موجودة يجب أن تبقى كما هي
  applyCfg({ai:["kid1"],free:["kid2"],stn:{kid3:2},gems:{station:2},rd:["kid4"]});
  const before=JSON.parse(JSON.stringify(CFG));delete before.srs;
  const U="abbasuid";goTab("users");await sleep(800);USERS=[{id:U,name:"abbas",st:"new"},{id:"kid1",name:"k1",st:"new"}];uOpen=U;renderUser();await sleep(100);
  const cb=()=>$("uSrs"),fp=()=>$("uSrsP"),last=()=>JSON.parse(SAVED[SAVED.length-1].v);
  ok(cb()&&!cb().checked&&!fp(),"الافتراضي: الخانة غير مؤشَّرة، ولا خانة «تجربة مكثّفة»",CFG.srs.on);
  // التفعيل
  const t1=Date.now();cb().click();await sleep(300);let c=last(),rest={...c};delete rest.srs;
  ok(c.srs.on===1&&JSON.stringify(c.srs.u)===JSON.stringify([U])&&c.srs.t0>=t1-5&&c.srs.p===.15&&c.srs.max===5,"التفعيل: on=1، والقائمة فيها هذا الحساب وحده، وt0 الآن، والنسبة 0.15 والحدّ 5",JSON.stringify(c.srs));
  ok(JSON.stringify(rest)===JSON.stringify(before),"الحفظ لا يغيّر أي إعداد آخر (المساعد والدراسة الحرّة والمحطات والجواهر والقراءة)");
  ok(cb().checked&&!!fp()&&!fp().checked&&CFG.srs.on===1,"بعد الحفظ: الخانة مؤشَّرة، وظهرت «تجربة مكثّفة» غير مؤشَّرة");
  // التجربة المكثّفة
  const t0=c.srs.t0;fp().click();await sleep(300);c=last();
  ok(c.srs.p===1&&c.srs.max===5&&c.srs.t0===t0&&JSON.stringify(c.srs.u)===JSON.stringify([U]),"تجربة مكثّفة: p=1 والحدّ 5، وt0 والقائمة كما هي",JSON.stringify(c.srs));
  // إعادة تحميل صفحة المشرف: الإعداد يُقرأ من جديد
  applyCfg(null);applyCfg(JSON.parse(SAVED[SAVED.length-1].v));renderUser();await sleep(100);
  ok(cb().checked&&fp()&&fp().checked,"بعد إعادة التحميل: الخانتان كما حُفظتا");
  // حساب غير مشمول: لا تفعيل له، لا في الخادم ولا في التطبيق
  const inList=id=>(CFG.srs.u||[]).includes(id);
  ok(!inList("kid1")&&!inList("kid2"),"حساب غير مشمول: ليس في القائمة، فلا سؤال له ولا يقبل الخادم v منه",JSON.stringify(CFG.srs.u));
  uOpen="kid1";renderUser();await sleep(100);ok(!cb().checked&&!fp(),"صفحة متعلّم آخر: الخانة غير مؤشَّرة");uOpen=U;renderUser();await sleep(100);
  // فشل الحفظ: لا يتغيّر شيء
  const snap=JSON.stringify(CFG.srs),n0=SAVED.length;failNext=true;cb().click();await sleep(300);
  ok(SAVED.length===n0&&JSON.stringify(CFG.srs)===snap&&cb().checked,"فشل الحفظ (لا اتصال): الإعداد والخانة كما كانا",JSON.stringify(CFG.srs));
  // حسابان، ثم إيقاف أحدهما
  applyCfg(srsCfgWith("other2",true));renderUser();await sleep(50);
  cb().click();await sleep(300);c=last();
  ok(c.srs.on===1&&JSON.stringify(c.srs.u)===JSON.stringify(["other2"]),"إيقاف حساب لا يوقف حسابًا آخر في التجربة",JSON.stringify(c.srs));
  // إيقاف آخر حساب: الميزة مطفأة كليًا والنسبة تعود 0.15
  applyCfg(srsCfgWith("other2",false));const off=CFG.srs;
  ok(off.on===0&&!off.u.length&&off.t0===0&&off.p===.15,"إيقاف آخر حساب: on=0 والقائمة فارغة والنسبة 0.15",JSON.stringify(off));
  // الأثر على المتعلّم: الإيقاف من اللوحة يمنع السؤال فورًا (srsOn في core.js)
  applyCfg(srsCfgWith(U,true,true));SRSU=true;const a=srsOn(Date.now());applyCfg(srsCfgWith(U,false));const b=srsOn(Date.now());SRSU=false;
  ok(a&&!b,"الإيقاف من اللوحة: srsOn تصير false فورًا لهذا الحساب");
  }catch(e){ok(false,"خطأ في الاختبار",String(e&&e.stack||e).slice(0,300))}
  console.log("DBG\n"+out.join("\n"));
})();
