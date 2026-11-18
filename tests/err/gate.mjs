// بوّابة الأخطاء: شيفرة الخادم الحقيقية (worker.js الجديد) + كائن دائم مُحاكى + قاعدة في الذاكرة مع حقن أعطال. لا شبكة ولا مفاتيح.
import {T,out,memfs,DB,SRV,ctl,env,token,user,post} from './it.mjs';
const INFO=(n,x)=>out.push('INFO '+n+(x!==undefined?' → '+x:''));
import {newDB,makeCtx} from './dostub.mjs';
import path from 'node:path';import {pathToFileURL} from 'node:url';
const DIR=process.argv[2];
process.on('exit',()=>{if(!globalThis.__printed)console.log(out.join('\n'))});
const {ErrGate}=await import(pathToFileURL(path.resolve(DIR,'w_new.mjs')).href);
const W=SRV.new;
// ---- Firestore في الذاكرة مع عدّاد للعمليات وحقن أعطال ----
const OPS=[];let HOOK=null;   // HOOK(kind,arg) قد يرمي خطأً، أو يعيد وعدًا للانتظار، أو 'lost' (تُطبَّق الكتابة ثم يضيع الرد)
const fsx={...memfs,
  async get(p){OPS.push({k:'get',p,t:ctl.NOW});if(HOOK){const h=await HOOK('get',p);if(h==='err')throw new Error('fs get 503')}return memfs.get(p)},
  async list(c){OPS.push({k:'list',p:c,t:ctl.NOW});return memfs.list(c)},
  async commit(ws){for(const w of ws)OPS.push({k:w.del?'del':'write',p:w.path,t:ctl.NOW});
    if(HOOK){const h=await HOOK('commit',ws);if(h==='err'){const e=new Error('fs commit 503');e.status=503;throw e}
      if(h==='lost'){await memfs.commit(ws);const e=new Error('network lost');throw e}}
    return memfs.commit(ws)}};
env.__fs=fsx;
// ---- الكائن الدائم ----
let db=newDB(),ctx=makeCtx(db),G=new ErrGate(ctx,env);
const restart=()=>{ctx=makeCtx(db);ctx.st.alarm=ALARM;G=new ErrGate(ctx,env)};let ALARM=null;
env.ERRGATE={idFromName:()=>'errgate',get:()=>({fetch:(u,i)=>G.fetch(new Request(u,i))})};
// المنبّه: يُنفَّذ إن حان وقته (وقد يُطلب تنفيذه مرتين لمحاكاة «مرة واحدة على الأقل»)
async function tick(ms,{twice=false}={}){const end=ctl.NOW+ms;let n=0;
  while(true){const a=ctx.st.alarm;if(a&&a<=end){ctl.NOW=Math.max(ctl.NOW,a);ctx.st.alarm=null;await G.alarm();if(twice)await G.alarm();n++;if(n>5000)throw new Error('alarm loop')}else break}
  ctl.NOW=end;ALARM=ctx.st.alarm;return n}
// ---- الطلبات ----
const ORIGIN='https://ghadeerabbas.github.io';
async function rep(uid,msg,{stack='',where='#review',origin=ORIGIN,raw}={}){const h={'Content-Type':'application/json'};if(origin)h.Origin=origin;if(uid)h.Authorization='Bearer '+await token(uid,uid+'@mufradati.app');
  const r=await W.fetch(new Request('https://api.test/err',{method:'POST',headers:h,body:raw!==undefined?raw:JSON.stringify({msg,stack,where,ua:'Mozilla/5.0 (Linux; Android 14) Chrome/131',ver:'web'})}),env,{});return r.status}
