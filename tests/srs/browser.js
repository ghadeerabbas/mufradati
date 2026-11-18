// يُشغَّل داخل الصفحة (tests/browser/page.py): واجهة التحقّق من التذكّر في المراجعة، دون إنترنت (كل طلب للخادم يفشل)، ببيانات اصطناعية
(async()=>{
  const out=[],ok=(c,n,d)=>out.push((c?"PASS ":"FAIL ")+n+(d!=null?" → "+d:""));const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  try{
  // دون إنترنت: كل طلب إلى الخادم يفشل، فتبقى الأحداث في الطابور
  const F0=window.fetch;window.fetch=(u,o)=>String(u).includes("workers.dev")?Promise.reject(new TypeError("offline")):F0(u,o);
  const DAY=864e5,now=Date.now();
  const setup=(n,box,cfg)=>{P={};LOG=[];QA=[];EVQ=[];R={...R,vf:[]};EC=null;try{localStorage.removeItem(K("srs"))}catch(e){}
    applyCfg({srs:{on:1,t0:0,u:[UID],p:1,max:5,...(cfg||{})}});syncFree();
    const ws=uniq(W).filter(w=>w.ar&&w.de).slice(0,n);
    ws.forEach((w,i)=>{P[w.k]={box,due:now-1000,t:now-IV[box]*DAY};LOG.push([now-IV[box]*DAY+i,w.k,2,0])});EC=null;
    SRSLAST={k:null,v:false};goTab("review");startReview("due",n);return ws};
  const rateBtns=()=>[...document.querySelectorAll("#rate .rate button")].map(b=>+b.dataset.r);
  const isQ=()=>document.querySelectorAll("#rate .srsq .gopt").length;

  // 1) جلسة من 12 بطاقة في الصندوق 4، والنسبة 100%: الحدّ 5 ولا بطاقتا تحقّق متتاليتان
  setup(12,4);let asked=0,consec=0,prev=false,first=null,n=0,boxes=[];
  while(queue.length&&n<40){n++;const k=cur.k,q=isQ();
    if(q){asked++;if(prev)consec++;
      ok(q===4&&!!$("idk")&&/تحقّق سريع/.test(document.querySelector("#review .face.front .hint").textContent),"بطاقة التحقّق: 4 خيارات و«لا أعرف» ونص «تحقّق سريع»",q);
      if(!first){first=k;   // الأولى: جواب خاطئ
        const wrong=[...document.querySelectorAll("#rate .srsq .gopt")].find(b=>b.dataset.k!==k);wrong.click();await sleep(900);
        ok(JSON.stringify(rateBtns())==="[0,1]","بعد الجواب الخاطئ: زرّان فقط («نسيت» و«صعبة»)",JSON.stringify(rateBtns()));
        showCard();await sleep(100);   // كأن الصفحة أُعيد رسمها قبل التقييم
        ok(flipped&&JSON.stringify(rateBtns())==="[0,1]"&&!isQ(),"إعادة الرسم بعد الفشل: لا سؤال جديد، والزرّان فقط",JSON.stringify(rateBtns()));
        const q0=EVQ.length;document.querySelector('#rate .rate button[data-r="1"]').click();await sleep(400);
        const e=EVQ[EVQ.length-1]||{};
        ok(P[k].box===2&&(R.vf||[]).length===1&&e.type==="rate"&&e.v===-1&&e.r===1&&EVQ.length===q0+1,"«صعبة» بعد الفشل: الصندوق 4 ← 2، ومدخل أرشيف واحد، وحدث واحد فيه v=-1",`صندوق ${P[k].box} · أرشيف ${(R.vf||[]).length} · حدث ${JSON.stringify(e)}`);
        boxes.push(P[k].box);prev=true;continue}
      // البقية: جواب صحيح ← الأزرار الأربعة
      document.querySelector(`#rate .srsq .gopt[data-k="${CSS.escape(k)}"]`).click();await sleep(500);
      ok(JSON.stringify(rateBtns())==="[0,1,2,3]","بعد الجواب الصحيح: الأزرار الأربعة كما هي",JSON.stringify(rateBtns()));
      document.querySelector('#rate .rate button[data-r="2"]').click();await sleep(400);ok(P[k].box===5&&!EVQ[EVQ.length-1].v,"الجواب الصحيح ثم «عرفتها»: صعود عادي بلا v",P[k].box);prev=true;continue}
    prev=false;$("flip").click();await sleep(150);document.querySelector('#rate .rate button[data-r="2"]').click();await sleep(400)}
  ok(asked===5&&consec===0,"الحدّ اليومي 5، ولا بطاقتا تحقّق متتاليتان (12 بطاقة، النسبة 100%)",`سُئل ${asked} · متتالية ${consec}`);
  ok((R.vf||[]).length===1,"فشل واحد = مدخل أرشيف واحد",(R.vf||[]).length);
  {const q=EVQ.length,p=JSON.stringify(P),ok1=await syncNow();ok(!ok1&&EVQ.length===q&&q>=12&&JSON.stringify(P)===p&&EVQ.some(e=>e.v===-1),"دون إنترنت: المزامنة تفشل، والأحداث (ومنها v=-1) باقية في الطابور، والحالة كما هي",`طابور ${q} · ${syncErr}`)}
  // حالة اليوم محفوظة: الحدّ لا يُعاد بإعادة التحميل
  const st0=JSON.parse(localStorage.getItem(K("srs"))||"{}");ok(Object.keys(st0.ask||{}).length===5&&st0.ask[first].f===1,"حالة التحقّق محفوظة في الجهاز لليوم (5 أسئلة، والفشل مسجّل)",Object.keys(st0.ask||{}).length);

  // 2) «نسيت» بعد الفشل: الصندوق 0 بالقاعدة الحالية، وتعود البطاقة في الجلسة بلا سؤال
  setup(3,6);let k2=cur.k;if(!isQ()){ok(false,"البطاقة الأولى كان يجب أن تُسأل")}else{
    document.querySelector(`#rate .srsq .gopt:not([data-k="${CSS.escape(k2)}"])`).click();await sleep(900);document.querySelector('#rate .rate button[data-r="0"]').click();await sleep(500);
    ok(P[k2].box===0&&!(R.vf||[]).length,"«نسيت» بعد الفشل: الصندوق 0 كما اليوم، بلا أرشيف",P[k2].box);
    let again=false;for(let i=0;i<6&&queue.length;i++){if(cur.k===k2){again=true;ok(!isQ(),"البطاقة المنسية حين تعود في الجلسة: بلا سؤال (تدريب)");break}
      if(isQ())document.querySelector(`#rate .srsq .gopt[data-k="${CSS.escape(cur.k)}"]`).click();else $("flip").click();await sleep(600);document.querySelector('#rate .rate button[data-r="2"]').click();await sleep(450)}
    ok(again,"البطاقة المنسية عادت في الجلسة")}

  // 3) «لا أعرف» يُعامل فشلًا، والصندوق 8 يُسأل بالاتجاه المعاكس (العربية ← الألمانية)
  setup(1,8);{const k=cur.k,de=[...document.querySelectorAll("#rate .srsq .gopt")].every(b=>b.lang==="de");
    ok(isQ()&&de&&document.querySelector("#review .face.front .ar"),"الصندوق 5 فأكثر: المعنى العربي والخيارات ألمانية",de);
    $("idk").click();await sleep(900);document.querySelector('#rate .rate button[data-r="1"]').click();await sleep(400);ok(P[k].box===4,"«لا أعرف» ثم «صعبة»: 8 ← 4",P[k].box)}

  // 4) حالات لا سؤال فيها
  setup(1,2);ok(!isQ(),"الصندوق 2: لا سؤال");
  setup(1,4,{p:0});ok(!isQ(),"النسبة 0: لا سؤال");
  setup(1,4,{on:0});ok(!isQ(),"المفتاح مطفأ: لا سؤال");
  setup(1,4,{u:["someone-else"]});ok(!isQ(),"حساب ليس في القائمة: لا سؤال");
  setup(1,4,{t0:now+DAY});ok(!isQ(),"قبل وقت التفعيل: لا سؤال");
  {setup(1,4);const k=cur.k;P[k].due=now+3*DAY;EC=null;localStorage.removeItem(K("srs"));SRSLAST={k:null,v:false};startReview("all",1);ok(!isQ(),"تدريب قبل الموعد: لا سؤال")}
  {setup(1,4);const k=cur.k;LOG.push([now-5000,k,0,0]);LOG.sort((a,b)=>a[0]-b[0]);localStorage.removeItem(K("srs"));SRSLAST={k:null,v:false};startReview("due",1);ok(!isQ(),"كلمة رُوجعت اليوم: لا سؤال")}
  {P={};LOG=[];const ws=setup(1,4);LOG=[[now-4*DAY,ws[0].k,1,0]];localStorage.removeItem(K("srs"));SRSLAST={k:null,v:false};startReview("due",1);ok(!isQ(),"آخر تقييم محسوب «صعبة»: لا سؤال (لم يدّعِ معرفتها)")}
  // مفتاح الإيقاف أثناء الجلسة
  {setup(2,4);const q1=isQ();applyCfg({srs:{on:0}});syncFree();document.querySelector(`#rate .srsq .gopt[data-k="${CSS.escape(cur.k)}"]`).click();await sleep(500);document.querySelector('#rate .rate button[data-r="2"]').click();await sleep(400);
   ok(q1&&!isQ(),"الإيقاف أثناء الجلسة: البطاقة التالية بلا سؤال")}
  window.fetch=F0;
  }catch(e){ok(false,"خطأ في الاختبار",String(e&&e.stack||e).slice(0,300))}
  console.log("DBG\n"+out.join("\n"));
})();
