// «تحقق كامل» بقاعدة Firestore مزيّفة عبر REST: makeFS الحقيقية (لا memfs)، مع عدّ الطلبات الفرعية لكل استدعاء كما تعدّها Cloudflare.
// الاستعمال: node vb.mjs <worker_old.mjs> <worker_new.mjs>. بيانات اصطناعية فقط، ولا شبكة.
import {webcrypto as wc} from 'node:crypto';import zlib from 'node:zlib';import {pathToFileURL} from 'node:url';import path from 'node:path';
const [OLDF,NEWF]=process.argv.slice(2);const out=[];const T=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?' → '+x:''));const INFO=(n,x)=>out.push('INFO '+n+(x!==undefined?' → '+x:''));
const ROOT='projects/mufradati-406bd/databases/(default)/documents',BASE='https://firestore.googleapis.com/v1/'+ROOT;
// ---- مفاتيح تجريبية ----
const kp=await wc.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...(await wc.subtle.exportKey('jwk',kp.publicKey)),kid:'t',alg:'RS256',use:'sig'};
const pk8=Buffer.from(await wc.subtle.exportKey('pkcs8',kp.privateKey)).toString('base64');
const SA=JSON.stringify({client_email:'sa@test',private_key:'-----BEGIN PRIVATE KEY-----\n'+pk8+'\n-----END PRIVATE KEY-----\n'});
const b64u=b=>Buffer.from(b).toString('base64url');
async function token(){const n=Math.floor(Date.now()/1000),h=b64u(JSON.stringify({alg:'RS256',kid:'t'})),p=b64u(JSON.stringify({aud:'mufradati-406bd',iss:'https://securetoken.google.com/mufradati-406bd',sub:'adminuid',email:'admin@mufradati.app',exp:n+3600,iat:n}));
  return h+'.'+p+'.'+b64u(await wc.subtle.sign('RSASSA-PKCS1-v1_5',kp.privateKey,new TextEncoder().encode(h+'.'+p)))}
// ---- ترميز Firestore ----
const enc=v=>v===null||v===undefined?{nullValue:null}:typeof v==='string'?{stringValue:v}:typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?(Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v}):Array.isArray(v)?{arrayValue:{values:v.map(enc)}}:{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,enc(x)]))}};
const F=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,enc(v)]));
// ---- القاعدة المزيّفة ----
let DB=new Map(),UT=0,CALLS=0,FAULT=null;
const put=(p,o)=>DB.set(p,{fields:F(o),updateTime:'2026-11-18T10:00:'+String(++UT%60).padStart(2,'0')+'.'+String(UT).padStart(6,'0')+'Z'});
const docJ=(p,d)=>({name:ROOT+'/'+p,fields:d.fields,updateTime:d.updateTime});
globalThis.fetch=async(u,o={})=>{u=String(u);CALLS++;
  if(u.includes('securetoken@system.gserviceaccount.com'))return new Response(JSON.stringify({keys:[jwk]}));
  if(u==='https://oauth2.googleapis.com/token')return new Response(JSON.stringify({access_token:'tok'}));
  if(!u.startsWith(BASE))throw new Error('شبكة غير مسموحة: '+u);
  const rest=u.slice(BASE.length);
  if(rest===':batchGet'){if(FAULT==='batch500')return new Response('x',{status:500});
    const ds=JSON.parse(o.body).documents;let arr=ds.map(n=>{const p=n.slice(ROOT.length+1),d=DB.get(p);return d?{found:docJ(p,d)}:{missing:n}});
    if(FAULT==='batchPartial')arr=arr.slice(0,-1);return new Response(JSON.stringify(arr))}
  if(rest===':runQuery'){if(FAULT==='group500')return new Response('x',{status:500});
    const q=JSON.parse(o.body).structuredQuery.from[0];const res=[];
    for(const [p,d] of DB){const s=p.split('/');if(q.allDescendants?s.length>=4&&s.length%2===0&&s[s.length-2]===q.collectionId:s.length===2&&s[0]===q.collectionId)res.push({document:docJ(p,d)})}
    if(FAULT==='groupErr')res.push({error:{code:13,message:'internal'}});return new Response(JSON.stringify(res))}
  const [pp,qs]=rest.slice(1).split('?');const s=pp.split('/');
  if(s.length%2===1){   // قائمة مجموعة
    if(FAULT==='list500')return new Response('x',{status:500});
    const docs=[...DB].filter(([p])=>{const x=p.split('/');return x.length===s.length+1&&p.startsWith(pp+'/')}).map(([p,d])=>docJ(p,d));return new Response(JSON.stringify({documents:docs}))}
  if(FAULT==='get500')return new Response('x',{status:500});
  const d=DB.get(pp);return d?new Response(JSON.stringify(docJ(pp,d))):new Response('{}',{status:404})};
