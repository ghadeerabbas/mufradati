// تشغيل حقيقي محلي: الخادم الجديد في محرّك Cloudflare نفسه (workerd عبر Miniflare) مع البوّابة بتخزين SQLite حقيقي ومنبّه حقيقي.
// كل اتصال خارجي يُعترَض: Firestore مزيّف في الذاكرة، ومفاتيح Google تجريبية. لا شبكة ولا حساب ولا موارد في Cloudflare.
import {createRequire} from 'node:module';import {webcrypto as wc} from 'node:crypto';import fs from 'node:fs';
const require=createRequire(process.argv[3]+'/node_modules/');const {Miniflare}=require('miniflare');
const W=process.argv[2];const out=[],T=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?' → '+x:''));
const b64u=b=>Buffer.from(b).toString('base64url');
const sa=await wc.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const pem='-----BEGIN PRIVATE KEY-----\n'+Buffer.from(await wc.subtle.exportKey('pkcs8',sa.privateKey)).toString('base64')+'\n-----END PRIVATE KEY-----\n';
const kp=await wc.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...(await wc.subtle.exportKey('jwk',kp.publicKey)),kid:'t1',alg:'RS256',use:'sig'};
async function token(uid,email){const n=Math.floor(Date.now()/1000),h=b64u(JSON.stringify({alg:'RS256',kid:'t1'})),p=b64u(JSON.stringify({aud:'mufradati-406bd',iss:'https://securetoken.google.com/mufradati-406bd',sub:uid,email,exp:n+3600,iat:n}));
  return h+'.'+p+'.'+b64u(await wc.subtle.sign('RSASSA-PKCS1-v1_5',kp.privateKey,new TextEncoder().encode(h+'.'+p)))}
