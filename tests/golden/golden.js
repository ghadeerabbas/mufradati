// نتائج متوقَّعة ثابتة، لا مقارنة بين نسختين: كل رقم هنا محسوب يدويًا من قواعد التطبيق (DEF_CFG وتعليقات core.js)،
// فإن تغيّر منطق المكافآت أو المراجعة المتباعدة عن هذه القواعد يفشل الاختبار ولو تغيّرت النسختان معًا.
// الاستعمال: node golden.js مسار/core.js
const vm=require('vm'),fs=require('fs');
const SRC=fs.readFileSync(process.argv[2]||'core.js','utf8');
let NOW=0;class FD extends Date{constructor(...a){a.length?super(...a):super(NOW)}static now(){return NOW}}
const PRE='let P={},LOG=[],QLOG=[],QA=[],BUY=[],R={bank:0,ach:[],lv:1,ts:0},LG={tier:0,w:"",hist:[],ts:0},EN={v:30,t:0},STN=[],STV=0,GIFTS=[],CW=0;';
function make(){const c={console,Math,Date:FD,JSON,Array,Object,String,Number,Set,Map,Intl};vm.createContext(c);
  vm.runInContext(PRE+SRC+`;this.X={applyEv,boxStep,IV,econ:()=>{EC=null;return econ()},get P(){return P},get R(){return R},get LOG(){return LOG}};`,c);return c.X}
const out=[],T=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?' → '+x:''));
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const D0=Date.parse('2026-12-01T10:00:00Z'),DAY=864e5;   // 11:00 بتوقيت برلين: لا «ليل» ولا «فجر»

// ===== 1) المراجعة المتباعدة: الفواصل وخطوة الصندوق =====
{const X=make();
 T('فواصل المراجعة بالأيام',eq([...X.IV],[0,1,2,4,7,15,30,60,120]),JSON.stringify([...X.IV]));
 const cases=[[0,2,0,1],[1,2,0,2],[3,3,0,5],[7,3,0,8],[8,3,0,8],[8,2,0,8],[5,0,0,0],[5,1,0,5],[0,1,0,1],[5,2,1,5],[5,3,1,5],[0,3,1,1],[5,0,1,0]];
 const bad=cases.filter(([b,r,p,e])=>X.boxStep(b,r,!!p)!==e);
 T('خطوة الصندوق: «جيد» +1، «سهل» +2، النسيان إلى 0، «صعب» لا ينزل، التدريب لا يرفع، والحد 8',!bad.length,bad.length?JSON.stringify(bad):cases.length+' حالة')}

// ===== 2) يوم كامل لمتعلّم: الخبرة والجواهر والمستوى ومنع التكرار =====
const X=make();let fails=[];
const ev=(e,ok=true)=>{const r=X.applyEv(e,NOW,{});if(r!==ok)fails.push(JSON.stringify(e).slice(0,60)+' → '+r+' (المتوقَّع '+ok+')');return r};
const W=i=>'w'+i;
function station(ws){ev({type:'stStart'});NOW+=12e3;ev({type:'stDone',words:ws,miss:[]});NOW+=20e3;ev({type:'quiz',kind:'drill',ok:5,total:5,ms:9000,full:true});NOW+=3600e3}
NOW=D0;for(let s=0;s<3;s++)station([0,1,2,3,4].map(i=>W(s*5+i)));
let e=X.econ();
T('اليوم 0: 3 محطات بلا خطأ = 15 كلمة × 3 خبرة + 3 تدريبات × 5 = 60 خبرة',e.xp===60,e.xp);
T('اليوم 0: جوهرة لكل محطة = 3، والمستوى 1',e.earned===3&&e.lv===1,'جواهر '+e.earned+' · مستوى '+e.lv);
T('كلمة المحطة: الصندوق 1 وموعدها بعد يوم',X.P.w0.box===1&&X.P.w0.due===D0+12e3+DAY,'صندوق '+X.P.w0.box);
NOW=D0+DAY;for(let i=0;i<15;i++){ev({type:'rate',k:W(i),r:2});NOW+=5e3}
e=X.econ();
T('اليوم 1: 15 مراجعة «جيد» × 4 = 60 خبرة، المجموع 120',e.xp===120,e.xp);
T('اليوم 1: بلوغ المستوى 2 (يحتاج 80) يعطي 5 جواهر → 8',e.lv===2&&e.earned===8,'مستوى '+e.lv+' · جواهر '+e.earned);
T('بعد «جيد»: الصندوق 2 والموعد بعد يومين',X.P.w5.box===2&&X.P.w5.due===X.P.w5.t+2*DAY);
ev({type:'quest',id:'rv15'});ev({type:'quest',id:'rv15'},'dup');ev({type:'quest',id:'st1'},'off');
e=X.econ();T('مهمة «راجع 15 كلمة» تعطي 3 جواهر مرة واحدة فقط → 11',e.earned===11,e.earned);
const due0=X.P.w0.due;ev({type:'rate',k:'w0',r:3});e=X.econ();
T('مراجعة الكلمة نفسها مرة ثانية في اليوم: تدريب بلا خبرة ولا ترقية ولا تغيير موعد',e.xp===120&&X.P.w0.box===2&&X.P.w0.due===due0&&X.LOG[X.LOG.length-1][3]===2,'خبرة '+e.xp+' · صندوق '+X.P.w0.box);
NOW=D0+2*DAY;ev({type:'rate',k:'w6',r:3});e=X.econ();   // w6 موعدها اليوم 3
T('مراجعة قبل الموعد (اليوم 2): تدريب بلا خبرة ولا ترقية',e.xp===120&&X.P.w6.box===2&&X.P.w6.due===D0+DAY+6*5e3+2*DAY,'خبرة '+e.xp+' · صندوق '+X.P.w6.box);
NOW=D0+3*DAY;ev({type:'rate',k:'w0',r:3});NOW+=5e3;e=X.econ();
T('اليوم 3: «سهل» يرفع الصندوق من 2 إلى 4 = «محفوظة»: 4 خبرة + 15 مكافأة → 139',e.xp===139&&X.P.w0.box===4&&e.s.mem===1,'خبرة '+e.xp+' · صندوق '+X.P.w0.box+' · محفوظة '+e.s.mem);
ev({type:'rate',k:'w1',r:0});NOW+=5e3;e=X.econ();
T('النسيان: الصندوق 0 والموعد الآن، وخبرة 1 → 140',X.P.w1.box===0&&X.P.w1.due===NOW-5e3&&e.xp===140,'صندوق '+X.P.w1.box+' · خبرة '+e.xp);
NOW=D0+3*DAY+600e3;ev({type:'dwin',id:'duel01'});ev({type:'dwin',id:'duel01'},'dup');ev({type:'eday'});ev({type:'eday'},'dup');
ev({type:'duel'});ev({type:'duel'});e=X.econ();
T('الفوز في تحدٍّ: جوهرة مرة واحدة لكل تحدٍّ → 12',e.earned===12,e.earned);
T('يوم التحدي يُسجَّل مرة واحدة ولو تكرّر',X.R.dd.length===1,JSON.stringify(X.R.dd));
T('السلسلة: يومان (0 و1)، وانقطاع اليوم 2 لسلسلة أقصر من 3 لا يُحمى بتجميد، واليوم 3 يُحسب بالتحدي → أطول 2، الحالية 1',e.s.best===2&&e.s.streak===1,'أطول '+e.s.best+' · الحالية '+e.s.streak);
T('كل الأحداث أعطت الردّ المتوقَّع (قبول أو رفض)',!fails.length,fails.join(' | ')||'0 مخالفة');

