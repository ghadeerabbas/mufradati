// ردود Firestore الحقيقية الموثّقة (صيغة google.rpc: الرمز والحالة والرسالة) عبر طبقة REST الحقيقية في الخادم (makeFS)، لا المحاكي.
// المصدر: جدول رموز الأخطاء في وثائق Firestore REST، وتحويل حالات gRPC إلى HTTP المعتمد في Google APIs:
//   ALREADY_EXISTS 409 · ABORTED 409 · FAILED_PRECONDITION 400 · NOT_FOUND 404 · INVALID_ARGUMENT 400 · RESOURCE_EXHAUSTED 429 · UNAVAILABLE 503
import {webcrypto as wc} from 'node:crypto';import path from 'node:path';import {pathToFileURL} from 'node:url';
import {newDB,makeCtx} from './dostub.mjs';
const {ErrGate}=await import(pathToFileURL(path.resolve(process.argv[2])).href);
const out=[],T=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?' → '+x:''));
const k=await wc.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const pem='-----BEGIN PRIVATE KEY-----\n'+Buffer.from(await wc.subtle.exportKey('pkcs8',k.privateKey)).toString('base64')+'\n-----END PRIVATE KEY-----\n';
const env={SA:JSON.stringify({client_email:'t@test.iam.gserviceaccount.com',private_key:pem})};
const P='projects/mufradati-406bd/databases/(default)/documents/';
const E=(code,status,message)=>new Response(JSON.stringify({error:{code,message,status}}),{status:code,headers:{'Content-Type':'application/json'}});
const UT1='2026-11-20T08:01:00.123456Z',UT2='2026-11-20T08:02:00.654321Z';
let NEXT=[],CALLS=[];
globalThis.fetch=async(u,o={})=>{u=String(u);
  if(u.startsWith('https://oauth2.googleapis.com/'))return new Response(JSON.stringify({access_token:'t',expires_in:3600}));
  if(!u.startsWith('https://firestore.googleapis.com/'))throw new Error('شبكة غير مسموحة: '+u);
  const body=o.body?JSON.parse(o.body):null;CALLS.push({u:u.split('/documents')[1],m:o.method||'GET',body});
  const r=NEXT.shift();if(!r)throw new Error('لا رد مُعَدّ لـ'+u);return typeof r==='function'?r(body):r};
const doc=(id,n,ut)=>new Response(JSON.stringify({name:P+'errs/'+id,fields:{msg:{stringValue:'m'},n:{integerValue:String(n)},users:{arrayValue:{values:[{stringValue:'old'}]}},first:{timestampValue:'2026-10-01T00:00:00Z'}},updateTime:ut}));
const ok=ut=>new Response(JSON.stringify({writeResults:[{updateTime:ut}],commitTime:ut}));
function gate(){const ctx=makeCtx(newDB());return {ctx,G:new ErrGate(ctx,env)}}
const rep=(G,id,uid='u1')=>G.fetch(new Request('https://errgate/report',{method:'POST',body:JSON.stringify({id,msg:'m',stack:'',src:'app',where:'',ua:'',ver:'',san:'',uid})}));
const st=(G,id)=>G.state().g.find(g=>g.id===id);
const id='00000000000000aa';
// 1) نجاح: وقت التعديل بدقة الميكروثانية يُحفظ كما أرجعه Firestore ويُرسل شرطًا في الكتابة التالية حرفًا بحرف
{const {G}=gate();await rep(G,id);NEXT=[ok(UT1)];CALLS=[];await G.alarm();
 T('نجاح: يُحفظ وقت التعديل كما أرجعه Firestore',st(G,id).ut===UT1&&st(G,id).st==='live',st(G,id).ut);
 T('الكتابة الأولى بشرط exists=false',CALLS[0].body.writes[0].currentDocument.exists===false);
 await rep(G,id);NEXT=[ok(UT2)];CALLS=[];await G.alarm();
 T('الكتابة التالية بشرط updateTime المحفوظ حرفًا بحرف (دقة الميكروثانية)',CALLS[0].body.writes[0].currentDocument.updateTime===UT1&&st(G,id).ut===UT2,CALLS[0].body.writes[0].currentDocument.updateTime)}
