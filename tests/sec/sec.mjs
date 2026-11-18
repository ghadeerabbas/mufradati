// الإصلاحات الأمنية المحدودة: حساب غير مفعّل لا يصل إلى الصداقة والتحدي والبلاغات؛ تفاصيل الأخطاء للمشرف وحده؛ لا مصدر تجريبي في CORS.
// الخادم المنشور (RELEASED) مقابل هذا الفرع، بقاعدة في الذاكرة ومفاتيح تجريبية. لا شبكة.
import {T,out,memfs,SRV,ctl,env,token,user,post} from './it.mjs';
const INFO=(n,x)=>out.push('INFO '+n+(x!==undefined?' → '+x:''));
let OPS=0;for(const k of ['get','many','list','page','where','commit']){const f=memfs[k].bind(memfs);memfs[k]=(...a)=>(OPS++,f(...a))}
const O='https://ghadeerabbas.github.io';
async function call(V,uid,path,body={},origin=O,email){const t=await token(uid,email||uid+'@mufradati.app');const o0=OPS;
  const r=await SRV[V].fetch(new Request('https://api.test'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+t},body:JSON.stringify(body)}),env,{});
  await new Promise(r=>setTimeout(r,50));return {s:r.status,j:await r.json().catch(()=>({})),ops:OPS-o0,h:r.headers}}
ctl.NOW=Date.parse('2026-11-20T08:00:00Z');
// أعضاء: حسابان مفعّلان كما ينشئهما المشرف (وثيقة التفعيل members ووثيقة المستخدم)
for(const [u,no] of [['u_kid1',101],['u_kid2',102]]){await user(u);await memfs.commit([{path:'members/'+u,data:{ts:{__ts:ctl.NOW},by:'admin',no}}])}
const STR='strangerUid000000000000000';   // حساب Firebase أنشأه غريب بنفسه: لا members ولا users

// ===== 1) الغريب غير المفعّل =====
const cases=[['/fr',{op:'tick',act:1}],['/fr',{op:'list'}],['/fr',{op:'add',login:'kid1'}],['/fr',{op:'add',login:'101'}],['/fr',{op:'acc',uid:'u_kid1'}],['/fr',{op:'del',uid:'u_kid1'}],
  ['/duel',{op:'get'}],['/duel',{op:'inv',to:['u_kid1']}],['/report',{k:'Haus',kind:'other'}],['/sync',{evs:[]}]];
{let ok=0,bad=[];for(const [p,b] of cases){const n=await call('new',STR,p,b);const lim=p==='/sync'?99:3;if(n.s===403&&n.j.error==='inactive'&&n.ops<=lim)ok++;else bad.push(p+' '+b.op+' → '+n.s+' '+JSON.stringify(n.j)+' ('+n.ops+')')}
 T(`حساب غير مفعّل: ${cases.length} عمليات صداقة وتحدٍّ وبلاغ ومزامنة كلها 403 «inactive» (الصداقة والتحدي بثلاث عمليات قراءة على الأكثر)`,ok===cases.length,bad.join(' | ')||ok+'/'+cases.length)}
{const f=await memfs.get('fr/u_kid1');T('لم يصل إلى الطفل أي طلب صداقة من الغريب',!f||!f.data.list||!f.data.list[STR],f?JSON.stringify(f.data.list):'لا وثيقة')}
{// الخادم المنشور للمقارنة، ثم تنظيف ما كتبه
 const oldR=[];for(const [p,b] of cases){const o=await call('old',STR,p,b);oldR.push(p+(b.op?':'+b.op:'')+'='+o.s)}
 const f=await memfs.get('fr/u_kid1');INFO('[الخادم المنشور] الحساب غير المفعّل نفسه',oldR.join(' · ')+' · طلب الغريب وصل إلى الطفل: '+(!!(f&&f.data.list&&f.data.list[STR])));
 await memfs.commit([{path:'fr/u_kid1',del:true},{path:'fr/'+STR,del:true}])}

