// ⚠️ ملف مُولَّد تلقائيًا من server/worker.src.js و core.js — لا تعدّله يدويًا
/* ===========================================================
   خادم مفرداتي (Cloudflare Worker)
   يتحقّق من هوية المستخدم، ويطبّق أحداثه (مراجعة، محطة، اختبار، شراء…)
   بالقواعد نفسها التي في التطبيق، ثم يحفظ النتيجة في Firebase.
   المستخدم لا يستطيع الكتابة في تقدّمه أو جواهره أو الدوري إلا عبر هذا الخادم.
   السرّ المطلوب: SA = محتوى ملف مفتاح الخدمة من Firebase (JSON)
   =========================================================== */
const PROJECT = "mufradati-406bd";
const ADMIN = "admin@mufradati.app";
const ORIGINS = ["https://ghadeerabbas.github.io"];
const SITE = "https://ghadeerabbas.github.io/mufradati/";
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

/* ---------- متغيّرات الحالة التي يعمل عليها المنطق المشترك ---------- */
let P = {}, LOG = [], QLOG = [], QA = [], BUY = [], R = { bank: 0, ach: [], lv: 1, ts: 0 },
  LG = { tier: null, w: "", hist: [], ts: 0 }, EN = { v: 30, t: 0 }, STN = [], STV = 0, GIFTS = [], CW = 0;

/* ===========================================================
   منطق مفرداتي المشترك: يعمل في التطبيق وفي الخادم بالكود نفسه
   (الاقتصاد، والمتجر، والطاقة، والمحطات، والدوري، وتطبيق الأحداث)
   يعتمد على متغيّرات عامة: P, LOG, QLOG, QA, BUY, R, LG, EN, STN, STV, GIFTS
   =========================================================== */
const DAY=864e5, IV=[0,1,2,4,7,15,30,60,120];
/* --- إعدادات التطبيق: يغيّرها المشرف من لوحة التحكّم، ويقرؤها التطبيق والخادم معًا --- */
const DEF_CFG={
  xp:{review:[1,2,4,4],stOk:3,stMiss:2,mem:15,solid:40,dayN:20,dayXp:10,quiz:1,level:80},
  duel:{qt:15,gem:1},   // ثواني كل سؤال في التحدي، وجواهر الفائز
  gems:{station:1,level:5,quest:[0,3,0],puzzle:100,pdup:3,streak:[[7,10],[14,15],[30,30],[60,50],[100,75],[200,100],[365,150]],prize:[50,40,30]},
  league:{group:15,promoMin:60,bots:100,up:[10,9,8,7,6,5,4,3,1,0],down:[0,2,3,3,3,4,4,5,5,5]},
  energy:{max:30,minutes:48,stCost:10,refund:5,perReviews:5,game:2,gameMax:3,firstFree:1,drill:5,daily:10,combo:2,comboMax:3},
  station:{words:5,perDay:4,drillReq:1},
  freeze:{price:25,max:3,start:3},
  shop:{},     // تعديل الأغراض: {"cat:id":{price,hidden,tier}}
  items:[]     // أغراض أضافها المشرف: {id,cat,name,val,price,tier,streak,c,c2,badge}
};
let CFG=DEF_CFG;
// «الدراسة الحرّة» للحساب الحالي: طاقة بلا حدود، ومحطات تتجدّد، ولا خبرة ولا جواهر من الدراسة
// يضبطها التطبيق للمستخدم المسجّل، والخادم لكل طلب
let FREEU=false,STMAXU=0;   // STMAXU: عدد محطات هذا المتعلّم اليومية إن حدّده المشرف
// التحقّق من التذكّر لهذا الحساب: يضبطه التطبيق للمستخدم المسجّل، والخادم لكل طلب (مثل FREEU)
let SRSU=false;
const srsOn=t=>!!(SRSU&&CFG.srs&&CFG.srs.on&&t>=CFG.srs.t0);
// النزول الجزئي بعد فشل التحقّق ثم «صعبة»: نصف الصندوق مقرّبًا للأسفل، و1 على الأقل
const vfBox=b=>Math.max(1,Math.floor((b||0)/2));
// أرشيف النزول الدائم R.vf = [[وقت التقييم بالثواني, الكلمة]]: تقرؤه إعادة الحساب (replayLog) فتطابق صناديقُها P، حتى بعد إيقاف الميزة
const vfSet=()=>{const o=new Set;for(const x of Array.isArray(R.vf)?R.vf:[])if(Array.isArray(x))o.add(x[0]+"|"+x[1]);return o};
let XPR,LV_GEMS,STREAK_G,PROMO_MIN,UP_N,DOWN_N,GROUP_MAX,TARGET,EN_MAX,EN_STEP,ST_COST,ST_WORDS,ST_MAX,FZ_MAX,FZ_START;
const _num=(v,d,lo,hi)=>{v=+v;return Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):d};
// يدمج إعدادات المشرف مع الافتراضية ويتحقّق من كل رقم (فلا يكسر خطأٌ التطبيقَ)
function applyCfg(c){
  c=c&&typeof c==="object"?c:{};const D=DEF_CFG,g=(k)=>Object.assign({},D[k],c[k]&&typeof c[k]==="object"?c[k]:{});
  const arr=(a,d,lo,hi)=>Array.isArray(a)&&a.length===d.length?a.map((x,i)=>_num(x,d[i],lo,hi)):d;
  const pairs=(a,d)=>Array.isArray(a)?a.filter(x=>Array.isArray(x)&&x.length===2).map(x=>[_num(x[0],1,1,3650),_num(x[1],0,0,100000)]).sort((x,y)=>x[0]-y[0]).slice(0,30):d;
  const dl=g("duel"),xp=g("xp"),gm=g("gems"),lg=g("league"),en=g("energy"),st=g("station"),fz=g("freeze");
  CFG={
    xp:{review:arr(xp.review,D.xp.review,0,1000),stOk:_num(xp.stOk,3,0,1000),stMiss:_num(xp.stMiss,2,0,1000),mem:_num(xp.mem,15,0,10000),solid:_num(xp.solid,40,0,10000),
      dayN:_num(xp.dayN,20,1,1000),dayXp:_num(xp.dayXp,10,0,10000),quiz:_num(xp.quiz,1,0,1000),level:_num(xp.level,80,1,100000)},
    gems:{station:_num(gm.station,1,0,10000),quest:arr(gm.quest,D.gems.quest,0,1000),puzzle:_num(gm.puzzle,100,0,100000),pdup:_num(gm.pdup,3,0,1000),level:_num(gm.level,5,0,100000),streak:pairs(gm.streak,D.gems.streak),prize:arr(gm.prize,D.gems.prize,0,100000)},
    league:{group:_num(lg.group,15,5,50),promoMin:_num(lg.promoMin,60,0,100000),bots:_num(lg.bots,100,0,300),up:arr(lg.up,D.league.up,0,50),down:arr(lg.down,D.league.down,0,50)},
    energy:{max:_num(en.max,30,1,1000),minutes:_num(en.minutes,48,1,10000),stCost:_num(en.stCost,10,0,1000),refund:_num(en.refund,5,0,1000),perReviews:_num(en.perReviews,5,0,1000),game:_num(en.game,2,0,1000),gameMax:_num(en.gameMax,3,0,100),firstFree:en.firstFree?1:0,drill:_num(en.drill,5,0,1000),combo:_num(en.combo,2,0,100),comboMax:_num(en.comboMax,3,0,50),daily:_num(en.daily,10,0,1000)},
    station:{words:_num(st.words,5,1,20),perDay:_num(st.perDay,4,1,50),drillReq:st.drillReq===0?0:1},
    duel:{qt:_num(dl.qt,15,5,120),gem:_num(dl.gem,1,0,100)},
    freeze:{price:_num(fz.price,25,0,100000),max:_num(fz.max,3,0,50),start:_num(fz.start,3,0,50)},
    shop:c.shop&&typeof c.shop==="object"?c.shop:{},items:Array.isArray(c.items)?c.items.slice(0,300):[],
    free:Array.isArray(c.free)?c.free.filter(x=>typeof x==="string"&&x.length<130).slice(0,500):[],   // حسابات «الدراسة الحرّة» يختارها المشرف
    rd:Array.isArray(c.rd)?c.rd.filter(x=>typeof x==="string"&&x.length<130).slice(0,50):[],   // حسابات لها «القراءة» (يضيفها المشرف تلقائيًا حين يضع لها مجموعة جمل)
    ai:Array.isArray(c.ai)?c.ai.filter(x=>typeof x==="string"&&x.length<130).slice(0,50):[],   // حسابات «مساعد الوظيفة» يختارها المشرف
    off:{all:c.off&&c.off.all?1:0,u:c.off&&Array.isArray(c.off.u)?c.off.u.filter(x=>typeof x==="string"&&x.length<130).slice(0,500):[]},   // «العمل بلا إنترنت»: للجميع أو لمتعلّمين بأعيانهم
    // التحقّق من التذكّر (المرحلة الأولى): مطفأ ما لم يضعه المشرف، ولا يعمل إلا للحسابات في u ولأحداث بعد t0
    srs:(()=>{const x=c.srs&&typeof c.srs==="object"?c.srs:{};return {on:x.on?1:0,t0:_num(x.t0,0,0,1e14),u:Array.isArray(x.u)?x.u.filter(y=>typeof y==="string"&&y.length<130).slice(0,50):[],p:_num(x.p,.15,0,1),max:_num(x.max,5,0,50)}})(),
    stn:c.stn&&typeof c.stn==="object"?Object.fromEntries(Object.entries(c.stn).filter(([k,v])=>k.length<130&&+v>=1&&+v<=20).slice(0,2000).map(([k,v])=>[k,Math.floor(+v)])):{}   // عدد المحطات اليومية لكل متعلّم (وإلا فالافتراضي)
  };
  XPR=CFG.xp.review;LV_GEMS=CFG.gems.level;STREAK_G=CFG.gems.streak;PROMO_MIN=CFG.league.promoMin;UP_N=CFG.league.up;DOWN_N=CFG.league.down;
  GROUP_MAX=TARGET=CFG.league.group;EN_MAX=CFG.energy.max;EN_STEP=CFG.energy.minutes*60000;ST_COST=CFG.energy.stCost;
  ST_WORDS=CFG.station.words;ST_MAX=CFG.station.perDay;FZ_MAX=CFG.freeze.max;FZ_START=CFG.freeze.start;
  if(typeof buildShop==="function")buildShop();if(typeof aiUI==="function")aiUI();EC=null;
}
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
const SHOP_BASE=[
 // الصور الرمزية
 ...[["🎓",0,0],["🦊",200,30],["🐱",200,30],["🦉",300,40],["🐼",300,40],["🐧",300,40],["🦁",500,60],["🐯",500,60],["🤖",650,80],["🧠",650,80],["🚀",800,100],["🐉",1000,120],["🦄",1000,120],["👑",1600,200]]
   .map(([v,p,o],i)=>({id:"av"+i,cat:"avatar",name:"رمز "+["قبعة التخرّج","الثعلب","القطة","البومة","الباندا","البطريق","الأسد","النمر","الروبوت","الدماغ","الصاروخ","التنين","وحيد القرن","التاج"][i],val:v,price:p,old:o})),
 // وجوه مجسّمة (أكتوبر 2026): بالجواهر، وبالمستوى (مع إطارات المستوى)، وبالسلسلة
 ...[["🤫","الصمت",200,1],["😴","النائم",200,2],["😑","الوجه الجامد",300,3],["🤭","الضحكة المكتومة",300,4],["🫢","الدهشة",400,5],["🥰","المحبّ",400,10],["🥺","الرجاء",500,7],["😵‍💫","الدوخة",600,8],["🥸","المتنكّر",800,9]]
   .map(([v,n,p,k])=>({id:"fg"+k,cat:"avatar",name:"رمز "+n,val:v,price:p})),   // fg6 كان 🫣 وانتقل إلى السلسلة، و🥰 انتقل من السلسلة إلى هنا
 ...[["🙂","الابتسامة الخفيفة"],["😊","الوجه البشوش"],["😉","الغمزة"],["😄","الضحكة"],["😋","التلذّذ"],["🤔","المفكّر"],["😆","القهقهة"],["🙃","الوجه المقلوب"],["😈","الشقيّ"]]
   .map(([v,n],i)=>({id:"fl"+(i+1)*5,cat:"avatar",lvl:(i+1)*5,name:"رمز "+n,val:v,price:0})),
 ...[[7,"🫡","التحية"],[14,"😁","الابتسامة العريضة"],[21,"🤗","العناق"],[30,"🤓","المجتهد"],[60,"🧐","المدقّق"],[90,"😇","الملاك"],[100,"😎","النظّارة الشمسية"],[200,"😍","العينين العاشقتين"],[365,"🫣","المختلس النظر","fs365b"]]
   .map(([d,v,n,id])=>({id:id||"fs"+d,cat:"avatar",streak:d,name:"رمز "+n,val:v,price:0})),
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
 // الإطارات الملوّنة العادية: مجانية تنفتح بالمستوى (كل 5 مستويات إطار)، ومن اشتراها قبل ذلك تبقى له
 // old: ثمنها القديم، ليبقى ما دُفع فيها محسوبًا من الجواهر
 {id:"red",cat:"frame",lvl:5,name:"إطار أحمر",price:0,old:75},
 {id:"green",cat:"frame",lvl:10,name:"إطار أخضر",price:0,old:75},
 {id:"blue",cat:"frame",lvl:15,name:"إطار أزرق",price:0,old:75},
 {id:"orange",cat:"frame",lvl:20,name:"إطار برتقالي",price:0,old:100},
 {id:"purple",cat:"frame",lvl:25,name:"إطار بنفسجي",price:0,old:125},
 {id:"pink",cat:"frame",lvl:30,name:"إطار وردي",price:0,old:125},
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
   .map(([v,p,o],i)=>({id:"s"+i,cat:"sticker",name:"ملصق "+["زهرة الكرز","النجمة","المصباح","البرسيم","البالون","القهوة","البيتزا","البريتزل","الهلال","دوّار الشمس","الكمان","القلعة","علم ألمانيا","الفراشة","الكأس","الماسة"][i],val:v,price:p,old:o})),
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
 // مكافآت السلسلة: مجانية، تُفتح بأطول سلسلة وصلها المتعلّم
 {id:"sk7",cat:"frame",streak:7,name:"إطار الجمرة",price:0},
 {id:"sk14",cat:"avatar",streak:14,name:"رمز الشعلة",val:"🔥",price:0},
 {id:"sk21",cat:"namecolor",streak:21,name:"جمري بحافة",price:0,val:"🎨"},
 {id:"sk30",cat:"frame",streak:30,name:"إطار اللهب",price:0},
 {id:"sk60",cat:"avatar",streak:60,name:"رمز المذنّب",val:"☄️",price:0},
 {id:"sk90",cat:"namecolor",streak:90,name:"شمسي بحافة",price:0,val:"🎨"},
 {id:"sk100",cat:"frame",streak:100,name:"إطار الشمس",price:0},
 {id:"sk200",cat:"avatar",streak:200,name:"رمز البركان",val:"🌋",price:0},
 {id:"sk365",cat:"frame",streak:365,name:"إطار الأسطورة",price:0},
 {id:"freeze",cat:"power",name:"تجميد السلسلة",price:25,old:50,val:"❄️",desc:"يحمي سلسلتك يومًا واحدًا إن غبت"},
];
// كل هدايا المتجر تنفتح بالصعود في الدوري (رقم الدوري الذي يفتح كل غرض؛ ما لم يُذكر يكون مفتوحًا)
const NCOL={sk21:1,sk90:1,red:1,green:1,blue:1,orange:1,purple:1,pink:1,teal:1,brown:1,crimson:1,silver:1,gold:1,emerald:1,sapphire:1,admin:1};
const UNLOCK={avatar:{av1:0,av2:0,av3:1,av4:1,av5:1,av6:2,av7:2,av8:3,av9:3,av10:4,av11:5,av12:7,av13:9},
 title:{t1:1,t2:2,t3:3,t4:4,t5:5,t6:7,t7:9},
 theme:{emerald:2,royal:3,ocean:4,sunset:6,lux:8},
 sticker:{s0:0,s1:0,s2:0,s3:1,s4:1,s5:1,s6:2,s7:2,s8:3,s9:3,s10:4,s11:5,s12:5,s13:6,s14:8,s15:9},
 confetti:{stars:1,hearts:2,gems:4,fireworks:6},
 namecolor:{red:0,green:0,blue:0,orange:1,purple:1,pink:2,teal:2,brown:3,silver:4,gold:5,emerald:7,sapphire:9}};
SHOP_BASE.forEach(x=>{const t=(UNLOCK[x.cat]||{})[x.id];if(t!=null)x.tier=t;if(x.cat!=="power")x.price=Math.round(x.price/2)});   // الأسعار نصف ما كانت
let SHOP=[];
const CUSTOM_CATS=["avatar","namecolor","frame"];   // الملصقات والألقاب والسمات أُلغيت (أكتوبر 2026)
const GONE_CATS=["sticker","title","theme"];
const _col=v=>/^#[0-9a-fA-F]{6}$/.test(String(v||""))?String(v):"";
function buildShop(){
  const ov=CFG.shop||{};
  SHOP=SHOP_BASE.map(x=>{const o=ov[x.cat+":"+x.id];if(!o||typeof o!=="object")return {...x};const y={...x};
    if(o.price!=null)y.price=_num(o.price,x.price,0,1000000);if(o.streak&&x.streak)y.streak=_num(o.streak,x.streak,1,3650);if(o.hidden)y.hidden=true;if(o.tier!=null)y.tier=o.tier===""?undefined:_num(o.tier,0,0,9);
    if(x.id==="freeze")y.price=CFG.freeze.price;return y});
  const fz=SHOP.find(x=>x.id==="freeze");if(fz)fz.price=CFG.freeze.price;
  for(const it of CFG.items||[]){
    if(!it||!CUSTOM_CATS.includes(it.cat)||!/^c[a-z0-9]{2,20}$/.test(String(it.id||"")))continue;
    const y={id:it.id,cat:it.cat,custom:1,name:String(it.name||"").slice(0,40)||"غرض",price:_num(it.price,0,0,1000000),
      val:String(it.val||"").slice(0,it.cat==="title"?40:8),c:_col(it.c),c2:_col(it.c2),badge:!!it.badge};
    if(it.tier!=null&&it.tier!=="")y.tier=_num(it.tier,0,0,9);if(it.streak)y.streak=_num(it.streak,0,1,3650);if(it.hidden)y.hidden=true;
    if(y.cat==="avatar"||y.cat==="sticker")y.val=y.val||"⭐";if(y.cat==="title")y.val=y.val||y.name;if(y.cat==="namecolor"){y.val="🎨";NCOL[y.id]=1}
    if(!y.price&&!y.streak)y.price=1;      // الغرض المجاني يكون بالسلسلة فقط
    SHOP.push(y);
  }
  SHOP=SHOP.filter(x=>!GONE_CATS.includes(x.cat));
}
// هدية التجميد من المشرف (مساعدة لمرة واحدة): هدية ملاحظتها تبدأ بـ ❄️، تُحسب تجميدًا لا جواهر
const isFzGift=g=>String(g.note||"").startsWith("❄️");
const isEnGift=g=>String(g.note||"").startsWith("⚡");   // هدية طاقة بلا حدود: g = عدد الدقائق
const isGemGift=g=>!isFzGift(g)&&!isEnGift(g);
const qXp=q=>q[6]?0:q[1]*CFG.xp.quiz*(q[3]==="chal"?2:1);   // التحدي اليومي بخبرة مضاعفة
const giftTs=g=>!g.ts?0:g.ts.toMillis?g.ts.toMillis():g.ts.ms||+g.ts||0;
const CATS={avatar:"الرموز",frame:"الإطارات",namecolor:"ألوان الاسم",confetti:"الاحتفالات",power:"المعزّزات"};
const EQKEY={namecolor:"ncolor",avatar:"avatar",title:"title",theme:"theme",frame:"frame",sticker:"sticker",confetti:"confetti"};
const stkVal=v=>{if(!v)return"";const it=SHOP.find(x=>x.cat==="sticker"&&x.id===v);return it?it.val:v};
const itemOf=(cat,id)=>SHOP.find(x=>x.cat===cat&&x.id===id);
const owned=(cat,id)=>{const it=itemOf(cat,id);return it&&(it.streak?streakBest()>=it.streak:it.lvl?lvlBest()>=it.lvl||BUY.some(b=>b.item===cat+":"+id):it.price===0||BUY.some(b=>b.item===cat+":"+id))};
// أطول سلسلة وصلها (ولا تُقفل مكافآتها بعد التصفير)
const lvlBest=()=>Math.max((EC||econ()).lv,R.lv||1);   // أعلى مستوى وصله (لا ينقص بعد التصفير)
const streakBest=()=>Math.max((EC||econ()).s.best,R.sb||0);
// جواهر السلسلة: مرة واحدة لكل مرحلة

/* ================= الاقتصاد: كل شيء يُحسب من السجلّ ================= */
const GEM=[0,1,2,2];
// خبرة كل تقييم: الكلمة الجديدة في المحطة 3 (أو 2 إن أخطأ فيها)، والمراجعة بحسب التقييم
// علامة السجلّ: 0 مراجعة في موعدها، 1 كلمة جديدة من محطة، 2 تدريب (قبل موعدها أو للمرة الثانية في اليوم) بلا خبرة ولا جواهر
// أعلام السجلّ: 0 مراجعة مكافأة، 1 كلمة محطة، 2 تدريب، 3 مراجعة في الدراسة الحرّة، 4 كلمة محطة في الدراسة الحرّة (3 و4 بلا خبرة)
const xpOf=(r,nw)=>nw>=2?0:nw?(r>=2?CFG.xp.stOk:CFG.xp.stMiss):XPR[r];
const isNewF=x=>x[3]===1||x[3]===4,isRevF=x=>x[3]===0||x[3]===3;
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
// خبرة الانتقال من المستوى l إلى التالي: حتى المستوى 8 تزيد 80 في كل مستوى (80، 160 … 560)،
// وبعده تزيد بعشرة أضعاف رقم المستوى الجديد: للمستوى 9 ‏560+90=650، وللمستوى 10 ‏650+100=750، ثم +110، +120 …
const lvlNeed=l=>{if(l<8)return CFG.xp.level*l;let n=CFG.xp.level*7;for(let k=8;k<=l;k++)n+=10*(k+1);return n};
// أيام سلسلة استعادها المشرف (بعد تصفيرٍ قديم كان يمسح السلسلة): R.sk={t:آخر يوم,n:عددها}
function carryDays(){const o=new Set,k=R.sk;if(!k||!(k.n>0)||!/^\d{4}-\d\d-\d\d$/.test(k.t||""))return o;
  const t=new Date(k.t+"T12:00:00").getTime();for(let i=0;i<Math.min(k.n,3650);i++)o.add(dkey(t-i*DAY));return o}
// أيام أنهى فيها تحدّيًا مع صديق (R.dd): تُحسب في السلسلة كيوم دراسة، بلا خبرة ولا جواهر
// أرشيف دائم (لا يُقصّ): ما يتجاوز حدود السجلّات يُطوى هنا قبل القصّ، فلا تنقص الجواهر ولا السلسلة ولا الألبوم.
// R.dda: أيام التحدّي المطويّة {"2026-11": قناع أيام الشهر}، R.qdg: جواهر صناديق المهام المطويّة، R.dwg: جواهر تحدّيات الأصدقاء المطويّة،
// LG.hg: جوائز الدوري المطويّة، R.pza: قطع البازل {"2026-11": قناع القطع}. كل الطيّ اتحاد أو جمع لما يُحذف فقط، فلا يُحسب شيء مرتين.
const DAYRE=/^\d{4}-\d\d-\d\d$/;
const ddRaw=()=>Array.isArray(R.dd)?R.dd.filter(d=>DAYRE.test(d)):[];
const duelDays=()=>{const o=ddRaw(),A=R.dda&&typeof R.dda==="object"?R.dda:{};
  for(const m in A){const k=+A[m]||0;if(!/^\d{4}-\d\d$/.test(m))continue;for(let i=0;i<31;i++)if(k>>>i&1)o.push(m+"-"+String(i+1).padStart(2,"0"))}return o};
