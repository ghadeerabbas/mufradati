// فحص ملفات نسخ منزَّلة (.json.gz) دون أي اتصال: ملخّص كل حساب بشيفرة الخادم نفسها، ووقت آخر كتابة لوثيقته، وأوقات محطاته.
// مع ملفين: لكل حساب، ما زاد في الثاني، ومتى حدث (قبل وقت النسخة الأولى أم بعده). لا يكتب شيئًا في أي مكان.
import {post,ctl,DB} from './it.mjs';import zlib from 'node:zlib';import fs from 'node:fs';
const ROOT='projects/mufradati-406bd/databases/(default)/documents';
const dec=x=>'stringValue' in x?x.stringValue:'integerValue' in x?+x.integerValue:'doubleValue' in x?x.doubleValue:'booleanValue' in x?x.booleanValue:'nullValue' in x?null:'timestampValue' in x?{ms:Date.parse(x.timestampValue)}:'arrayValue' in x?(x.arrayValue.values||[]).map(dec):'mapValue' in x?Object.fromEntries(Object.entries(x.mapValue.fields||{}).map(([k,y])=>[k,dec(y)])):null;
const files=process.argv.slice(4);const iso=t=>new Date(t).toISOString().replace('T',' ').slice(0,19)+' UTC';
const R=[];
for(const f of files){const j=JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString('utf8')),docs=j.parts.flat().filter(x=>x&&x.document);
  ctl.NOW=j.at;DB.clear();for(const x of docs)DB.set(x.document.name.slice(ROOT.length+1),{data:Object.fromEntries(Object.entries(x.document.fields||{}).map(([k,v])=>[k,dec(v)])),ut:x.document.updateTime});
  const snap=await post('/backup','admin',{op:'snap'}),acc={};
  for(const x of docs){const m=x.document.name.match(/\/users\/([^/]+)\/data\/core$/);if(!m)continue;const c=JSON.parse(dec(x.document.fields.v));
    acc[m[1]]={...snap.accts[m[1]],coreWritten:x.document.updateTime,st:(c.STN||[]).map(s=>s[0])}}
  R.push({f,at:j.at,acc});
  console.log('\n=== '+f+' · وقت النسخة '+iso(j.at)+' · '+docs.length+' وثيقة');
  for(const [u,a] of Object.entries(acc))console.log(`${a.name} (${u}): جواهر ${a.gems} · خبرة ${a.xp} · مستوى ${a.lv} · محطات ${a.stations} · كلمات ${a.words} · مراجعات ${a.reviews} · آخر محطة ${a.st.length?iso(a.st[a.st.length-1]):'-'} · آخر كتابة للوثيقة ${a.coreWritten}`)}
if(R.length===2){const [A,B]=R;console.log('\n=== الفرق بين النسختين');
  for(const u of Object.keys(B.acc)){const a=A.acc[u],b=B.acc[u];if(!a){console.log(u+': غير موجود في الأولى');continue}
    const ex=b.st.filter(t=>!a.st.includes(t));if(!ex.length&&a.gems===b.gems&&a.xp===b.xp){console.log(b.name+': لا فرق');continue}
    console.log(`${b.name}: جواهر ${a.gems}→${b.gems} · خبرة ${a.xp}→${b.xp} · محطات ${a.stations}→${b.stations} · محطات جديدة ${ex.length}: قبل وقت النسخة الأولى ${ex.filter(t=>t<A.at).length}، وبعده ${ex.filter(t=>t>=A.at).length} · كُتبت وثيقته في الخادم ${b.coreWritten}`)}}