// ===== 2) الأعضاء: الصداقة والتحدي كما كانا =====
{const a=await call('new','u_kid1','/fr',{op:'add',login:'kid2'});const l=await call('new','u_kid2','/fr',{op:'list'});
 T('عضو يضيف عضوًا باسم الدخول: «out» عنده و«in» عند الآخر',a.s===200&&a.j.s==='out'&&(l.j.items||[]).some(i=>i.uid==='u_kid1'&&i.s==='in'),a.s+' '+JSON.stringify(a.j));
 const c=await call('new','u_kid2','/fr',{op:'acc',uid:'u_kid1'});const l2=await call('new','u_kid1','/fr',{op:'list'});
 T('قبول الصداقة يعمل',c.s===200&&(l2.j.items||[]).some(i=>i.uid==='u_kid2'&&i.s==='f'),c.s);
 await call('new','u_kid1','/fr',{op:'tick',act:1});await call('new','u_kid2','/fr',{op:'tick',act:1});
 const d=await call('new','u_kid1','/duel',{op:'inv',to:['u_kid2']});T('دعوة تحدٍّ بين صديقين متصلين تعمل',d.s===200&&!!(d.j.id||d.j.ok),d.s+' '+JSON.stringify(d.j).slice(0,80));
 const s=await call('new','u_kid2','/duel',{op:'get',id:d.j.id});T('حالة التحدي عند المدعو تعمل',s.s===200,s.s+' '+JSON.stringify(s.j).slice(0,60));
 const n=await call('new','u_kid1','/fr',{op:'add',login:'102'});T('الإضافة برقم الحساب تعمل',n.s===200,n.s+' '+JSON.stringify(n.j))}
{const f=await call('new','u_kid1','/fr',{op:'add',login:'nosuchkid'});T('اسم دخول غير موجود: «nouser» كما كان',f.s===404&&f.j.error==='nouser',f.s)}
{// تخزين «مفعّل» مؤقتًا: الطلب المتكرر لا يعيد قراءة التفعيل
 const a=await call('new','u_kid1','/fr',{op:'list'}),b=await call('new','u_kid1','/fr',{op:'list'}),o=await call('old','u_kid1','/fr',{op:'list'});
 T('تكرار طلب الصداقة لا يضيف قراءات بعد أول فحص (تخزين 10 دقائق)',b.ops<=o.ops,`الفرع ${b.ops} · المنشور ${o.ops} قراءة/كتابة`)}
{const m=await call('new','admin1','/fr',{op:'list'},O,'admin@mufradati.app');T('المشرف ما زال ممنوعًا من الصداقة كما كان («admin»)',m.s===403&&m.j.error==='admin',m.s+' '+m.j.error)}

// ===== 3) تفاصيل الأخطاء الداخلية للمشرف وحده =====
{const g=memfs.get;memfs.get=async p=>{if(p==='users/u_kid1/data/core')throw new Error('fs get 503 users/u_kid1/data/core secret-path');return g(p)};
 const n=await call('new','u_kid1','/sync',{evs:[]}),o=await call('old','u_kid1','/sync',{evs:[]});memfs.get=g;
 T('خطأ داخلي عند طفل: 500 «server» دون أي تفاصيل تقنية',n.s===500&&n.j.error==='server'&&!('detail' in n.j),JSON.stringify(n.j));
 INFO('[الخادم المنشور] الخطأ نفسه',JSON.stringify(o.j).slice(0,120))}
{const l=memfs.list;memfs.list=async c=>{if(c==='stats')throw new Error('fs list 500 stats');return l(c)};
 const a=await call('new','admin1','/stats',{},O,'admin@mufradati.app');memfs.list=l;
 T('الخطأ نفسه عند المشرف: التفاصيل تبقى (رسائل أدوات النسخ تعتمد عليها)',a.s===500&&/fs list 500/.test(a.j.detail||''),JSON.stringify(a.j))}

// ===== 4) CORS =====
{const r=await call('new','u_kid1','/fr',{op:'list'},'http://localhost:8765');T('المصدر التجريبي localhost:8765 لم يعد مسموحًا',r.h.get('Access-Control-Allow-Origin')!=='http://localhost:8765',r.h.get('Access-Control-Allow-Origin'));
 const g=await call('new','u_kid1','/fr',{op:'list'});T('مصدر الموقع الحقيقي مسموح كما كان',g.h.get('Access-Control-Allow-Origin')===O)}
console.log(out.join('\n'));