// حدّ الخادم لكل نسخة (30 في الدقيقة): نتخطّاه في الاختبارات التي تقيس البوّابة نفسها بتقديم الوقت 61 ثانية كل 30 طلب
let K=0;async function repN(uid,msg,o){if(K++%29===0)ctl.NOW+=61e3;return rep(uid,msg,o)}
async function admin(body){const r=await W.fetch(new Request('https://api.test/errs',{method:'POST',headers:{Authorization:'Bearer '+await token('adm','admin@mufradati.app'),'Content-Type':'application/json',Origin:ORIGIN},body:JSON.stringify(body)}),env,{});return {status:r.status,j:await r.json()}}
const errs=()=>[...DB.keys()].filter(p=>p.startsWith('errs/')).map(p=>({id:p.slice(5),...DB.get(p).data}));
const doc=id=>DB.get('errs/'+id)?.data;
const fsOps=(from=0)=>OPS.slice(from).filter(o=>o.k!=='list'||true).length;
const reset=()=>{for(const k of [...DB.keys()])if(k.startsWith('errs/')||k.startsWith('errq/'))DB.delete(k);db=newDB();ctx=makeCtx(db);G=new ErrGate(ctx,env);HOOK=null;ALARM=null};
// البصمة تتجاهل الأرقام (الخطأ نفسه بأرقام مختلفة مجموعة واحدة)، فالرسائل المختلفة في الاختبار تُميَّز بحروف
const L=n=>n.toString(26).split('').map(c=>String.fromCharCode(97+parseInt(c,26))).join('');
const S=(n)=>`TypeError: Cannot read properties of undefined (reading 'k${L(n)}')`;
const ST=(fn,line)=>`TypeError: x\n    at ${fn} (https://ghadeerabbas.github.io/mufradati/index.html?v=9ef4ef4607:${line}:17)\n    at HTMLButtonElement.<anonymous> (https://ghadeerabbas.github.io/mufradati/index.html?v=9ef4ef4607:3302:9)`;
const idOf=async m=>{for(const e of errs())if(e.msg===m)return e.id;return null};
ctl.NOW=Date.parse('2026-11-20T08:00:00Z');for(const u of ['u1','u2','u3','u4','u5','u6','u7','u8','u9','u10'])await user(u);

// ===== 1) المسار الأساسي: لا Firestore في مسار البلاغ، والكتابة من المنبّه =====
{const o0=OPS.length;const s=await rep('u1',S(1),{stack:ST('renderSafe',5175)});
 T('بلاغ مسجّل: يُقبل ولا يلمس Firestore في مساره',s===200&&OPS.length===o0,'عمليات '+(OPS.length-o0));
 await tick(61e3);const e=errs();
 T('بعد المنبّه: وثيقة واحدة n=1 بالمستخدم والرسالة والمسار',e.length===1&&e[0].n===1&&e[0].users[0]==='u1'&&e[0].msg===S(1)&&/renderSafe/.test(e[0].stack),JSON.stringify(e.map(x=>[x.n,x.users])));
 T('بعد المنبّه: كتابة واحدة فقط وصفر قراءة',OPS.slice(o0).filter(o=>o.k==='write').length===1&&!OPS.slice(o0).some(o=>o.k==='get'));
 await rep('u1',S(1),{stack:ST('renderSafe',5175)});await rep('u2',S(1),{stack:ST('renderSafe',5175)});await tick(61e3);
 const d=errs()[0];T('بلاغان آخران: n=3 والمستخدمان، بلا قراءة',d.n===3&&d.users.join()==='u1,u2'&&!OPS.slice(o0).some(o=>o.k==='get'),d.n+' '+d.users)}
reset();

// ===== 2) الرفض لا يلمس Firestore =====
{const o0=OPS.length;let st={};for(let i=0;i<300;i++){const s=await rep(null,'x'+i,{origin:i%2?'https://evil.example':null});st[s]=(st[s]||0)+1}
 T('300 طلب من مصدر غير مسموح أو بلا مصدر: 403 وصفر عملية في Firestore',st[403]===300&&OPS.length===o0,JSON.stringify(st));
 const r1=await rep(null,'x',{raw:'x'.repeat(7000)}),r2=await rep(null,'',{raw:'{"msg":""}'}),r3=await rep(null,'',{raw:'not json'});
 T('حجم زائد 413، ورسالة فارغة أو نص غير صالح: لا شيء',r1===413&&r2===200&&r3===200&&OPS.length===o0);
 // فيضان مجهول: 2000 رسالة مختلفة
 ctl.NOW+=61e3;K=0;   // حدّ النسخة يبدأ دقيقة جديدة
 for(let i=0;i<2000;i++)await repN(null,'flood '+L(i));
 T('2000 بلاغ مجهول مختلف: صفر عملية في Firestore أثناءها',OPS.length===o0,'عمليات '+(OPS.length-o0));
 const sg=G.state();T('المجهولون: 30 مجموعة جديدة بالضبط، والباقي يُعدّ فقط',sg.g.filter(g=>g.kind==='err').length===30&&sg.q[0].an===30&&sg.anonDrop===1970,'مجموعات '+sg.g.length+' · محجوب '+sg.anonDrop);
 await tick(61e3);const w=OPS.slice(o0).filter(o=>o.k==='write').length;
 T('بعد المنبّه: 30 وثيقة + ملخّص بالعدد فقط، صفر قراءة',w<=31&&errs().length<=31&&!OPS.slice(o0).some(o=>o.k==='get'),'كتابات '+w);
 const sm=errs().find(e=>e.where==='summary');T('الملخّص: «حُجب 1970» دون أي نص من المجهولين',sm&&/1970 بلاغ من غير مسجّلين/.test(sm.stack)&&!/flood/.test(sm.stack),sm&&sm.stack.slice(0,80))}