// 2) ALREADY_EXISTS 409 على exists=false: قراءة الوثيقة ودمج عددها
{const {G}=gate();await rep(G,id);NEXT=[E(409,'ALREADY_EXISTS','Document already exists: '+P+'errs/'+id),doc(id,40,UT1)];CALLS=[];await G.alarm();
 const g=st(G,id);T('ALREADY_EXISTS (409): قراءة واحدة، ثم الدمج (الأساس 40) ووقتها',CALLS.length===2&&CALLS[1].m==='GET'&&g.base===40&&g.ut===UT1&&g.st==='live',`نداءات ${CALLS.length} · أساس ${g.base}`);
 NEXT=[ok(UT2)];CALLS=[];await G.alarm();T('… ثم كتابة n=41 بشرط وقتها',CALLS[0].body.writes[0].update.fields.n.integerValue==='41'&&CALLS[0].body.writes[0].currentDocument.updateTime===UT1)}
// 3) FAILED_PRECONDITION 400 على updateTime: قراءة ثم إعادة بالأكبر
{const {G}=gate();await rep(G,id);NEXT=[ok(UT1)];await G.alarm();await rep(G,id);
 NEXT=[E(400,'FAILED_PRECONDITION','the stored version ('+UT2+') does not match the required base version ('+UT1+')'),doc(id,1,UT2)];CALLS=[];await G.alarm();
 const g=st(G,id);T('FAILED_PRECONDITION (400): يُعامل تعارضًا (قراءة، لا خطأ)، ويُؤخذ الوقت الجديد',CALLS[1]&&CALLS[1].m==='GET'&&g.ut===UT2,`نداءات ${CALLS.length} · وقت ${g.ut}`);
 NEXT=[ok('2026-11-20T08:03:00.000001Z')];CALLS=[];await G.alarm();T('… ثم كتابة n=2 (لا تنزل) بالشرط الجديد',CALLS[0].body.writes[0].update.fields.n.integerValue==='2'&&CALLS[0].body.writes[0].currentDocument.updateTime===UT2)}
// 4) NOT_FOUND 404 على updateTime (حذفها أحد): قراءة → غير موجودة → تُعامل كحذف من المشرف
{const {G}=gate();await rep(G,id);NEXT=[ok(UT1)];await G.alarm();await rep(G,id,'u2');
 NEXT=[E(404,'NOT_FOUND','no entity to update: '+P+'errs/'+id),E(404,'NOT_FOUND','Document "'+P+'errs/'+id+'" not found.')];CALLS=[];await G.alarm();
 const g=st(G,id);T('NOT_FOUND (404): قراءة تؤكد الحذف، فتُنسى الأعداد المؤكَّدة ويبقى البلاغ غير المكتوب (1)',g.gen===1&&g.total===1&&g.st==='new',`جيل ${g.gen} · عدد ${g.total}`)}
// 5) ABORTED 409 (تنافس): قراءة ثم إعادة
{const {G}=gate();await rep(G,id);NEXT=[ok(UT1)];await G.alarm();await rep(G,id);
 NEXT=[E(409,'ABORTED','Too much contention on these documents. Please try again.'),doc(id,1,UT1)];CALLS=[];await G.alarm();
 NEXT=[ok(UT2)];await G.alarm();T('ABORTED (409): قراءة ثم إعادة الكتابة، والنتيجة n=2',st(G,id).sent===2&&st(G,id).ut===UT2,st(G,id).sent)}
// 6) أعطال لا تُعامل تعارضًا: لا قراءة، وتأخير متزايد
for(const [code,status,name] of [[429,'RESOURCE_EXHAUSTED','الحصة نفدت'],[503,'UNAVAILABLE','الخدمة غير متاحة'],[400,'INVALID_ARGUMENT','وسيط غير صالح'],[500,'INTERNAL','خطأ داخلي']]){
 const {G,ctx}=gate();await rep(G,id);NEXT=[E(code,status,'x')];CALLS=[];const t0=Date.now();await G.alarm();
 const wait=ctx.st.alarm-t0;T(`${status} (${code}، ${name}): لا قراءة، ولا تعديل، وإعادة بعد تأخير`,CALLS.length===1&&st(G,id).st==='new'&&wait>=60e3-50,`نداءات ${CALLS.length} · بعد ${Math.round(wait/1000)} ث`);
 NEXT=[E(code,status,'x')];await G.alarm();T(`${status}: المحاولة الثانية بتأخير أطول`,ctx.st.alarm-Date.now()>=120e3-50,Math.round((ctx.st.alarm-Date.now())/1000)+' ث')}
console.log(out.join('\n'));