// ---- Firestore مزيّف (REST) ----
const DOCS=new Map();let UT=0;const OPS=[];const ROOT='projects/mufradati-406bd/databases/(default)/documents/';
const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{'Content-Type':'application/json'}});
async function outbound(req){const u=new URL(req.url);
  if(u.hostname==='oauth2.googleapis.com')return J({access_token:'test-token',expires_in:3600});
  if(u.pathname.includes('securetoken@system.gserviceaccount.com'))return J({keys:[jwk]});
  if(u.hostname!=='firestore.googleapis.com')return new Response('blocked',{status:599});
  const pth=decodeURIComponent(u.pathname).split('/documents')[1]||'';
  if(pth===':commit'){const b=await req.json();const ws=b.writes;
    for(const w of ws){const name=(w.delete||w.update.name).slice(ROOT.length),d=DOCS.get(name),cd=w.currentDocument;
      if(cd&&cd.exists===false&&d)return J({error:{code:409,status:'ALREADY_EXISTS'}},409);
      if(cd&&cd.updateTime&&!d)return J({error:{code:404,status:'NOT_FOUND'}},404);
      if(cd&&cd.updateTime&&d.updateTime!==cd.updateTime)return J({error:{code:400,status:'FAILED_PRECONDITION',message:'FAILED_PRECONDITION'}},400)}
    const res=[];for(const w of ws){const name=(w.delete||w.update.name).slice(ROOT.length);OPS.push((w.delete?'del ':'write ')+name);
      if(w.delete){DOCS.delete(name);res.push({});continue}const ut=new Date(Date.now()+(++UT)).toISOString();DOCS.set(name,{name:ROOT+name,fields:w.update.fields,updateTime:ut});res.push({updateTime:ut})}
    return J({writeResults:res,commitTime:new Date().toISOString()})}
  const p=pth.replace(/^\//,'');
  if(req.method==='GET'&&p.split('/').length%2===0){OPS.push('get '+p);const d=DOCS.get(p);return d?J(d):J({error:{code:404}},404)}
  if(req.method==='GET'){OPS.push('list '+p);return J({documents:[...DOCS.values()].filter(d=>d.name.slice(ROOT.length).startsWith(p+'/')&&d.name.slice(ROOT.length).split('/').length===p.split('/').length+1)})}
  return new Response('unsupported',{status:501})}
const mf=new Miniflare({modules:true,scriptPath:W,compatibilityDate:'2025-01-01',durableObjects:{ERRGATE:{className:'ErrGate',useSQLite:true}},kvNamespaces:['BAK'],
  bindings:{SA:JSON.stringify({client_email:'test@test.iam.gserviceaccount.com',private_key:pem})},outboundService:outbound});
const O='https://ghadeerabbas.github.io';
const rep=async(uid,msg,origin=O)=>{const h={'Content-Type':'application/json'};if(origin)h.Origin=origin;if(uid)h.Authorization='Bearer '+await token(uid,uid+'@mufradati.app');
  return (await mf.dispatchFetch('https://api.test/err',{method:'POST',headers:h,body:JSON.stringify({msg,stack:'TypeError: x\n    at renderSafe (https://ghadeerabbas.github.io/mufradati/index.html?v=9ef4ef4607&k=secret:5175:23)',where:'#review',ua:'UA',ver:'web'})})).status};
const admin=async b=>{const r=await mf.dispatchFetch('https://api.test/errs',{method:'POST',headers:{'Content-Type':'application/json',Origin:O,Authorization:'Bearer '+await token('adm','admin@mufradati.app')},body:JSON.stringify(b)});return {s:r.status,j:await r.json()}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
  T('مصدر غير مسموح: 403',await rep(null,'x','https://evil.example')===403);
  const s1=await rep(null,'Error: smoke a@b.com'),s2=await rep('u1','Error: smoke a@b.com');
  T('بلاغان (مجهول ومسجّل) في المحرّك الحقيقي: 200 وصفر عملية في Firestore',s1===200&&s2===200&&!OPS.some(o=>o.startsWith('write')),OPS.join(',')||'0');
  await sleep(63000);const docs=[...DOCS.entries()].filter(([k])=>k.startsWith('errs/'));
  const f=docs[0]&&docs[0][1].fields;
  T('بعد منبّه حقيقي (60 ثانية): وثيقة واحدة n=2 كتبتها البوّابة عبر REST',docs.length===1&&f.n.integerValue==='2',docs.length+' · '+(f&&f.n&&f.n.integerValue));
  T('التنقية في المحرّك الحقيقي: البريد والمعامل السري أُزيلا، والدالة والسطر بقيا',f&&/\[بريد\]/.test(f.msg.stringValue)&&!/secret/.test(f.stack.stringValue)&&/renderSafe .*index\.html\?v=9ef4ef4607:5175:23/.test(f.stack.stringValue),f&&f.msg.stringValue+' | '+(f&&f.stack.stringValue.split('\n')[1]));
  const l=await admin({});T('صفحة الأخطاء تقرأها كما كانت',l.s===200&&l.j.items.length===1&&l.j.items[0].n===2,l.s+' '+(l.j.items||[]).length);
  const id=docs[0][0].slice(5);await rep('u2','Error: smoke a@b.com');const d=await admin({del:id});
  T('حذف المشرف عبر البوّابة الحقيقية: 200 والوثيقة محذوفة',d.s===200&&!DOCS.has('errs/'+id),d.s);
  await sleep(63000);const nd=DOCS.get('errs/'+id);
  T('بعد المنبّه: البلاغ الذي لم يره المشرف لا يضيع (n=1)، والقديم لا يعود',nd&&nd.fields.n.integerValue==='1',nd?nd.fields.n.integerValue:'لا وثيقة');
  T('لا قراءة من Firestore في مسار البلاغات',!OPS.some(o=>o.startsWith('get ')),OPS.filter(o=>o.startsWith('get')).join(','));
}catch(e){T('تشغيل المحرّك',false,String(e&&e.stack||e).slice(0,300))}
finally{await mf.dispose()}
console.log(out.join('\n'));
