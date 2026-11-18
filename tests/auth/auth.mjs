// المصادقة في الخادم: الخادم المنشور (RELEASED) مقابل هذا الفرع، بقاعدة في الذاكرة ومفاتيح تجريبية. لا شبكة.
// لكل حالة: رمز الحالة، وعدد عمليات Firestore التي سبّبها الطلب (قراءة أو كتابة).
import {T,out,memfs,SRV,ctl,env,token,user,post} from './it.mjs';import {webcrypto as wc} from 'node:crypto';
const INFO=(n,x)=>out.push('INFO '+n+(x!==undefined?' → '+x:''));
let OPS=0;for(const k of ['get','many','list','page','where','commit']){const f=memfs[k].bind(memfs);memfs[k]=(...a)=>(OPS++,f(...a))}
const O='https://ghadeerabbas.github.io',b64=x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url');
const settle=()=>new Promise(r=>setTimeout(r,150));
async function call(V,tok,path='/sync',body={evs:[]}){const h={Origin:O,'Content-Type':'application/json'};if(tok!==null)h.Authorization='Bearer '+tok;
  const o0=OPS;const r=await SRV[V].fetch(new Request('https://api.test'+path,{method:'POST',headers:h,body:JSON.stringify(body)}),env,{});await settle();return {s:r.status,ops:OPS-o0,j:await r.json().catch(()=>({}))}}
await user('a1');ctl.NOW=Date.parse('2026-11-20T08:00:00Z');
const good=await token('a1','a1@mufradati.app');
// رموز بتوقيع صحيح لكن بيانات خاطئة: نوقّعها بمفتاح الاختبار نفسه عبر token ثم نعدّل الحمولة → التوقيع يفشل؛ ولرمز منتهٍ نرجع الوقت
const [h0,p0,s0]=good.split('.');const pay=JSON.parse(Buffer.from(p0,'base64url'));
const forged=h0+'.'+b64({...pay,sub:'admin'})+'.'+s0;
const otherKey=await wc.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign']);
const signedOther=h0+'.'+p0+'.'+Buffer.from(await wc.subtle.sign('RSASSA-PKCS1-v1_5',otherKey.privateKey,new TextEncoder().encode(h0+'.'+p0))).toString('base64url');
const unknownKid=b64({alg:'RS256',kid:'rotated'})+'.'+p0+'.'+s0, noneAlg=b64({alg:'none',kid:'test'})+'.'+p0+'.';
const malformed=['a.b.c','!!.!!.!!','eyJ.e30.x','e30.e30.sig','x','..','a.b.','%%.%%.%%','eyJhbGciOiJSUzI1NiJ9.!!.x','',' . . '];
const both=async(name,tok,expect,opts={})=>{const n=await call('new',tok),o=await call('old',tok);
  T(`${name}: الفرع ${expect}، وصفر عملية Firestore`,n.s===expect&&n.ops===0,`الفرع ${n.s}/${n.ops} عملية · المنشور ${o.s}/${o.ops} عملية`);return {n,o}};
// 1) الرمز الصحيح
{const n=await call('new',good),o=await call('old',good);T('رمز صحيح: المزامنة تعمل في الفرع كما في المنشور (200 والبيانات نفسها)',n.s===200&&o.s===200&&n.j.core===o.j.core,`${n.s} · ${o.s}`)}
// 2) رموز خاطئة
await both('بلا ترويسة دخول',null,401);
await both('توقيع لا يطابق الحمولة (حساب منتحل)',forged,401);
await both('موقّع بمفتاح آخر',signedOther,401);
await both('مفتاح غير معروف (Google متاح)',unknownKid,401);
await both('خوارزمية none',noneAlg,401);
{ctl.NOW+=2*3600e3;const r=await both('رمز منتهٍ',good,401);ctl.NOW-=2*3600e3}
{const aud=await token('a1','a1@mufradati.app');const [h,p,s]=aud.split('.');const bad=h+'.'+b64({...JSON.parse(Buffer.from(p,'base64url')),aud:'other-project'})+'.'+s;await both('مشروع آخر (aud)',bad,401)}
// 3) رموز مشوّهة: هنا كان الخلل
{let nOk=0,nOps=0,oCodes={},oOps=0;for(const m of malformed){const n=await call('new',m),o=await call('old',m);if(n.s===401)nOk++;nOps+=n.ops;oCodes[o.s]=(oCodes[o.s]||0)+1;oOps+=o.ops}
 T(`${malformed.length} رمزًا مشوّهًا: الفرع 401 لكلها وصفر عملية Firestore`,nOk===malformed.length&&nOps===0,`الفرع ${nOk}/${malformed.length} · عمليات ${nOps}`);
 INFO('[الخادم المنشور] الرموز المشوّهة نفسها',`الردود ${JSON.stringify(oCodes)} · عمليات Firestore ${oOps}`);
 let o200=0;for(let i=0;i<200;i++){const n=await call('new',malformed[i%malformed.length]);o200+=n.ops}
 T('200 طلب برموز مشوّهة على الفرع: صفر عملية Firestore',o200===0,o200)}