reset();

// ===== 3) التزامن: مئات الطلبات في الوقت نفسه =====
{// حدّ الخادم لكل نسخة (30/دقيقة) يرفض معظم الطلبات قبل البوّابة؛ نقيس البوّابة نفسها بطلبات مباشرة إليها، متزامنة
 const ids=[];for(let i=0;i<500;i++)ids.push(i.toString(16).padStart(16,'0'));
 await Promise.all(ids.map((id,i)=>G.fetch(new Request('https://errgate/report',{method:'POST',body:JSON.stringify({id,msg:'conc '+i,stack:'',src:'app',where:'',ua:'',ver:'',san:'',uid:'u'+(1+i%3)})}))));
 let s=G.state();const per=['u1','u2','u3'].map(u=>s.qu.find(x=>x.uid===u));
 T('500 بلاغ متزامن لمجموعات جديدة من 3 مستخدمين: 30 مجموعة بالضبط لكل مستخدم',per.every(x=>x.ng===30)&&s.g.filter(g=>g.kind==='err').length===90,per.map(x=>x.ng).join(','));
 const sx=JSON.parse(s.sx[0].data);const inSum=Object.values(sx.g).reduce((a,x)=>a+x.n,0);
 T('الباقي (410) في الملخّص: 50 مجموعة مفصّلة بعدّها، و360 تحت «غير مفصّل»',inSum===50&&sx.more===360,'مفصّل '+inSum+' · غير مفصّل '+sx.more);
 T('عدّاد اليوم: 90 مقبول + 410 فوق السقف = 500',s.q[0].tw===90&&s.q[0].sm===410,s.q[0].tw+'+'+s.q[0].sm);
 reset();const id='abcdef0123456789';
 await Promise.all([...Array(500)].map((_,i)=>G.fetch(new Request('https://errgate/report',{method:'POST',body:JSON.stringify({id,msg:'same',stack:'',src:'app',where:'',ua:'',ver:'',san:'',uid:'u'+(1+i%10)})}))));
 await tick(61e3);T('500 بلاغ متزامن للخطأ نفسه من 10 مستخدمين: n=500 والمستخدمون 10',doc(id).n===500&&doc(id).users.length===10,doc(id).n+' · '+doc(id).users.length)}
reset();

// ===== 4) فشل Firestore وإعادة المحاولة =====
{const id=await (async()=>{await rep('u1',S(4));await rep('u2',S(4));return null})();
 HOOK=async k=>k==='commit'?'err':null;const o0=OPS.length;await tick(3600e3);
 const tries=OPS.slice(o0).filter(o=>o.k==='write').length;
 T('Firestore معطّل ساعة: لا وثيقة، والمحاولات بتأخير متزايد (لا كل دقيقة)',errs().length===0&&tries>0&&tries<=6,'محاولات '+tries);
 await rep('u3',S(4));HOOK=null;await tick(3600e3);const e=errs();
 T('بعد العودة: لا يضيع أي بلاغ مسجّل (n=3)',e.length===1&&e[0].n===3&&e[0].users.length===3,e.map(x=>x.n).join())
 // الرد يضيع بعد أن تُكتب الوثيقة فعلًا
 await rep('u1',S(4));let once=true;HOOK=async k=>k==='commit'&&once?(once=false,'lost'):null;await tick(61e3);
 T('ضاع الرد بعد الكتابة: n=4 (لا تكرار)',errs()[0].n===4,errs()[0].n);
 HOOK=null;await tick(3600e3);T('بعد إعادة المحاولة: ما زال n=4، ووقت الوثيقة معروف للبوّابة',errs()[0].n===4&&G.state().g[0].ut===DB.get('errs/'+errs()[0].id).ut,errs()[0].n);
 // المنبّه يُنفَّذ مرتين للحدث نفسه
 await rep('u2',S(4));await tick(61e3,{twice:true});await tick(61e3,{twice:true});
 T('المنبّه مرتين للحدث نفسه: n=5 بالضبط',errs()[0].n===5,errs()[0].n)}
reset();