// ---- حسابات اصطناعية ----
function seed(n){DB=new Map();put('config/app',{v:'{}'});
  for(let i=0;i<n;i++){const u='acct'+String(i).padStart(4,'0'),T0=Date.parse('2026-11-01T10:00:00Z');
    put('users/'+u,{name:'حساب '+i});put('names/'+u,{name:'حساب '+i});put('members/'+u,{no:i+1});
    const P={},F=[];for(let w=0;w<5+i%7;w++){P['w'+w]={box:1+w%5,due:T0+w*864e5,t:T0};F.push(w?60:Math.round(T0/1000),w,2,1)}
    put(`users/${u}/data/core`,{v:JSON.stringify({P,QLOG:[[T0,3,5,'drill',9000]],BUY:[],R:{bank:0,ach:[],lv:1,ts:0},LG:{tier:0,w:'',hist:[],ts:0},EN:{v:30,t:0},STN:[[T0,5,1]],STV:0,ver:1,lf:1})});
    put(`users/${u}/data/log`,{v:JSON.stringify({K:Object.keys(P),F})});put(`users/${u}/data/qa`,{v:JSON.stringify({K:[],F:[]})});
    if(i%3===0)put(`gifts/${u}/g/gift${i}`,{g:5+i,note:'هدية',ts:T0});}
  put('aichat/acct0000/m/x1',{q:'?'});}   // مجموعة أخرى اسمها ليس g
const snapshot=()=>{const docs=[...DB].map(([p,d])=>({document:docJ(p,d),readTime:'x'}));return zlib.gzipSync(JSON.stringify({v:2,at:Date.now(),parts:[docs]}))};
const KVM=new Map(),KV={async get(k,t){const v=KVM.get(k);if(!v)return null;return t==='arrayBuffer'?v.buffer.slice(v.byteOffset,v.byteOffset+v.byteLength):v},async put(k,v){KVM.set(k,v)},async list(){return {keys:[...KVM.keys()].map(name=>({name}))}},async delete(k){KVM.delete(k)}};
let mods=0;const load=async f=>(await import(pathToFileURL(path.resolve(f)).href+'?i='+(++mods))).default;   // نسخة جديدة من الوحدة = عزلة جديدة (لا ذاكرة مؤقتة للمفاتيح والإعدادات)
async function verify(f,key){const W=await load(f);CALLS=0;
  const r=await W.fetch(new Request('https://api.test/backup',{method:'POST',headers:{Authorization:'Bearer '+await token(),'Content-Type':'application/json',Origin:'https://ghadeerabbas.github.io'},body:JSON.stringify({op:'verify',key})}),{SA,BAK:KV},{waitUntil(){}});
  const j=await r.json().catch(()=>({}));return {status:r.status,j,calls:CALLS}}
const strip=j=>{const x=JSON.parse(JSON.stringify(j));delete x.cmpAt;return JSON.stringify(x)};
const mk=n=>{seed(n);const key='bak-2026-11-18T10-00-00-000Z-'+n;KVM.set(key,snapshot());return key};

// 1) 7 حسابات مطابقة: قبل الإصلاح وبعده
{const key=mk(7);const a=await verify(OLDF,key),b=await verify(NEWF,key);
 T('7 حسابات: الأداة الجديدة «مطابقة»',b.status===200&&b.j.result==='match',b.status+' '+(b.j.result||JSON.stringify(b.j).slice(0,120)));
 T('7 حسابات: النتيجة التفصيلية نفسها في الأداة القديمة والجديدة (كل الحسابات والوثائق والملخّصات)',strip(a.j)===strip(b.j));
 T('7 حسابات: الطلبات الفرعية بعد الإصلاح أقل من 10 (حدّ Cloudflare المجاني 50)',b.calls<10,'قبل '+a.calls+' · بعد '+b.calls);
 T('7 حسابات: الأداة القديمة كانت تتجاوز 50 (سبب الخطأ في الإنتاج)',a.calls>50,a.calls)}
