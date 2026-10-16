/* ===========================================================
   منطق مفرداتي المشترك: يعمل في التطبيق وفي الخادم بالكود نفسه
   (الاقتصاد، والمتجر، والطاقة، والمحطات، والدوري، وتطبيق الأحداث)
   يعتمد على متغيّرات عامة: P, LOG, QLOG, QA, BUY, R, LG, EN, STN, STV, GIFTS
   =========================================================== */
const DAY=864e5, IV=[0,1,2,4,7,15,30,60,120];
/* --- الوقت بتوقيت برلين، في الهاتف والخادم على السواء --- */
// قاعدة التوقيت الصيفي الأوروبية: من آخر أحد في مارس إلى آخر أحد في أكتوبر (الساعة 01:00 بتوقيت غرينتش)
const _lastSun=(y,m)=>{const d=new Date(Date.UTC(y,m+1,0,1));return d.getTime()-d.getUTCDay()*DAY};
const _dst={};
function tzOff(t){const y=new Date(t).getUTCFullYear();const r=_dst[y]||(_dst[y]=[_lastSun(y,2),_lastSun(y,9)]);return t>=r[0]&&t<r[1]?2*36e5:36e5}
const _p2=n=>String(n).padStart(2,"0");
// اليوم والساعة لكل ساعة مرة واحدة (حدود الأيام في برلين على رأس الساعة دائمًا)
const _dk=new Map();
function _hk(t){const h=Math.floor(t/36e5);let v=_dk.get(h);
  if(!v){const d=new Date(h*36e5+tzOff(h*36e5));v=[d.getUTCFullYear()+"-"+_p2(d.getUTCMonth()+1)+"-"+_p2(d.getUTCDate()),d.getUTCHours()];if(_dk.size>50000)_dk.clear();_dk.set(h,v)}return v}
const dkey=t=>_hk(t)[0];
const hourOf=t=>_hk(t)[1];
const today=()=>dkey(Date.now());
function weekStart(t){const d=new Date(t+tzOff(t)),mid=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())-((d.getUTCDay()+6)%7)*DAY;return mid-tzOff(mid-tzOff(t))}
const weekId=t=>dkey(weekStart(t));