// ===== 5) لا تنزل القيمة: كتابة بوقت قديم تُرفض، وتعارض الوقت يُحلّ بالأكبر =====
{await rep('u1',S(5));await tick(61e3);await rep('u1',S(5));await tick(61e3);const id=errs()[0].id,ut1=DB.get('errs/'+id).ut;
 let rej=false;try{await memfs.commit([{path:'errs/'+id,data:{n:1},ifUpdateTime:String(+ut1-1)}])}catch(e){rej=!!e.conflict}
 T('كتابة متأخرة بوقت تعديل قديم: يرفضها Firestore فلا تُنزل العدد',rej&&doc(id).n===2,doc(id).n);
 // كتابة لنا سابقة وصلت بعد أن ظننّا فشلها (وقت مختلف، عدد أكبر من المعروف)
 const d=DB.get('errs/'+id);DB.set('errs/'+id,{data:{...d.data,n:7},ut:'9'+d.ut});
 await rep('u2',S(5));await tick(61e3);await tick(61e3);
 T('وقت تعديل غير متوقَّع (عدد 7 أكبر مما عند البوّابة): تُقرأ الوثيقة ولا ينزل العدد',doc(id).n===7,doc(id).n);
 await rep('u3',S(5));await tick(61e3);T('والبلاغ التالي يُضاف فوقه: n=8',doc(id).n===8,doc(id).n)}
reset();

// ===== 6) حذف المشرف أثناء وصول بلاغ جديد =====
async function seeded(m){const a=await rep('u1',m),b=await rep('u2',m);await tick(61e3);const e=errs().find(e=>e.msg===m);if(!e)throw new Error('seeded '+a+' '+b+' '+JSON.stringify(G.state().g.map(x=>[x.msg,x.st,x.total,x.sent]))+' '+JSON.stringify(errs().map(x=>x.msg)));return e.id}
{// أ) بلاغ جديد قبل تبليغ البوّابة (لم يُكتب بعد، أي لم يره المشرف)
 const id=await seeded(S(61));await rep('u3',S(61));const r=await admin({del:id});
 T('حذف: الردّ 200 والوثيقة محذوفة',r.status===200&&!doc(id));
 await tick(61e3);T('أ) البلاغ الجديد قبل الحذف لا يضيع: وثيقة جديدة n=1 من u3 وحده (القديم لا يعود)',doc(id)&&doc(id).n===1&&doc(id).users.join()==='u3',doc(id)&&JSON.stringify([doc(id).n,doc(id).users]))}
{// ب) بلاغ بين تبليغ البوّابة وحذف الوثيقة من Firestore، ومنبّه يجري قبل الحذف
 const id=await seeded(S(62));let gate;const wait=new Promise(r=>gate=r);
 HOOK=async(k,ws)=>{if(k==='commit'&&ws[0].del){await wait}return null};
 const pdel=admin({del:id});await new Promise(r=>setTimeout(r,20));
 await rep('u4',S(62));ctl.NOW+=61e3;await G.alarm();   // الوثيقة القديمة ما زالت موجودة: لا دمج ولا كتابة فوقها
 T('ب) منبّه قبل حذف الوثيقة: لا تُدمج أعدادها القديمة',doc(id)&&doc(id).n===2,doc(id)&&doc(id).n);
 gate();await pdel;HOOK=null;await tick(120e3);
 T('ب) بعد الحذف: وثيقة جديدة n=1 من u4 وحده',doc(id)&&doc(id).n===1&&doc(id).users.join()==='u4',doc(id)&&JSON.stringify([doc(id).n,doc(id).users]))}
{// ج) بلاغ بعد حذف الوثيقة
 const id=await seeded(S(63));await admin({del:id});T('ج) بعد الحذف ولا بلاغات: لا وثيقة',!doc(id));await tick(3600e3);T('ج) ولا تعود بعد ساعة من المنبّهات',!doc(id));
 await rep('u5',S(63));await tick(61e3);T('ج) بلاغ بعد الحذف: وثيقة جديدة n=1',doc(id)&&doc(id).n===1&&doc(id).users.join()==='u5')}
{// د) كتابة جارية (بطيئة) لحظة الحذف: لا تعيد إنشاء الوثيقة
 const id=await seeded(S(64));await rep('u6',S(64));let gate;const wait=new Promise(r=>gate=r);
 HOOK=async(k,ws)=>{if(k==='commit'&&!ws[0].del&&ws[0].path==='errs/'+id){await wait}return null};
 ctl.NOW+=61e3;const pal=G.alarm();await new Promise(r=>setTimeout(r,20));
 let delDone=false;const pdel=admin({del:id}).then(r=>(delDone=true,r));await new Promise(r=>setTimeout(r,20));
 T('د) الحذف ينتظر انتهاء الكتابة الجارية قبل أن يحذف من Firestore',!delDone);
 gate();await pal;await pdel;HOOK=null;
 T('د) بعد انتهائهما: الوثيقة محذوفة',!doc(id));await tick(3600e3);
 T('د) البلاغ u6 الذي كان داخل الكتابة الجارية لم يره المشرف فلا يضيع، والأعداد القديمة لا تعود: n=1',doc(id)&&doc(id).n===1&&doc(id).users.join()==='u6',doc(id)?JSON.stringify([doc(id).n,doc(id).users]):'لا وثيقة')}
{// ز) حذف الملخّص من صفحة الأخطاء: لا يعود إلا ببلاغات فوق السقف جديدة
 reset();for(let i=0;i<32;i++)await G.fetch(new Request('https://errgate/report',{method:'POST',body:JSON.stringify({id:i.toString(16).padStart(16,'0'),msg:'s'+L(i),stack:'',src:'app',where:'',ua:'',ver:'',san:'',uid:'u1'})}));
 await tick(61e3);const sm=errs().find(e=>e.where==='summary');await admin({del:sm.id});await tick(3600e3);
 T('ز) حذف الملخّص: لا يعود دون بلاغات جديدة',!errs().some(e=>e.where==='summary'));
 await G.fetch(new Request('https://errgate/report',{method:'POST',body:JSON.stringify({id:'ffff000000000000',msg:'new',stack:'',src:'app',where:'',ua:'',ver:'',san:'',uid:'u1'})}));await tick(61e3);
 const s2=errs().find(e=>e.where==='summary');T('ز) بلاغ جديد فوق السقف بعد الحذف: ملخّص جديد بعدد 1',s2&&s2.n===1,s2&&s2.n)}
{// هـ) البوّابة لا تردّ: لا حذف
 const id=await seeded(S(65));const g0=env.ERRGATE;env.ERRGATE={idFromName:()=>'x',get:()=>({fetch:async()=>new Response('x',{status:500})})};
 const r=await admin({del:id});env.ERRGATE=g0;T('هـ) البوّابة لا تؤكّد: 503 والوثيقة باقية',r.status===503&&!!doc(id))}
{// و) حذف الكل
 await rep('u7',S(66));await tick(61e3);const r=await admin({del:'all'});await tick(3600e3);T('و) حذف الكل: لا يعود شيء',r.status===200&&errs().length===0,errs().length)}
