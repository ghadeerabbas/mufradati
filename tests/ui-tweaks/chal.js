// يُشغَّل داخل الصفحة: (1) كتابة «تحدي اليوم» تحت الكأس داخل مساحة المسار فلا تتداخل مع ما بعدها،
// (2) شاشة نهاية التحدي لا تبقى عالقة في «التمارين» بعد مغادرتها، والتحدي غير المنتهي يبقى كما هو
(async()=>{
  const R=[],ok=(c,n,d)=>R.push((c?"PASS ":"FAIL ")+n+(d!=null?" → "+d:""));const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  try{
  // 1) التخطيط: أسفل الكتابة لا يتجاوز أسفل المسار
  goTab("review");reviewHome();await sleep(300);
  const zz=document.querySelector("#review .zz"),tl=document.querySelector("#review .zn.chal .tl");
  if(!zz||!tl)ok(false,"عقدة تحدي اليوم وكتابتها موجودتان",!!zz+" "+!!tl);
  else{const a=tl.getBoundingClientRect().bottom,b=zz.getBoundingClientRect().bottom;
    ok(a<=b+0.5,"كتابة «تحدي اليوم» داخل مساحة المسار (لا تنزل فوق السطر التالي)","أسفل الكتابة "+Math.round(a)+" · أسفل المسار "+Math.round(b))}
  // 2) التحدي المنتهي: يُمسح عند مغادرة «التمارين»
  const ws=uniq(W).filter(w=>w.ar&&w.de).slice(0,8);
  goTab("games");GM={id:"chal",ok:8,n:8,i:8,t0:Date.now(),done:true,list:ws};renderGames();await sleep(100);
  ok(!!$("gBack")&&/المسار/.test($("gBack").textContent),"شاشة نهاية التحدي معروضة في «التمارين»",$("gBack")&&$("gBack").textContent);
  goTab("me");await sleep(100);
  ok(GM===null,"بعد الانتقال إلى تبويب آخر: لا يبقى التحدي المنتهي",GM&&GM.id);
  goTab("games");await sleep(100);
  ok(!$("gBack")||!/المسار/.test($("gBack").textContent),"العودة إلى «التمارين»: قائمة التمارين لا شاشة النهاية");
  // التحدي غير المنتهي يبقى
  GM={id:"chal",ok:2,n:3,i:3,t0:Date.now(),done:false,list:ws};GM.q=makeQ(chalKind(ws[3]),ws[3]);renderGames();
  goTab("rewards");await sleep(100);
  ok(GM&&GM.id==="chal"&&!GM.done,"التحدي غير المنتهي يبقى عند مغادرة «التمارين»");
  // تمرين عادي منتهٍ: لا يتغيّر سلوكه
  GM={id:"mc",ok:5,n:5,i:5,t0:Date.now(),done:true,list:ws};goTab("me");await sleep(50);
  ok(GM&&GM.id==="mc","التمارين العادية لا تتأثر");
  GM=null;renderGames();goTab("review");
  }catch(e){R.push("FAIL استثناء: "+e.message)}
  console.log("DBG\n"+R.join("\n"));
})()