/* ================= المتجر: الكتالوج ================= */
const SHOP=[
 // الصور الرمزية
 ...[["🎓",0,0],["🦊",200,30],["🐱",200,30],["🦉",300,40],["🐼",300,40],["🐧",300,40],["🦁",500,60],["🐯",500,60],["🤖",650,80],["🧠",650,80],["🚀",800,100],["🐉",1000,120],["🦄",1000,120],["👑",1600,200]]
   .map(([v,p,o],i)=>({id:"av"+i,cat:"avatar",name:"رمز "+v,val:v,price:p,old:o})),
 // الألقاب
 ...[["مبتدئ طموح",0,0],["طالب مجتهد",500,60],["صديق الأفعال",650,80],["صائد الأسماء",650,80],["عاشق الألمانية",1000,120],["سيّد der die das",1200,150],["بطل B2",2000,250],["أستاذ المفردات",3000,400]]
   .map(([v,p,o],i)=>({id:"t"+i,cat:"title",name:v,val:v,price:p,old:o})),
 // السمات
 {id:"classic",cat:"theme",name:"الكلاسيكي",price:0,sw:["#1f2a5a","#a01f26","#c9a84a"]},
 {id:"emerald",cat:"theme",name:"الزمرّدي",price:1200,old:150,sw:["#0f4c3a","#b5452f","#d4af37"]},
 {id:"royal",cat:"theme",name:"البنفسجي الملكي",price:1200,old:150,sw:["#3b1f6b","#c2185b","#f0c14b"]},
 {id:"ocean",cat:"theme",name:"المحيط",price:1200,old:150,sw:["#0b4f6c","#e4572e","#ffc857"]},
 {id:"sunset",cat:"theme",name:"الغروب",price:1600,old:200,sw:["#7a2e1f","#b8326a","#f4a261"]},
 {id:"lux",cat:"theme",name:"الذهبي الفاخر",price:2500,old:300,sw:["#241b12","#8c1c13","#e0b84f"]},
 // إطارات البطاقة
 {id:"none",cat:"frame",name:"بلا إطار",price:0},
 {id:"red",cat:"frame",tier:0,name:"إطار أحمر",price:150},
 {id:"green",cat:"frame",tier:0,name:"إطار أخضر",price:150},
 {id:"blue",cat:"frame",tier:0,name:"إطار أزرق",price:150},
 {id:"orange",cat:"frame",tier:1,name:"إطار برتقالي",price:200},
 {id:"purple",cat:"frame",tier:1,name:"إطار بنفسجي",price:250},
 {id:"pink",cat:"frame",tier:1,name:"إطار وردي",price:250},
 {id:"silver",cat:"frame",tier:2,name:"إطار فضّي",price:450},
 {id:"gold",cat:"frame",tier:3,name:"إطار ذهبي",price:800,old:100},
 {id:"wood",cat:"frame",tier:4,name:"إطار نحاسي",price:950,old:120},
 {id:"crimson",cat:"frame",tier:4,name:"إطار قرمزي",price:1100},
 {id:"neon",cat:"frame",tier:5,name:"إطار نيون",price:1200,old:150},
 {id:"stars",cat:"frame",tier:6,name:"إطار المجرّة",price:1450,old:180},
 {id:"fire",cat:"frame",tier:7,name:"إطار ناري",price:1600},
 {id:"rainbow",cat:"frame",tier:8,name:"إطار ملكي",price:1800,old:220},
 {id:"diamond",cat:"frame",tier:9,name:"إطار ماسي",price:2200},
 // الملصقات
 ...[["🌸",150,20],["⭐",150,20],["💡",200,25],["🍀",200,25],["🎈",200,25],["☕",250,30],["🍕",250,30],["🥨",300,40],["🌙",300,40],["🌻",300,40],["🎻",400,50],["🏰",500,60],["🇩🇪",500,60],["🦋",500,60],["🏆",800,100],["💎",1200,150]]
   .map(([v,p,o],i)=>({id:"s"+i,cat:"sticker",name:"ملصق "+v,val:v,price:p,old:o})),
 // الاحتفالات
 {id:"squares",cat:"confetti",name:"قصاصات ملوّنة",price:0,val:"🎊"},
 {id:"stars",cat:"confetti",name:"نجوم",price:500,old:60,val:"⭐"},
 {id:"hearts",cat:"confetti",name:"قلوب",price:500,old:60,val:"💖"},
 {id:"gems",cat:"confetti",name:"جواهر",price:800,old:100,val:"💎"},
 {id:"fireworks",cat:"confetti",name:"ألعاب نارية",price:1000,old:120,val:"🎆"},
 // مستهلكات
 // ألوان الاسم في الدوري (القرمزي للمشرف وحده، والعادي أسود نهارًا وأبيض ليلًا)
 ...[["none","اللون العادي",0],["red","أحمر",150],["green","أخضر",150],["blue","أزرق",150],["orange","برتقالي",250],["purple","بنفسجي",250],["pink","وردي",350],["teal","فيروزي",350],
     ["brown","بنّي",500],["silver","فضّي بحافة",800],["gold","ذهبي بحافة",1200],["emerald","زمرّدي بحافة",1500],["sapphire","ياقوتي بحافة",2000]].map(([id,n,p])=>({id,cat:"namecolor",name:n,price:p,val:"🎨"})),
 {id:"freeze",cat:"power",name:"تجميد السلسلة",price:300,old:50,val:"❄️",desc:"يحمي سلسلتك يومًا واحدًا إن غبت"},
];
// كل هدايا المتجر تنفتح بالصعود في الدوري (رقم الدوري الذي يفتح كل غرض؛ ما لم يُذكر يكون مفتوحًا)
const NCOL={red:1,green:1,blue:1,orange:1,purple:1,pink:1,teal:1,brown:1,crimson:1,silver:1,gold:1,emerald:1,sapphire:1,admin:1};
const UNLOCK={avatar:{av1:0,av2:0,av3:1,av4:1,av5:1,av6:2,av7:2,av8:3,av9:3,av10:4,av11:5,av12:7,av13:9},
 title:{t1:1,t2:2,t3:3,t4:4,t5:5,t6:7,t7:9},
 theme:{emerald:2,royal:3,ocean:4,sunset:6,lux:8},
 sticker:{s0:0,s1:0,s2:0,s3:1,s4:1,s5:1,s6:2,s7:2,s8:3,s9:3,s10:4,s11:5,s12:5,s13:6,s14:8,s15:9},
 confetti:{stars:1,hearts:2,gems:4,fireworks:6},
 namecolor:{red:0,green:0,blue:0,orange:1,purple:1,pink:2,teal:2,brown:3,silver:4,gold:5,emerald:7,sapphire:9}};