reset();

// ===== 7) وثيقة موجودة من قبل البوّابة (كتبها الخادم القديم) =====
{const m=S(7);await rep('u1',m);const id=G.state().g[0].id;DB.clear;
 reset();await memfs.commit([{path:'errs/'+id,data:{msg:m,stack:'old',src:'app',where:'',ua:'',ver:'',n:40,first:{__ts:Date.parse('2026-11-01')},last:{__ts:Date.parse('2026-11-10')},users:['u9']}}]);
 await rep('u1',m);await tick(61e3);await tick(61e3);
 T('وثيقة قديمة: يبدأ العدّ من 40 (n=41)، ويبقى أول ظهور والمستخدم القديم',doc(id).n===41&&doc(id).users.includes('u9')&&doc(id).first.ms===Date.parse('2026-11-01'),JSON.stringify([doc(id).n,doc(id).users]))}
reset();

// ===== 8) الملخّص: مستخدم فوق سقفه =====
{for(let i=0;i<230;i++)await repN('u8',i<35?'many '+L(i):'many '+L(0),{stack:ST('saveX',4000)});
 const s=G.state();await tick(61e3);const sm=errs().find(e=>e.where==='summary');
 T('مستخدم فوق سقفه: 30 مجموعة، والباقي في ملخّص اليوم',s.qu[0].ng===30&&s.qu[0].w===200&&s.q[0].sm===30,`مجموعات ${s.qu[0].ng} · بلاغات ${s.qu[0].w} · ملخّص ${s.q[0].sm}`);
 T('الملخّص يظهر في صفحة الأخطاء كوثيقة عادية بعدد البلاغات',sm&&sm.n===30&&/بلاغات فوق السقف/.test(sm.msg),sm&&sm.msg);
 T('الملخّص بلا معرّفات مستخدمين',sm&&!/u8/.test(JSON.stringify(sm))&&sm.users.length===0);
 const w0=OPS.filter(o=>o.k==='write'&&o.p==='errs/'+sm.id).length;for(let i=0;i<10;i++){await repN('u8','many '+L(0));await tick(61e3)}
 const w1=OPS.filter(o=>o.k==='write'&&o.p==='errs/'+sm.id).length;T('الملخّص لا يُكتب أكثر من مرة كل 15 دقيقة',w1-w0<=1,'كتابات في 10 دقائق '+(w1-w0))}
reset();

// ===== 9) سجلّ اليوم في errq =====
{await rep('u1',S(9));await rep(null,S(90));await tick(61e3);ctl.NOW+=86400e3;await rep('u1',S(9));await tick(61e3);await tick(61e3);
 const q=[...DB.keys()].filter(k=>k.startsWith('errq/'));const d=q.length&&DB.get(q[0]).data;
 T('اليوم التالي: سجلّ errq واحد لليوم السابق، بلا معرّفات',q.length===1&&d.reports===2&&d.users===1&&!/u1/.test(JSON.stringify(d)),JSON.stringify(d))}
