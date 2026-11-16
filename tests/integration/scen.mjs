import {T,out,app,user,station,adv,duelDoc,memfs,DB,post,ctl} from './it.mjs';
const day=n=>{ctl.NOW=Date.parse('2026-11-16T07:00:00Z')+n*864e5};
const lgRank=async(A,w)=>{const docs=await memfs.list('lg/'+w+'/m');const prevW=A.weekId(Date.parse(w+'T12:00:00Z')-7*864e5);const t=A.table(w,docs,await memfs.list('lg/'+prevW+'/m'),1);return t.findIndex(r=>r.id===A.uid)+1};
// ===== 1) تطبيق جديد + خادم جديد =====
ctl.ACTIVE='new';day(0);await user('u1');const A=app('new','u1');await A.sync();
await station(A);adv(60e3);
T('جديد/جديد: المهمة 1/1 بعد المزامنة وقبل الفتح',A.quest('perf').v===1);
const g0=A.earned();A.ev({type:'quest',id:'perf'});await A.sync();
T('جديد/جديد: الخادم قبل فتح الصندوق في طلب منفصل',!A.rej.length&&A.quest('perf').got,JSON.stringify(A.rej));
T('جديد/جديد: القطعة محفوظة',A.pz('2026-11').length===1,A.pz('2026-11').join(','));
T('جديد/جديد: المهمة تبقى 1/1 بعد المزامنة',A.quest('perf').v===1);
T('جديد/جديد: التطبيق يرفض الضغط الثاني محليًا',A.ev({type:'quest',id:'perf'})==='dup');
const jd=await post('/sync','u1',{evs:[{type:'quest',id:'perf',t:ctl.NOW}]});T('جديد/جديد: الخادم يرفض صندوقًا مكرّرًا يُرسل مباشرة',JSON.stringify(jd.rej).includes('dup'),JSON.stringify(jd.rej));
await duelDoc('duelAAA1','u1','u9');A.ev({type:'dwin',id:'duelAAA1'});await A.sync();const g1=A.earned();
const jd2=await post('/sync','u1',{evs:[{type:'dwin',id:'duelAAA1',t:ctl.NOW}]});T('جديد/جديد: فوز التحدي مرة واحدة',JSON.stringify(jd2.rej).includes('dup'));
const B=app('new','u1');await B.sync();
T('جهاز ثانٍ أو إعادة تثبيت: الرصيد والقطع نفسها',B.earned()===A.earned()&&B.pz('2026-11')+''===A.pz('2026-11')+'',B.earned()+' / '+A.earned());
// ===== 2) الدوري: ترتيب التطبيق في آخر الأسبوع = ترتيب تسوية الخادم =====
for(const [kind,srv,uid] of [['new','new','L1'],['old','new','L2'],['new','old','L3'],['old','old','L4']]){
  ctl.ACTIVE=srv;day(7);await user(uid);const X=app(kind,uid);await X.sync();
  for(let d=0;d<6;d++){day(7+d);for(let s=0;s<2;s++)await station(X)}
  day(13);ctl.NOW+=12*3600e3;await X.sync();const w=X.weekId(ctl.NOW),cr=await lgRank(X,w);
  day(14);await X.sync();const h=X.LG.hist.at(-1)||{};
  T(`الدوري: تطبيق ${kind==='new'?'جديد':'قديم'} مع خادم ${srv==='new'?'جديد':'قديم'}: المركز المعروض = مركز التسوية`,cr===h.rank,'معروض '+cr+' · تسوية '+h.rank+' · خبرته '+h.xp)}
for(const [kind,srv,uid] of [['new','new','M1'],['old','new','M2'],['new','old','M3']]){
  ctl.ACTIVE=srv;day(28);await user(uid);const X=app(kind,uid);await X.sync();await station(X);
  day(34);ctl.NOW+=12*3600e3;await X.sync();const w=X.weekId(ctl.NOW),cr=await lgRank(X,w);day(35);await X.sync();const h=X.LG.hist.at(-1)||{};
  T(`الدوري (خبرة قليلة): تطبيق ${kind==='new'?'جديد':'قديم'} مع خادم ${srv==='new'?'جديد':'قديم'}`,kind===srv?cr===h.rank:true,'معروض '+cr+' · تسوية '+h.rank+' من '+h.n+' · خبرته '+h.xp+(cr!==h.rank?' ← مضلّل':''))}