SHOP.forEach(x=>{const t=(UNLOCK[x.cat]||{})[x.id];if(t!=null)x.tier=t});
const CATS={avatar:"الرموز",title:"الألقاب",theme:"السمات",frame:"الإطارات",namecolor:"ألوان الاسم",sticker:"الملصقات",confetti:"الاحتفالات",power:"المعزّزات"};
const EQKEY={namecolor:"ncolor",avatar:"avatar",title:"title",theme:"theme",frame:"frame",sticker:"sticker",confetti:"confetti"};
const stkVal=v=>{if(!v)return"";const it=/^s\d+$/.test(v)?SHOP.find(x=>x.cat==="sticker"&&x.id===v):null;return it?it.val:v};
const itemOf=(cat,id)=>SHOP.find(x=>x.cat===cat&&x.id===id);
const owned=(cat,id)=>{const it=itemOf(cat,id);return it&&(it.price===0||BUY.some(b=>b.item===cat+":"+id))};

/* ================= الاقتصاد: كل شيء يُحسب من السجلّ ================= */
const GEM=[0,1,2,2],XPR=[1,2,4,4];
// خبرة كل تقييم: الكلمة الجديدة في المحطة 3 (أو 2 إن أخطأ فيها)، والمراجعة بحسب التقييم
// علامة السجلّ: 0 مراجعة في موعدها، 1 كلمة جديدة من محطة، 2 تدريب (قبل موعدها أو للمرة الثانية في اليوم) بلا خبرة ولا جواهر
const xpOf=(r,nw)=>nw===2?0:nw?(r>=2?3:2):XPR[r];
// خطوة المراجعة المتباعدة: التدريب لا يرفع الكلمة، لكن النسيان ينزلها
function boxStep(b,r,practice){return r===0?0:r===1?Math.max(1,b):practice?Math.max(1,b):Math.min(b+(r===2?1:2),8)}
// هل تُكافأ هذه المراجعة؟ فقط إن حلّ يوم موعدها، ولم تُكافأ الكلمة نفسها اليوم
function rewarded(p,k,t,L){
  if(p&&p.due&&dkey(t)<dkey(p.due))return false;
  const d=dkey(t);for(let i=L.length-1;i>=0;i--){const x=L[i];if(x[0]<t-DAY*1.5)break;if(x[1]===k&&x[3]!==2&&dkey(x[0])===d)return false}
  return true;
}
// يعيد وسم سجلّ قديم (قبل هذه القاعدة) ويعيد حساب مراحل الكلمات منه
function flagLog(){
  const L=[...LOG].sort((a,b)=>a[0]-b[0]),st={};
  for(const x of L){const [t,k,r]=x;let q=st[k];
    if(x[3]===1){st[k]={box:1,due:t+IV[1]*DAY,day:dkey(t),t};continue}
    const ok=!q||(dkey(t)>=dkey(q.due)&&q.day!==dkey(t));x[3]=ok?0:2;
    const b0=q?q.box:0,b=boxStep(b0,r,!ok);q=st[k]={box:b,due:r===0?t:ok||b0===0?t+IV[b]*DAY:q.due,day:ok?dkey(t):q?q.day:"",t}}
  LOG=L;for(const k in st)if(P[k])P[k]={box:st[k].box,due:st[k].due,t:st[k].t};
}
// الإنجازات بمستويات: كل إنجاز يرتقي إلى مستوى أعلى كلما زاد الرقم، ولكل مستوى جواهره
const ACH=[
 {id:"rev",ic:"📖",n:"المراجِع المجتهد",u:"مراجعة",v:s=>s.reviews,L:[[1,5],[100,20],[500,50],[1000,100],[2500,200],[5000,300],[10000,500],[25000,800],[50000,1200]]},
 {id:"mem",ic:"🌳",n:"حديقة الكلمات",u:"كلمة محفوظة",v:s=>s.mem,L:[[10,20],[50,50],[100,100],[250,200],[500,400],[1000,700],[2000,1000],[3000,1500]]},
 {id:"mast",ic:"💎",n:"الكلمات الراسخة",u:"كلمة راسخة",v:s=>s.mast,L:[[10,30],[50,150],[100,250],[250,500],[500,800],[1000,1200]]},
 {id:"streak",ic:"🔥",n:"السلسلة",u:"يومًا متتاليًا",v:s=>s.best,L:[[3,20],[7,50],[14,100],[30,200],[60,400],[100,700],[200,1000],[365,1500]]},
 {id:"perfect",ic:"🎯",n:"الأيام المثالية",u:"يومًا بلا نسيان (20 مراجعة فأكثر)",v:s=>s.perfect,L:[[1,30],[5,60],[10,100],[25,200],[50,400],[100,700]]},
 {id:"marathon",ic:"🏃",n:"الماراثون",u:"مراجعة في يوم واحد",v:s=>s.maxDay,L:[[50,25],[100,50],[200,100],[300,150],[500,250]]},
 {id:"quiz",ic:"🧩",n:"محبّ الاختبارات",u:"اختبارًا وتمرينًا مكتملًا",v:s=>s.quizzes,L:[[10,30],[25,50],[50,80],[100,150],[250,300],[500,500]]},
 {id:"qfull",ic:"🥇",n:"العلامة الكاملة",u:"اختبارًا أو تمرينًا بلا خطأ",v:s=>s.qfull,L:[[1,20],[5,40],[10,70],[25,150],[50,300],[100,500]]},
 {id:"owl",ic:"🦉",n:"بومة الليل",u:"ليلة راجعت فيها بعد الحادية عشرة",v:s=>s.night,L:[[1,10],[5,20],[15,40],[30,80],[60,150]]},
 {id:"bird",ic:"🐦",n:"الطائر المبكر",u:"صباحًا راجعت فيه قبل السابعة",v:s=>s.early,L:[[1,10],[5,20],[15,40],[30,80],[60,150]]},
 {id:"shop",ic:"🛍️",n:"جامع التحف",u:"غرضًا من المتجر",v:s=>s.items,L:[[5,30],[10,50],[20,100],[30,150],[40,200]]},
];
// أسماء الإنجازات قبل المستويات، لئلّا تُدفع جواهرها مرتين بعد التصفير
const OLD_ACH={first:"rev:1",r100:"rev:2",r500:"rev:3",r1000:"rev:4",r5000:"rev:6",m10:"mem:1",m50:"mem:2",m100:"mem:3",m250:"mem:4",m500:"mem:5",x50:"mast:2",
 s3:"streak:1",s7:"streak:2",s14:"streak:3",s30:"streak:4",s60:"streak:5",s100:"streak:6",perfect:"perfect:1",marathon:"marathon:2",q10:"quiz:1",qfull:"qfull:1",dayall:"dayall:1",owl:"owl:1",bird:"bird:1",shop5:"shop:1"};