reset();

// ===== 10) إعادة تشغيل البوّابة =====
{for(let i=0;i<5;i++)await rep('u'+(i+1),S(10));ALARM=ctx.st.alarm;restart();await tick(61e3);
 T('إعادة تشغيل البوّابة قبل الكتابة: لا يضيع بلاغ مسجّل (n=5)',errs()[0]&&errs()[0].n===5,errs()[0]&&errs()[0].n)}
reset();

// ===== 11) ميزانية Firestore تحت ضغط: 300 مجموعة تتلقّى بلاغات كل دقيقة 3 أيام، وأعطال متكررة =====
{const users=[...Array(60)].map((_,i)=>'p'+i);let flip=0;
 HOOK=async k=>{flip++;return k==='commit'?(flip%5===0?'err':flip%2?'lost':null):(flip%7===0?'err':null)};   // ضياع ردود (تعارض فقراءة) وأعطال
 const o0=OPS.length;let seq=0;
 for(let m=0;m<3*1440;m++){for(let j=0;j<20;j++){const g=(seq++*7919)%300,u=users[(seq*31)%60];
     await G.fetch(new Request('https://errgate/report',{method:'POST',body:JSON.stringify({id:g.toString(16).padStart(16,'0'),msg:'p'+L(g),stack:'',src:'app',where:'',ua:'',ver:'',san:'',uid:u})}))}
   await tick(60e3)}
 const ops=OPS.slice(o0);const win=k=>{const a=ops.filter(o=>k(o));let w=0,j=0;for(let i=0;i<a.length;i++){while(a[i].t-a[j].t>=86400e3)j++;w=Math.max(w,i-j+1)}return w};
 const wW=win(o=>o.k==='write'),wR=win(o=>o.k==='get'),wQ=win(o=>o.k==='write'&&o.p.startsWith('errq/'));
 T('ضغط 3 أيام: أسوأ 24 ساعة متتالية — محاولات الكتابة ≤ 2000',wW<=2000&&wW>1500,'أقصى '+wW+' (الكلّ '+ops.filter(o=>o.k==='write').length+')');
 T('ضغط 3 أيام: أسوأ 24 ساعة متتالية — القراءات (عند التعارض فقط) ≤ 2000',wR<=2000,'أقصى '+wR);
 T('ضغط 3 أيام: سجلّ errq مرة واحدة لكل يوم',wQ<=2&&[...DB.keys()].filter(k=>k.startsWith('errq/')).length>=2,'errq '+[...DB.keys()].filter(k=>k.startsWith('errq/')).length);
 const st=ctx.st;T('ضغط 3 أيام: صفوف البوّابة المكتوبة يوميًا ضمن حد الخطة المجانية (100,000)',st.rowsWritten/3<100000,'متوسط '+Math.round(st.rowsWritten/3)+' صف/يوم');
 HOOK=null}
reset();

// ===== 12) بلا بوّابة: لا كتابة أبدًا =====
{const g0=env.ERRGATE;delete env.ERRGATE;const o0=OPS.length;await rep('u1',S(12));env.ERRGATE=g0;T('خادم بلا ربط البوّابة: صفر عملية في Firestore',OPS.length===o0)}
// ===== 13) صفحة المشرف وأخطاء الخادم =====
{await rep('u1',S(13),{stack:ST('syncNow',2201)});await tick(61e3);const r=await admin({});
 T('صفحة الأخطاء تعرض الوثائق كما كانت (مع حقل التنقية)',r.status===200&&r.j.items.length===1&&'san' in r.j.items[0]&&r.j.items[0].n===1);
 const j=await post('/sync','u1',{evs:[]});T('المزامنة تعمل كما كانت',!!j.core)}