// يقصّ سجلًّا إلى آخر n عنصرًا، ويطوي المحذوف بالدالة fold قبل الحذف
const cutKeep=(a,n,fold)=>{if(a.length<=n)return a;fold(a.slice(0,a.length-n));return a.slice(-n)};
const sumAt=(a,i)=>a.reduce((s,x)=>s+(+x[i]||0),0);
// ===== نقطة حفظ سجلّ المراجعات =====
// السجل LOG محدود الحجم. بدل حذف أوّله، تُطوى الأيام الكاملة القديمة في نقطة حفظ دائمة CK بالدالة نفسها التي يعيد بها econ() الحساب،
// فتبقى الخبرة والمستوى والجواهر والسلسلة والإنجازات ومكافآت الحفظ والرسوخ كما لو كان السجل كاملًا. لا تتغيّر أي قاعدة.
// CK = {v,t: وقت أول حدث بقي في السجل, reviews, xp (خبرة الأحداث ومكافآت الحفظ والرسوخ، بلا مكافأة اليوم),
//       w: {كلمة: صندوقها×4 + 1 إن أخذت مكافأة الحفظ + 2 إن أخذت مكافأة الرسوخ} (رقم واحد لكل كلمة، لصغر الحجم),
//       per: {يوم:[n,bad,clean,f]}, nights/earlies: أيام}
let CK=null;
const LOG_MAX=60000,LOG_KEEP=50000;   // يُطوى عند تجاوز 60000 حتى يبقى نحو 50000 (أيام كاملة)
function ckState(){const c=CK||{},per={};for(const d in c.per||{}){const a=c.per[d];per[d]={n:a[0],bad:a[1],clean:a[2],f:a[3]}}
  const box={},r4=new Set,r7=new Set;for(const k in c.w||{}){const v=c.w[k];box[k]=v>>2;if(v&1)r4.add(k);if(v&2)r7.add(k)}
  return {reviews:c.reviews||0,xp:c.xp||0,box,r4,r7,per,nights:new Set(c.nights||[]),earlies:new Set(c.earlies||[]),bon:[]}}
function replayLog(S,L){const {box,r4,r7,per,bon}=S;const VF=vfSet();
  for(const [t,k,r,nw] of L){
    if(nw===2){box[k]=boxStep(box[k]||0,r,true);continue}      // التدريب لا يُحسب
    S.reviews++;S.xp+=xpOf(r,nw);
    const fr=nw>=3;   // الدراسة الحرّة: تُحفظ الكلمة وتُحسب، بلا خبرة
    let b=nw===1||nw===4?1:r===1&&VF.size&&VF.has(Math.round(t/1000)+"|"+k)?vfBox(box[k]):boxStep(box[k]||0,r,false);box[k]=b;
    if(b>=4&&!r4.has(k)){r4.add(k);if(!fr){S.xp+=CFG.xp.mem;bon.push([t,CFG.xp.mem])}}
    if(b>=7&&!r7.has(k)){r7.add(k);if(!fr){S.xp+=CFG.xp.solid;bon.push([t,CFG.xp.solid])}}
    const d=dkey(t);const x=(per[d]=per[d]||{n:0,bad:0,clean:0,f:0});x.n++;if(fr)x.f++;if(r===0)x.bad++;if(!x.bad)x.clean=x.n;
    const h=hourOf(t);if(h>=23||h<4)S.nights.add(dkey(t-5*36e5));if(h>=4&&h<7)S.earlies.add(d);
  }}
function ckFold(){
  if(LOG.length<=LOG_MAX)return false;
  let L=LOG;for(let i=1;i<L.length;i++)if(L[i][0]<L[i-1][0]){L=[...LOG].sort((a,b)=>a[0]-b[0]);break}
  const cut=dkey(L[L.length-LOG_KEEP][0]);let j=0;while(j<L.length&&dkey(L[j][0])<cut)j++;
  if(!j)return false;
  const S=ckState();replayLog(S,L.slice(0,j));const per={};for(const d in S.per){const x=S.per[d];per[d]=[x.n,x.bad,x.clean,x.f]}
  const w={};for(const k of new Set([...Object.keys(S.box),...S.r4,...S.r7]))w[k]=((S.box[k]||0)<<2)|(S.r4.has(k)?1:0)|(S.r7.has(k)?2:0);
  CK={v:1,t:L[j][0],reviews:S.reviews,xp:S.xp,w,per,nights:[...S.nights],earlies:[...S.earlies]};
  LOG=L.slice(j);if(Array.isArray(R.vf)&&R.vf.length)R.vf=R.vf.filter(x=>Array.isArray(x)&&x[0]*1000>=CK.t-1000);EC=null;return true}
let EC=null;
function econ(){
  const s={reviews:0,mem:0,mast:0,best:0,streak:0,perfect:0,maxDay:0,quizzes:QLOG.length,qfull:0,dayAll:0,night:0,early:0,items:0,freezes:0};const nights=new Set,earlies=new Set;
  let gems=0;
  // الإعادة تبدأ من نقطة الحفظ (إن وُجدت) ثم تكمل بالسجل الحيّ: النتيجة نفسها كما لو كان السجل كاملًا
  const S=ckState(),ckT=CK&&CK.t||0;
  let L=LOG;for(let i=1;i<L.length;i++)if(L[i][0]<L[i-1][0]){L=[...LOG].sort((a,b)=>a[0]-b[0]);break}
  replayLog(S,ckT?L.filter(x=>x[0]>=ckT):L);
  let xp=S.xp;s.reviews=S.reviews;const {r4,r7,per,bon}=S;for(const d of S.nights)nights.add(d);for(const d of S.earlies)earlies.add(d);
  s.mem=r4.size;s.mast=r7.size;s.night=nights.size;s.early=earlies.size;
  for(const d in per){const x=per[d];s.maxDay=Math.max(s.maxDay,x.n);if(x.clean>=20)s.perfect++;
    xp+=(x.n-(x.f||0)>=CFG.xp.dayN?CFG.xp.dayXp:0)}
  for(const q of QLOG){xp+=qXp(q);if(q[2]>=5&&q[1]===q[2])s.qfull++}
  // السلسلة مع التجميد
  const fz=[...BUY.filter(b=>b.item==="power:freeze").map(b=>dkey(b.ts)),...(typeof GIFTS!=="undefined"&&GIFTS?GIFTS:[]).filter(isFzGift).map(g=>dkey(giftTs(g)||Date.now()))].sort();
  const stDays=new Set([...STN.map(x=>dkey(x[0])),...duelDays()]),cd=carryDays(),qd=d=>cd.has(d)||(d<"2026-10-16"?!!per[d]:((per[d]&&per[d].n>=10)||stDays.has(d)));
  const days=[...new Set([...Object.keys(per),...cd,...duelDays()])].sort();let fi=0,avail=FZ_START;          // كل متعلّم يبدأ بـ3 تجميدات
  if(days.length){
    let t=new Date(days[0]+"T12:00:00").getTime(),gap=0,gapUsed=0;const end=today();
    for(;;t+=DAY){const d=dkey(t);while(fi<fz.length&&fz[fi]<=d){avail++;fi++}
      // التجميد يحمي سلسلة طولها 3 أيام فأكثر، ولغياب لا يزيد على يومين متتاليين؛
      // فإن طال الغياب انكسرت السلسلة وعادت إليه التجميدات التي صُرفت في هذا الغياب
      if(qd(d)){s.streak++;gap=0;gapUsed=0}
      else if(d!==end){gap++;
        if(s.streak>=3&&gap<=2&&avail>0){avail--;gapUsed++}
        else{s.streak=0;avail+=gapUsed;gapUsed=0}}
      if(d==="2026-11-14"||d==="2026-11-15")s.g15=Math.max(s.g15||0,s.streak);   // هدية بداية ملصق تشرين الثاني 2026 (انظر monDays)
      s.best=Math.max(s.best,s.streak);if(d>=end)break}
  }
  while(fi<fz.length){avail++;fi++}
  s.freezes=avail;s.today=qd(today());     // هل حُسب اليوم الحالي في السلسلة؟ (تشتعل الشعلة)
  s.items=BUY.filter(b=>!b.item.startsWith("power:")).length;
  // المستوى
  // 5 جواهر لكل مستوى جديد (لا تتكرّر بعد التصفير للمستويات التي أُخذت جوائزها)
  let lv=1,rest=xp;while(rest>=lvlNeed(lv)){rest-=lvlNeed(lv);lv++;if(lv>(R.lv||1))gems+=LV_GEMS}
  const paid=new Set((R.ach||[]).map(x=>OLD_ACH[x]||x)),got=[],alv={};
  for(const a of achList()){const k=achLevel(a,s);alv[a.id]=k;for(let i=1;i<=k;i++)got.push(a.id+":"+i)}
  // الجواهر: جوهرة لكل محطة مكتملة، وجوائز الدوري، ومراحل السلسلة، وهدايا المشرف، وما بقي من قبل التصفير
  gems+=STN.filter(x=>x[2]!==0).length*CFG.gems.station;   // المحطة التي كل كلماتها كوفئ عليها قبل التصفير لا تعطي جوهرة
  for(const [d,g] of STREAK_G)if(s.best>=d&&d>(R.sb||0))gems+=g;
  gems+=R.bank||0;
  gems+=(LG.hist||[]).reduce((a,h)=>a+(h.g||0),0)+(+LG.hg||0);      // جوائز الدوري (مع المطويّ منها)
  gems+=giftSum();                                      // هدايا المشرف
  gems+=(Array.isArray(R.dw)?R.dw:[]).reduce((a,x)=>a+(+x[1]||0),0)+(+R.dwg||0);   // الفوز في تحدّيات الأصدقاء (مع المطويّ منها)
  gems+=(Array.isArray(R.qd)?R.qd:[]).reduce((a,x)=>a+(+x[2]||0),0)+(+R.qdg||0);   // صناديق مهام اليوم (مع المطويّ منها)
  // الملصقات أُلغيت: ما اشتُري منها لا يُحسب من الجواهر، فيعود ثمنه إلى الرصيد (ويبقى في السجلّ لإنجاز «جامع التحف»)
  const spent=BUY.reduce((a,b)=>{const[c,id]=b.item.split(":");if(GONE_CATS.includes(c))return a;const it=itemOf(c,id);return a+(b.p!=null?b.p:it?(it.old!=null?it.old:it.price):0)},0);
  const td=per[today()]||{n:0};
  EC={s,xp,lv,rest,need:lvlNeed(lv),gems:Math.max(0,gems-spent),earned:gems,got:new Set(got),alv,todayN:td.n,per,bon};
  return EC;
}

const giftSum=()=>(typeof GIFTS!=="undefined"&&GIFTS?GIFTS:[]).filter(isGemGift).reduce((a,g)=>a+(g.g||0),0);