const achList=()=>ACH;
const achLevel=(a,s)=>{const v=a.v(s);let k=0;while(k<a.L.length&&v>=a.L[k][0])k++;return k};
const lvlNeed=l=>80*l;                          // كل مستوى يحتاج 80 نقطة أكثر من سابقه
let EC=null;
function econ(){
  const s={reviews:0,mem:0,mast:0,best:0,streak:0,perfect:0,maxDay:0,quizzes:QLOG.length,qfull:0,dayAll:0,night:0,early:0,items:0,freezes:0};const nights=new Set,earlies=new Set;
  let gems=0,xp=0;const box={},r4=new Set,r7=new Set,per={};
  let L=LOG;for(let i=1;i<L.length;i++)if(L[i][0]<L[i-1][0]){L=[...LOG].sort((a,b)=>a[0]-b[0]);break}
  for(const [t,k,r,nw] of L){
    if(nw===2){box[k]=boxStep(box[k]||0,r,true);continue}      // التدريب لا يُحسب
    s.reviews++;xp+=xpOf(r,nw);
    let b=nw?1:boxStep(box[k]||0,r,false);box[k]=b;
    if(b>=4&&!r4.has(k)){r4.add(k);xp+=15}
    if(b>=7&&!r7.has(k)){r7.add(k);xp+=40}
    const d=dkey(t);const x=(per[d]=per[d]||{n:0,bad:0,clean:0});x.n++;if(r===0)x.bad++;if(!x.bad)x.clean=x.n;
    const h=hourOf(t);if(h>=23||h<4)nights.add(dkey(t-5*36e5));if(h>=4&&h<7)earlies.add(d);
  }
  s.mem=r4.size;s.mast=r7.size;s.night=nights.size;s.early=earlies.size;
  for(const d in per){const x=per[d];s.maxDay=Math.max(s.maxDay,x.n);if(x.clean>=20)s.perfect++;
    xp+=(x.n>=20?10:0)}
  for(const q of QLOG){xp+=q[1];if(q[2]>=5&&q[1]===q[2])s.qfull++}
  // السلسلة مع التجميد
  const fz=BUY.filter(b=>b.item==="power:freeze").map(b=>dkey(b.ts)).sort();
  const stDays=new Set(STN.map(x=>dkey(x[0]))),qd=d=>d<"2026-10-16"?!!per[d]:((per[d]&&per[d].n>=10)||stDays.has(d));
  const days=Object.keys(per).sort();let fi=0,avail=0;
  if(days.length){
    let t=new Date(days[0]+"T12:00:00").getTime();const end=today();
    for(;;t+=DAY){const d=dkey(t);while(fi<fz.length&&fz[fi]<=d){avail++;fi++}
      if(qd(d))s.streak++;else if(d!==end){if(avail>0)avail--;else s.streak=0}
      s.best=Math.max(s.best,s.streak);if(d>=end)break}
  }
  while(fi<fz.length){avail++;fi++}
  s.freezes=avail;
  s.items=BUY.filter(b=>!b.item.startsWith("power:")).length;
  // المستوى
  let lv=1,rest=xp;while(rest>=lvlNeed(lv)){rest-=lvlNeed(lv);lv++;}
  const paid=new Set((R.ach||[]).map(x=>OLD_ACH[x]||x)),got=[],alv={};
  for(const a of achList()){const k=achLevel(a,s);alv[a.id]=k;for(let i=1;i<=k;i++)got.push(a.id+":"+i)}
  // الجواهر: جوهرة لكل محطة مكتملة، وجوائز الدوري، وهدايا المشرف، وما بقي من قبل التصفير
  gems+=STN.length;
  gems+=R.bank||0;
  gems+=(LG.hist||[]).reduce((a,h)=>a+(h.g||0),0);      // جوائز الدوري
  gems+=giftSum();                                      // هدايا المشرف
  const spent=BUY.reduce((a,b)=>{const[c,id]=b.item.split(":");const it=itemOf(c,id);return a+(b.p!=null?b.p:it?(it.old!=null?it.old:it.price):0)},0);
  const td=per[today()]||{n:0};
  EC={s,xp,lv,rest,need:lvlNeed(lv),gems:Math.max(0,gems-spent),earned:gems,got:new Set(got),alv,todayN:td.n,per};
  return EC;
}