// ===== 14) أخطاء الخادم المباشرة: لا استنزاف =====
{reset();const bad=['a.b.c','!!.!!.!!','eyJ.e30.x','e30.e30.sig','x','..','a.b.','%%.%%.%%','eyJhbGciOiJSUzI1NiJ9.!!.x'];
 const hit=async(Wk,tok)=>(await Wk.fetch(new Request('https://api.test/sync',{method:'POST',headers:{Authorization:'Bearer '+tok,Origin:ORIGIN,'Content-Type':'application/json'},body:'{}'}),env,{})).status;
 const wo=()=>OPS.filter(o=>o.k==='write'&&o.p.startsWith('errs/')).length;
 const o0=wo();const so={};for(let i=0;i<200;i++){const s=await hit(SRV.old,bad[i%bad.length]);so[s]=(so[s]||0)+1}
 await new Promise(r=>setTimeout(r,300));const oldW=wo()-o0;   // الخادم القديم يكتب في الخلفية
 INFO('[خلل في الخادم المنشور، يصلحه هذا الفرع] 200 طلب مجهول برمز مشوّه: كتابات أخطاء في Firestore',oldW+' كتابة · الردود '+JSON.stringify(so));
 reset();const o1=wo(),r1=OPS.length;const sn={};for(let i=0;i<200;i++){const s=await hit(W,bad[i%bad.length]);sn[s]=(sn[s]||0)+1}await tick(3600e3);
 T('الخادم الجديد: 200 طلب برمز مشوّه → 401 كلها، وصفر عملية في Firestore حتى بعد ساعة من المنبّهات',sn[401]===200&&OPS.length===r1&&G.state().g.length===0,JSON.stringify(sn)+' · عمليات '+(OPS.length-r1));
 // مستخدم مسجّل يسبّب خطأ خادم مرارًا
 HOOK=async(k,p)=>k==='get'&&p==='users/u7/data/core'?'err':null;const r2=OPS.length;let e5=0;
 for(let i=0;i<300;i++){if(i%29===0)ctl.NOW+=61e3;try{await post('/sync','u7',{evs:[]})}catch(e){if(/500/.test(e.message))e5++}}
 const during=OPS.slice(r2).filter(o=>o.k==='write').length;HOOK=null;await tick(3600e3);
 const sv=errs().filter(e=>e.src==='server');const q=G.state().qu.find(x=>x.uid==='u7');
 T('300 خطأ خادم من مستخدم واحد: صفر كتابة أثناءها، والبوّابة تعدّ بسقف المستخدم (200)',e5===300&&during===0&&q.w===200,'أخطاء '+e5+' · كتابات أثناءها '+during+' · مقبول '+q.w);
 T('وبعد المنبّه: مجموعة خطأ خادم واحدة n=200 وملخّص بالباقي',sv.length===1&&sv[0].n===200&&errs().some(e=>e.where==='summary'&&e.n===100),sv.map(x=>x.n)+' · '+errs().filter(e=>e.where==='summary').map(x=>x.n));
 // عطل النسخ الاحتياطي المجدول
 const waits=[];const ctxw={waitUntil:p=>waits.push(p)};env.BAK={...env.BAK,list:async()=>{throw new Error('kv down')},put:async()=>{throw new Error('kv down')},get:async()=>null};
 await W.scheduled({},env,ctxw);await Promise.all(waits);await tick(61e3);
 T('عطل النسخ الاحتياطي المجدول يمرّ بالبوّابة ويظهر في صفحة الأخطاء',errs().some(e=>e.src==='server'&&/النسخ الاحتياطي فشل/.test(e.msg)),errs().map(e=>e.msg.slice(0,30)).join(' | '));
 // البوّابة معطّلة: كتابة مباشرة مرة واحدة كل 10 دقائق على الأكثر
 const g0=env.ERRGATE;env.ERRGATE={idFromName:()=>'x',get:()=>({fetch:async()=>new Response('x',{status:500})})};HOOK=async(k,p)=>k==='get'&&p==='users/u6/data/core'?'err':null;
 const r3=OPS.filter(o=>o.k==='write').length;for(let i=0;i<50;i++){if(i%29===0)ctl.NOW+=1e3;try{await post('/sync','u6',{evs:[]})}catch(e){}}
 const direct=OPS.filter(o=>o.k==='write').length-r3;HOOK=null;env.ERRGATE=g0;
 T('البوّابة معطّلة: 50 خطأ خادم → كتابة مباشرة واحدة فقط (مرة كل 10 دقائق لكل نسخة)',direct===1,direct+' كتابة')}
// ===== 14ب) تعذّر جلب مفاتيح Google: 503 (يعيد التطبيق المحاولة) لا 401، وتسجيل محدود عبر البوّابة =====
{reset();const f0=globalThis.fetch;globalThis.fetch=async(u,o)=>{if(String(u).includes('securetoken@system.gserviceaccount.com'))throw new TypeError('network down');return f0(u,o)};
 const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const tok=b64({alg:'RS256',kid:'rotated-key'})+'.'+b64({sub:'u1'})+'.c2ln';
 const r0=OPS.length;const codes={};for(let i=0;i<40;i++){const r=await W.fetch(new Request('https://api.test/sync',{method:'POST',headers:{Authorization:'Bearer '+tok,Origin:ORIGIN},body:'{}'}),env,{});codes[r.status]=(codes[r.status]||0)+1}
 globalThis.fetch=f0;const during=OPS.length-r0;await tick(61e3);const sv=errs().filter(e=>e.src==='server');
 T('مفاتيح Google غير متاحة: 503 لا 401 (لا يُطلب من الطفل إعادة الدخول)، وصفر عملية Firestore أثناءها',codes[503]===40&&during===0,JSON.stringify(codes)+' · عمليات '+during);
 T('… ويظهر خطأ خادم واحد بعدد البلاغات عبر البوّابة',sv.length===1&&sv[0].n===40&&/jwks unavailable/.test(sv[0].msg),sv.map(x=>x.msg+' '+x.n).join())}