/* --- الطاقة: 30 وحدة كحدّ أقصى، تمتلئ في يوم (وحدة كل 48 دقيقة) --- */
const enAt=at=>Math.min(EN_MAX,Math.max(0,(EN.v||0)+Math.floor((at-(EN.t||0))/EN_STEP)));
const enNow=()=>enAt(Date.now());
const enNext=()=>enNow()>=EN_MAX?0:EN_STEP-((Date.now()-(EN.t||0))%EN_STEP);
function enAdd(d,at){const cur=enAt(at),frac=cur>=EN_MAX?0:(at-(EN.t||0))%EN_STEP;EN={v:Math.min(EN_MAX,Math.max(0,cur+d)),t:at-frac,rc:EN.rc||0,lt:EN.lt||0,...(EN.u?{u:EN.u}:{})}}   // u: نهاية الطاقة بلا حدود، يجب أن تبقى (كانت تضيع هنا عند كسب طاقة من المراجعة)
const gamesEnToday=at=>QLOG.filter(q=>q[5]===1&&dkey(q[0])===dkey(at)).length;
const stTodayAt=at=>STN.filter(x=>dkey(x[0])===dkey(at)).length;
const stMax=()=>STMAXU||ST_MAX;
const stMaxHit=at=>!FREEU&&stTodayAt(at)>=stMax();   // في الدراسة الحرّة تتجدّد المحطات بلا حدّ يومي
// المحطة التدريبية: مطابقة كلمات المحطة بعد إكمالها، واحدة لكل محطة مكتملة في اليوم
const drillsTodayAt=at=>QLOG.filter(q=>q[3]==="drill"&&dkey(q[0])===dkey(at)).length;
// كلفة المحطة: أول محطة في اليوم مجانية (إن فعّلها المشرف)
const unlAt=at=>!!(EN.u&&at<EN.u);   // هدية الطاقة بلا حدود سارية
const chalDoneAt=at=>QLOG.some(q=>q[3]==="chal"&&dkey(q[0])===dkey(at));
const chalOpenAt=at=>!FREEU&&stTodayAt(at)>=stMax()&&drillsTodayAt(at)>=stTodayAt(at)&&!chalDoneAt(at);
const stCostAt=at=>FREEU||unlAt(at)?0:CFG.energy.firstFree&&stTodayAt(at)===0?0:ST_COST;

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
// خبرة الأسبوع: من المراجعات والاختبارات والتمارين في هذا الأسبوع
function weekXP(ws){
  const we=ws+7*DAY,per={};let xp=0;
  // السجلّ مرتّب زمنيًا: نقرأ من آخره حتى بداية الأسبوع فقط
  for(let i=LOG.length-1;i>=0;i--){const x=LOG[i];if(x[0]<ws-DAY)break;if(x[0]>=ws&&x[0]<we&&x[3]<2){xp+=xpOf(x[2],x[3]);const d=dkey(x[0]);per[d]=(per[d]||0)+1}}
  for(const d in per)if(per[d]>=CFG.xp.dayN)xp+=CFG.xp.dayXp;
  for(const q of QLOG)if(q[0]>=ws&&q[0]<we)xp+=qXp(q);
  // مكافآت الكلمات التي حُفظت أو رسخت هذا الأسبوع: هي جزء من خبرة الدرس، فتُحسب في الدوري كما تُحسب في النتيجة
  for(const [t,v] of (EC||econ()).bon||[])if(t>=ws&&t<we)xp+=v;
  return xp;
}
// عدد المتقدّمين والمتراجعين في كل دوري (من الأول إلى العاشر)
function zones(n,tier){
  tier=Math.max(0,Math.min(9,tier||0));const up=Math.min(UP_N[tier],n),down=Math.min(DOWN_N[tier],Math.max(0,n-up));
  return {up,down};
}
const prizeOf=(realRank,xp)=>xp<PROMO_MIN?0:(CFG.gems.prize[realRank-1]||0);
// يختار مجموعة من نفس الدوري متقاربة في المقياس، وينشئ مجموعة جديدة إن امتلأت أو ابتعدت
function chooseGroupFrom(docs,tier,my){
  const gs={},inTier=docs.filter(d=>(d.tier||0)===tier);
  inTier.forEach(x=>{(gs[x.grp]=gs[x.grp]||[]).push(x.b||0)});
  let best=null,bd=1e9;
  for(const g in gs){if(gs[g].length>=GROUP_MAX)continue;const avg=gs[g].reduce((a,b)=>a+b,0)/gs[g].length,dd=Math.abs(avg-my);if(dd<bd){bd=dd;best=+g}}
  if(best!=null&&!(bd>=2&&inTier.length>=10))return best;
  const ks=Object.keys(gs).map(Number);return ks.length?Math.max(...ks)+1:0;
}
const MINR=5;
function clusters(members){
  // من اختار الدوري التجريبي يبقى وحده مع الآليّين، ولا يدخل مجموعات الآخرين
  const solo=members.filter(m=>m.solo).map(m=>({key:"solo-"+m.id,m:[m]}));members=members.filter(m=>!m.solo);
  // لا يجتمع إلا من في الدوري نفسه. يُقسَّم متعلّمو كل دوري على أقل عدد من المجموعات (حجمها TARGET)
  // بالتساوي تقريبًا، ثم يُكمَّل كل منها بالآليّين: 50 متعلّمًا ← 4 مجموعات من 12 أو 13
  const byT={};members.forEach(m=>{const t=m.tier||0;(byT[t]=byT[t]||[]).push(m)});
  const out=[];
  for(const t of Object.keys(byT).map(Number).sort((a,b)=>a-b)){
    const arr=byT[t].sort((a,b)=>(a.grp||0)-(b.grp||0)||(a.id<b.id?-1:a.id>b.id?1:0));   // المتقاربون في المقياس معًا
    const g=Math.max(1,Math.ceil(arr.length/TARGET)),base=Math.floor(arr.length/g),extra=arr.length%g;
    let i=0;for(let j=0;j<g;j++){const n=base+(j<extra?1:0);out.push({key:t*1000+j,m:arr.slice(i,i+n)});i+=n}
  }
  return [...out,...solo];
}
function rngOf(seed){let h=2166136261;for(const c of String(seed))h=Math.imul(h^c.charCodeAt(0),16777619);
  return()=>{h=h+0x6D2B79F5|0;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
const BOTN=["Lena","Jonas","Mia","Paul","Emma","Felix","Hannah","Lukas","Sophie","Elias","Lea","Noah","Marie","Ben","Clara","Finn","Anna","Leon"];
// منافسون آليّون ثابتون طوال الأسبوع: هدف كلٍّ منهم بين 20% و100% من متوسط خبرة المجموعة، مضروبًا في «قوة الروبوتات» من لوحة المدير (CFG.league.bots٪)، ويزداد يومًا بعد يوم
// ولكل منافس حدّ أدنى ثابت طوال الأسبوع بين BOT_MIN[0] وBOT_MIN[1] خبرة، فلا يظهر أحد بصفر. مولّده منفصل، فلا تتغيّر الأسماء ولا الأهداف.
// الحدّ ≤ 15، وعند التساوي يتقدّم المتعلّم (tableFor)، فلا يتأخر بسببه من جمع 15 خبرة أو أكثر. لا يُطبَّق إن كانت قوة الروبوتات 0.
const BOT_MIN=[5,15];
function makeBots(w,cl,base,prog){
  const r=rngOf(w+"|"+cl.key),fl=rngOf(w+"|"+cl.key+"|min"),names=[...BOTN],on=(CFG.league.bots??100)>0;
  for(let i=names.length-1;i>0;i--){const j=r()*(i+1)|0;[names[i],names[j]]=[names[j],names[i]]}
  const out=[],n=Math.max(0,TARGET-cl.m.length),tier=Math.min(...cl.m.map(m=>m.tier||0));
  for(let i=0;i<n;i++){
    const target=base*(.2+r()*.8)*(CFG.league.bots??100)/100,wts=[...Array(7)].map(()=>{const a=r(),b=r();return a<.2?0:.3+b});
    const tot=wts.reduce((a,b)=>a+b,0)||1,days=prog*7;let xp=0;
    for(let d=0;d<7;d++)xp+=target*wts[d]/tot*Math.max(0,Math.min(1,days-d));
    const mn=BOT_MIN[0]+Math.round(fl()*(BOT_MIN[1]-BOT_MIN[0]));
    out.push({id:"bot"+i,bot:1,name:names[i],av:"🤖",tier,xp:on?Math.max(Math.round(xp),mn):Math.round(xp)});
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
/* مهام اليوم: تُحسب من سجلّ اليوم نفسه، ولكل مهمة مكتملة صندوق جواهر يُفتح مرة واحدة في اليوم */
// المحطة تُحسب مكتملة في المهام مع تدريبها: محطات اليوم بالترتيب، والمحطة رقم j مكتملة إن أُنهي j+1 تدريب في اليوم
const drillsOn=d=>QLOG.filter(q=>q[3]==="drill"&&dkey(q[0])===d).length;
// كلمات المحطة: الكلمات الجديدة المسجّلة مع المحطة نفسها. الخادم يحفظ أوقات السجلّ بالثواني (مقرّبة)، فنبحث في ثانية قبل وقت المحطة وبعده؛
// والمحطتان لا تقتربان أقل من 10 ثوانٍ، والمراجعات ليست كلمات جديدة، فلا يدخل في النافذة إلا كلمات هذه المحطة
const ST_WIN=1000;
function stPerfectAt(d){   // محطات اليوم المكتملة مع تدريبها التي لم يُخطأ فيها في أي كلمة
  const ss=STN.filter(s=>dkey(s[0])===d).sort((a,b)=>a[0]-b[0]).slice(0,drillsOn(d));if(!ss.length)return 0;
  const lo=ss[0][0]-ST_WIN,hi=ss[ss.length-1][0]+ST_WIN+50,lg=LOG.filter(x=>x[0]>=lo&&x[0]<hi&&isNewF(x));   // لا نقيّد السجلّ باليوم: محطة قبل منتصف الليل بلحظة قد تُقرَّب كلماتها إلى اليوم التالي
  return ss.filter(s=>{const e=lg.filter(x=>x[0]>=s[0]-ST_WIN&&x[0]<s[0]+ST_WIN+(s[1]||5));return e.length&&e.every(x=>x[2]===2)}).length;
}
/* ملصق الشهر: يُكسب بإكمال محطة مع تدريبها في (أيام الشهر − 7) يومًا من ذلك الشهر (30 يومًا ← 23، وشباط 28 ← 21) */
const MON_AR=["كانون الثاني","شباط","آذار","نيسان","أيار","حزيران","تموز","آب","أيلول","تشرين الأول","تشرين الثاني","كانون الأول"];
const MON_IC=["⛄","💝","🌷","🐣","🌼","🍓","🍉","⛵","🍎","🍁","🍂","❄️"];
const monNeed=m=>{const[y,mo]=m.split("-").map(Number);return new Date(y,mo,0).getDate()-7};
function monDays(){const o={};for(const q of QLOG)if(q[3]==="drill"){const d=dkey(q[0]),m=d.slice(0,7);(o[m]=o[m]||new Set).add(d)}
  // أول ملصق (تشرين الثاني 2026) بدأ في منتصف الشهر: من كانت سلسلته 15 يومًا فأكثر يوم 15 تُحسب له أيام 1–15 كلها
  if(((EC||econ()).s.g15||0)>=15){const s=o["2026-11"]=o["2026-11"]||new Set;for(let i=1;i<=15;i++)s.add("2026-11-"+String(i).padStart(2,"0"))}
  return Object.fromEntries(Object.entries(o).map(([m,s])=>[m,s.size]))}
function monStat(m,md){md=md||monDays();const mo=+m.slice(5,7)-1,n=md[m]||0,need=monNeed(m);return {m,n:Math.min(n,need),need,ok:n>=need,name:MON_AR[mo]+" "+m.slice(0,4),ic:MON_IC[mo]}}
const QUESTS=[
  {id:"st1",n:"أكمل محطة مع تدريبها",goal:1,f:drillsOn},
  {id:"rv15",n:"راجع 15 كلمة",goal:15,f:d=>LOG.filter(x=>!isNewF(x)&&dkey(x[0])===d).length},
  {id:"perf",n:"أكمل محطة بلا أي خطأ مع تدريبها",goal:1,f:stPerfectAt,pz:1}
];
/* بازل الشهر: 9 قطع (3×3)، وجائزة مهمة «بلا أي خطأ» قطعة منها. اكتمالها في الشهر = 100 جوهرة، والقطعة المكررة = 3 جواهر.
   كل قطعة جديدة باحتمال 50%، ومن تكرّرت له 11 قطعة في الشهر تأتيه بعدها قطع جديدة فقط: فمن أكمل المهمة 20 يومًا جمعها كلها حتمًا.
   القطع بأوزان مختلفة (الأخيرة أندر)، والسحب محدّد بالتاريخ وعدد مرات الشهر، فيحسبه التطبيق والخادم بالنتيجة نفسها */
const PZ_W=[10,10,10,10,8,6,6,4,3],PZ_N=PZ_W.length;
const hrand=s=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0)/4294967296};
// ألبوم البازل الدائم R.pza: القطع = اتحاد الألبوم وسجلّ المطالبات R.pz؛ وعدد المطالبات (للسحب) من R.pz وحده، والشهر الحالي لا يُقصّ منه شيء
function pzMonth(m){const L=(Array.isArray(R.pz)?R.pz:[]).filter(x=>String(x[0]).slice(0,7)===m),have=new Set(L.map(x=>x[1]).filter(x=>x>=0));
  const k=R.pza&&+R.pza[m]||0;for(let i=0;i<PZ_N;i++)if(k>>i&1)have.add(i);return {claims:L.length,have}}
// يطوي كل قطع R.pz في الألبوم (اتحاد، فتكراره آمن). يُستدعى مع كل قطعة، قبل أي قصّ لـR.pz
function pzFold(){const A=R.pza&&typeof R.pza==="object"?{...R.pza}:{};
  for(const [d,p] of Array.isArray(R.pz)?R.pz:[])if(p>=0&&p<PZ_N){const m=String(d).slice(0,7);A[m]=(+A[m]||0)|1<<p}R.pza=A}
const qdFold=cut=>{R.qdg=(+R.qdg||0)+sumAt(cut,2)};
// جائزة أسبوع الدوري (يستعملها الخادم): يبقى آخر 52 أسبوعًا، وجوائز ما قبلها تُطوى في LG.hg فلا تنقص الجواهر
function lgPush(h){LG.hist=cutKeep([...(LG.hist||[]),h],52,cut=>{LG.hg=(+LG.hg||0)+sumAt(cut.map(x=>[x&&x.g]),0)})}
function pzDraw(d){
  const {claims,have}=pzMonth(d.slice(0,7)),miss=PZ_W.map((_,i)=>i).filter(i=>!have.has(i));if(!miss.length)return -1;
  let pool=hrand(d+":"+claims)<.5||claims-have.size>=20-PZ_N?miss:[...have];if(!pool.length)pool=miss;
  let x=hrand(d+":"+claims+":p")*pool.reduce((a,i)=>a+PZ_W[i],0);for(const i of pool){x-=PZ_W[i];if(x<0)return i}return pool[pool.length-1];
}
const questGot=(d,id)=>(Array.isArray(R.qd)?R.qd:[]).some(x=>x[0]===d&&x[1]===id);
function applyEv(ev,now,ctx){
  ctx=ctx||{};const T=ev&&ev.type;
  // وقت الحدث: وقت الهاتف، لكن الخادم لا يقبل وقتًا في المستقبل ولا أقدم من أسبوع ولا أقدم من آخر حدث
  const t0=+ev.t||now,t=ctx.server?Math.max(EN.lt||0,Math.min(t0,now)):t0;
  if(ctx.server&&t<now-7*DAY)return "time";
  const r_=applyAt(ev,T,t,ctx);if(r_===true&&ctx.server)EN.lt=t;return r_;
}
function applyAt(ev,T,now,ctx){
  // هدية الطاقة اليومية: مرة واحدة لكل يوم جديد (R.eg = آخر يوم أُخذت فيه)، بالكمية التي يحدّدها المشرف
  if(T==="eday"){
    if(FREEU)return "free";if(!CFG.energy.daily)return "off";
    const d=dkey(now);if(R.eg===d)return "dup";R.eg=d;enAdd(CFG.energy.daily,now);return true;
  }
  if(T==="rate"){
    const k=String(ev.k||""),r=ev.r|0;if(!(r>=0&&r<=3)||!P[k])return "word";
    const t=now,last=LOG.length?LOG[LOG.length-1][0]:0;
    if(ctx.server&&t<=last+500)return "time";
    // v=-1: فشل التحقّق من التذكّر قبل التقييم (لا يُقبل معه إلا «نسيت» أو «صعبة»). يُتجاهل إن لم تكن الميزة مفعّلة لهذا الحساب أو كان الحدث قبل t0
    // تنبيه: v=-1 مؤشّر يرسله التطبيق عن جواب المتعلّم في سؤال الاختيار، لا إثبات يتحقّق منه الخادم بنفسه (الخادم لا يرى السؤال ولا الجواب).
    // لذلك لا يمنح أي مكافأة، وأقصى أثره نزول جزئي يختاره المتعلّم بـ«صعبة»؛ والخادم يفرض فقط اتّساقه (لا «عرفتها» ولا «سهلة» معه) وأنه مرة واحدة في المراجعة المحسوبة.
    const vOn=ev.v===-1&&srsOn(t);if(vOn&&r>1)return "verify";
    const ok=rewarded(P[k],k,t,LOG),b0=P[k].box||0,vf=vOn&&ok&&r===1,box=vf?vfBox(b0):boxStep(b0,r,!ok);   // النزول الجزئي في المراجعة المحسوبة وحدها، مرة واحدة
    P[k]={box,due:r===0?t:ok||b0===0?t+IV[box]*DAY:P[k].due,t};LOG.push([t,k,r,ok?(FREEU?3:0):2]);
    if(vf){R.vf=Array.isArray(R.vf)?R.vf:[];R.vf.push([Math.round(t/1000),k])}
    ckFold();
    if(ok&&!FREEU&&CFG.energy.perReviews){EN.rc=(EN.rc||0)+1;if(EN.rc%CFG.energy.perReviews===0)enAdd(1,t)}      // التدريب لا يشحن الطاقة
    return true;
  }
  if(T==="stStart"){
    const cost=stCostAt(now);if(stMaxHit(now))return "max";
    if(CFG.station.drillReq&&drillsTodayAt(now)<stTodayAt(now))return "drill";   // التدريب بعد كل محطة شرط لفتح التالية
    if(enAt(now)<cost)return "energy";
    if(cost)enAdd(-cost,now);STV=now;return true;
  }
  if(T==="stQuit"){if(!STV)return "none";if(stCostAt(STV)&&!FREEU)enAdd(CFG.energy.refund,now);STV=0;return true}   // المحطة المجانية لا يُستعاد منها شيء
  if(T==="stDone"){
    if(!STV)return "none";if(ctx.server&&now-STV<10000)return "time";
    const ws=[...new Set((ev.words||[]).map(String))].slice(0,ST_WORDS);
    if(!ws.length||ws.some(k=>P[k]||(ctx.words&&!ctx.words.has(k))))return "word";
    const miss=new Set((ev.miss||[]).map(String));
    const pw=new Set(R.pw||[]);   // كلمة كوفئ عليها قبل التصفير: تُعلَّم 4 فلا خبرة لها مرة ثانية
    ws.forEach((k,i)=>{P[k]={box:1,due:now+IV[1]*DAY,t:now+i};LOG.push([now+i,k,miss.has(k)?1:2,FREEU||pw.has(k)?4:1])});ckFold();STN.push([now,ws.length,!FREEU&&ws.some(k=>!pw.has(k))?1:0]);STV=0;return true;   // الدراسة الحرّة بلا جوهرة
  }
  if(T==="quiz"){
    const total=ev.total|0,ok=ev.ok|0,kind=String(ev.kind||"quiz").slice(0,8);
    if(!(total>=1&&total<=300&&ok>=0&&ok<=total))return "bad";
    if(ctx.server){const lq=QLOG.length?QLOG[QLOG.length-1][0]:0;if(now-lq<Math.min(total,20)*800)return "time";
      if(QLOG.filter(q=>dkey(q[0])===dkey(now)).length>=60)return "cap"}
    if(kind==="chal"){if(total>12)return "bad";if(!chalOpenAt(now))return "lock"}   // التحدي: بعد آخر محطة وتدريبها، مرة في اليوم، بلا طاقة
    if(kind==="drill"){if(total>ST_WORDS)return "bad";if(drillsTodayAt(now)>=stTodayAt(now))return "none";if(!FREEU&&!unlAt(now)){if(enAt(now)<CFG.energy.drill)return "energy";if(CFG.energy.drill)enAdd(-CFG.energy.drill,now)}}
    const q=[now,ok,total,kind,Math.max(0,+ev.ms|0)];
    // طاقة التمارين: لكل تمرين أكمله حتى آخره، بحدّ أقصى في اليوم (الاختبار لا يعطي طاقة)
    if(ev.full&&!FREEU&&kind!=="quiz"&&kind!=="chal"&&CFG.energy.game&&gamesEnToday(now)<CFG.energy.gameMax){enAdd(CFG.energy.game,now);q.push(1)}
    if(FREEU){while(q.length<6)q.push(0);q.push(1)}   // q[6]=1: بلا خبرة
    QLOG.push(q);
    for(const a of (ev.qa||[]).slice(0,300))if(Array.isArray(a))QA.push([now,String(a[0]),a[1]?1:0]);
    if(QA.length>30000)QA=QA.slice(-30000);
    return true;
  }
  // تحدٍّ أنهاه مع صديق: ينشّط سلسلة ذلك اليوم (الخادم يتحقّق أنه أنهى أسئلة التحدي فعلًا)
  // الفوز في تحدٍّ مع الأصدقاء: جواهر مرة واحدة لكل تحدٍّ (الخادم يتحقّق أنه الفائز الوحيد بالمركز الأول)
  if(T==="dwin"){
    if(ctx.server&&!ctx.dwinOk)return "dwin";const id=String(ev.id||"");if(!/^[A-Za-z0-9_-]{4,40}$/.test(id))return "id";
    if(!CFG.duel.gem)return "off";R.dw=Array.isArray(R.dw)?R.dw:[];if(R.dw.some(x=>x[0]===id))return "dup";
    R.dw.push([id,CFG.duel.gem]);R.dw=cutKeep(R.dw,2000,cut=>{R.dwg=(+R.dwg||0)+sumAt(cut,1)});return true;
  }
  if(T==="duel"){
    if(ctx.server&&!ctx.duelOk)return "duel";
    const d=dkey(now);R.dd=ddRaw().filter(x=>x!==d);R.dd.push(d);
    R.dd=cutKeep(R.dd,400,cut=>{const A=R.dda&&typeof R.dda==="object"?{...R.dda}:{};for(const x of cut){const m=x.slice(0,7);A[m]=((+A[m]||0)|1<<(+x.slice(8,10)-1))>>>0}R.dda=A});return true;
  }
  if(T==="buy"){
    const it=itemOf(ev.cat,ev.id);if(!it||it.hidden||it.streak||!it.price&&it.cat!=="power")return "item";
    if(it.cat!=="power"&&owned(it.cat,it.id))return "owned";
    if(it.id==="freeze"&&econ().s.freezes>=FZ_MAX)return "max";
    if(!ctx.admin&&it.cat!=="power"&&(it.tier||0)>bestTier())return "locked";
    if(econ().gems<it.price)return "gems";
    BUY.push({id:String(ev.bid||now.toString(36)).slice(0,20),item:it.cat+":"+it.id,p:it.price,ts:now});return true;
  }
  // تفعيل هدية الطاقة بلا حدود: يبدأ وقتها عند استلامها، ولكل هدية مرة واحدة
  if(T==="unl"){
    const id=String(ev.id||""),g=(typeof GIFTS!=="undefined"&&GIFTS?GIFTS:[]).find(x=>x.id===id&&isEnGift(x));if(!g)return "gift";
    R.ug=R.ug||[];if(R.ug.includes(id))return "used";
    R.ug.push(id);if(R.ug.length>300)R.ug=R.ug.slice(-300);
    EN.u=Math.max(EN.u||0,now)+Math.min(Math.max(g.g|0,1),7*1440)*60000;return true;
  }
  // صندوق مهمة مكتملة من مهام اليوم
  if(T==="quest"){
    if(FREEU)return "free";const i=QUESTS.findIndex(q=>q.id===ev.id),d=dkey(now);if(i<0)return "id";
    if(QUESTS[i].pz){if(QUESTS[i].f(d)<QUESTS[i].goal)return "notyet";if(questGot(d,ev.id))return "dup";
      const m=d.slice(0,7),p=pzDraw(d),had=pzMonth(m).have;R.pz=Array.isArray(R.pz)?R.pz:[];R.pz.push([d,p]);pzFold();if(R.pz.length>800)R.pz=R.pz.slice(-800);
      const g=p<0||had.has(p)?CFG.gems.pdup:had.size===PZ_N-1?CFG.gems.puzzle:0;
      R.qd=Array.isArray(R.qd)?R.qd:[];R.qd.push([d,ev.id,g]);R.qd=cutKeep(R.qd,600,qdFold);return true}
    const g=CFG.gems.quest[i]||0;if(!g)return "off";if(QUESTS[i].f(d)<QUESTS[i].goal)return "notyet";if(questGot(d,ev.id))return "dup";
    R.qd=Array.isArray(R.qd)?R.qd:[];R.qd.push([d,ev.id,g]);R.qd=cutKeep(R.qd,600,qdFold);return true;
  }
  // طاقة الإجابات المتتالية: كل 5 إجابات صحيحة متتالية في الدرس، بحدّ أقصى في اليوم
  if(T==="combo"){
    if(FREEU||unlAt(now))return "free";const c=CFG.energy.combo,m=CFG.energy.comboMax;if(!c||!m)return "off";
    const d=dkey(now),cb=Array.isArray(R.cb)&&R.cb[0]===d?R.cb:[d,0,0];
    if(cb[1]>=m)return "cap";if(ctx.server&&now-cb[2]<10000)return "time";if(enAt(now)>=EN_MAX)return "full";
    R.cb=[d,cb[1]+1,now];enAdd(c,now);return true;
  }
  if(T==="reset"){
    // تصفير الكلمات فقط: تعود كل الكلمات جديدة، وتبقى السلسلة والخبرة (المستوى) والدوري والجواهر والمشتريات والإنجازات
    // pw: كلمات تعلّمها من قبل؛ إن أعاد تعلّمها في محطة فلا خبرة لها مرة ثانية
    R={...R,pw:[...new Set([...(R.pw||[]),...Object.keys(P)])],ts:now};
    P={};QA=[];STV=0;
    return true;
  }
  return "type";
}

applyCfg(null);

const CORE_V = "f02599b3d0";

/* ---------- ضغط السجلّات (الصيغة نفسها التي في التطبيق) ---------- */
function packLog(L) { const K = [], ix = {}, F = []; let p = 0; for (const [t, k, r, n] of L) { if (ix[k] === undefined) { ix[k] = K.length; K.push(k) } const s = Math.round(t / 1000); F.push(s - p, ix[k], r, n); p = s } return { K, F } }
function unpackLog(o) { if (!o) return []; if (Array.isArray(o)) return o; const L = []; let p = 0; for (let i = 0; i < o.F.length; i += 4) { p += o.F[i]; L.push([p * 1000, o.K[o.F[i + 1]], o.F[i + 2], o.F[i + 3]]) } return L }
function packQA(L) { const K = [], ix = {}, F = []; let p = 0; for (const [t, k, ok] of L) { if (ix[k] === undefined) { ix[k] = K.length; K.push(k) } const s = Math.round(t / 1000); F.push(s - p, ix[k], ok); p = s } return { K, F } }
function unpackQA(o) { if (!o) return []; if (Array.isArray(o)) return o; const L = []; let p = 0; for (let i = 0; i < o.F.length; i += 3) { p += o.F[i]; L.push([p * 1000, o.K[o.F[i + 1]], o.F[i + 2]]) } return L }

/* ---------- أدوات التشفير ---------- */
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64uStr = s => b64u(new TextEncoder().encode(s));
const fromB64u = s => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)) };

/* ---------- التحقق من هوية مستخدم Firebase ---------- */
let JWKS = { at: 0, keys: [] };
async function verifyIdToken(tok) {
  const [h, p, sig] = String(tok || "").split(".");
  if (!sig) throw new Error("token");
  const head = JSON.parse(new TextDecoder().decode(fromB64u(h))), pay = JSON.parse(new TextDecoder().decode(fromB64u(p)));
  if (Date.now() - JWKS.at > 3600e3 || !JWKS.keys.find(k => k.kid === head.kid)) {
    // تعذّر جلب مفاتيح Google عطل مؤقت لا رمز خاطئ: يُميَّز حتى يردّ الخادم 503 (فيعيد التطبيق المحاولة) لا 401 («أعد تسجيل الدخول»)
    try { const r = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"); if (!r.ok) throw 0; JWKS = { at: Date.now(), keys: (await r.json()).keys || [] } }
    catch (e) { const x = new Error("jwks unavailable"); x.transient = true; throw x }
  }
  const jwk = JWKS.keys.find(k => k.kid === head.kid);
  if (!jwk || head.alg !== "RS256") throw new Error("key");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, fromB64u(sig), new TextEncoder().encode(h + "." + p));
  const now = Date.now() / 1000;
  if (!ok || pay.aud !== PROJECT || pay.iss !== "https://securetoken.google.com/" + PROJECT || pay.exp < now || !pay.sub) throw new Error("token");
  return { uid: pay.sub, email: String(pay.email || "").toLowerCase() };
}