const giftSum=()=>(typeof GIFTS!=="undefined"&&GIFTS?GIFTS:[]).reduce((a,g)=>a+(g.g||0),0);

/* --- الطاقة: 30 وحدة كحدّ أقصى، تمتلئ في يوم (وحدة كل 48 دقيقة) --- */
const EN_MAX=30,EN_STEP=DAY/EN_MAX,ST_COST=10,ST_WORDS=5,ST_MAX=4;
const enAt=at=>Math.min(EN_MAX,Math.max(0,(EN.v||0)+Math.floor((at-(EN.t||0))/EN_STEP)));
const enNow=()=>enAt(Date.now());
const enNext=()=>enNow()>=EN_MAX?0:EN_STEP-((Date.now()-(EN.t||0))%EN_STEP);
function enAdd(d,at){const cur=enAt(at),frac=cur>=EN_MAX?0:(at-(EN.t||0))%EN_STEP;EN={v:Math.min(EN_MAX,Math.max(0,cur+d)),t:at-frac,rc:EN.rc||0,lt:EN.lt||0}}
const stTodayAt=at=>STN.filter(x=>dkey(x[0])===dkey(at)).length;

/* --- المقياس والدوري --- */
function measure(){
  const e=EC||econ(),days=Object.keys(e.per).length,now=Date.now();
  const act14=[...Array(14)].filter((_,i)=>e.per[dkey(now-i*DAY)]).length;
  const ok=LOG.filter(x=>x[2]>=2).length,acc=LOG.length?ok/LOG.length:0;
  const p={prog:Math.min(e.s.mem/300,1)*30,xp:Math.min(e.xp/2000,1)*20,dur:Math.min(days/60,1)*20,
    reg:Math.min(e.s.best/30,1)*5+Math.min(act14/10,1)*10,acc:acc*Math.min(LOG.length/30,1)*15};
  const parts={};let total=0;for(const k in p){parts[k]=Math.round(p[k]);total+=p[k]}
  return {total:Math.round(total),parts};
}
const band=()=>Math.min(5,Math.floor(measure().total/20));
// أعلى دوري وصله المتعلّم: يفتح هدايا المتجر، ولا تُقفل إن نزل بعدها
const bestTier=()=>Math.max(LG.tier??0,LG.best||0,...(LG.hist||[]).map(h=>h.tier+h.mv));
const GROUP_MAX=15,PROMO_MIN=60;
// خبرة الأسبوع: من المراجعات والاختبارات والتمارين في هذا الأسبوع
function weekXP(ws){
  const we=ws+7*DAY,per={};let xp=0;
  // السجلّ مرتّب زمنيًا: نقرأ من آخره حتى بداية الأسبوع فقط
  for(let i=LOG.length-1;i>=0;i--){const x=LOG[i];if(x[0]<ws-DAY)break;if(x[0]>=ws&&x[0]<we&&x[3]!==2){xp+=xpOf(x[2],x[3]);const d=dkey(x[0]);per[d]=(per[d]||0)+1}}
  for(const d in per)if(per[d]>=20)xp+=10;
  for(const q of QLOG)if(q[0]>=ws&&q[0]<we)xp+=q[1];
  return xp;
}
// عدد المتقدّمين والمتراجعين في كل دوري (من الأول إلى العاشر)
const UP_N=[10,9,8,7,6,5,4,3,1,0],DOWN_N=[0,2,3,3,3,4,4,5,5,5];
function zones(n,tier){
  tier=Math.max(0,Math.min(9,tier||0));const up=Math.min(UP_N[tier],n),down=Math.min(DOWN_N[tier],Math.max(0,n-up));
  return {up,down};
}
const prizeOf=(realRank,xp)=>xp<PROMO_MIN?0:([50,40,30][realRank-1]||0);
// يختار مجموعة من نفس الدوري متقاربة في المقياس، وينشئ مجموعة جديدة إن امتلأت أو ابتعدت
function chooseGroupFrom(docs,tier,my){
  const gs={},inTier=docs.filter(d=>(d.tier||0)===tier);
  inTier.forEach(x=>{(gs[x.grp]=gs[x.grp]||[]).push(x.b||0)});
  let best=null,bd=1e9;
  for(const g in gs){if(gs[g].length>=GROUP_MAX)continue;const avg=gs[g].reduce((a,b)=>a+b,0)/gs[g].length,dd=Math.abs(avg-my);if(dd<bd){bd=dd;best=+g}}
  if(best!=null&&!(bd>=2&&inTier.length>=10))return best;
  const ks=Object.keys(gs).map(Number);return ks.length?Math.max(...ks)+1:0;
}
const MINR=5,TARGET=15;
function clusters(members){
  // من اختار الدوري التجريبي يبقى وحده مع الآليّين، ولا يدخل مجموعات الآخرين
  const solo=members.filter(m=>m.solo).map(m=>({key:"solo-"+m.id,m:[m]}));members=members.filter(m=>!m.solo);
  const units={};members.forEach(m=>{const k=(m.tier||0)*1000+(m.grp||0);(units[k]=units[k]||[]).push(m)});
  const out=[];let cur=null;
  for(const k of Object.keys(units).map(Number).sort((a,b)=>a-b)){
    if(!cur)cur={key:k,m:[]};cur.m.push(...units[k]);
    if(cur.m.length>=MINR){out.push(cur);cur=null}
  }
  if(cur){if(out.length)out[out.length-1].m.push(...cur.m);else out.push(cur)}
  return [...out,...solo];
}
function rngOf(seed){let h=2166136261;for(const c of String(seed))h=Math.imul(h^c.charCodeAt(0),16777619);
  return()=>{h=h+0x6D2B79F5|0;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
const BOTN=["Lena","Jonas","Mia","Paul","Emma","Felix","Hannah","Lukas","Sophie","Elias","Lea","Noah","Marie","Ben","Clara","Finn","Anna","Leon"];
// منافسون آليّون ثابتون طوال الأسبوع: خبرتهم حول متوسط خبرة المجموعة، وتزداد يومًا بعد يوم
function makeBots(w,cl,base,prog){
  const r=rngOf(w+"|"+cl.key),names=[...BOTN];
  for(let i=names.length-1;i>0;i--){const j=r()*(i+1)|0;[names[i],names[j]]=[names[j],names[i]]}
  const out=[],n=Math.max(0,TARGET-cl.m.length),tier=Math.min(...cl.m.map(m=>m.tier||0));
  for(let i=0;i<n;i++){
    const target=base*(.35+r()*1.3),wts=[...Array(7)].map(()=>{const a=r(),b=r();return a<.2?0:.3+b});
    const tot=wts.reduce((a,b)=>a+b,0)||1,days=prog*7;let xp=0;
    for(let d=0;d<7;d++)xp+=target*wts[d]/tot*Math.max(0,Math.min(1,days-d));
    out.push({id:"bot"+i,bot:1,name:names[i],av:"🤖",tier,xp:Math.round(xp)});
  }
  return out;
}
// متوسط خبرة المتعلّمين الحقيقيين في المجموعة خلال الأسبوع السابق، وإلا فقيمة تناسب الدوري
function botBase(cl,prevDocs){
  const ids=new Set(cl.m.map(m=>m.id)),xs=prevDocs.filter(d=>ids.has(d.id)&&d.xp>0).map(d=>d.xp);
  const tier=Math.min(...cl.m.map(m=>m.tier||0));
  return Math.max(50,xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:60+tier*30);
}
// جدول مجموعة متعلّم في أسبوع: الحقيقيون ثم الآليّون مرتّبين بالخبرة
function tableFor(uid,w,docs,prevDocs,prog){
  docs=docs.filter(d=>(d.xp||0)>0);        // من لم يكسب خبرة هذا الأسبوع لا يظهر في الدوري
  const cl=clusters(docs).find(c=>c.m.some(m=>m.id===uid));if(!cl)return [];
  return [...cl.m,...makeBots(w,cl,botBase(cl,prevDocs),prog)].sort((a,b)=>b.xp-a.xp||(a.bot?1:0)-(b.bot?1:0));
}

/* --- تطبيق الأحداث: الهاتف يطبّقها فورًا للعرض، والخادم يطبّقها ويتحقّق منها ويحفظها --- */
// ctx: {server:true|false, admin:bool, words:Set|null}. يعيد true عند القبول، أو سبب الرفض
function applyEv(ev,now,ctx){
  ctx=ctx||{};const T=ev&&ev.type;
  // وقت الحدث: وقت الهاتف، لكن الخادم لا يقبل وقتًا في المستقبل ولا أقدم من أسبوع ولا أقدم من آخر حدث
  const t0=+ev.t||now,t=ctx.server?Math.max(EN.lt||0,Math.min(t0,now)):t0;
  if(ctx.server&&t<now-7*DAY)return "time";
  const r_=applyAt(ev,T,t,ctx);if(r_===true&&ctx.server)EN.lt=t;return r_;
}
function applyAt(ev,T,now,ctx){
  if(T==="rate"){
    const k=String(ev.k||""),r=ev.r|0;if(!(r>=0&&r<=3)||!P[k])return "word";
    const t=now,last=LOG.length?LOG[LOG.length-1][0]:0;
    if(ctx.server&&t<=last+500)return "time";
    const ok=rewarded(P[k],k,t,LOG),b0=P[k].box||0,box=boxStep(b0,r,!ok);
    P[k]={box,due:r===0?t:ok||b0===0?t+IV[box]*DAY:P[k].due,t};LOG.push([t,k,r,ok?0:2]);if(LOG.length>60000)LOG=LOG.slice(-60000);
    if(ok){EN.rc=(EN.rc||0)+1;if(EN.rc%5===0)enAdd(1,t)}      // التدريب لا يشحن الطاقة
    return true;
  }
  if(T==="stStart"){
    if(stTodayAt(now)>=ST_MAX)return "max";if(enAt(now)<ST_COST)return "energy";
    enAdd(-ST_COST,now);STV=now;return true;
  }
  if(T==="stQuit"){if(!STV)return "none";enAdd(ST_COST/2,now);STV=0;return true}
  if(T==="stDone"){
    if(!STV)return "none";if(ctx.server&&now-STV<10000)return "time";
    const ws=[...new Set((ev.words||[]).map(String))].slice(0,ST_WORDS);
    if(!ws.length||ws.some(k=>P[k]||(ctx.words&&!ctx.words.has(k))))return "word";
    const miss=new Set((ev.miss||[]).map(String));
    ws.forEach((k,i)=>{P[k]={box:1,due:now+IV[1]*DAY,t:now+i};LOG.push([now+i,k,miss.has(k)?1:2,1])});
    STN.push([now,ws.length]);STV=0;return true;
  }
  if(T==="quiz"){
    const total=ev.total|0,ok=ev.ok|0,kind=String(ev.kind||"quiz").slice(0,8);
    if(!(total>=1&&total<=300&&ok>=0&&ok<=total))return "bad";
    if(ctx.server){const lq=QLOG.length?QLOG[QLOG.length-1][0]:0;if(now-lq<Math.min(total,20)*800)return "time";
      if(QLOG.filter(q=>dkey(q[0])===dkey(now)).length>=60)return "cap"}
    const q=[now,ok,total,kind];if(ev.ms)q.push(Math.max(0,+ev.ms|0));QLOG.push(q);
    for(const a of (ev.qa||[]).slice(0,300))if(Array.isArray(a))QA.push([now,String(a[0]),a[1]?1:0]);
    if(QA.length>30000)QA=QA.slice(-30000);
    return true;
  }
  if(T==="buy"){
    const it=itemOf(ev.cat,ev.id);if(!it||!it.price&&it.cat!=="power")return "item";
    if(it.cat!=="power"&&owned(it.cat,it.id))return "owned";
    if(!ctx.admin&&it.cat!=="power"&&(it.tier||0)>bestTier())return "locked";
    if(econ().gems<it.price)return "gems";
    BUY.push({id:String(ev.bid||now.toString(36)).slice(0,20),item:it.cat+":"+it.id,p:it.price,ts:now});return true;
  }
  if(T==="reset"){
    const e0=econ();R={bank:e0.earned-giftSum(),ach:[...new Set([...(R.ach||[]),...e0.got])],lv:Math.max(R.lv||1,e0.lv),ts:now};
    // يعود كأنه جديد: بلا خبرة ولا دوري (تبقى جواهره ومشترياته)
    P={};LOG=[];QLOG=[];QA=[];STN=[];STV=0;LG={tier:0,w:LG.w,hist:[],ts:now,v:2,best:0};
    EN={v:EN_MAX,t:now,rc:0,lt:EN.lt||0};   // ويبدأ بطاقة كاملة
    return true;
  }
  return "type";
}