// ===== 3) تطبيق قديم + خادم جديد =====
ctl.ACTIVE='new';day(20);await user('u2');const O=app('old','u2');await O.sync();await station(O);adv(60e3);
T('قديم/جديد (خطر): المهمة تظهر بعد المزامنة',true,O.quest('perf').v+'/1 — '+(O.quest('perf').v?'يستطيع الفتح':'لا يظهر له زر الفتح'));
const O2=app('old','u2b');await user('u2b');await O2.sync();await station(O2,{syncEach:false});O2.ev({type:'quest',id:'perf'});await O2.sync();
T('قديم/جديد: إن أُرسل كل شيء معًا (بلا إنترنت) يقبله الخادم الجديد',!O2.rej.length&&O2.pz('2026-12').length===1,JSON.stringify(O2.rej));
// ===== 4) تطبيق جديد + خادم قديم =====
ctl.ACTIVE='old';day(21);await user('u3');const N=app('new','u3');await N.sync();await station(N);adv(60e3);
const before=N.quest('perf');N.ev({type:'quest',id:'perf'});const pzBefore=N.pz('2026-12').length;await N.sync();
T('جديد/قديم (خطر): الصندوق يُفتح في الهاتف ثم يرفضه الخادم القديم',true,`قبل المزامنة ${pzBefore} قطعة · رفض ${JSON.stringify(N.rej)} · بعدها ${N.pz('2026-12').length} قطعة، والمهمة ${N.quest('perf').v}/1 ${N.quest('perf').got?'مستلمة':'غير مستلمة (يظهر «افتح» من جديد)'}`);
// ===== 5) بلا إنترنت ثم عودة الاتصال =====
ctl.ACTIVE='new';day(22);await user('u4');const F=app('new','u4');await F.sync();
await station(F,{syncEach:false});F.ev({type:'quest',id:'perf'});await duelDoc('duelOFF1','u4','u9');F.ev({type:'dwin',id:'duelOFF1'});
const local=F.earned(),lp=F.pz('2026-12').length;day(23);await F.sync();
T('بلا إنترنت يومًا ثم مزامنة: لا رفض، والقطعة والجواهر محفوظة',!F.rej.length&&F.pz('2026-12').length===lp,`رفض ${JSON.stringify(F.rej)} · قطع ${lp}→${F.pz('2026-12').length} · رصيد ${local}→${F.earned()}`);
const F2=app('new','u4');await F2.sync();T('بعدها جهاز آخر يرى الحالة نفسها',F2.earned()===F.earned());
// ===== 6) التراجع بعد أن بدأ الطيّ =====
day(30);await user('u5');const seed={R:{bank:0,ach:[],lv:1,ts:0,qd:[...Array(599)].map((_,i)=>[new Date(Date.parse('2025-01-01')+i*864e5).toISOString().slice(0,10),'rv15',3])},LG:{tier:0,w:'',hist:[],ts:0},STN:[],EN:{v:30,t:0},P:{},QLOG:[],BUY:[],STV:0,ver:1,lf:1};
await memfs.commit([{path:'users/u5/data/core',data:{v:JSON.stringify(seed)}}]);
ctl.ACTIVE='new';const Rb=app('new','u5');await Rb.sync();const e0=Rb.earned();
for(let k=0;k<5;k++){day(30+k);await station(Rb);Rb.ev({type:'quest',id:'perf'});await Rb.sync()}const e1=Rb.earned();
T('التراجع: قبله (خادم جديد، بعد الطيّ)',true,'الرصيد '+e0+' → '+e1+' · مطويّ '+(Rb.R.qdg||0));
ctl.ACTIVE='old';for(let k=0;k<5;k++){day(35+k);await station(Rb,{syncEach:false});Rb.ev({type:'quest',id:'perf'});await Rb.sync()}
const Ro=app('old','u5');await Ro.sync();const e2n=Rb.earned(),e2o=Ro.earned();
ctl.ACTIVE='new';day(40);await Rb.sync();const e3=Rb.earned();const qdl=X=>(+X.R.qdg||0)+X.R.qd.reduce((a,x)=>a+(+x[2]||0),0);const qnow=qdl(Rb),qexp=1797+Rb.R.qd.filter(x=>x[0]>='2026-12-16').reduce((a,x)=>a+(+x[2]||0),0);
T('التراجع إلى الشيفرة القديمة وحدها بعد بدء الطيّ',true,`بعد 5 أيام على الخادم القديم: تطبيق جديد يعرض ${e2n} وتطبيق قديم ${e2o} · بعد إعادة الجديد ${e3} · جواهر الصناديق: الموجود ${qnow} والمستحقّ ${qexp} → ضاع نهائيًا ${qexp-qnow}`);
console.log(out.join('\n'));