// 2) أعداد أكبر
for(const n of [50,300]){const key=mk(n);const b=await verify(NEWF,key);const a=n===50?await verify(OLDF,key):null;
 T(`${n} حسابًا: «مطابقة» وطلبات أقل من 50`,b.j.result==='match'&&b.calls<50,'بعد '+b.calls+(a?' · قبل '+a.calls:''));
 if(a)T(`${n} حسابًا: النتيجة نفسها في الأداتين`,strip(a.j)===strip(b.j))}
INFO('السعة: خمسة طلبات ثابتة (مفاتيح الدخول، والرمز، وقائمة المستخدمين، والهدايا، والإعدادات) + ⌈7×الحسابات/100⌉ لقراءة الوثائق، فيبقى العدد تحت 50 حتى نحو 600 حساب');
// 3) فروق حقيقية يجب أن تظهر «توجد فروقات» في الأداتين معًا وبالتفاصيل نفسها
const diffCase=async(n,ch)=>{const key=mk(7);ch();const a=await verify(OLDF,key),b=await verify(NEWF,key);
  T(n+': «توجد فروقات» وليست «مطابقة»',b.status===200&&b.j.result==='diff',b.j.result);T(n+': التفاصيل نفسها في الأداتين',strip(a.j)===strip(b.j),JSON.stringify(b.j.diff&&Object.entries(b.j.diff).filter(([,v])=>v.length)).slice(0,160))};
await diffCase('وثيقة core ناقصة الآن',()=>DB.delete('users/acct0003/data/core'));
await diffCase('وثيقة log ناقصة الآن',()=>DB.delete('users/acct0002/data/log'));
await diffCase('اختلاف التقدّم (صندوق كلمة)',()=>{const d=DB.get('users/acct0001/data/core'),c=JSON.parse(d.fields.v.stringValue);c.P.w0.box=7;put('users/acct0001/data/core',{v:JSON.stringify(c)})});
await diffCase('اختلاف الرصيد (هدية جديدة الآن)',()=>put('gifts/acct0004/g/newgift',{g:50,note:'هدية',ts:1}));
await diffCase('هدية حُذفت الآن',()=>DB.delete('gifts/acct0000/g/gift0'));
await diffCase('اختلاف الرصيد (شراء)',()=>{const d=DB.get('users/acct0005/data/core'),c=JSON.parse(d.fields.v.stringValue);c.BUY.push({id:'b1',item:'namecolor:red',p:75,ts:1});put('users/acct0005/data/core',{v:JSON.stringify(c)})});
await diffCase('حساب جديد الآن ليس في النسخة',()=>{put('users/newacct',{name:'جديد'});put('users/newacct/data/core',{v:'{}'})});
await diffCase('وثيقة ck موجودة الآن وليست في النسخة',()=>put('users/acct0006/data/ck',{v:'{"v":1,"t":1}'}));
// وثيقة ناقصة في النسخة نفسها
{seed(7);DB.delete('users/acct0002/data/qa');const key='bak-2026-11-18T10-00-00-000Z-9999';KVM.set(key,snapshot());seed(7);const a=await verify(OLDF,key),b=await verify(NEWF,key);
 T('وثيقة ناقصة في النسخة: «توجد فروقات» والتفاصيل نفسها',b.j.result==='diff'&&strip(a.j)===strip(b.j),a.j.result+' / '+b.j.result+' '+JSON.stringify(b.j.diff).slice(0,200))}
// 4) قراءات ناقصة أو فاشلة: لا «مطابقة» أبدًا
for(const f of ['batchPartial','batch500','groupErr','group500','list500']){const key=mk(7);FAULT=f;const b=await verify(NEWF,key);FAULT=null;
 T(`خطأ في القراءة (${f}): لا «مطابقة»`,b.j.result!=='match',b.status+' '+JSON.stringify(b.j).slice(0,100))}
console.log(out.join('\n'));
