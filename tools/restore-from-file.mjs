// استرجاع نسخة احتياطية منزَّلة (ملف .json.gz) إلى Firestore مباشرة، دون الحاجة إلى خادم مفرداتي.
// يلزم: Node 18+، وملف مفتاح حساب خدمة لمشروع Firebase (يبقى في جهازك فقط).
// الاستعمال:
//   node tools/restore-from-file.mjs النسخة.json.gz المفتاح.json            ← فحص فقط: يعدّ الوثائق ولا يكتب شيئًا
//   node tools/restore-from-file.mjs النسخة.json.gz المفتاح.json --write    ← استرجاع فعلي (يكتب كل وثائق النسخة فوق الحالية)
// ملاحظة: الحسابات نفسها (البريد وكلمة المرور) في Firebase Authentication وليست في النسخة؛ النسخة تحفظ بيانات الحسابات.
import fs from 'node:fs';import zlib from 'node:zlib';import crypto from 'node:crypto';
const [file,keyFile,flag]=process.argv.slice(2);
if(!file||!keyFile){console.log('الاستعمال: node tools/restore-from-file.mjs النسخة.json.gz المفتاح.json [--write]');process.exit(1)}
const j=JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'));
const docs=new Map();for(const part of j.parts||[])for(const x of part)if(x&&x.document)docs.set(x.document.name,x.document.fields||{});
const sa=JSON.parse(fs.readFileSync(keyFile,'utf8')),ROOT=`projects/${sa.project_id}/databases/(default)/documents`;
const bad=[...docs.keys()].filter(n=>!n.startsWith(ROOT+'/'));
const per={};for(const n of docs.keys()){const p=n.slice(ROOT.length+1).split('/');const c=p.length>2?p[0]+'/…/'+p[p.length-2]:p[0];per[c]=(per[c]||0)+1}
console.log('النسخة: '+new Date(j.at).toISOString()+' · '+docs.size+' وثيقة · '+JSON.stringify(per));
if(bad.length){console.log('✗ '+bad.length+' وثيقة لمشروع آخر غير '+sa.project_id+' — توقّف');process.exit(1)}
if(flag!=='--write'){console.log('✓ فحص فقط، لم يُكتب شيء. للاسترجاع الفعلي أضف --write');process.exit(0)}
const b64u=b=>Buffer.from(b).toString('base64url'),now=Math.floor(Date.now()/1000);
const h=b64u(JSON.stringify({alg:'RS256',typ:'JWT'})),p=b64u(JSON.stringify({iss:sa.client_email,scope:'https://www.googleapis.com/auth/datastore',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
const sig=crypto.createSign('RSA-SHA256').update(h+'.'+p).sign(sa.private_key);
const tr=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion='+h+'.'+p+'.'+b64u(sig)});
const tok=(await tr.json()).access_token;if(!tok){console.log('✗ تعذّر الدخول بالمفتاح');process.exit(1)}
const W=[...docs].map(([name,fields])=>({update:{name,fields}}));
for(let k=0;k<W.length;k+=400){const r=await fetch(`https://firestore.googleapis.com/v1/${ROOT}:commit`,{method:'POST',headers:{Authorization:'Bearer '+tok,'Content-Type':'application/json'},body:JSON.stringify({writes:W.slice(k,k+400)})});
  if(!r.ok){console.log('✗ توقّف عند '+k+': '+r.status+' '+(await r.text()).slice(0,200));process.exit(1)}console.log('… '+Math.min(k+400,W.length)+' / '+W.length)}
console.log('✓ استُرجعت '+W.length+' وثيقة');