/* ---------- رمز الدخول إلى Firestore بمفتاح الخدمة ---------- */
let GTOKEN = { at: 0, v: "" };
async function googleToken(env) {
  if (GTOKEN.v && Date.now() - GTOKEN.at < 50 * 60e3) return GTOKEN.v;
  const sa = JSON.parse(env.SA), now = Math.floor(Date.now() / 1000);
  const head = b64uStr(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64uStr(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const key = await crypto.subtle.importKey("pkcs8", fromB64u(pem.replace(/\+/g, "-").replace(/\//g, "_")), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = b64u(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(head + "." + body)));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + head + "." + body + "." + sig });
  const j = await r.json();
  if (!j.access_token) throw new Error("google auth: " + JSON.stringify(j).slice(0, 200));
  GTOKEN = { at: Date.now(), v: j.access_token };
  return GTOKEN.v;
}

/* ---------- Firestore عبر REST ---------- */
function enc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v && v.__ts) return { timestampValue: new Date(v.__ts).toISOString() };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  const fields = {}; for (const k in v) if (v[k] !== undefined) fields[k] = enc(v[k]); return { mapValue: { fields } };
}
function dec(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return { ms: Date.parse(v.timestampValue) };
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(dec);
  if ("mapValue" in v) { const o = {}; for (const k in v.mapValue.fields || {}) o[k] = dec(v.mapValue.fields[k]); return o }
  return null;
}
const docData = d => { const o = {}; for (const k in d.fields || {}) o[k] = dec(d.fields[k]); return o };
function makeFS(env) {
  const H = async () => ({ Authorization: "Bearer " + await googleToken(env), "Content-Type": "application/json" });
  return {
    async get(path) {
      const r = await fetch(FS_BASE + "/" + path, { headers: await H() });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("fs get " + r.status);
      const d = await r.json(); return { data: docData(d), updateTime: d.updateTime };
    },
    async where(coll, field, val) {   // أول وثيقة قيمة حقلها تساوي val (يعيد معرّفها)
      const r = await fetch(FS_BASE + ":runQuery", { method: "POST", headers: await H(), body: JSON.stringify({ structuredQuery: { from: [{ collectionId: coll }], where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: enc(val) } }, limit: 1 } }) });
      if (!r.ok) throw new Error("fs where " + r.status);
      const x = (await r.json()).find(y => y.document); return x ? x.document.name.split("/").pop() : "";
    },
    async many(paths) {   // قراءة عدة وثائق بطلب واحد
      if (!paths.length) return {};
      const r = await fetch(FS_BASE + ":batchGet", { method: "POST", headers: await H(), body: JSON.stringify({ documents: paths.map(p => `projects/${PROJECT}/databases/(default)/documents/${p}`) }) });
      if (!r.ok) throw new Error("fs many " + r.status);
      const out = {}; for (const x of await r.json()) if (x.found) out[x.found.name.split("/documents/")[1]] = docData(x.found); return out;
    },
    async list(coll) {
      const out = []; let tok = "";
      do {
        const r = await fetch(FS_BASE + "/" + coll + "?pageSize=300" + (tok ? "&pageToken=" + tok : ""), { headers: await H() });
        if (!r.ok) throw new Error("fs list " + r.status);
        const j = await r.json(); for (const d of j.documents || []) out.push({ id: d.name.split("/").pop(), ...docData(d) }); tok = j.nextPageToken || "";
      } while (tok);
      return out;
    },
    async page(coll, orderBy, n, tok) {
      const r = await fetch(FS_BASE + "/" + coll + "?pageSize=" + n + "&orderBy=" + encodeURIComponent(orderBy) + (tok ? "&pageToken=" + encodeURIComponent(tok) : ""), { headers: await H() });
      if (!r.ok) throw new Error("fs page " + r.status);
      const j = await r.json(); return { items: (j.documents || []).map(d => ({ id: d.name.split("/").pop(), ...docData(d) })), tok: j.nextPageToken || "" };
    },
    // writes: [{path, data, ifUpdateTime?, ifMissing?}] أو [{path, del: true}] للحذف
    async commit(writes) {
      if (!writes.length) return;
      const body = { writes: writes.map(w => { if (w.del) return { delete: `projects/${PROJECT}/databases/(default)/documents/${w.path}` };
        if (w.inc) return { update: { name: `projects/${PROJECT}/databases/(default)/documents/${w.path}`, fields: {} }, updateMask: { fieldPaths: [] }, updateTransforms: Object.entries(w.inc).map(([f, v]) => ({ fieldPath: f, increment: { integerValue: String(Math.round(v)) } })) }; const x = { update: { name: `projects/${PROJECT}/databases/(default)/documents/${w.path}`, fields: enc(w.data).mapValue.fields } }; if (w.merge) x.updateMask = { fieldPaths: Object.keys(w.data) }; if (w.ifUpdateTime) x.currentDocument = { updateTime: w.ifUpdateTime }; else if (w.ifMissing) x.currentDocument = { exists: false }; return x }) };
      const r = await fetch(FS_BASE + ":commit", { method: "POST", headers: await H(), body: JSON.stringify(body) });
      if (r.status === 409 || r.status === 400 && (await r.clone().text()).includes("FAILED_PRECONDITION")) { const e = new Error("conflict"); e.conflict = true; e.status = r.status; throw e }
      if (!r.ok) { const e = new Error("fs commit " + r.status + " " + (await r.text()).slice(0, 200)); e.status = r.status; throw e }
      // وقت آخر تعديل لكل وثيقة كُتبت (تستعمله بوّابة الأخطاء شرطًا للكتابة التالية)
      try { return ((await r.json()).writeResults || []).map(w => w.updateTime || "") } catch (e) { return [] }
    }
  };
}

/* ---------- كلمات المناهج (للتحقق من كلمات المحطات) ---------- */
let WORDS = { at: 0, set: null };
async function wordSet() {
  if (WORDS.set && Date.now() - WORDS.at < 10 * 60e3) return WORDS.set;
  const c = await (await fetch(SITE + "courses.json?v=" + Date.now())).json(), set = new Set();
  for (const co of c.courses || []) { try { const d = await (await fetch(SITE + co.file + "?v=" + Date.now())).json(); for (const w of d.words || []) set.add(String(w.de).trim().toLowerCase()) } catch (e) { } }
  WORDS = { at: Date.now(), set }; return set;
}

/* ---------- إعدادات المشرف (تُقرأ كل دقيقة على الأكثر) ---------- */
let CFGC = { at: 0, j: null };
async function loadCfg(fs) {
  if (Date.now() - CFGC.at > 60e3) { const d = await fs.get("config/app"); CFGC = { at: Date.now(), j: d ? d.data.v || "" : "" } }
  applyCfg(parseJ(CFGC.j, null));
}

/* ---------- الحالة: تحميلها وحفظها ---------- */
function setState(c, log, qa, ck) {
  P = c.P || {}; QLOG = c.QLOG || []; BUY = c.BUY || []; R = Object.assign({ bank: 0, ach: [], lv: 1, ts: 0 }, c.R || {});
  LG = Object.assign({ tier: null, w: "", hist: [], ts: 0 }, c.LG || {}); EN = c.EN || { v: 30, t: 0 }; STN = c.STN || []; STV = c.STV || 0;
  LOG = unpackLog(log); QA = unpackQA(qa); CK = ck && ck.v ? ck : null; EC = null; CW = c.wiped || 0;
  if (!c.lf) flagLog();             // مرة واحدة: وسم التدريب في السجلّ القديم
  if ((LG.v || 1) < 2) { if (LG.tier != null) LG.tier = 0; LG.v = 2 }
}
const coreObj = () => ({ P, QLOG, BUY, R, LG, EN, STN, STV, ver: 1, lf: 1, ...(CW ? { wiped: CW } : {}) });
const parseJ = (s, d) => { try { return s ? JSON.parse(s) : d } catch (e) { return d } };

/* ---------- الدوري: التسوية الأسبوعية وسطر المتعلّم ---------- */
async function leagueStep(fs, uid, prof, now, writes) {
  const cur = weekId(now);
  if (LG.tier == null) { LG.tier = 0; LG.v = 2; LG.w = cur; LG.ts = now }
  else if (LG.w !== cur) {
    const last = weekId(weekStart(now) - 3 * DAY), docs = await fs.list(`lg/${last}/m`), me = docs.find(d => d.id === uid);
    if (me && me.xp > 0) {
      const prev = await fs.list(`lg/${weekId(weekStart(now) - 10 * DAY)}/m`), rows = tableFor(uid, last, docs, prev, 1);
      const n = rows.length, rank = rows.findIndex(r => r.id === uid) + 1, realRank = rows.filter(r => !r.bot).findIndex(r => r.id === uid) + 1, { up, down } = zones(n, me.tier);
      let mv = 0; if (rank && rank <= up && me.xp >= PROMO_MIN && me.tier < 9) mv = 1; else if (rank && down && rank > n - down && me.tier > 0) mv = -1;
      lgPush({ w: last, tier: me.tier, rank, n, mv, g: prizeOf(realRank, me.xp), xp: me.xp });   // آخر 52 أسبوعًا، وجوائز ما قبلها تُطوى في LG.hg
      LG.tier = me.tier + mv; LG.best = Math.max(LG.best || 0, LG.tier);
    }
    LG.w = cur; LG.ts = now;
  }
  const ws = weekStart(now), xp = weekXP(ws), path = `lg/${cur}/m/${uid}`, mine = await fs.get(path), me = mine && mine.data;
  if (!me && !xp) return;
  let grp, b;
  if (me && me.tier === LG.tier) { grp = me.grp; b = me.b }
  else { b = Math.min(5, Math.floor(measure().total / 20)); grp = chooseGroupFrom(await fs.list(`lg/${cur}/m`), LG.tier, b) }
  const doc = { name: prof.name, av: prof.av, fr: prof.fr, st: prof.st, nc: prof.nc, tier: LG.tier, grp, b, xp };
  if (prof.solo) doc.solo = true;
  const same = me && Object.keys(doc).every(k => me[k] === doc[k]) && !!me.solo === !!prof.solo;
  if (!same) writes.push({ path, data: { ...doc, ts: { __ts: now } } });
}

/* ---------- طلب واحد في كل مرة: المنطق المشترك يعمل على متغيّرات عامة ---------- */
let LOCK = Promise.resolve();
function serial(fn) { const p = LOCK.then(fn, fn); LOCK = p.then(() => { }, () => { }); return p }

/* ---------- معالجة طلب المزامنة ---------- */
async function handleSync(fs, user, body) {
  FREEU = false; STMAXU = 0; SRSU = false;
  const now = Date.now(), uid = user.uid, admin = user.email === ADMIN;
  await loadCfg(fs);
  FREEU = CFG.free.includes(uid);   // الدراسة الحرّة لهذا الحساب
  STMAXU = (CFG.stn || {})[uid] || 0;   // عدد محطاته اليومية إن حدّده المشرف
  SRSU = !admin && ((CFG.srs || {}).u || []).includes(uid);   // التحقّق من التذكّر: للحسابات التي يختارها المشرف فقط (ومع on وt0 في srsOn)
  const [uDoc, coreD, logD, qaD, nameD, gifts, ckD] = await Promise.all([
    fs.get(`users/${uid}`), fs.get(`users/${uid}/data/core`), fs.get(`users/${uid}/data/log`), fs.get(`users/${uid}/data/qa`),
    fs.get(`names/${uid}`), fs.list(`gifts/${uid}/g`), fs.get(`users/${uid}/data/ck`)]);
  // الحساب المفعّل فقط
  if (!admin && !uDoc && !(await fs.get(`members/${uid}`))) return { status: 403, json: { error: "inactive" } };
  const u = uDoc ? uDoc.data : {};
  // أول مرة: نقل البيانات الحالية من الحساب (قبل الخادم) مرة واحدة
  let c;
  if (coreD) c = parseJ(coreD.data.v, {});
  else { const m = parseJ(u.main, {}); c = { P: m.P, QLOG: m.QLOG, BUY: m.BUY, R: m.R, LG: m.LG, EN: m.EN, STN: m.STN, STV: 0 } }
  setState(c, parseJ(logD && logD.data.v, null), parseJ(qaD && qaD.data.v, null), parseJ(ckD && ckD.data.v, null));
  // مستخدم جديد تمامًا (أول دخول، بلا بيانات سابقة): طاقة بلا حدود أول 24 ساعة، ليتعلّم ما يكفي فتكون له كلمات يراجعها في اليوم التالي
  if (!coreD && !u.main) EN.u = Math.max(EN.u || 0, now + 24 * 3600e3);
  GIFTS = gifts.map(g => ({ id: g.id, g: g.g || 0, note: g.note || "", ts: g.ts }));
  const before = { log: LOG.length, l0: LOG.length ? LOG[0][0] : 0, l1: LOG.length ? LOG[LOG.length - 1][0] : 0, qa: QA.length, core: JSON.stringify(coreObj()), ck: CK ? CK.t : 0 };
  // الأحداث
  const evs = Array.isArray(body.evs) ? body.evs.slice(0, 300) : [], rej = [];
  let words = null;
  for (let i = 0; i < evs.length; i++) {
    const e = evs[i]; if (!e || typeof e !== "object") { rej.push(i); continue }
    if (CW && (+e.t || 0) < CW) { rej.push([i, "wiped"]); continue }      // أحداث من قبل حذف المشرف لا تُقبل
    if (e.type === "stDone" && !words) words = await wordSet();
    let duelOk = false, dwinOk = false;
    if (e.type === "dwin") { const dd = /^[A-Za-z0-9_-]{4,40}$/.test(String(e.id || "")) ? await fs.get(`duel/${e.id}`) : null;
      dwinOk = !!(dd && duelWinner(dd.data) === uid) }   // حدث التحدي: يُقبل فقط إن كان لاعبًا فيه وأنهى كل أسئلته
    if (e.type === "duel") { const dd = /^[A-Za-z0-9_-]{4,40}$/.test(String(e.id || "")) ? await fs.get(`duel/${e.id}`) : null;
      duelOk = !!(dd && dAct(dd.data).includes(uid) && dProg(dd.data, uid).d && !dProg(dd.data, uid).q) }
    EC = null; const r = applyEv(e, Math.max(now - 1, Date.now()), { server: true, admin, words, duelOk, dwinOk });
    if (r !== true) rej.push([i, r]);
  }
  // المظهر الذي اختاره المتعلّم (يُتحقّق من ملكيّته)
  const pr = parseJ(u.prefs, {}), E = pr.E || {};
  const avIt = SHOP.find(x => x.cat === "avatar" && x.val === E.avatar), lf = E.lgFrame ?? E.frame, ls = E.lgSticker ?? E.sticker;
  const prof = {
    name: String((nameD && nameD.data.name) || user.email.split("@")[0]).slice(0, 60),
    av: avIt && owned("avatar", avIt.id) ? avIt.val : "🎓",
    fr: lf && owned("frame", lf) ? lf : "none",
    st: (() => { const v = stkVal(ls); const it = SHOP.find(x => x.cat === "sticker" && x.val === v); return it && owned("sticker", it.id) ? v : "" })(),
    nc: E.ncolor && E.ncolor !== "none" && owned("namecolor", E.ncolor) ? E.ncolor : (admin ? "admin" : ""),
    solo: admin && !!E.lgSolo
  };
  const writes = [];
  EC = null; await leagueStep(fs, uid, prof, now, writes);
  // الملف العام: المظهر عند كل تغيير، والأرقام (المستوى والسلسلة والإنجازات) كل 10 دقائق على الأكثر توفيرًا للمعالجة
  const hide = !!E.hidePub;   // المتعلّم اختار إخفاء ملفه: يظهر اسمه ومظهره ودوريه فقط
  const look = hide ? { name: prof.name, av: prof.av, nc: prof.nc, fr: prof.fr, tier: LG.tier ?? 0, hide: 1 } : { name: prof.name, av: prof.av, nc: prof.nc, fr: prof.fr, tier: LG.tier ?? 0,
    stk: SHOP.filter(x => x.cat === "sticker" && owned("sticker", x.id)).map(x => x.val) };
  const lookJ = JSON.stringify(look), old = parseJ(c.pubJ, null);
  let pub, pubAt = c.pubAt || 0;
  if (old && c.pubL === lookJ && now - pubAt < 10 * 60e3 && !evs.some(x => x && (x.type === "reset" || x.type === "buy"))) pub = old;
  else {
    const e = EC || econ(), alv = {}; achList().forEach(a => { if (e.alv[a.id]) alv[a.id] = e.alv[a.id] });
    pub = hide ? { ...look } : { ...look, lv: e.lv, xp: e.xp, streak: e.s.streak, best: e.s.best, alv }; pubAt = now;
  }
  const pubJ = JSON.stringify(pub);
  // الحفظ
  const coreJ = JSON.stringify(coreObj()), logJ = JSON.stringify(packLog(LOG)), qaJ = JSON.stringify(packQA(QA));
  const cw = [];
  if (!coreD || coreJ !== before.core || c.pubJ !== pubJ || c.pubAt !== pubAt) cw.push({ path: `users/${uid}/data/core`, data: { v: coreJ.slice(0, -1) + "," + JSON.stringify({ pubJ, pubL: lookJ, pubAt }).slice(1) }, ...(coreD ? { ifUpdateTime: coreD.updateTime } : { ifMissing: true }) });
  // السجل يُحفظ إن تغيّر طوله أو أوّله أو آخره (عند الحدّ يبقى الطول ثابتًا وإن تغيّر المحتوى)
  const l0 = LOG.length ? LOG[0][0] : 0, l1 = LOG.length ? LOG[LOG.length - 1][0] : 0;
  if (!logD || LOG.length !== before.log || l0 !== before.l0 || l1 !== before.l1 || !c.lf || evs.some(x => x && x.type === "reset")) cw.push({ path: `users/${uid}/data/log`, data: { v: logJ } });
  // نقطة الحفظ: وثيقة مستقلة تُكتب عند الطيّ فقط
  const ckT = CK ? CK.t : 0, ckJ = CK ? JSON.stringify(CK) : "";
  if (ckT !== before.ck) cw.push({ path: `users/${uid}/data/ck`, data: { v: ckJ } });
  if (!qaD || QA.length !== before.qa || evs.some(x => x && x.type === "reset")) cw.push({ path: `users/${uid}/data/qa`, data: { v: qaJ } });
  if (c.pubJ !== pubJ) cw.push({ path: `pub/${uid}`, data: { ...pub, ts: { __ts: now } } });
  await fs.commit([...cw, ...writes]);
  // آلية رقم النسخة: إن أرسل التطبيق رقم نسخة مختلفًا، نرسل له الأرقام كما يحسبها الخادم ليعرضها بدل حسابه هو (لا تغيير في أي قاعدة)
  let sum;
  if (body.cv && body.cv !== CORE_V) { EC = null; const x = econ(); sum = { gems: x.gems, xp: x.xp, lv: x.lv, rest: x.rest, need: x.need, streak: x.s.streak, today: !!x.s.today } }
  // نقطة الحفظ تُرسل للتطبيق فقط حين تختلف عمّا عنده (يرسل وقتها ckt)
  return { status: 200, json: { core: coreJ, log: logJ, qa: qaJ, rej, prefs: u.prefs || "", cv: CORE_V, ...(sum ? { sum } : {}), ...(+body.ckt !== ckT ? { ck: ckJ } : {}) } };
}

/* ---------- المشرف: حذف كل بيانات مستخدم ليبدأ من الصفر ---------- */
// يبقى حسابه وتفعيله واسمه الظاهر ورسائله، ويُحذف ما سوى ذلك: التقدّم والجواهر والمشتريات والهدايا والدوري والملف العام والمظهر
async function handleWipe(fs, user, body) {
  if (user.email !== ADMIN) return { status: 403, json: { error: "admin" } };
  const uid = String(body.uid || ""); if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return { status: 400, json: { error: "uid" } };
  const now = Date.now(), [uDoc, gifts] = await Promise.all([fs.get(`users/${uid}`), fs.list(`gifts/${uid}/g`)]);
  const core = { P: {}, QLOG: [], BUY: [], R: { bank: 0, ach: [], lv: 1, ts: now }, LG: { tier: 0, w: "", hist: [], ts: now, v: 2, best: 0 }, EN: { v: 30, t: 0 }, STN: [], STV: 0, ver: 1, lf: 1, wiped: now };
  const empty = JSON.stringify({ K: [], F: [] });
  await fs.commit([
    { path: `users/${uid}`, data: { name: (uDoc && uDoc.data.name) || "", wiped: now } },
    { path: `users/${uid}/data/core`, data: { v: JSON.stringify(core) } },
    { path: `users/${uid}/data/log`, data: { v: empty } },
    { path: `users/${uid}/data/qa`, data: { v: empty } },
    { path: `users/${uid}/data/ck`, data: { v: "" } },
    { path: `pub/${uid}`, del: true },
    { path: `lg/${weekId(now)}/m/${uid}`, del: true },
    ...gifts.map(g => ({ path: `gifts/${uid}/g/${g.id}`, del: true }))]);
  return { status: 200, json: { ok: true } };
}

/* ---------- المشرف: استعادة سلسلة متعلّم ومستواه في الدوري (بعد تصفيرٍ قديم كان يمسحهما) ---------- */
// streak: السلسلة التي يجب أن تظهر له الآن (تُحفظ أيامًا متتالية تنتهي أمس، واليوم يُضاف إن درس)، tier: مستواه في الدوري
async function handleFix(fs, user, body, env) {
  if (user.email !== ADMIN) return { status: 403, json: { error: "admin" } };
  const uid = String(body.uid || ""); if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return { status: 400, json: { error: "uid" } };
  const streak = body.streak == null || body.streak === "" ? null : Math.floor(+body.streak), tier = body.tier == null || body.tier === "" ? null : Math.floor(+body.tier);
  if (streak != null && !(streak >= 0 && streak <= 3650)) return { status: 400, json: { error: "streak" } };
  if (tier != null && !(tier >= 0 && tier < CFG.league.up.length)) return { status: 400, json: { error: "tier" } };
  await loadCfg(fs);
  const [coreD, logD, qaD, ckD] = await Promise.all([fs.get(`users/${uid}/data/core`), fs.get(`users/${uid}/data/log`), fs.get(`users/${uid}/data/qa`), fs.get(`users/${uid}/data/ck`)]);
  if (!coreD) return { status: 404, json: { error: "nouser" } };
  setState(parseJ(coreD.data.v, {}), parseJ(logD && logD.data.v, null), parseJ(qaD && qaD.data.v, null), parseJ(ckD && ckD.data.v, null));
  const now = Date.now();
  if (streak != null) {
    R = { ...R }; delete R.sk; EC = null;
    const todayIn = econ().s.today, n = Math.max(0, streak - (todayIn ? 1 : 0));
    if (n > 0) R.sk = { t: dkey(now - DAY), n };
    EC = null;
  }
  if (tier != null) LG = { ...LG, tier, best: Math.max(LG.best || 0, tier) };
  await fs.commit([{ path: `users/${uid}/data/core`, data: { v: JSON.stringify(coreObj()) }, ifUpdateTime: coreD.updateTime }]);
  EC = null; const e = econ();
  return { status: 200, json: { ok: true, streak: e.s.streak, tier: LG.tier } };
}

/* ---------- بلاغات الأخطاء في الكلمات: المتعلّم يرسل، والمشرف يقرأ ويحذف ---------- */
const RKINDS = ["ar", "de", "ex", "audio", "other"];
async function handleReport(fs, user, body) {
  const op = String(body.op || "add");
  if (op === "list" || op === "del") {
    if (user.email !== ADMIN) return { status: 403, json: { error: "admin" } };
    if (op === "del") { const id = String(body.id || ""); if (!/^[A-Za-z0-9_-]{1,200}$/.test(id)) return { status: 400, json: { error: "id" } }; await fs.commit([{ path: `reports/${id}`, del: true }]); return { status: 200, json: { ok: true } } }
    const list = (await fs.list("reports")).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 300);
    return { status: 200, json: { list } };
  }
  const k = String(body.k || "").slice(0, 200), kind = RKINDS.includes(body.kind) ? body.kind : "other";
  if (!k) return { status: 400, json: { error: "word" } };
  const uDoc = await fs.get(`users/${user.uid}`);
  if (!uDoc && user.email !== ADMIN) return { status: 403, json: { error: "inactive" } };
  // بلاغ واحد لكل متعلّم لكل كلمة (يُستبدل إن أعاده)، فلا يمتلئ الصندوق بالتكرار
  let h = 0; for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const id = user.uid.replace(/[^A-Za-z0-9_-]/g, "") + "_" + h.toString(36);
  await fs.commit([{ path: `reports/${id}`, data: { uid: user.uid, name: String((uDoc && uDoc.data.name) || user.email.split("@")[0]).slice(0, 60), k,
    de: String(body.de || "").slice(0, 300), ar: String(body.ar || "").slice(0, 300), course: String(body.course || "").slice(0, 60), kind, note: String(body.note || "").slice(0, 500), at: Date.now() } }]);
  return { status: 200, json: { ok: true } };
}

/* ---------- عدّاد الاستهلاك: طلبات وقراءات وكتابات لكل ساعة، يُجمع في الذاكرة ويُحفظ دفعة كل دقيقتين ---------- */
let ST = {}, ST_AT = Date.now(), ST_N = 0;
function stAdd(f, v) { if (!v) return; const now = Date.now(), d = dkey(now), h = String(hourOf(now)).padStart(2, "0"), o = ST[d] || (ST[d] = {}); o[f] = (o[f] || 0) + v; o[f + "_" + h] = (o[f + "_" + h] || 0) + v }
function countFS(fs) {
  return {
    async get(p) { stAdd("sr", 1); return fs.get(p) },
    async list(c) { const r = await fs.list(c); stAdd("sr", Math.max(1, r.length)); return r },
    async commit(ws) { stAdd("sw", ws.length); return fs.commit(ws) }
  };
}
async function stFlush(fs, force) {
  ST_N++;
  if (!force && Date.now() - ST_AT < 120e3 && ST_N < 100) return;
  const S = ST; ST = {}; ST_AT = Date.now(); ST_N = 0;
  const hh = "sw_" + String(hourOf(Date.now())).padStart(2, "0");   // كتابة الإحصاء نفسها تُحسب أيضًا
  const ws = Object.entries(S).map(([d, inc]) => ({ path: `stats/${d}`, inc: { ...inc, sw: (inc.sw || 0) + 1, [hh]: (inc[hh] || 0) + 1 } }));
  if (!ws.length) return;
  try { await fs.commit(ws) } catch (e) { for (const [d, o] of Object.entries(S)) for (const [f, v] of Object.entries(o)) { const t = ST[d] || (ST[d] = {}); t[f] = (t[f] || 0) + v } }
}
async function handleStats(fs, user, body) {
  if (user.email !== ADMIN) return { status: 403, json: { error: "admin" } };
  await stFlush(fs, true);
  const days = (await fs.list("stats")).sort((a, b) => a.id < b.id ? 1 : -1).slice(0, 31);
  return { status: 200, json: { days } };
}

/* ---------- إنشاء حساب من لوحة الإشراف: يُنشأ في Firebase Auth ويُفعَّل فورًا ---------- */
/* ---------- رسالة يبدؤها المشرف لمتعلّم لم يراسله بعد (قواعد Firestore لا تسمح للمشرف بإنشاء المحادثة) ---------- */
async function handleMsg(fs, user, body) {
  if (user.email !== ADMIN) return { status: 403, json: { error: "admin" } };
  const to = String(body.to || ""), text = String(body.text || "").trim().slice(0, 500);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(to) || !text) return { status: 400, json: { error: "bad" } };
  const [nm, ud] = await Promise.all([fs.get(`names/${to}`), fs.get(`users/${to}`)]);
  const name = String((nm && nm.data.name) || (ud && ud.data.name) || "مستخدم").slice(0, 60);
  const now = Date.now(), id = "a" + now.toString(36) + Math.random().toString(36).slice(2, 6);
  await fs.commit([
    { path: `threads/${to}/msgs/${id}`, data: { from: "admin", text, ts: { __ts: now } } },
    { path: `threads/${to}`, data: { name, state: "open", lastFrom: "admin", unreadUser: true, updated: { __ts: now }, lastMsg: id }, merge: true }]);
  return { status: 200, json: { ok: true } };
}