// ===== 15) مفتاح الإيقاف ERR_MODE=off =====
{reset();env.ERR_MODE='off';const r0=OPS.length;let c=0;const f0=G.fetch.bind(G);G.fetch=(...a)=>(c++,f0(...a));
 for(let i=0;i<20;i++)await rep('u1',S(150));HOOK=async(k,p)=>k==='get'&&p==='users/u5/data/core'?'err':null;try{await post('/sync','u5',{evs:[]})}catch(e){}HOOK=null;
 await tick(3600e3);T('ERR_MODE=off: لا بوّابة ولا Firestore لبلاغات التطبيق ولا لأخطاء الخادم',c===0&&OPS.slice(r0).every(o=>!o.p.startsWith('errs/')),'طلبات البوّابة '+c+' · كتابات أخطاء '+OPS.slice(r0).filter(o=>o.p.startsWith('errs/')).length);
 delete env.ERR_MODE;G.fetch=f0}
// ===== 16) أول تشغيل مع أخطاء قديمة =====
{reset();for(let i=0;i<100;i++)await memfs.commit([{path:'errs/'+(0xa000+i).toString(16).padStart(16,'0'),data:{msg:'old '+i,stack:'',src:'app',where:'',ua:'',ver:'',n:i+1,first:{__ts:Date.parse('2026-10-01')},last:{__ts:Date.parse('2026-10-02')},users:['u1']}}]);
 const r0=OPS.length;for(let i=0;i<5;i++)await rep('u2',S(160+i));await tick(6*3600e3);
 T('100 وثيقة قديمة لم تتكرر: لا تُقرأ ولا تُكتب ولا تتغيّر (لا استيراد جماعي)',!OPS.slice(r0).some(o=>/errs\/000000000000a/.test(o.p))&&[...Array(100)].every((_,i)=>doc((0xa000+i).toString(16).padStart(16,'0')).n===i+1));
 // وثيقة قديمة بحقول ناقصة (بلا users ولا first)
 await rep('u3',S(170));const id=G.state().g.find(g=>g.msg===S(170)).id;reset();
 await memfs.commit([{path:'errs/'+id,data:{msg:S(170),n:12}}]);await rep('u3',S(170));await tick(61e3);await tick(61e3);
 T('وثيقة قديمة بلا مستخدمين ولا أول ظهور: تُدمج دون خطأ (n=13)',doc(id).n===13&&doc(id).users.join()==='u3'&&doc(id).first&&doc(id).first.ms>0,JSON.stringify([doc(id).n,doc(id).users]));
 // الخادم القديم (أثناء الانتقال) يكتب عددًا أقل فوق كتابة البوّابة
 await rep('u4',S(170));await tick(61e3);const d=DB.get('errs/'+id);DB.set('errs/'+id,{data:{...d.data,n:5},ut:'77'+d.ut});
 await rep('u5',S(170));await tick(61e3);await tick(61e3);
 T('كتابة أقل من خادم قديم أثناء الانتقال: تُصحَّح، والعدد لا ينزل (n=15)',doc(id).n===15,doc(id).n);
 // وثيقة قديمة مفتاحها من نص غير منقّى (فيه بريد): تبقى كما هي، والجديدة مجموعة مستقلة
 const raw='Error: login failed for ali@mufradati.app';const oldId=[...new Uint8Array(await crypto.subtle.digest('SHA-1',new TextEncoder().encode('app|'+raw.replace(/\d+/g,'#')+'|')))].slice(0,8).map(b=>b.toString(16).padStart(2,'0')).join('');
 await memfs.commit([{path:'errs/'+oldId,data:{msg:raw,n:9,users:['u1'],first:{__ts:1},last:{__ts:2}}}]);await rep('u1',raw);await tick(61e3);
 const nw=errs().find(e=>e.msg==='Error: login failed for [بريد]');
 T('وثيقة قديمة بنص غير منقّى: لا تُلمس، والبلاغ الجديد مجموعة منقّاة مستقلة (ظهور مكرر مرة واحدة)',doc(oldId).n===9&&nw&&nw.id!==oldId&&nw.n===1,'قديمة '+doc(oldId).n+' · جديدة '+(nw&&nw.n))}
globalThis.__printed=1;console.log(out.join('\n'));