// ===== كلمة معروفة في محطة جديدة تُرفض =====
{const Y=make();NOW=D0;let r=[];r.push(Y.applyEv({type:'stStart'},NOW,{}));NOW+=12e3;r.push(Y.applyEv({type:'stDone',words:['a1','a2'],miss:[]},NOW,{}));
 NOW=D0+DAY;r.push(Y.applyEv({type:'stStart'},NOW,{}));NOW+=12e3;r.push(Y.applyEv({type:'stDone',words:['a1','a3'],miss:[]},NOW,{}));r.push(Y.applyEv({type:'stDone',words:['a4'],miss:[]},NOW,{}));
 T('محطة فيها كلمة معروفة تُرفض، والمحطة تبقى مفتوحة فتُقبل بكلمات جديدة',eq(r,[true,true,true,'word',true]),JSON.stringify(r));
 NOW+=60e3;const z=Y.applyEv({type:'stDone',words:['a5'],miss:[]},NOW,{});T('إنهاء محطة دون بدئها يُرفض',z==='none',z)}

// ===== 3) حراسة الخادم =====
{const S=make();let f=[];const sv=(e,ok,c={})=>{const r=S.applyEv(e,NOW,{server:true,...c});if(r!==ok)f.push(e.type+' → '+r+' (المتوقَّع '+ok+')')};
 NOW=D0;sv({type:'stStart'},true);NOW+=5e3;sv({type:'stDone',words:['a','b'],miss:[]},'time');NOW+=6e3;sv({type:'stDone',words:['a','b'],miss:[]},true);
 NOW=D0+DAY;sv({type:'rate',k:'a',r:2},true);NOW+=300;sv({type:'rate',k:'b',r:2},'time');
 sv({type:'rate',k:'b',r:2,t:NOW-8*DAY},'time');sv({type:'dwin',id:'abcd1'},'dwin');sv({type:'duel'},'duel');
 sv({type:'quiz',kind:'quiz',ok:3,total:2},'bad');sv({type:'nope'},'type');
 T('الخادم يرفض: محطة أسرع من 10 ثوانٍ، مراجعتين في نصف ثانية، حدثًا أقدم من أسبوع، فوزًا أو تحديًا غير موثَّق، نتيجة مستحيلة، ونوعًا مجهولًا',!f.length,f.join(' | ')||'8 حالات')}

// ===== 4) الطيّ لا يُضيّع جواهر =====
{const F=make();NOW=D0;let ok=0;for(let i=0;i<2500;i++)if(F.applyEv({type:'dwin',id:'dw'+String(i).padStart(5,'0')},NOW,{})===true)ok++;
 const g=F.econ().earned;
 T('2500 فوز: يبقى 2000 في السجل و500 مطويّة، والجواهر 2500 كاملة',ok===2500&&F.R.dw.length===2000&&F.R.dwg===500&&g===2500,'سجل '+F.R.dw.length+' · مطويّ '+F.R.dwg+' · جواهر '+g);
 const r=F.applyEv({type:'dwin',id:'dw02499'},NOW,{});T('فوز مكرّر من آخر السجل يُرفض بعد الطيّ',r==='dup',r)}

console.log(out.join('\n'));
