// منطق عرض نتيجة «تحقق كامل»: لا جدول قديم يبقى، و«مطابقة» فقط حين تتطابق كل الوثائق وكل عمود، وتنبيه الحسابين بالاسم نفسه
const _ap=apiPost,K='bak-2026-11-16T21-14-55-000Z-1111',AT=Date.parse('2026-11-16T21:14:55Z');let R=null;
const S=(g,st)=>({name:'علي',gems:g,xp:g*60,lv:14,stations:st});
apiPost=async(p,x)=>{if(p==="/backup"&&x.op==="list")return {items:[{key:K,at:AT,n:40,users:3,size:9000,why:'manual',pol:2}]};if(p==="/errs")return {items:[]};
  if(p==="/backup"&&x.op==="verify"){if(R instanceof Error)throw {error:'net'};return R}return _ap(p,x)};
const acct=(n,b,l,ds)=>({name:n,userDoc:true,docs:{core:ds,log:ds,qa:'same',ck:'none',gifts:'same'},docSame:ds==='same',coreUt:{bak:'2026-11-16T20:40:00Z',live:'2026-11-16T20:40:00Z'},bak:b,live:l,diff:JSON.stringify(b)===JSON.stringify(l)?[]:['gems']});
const mk=(result,accts)=>({ok:true,key:K,at:AT,cmpAt:AT+657e3,result,accts,bak:Object.fromEntries(Object.entries(accts).map(([u,a])=>[u,{name:a.name,...a.bak}])),live:Object.fromEntries(Object.entries(accts).map(([u,a])=>[u,{name:a.name,...a.live}])),diff:Object.fromEntries(Object.entries(accts).map(([u,a])=>[u,a.diff]))});
document.querySelectorAll("nav button,.panel").forEach(x=>x.classList.remove("on"));$("safe").classList.add("on");await renderSafe();
const run=async()=>{document.querySelector(".bkV").click();await sleep(250);return {m:$("bkMsg").textContent,o:$("bkOut").textContent,tabs:$("bkOut").querySelectorAll("table").length}};
// 1) فحص سابق بفروق، ثم فحص فشل: لا يبقى الجدول القديم
R=mk('diff',{u1:acct('علي',S(99,68),S(151,82),'diff')});let r=await run();T('فحص بفروق: الجدولان ظاهران',r.tabs===2&&r.m.includes('توجد فروقات'));
R=new Error();r=await run();T('فحص لاحق فشل: الجدول القديم يُمسح',r.tabs===0&&r.m.includes('تعذّر'),'جداول '+r.tabs);
// 2) فحص سابق بفروق، ثم فحص «مطابقة»: الجدول الجديد فقط
R=mk('diff',{u1:acct('علي',S(99,68),S(151,82),'diff')});await run();
R=mk('match',{u1:acct('علي',S(151,82),S(151,82),'same')});r=await run();
T('بعد فحص قديم بفروق، فحص «مطابقة»: لا يبقى أي رقم قديم',r.m.startsWith('✓ مطابقة')&&!r.o.includes('99')&&!r.o.includes('68'),r.o.slice(0,80));
// 3) حسابان باسم «علي»: «مطابقة» مع تنبيه واضح وآخر أرقام المعرّف تحت كل اسم
R=mk('match',{aliOLD1:acct('علي',S(99,68),S(99,68),'same'),aliNEW2:acct('علي',S(151,82),S(151,82),'same')});r=await run();
T('حسابان بالاسم نفسه: «مطابقة» وتنبيه ومعرّف كل عمود',r.m.startsWith('✓ مطابقة')&&r.o.includes('أكثر من حساب بالاسم نفسه')&&r.o.includes('…liOLD1')&&r.o.includes('…liNEW2'),r.o.slice(0,140));
// 4) «مطابقة» لا تظهر إن اختلفت وثيقة، أو اختلف عمود، حتى لو قال الخادم ذلك
R=mk('match',{u1:acct('علي',S(151,82),S(151,82),'diff')});r=await run();T('الخادم قال «مطابقة» لكن وثيقة مختلفة: لا «مطابقة»',!r.m.startsWith('✓')&&r.m.includes('تعارض'),r.m.slice(0,40));
R=mk('match',{u1:acct('علي',S(99,68),S(151,82),'same')});r=await run();T('الخادم قال «مطابقة» لكن الجدولان مختلفان: لا «مطابقة»',!r.m.startsWith('✓')&&r.m.includes('تعارض'),r.m.slice(0,40));
R=mk('diff',{u1:acct('علي',S(99,68),S(151,82),'diff')});r=await run();T('فروق حقيقية: «توجد فروقات»',r.m.startsWith('✗ توجد فروقات'));
apiPost=_ap;
