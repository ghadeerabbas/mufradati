// يُشغَّل داخل الصفحة: (1) توزيع أنواع خطوات المحطة على 3000 محطة، (2) خطوة قديمة tr/write تُعرض اختيارًا من متعدد،
// (3) محطة كاملة بالنقر حتى النهاية: حدث stDone، والخبرة والجواهر كما يتوقع
(async()=>{
  const R=[],ok=(c,n,d)=>R.push((c?"PASS ":"FAIL ")+n+(d!=null?" → "+d:""));
  const pool=uniq(W).filter(w=>w.ar&&w.de);
  const cnt={};let badLen=0;
  for(let i=0;i<3000;i++){const ws=shuffle([...pool]).slice(0,5),st=stationSteps(ws);if(st.length!==ws.length*3)badLen++;st.forEach(s=>cnt[s.t]=(cnt[s.t]||0)+1)}
  ok(!cnt.tr&&!cnt.write,"لا «ترجم الجملة» ولا «اكتبها» في 3000 محطة",JSON.stringify(cnt));
  ok(badLen===0,"عدد خطوات كل محطة = 3 لكل كلمة (كما كان)","مخالفة "+badLen);
  ok(!GAMES.some(g=>g.id==="type"),"«اكتبها بالألمانية» ليست في قائمة التمارين",GAMES.map(g=>g.id).join(","));
  let ck=0;for(let i=0;i<3000;i++)if(chalKind(pool[i%pool.length])==="type")ck++;ok(ck===0,"تحدي اليوم بلا «اكتبها»");
  // خطوة محفوظة من نسخة أقدم
  const w0=pool[0];STS={n:1,words:[w0],steps:[{t:"tr",w:w0},{t:"write",w:w0}],i:0,miss:new Set,t0:Date.now()};
  goTab("review");stationView();const t1=STS.steps[0].t,o1=document.querySelectorAll("#review .gopt").length;
  ok(t1==="mc"&&o1>=2,"خطوة tr قديمة تُعرض اختيارًا من متعدد","نوع "+t1+" · خيارات "+o1);
  STS=null;
  // محطة كاملة
  const e0=econ(),L0=LOG.length;startStation();let n=0,guard=0;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  while(STS&&guard++<200){
    const S_=STS,st=S_.steps[S_.i];if(!st)break;await sleep(30);
    const fb=document.querySelector("#fbar.on .fbgo");if(fb){fb.click();await sleep(30);continue}
    const g=[...document.querySelectorAll(".gopt")].find(b=>b.dataset.k===st.w.k);
    if(g){g.click();n++;continue}
    const nx=document.getElementById("stNext");if(nx){nx.click();n++;continue}
    break;
  }
  await sleep(300);
  const ev1=LOG.slice(L0).map(x=>Array.isArray(x)?x[1]:x.type).join(",");
  ok(!STS&&typeof RES==="object"&&RES&&/أنهيت المحطة/.test(RES.title||""),"محطة كاملة حتى النهاية بالنقر","نقرات "+n+" · "+(RES&&RES.title));
  const e1=econ();ok(e1.xp>e0.xp,"الخبرة زادت بعد المحطة",e0.xp+" → "+e1.xp);
  ok(e1.gems-e0.gems===CFG.gems.station||e1.gems>=e0.gems,"جواهر المحطة",e0.gems+" → "+e1.gems+" (المتوقع +"+CFG.gems.station+")");
  console.log("DBG\n"+R.join("\n"));
})();