// 4) أعطال Google المؤقتة
const f0=globalThis.fetch;const down=(mode)=>{globalThis.fetch=async(u,o)=>{if(String(u).includes('securetoken@system.gserviceaccount.com')){if(mode==='throw')throw new TypeError('network down');return new Response(mode==='500'?'oops':'<html>',{status:mode==='500'?500:200})}return f0(u,o)}};
for(const [mode,label] of [['throw','انقطاع الشبكة'],['500','Google يرد 500'],['html','Google يرد نصًا غير JSON']]){
  down(mode);let codes={},ops=0;for(let i=0;i<30;i++){const n=await call('new',unknownKid);codes[n.s]=(codes[n.s]||0)+1;ops+=n.ops}
  const o=await call('old',unknownKid);globalThis.fetch=f0;
  T(`مفاتيح Google غير متاحة (${label}): الفرع 503 لا 401، فيعيد التطبيق المحاولة ولا يطلب إعادة الدخول`,codes[503]===30,JSON.stringify(codes)+` · المنشور ${o.s}`);
  T(`… (${label}): تسجيل واحد على الأكثر كل 10 دقائق (لا كتابة مع كل طلب)`,ops<=2,ops+' عملية لـ30 طلبًا');
  ctl.NOW+=11*60e3}
{const n=await call('new',good);T('بعد عودة Google: الرمز الصحيح يعمل',n.s===200,n.s)}
// 5) مفاتيح محفوظة أقدم من ساعة وGoogle معطّل (السلوك كما في المنشور: لا يُقبل الدخول حتى تعود المفاتيح، لكن بـ503 لا 500)
{ctl.NOW+=2*3600e3;const g2=await token('a1','a1@mufradati.app');down('throw');const n=await call('new',g2);globalThis.fetch=f0;const o=await call('old',g2);
 INFO('مفاتيح محفوظة أقدم من ساعة وGoogle معطّل',`الفرع ${n.s} · المنشور ${o.s} (بعد عودة Google)`);T('… الفرع يرد 503 (إعادة محاولة) لا 401',n.s===503,n.s)}
// 6) ما لم يتغير (رمز جديد بالوقت الحالي)
const good2=await token('a1','a1@mufradati.app');
{const n=await call('new',good2,'/err'),g=await call('new','a.b.c','/err');T('‎/err: رمز صحيح أو مشوّه كما كان (200، والمشوّه يُعامل مجهولًا)',n.s===200&&g.s===200)}
{const r=await call('new',good2,'/backup',{op:'list'});const o=await call('old',good2,'/backup',{op:'list'});T('صلاحيات المشرف كما هي (غير المشرف 403 في الاثنين)',r.s===403&&o.s===403,r.s+' · '+o.s)}
{const f=memfs.get;memfs.get=async p=>{if(p==='users/a1/data/core')throw new Error('fs get 503');return f(p)};const n=await call('new',good2),o=await call('old',good2);memfs.get=f;
 T('خطأ داخلي بعد دخول صحيح: 500 ويُسجَّل كما في المنشور (لم يتغير)',n.s===500&&o.s===500&&n.ops>=2,`الفرع ${n.s}/${n.ops} · المنشور ${o.s}/${o.ops}`)}
console.log(out.join('\n'));