async function handleCreate(fs, user, body, env) {
  if (user.email !== ADMIN) return { status: 403, json: { error: "admin" } };
  const login = String(body.login || "").trim().toLowerCase(), pass = String(body.pass || ""), name = String(body.name || "").trim().slice(0, 40);
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(login)) return { status: 400, json: { error: "login" } };
  if (pass.length < 6 || pass.length > 64) return { status: 400, json: { error: "pass" } };
  const courses = Array.isArray(body.courses) ? body.courses.map(String).filter(x => /^[A-Za-z0-9_-]{1,40}$/.test(x)).slice(0, 20) : [];
  let uid;
  if (env.__fs) uid = "u_" + login;   // الاختبار المحلي
  else {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts`, { method: "POST", headers: { Authorization: "Bearer " + await googleToken(env), "Content-Type": "application/json" },
      body: JSON.stringify({ email: login + "@mufradati.app", password: pass, displayName: name || login }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const m = String((j.error && j.error.message) || r.status); return { status: m.includes("EXISTS") ? 409 : r.status === 403 ? 403 : 500, json: { error: m.includes("EXISTS") ? "exists" : r.status === 403 ? "perm" : "auth", detail: m.slice(0, 200) } } }
    uid = j.localId;
  }
  const now = Date.now(), w = [{ path: `members/${uid}`, data: { ts: { __ts: now }, by: "admin" } }];
  if (name) w.push({ path: `names/${uid}`, data: { name, pending: "", okAt: { __ts: now } } });
  if (courses.length) w.push({ path: `assign/${uid}`, data: { courses, ts: { __ts: now } } });
  await fs.commit(w);
  return { status: 200, json: { ok: true, uid } };
}

// تعيين كلمة مرور جديدة لمستخدم (المشرف وحده). يخرج المستخدم من أجهزته الأخرى، ويبقى تقدّمه كما هو
async function handlePass(fs, user, body, env) {
  if (user.email !== ADMIN) return { status: 403, json: { error: "admin" } };
  const uid = String(body.uid || ""), pass = String(body.pass || "");
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return { status: 400, json: { error: "uid" } };
  if (pass.length < 6 || pass.length > 64) return { status: 400, json: { error: "pass" } };
  if (uid === user.uid) return { status: 400, json: { error: "self" } };
  if (env.__fs) return { status: 200, json: { ok: true } };   // الاختبار المحلي
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`, { method: "POST", headers: { Authorization: "Bearer " + await googleToken(env), "Content-Type": "application/json" },
    body: JSON.stringify({ localId: uid, password: pass }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const m = String((j.error && j.error.message) || r.status); return { status: m.includes("USER_NOT_FOUND") ? 404 : r.status === 403 ? 403 : 500, json: { error: m.includes("USER_NOT_FOUND") ? "nouser" : r.status === 403 ? "perm" : "auth", detail: m.slice(0, 200) } } }
  return { status: 200, json: { ok: true } };
}

/* ---------- مساعد الوظيفة: ذكاء صناعي مجاني من Cloudflare لحسابات يختارها المشرف ---------- */
// نموذجان مجانيان: الأول يقرأ صورة الورقة ويكتب نصّها (رخيص ودقيق)، والثاني يشرح للطفل (أذكى)، وإن تعطّل يشرح الأول
const AI_MODEL = "@cf/google/gemma-4-26b-a4b-it", AI_TUTOR = "@cf/qwen/qwen3.8-27b", AI_DAY = 60;   // الحدّ اليومي للأسئلة لكل حساب
function aiPrompt(name, grade) {
  return `Du bist „Eule“, eine Hausaufgabenhilfe für ${name ? "das Kind " + name : "ein Kind"} (${grade ? grade + ". Klasse" : "3. oder 4. Klasse"}, Grundschule in Sachsen). Das Kind spricht Arabisch (Familie aus Syrien). Die Eltern sind nicht zu Hause.

ANTWORT-FORM (sehr wichtig):
- Ganz kurz: höchstens 2 Gedanken pro Antwort.
- Jeder Gedanke: eine Zeile einfaches Deutsch, darunter dieselbe Zeile auf einfachem Arabisch (Hocharabisch mit in Syrien üblichen Wörtern). Wörter aus der Aufgabe bleiben auf Deutsch.
- Im Arabischen: sprich das Kind passend zu seinem Namen an (Junge männlich, Mädchen weiblich; unklar: männlich). Über dich selbst sprichst du immer in männlicher Form (z. B. „أنا آسف“).
- Kein Markdown außer **fett**. Keine Begrüßung, keine Wiederholung der Aufgabe, keine Entschuldigungs-Romane.

DAS ARBEITSBLATT:
- Wenn ein Arbeitsblatt abgeschrieben mitgeschickt wird, ist das die einzige Quelle. Zitiere nur Wörter und Sätze, die wirklich dort stehen. Behaupte nie, ein Wort stehe in einem Satz, wenn es dort nicht steht.
- Hat das Blatt mehrere Aufgaben und das Kind hat nicht gesagt welche: frage zuerst kurz „Welche Aufgabe?“ und nichts sonst.
- Nennt das Kind eine Nummer, arbeite nur an genau dieser Aufgabe.

SO HILFST DU:
- Gehe in sinnvollen Schritten vor, nicht in Mini-Schritten. Frage nichts, was offensichtlich ist (z. B. nicht „Siehst du das Wort …?“).
- Pro Antwort: einen kurzen Tipp oder eine Erklärung + eine klare Frage, mit der das Kind den nächsten Teil selbst löst.
- Lobe nur, wenn das Kind gerade etwas richtig beantwortet hat: dann kurz („Super!“) und weiter. Falsch: sagen, was falsch ist, kurzer Tipp, noch einmal.
- Nach 2 falschen Versuchen, bei „ich weiß nicht“ oder wenn das Kind die Lösung will: zeige die Lösung dieses Teils mit einem kurzen Grund.
- Am Ende: die ganze Lösung in einer kurzen Liste zum Abschreiben.
- Rechne sorgfältig und prüfe jedes Ergebnis, bevor du es sagst.

REGELN:
- Nur Schule und Lernen; sonst freundlich zurück zur Aufgabe.
- Frage nie nach Adresse, Telefonnummer, Passwörtern oder Fotos von Personen.
- Ist das Kind traurig, hat Angst, ist verletzt oder in Gefahr: sag liebevoll, es soll sofort Papa oder Mama anrufen oder einem Erwachsenen Bescheid sagen; bei Gefahr 112.
- Keine Inhalte, die nicht für Kinder geeignet sind.`;
}
const OCR_PROMPT = "Schreibe den gesamten Text auf diesem Foto eines Arbeitsblatts exakt ab, Zeile für Zeile, in der Reihenfolge des Blatts. Behalte Aufgabennummern, Lücken (als ____), Ankreuzkästchen (als ☐) und Beispiele bei. Erfinde nichts und korrigiere nichts; unlesbare Stellen als [?]. Wenn Handschrift des Kindes zu sehen ist, schreibe sie in eckigen Klammern mit „Kind:“ davor. Gib nur den abgeschriebenen Text aus.";
const aiText = r => {
  let t = r && r.choices && r.choices[0] && r.choices[0].message ? r.choices[0].message.content : r && r.response;
  if (Array.isArray(t)) t = t.map(x => x && x.text || "").join("");
  return String(t || "").replace(/<think>[\s\S]*?<\/think>/g, "").replace(/<\|?channel\|?>thought[\s\S]*?<\|?channel\|?>/g, "").trim();
};
async function handleAi(fs, user, body, env) {
  await loadCfg(fs);
  if (!(CFG.ai || []).includes(user.uid)) return { status: 403, json: { error: "noai" } };
  if (body.peek) { const q0 = await fs.get(`aiq/${user.uid}`), u0 = q0 && q0.data.d === dkey(Date.now()) ? +q0.data.n || 0 : 0; return { status: 200, json: { left: Math.max(0, AI_DAY - u0), max: AI_DAY } } }
  const msgs = (Array.isArray(body.msgs) ? body.msgs : []).slice(-16).map(m => ({ r: m && m.r === "a" ? "a" : "u", t: String(m && m.t || "").slice(0, 2000), i: !!(m && m.i), o: String(m && m.o || "").slice(0, 5000) }));
  if (!msgs.length || msgs[msgs.length - 1].r !== "u") return { status: 400, json: { error: "bad" } };
  const img = typeof body.img === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(body.img) && body.img.length < 700000 ? body.img : "";
  const cid = String(body.cid || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "c";
  const now = Date.now(), day = dkey(now);
  const [q, as, nm] = await Promise.all([fs.get(`aiq/${user.uid}`), fs.get(`assign/${user.uid}`), fs.get(`names/${user.uid}`)]);
  const used = q && q.data.d === day ? +q.data.n || 0 : 0;
  if (used >= AI_DAY) return { status: 429, json: { error: "limit", left: 0, max: AI_DAY } };
  const cs = as && Array.isArray(as.data.courses) ? as.data.courses : [], grade = cs.includes("k4") ? 4 : cs.includes("k3") ? 3 : 0;
  const name = String(nm && nm.data.name || "").split(/\s+/)[0].slice(0, 30);
  const isQuota = m => /4006|daily|neuron|quota|limit/i.test(m), fail = e => { const m = String(e && e.message || e); return { status: isQuota(m) ? 429 : 502, json: { error: isQuota(m) ? "quota" : "ai", ...(user.email === ADMIN ? { detail: m.slice(0, 200) } : {}) } } };
  // صورة جديدة لم تُقرأ بعد: يُكتب نصّها أولًا، ثم يُشرح من النص (لا يخمّن الشارح ما في الصورة)
  let ocr = "", ocrAt = -1;
  if (img) {
    ocrAt = msgs.map(m => m.i && !m.o).lastIndexOf(true);
    if (ocrAt >= 0) {
      try { ocr = aiText(await env.AI.run(AI_MODEL, { messages: [{ role: "user", content: [{ type: "text", text: OCR_PROMPT }, { type: "image_url", image_url: { url: img } }] }], max_completion_tokens: 1500, temperature: 0, chat_template_kwargs: { enable_thinking: false } })).slice(0, 5000) }
      catch (e) { return fail(e) }
      msgs[ocrAt].o = ocr || "[Foto nicht lesbar]";
    }
  }
  const messages = [{ role: "system", content: aiPrompt(name, grade) }, ...msgs.map(m => ({ role: m.r === "a" ? "assistant" : "user",
    content: m.o ? "Arbeitsblatt (vom Foto abgeschrieben):\n" + m.o + "\n\nKind: " + (m.t || "Hilf mir bei dieser Aufgabe.") : m.i ? "(Foto, nicht mehr verfügbar) " + (m.t || "…") : (m.t || "…") }))];
  let a = "";
  try { a = aiText(await env.AI.run(AI_TUTOR, { messages, max_completion_tokens: 700, temperature: 0.3, chat_template_kwargs: { enable_thinking: false } })) } catch (e) { a = "" }
  if (!a) { try { a = aiText(await env.AI.run(AI_MODEL, { messages, max_completion_tokens: 700, temperature: 0.3, chat_template_kwargs: { enable_thinking: false } })) } catch (e) { return fail(e) } }
  if (!a) return { status: 502, json: { error: "ai", detail: "empty" } };
  const last = msgs[msgs.length - 1], id = now.toString(36) + Math.random().toString(36).slice(2, 6);
  // صورة الورقة تُحفظ في تخزين Cloudflare 31 يومًا ثم تُحذف وحدها؛ يراها المشرف مع المحادثة
  let ik = "";
  if (ocrAt === msgs.length - 1 && img && env.BAK) { ik = "img-" + user.uid + "-" + id; try { await env.BAK.put(ik, img, { expirationTtl: 31 * 86400 }) } catch (e) { ik = "" } }
  await fs.commit([
    { path: `aichat/${user.uid}/m/${id}`, data: { c: cid, q: last.t, img: "", ik: ik, o: ocr, a, ts: { __ts: now } } },
    { path: `aichat/${user.uid}`, data: { last: { __ts: now }, name }, merge: true },
    { path: `aiq/${user.uid}`, data: { d: day, n: used + 1 } }]);
  return { status: 200, json: { a, ocr, ocrAt: ocrAt >= 0 ? msgs.length - 1 - ocrAt : -1, left: AI_DAY - used - 1, max: AI_DAY } };
}
// المشرف يقرأ محادثات المساعد لحساب معيّن، الأحدث أولًا
// حذف محادثات المساعد: كلها، أو محادثة واحدة (c)، أو الأقدم من تاريخ (before)
const AI_KEEP = 30 * DAY;   // تُحذف المحادثات تلقائيًّا بعد شهر
async function aiPurge(fs, uid, f) {
  let tok = "", n = 0;
  do {
    const r = await fs.page(`aichat/${uid}/m`, "ts", 200, tok); tok = r.tok;
    const hit = r.items.filter(x => (f.c ? x.c === f.c : true) && (f.before ? (x.ts && x.ts.ms || 0) < f.before : true)), del = hit.map(x => ({ path: `aichat/${uid}/m/${x.id}`, del: true }));
    if (f.env && f.env.BAK) for (const x of hit) if (x.ik) { try { await f.env.BAK.delete(x.ik) } catch (e) { } }
    for (let k = 0; k < del.length; k += 400) await fs.commit(del.slice(k, k + 400));
    n += del.length;
    if (f.before && r.items.length && (r.items[r.items.length - 1].ts || {}).ms >= f.before) break;   // مرتّبة من الأقدم: ما بعدها أحدث
  } while (tok);
  return n;
}
async function handleAiDel(fs, user, body, env) {
  if (user.email !== ADMIN) return { status: 403, json: { error: "admin" } };
  const uid = String(body.uid || ""), c = String(body.c || "");
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid) || c && !/^[A-Za-z0-9_-]{1,40}$/.test(c)) return { status: 400, json: { error: "bad" } };
  return { status: 200, json: { ok: true, n: await aiPurge(fs, uid, c ? { c, env } : { env }) } };
}
// يعمل كل ليلة: يحذف من كل الحسابات ما مضى عليه أكثر من شهر
async function aiCleanup(env) {
  const fs = env.__fs || makeFS(env), before = Date.now() - AI_KEEP;
  for (const d of await fs.list("aichat")) { try { await aiPurge(fs, d.id, { before }) } catch (e) { } }
}
async function handleAiLog(fs, user, body, env) {
  if (user.email !== ADMIN) return { status: 403, json: { error: "admin" } };
  const uid = String(body.uid || "");
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return { status: 400, json: { error: "uid" } };
  const r = await fs.page(`aichat/${uid}/m`, "ts desc", 30, String(body.tok || ""));
  const imgs = await Promise.all(r.items.map(x => x.img ? x.img : x.ik && env.BAK ? env.BAK.get(x.ik).catch(() => "") : ""));
  return { status: 200, json: { items: r.items.map((x, k) => ({ c: x.c, q: x.q, img: imgs[k] || "", a: x.a, ts: x.ts && x.ts.ms || 0 })), tok: r.tok, keep: AI_KEEP / DAY } };
}



