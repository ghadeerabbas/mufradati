// «تحقق كامل» في صفحة الحماية: الرسالة تذكر وقت النسخة المقارَنة ومفتاحها، ويظهر جدولا النسخة والآن والخانات المختلفة ملوّنة
const _ap=apiPost;const AT=Date.parse('2026-11-16T20:46:41Z'),K='bak-2026-11-16T20-46-41-123Z-4736';
const a={name:'علي',gems:99,xp:8737,lv:14,stations:68},b={name:'علي',gems:151,xp:9482,lv:15,stations:82},m={name:'محمد',gems:5,xp:50,lv:2,stations:3};
apiPost=async(p,x)=>{if(p==="/backup"&&x.op==="list")return {items:[{key:K,at:AT,n:40,users:3,size:9000,why:'manual',pol:2}]};if(p==="/errs")return {items:[]};
  if(p==="/backup"&&x.op==="verify")return {ok:true,key:K,at:AT,cmpAt:AT+600e3,n:40,result:'diff',accts:{ali:{name:'علي',userDoc:true,docs:{core:'diff',log:'diff',qa:'same',ck:'none',gifts:'same'},docSame:false,coreUt:{bak:'2026-11-16T20:40:00Z',live:'2026-11-16T20:52:40Z'},bak:a,live:b,diff:['gems','xp','lv','stations']},moh:{name:'محمد',userDoc:true,docs:{core:'same',log:'same',qa:'same',ck:'none',gifts:'same'},docSame:true,coreUt:{bak:'',live:''},bak:m,live:m,diff:[]}},bak:{ali:a,moh:m},live:{ali:b,moh:m},diff:{ali:['gems','xp','lv','stations'],moh:[]}};return _ap(p,x)};
document.querySelectorAll("nav button,.panel").forEach(x=>x.classList.remove("on"));$("safe").classList.add("on");await renderSafe();
document.querySelector(".bkV").click();await sleep(300);
const t=$("bkMsg").textContent;T('الرسالة: «توجد فروقات» ومعرّف النسخة ووقت إنشائها ووقت المقارنة',t.includes("توجد فروقات")&&t.includes(K)&&t.includes("46:41")&&t.includes("56:41"),t.slice(0,160));
T('سطر لكل حساب مختلف: أيّ وثيقة اختلفت ووقت كتابتها',$("bkOut").textContent.includes("الحالة مختلفة")&&$("bkOut").textContent.includes("20:52:40")&&!$("bkOut").textContent.includes("محمد:"));
const tabs=document.querySelectorAll("#bkOut table");T('جدولان: من النسخة، والآن',tabs.length===2&&tabs[0].textContent.includes('من النسخة')&&tabs[1].textContent.includes('الآن'));
const hl=[...tabs[0].querySelectorAll('td')].filter(td=>td.style.background).map(td=>td.textContent);T('الخانات المختلفة لعلي ملوّنة، ومحمد بلا تلوين',hl.join(',')==='99,8737,14,68',hl.join(','));
apiPost=_ap;