/* ---------- النسخ الاحتياطي: كل ليلة تُحفظ نسخة كاملة من قاعدة البيانات في تخزين Cloudflare (منفصل عن Firebase) ---------- */
// الاحتفاظ (السياسة 2): آخر 14 نسخة ليلية وآخر 5 يدوية، كلٌّ على حدة، فلا تُخرج اليدويةُ الليليةَ.
// يُطبَّق فقط على النسخ التي أُنشئت بهذه السياسة (pol: 2)؛ النسخ الأقدم لا تُحذف تلقائيًا أبدًا، ولا نسخة «قبل الاسترجاع»
const BAK_KEEP = { auto: 14, manual: 5 }, BAK_POL = 2;
const DOCROOT = `projects/${PROJECT}/databases/(default)/documents`;
async function gauth(env) { return { Authorization: "Bearer " + await googleToken(env), "Content-Type": "application/json" } }
// كل وثائق قاعدة البيانات بصيغتها الأصلية (الأنواع محفوظة كما هي). تُحفظ الردود كما وصلت بلا تحليل، توفيرًا لوقت المعالج
// صور مساعد الوظيفة محفوظة في تخزين Cloudflare لا في قاعدة البيانات، فلا تدخل النسخة (وتُحذف وحدها بعد شهر)
async function exportAll(env) {
  if (env.__export) return env.__export();   // للاختبار المحلي فقط (قاعدة في الذاكرة)
  const H = await gauth(env);
  const r0 = await fetch(FS_BASE + ":listCollectionIds", { method: "POST", headers: H, body: JSON.stringify({ pageSize: 300 }) });
  if (!r0.ok) throw new Error("ids " + r0.status);
  const top = (await r0.json()).collectionIds || [];
  const Q = top.map(id => ({ parent: "", q: { from: [{ collectionId: id }] } }));
  for (const id of ["data", "g", "msgs", "m"]) Q.push({ parent: "", q: { from: [{ collectionId: id, allDescendants: true }] } });
  const parts = [];
  for (const x of Q) {
    const r = await fetch(FS_BASE + x.parent + ":runQuery", { method: "POST", headers: H, body: JSON.stringify({ structuredQuery: x.q }) });
    if (!r.ok) throw new Error("query " + r.status + " " + (await r.text()).slice(0, 120));
    parts.push(await r.text());
  }
  const all = parts.join(","), cnt = re => (all.match(re) || []).length;
  return { parts, n: cnt(/"document"\s*:/g), users: cnt(new RegExp('"name"\\s*:\\s*"' + DOCROOT.replace(/[()]/g, "\\$&") + '/users/[^/"]+"', "g")) };
}
const gz = async s => new Uint8Array(await new Response(new Blob([s]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
const gunz = async b => await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
async function backupNow(env, why, rid) {
  const ex = await exportAll(env); let now = Date.now(), key;
  // مفتاح فريد: إن وُجدت نسخة بالجزء نفسه من الألف من الثانية (نادر جدًا) يُزاد جزءًا، فلا تُكتب نسخة فوق أخرى
  // ولكل عملية لاحقة رقمية من معرّفها، فعمليتان مختلفتان في اللحظة نفسها لا تتشاركان المفتاح
  let h = 0; for (const ch of String(rid || "")) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  const suf = rid ? "-" + String(h).padStart(4, "0") : "";
  for (let i = 0; i < 20; i++, now++) { key = "bak-" + new Date(now).toISOString().replace(/[:.]/g, "-") + suf; if (!(await env.BAK.get(key, { type: "stream" }).then(v => { if (v && v.cancel) v.cancel(); return v }))) break }
  const body = await gz('{"v":2,"at":' + now + ',"parts":[' + ex.parts.join(",") + "]}");
  const meta = { at: now, n: ex.n, users: ex.users, size: body.length, why: why || "auto", pol: BAK_POL, ...(rid ? { rid } : {}) };
  await env.BAK.put(key, body, { metadata: meta });
  await bakPrune(env);
  return { key, ...meta };
}
// «نسخة الآن» عملية لا تتكرّر. لكل عملية معرّف (rid): ضغطة في التطبيق، أو «auto-<اليوم>» للنسخة الليلية، أو للتطبيق القديم بلا معرّف «m-<فترة دقيقتين>».
// القفل وثيقة bakrid/<rid> تُنشأ بشرط ألّا تكون موجودة (ذرّيًّا في قاعدة البيانات): مهما تزامنت الطلبات أو اختلفت نسخ الخادم التي وصلت إليها،
// يفوز طلب واحد فقط بإنشاء النسخة، والباقي يُرجع النسخة نفسها أو «قيد الإنشاء». الوثيقة صغيرة ولا تمسّ بيانات الحسابات.
const BAKRUN = new Map(), BAK_STALE = 15 * 60e3;
const RID_OK = r => typeof r === "string" && /^[A-Za-z0-9_-]{8,40}$/.test(r);
async function backupOnce(env, fs, rid, why) {
  const now = Date.now(); why = why === "auto" ? "auto" : "manual";
  if (!RID_OK(rid)) rid = why === "auto" ? "auto-" + new Date(now).toISOString().slice(0, 10) : "m-" + Math.floor(now / 120e3);
  if (BAKRUN.has(rid)) { const r = await BAKRUN.get(rid).catch(() => null); if (r) return { ...r, dup: 1 } }
  const lock = `bakrid/${rid}`;
  try { await fs.commit([{ path: lock, data: { st: "run", at: now, why }, ifMissing: true }]) }
  catch (e) {
    if (!e.conflict) throw e;
    const d = await fs.get(lock), x = d ? d.data : {};
    if (x.st === "done") return { ...parseJ(x.r, {}), dup: 1 };
    if (now - (+x.at || 0) < BAK_STALE) return { pending: 1, dup: 1 };
    // قفل قديم من عملية توقفت: يُستولى عليه بشرط ألّا يكون قد تغيّر منذ قرأناه (ذرّيًّا أيضًا)
    try { await fs.commit([{ path: lock, data: { st: "run", at: now, why }, ifUpdateTime: d.updateTime }]) }
    catch (e2) { if (e2.conflict) return { pending: 1, dup: 1 }; throw e2 }
  }
  const p = backupNow(env, why, rid);
  BAKRUN.set(rid, p); if (BAKRUN.size > 20) BAKRUN.delete(BAKRUN.keys().next().value);
  try {
    const r = await p; await fs.commit([{ path: lock, data: { st: "done", at: now, why, r: JSON.stringify(r) } }]);
    try { const old = (await fs.list("bakrid")).filter(x => x.st === "done" && now - (+x.at || 0) > 30 * 864e5).slice(0, 50); if (old.length) await fs.commit(old.map(x => ({ path: "bakrid/" + x.id, del: true }))) } catch (e) { }   // أقفال أقدم من شهر
    return r;
  }
  catch (e) { BAKRUN.delete(rid); try { await fs.commit([{ path: lock, del: true }]) } catch (x) { } throw e }
}
async function bakPrune(env) {
  const all = (await env.BAK.list({ prefix: "bak-" })).keys.sort((a, b) => a.name < b.name ? 1 : -1), del = [];
  for (const why of ["auto", "manual"]) del.push(...all.filter(k => k.metadata && k.metadata.pol === BAK_POL && k.metadata.why === why).slice(BAK_KEEP[why]));
  for (const k of del) await env.BAK.delete(k.name);
  return del.map(k => k.name);
}
// تفكّ النسخة وتعيد وثائقها: [{name, fields}]
async function loadBak(env, key) {
  if (!/^bak-[0-9TZ-]+$/.test(key)) throw new Error("key");
  const b = await env.BAK.get(key, "arrayBuffer"); if (!b) throw new Error("nobak");
  const j = JSON.parse(await gunz(b)), docs = new Map();
  for (const part of j.parts || []) for (const x of part) if (x && x.document) docs.set(x.document.name, { fields: x.document.fields || {}, ut: x.document.updateTime || "" });
  return { at: j.at, docs: [...docs].map(([name, d]) => ({ name, fields: d.fields, ut: d.ut })) };
}
// ملخّص حساب واحد كما يحسبه الخادم: للتوثيق قبل التحديث وبعده، وللتحقق من النسخة الاحتياطية. لا يكتب شيئًا
function acctSum(c, log, qa, ck, gifts) {
  setState(c, log, qa, ck); GIFTS = (gifts || []).map(g => ({ id: g.id, g: g.g || 0, note: g.note || "", ts: g.ts })); EC = null;
  const e = econ(), ms = new Set([...(Array.isArray(R.pz) ? R.pz : []).map(x => String(x[0]).slice(0, 7)), ...Object.keys(R.pza || {})]);
  const pz = {}; for (const m of [...ms].sort()) pz[m] = pzMonth(m).have.size;
  return { gems: e.gems, earned: e.earned, xp: e.xp, lv: e.lv, streak: e.s.streak, best: e.s.best, reviews: e.s.reviews, mem: e.s.mem, mast: e.s.mast,
    words: Object.keys(P).length, stations: STN.length, quizzes: QLOG.length, buys: BUY.length, ach: (R.ach || []).length,
    quests: (R.qd || []).length, qdg: +R.qdg || 0, duelWins: (R.dw || []).length, dwg: +R.dwg || 0, duelDays: duelDays().length,
    tier: LG.tier, weeks: (LG.hist || []).length, lgg: (LG.hist || []).reduce((a, h) => a + (h.g || 0), 0) + (+LG.hg || 0), pz, album: Object.values(pz).filter(n => n >= PZ_N).length,
    log: LOG.length, ck: typeof CK !== "undefined" && CK ? 1 : 0,
    // ما طُوي في الأرشيف الدائم (0 حتى يبلغ الحساب حدود السجلّات): يحدّد هل التراجع إلى النسخة القديمة آمن
    folded: (+R.qdg || 0) + (+R.dwg || 0) + (+LG.hg || 0) + Object.keys(R.dda || {}).length + (typeof CK !== "undefined" && CK ? 1 : 0) };
}
// ملخّصات كل الحسابات من قاعدة البيانات الحيّة
async function liveSums(fs) {
  const us = await fs.list("users"), out = {};
  for (const u of us) {
    const uid = u.id, [coreD, logD, qaD, ckD, gifts, nm] = await Promise.all([fs.get(`users/${uid}/data/core`), fs.get(`users/${uid}/data/log`), fs.get(`users/${uid}/data/qa`), fs.get(`users/${uid}/data/ck`), fs.list(`gifts/${uid}/g`), fs.get(`names/${uid}`)]);
    if (!coreD) continue;
    out[uid] = { name: (nm && nm.data.name) || u.name || "", ...acctSum(parseJ(coreD.data.v, {}), parseJ(logD && logD.data.v, null), parseJ(qaD && qaD.data.v, null), parseJ(ckD && ckD.data.v, null), gifts) };
  }
  return out;
}
// ملخّصات كل الحسابات من نسخة احتياطية (بعد فكّها كاملة) — تثبت أن النسخة تكفي لإعادة بناء كل حساب
function bakSums(b) {
  const at = d => d.name.slice(DOCROOT.length + 1), docs = new Map(), val = f => { const o = {}; for (const k in f) o[k] = dec(f[k]); return o };
  for (const d of b.docs) docs.set(at(d), val(d.fields));
  const out = {};
  for (const [p, v] of docs) {
    const m = p.match(/^users\/([^/]+)\/data\/core$/); if (!m) continue; const uid = m[1], g = k => docs.get(`users/${uid}/data/${k}`);
    const gifts = [...docs].filter(([q]) => q.startsWith(`gifts/${uid}/g/`)).map(([q, x]) => ({ id: q.split("/").pop(), ...x }));
    out[uid] = { name: (docs.get(`names/${uid}`) || {}).name || "", ...acctSum(parseJ(v.v, {}), parseJ(g("log") && g("log").v, null), parseJ(g("qa") && g("qa").v, null), parseJ(g("ck") && g("ck").v, null), gifts) };
  }
  return out;
}
// «تحقق كامل» (2): يقارن الوثائق الأصلية لكل حساب (core وlog وqa وck والهدايا) بين النسخة والحالة الآن، ثم الملخّصات.
// الحالة الآن تُقرأ كلها أولًا، ثم تُحسب ملخّصات الطرفين معًا دون أي انتظار بينهما، وبإعدادات المشرف نفسها (فلا يتغيّر شيء أثناء الحساب)
const stab = v => Array.isArray(v) ? "[" + v.map(stab).join(",") + "]" : v && typeof v === "object" ? "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + stab(v[k])).join(",") + "}" : JSON.stringify(v);
async function verifyBak(fs, b, key) {
  const cmpAt = Date.now(), at = d => d.name.slice(DOCROOT.length + 1), B = new Map();
  for (const d of b.docs) { const o = {}; for (const k in d.fields) o[k] = dec(d.fields[k]); B.set(at(d), { data: o, ut: d.ut || "" }) }
  const uids = new Set([...B.keys()].map(p => (p.match(/^users\/([^/]+)\/data\/core$/) || [])[1]).filter(Boolean));
  for (const u of await fs.list("users")) uids.add(u.id);
  const K = ["core", "log", "qa", "ck"], L = {};
  for (const uid of uids) {
    const g = await Promise.all([...K.map(k => fs.get(`users/${uid}/data/${k}`)), fs.list(`gifts/${uid}/g`), fs.get(`names/${uid}`), fs.get(`users/${uid}`), fs.get(`members/${uid}`)]);
    // الاسم من وثيقة الأسماء، وإن لم تكن (كبعض الحسابات القديمة) فمن وثيقة المستخدم كما في قائمة المستخدمين و«لقطة الحسابات»؛ ورقم الحساب من وثيقة التفعيل
    L[uid] = { d: Object.fromEntries(K.map((k, i) => [k, g[i]])), gifts: g[4], name: g[5] && g[5].data.name || g[6] && g[6].data.name || "", user: !!g[6], no: g[7] && g[7].data.no != null ? +g[7].data.no : null };
  }
  await loadCfg(fs);   // إعدادات المشرف، كما يحسبها التطبيق والمزامنة
  const accts = {}; let same = true;
  for (const uid of uids) {
    const l = L[uid], bd = k => B.get(`users/${uid}/data/${k}`), docs = {};
    for (const k of K) { const x = bd(k), y = l.d[k]; docs[k] = !x && !y ? "none" : !x ? "missing-bak" : !y ? "missing-live" : stab(x.data) === stab(y.data) ? "same" : "diff" }
    const bg = [...B].filter(([p]) => p.startsWith(`gifts/${uid}/g/`)).map(([p, x]) => ({ id: p.split("/").pop(), ...x.data })).sort((a, c) => a.id < c.id ? -1 : 1);
    const lg = [...l.gifts].sort((a, c) => a.id < c.id ? -1 : 1);
    docs.gifts = stab(bg) === stab(lg) ? "same" : "diff";
    const sum = (d, gifts) => d.core ? acctSum(parseJ(d.core.v, {}), parseJ(d.log && d.log.v, null), parseJ(d.qa && d.qa.v, null), parseJ(d.ck && d.ck.v, null), gifts) : null;
    const bs = sum(Object.fromEntries(K.map(k => [k, bd(k) && bd(k).data])), bg), ls = sum(Object.fromEntries(K.map(k => [k, l.d[k] && l.d[k].data])), lg);
    const sd = bs && ls ? Object.keys(bs).filter(k => stab(bs[k]) !== stab(ls[k])) : [bs ? "غير موجود الآن" : "غير موجود في النسخة"];
    const docSame = Object.values(docs).every(v => v === "same" || v === "none");
    if (!docSame || sd.length) same = false;
    accts[uid] = { name: l.name || (B.get(`names/${uid}`) || { data: {} }).data.name || (B.get(`users/${uid}`) || { data: {} }).data.name || "", no: l.no, userDoc: l.user, docs, docSame,
      coreUt: { bak: bd("core") ? bd("core").ut : "", live: l.d.core ? l.d.core.updateTime : "" }, bak: bs, live: ls, diff: sd };
  }
  return { ok: true, key, at: b.at, cmpAt, n: b.docs.length, result: same ? "match" : "diff", accts,
    // للتوافق مع الواجهة القديمة
    bak: Object.fromEntries(Object.entries(accts).filter(([, a]) => a.bak).map(([u, a]) => [u, { name: a.name, ...a.bak }])),
    live: Object.fromEntries(Object.entries(accts).filter(([, a]) => a.live).map(([u, a]) => [u, { name: a.name, ...a.live }])),
    diff: Object.fromEntries(Object.entries(accts).map(([u, a]) => [u, a.docSame ? a.diff : [...new Set([...a.diff, ...Object.entries(a.docs).filter(([, v]) => v !== "same" && v !== "none").map(([k]) => "وثيقة " + k)])]])) };
}
// المشرف: قائمة النسخ، نسخة الآن، تجربة الاسترجاع (فكّ النسخة وفحصها بلا كتابة)، الاسترجاع الفعلي
async function handleBackup(fs, user, body, env) {
  if (user.email !== ADMIN) return { status: 403, json: { error: "admin" } };
  if (!env.BAK) return { status: 500, json: { error: "nokv" } };
  const op = String(body.op || "list"), key = String(body.key || "");
  if (op === "list") { const l = (await env.BAK.list({ prefix: "bak-" })).keys.sort((a, b) => a.name < b.name ? 1 : -1); return { status: 200, json: { items: l.map(k => ({ key: k.name, ...(k.metadata || {}) })) } } }
  if (op === "now") return { status: 200, json: await backupOnce(env, fs, body.rid, "manual") };
  // لقطة الحسابات الآن (للتوثيق قبل التحديث وبعده)
  if (op === "snap") { await loadCfg(fs); return { status: 200, json: { at: Date.now(), cv: typeof CORE_V !== "undefined" ? CORE_V : "", accts: await liveSums(fs) } } }
  const b = await loadBak(env, key);
  if (op === "test") {
    const per = {}; for (const d of b.docs) { const p = d.name.slice(DOCROOT.length + 1).split("/"), c = p.length > 2 ? p[0] + "/…/" + p[p.length - 2] : p[0]; per[c] = (per[c] || 0) + 1 }
    const bad = b.docs.filter(d => !d.name.startsWith(DOCROOT + "/") || typeof d.fields !== "object").length;
    return { status: 200, json: { ok: !bad, at: b.at, n: b.docs.length, bad, per } };
  }
  // تحقق كامل بلا كتابة: تُفكّ النسخة وتُعاد بناء كل الحسابات منها، وتُقارن بالحسابات الحيّة
  if (op === "verify") return { status: 200, json: await verifyBak(fs, b, key) };
  if (op === "verify1") {
    const fromBak = bakSums(b), live = await liveSums(fs), diff = {};
    for (const uid of new Set([...Object.keys(fromBak), ...Object.keys(live)])) {
      const a = fromBak[uid], c = live[uid], d = [];
      if (!a || !c) d.push(!a ? "غير موجود في النسخة" : "غير موجود الآن");
      else for (const k of Object.keys(a)) if (JSON.stringify(a[k]) !== JSON.stringify(c[k])) d.push(k);
      diff[uid] = d;
    }
    return { status: 200, json: { ok: true, at: b.at, n: b.docs.length, bak: fromBak, live, diff } };
  }
  // تنزيل النسخة ملفًّا إلى جهاز المشرف (نسخة خارج Cloudflare وFirebase)
  if (op === "download") {
    const raw = new Uint8Array(await env.BAK.get(key, "arrayBuffer")); let bin = ""; for (let i = 0; i < raw.length; i += 32768) bin += String.fromCharCode.apply(null, raw.subarray(i, i + 32768));
    return { status: 200, json: { name: key + ".json.gz", b64: btoa(bin), size: raw.length } };
  }
  if (op === "restore") {
    if (body.confirm !== key) return { status: 400, json: { error: "confirm" } };
    const before = await backupNow(env, "before-restore");   // نسخة من الوضع الحالي أولًا، للتراجع إن لزم
    const H = await gauth(env), W = b.docs.filter(d => d.name.startsWith(DOCROOT + "/")).map(d => ({ update: { name: d.name, fields: d.fields }, ...(/\/aichat\/[^/]+\/m\//.test(d.name) ? { updateMask: { fieldPaths: Object.keys(d.fields) } } : {}) }));
    // نقطة حفظ السجل التي لم تكن في النسخة تُفرَّغ: وإلا اختلطت بسجلّ أقدم منها
    const inBak = new Set(b.docs.map(d => d.name));
    for (const u of await fs.list("users")) { const n = `${DOCROOT}/users/${u.id}/data/ck`; if (!inBak.has(n)) W.push({ update: { name: n, fields: { v: { stringValue: "" } } } }) }
    for (let k = 0; k < W.length; k += 400) { const r = await fetch(FS_BASE + ":commit", { method: "POST", headers: H, body: JSON.stringify({ writes: W.slice(k, k + 400) }) }); if (!r.ok) throw new Error("restore " + r.status + " " + (await r.text()).slice(0, 150)) }
    return { status: 200, json: { ok: true, n: W.length, before: before.key } };
  }
  return { status: 400, json: { error: "op" } };
}

/* ---------- تتبّع الأخطاء: أخطاء التطبيق والخادم تُجمع هنا ويراها المشرف ---------- */
async function errHash(s) { return [...new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s)))].slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("") }

/* تنقية نص الخطأ قبل حفظه. تزيل أنماطًا محددة فقط، وكل ما عداها يبقى كما هو:
   - رموز الدخول (eyJ… وما بعد Bearer) ← [رمز]
   - عناوين البريد ← [بريد]
   - معرّفات الحسابات داخل مسارات المجموعات (users/…) أو بعد uid= ← [معرّف]
   - معاملات الروابط ما عدا v= (رقم نسخة core.js)، وما بعد # إن لم يكن اسم صفحة قصيرًا
   يبقى: نوع الخطأ والرسالة وأسماء الدوال والملفات وأرقام السطور والأعمدة ورقم النسخة والأرقام عمومًا.
   حدودها: لا تكتشف الأسماء الشخصية ولا أي نص حرّ آخر داخل الرسالة؛ فهي ليست ضمانًا كاملًا لإزالة البيانات الشخصية. */
const SAN_COLL = "users|names|pub|fr|on|gifts|members|assign|threads|feedback|rd|join|duel|bakrid|m|g|lg";
const SAN_ID = new RegExp(`((?:^|[\\s/'"(\`])(?:${SAN_COLL})/)([A-Za-z0-9]{20,40})(?=$|[\\s/'"\`)?#.,:;])`, "g");
function sanErr(s, tags) {
  s = String(s == null ? "" : s); const add = (k, n) => { if (n) tags[k] = (tags[k] || 0) + n }; let n = 0;
  // الروابط أولًا: يبقى العنوان والمسار ورقم النسخة v= والسطر والعمود؛ تُحذف بقية المعاملات وما بعد # إن لم يكن اسم صفحة
  s = s.replace(/(https?:\/\/[^\s?#'"()<>`]+)(\?[^\s#'"()<>`]*?)?(#[^\s'"()<>`]*?)?((?::\d+){0,2})(?=$|[\s'"()<>`,;])/g, (m, u, q, h, lc) => {
    let o = u;
    if (q) { const ps = q.slice(1).split("&").filter(Boolean), keep = ps.filter(p => /^v=[0-9A-Za-z._-]{1,24}$/.test(p)); if (keep.length) o += "?" + keep.join("&"); if (keep.length !== ps.length) n++ }
    if (h) { if (/^#[A-Za-z0-9_-]{0,30}$/.test(h)) o += h; else { o += "#[…]"; n++ } }
    return o + (lc || "");
  }); add("رابط", n); n = 0;
  s = s.replace(/eyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]{5,}/g, () => (n++, "[رمز]"));
  s = s.replace(/\b(Bearer)\s+(?!\[رمز\])[\w.~+\/-]+=*/gi, (m, b) => (n++, b + " [رمز]")); add("رمز", n); n = 0;
  s = s.replace(/[\w.%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g, () => (n++, "[بريد]")); add("بريد", n); n = 0;
  s = s.replace(SAN_ID, (m, a) => (n++, a + "[معرّف]"));
  s = s.replace(/\b(uid|userId|user)([=:]\s*)([A-Za-z0-9]{20,40})\b/g, (m, a, b) => (n++, a + b + "[معرّف]")); add("معرّف", n);
  return s;
}
const sanWhere = (w, tags) => { w = sanErr(w, tags); if (/^#/.test(w) && !/^#[A-Za-z0-9_-]{0,30}$/.test(w)) { tags["رابط"] = (tags["رابط"] || 0) + 1; return "#[…]" } return w };
const sanTag = tags => Object.entries(tags).map(([k, v]) => k + ":" + v).join("،");
// حقول الخطأ بعد القصّ والتنقية، والبصمة من النص المنقّى (فالخطأ نفسه لحسابين مختلفين مجموعة واحدة)
async function errFields(e, src) {
  const tags = {}, msg = sanErr(String(e.msg || "").slice(0, 300), tags).slice(0, 300);
  if (!msg) return null;
  const stack = sanErr(String(e.stack || "").slice(0, 1500), tags).slice(0, 1500), where = sanWhere(String(e.where || "").slice(0, 200), tags).slice(0, 200);
  const top = stack.split("\n").find(l => /:\d+:\d+/.test(l)) || "";
  const id = await errHash(src + "|" + msg.replace(/\d+/g, "#") + "|" + top.replace(/\?[^:]*/, ""));
  return { id, msg, stack, src, where, ua: sanErr(String(e.ua || "").slice(0, 200), tags).slice(0, 200), ver: String(e.ver || "").slice(0, 40), san: sanTag(tags) };
}
// أخطاء الخادم نفسه: تُسجَّل مباشرة كما كانت (خارج البوّابة)، بعد التنقية
async function logErr(fs, e) {
  const f = await errFields(e, e.src === "server" ? "server" : "app"); if (!f) return;
  const now = Date.now(), old = await fs.get(`errs/${f.id}`), d = old ? old.data : null;
  const users = [...new Set([...(d && d.users || []), e.uid || ""].filter(Boolean))].slice(-20);
  await fs.commit([{ path: `errs/${f.id}`, data: { msg: f.msg, stack: d && d.stack || f.stack, src: f.src, where: f.where || d && d.where || "", ua: f.ua || d && d.ua || "",
    ver: f.ver, san: f.san, n: (d && d.n || 0) + 1, first: d && d.first ? { __ts: d.first.ms } : { __ts: now }, last: { __ts: now }, users } }]);
}

// أخطاء الخادم نفسه تمرّ بالبوّابة أيضًا (السقوف نفسها: المستخدم الذي سبّبها، أو «server» للأعمال المجدولة).
// إن تعذّرت البوّابة: كتابة مباشرة مرة واحدة على الأكثر كل 10 دقائق لكل نسخة من الخادم (حتى لا يختفي عطل النسخ الاحتياطي مثلًا).
// ERR_MODE=off (متغيّر في لوحة Cloudflare): إيقاف تسجيل الأخطاء كله فورًا دون نشر شيفرة (للتراجع السريع).
let SRVDIRECT = 0;
async function srvErr(env, e, uid) {
  try {
    if (env.ERR_MODE === "off") return;
    const f = await errFields(e, "server"); if (!f) return;
    if (env.ERRGATE) { try { await egCall(env, "report", { ...f, uid: uid || "server" }); return } catch (x) { } }
    if (Date.now() - SRVDIRECT < 10 * 60e3) return; SRVDIRECT = Date.now();
    await logErr(env.__fs || makeFS(env), { ...e, src: "server", uid: uid && uid !== "server" ? uid : "" });
  } catch (x) { }
}

/* ---------- بوّابة الأخطاء (Durable Object واحد للعالم) ----------
   أخطاء التطبيق (/err) لا تُكتب في Firestore مباشرة ولا يُقرأ Firestore في مسارها: البوّابة تقرّر وتعدّ وتكتب على دفعات.
   - السقوف اليومية (يوم برلين): المجهولون 30 مجموعة جديدة و300 بلاغ؛ كل مستخدم مسجّل 30 مجموعة و200 بلاغ؛ الكل 2000 بلاغ.
     ما زاد للمسجّلين يُجمع في «ملخّص اليوم» (لا يُحجب بصمت)؛ وما زاد للمجهولين يُعدّ فقط.
   - الكتابة في Firestore: من المنبّه وحده، بقيمة مطلقة للعدد (لا زيادة)، مشروطة بوقت آخر تعديل تعرفه البوّابة،
     فلا تُكرَّر الأعداد عند إعادة المحاولة، ولا تُنزلها كتابة متأخرة.
   - محاولات الكتابة والقراءة في Firestore: 2000 على الأكثر في أي 24 ساعة متتالية (مجموعات 1880، ملخّص 96، سجلّ errq 24).
   - حذف المشرف: تُبلَّغ البوّابة أولًا (تنسى ما رآه المشرف، وتحتفظ بالبلاغات التي لم تصل إليه بعد)، ولا يرجع الردّ قبل أن تنتهي أي كتابة جارية. */
const EG = { anNew: 30, anRep: 300, uNew: 30, uRep: 200, allRep: 2000, wb: { g: 1880, s: 96, q: 24 }, rb: 2000, anGap: 30 * 60e3, flushGap: 60e3, slowAfter: 60, slowGap: 15 * 60e3, sumGap: 15 * 60e3,
  users: 20, ru: 50, sumMax: 50, perAlarm: 15, backoff: [60e3, 120e3, 300e3, 900e3, 3600e3], delWait: 5 * 60e3 };
const egStub = env => env.ERRGATE.get(env.ERRGATE.idFromName("errgate"));
async function egCall(env, op, body) { const r = await egStub(env).fetch("https://errgate/" + op, { method: "POST", body: JSON.stringify(body || {}) }); if (!r.ok) throw new Error("errgate " + r.status); return r.json() }
const egSumId = day => errHash("summary|" + day);

export class ErrGate {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env; this.sql = ctx.storage.sql; this.anonMem = new Map(); this.anonDrop = 0; this.inflight = null;
    for (const q of [
      "CREATE TABLE IF NOT EXISTS g(id TEXT PRIMARY KEY, kind TEXT, msg TEXT, stack TEXT, src TEXT, wh TEXT, ua TEXT, ver TEXT, san TEXT, first INTEGER, last INTEGER, users TEXT, total INTEGER, base INTEGER, conf INTEGER, sent INTEGER, ut TEXT, st TEXT, gen INTEGER, delAt INTEGER, lastAn INTEGER, ru TEXT, rf INTEGER, wday TEXT, wn INTEGER, lastW INTEGER)",
      "CREATE TABLE IF NOT EXISTS q(day TEXT PRIMARY KEY, an INTEGER, aw INTEGER, tw INTEGER, sm INTEGER)",
      "CREATE TABLE IF NOT EXISTS qu(day TEXT, uid TEXT, ng INTEGER, w INTEGER, PRIMARY KEY(day, uid))",
      "CREATE TABLE IF NOT EXISTS wb(h INTEGER, k TEXT, n INTEGER, PRIMARY KEY(h, k))",
      "CREATE TABLE IF NOT EXISTS sx(day TEXT PRIMARY KEY, data TEXT, n INTEGER, ver INTEGER)",
      "CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT)"]) this.sql.exec(q);
  }
  rows(q, ...a) { return this.sql.exec(q, ...a).toArray() }
  row(q, ...a) { return this.rows(q, ...a)[0] || null }
  meta(k, v) { if (v === undefined) { const r = this.row("SELECT v FROM meta WHERE k=?", k); return r ? r.v : null } this.sql.exec("INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", k, String(v)) }
  ensureAlarm(at) { const cur = +this.meta("alarm") || 0; if (cur && cur <= at) return; this.meta("alarm", at); const p = this.ctx.storage.setAlarm(at); if (p && p.catch) p.catch(() => { }) }
  async fetch(req) {
    const op = new URL(req.url).pathname.slice(1), b = await req.json().catch(() => ({}));
    try {
      if (op === "report") return Response.json(this.report(b));
      if (op === "del") return Response.json(await this.del(b));
      if (op === "state") return Response.json(this.state());
      return new Response("op", { status: 400 });
    } catch (e) { return new Response(String(e && e.message || e), { status: 500 }) }
  }
  // بلاغ واحد: كل ما هنا متزامن (بلا await)، فيُنفَّذ كاملًا قبل أي حدث آخر ويُحفظ كمعاملة واحدة
  report(b) {
    const now = Date.now(), day = dkey(now), anon = !b.uid, id = String(b.id || "");
    if (!/^[0-9a-f]{16}$/.test(id)) return { r: "id" };
    const q = this.row("SELECT * FROM q WHERE day=?", day) || { day, an: 0, aw: 0, tw: 0, sm: 0 };
    let g = this.row("SELECT * FROM g WHERE id=?", id);
    const fresh = !g || (g.st === "gone" && !g.total);
    const saveQ = () => this.sql.exec("INSERT INTO q(day,an,aw,tw,sm) VALUES(?,?,?,?,?) ON CONFLICT(day) DO UPDATE SET an=excluded.an,aw=excluded.aw,tw=excluded.tw,sm=excluded.sm", day, q.an, q.aw, q.tw, q.sm);
    if (anon) {
      if (!fresh && now - (g.lastAn || 0) < EG.anGap) { this.anonMem.set(id, (this.anonMem.get(id) || 0) + 1); this.ensureAlarm(now + EG.flushGap); return { r: "mem" } }
      if ((fresh && q.an >= EG.anNew) || q.aw >= EG.anRep || q.tw >= EG.allRep) { this.anonDrop++; return { r: "drop" } }
      if (fresh) q.an++; q.aw++;
    } else {
      const u = this.row("SELECT * FROM qu WHERE day=? AND uid=?", day, b.uid) || { ng: 0, w: 0 };
      if ((fresh && u.ng >= EG.uNew) || u.w >= EG.uRep || q.tw >= EG.allRep) { this.toSum(day, b, now); q.sm++; saveQ(); this.ensureAlarm(now + EG.flushGap); return { r: "sum" } }
      if (fresh) u.ng++; u.w++;
      this.sql.exec("INSERT INTO qu(day,uid,ng,w) VALUES(?,?,?,?) ON CONFLICT(day,uid) DO UPDATE SET ng=excluded.ng,w=excluded.w", day, b.uid, u.ng, u.w);
    }
    q.tw++; saveQ();
    if (!g) {
      this.sql.exec("INSERT INTO g(id,kind,msg,stack,src,wh,ua,ver,san,first,last,users,total,base,conf,sent,ut,st,gen,delAt,lastAn,ru,rf,wday,wn,lastW) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        id, "err", b.msg || "", b.stack || "", b.src || "app", b.where || "", b.ua || "", b.ver || "", b.san || "", now, now, JSON.stringify(b.uid ? [b.uid] : []), 1, 0, 0, -1, "", "new", 0, 0, anon ? now : 0,
        JSON.stringify(b.uid ? [b.uid] : []), now, day, 0, 0);
    } else {
      if (g.st === "gone") { g.st = "new"; g.total = 0; g.base = 0; g.conf = 0; g.sent = -1; g.users = "[]"; g.first = now; g.ru = "[]"; g.rf = 0; g.msg = b.msg || g.msg; g.stack = b.stack || g.stack }
      const users = JSON.parse(g.users || "[]"), ru = JSON.parse(g.ru || "[]");
      if (b.uid && !users.includes(b.uid)) { users.push(b.uid); if (users.length > EG.users) users.shift() }
      if (b.uid && !ru.includes(b.uid) && ru.length < EG.ru) ru.push(b.uid);
      const rf = g.total > g.conf ? g.rf : now;   // أول بلاغ لم يصل إلى المشرف بعد
      this.sql.exec("UPDATE g SET st=?,msg=?,stack=?,first=?,last=?,users=?,total=?,base=?,conf=?,sent=?,wh=?,ua=?,ver=?,san=?,lastAn=?,ru=?,rf=? WHERE id=?",
        g.st, g.msg, g.stack || b.stack || "", g.first, now, JSON.stringify(users), g.total + 1, g.base, g.conf, g.sent, b.where || g.wh, b.ua || g.ua, b.ver || g.ver, b.san || g.san, anon ? now : g.lastAn, JSON.stringify(ru), rf, id);
    }
    this.ensureAlarm(now + EG.flushGap);
    return { r: "ok" };
  }
  // بلاغ مسجّل فوق السقف: يُعدّ في ملخّص اليوم (البصمة والرسالة المنقّاة وأول ملف:سطر، وعدد المستخدمين لا معرّفاتهم)
  toSum(day, b, now) {
    const r = this.row("SELECT * FROM sx WHERE day=?", day), d = r ? JSON.parse(r.data) : { g: {}, more: 0, an: 0, first: now, last: now };
    const top = (String(b.stack || "").split("\n").find(l => /:\d+:\d+/.test(l)) || b.where || "").trim().slice(0, 120);
    let x = d.g[b.id];
    if (!x) { if (Object.keys(d.g).length >= EG.sumMax) { d.more++; x = null } else x = d.g[b.id] = { m: String(b.msg || "").slice(0, 120), f: top, n: 0, u: [] } }
    if (x) { x.n++; if (b.uid && !x.u.includes(b.uid) && x.u.length < 50) x.u.push(b.uid) }
    d.last = now;
    this.sql.exec("INSERT INTO sx(day,data,n,ver) VALUES(?,?,?,?) ON CONFLICT(day) DO UPDATE SET data=excluded.data,n=excluded.n,ver=excluded.ver", day, JSON.stringify(d), (r ? r.n : 0) + 1, (r ? r.ver : 0) + 1);
  }
  // حذف المشرف: تُنسى الأعداد التي وصلت إليه، وتبقى البلاغات التي لم تُكتب بعد (لم يرها)، ولا نرد قبل انتهاء أي كتابة جارية
  async del(b) {
    const now = Date.now(), ids = b.all ? this.rows("SELECT id FROM g").map(r => r.id) : (b.ids || []).filter(x => /^[0-9a-f]{16}$/.test(x));
    for (const id of ids) {
      const g = this.row("SELECT * FROM g WHERE id=?", id); if (!g) continue;
      const keep = Math.max(0, g.total - g.conf) + (this.anonMem.get(id) || 0); this.anonMem.delete(id);
      const ru = JSON.parse(g.ru || "[]");
      this.sql.exec("UPDATE g SET st=?,total=?,base=0,conf=0,sent=-1,ut='',users=?,first=?,gen=gen+1,delAt=?,ru='[]',rf=0 WHERE id=?",
        keep ? "new" : "gone", keep, JSON.stringify(keep ? ru : []), keep ? (g.rf || now) : now, now, id);
    }
    if (b.all) { this.sql.exec("DELETE FROM sx"); this.anonDrop = 0 }
    else for (const id of ids) { const g = this.row("SELECT kind,msg FROM g WHERE id=?", id); if (g && g.kind === "sum") this.sql.exec("DELETE FROM sx WHERE day=?", g.msg) }
    if (this.inflight) { try { await this.inflight } catch (e) { } }
    return { ok: true, n: ids.length };
  }
  state() { return { g: this.rows("SELECT * FROM g"), q: this.rows("SELECT * FROM q"), qu: this.rows("SELECT * FROM qu"), wb: this.rows("SELECT * FROM wb"), sx: this.rows("SELECT * FROM sx"), anonMem: [...this.anonMem], anonDrop: this.anonDrop, alarm: +this.meta("alarm") || 0 } }
  // ميزانية Firestore: المحاولات في آخر 24 ساعة (سلال ساعية)
  used(k) { const h = Math.floor(Date.now() / 3600e3); const r = this.row("SELECT SUM(n) s FROM wb WHERE k=? AND h>?", k, h - 24); return r && r.s || 0 }
  spend(k) { const h = Math.floor(Date.now() / 3600e3); this.sql.exec("INSERT INTO wb(h,k,n) VALUES(?,?,1) ON CONFLICT(h,k) DO UPDATE SET n=n+1", h, k); this.sql.exec("DELETE FROM wb WHERE h<?", h - 48) }
  can(k) { return k === "r" ? this.used("r") < EG.rb : this.used(k) < EG.wb[k] }
  docOf(g) { return { msg: g.msg, stack: g.stack, src: g.src, where: g.wh, ua: g.ua, ver: g.ver, san: g.san, n: g.base + g.total, first: { __ts: g.first }, last: { __ts: g.last }, users: JSON.parse(g.users || "[]") } }
  // كتابة واحدة بشرط: «غير موجودة» للجديدة، أو «لم تتغير منذ وقت آخر تعديل نعرفه». تعيد: ok | conflict | error
  async put(fs, path, data, g) {
    const w = g.st === "live" && g.ut ? { path, data, ifUpdateTime: g.ut } : { path, data, ifMissing: true };
    try { const r = await fs.commit([w]); return { r: "ok", ut: r && r[0] || "" } }
    catch (e) { return { r: e && (e.conflict || e.status === 404) ? "conflict" : "error", e } }
  }
  async alarm() {
    this.meta("alarm", 0);
    let p; this.inflight = p = this.flush().finally(() => { if (this.inflight === p) this.inflight = null });
    let res; try { res = await p } catch (e) { res = { failed: true } }
    const fails = res && res.failed ? (+this.meta("fails") || 0) + 1 : 0; this.meta("fails", fails);
    const now = Date.now();
    if (res && (res.pending || res.failed)) this.ensureAlarm(now + (fails ? EG.backoff[Math.min(fails - 1, EG.backoff.length - 1)] : res.wait || EG.flushGap));
  }
  pending() { return this.rows("SELECT * FROM g WHERE kind='err' AND st!='gone' AND total>0 AND (base+total)!=sent ORDER BY last") }
  async flush() {
    const fs = this.env.__fs || makeFS(this.env), now = Date.now(); let failed = false, pending = false, done = 0, wait = 0;
    // البلاغات المجهولة المقيّدة (في الذاكرة) تُضاف الآن إلى أعداد مجموعاتها
    for (const [id, n] of this.anonMem) this.sql.exec("UPDATE g SET total=total+?, last=? WHERE id=? AND st!='gone'", n, now, id); this.anonMem.clear();
    if (this.anonDrop) { const day = dkey(now), r = this.row("SELECT * FROM sx WHERE day=?", day), d = r ? JSON.parse(r.data) : { g: {}, more: 0, an: 0, first: now, last: now }; d.an += this.anonDrop; d.last = now; this.anonDrop = 0;
      this.sql.exec("INSERT INTO sx(day,data,n,ver) VALUES(?,?,?,?) ON CONFLICT(day) DO UPDATE SET data=excluded.data,n=excluded.n,ver=excluded.ver", day, JSON.stringify(d), (r ? r.n : 0), (r ? r.ver : 0) + 1) }
    // 1) المجموعات
    for (const g0 of this.pending()) {
      if (done >= EG.perAlarm) { pending = true; break }
      const day = dkey(now), wn = g0.wday === day ? g0.wn : 0;
      if (wn >= EG.slowAfter && now - g0.lastW < EG.slowGap) { pending = true; continue }
      if (!this.can("g")) { pending = true; wait = 3600e3; break }
      const snap = { total: g0.total, base: g0.base, gen: g0.gen }, data = this.docOf(g0);
      this.spend("g"); done++; this.sql.exec("UPDATE g SET wday=?, wn=?, lastW=? WHERE id=?", day, wn + 1, now, g0.id);
      const r = await this.put(fs, `errs/${g0.id}`, data, g0);
      const g = this.row("SELECT * FROM g WHERE id=?", g0.id);
      if (!g || g.gen !== snap.gen) continue;            // حُذفت أثناء الكتابة: النتيجة لا تُعتمد
      if (r.r === "ok") { const caught = g.total === snap.total; this.sql.exec("UPDATE g SET st='live', ut=?, sent=?, conf=?, ru=? WHERE id=?", r.ut, snap.base + snap.total, snap.total, caught ? "[]" : g.ru, g.id); if (!caught) pending = true; continue }
      if (r.r === "error") { failed = true; pending = true; break }
      // تعارض: نقرأ الوثيقة وحدها
      if (!this.can("r")) { pending = true; wait = 3600e3; continue }
      this.spend("r"); let cur; try { cur = await fs.get(`errs/${g.id}`) } catch (e) { failed = true; pending = true; break }
      const g2 = this.row("SELECT * FROM g WHERE id=?", g.id); if (!g2 || g2.gen !== snap.gen) continue;
      if (!cur) {
        if (g2.st === "live") {                          // حذفها المشرف دون أن تصلنا رسالته: نعاملها كحذف
          const keep = Math.max(0, g2.total - g2.conf);
          this.sql.exec("UPDATE g SET st=?,total=?,base=0,conf=0,sent=-1,ut='',users=?,first=?,gen=gen+1,delAt=?,ru='[]',rf=0 WHERE id=?", keep ? "new" : "gone", keep, keep ? g2.ru : "[]", keep ? (g2.rf || now) : now, now, g2.id);
        }
        pending = true; continue;                        // الجديدة تُعاد بشرط «غير موجودة»
      }
      const n = +cur.data.n || 0;
      if (g2.st === "live") {                            // كتابة سابقة لنا وصلت متأخرة: نأخذ وقتها، والعدد لا ينزل أبدًا
        const mine = g2.base + g2.total; this.sql.exec("UPDATE g SET ut=?, sent=?, base=? WHERE id=?", cur.updateTime, n, n > mine ? g2.base + (n - mine) : g2.base, g2.id); pending = true; continue;
      }
      if (g2.gen > 0) {                                  // بعد حذف المشرف: الوثيقة القديمة لم تُحذف بعد من Firestore
        if (now - (g2.delAt || 0) < EG.delWait) { pending = true; continue }
        this.sql.exec("UPDATE g SET st='live', ut=?, sent=? WHERE id=?", cur.updateTime, n, g2.id); pending = true; continue;   // تعذّر حذفها: نكتب فوقها بأعداد ما بعد الحذف
      }
      // وثيقة موجودة من قبل البوّابة: نبدأ من عددها، ونجمع المستخدمين، ونأخذ أول ظهور
      const users = [...new Set([...(cur.data.users || []), ...JSON.parse(g2.users || "[]")])].slice(-EG.users), first = Math.min(g2.first, cur.data.first && cur.data.first.ms || g2.first);
      this.sql.exec("UPDATE g SET st='live', ut=?, sent=?, base=?, users=?, first=?, stack=? WHERE id=?", cur.updateTime, n, n, JSON.stringify(users), first, cur.data.stack || g2.stack, g2.id); pending = true;
    }
    // 2) ملخّص الأيام: كل 15 دقيقة على الأكثر، وفقط إن تغيّر
    for (const s of this.rows("SELECT * FROM sx ORDER BY day")) {
      const id = await egSumId(s.day); let g = this.row("SELECT * FROM g WHERE id=?", id);
      if (!g) { this.sql.exec("INSERT INTO g(id,kind,msg,stack,src,wh,ua,ver,san,first,last,users,total,base,conf,sent,ut,st,gen,delAt,lastAn,ru,rf,wday,wn,lastW) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        id, "sum", s.day, "", "app", "summary", "", "", "", now, now, "[]", 0, 0, 0, -1, "", "new", 0, 0, 0, "[]", 0, "", 0, 0); g = this.row("SELECT * FROM g WHERE id=?", id) }
      if (g.sent === s.ver) continue;
      if (now - g.lastW < EG.sumGap) { pending = true; continue }
      if (!this.can("s")) { pending = true; wait = 3600e3; continue }
      const d = JSON.parse(s.data), list = Object.values(d.g).sort((a, b) => b.n - a.n), tot = list.reduce((a, x) => a + x.n, 0) + d.an;
      const lines = list.map(x => `${x.n}× [مسجّل، ${x.u.length} مستخدم] ${x.m}${x.f ? " — " + x.f : ""}`);
      if (d.more) lines.push(`… و${d.more} خطأ آخر لم يُفصَّل`); if (d.an) lines.push(`${d.an} بلاغ من غير مسجّلين حُجب (العدد فقط)`);
      const data = { msg: `⚠️ بلاغات فوق السقف يوم ${s.day}: ${tot}`, stack: lines.join("\n").slice(0, 6000), src: "app", where: "summary", ua: "", ver: "", san: "", n: tot, first: { __ts: d.first }, last: { __ts: d.last }, users: [] };
      const ver = s.ver, gen = g.gen; this.spend("s"); this.sql.exec("UPDATE g SET lastW=? WHERE id=?", now, id);
      const r = await this.put(fs, `errs/${id}`, data, g);
      const g2 = this.row("SELECT * FROM g WHERE id=?", id); if (!g2 || g2.gen !== gen) continue;
      if (r.r === "ok") { this.sql.exec("UPDATE g SET st='live', ut=?, sent=? WHERE id=?", r.ut, ver, id); continue }
      if (r.r === "error") { failed = true; pending = true; break }
      if (!this.can("r")) { pending = true; continue }
      this.spend("r"); let cur; try { cur = await fs.get(`errs/${id}`) } catch (e) { failed = true; pending = true; break }
      const g3 = this.row("SELECT * FROM g WHERE id=?", id); if (!g3 || g3.gen !== gen) continue;
      this.sql.exec("UPDATE g SET st=?, ut=? WHERE id=?", cur ? "live" : "new", cur ? cur.updateTime : "", id); pending = true;
    }
    // 3) سجلّ اليوم السابق في errq (مرة واحدة لكل يوم، بلا معرّفات)
    const today = dkey(now);
    for (const d of this.rows("SELECT * FROM q WHERE day<? ORDER BY day", today)) {
      if (this.meta("errq:" + d.day)) continue;
      if (!this.can("q")) { pending = true; break }
      this.spend("q");
      const users = this.row("SELECT COUNT(*) c FROM qu WHERE day=?", d.day).c;
      try { await fs.commit([{ path: `errq/${d.day}`, data: { day: d.day, anonNew: d.an, anonReports: d.aw, reports: d.tw, overCap: d.sm, users }, ifMissing: true }]); this.meta("errq:" + d.day, 1) }
      catch (e) { if (e && e.conflict) this.meta("errq:" + d.day, 1); else { failed = true; pending = true; break } }
    }
    if (!failed && this.pending().length) pending = true;
    return { pending, failed, wait };
  }
}

let ERRN = { t: 0, n: 0 };   // طبقة أولى رخيصة: 30 خطأ في الدقيقة على الأكثر لكل نسخة من الخادم
async function handleErr(req, env, H) {
  const ok = () => new Response("{}", { headers: { ...H, "Content-Type": "application/json" } });
  if (env.ERR_MODE === "off") return ok();     // مفتاح الإيقاف: لا تسجيل ولا Firestore ولا بوّابة
  if (!ORIGINS.includes(req.headers.get("Origin") || "")) return new Response("{}", { status: 403, headers: H });
  if (Date.now() - ERRN.t > 60e3) ERRN = { t: Date.now(), n: 0 };
  if (++ERRN.n > 30) return new Response("{}", { status: 429, headers: H });
  const txt = await req.text(); if (txt.length > 6000) return new Response("{}", { status: 413, headers: H });
  let b = {}; try { b = JSON.parse(txt) } catch (e) { return ok() }
  const f = await errFields(b || {}, "app"); if (!f) return ok();
  let uid = ""; try { uid = (await verifyIdToken((req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, ""))).uid } catch (e) { }
  if (!env.ERRGATE) return ok();                 // بلا بوّابة لا كتابة أبدًا (الفشل مغلق)
  try { await egCall(env, "report", { ...f, uid }) } catch (e) { }
  return ok();
}
async function handleErrs(fs, user, body, env) {
  if (user.email !== ADMIN) return { status: 403, json: { error: "admin" } };
  if (body.del) {
    const all = body.del === "all", ids = all ? [] : [String(body.del)].filter(x => /^[0-9a-f]{16}$/.test(x));
    // البوّابة أولًا: إن لم تؤكّد فلا حذف (لا حالة نصفها محذوف)
    if (env.ERRGATE && (all || ids.length)) { try { await egCall(env, "del", all ? { all: true } : { ids }) } catch (e) { return { status: 503, json: { error: "gate" } } } }
    const del = all ? (await fs.list("errs")).map(x => x.id) : ids;
    for (let k = 0; k < del.length; k += 400) await fs.commit(del.slice(k, k + 400).map(id => ({ path: `errs/${id}`, del: true })));
    return { status: 200, json: { ok: true } };
  }
  const l = (await fs.list("errs")).map(x => ({ id: x.id, msg: x.msg, stack: x.stack, src: x.src, where: x.where, ua: x.ua, ver: x.ver, san: x.san || "", n: x.n, first: x.first && x.first.ms || 0, last: x.last && x.last.ms || 0, users: x.users || [] })).sort((a, b) => b.last - a.last).slice(0, 100);
  return { status: 200, json: { items: l } };
}


/* ---------- الأصدقاء والتحدي المباشر ---------- */
// fr/{uid}: { list: { uid: { s: "f" صديق | "out" طلب أرسلته | "in" طلب وصلني, n: اسم الدخول, t, w: فوز, l: خسارة } }, inv: دعوة تحدٍّ واردة }
// on/{uid}: آخر ظهور (يُكتب مرة في الدقيقة على الأكثر). duel/{id}: التحدي نفسه
const ONLINE = 90e3, INV_TTL = 60e3, DUEL_N = 10;
// لا حدّ كلّي ظاهر: لكل سؤال d.qt ثانية (يحدّدها المشرف ويُثبَّت في التحدي عند إنشائه)،
// وحدّ احتياطي فقط لمن أغلق التطبيق = الأسئلة × (ثواني السؤال + 2) + 15 ثانية
const dQt = d => Math.min(120, Math.max(5, +d.qt || 15));
const dLen = d => DUEL_N * (dQt(d) * 1e3 + 2e3) + 15e3;
const ONA = new Map();   // آخر كتابة لوقت النشاط الحقيقي (لمس أو كتابة من المتعلّم) في هذه النسخة من الخادم
const ONW = new Map();   // آخر كتابة للظهور في هذه النسخة من الخادم (توفير الكتابات)
const loginOf = u => String(u.email || "").split("@")[0];
async function frGet(fs, uid) { const d = await fs.get(`fr/${uid}`); return Object.assign({ list: {}, inv: null }, d ? d.data : {}) }
async function uidOfLogin(env, login) {
  if (env.__fs) return (await env.__fs.get(`members/u_${login}`)) ? "u_" + login : "";
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`, { method: "POST", headers: { Authorization: "Bearer " + await googleToken(env), "Content-Type": "application/json" }, body: JSON.stringify({ email: [login + "@mufradati.app"] }) });
  const j = await r.json().catch(() => ({})); return j.users && j.users[0] ? j.users[0].localId : "";
}
async function loginOfUid(env, uid) {
  if (env.__fs) return uid.replace(/^u_/, "");
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`, { method: "POST", headers: { Authorization: "Bearer " + await googleToken(env), "Content-Type": "application/json" }, body: JSON.stringify({ localId: [uid] }) });
  const j = await r.json().catch(() => ({})); return j.users && j.users[0] ? String(j.users[0].email || "").split("@")[0] : "";
}
// الحساب المفعّل: المشرف، أو له وثيقة تقدّم (users)، أو فعّله المشرف (members) — القاعدة نفسها في المزامنة وقواعد Firestore.
// نتيجة «مفعّل» تُحفظ 10 دقائق في ذاكرة النسخة توفيرًا للقراءات (لا يوجد إلغاء تفعيل في التطبيق)؛ نتيجة «غير مفعّل» لا تُحفظ.
const ACTIVE = new Map();
async function isActive(fs, user) {
  if (user.email === ADMIN) return true;
  const c = ACTIVE.get(user.uid); if (c && Date.now() - c < 10 * 60e3) return true;
  const ok = !!(await fs.get(`members/${user.uid}`)) || !!(await fs.get(`users/${user.uid}`));
  if (ok) { if (ACTIVE.size > 5000) ACTIVE.clear(); ACTIVE.set(user.uid, Date.now()) }
  return ok;
}
async function handleFriends(fs, user, body, env) {
  const me = user.uid, op = String(body.op || "tick"), now = Date.now();
  if (user.email === ADMIN) return { status: 403, json: { error: "admin" } };
  if (!(await isActive(fs, user))) return { status: 403, json: { error: "inactive" } };   // حساب غير مفعّل: لا صداقة ولا ظهور
  if (op === "tick") {
    // نبضة كل بضع ثوانٍ: «أنا متصل»، وهل وصلتني دعوة تحدٍّ؟
    const w = [];
    // t: التطبيق مفتوح وظاهر (للاتصال الآن ودعوات التحدي). a: آخر نشاط حقيقي، فقط إن أخبر التطبيق أن المتعلّم لمس الشاشة أو كتب منذ النبضة السابقة
    const d = {};
    if (now - (ONW.get(me) || 0) > 50e3) { ONW.set(me, now); d.t = { __ts: now } }
    if (body.act && now - (ONA.get(me) || 0) > 50e3) { ONA.set(me, now); d.a = { __ts: now } }
    if (d.t || d.a) w.push({ path: `on/${me}`, data: d, merge: true });
    const f = await frGet(fs, me); if (w.length) await fs.commit(w);
    const inv = f.inv && now - (f.inv.t && f.inv.t.ms || f.inv.t || 0) < INV_TTL ? { id: f.inv.id, from: f.inv.from, name: f.inv.name, with: f.inv.with || [] } : null;
    const L = Object.values(f.list || {});
    return { status: 200, json: { inv, nf: L.filter(x => x.s === "f").length, nin: L.filter(x => x.s === "in").length } };
  }
  if (op === "list") {
    const f = await frGet(fs, me), ids = Object.keys(f.list || {});
    const mm = await fs.get(`members/${me}`), myNo = mm && mm.data.no != null ? String(mm.data.no).padStart(6, "0") : "";   // رقم الحساب نفسه (يظهر في الإعدادات)
    const got = await fs.many(ids.flatMap(id => [`names/${id}`, `on/${id}`]));
    return { status: 200, json: { items: ids.map(id => { const x = f.list[id], nm = got[`names/${id}`], on = got[`on/${id}`], t = on && on.t ? on.t.ms || 0 : 0, a = on && on.a ? on.a.ms || 0 : 0;
      // «آخر ظهور»: آخر نشاط حقيقي (a)، وللحساب الذي لم يرسل تطبيقه النشاط بعد (نسخة قديمة) وقت الظهور كما كان
      return { uid: id, s: x.s, login: x.n || "", name: nm && nm.name || x.n || "", on: now - t < ONLINE, seen: a || t, w: x.w || 0, l: x.l || 0 } }), code: myNo } };
  }
  const other = String(body.uid || "");
  if (op === "add") {
    let login = String(body.login || "").trim().toLowerCase().replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\s/g, ""), o = "";
    if (/^\d{1,9}$/.test(login)) {   // إضافة برقم الحساب (الظاهر في الإعدادات)
      const n = +login; if (n === 0) return { status: 404, json: { error: "nouser" } };
      const hit = await fs.where("members", "no", n); if (!hit) return { status: 404, json: { error: "nouser" } };
      o = hit; if (o === me) return { status: 400, json: { error: "self" } };
      login = await loginOfUid(env, o);
    } else {
      if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(login)) return { status: 400, json: { error: "login" } };
      if (login === loginOf(user) || login === "admin") return { status: 400, json: { error: "self" } };
      o = await uidOfLogin(env, login); if (!o || !(await isActive(fs, { uid: o }))) return { status: 404, json: { error: "nouser" } };
    }
    const [a, b] = await Promise.all([frGet(fs, me), frGet(fs, o)]);
    if (Object.keys(a.list).length >= 100) return { status: 400, json: { error: "many" } };
    const cur = a.list[o];
    if (cur && cur.s === "f") return { status: 200, json: { ok: true, s: "f" } };
    const both = cur && cur.s === "in";   // كان قد أرسل لي طلبًا: نصبح أصدقاء مباشرة
    a.list[o] = { ...(cur || {}), s: both ? "f" : "out", n: login, t: { __ts: now } };
    b.list[me] = { ...(b.list[me] || {}), s: both ? "f" : "in", n: loginOf(user), t: { __ts: now } };
    await fs.commit([{ path: `fr/${me}`, data: { list: a.list }, merge: true }, { path: `fr/${o}`, data: { list: b.list }, merge: true }]);
    return { status: 200, json: { ok: true, s: a.list[o].s } };
  }
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(other)) return { status: 400, json: { error: "uid" } };
  const [a, b] = await Promise.all([frGet(fs, me), frGet(fs, other)]);
  if (op === "acc") {
    if (!a.list[other] || a.list[other].s !== "in") return { status: 400, json: { error: "noreq" } };
    a.list[other].s = "f"; b.list[me] = { ...(b.list[me] || { n: loginOf(user) }), s: "f" };
  } else if (op === "del") { delete a.list[other]; delete b.list[me] }   // رفض طلب، أو إلغاء طلبي، أو حذف صديق
  else return { status: 400, json: { error: "op" } };
  await fs.commit([{ path: `fr/${me}`, data: { list: a.list }, merge: true }, { path: `fr/${other}`, data: { list: b.list }, merge: true }]);
  return { status: 200, json: { ok: true } };
}
// التحدي: ps = اللاعبون (الأوّل هو صاحب الدعوة، حتى 4)، nm = أسماؤهم، a_<uid> = ردّ كل مدعوّ، p_<uid> = تقدّم كل لاعب
// (حقول منفصلة لكل لاعب حتى لا تمحو كتابةُ لاعبٍ كتابةَ آخر)
const DUEL_MAX = 4;
const dAct = d => (d.ps || []).filter((u, k) => k === 0 || d["a_" + u] === "acc");   // اللاعبون الفعليون
const dProg = (d, u) => Object.assign({ i: 0, c: 0, ms: 0, d: false, h: "", x: [] }, d["p_" + u]);   // h: صح/خطأ لكل سؤال، x: الأخطاء
const duelView = (d, id, me) => ({ id, ps: d.ps || [], nm: d.nm || {}, ac: Object.fromEntries((d.ps || []).slice(1).map(u => [u, d["a_" + u] || "inv"])),
  p: Object.fromEntries((d.ps || []).map(u => [u, dProg(d, u)])), st: d.st, s: d.s || 0, qt: dQt(d), rank: d.rank || [], me, now: Date.now() });
// الترتيب: الأكثر إجابات صحيحة، ثم الأسرع (من لم يُنهِ يُعدّ أبطأ). السجلّ (فوز/خسارة) للتحدي الثنائي فقط
// الفائز: صاحب المركز الأول إن تفوّق فعلًا على الثاني (لا تعادل، ولا منسحب، وأنهى وأجاب صحيحًا مرة على الأقل)
function duelWinner(d) {
  if (d.st !== "done") return null;
  const R = (d.rank || []).filter(u => u !== "tie"); if ((d.rank || [])[0] === "tie" || R.length < 2) return null;
  const a = dProg(d, R[0]), b = dProg(d, R[1]);
  if (a.q || !a.d || !(a.c > 0)) return null;
  if (b.q) return R[0];
  return a.c > b.c || (a.c === b.c && (!b.d || a.ms < b.ms)) ? R[0] : null;
}
async function duelFinishW(fs, d, now) {
  const A = dAct(d), key = u => { const p = dProg(d, u); return p.q ? [1, Infinity] : [-(p.c || 0), p.d ? p.ms : Infinity] };   // المنسحب آخرًا
  d.rank = A.slice().sort((x, y) => { const a = key(x), b = key(y); return a[0] - b[0] || a[1] - b[1] }); d.st = "done";
  const w = [];
  if ((d.ps || []).length === 2 && A.length === 2) {   // التحدي الجماعي لا يدخل السجلّ
    const [x, y] = d.rank, kx = key(x), ky = key(y);
    if (kx[0] !== ky[0] || kx[1] !== ky[1]) {
      const [fx, fy] = await Promise.all([frGet(fs, x), frGet(fs, y)]);
      if (fx.list[y] && fy.list[x]) { fx.list[y].w = (fx.list[y].w || 0) + 1; fy.list[x].l = (fy.list[x].l || 0) + 1;
        w.push({ path: `fr/${x}`, data: { list: fx.list }, merge: true }, { path: `fr/${y}`, data: { list: fy.list }, merge: true }) }
    } else d.rank = ["tie", ...d.rank];
  }
  return w;
}
// يبدأ التحدي إن ردّ كل المدعوّين أو انتهت المهلة وقد قبل واحد على الأقل
function duelMaybeStart(d, now, force) {
  if (d.st !== "inv") return false;
  const inv = (d.ps || []).slice(1), acc = inv.filter(u => d["a_" + u] === "acc"), left = inv.filter(u => !d["a_" + u] || d["a_" + u] === "inv");
  const late = now - (d.t && d.t.ms || 0) > INV_TTL;
  if (acc.length && (force || !left.length || late)) { d.st = "on"; d.s = now + 4000; return true }
  if (!acc.length && (!left.length || late)) { d.st = left.length ? "x" : "no"; return true }
  return false;
}
async function handleDuel(fs, user, body, env) {
  const me = user.uid, op = String(body.op || "st"), now = Date.now();
  if (!(await isActive(fs, user))) return { status: 403, json: { error: "inactive" } };
  if (op === "inv") {
    const to = [...new Set((Array.isArray(body.to) ? body.to : [body.to]).map(String))].filter(u => /^[A-Za-z0-9_-]{1,128}$/.test(u) && u !== me);
    if (!to.length || to.length > DUEL_MAX - 1) return { status: 400, json: { error: "uid" } };
    const [f, nm, ...rest] = await Promise.all([frGet(fs, me), fs.get(`names/${me}`), ...to.flatMap(u => [fs.get(`on/${u}`), fs.get(`names/${u}`), frGet(fs, u)])]);
    const names = { [me]: nm && nm.data.name || loginOf(user) }, bad = { notfriend: [], offline: [], busy: [] };
    to.forEach((u, k) => { const on = rest[k * 3], n = rest[k * 3 + 1], fr = rest[k * 3 + 2];
      names[u] = n && n.data.name || (f.list[u] && f.list[u].n) || "";
      if (!f.list[u] || f.list[u].s !== "f") bad.notfriend.push(u);
      else if (!on || now - (on.data.t && on.data.t.ms || 0) > ONLINE) bad.offline.push(u);
      else if (fr.inv && now - (fr.inv.t && fr.inv.t.ms || 0) < INV_TTL && fr.inv.from !== me) bad.busy.push(u) });
    const e = bad.notfriend.length ? "notfriend" : bad.offline.length ? "offline" : bad.busy.length ? "busy" : "";
    if (e) return { status: e === "notfriend" ? 403 : 409, json: { error: e, who: bad[e].map(u => names[u]) } };
    const id = now.toString(36) + Math.random().toString(36).slice(2, 7), ps = [me, ...to];
    await loadCfg(fs);
    const d = { ps, nm: names, st: "inv", t: { __ts: now }, s: 0, rank: [], qt: CFG.duel.qt };
    for (const u of ps) d["p_" + u] = { i: 0, c: 0, ms: 0, d: false };
    for (const u of to) d["a_" + u] = "inv";
    await fs.commit([{ path: `duel/${id}`, data: d }, ...to.map(u => ({ path: `fr/${u}`, data: { inv: { id, from: me, name: names[me], with: to.filter(x => x !== u).map(x => names[x]), t: { __ts: now } } }, merge: true }))]);
    d.t = { ms: now }; return { status: 200, json: duelView(d, id, me) };
  }
  const id = String(body.id || ""); if (!/^[a-z0-9]{6,20}$/.test(id)) return { status: 400, json: { error: "id" } };
  const doc = await fs.get(`duel/${id}`); if (!doc) return { status: 404, json: { error: "nodule" } };
  const d = doc.data, host = (d.ps || [])[0]; if (!(d.ps || []).includes(me)) return { status: 403, json: { error: "notyours" } };
  const st0 = d.st;
  const upd = {}, extra = [];
  if (op === "acc" || op === "no") {
    if (d.st !== "inv") return { status: 409, json: duelView(d, id, me) };
    if (me === host) { if (op === "no") { d.st = "x"; upd.st = "x" } }   // صاحب الدعوة يلغي
    else { d["a_" + me] = op === "acc" ? "acc" : "no"; upd["a_" + me] = d["a_" + me]; extra.push({ path: `fr/${me}`, data: { inv: null }, merge: true }) }
  }
  if (op === "go" && me === host) duelMaybeStart(d, now, true);   // «ابدأ الآن» مع من قبل
  else duelMaybeStart(d, now, false);
  if (d.st !== st0 || upd.st) Object.assign(upd, { st: d.st, s: d.s || 0 });
  if (op === "ans" && d.st === "on") {
    const k = "p_" + me, p = dProg(d, me), i = +body.i;
    if (dAct(d).includes(me) && !p.d && now >= d.s && i === p.i + 1 && i <= DUEL_N && now - d.s <= dLen(d)) {
      p.i = i; p.c += body.ok ? 1 : 0; p.ms = now - d.s; p.d = i === DUEL_N; p.h = (p.h || "") + (body.ok ? "1" : "0");
      if (!body.ok && p.x.length < DUEL_N) { const t = v => String(v || "").slice(0, 80); p.x.push({ de: t(body.de), ar: t(body.ar), pk: t(body.pk) }) }   // تقرير الأخطاء
      d[k] = p;
      await fs.commit([{ path: `duel/${id}`, data: { [k]: p }, merge: true }]);   // حقل اللاعب وحده: لا يتعارض مع الآخرين
    }
  }
  // الانسحاب أثناء اللعب: يُعدّ منتهيًا (ويأتي آخرًا) فلا ينتظره الباقون
  if (op === "quit" && d.st === "on" && dAct(d).includes(me)) {
    const k = "p_" + me, p = dProg(d, me);
    if (!p.d) { p.d = true; p.q = 1; p.ms = dLen(d); d[k] = p; await fs.commit([{ path: `duel/${id}`, data: { [k]: p }, merge: true }]) }
  }
  // ينتهي حين يُنهي كل اللاعبين، أو تنقضي الدقائق الثلاث
  let w = [];
  if (d.st === "on" && (dAct(d).every(u => dProg(d, u).d) || now - d.s > dLen(d) + 5e3)) { w = await duelFinishW(fs, d, now); Object.assign(upd, { st: "done", rank: d.rank, end: { __ts: now } }) }
  if (Object.keys(upd).length || extra.length) {
    const cur = op === "ans" || op === "quit" ? await fs.get(`duel/${id}`) : doc;   // بعد كتابة الإجابة تغيّر وقت التحديث
    try { await fs.commit([...(Object.keys(upd).length ? [{ path: `duel/${id}`, data: upd, merge: true, ifUpdateTime: cur.updateTime }] : []), ...extra, ...(st0 === "inv" && d.st !== "inv" ? (d.ps || []).slice(1).map(u => ({ path: `fr/${u}`, data: { inv: null }, merge: true })) : []), ...w]) }
    catch (e) { if (!e.conflict) throw e; const again = await fs.get(`duel/${id}`); return { status: 200, json: { ...duelView(again.data, id, me), retry: 1 } } }
  }
  return { status: 200, json: duelView(d, id, me) };
}

/* ---------- نقطة الدخول ---------- */
function cors(req) {
  const o = req.headers.get("Origin") || "";
  return { "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0], "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Max-Age": "86400", "Vary": "Origin" };
}

/* ---------- القراءة: مجموعات جمل يُدخلها المشرف لحسابات ولديه، تُقرأ جملةً جملة بصوت Azure ----------
   rd/{uid}: g_<id> = {ti, s:[جمل], o, t} ، p_<id> = موضع المتعلّم. الصوت في BAK: rda-<بصمة> (يُصنع عند أول طلب ويُحفظ) */
const RD_MAX_S = 300, RD_MAX_LEN = 400;
const RD_ABBR = /(?:^|\s)(?:\d+|[A-Za-zÄÖÜäöü]|z|d|u|ca|Nr|Dr|bzw|usw|vgl|Hr|Fr|St|Str|evtl|ggf|inkl|etc)\.$/;
function rdSplit(txt) {
  const out = [];
  for (const line of String(txt || "").replace(/\r/g, "").split(/\n+/)) {
    const L = line.replace(/\s+/g, " ").trim(); if (!L) continue;
    const parts = L.match(/[^.!?…]+(?:[.!?…]+["“”»«›‹'’)]*|$)/g) || [L];   // ›‹ علامتا الاقتباس الداخلي
    let cur = "";
    for (const raw of parts) {
      const x = raw.trim(); if (!x) continue;
      // «z. B.» و«16. Juli» وما يبدأ بحرف صغير: تكملة للجملة نفسها
      if (cur && (RD_ABBR.test(cur) || /^[a-zäöüß,;:)]/.test(x))) cur += (/^[,;:)]/.test(x) ? "" : " ") + x; else { if (cur) out.push(cur); cur = x }
    }
    if (cur) out.push(cur);
  }
  return out.map(x => x.slice(0, RD_MAX_LEN)).slice(0, RD_MAX_S);
}
const rdGroups = d => Object.entries(d || {}).filter(([k, v]) => k.startsWith("g_") && v && Array.isArray(v.s)).map(([k, v]) => ({ id: k.slice(2), ...v })).sort((a, b) => (a.o || 0) - (b.o || 0));
async function rdHash(t) { const b = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("Katja|" + t))); return [...b.slice(0, 12)].map(x => x.toString(16).padStart(2, "0")).join("") }
function b64(buf) { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s) }
async function rdAudio(env, t) {
  if (!env.BAK) return null;
  const k = "rda-" + await rdHash(t), have = await env.BAK.get(k, "arrayBuffer"); if (have) return have;
  const key = String(env.AZURE_SPEECH_KEY || "").trim(); if (!key) return null;
  const esc = x => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const ssml = `<speak version='1.0' xml:lang='de-DE'><voice name='de-DE-KatjaNeural'><prosody rate='-6%'>${esc(t)}</prosody></voice></speak>`;
  const r = await fetch(`https://${String(env.AZURE_SPEECH_REGION || "westeurope").trim()}.tts.speech.microsoft.com/cognitiveservices/v1`, { method: "POST", body: ssml,
    headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3", "User-Agent": "mufradati" } });
  if (!r.ok) return null;
  const buf = await r.arrayBuffer(); await env.BAK.put(k, buf); return buf;
}
// نتائج أوراق الرياضيات (mt/{uid}): الحقل m_<ورقة> = {i: السؤال الحالي, r: نص JSON {رقم: {v, ok}}, t}
// المتعلّم يحفظ ويقرأ نتائجه؛ المشرف يقرأ نتائج أي متعلّم ويصفّر ورقة
async function handleMt(fs, user, body) {
  const admin = user.email === ADMIN, op = String(body.op || "get");
  const u = admin ? String(body.u || "") : user.uid;
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(u)) return { status: 400, json: { error: "u" } };
  const sid = String(body.set || "");
  if (sid && !/^[A-Za-z0-9_-]{3,40}$/.test(sid)) return { status: 400, json: { error: "set" } };
  const key = "m_" + sid.replace(/[^A-Za-z0-9]/g, "_");
  if (op === "get") {
    const doc = await fs.get(`mt/${u}`), d = doc ? doc.data : {}, out = {};
    for (const k in d) if (k.startsWith("m_") && d[k] && typeof d[k] === "object") { let r = {}; try { r = JSON.parse(d[k].r || "{}") } catch (e) {} let f = {}; try { f = JSON.parse(d[k].f || "{}") } catch (e) {} out[d[k].id || k.slice(2)] = { i: +d[k].i || 0, r, f, t: d[k].t || 0, z: +d[k].z || 0 } }
    const arr = x => { try { const a = JSON.parse(x || "[]"); return Array.isArray(a) ? a : [] } catch (e) { return [] } };
    return { status: 200, json: { m: out, hid: arr(d.hid), shw: arr(d.shw) } };
  }
  if (!sid) return { status: 400, json: { error: "set" } };
  if (op === "save" && !admin) {
    // جهاز لم يعلم بعدُ بـ«من الأوّل» (z أقدم) لا يكتب فوق الإعادة
    const cur = await fs.get(`mt/${u}`), cz = cur && cur.data[key] && +cur.data[key].z || 0;
    if ((+body.z || 0) < cz) return { status: 200, json: { ok: false, reset: 1 } };
    const i = Math.max(0, Math.min(500, Math.floor(+body.i || 0)));
    // r: آخر جواب لكل سؤال؛ f: أول جواب (لا يتغيّر بالإعادة، ليرى المشرف أخطاءه الأولى)
    const clean = o => { const x = {}; o = o && typeof o === "object" ? o : {}; for (const k of Object.keys(o).slice(0, 500)) if (/^\d{1,3}$/.test(k) && o[k]) x[k] = { v: String(o[k].v || "").slice(0, 1500), ok: !!o[k].ok } /* 1500: نصوص الكتابة الحرّة */; return x };
    await fs.commit([{ path: `mt/${u}`, data: { [key]: { id: sid, i, r: JSON.stringify(clean(body.r)), f: JSON.stringify(clean(body.f)), t: Date.now(), z: cz } }, merge: true }]); return { status: 200, json: { ok: true } };
  }
  // إخفاء ورقة عن المتعلّم أو إظهارها (hid: قائمة الأوراق المخفية)
  if (op === "vis" && admin) {
    // shw: أوراق مخفية أصلًا (hide في math.json) أظهرها المشرف لهذا المتعلّم
    const doc = await fs.get(`mt/${u}`), dd = doc ? doc.data : {}, arr = x => { try { const a = JSON.parse(x || "[]"); return Array.isArray(a) ? a : [] } catch (e) { return [] } };
    let h = arr(dd.hid).filter(x => x !== sid), s = arr(dd.shw).filter(x => x !== sid); if (body.h) h.push(sid); else s.push(sid);
    await fs.commit([{ path: `mt/${u}`, data: { hid: JSON.stringify(h.slice(-200)), shw: JSON.stringify(s.slice(-200)) }, merge: true }]); return { status: 200, json: { ok: true } };
  }
  if (op === "reset" && admin) { await fs.commit([{ path: `mt/${u}`, data: { [key]: { id: sid, i: 0, r: "{}", f: "{}", t: Date.now(), z: Date.now() } }, merge: true }]); return { status: 200, json: { ok: true } } }
  return { status: 400, json: { error: "op" } };
}
async function handleRd(fs, user, body, env) {
  const admin = user.email === ADMIN, op = String(body.op || "list");
  const u = admin ? String(body.u || "") : user.uid;
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(u)) return { status: 400, json: { error: "u" } };
  const id = String(body.id || "");
  if (id && !/^[A-Za-z0-9]{4,20}$/.test(id)) return { status: 400, json: { error: "id" } };
  const doc = await fs.get(`rd/${u}`), d = doc ? doc.data : {};
  // المجموعة المخفية (h) لا تظهر للمتعلّم، والمشرف يراها كلها
  if (op === "list") return { status: 200, json: { g: rdGroups(d).filter(g => admin || !g.h).map(g => ({ id: g.id, ti: g.ti, n: g.s.length, p: +d["p_" + g.id] || 0, t: g.t || 0, h: g.h ? 1 : 0 })) } };
  const g0 = id ? d["g_" + id] : null, g = g0 && (admin || !g0.h) ? g0 : null;
  if (op === "get") { if (!g) return { status: 404, json: { error: "nog" } }; return { status: 200, json: { ti: g.ti, s: g.s, ar: Array.isArray(g.ar) ? g.ar : [], p: +d["p_" + id] || 0 } } }
  if (op === "pos") { if (admin || !g) return { status: 400, json: { error: "pos" } };
    const i = Math.max(0, Math.min(g.s.length, Math.floor(+body.i || 0))); await fs.commit([{ path: `rd/${u}`, data: { ["p_" + id]: i }, merge: true }]); return { status: 200, json: { ok: true } } }
  if (op === "aud") {
    if (!g) return { status: 404, json: { error: "nog" } };
    const i = Math.floor(+body.i || 0), t = g.s[i]; if (t == null) return { status: 400, json: { error: "i" } };
    const a = await rdAudio(env, t); return { status: 200, json: a ? { a: b64(a) } : { a: "" } };
  }
  if (!admin) return { status: 403, json: { error: "admin" } };
  if (op === "save") {
    const ti = String(body.ti || "").replace(/\s+/g, " ").trim().slice(0, 80), s = rdSplit(body.txt);
    if (!ti || !s.length) return { status: 400, json: { error: "empty" } };
    const nid = id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)), old = d["g_" + nid];
    const o = old ? old.o : Math.max(0, ...rdGroups(d).map(x => x.o || 0)) + 1;
    // ترجمة كل جملة يكتبها المشرف بنفسه: {الجملة: ترجمتها}، وتُحفظ بترتيب الجمل
    const trm = body.tr && typeof body.tr === "object" ? body.tr : {}, ar = s.map(x => String(trm[x] || "").replace(/\s+/g, " ").trim().slice(0, RD_MAX_LEN));
    const nd = { ...d, ["g_" + nid]: { ti, s, ar, o, h: old && old.h ? 1 : 0, t: { __ts: Date.now() } } };
    // إن تغيّرت الجمل يبدأ المتعلّم المجموعة من أوّلها
    if (old && JSON.stringify(old.s) !== JSON.stringify(s)) nd["p_" + nid] = 0;
    await fs.commit([{ path: `rd/${u}`, data: nd }]);
    // تجهيز صوت أول الجمل مسبقًا (الخطة المجانية ~20 طلبًا في الدقيقة)
    if (env.__ctx && env.__ctx.waitUntil) env.__ctx.waitUntil((async () => { for (const t of s.slice(0, 6)) { try { await rdAudio(env, t) } catch (e) { break } } })());
    return { status: 200, json: { ok: true, id: nid, n: s.length } };
  }
  if (op === "del") {
    if (!g) return { status: 404, json: { error: "nog" } };
    const nd = { ...d }; delete nd["g_" + id]; delete nd["p_" + id];
    await fs.commit([Object.keys(nd).length ? { path: `rd/${u}`, data: nd } : { path: `rd/${u}`, del: true }]);
    return { status: 200, json: { ok: true, left: rdGroups(nd).length } };
  }
  if (op === "reset") {   // تصفير تقدّم المتعلّم في المجموعة: يبدأها من أوّل جملة
    if (!g) return { status: 404, json: { error: "nog" } };
    await fs.commit([{ path: `rd/${u}`, data: { ["p_" + id]: 0 }, merge: true }]); return { status: 200, json: { ok: true } };
  }
  if (op === "vis") {   // إظهار المجموعة للمتعلّم أو إخفاؤها
    if (!g) return { status: 404, json: { error: "nog" } };
    await fs.commit([{ path: `rd/${u}`, data: { ["g_" + id]: { ...g, h: body.h ? 1 : 0 } }, merge: true }]); return { status: 200, json: { ok: true, h: body.h ? 1 : 0 } };
  }
  if (op === "split") return { status: 200, json: { s: rdSplit(body.txt) } };
  return { status: 400, json: { error: "op" } };
}

export default {
  async scheduled(ev, env, ctx) { ctx.waitUntil((async () => { try { await aiCleanup(env) } catch (e) { } try { if (env.BAK) await backupOnce(env, env.__fs || makeFS(env), null, "auto") } catch (e) { await srvErr(env, { msg: "النسخ الاحتياطي فشل: " + String(e && e.message || e), where: "backup" }, "server") } })()) },
  async fetch(req, env, ctx) {
    env.__ctx = ctx;
    const H = cors(req), url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: H });
    if (url.pathname === "/" && req.method === "GET") return new Response("mufradati-api ✓", { headers: H });
    if (url.pathname === "/err" && req.method === "POST") return handleErr(req, env, H);
    if (!["/sync", "/wipe", "/report", "/stats", "/create", "/pass", "/fix", "/msg", "/ai", "/ailog", "/aidel", "/backup", "/errs", "/fr", "/duel", "/rd", "/mt"].includes(url.pathname) || req.method !== "POST") return new Response("not found", { status: 404, headers: H });
    // التحقق من الهوية أولًا وبمعزل: أي فشل فيه (رمز مشوّه أو منتهٍ) ردّ 401 ولا يُسجَّل خطأً أبدًا، فلا يستطيع طلب مجهول أن يكتب في Firestore
    let user; try { user = await verifyIdToken((req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "")) }
    catch (e) {
      if (e && e.transient) { const p = srvErr(env, { msg: e.message, where: url.pathname }, "server"); if (ctx && ctx.waitUntil) ctx.waitUntil(p); else await p;
        return new Response(JSON.stringify({ error: "server", detail: "auth unavailable" }), { status: 503, headers: { ...H, "Content-Type": "application/json" } }) }
      return new Response(JSON.stringify({ error: "auth", detail: "token" }), { status: 401, headers: { ...H, "Content-Type": "application/json" } });
    }
    try {
      const body = await req.json().catch(() => ({}));
      const fs0 = env.__fs || makeFS(env), fs = countFS(fs0);
      stAdd("req", 1);
      // قراءات وكتابات التطبيق نفسه (يرسلها مع كل حفظ)، بحدود معقولة
      if (body.st && typeof body.st === "object") { stAdd("cr", Math.min(20000, Math.max(0, +body.st.r || 0))); stAdd("cw", Math.min(5000, Math.max(0, +body.st.w || 0))) }
      let out;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { out = url.pathname === "/ai" ? await handleAi(fs, user, body, env) : url.pathname === "/ailog" ? await handleAiLog(fs0, user, body, env) : url.pathname === "/aidel" ? await handleAiDel(fs0, user, body, env) : url.pathname === "/backup" ? await serial(() => handleBackup(fs0, user, body, env)) : url.pathname === "/errs" ? await handleErrs(fs0, user, body, env) : url.pathname === "/fr" ? await handleFriends(fs0, user, body, env) : url.pathname === "/duel" ? await handleDuel(fs0, user, body, env) : url.pathname === "/rd" ? await handleRd(fs0, user, body, env) : url.pathname === "/mt" ? await handleMt(fs0, user, body) : url.pathname === "/msg" ? await handleMsg(fs, user, body) : url.pathname === "/create" ? await handleCreate(fs, user, body, env) : url.pathname === "/pass" ? await handlePass(fs, user, body, env) : url.pathname === "/fix" ? await serial(() => handleFix(fs, user, body, env)) : url.pathname === "/stats" ? await handleStats(fs0, user, body) : url.pathname === "/report" ? await handleReport(fs, user, body) : await serial(() => url.pathname === "/wipe" ? handleWipe(fs, user, body) : handleSync(fs, user, body)); break }
        catch (e) { if (!e.conflict || attempt === 2) throw e }       // تعديل متزامن من جهازين: نعيد المحاولة
      }
      const fl = stFlush(fs0); if (ctx && ctx.waitUntil) ctx.waitUntil(fl); else await fl;
      return new Response(JSON.stringify(out.json), { status: out.status, headers: { ...H, "Content-Type": "application/json" } });
    } catch (e) {
      const auth = /token|key/.test(e.message);
      if (!auth) { const p = srvErr(env, { msg: String(e && e.message || e), stack: String(e && e.stack || ""), where: url.pathname }, user.uid); if (ctx && ctx.waitUntil) ctx.waitUntil(p); else await p }
      // التفاصيل التقنية للمشرف وحده (تظهر في رسائل أدواته)؛ المستخدم يرى «خطأ في الخادم» فقط
      const out = { error: auth ? "auth" : "server" }; if (user.email === ADMIN) out.detail = String(e && e.message || e).slice(0, 200);
      return new Response(JSON.stringify(out), { status: auth ? 401 : 500, headers: { ...H, "Content-Type": "application/json" } });
    }
  }
};
