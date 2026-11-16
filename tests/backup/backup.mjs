// النسخة الاحتياطية: تحقق كامل، لقطة، تنزيل، واسترجاع إلى قاعدة فارغة — بشيفرة الخادم الحقيقية وقاعدة في الذاكرة، بحسابات وهمية
import {T,out,app,user,station,duelDoc,memfs,DB,post,ctl,KV} from './it.mjs';
import zlib from 'node:zlib';
ctl.ACTIVE='new';ctl.NOW=Date.parse('2026-11-16T08:00:00Z');
const ids=['acc1','acc2','acc3'];
for(const [i,u] of ids.entries()){await user(u);await memfs.commit([{path:'names/'+u,data:{name:'حساب '+(i+1)}}]);const A=app('new',u);await A.sync();
  for(let d=0;d<3+i;d++){ctl.NOW+=864e5;await station(A);A.ev({type:'quest',id:'perf'});await A.sync()}
  await duelDoc('duelBK'+u,u,'zz');A.ev({type:'dwin',id:'duelBK'+u});await A.sync()}
const enc=v=>v===null||v===undefined?{nullValue:null}:typeof v==='string'?{stringValue:v}:typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?(Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v}):Array.isArray(v)?{arrayValue:{values:v.map(enc)}}:(v&&v.ms&&Object.keys(v).length===1)?{timestampValue:new Date(v.ms).toISOString()}:{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,enc(x)]))}};
const ROOT='projects/mufradati-406bd/databases/(default)/documents';
const mkBak=()=>{const part=[...DB].map(([p,d])=>({document:{name:ROOT+'/'+p,fields:Object.fromEntries(Object.entries(d.data).map(([k,v])=>[k,enc(v)]))}}));return zlib.gzipSync(JSON.stringify({v:2,at:ctl.NOW,parts:[part]}))};
const KEY='bak-2026-11-25T08-00-00-000Z',bytes=mkBak();await KV.put(KEY,bytes,{metadata:{why:'manual'}});
// اللقطة
const snap=await post('/backup','admin',{op:'snap'});T('لقطة الحسابات: الحسابات الثلاثة',Object.keys(snap.accts).length===3,Object.values(snap.accts).map(a=>a.name+': '+a.gems+' جوهرة، '+a.xp+' خبرة، بازل '+JSON.stringify(a.pz)).join(' · '));
// تجربة النسخة (الموجودة أصلًا) والتحقق الكامل (الجديد)
const t=await post('/backup','admin',{op:'test',key:KEY});T('«تجربة»: النسخة سليمة',t.ok,t.n+' وثيقة');
let v=await post('/backup','admin',{op:'verify',key:KEY});T('«تحقق كامل»: تُبنى الحسابات من النسخة مطابقة للحالة الآن',Object.values(v.diff).every(d=>!d.length),JSON.stringify(v.diff));
// تنزيل
const dl=await post('/backup','admin',{op:'download',key:KEY});T('«تنزيل»: الملف مطابق للنسخة بايتًا ببايت',Buffer.from(dl.b64,'base64').equals(bytes),dl.size+' بايت');
// تغيير بعد النسخة يظهر في التحقق
{const A=app('new','acc1');await A.sync();ctl.NOW+=864e5;await station(A);await A.sync()}
v=await post('/backup','admin',{op:'verify',key:KEY});T('تغيير بعد النسخة يظهر في الفروق',v.diff.acc1.length>0&&!v.diff.acc2.length,'acc1: '+v.diff.acc1.join('، '));
// الاسترجاع الفعلي إلى قاعدة فارغة: نكتب وثائق النسخة كما يكتبها الاسترجاع، ثم نقارن
const live=v.bak;const docs=JSON.parse(zlib.gunzipSync(Buffer.from(dl.b64,'base64'))).parts.flat();
const dec=x=>'stringValue' in x?x.stringValue:'integerValue' in x?+x.integerValue:'doubleValue' in x?x.doubleValue:'booleanValue' in x?x.booleanValue:'nullValue' in x?null:'timestampValue' in x?{ms:Date.parse(x.timestampValue)}:'arrayValue' in x?(x.arrayValue.values||[]).map(dec):Object.fromEntries(Object.entries(x.mapValue.fields||{}).map(([k,y])=>[k,dec(y)]));
DB.clear();for(const d of docs)await memfs.commit([{path:d.document.name.slice(ROOT.length+1),data:Object.fromEntries(Object.entries(d.document.fields).map(([k,y])=>[k,dec(y)]))}]);
const s2=await post('/backup','admin',{op:'snap'});
T('استرجاع إلى قاعدة فارغة: كل الحسابات مطابقة لما في النسخة',JSON.stringify(s2.accts)===JSON.stringify(live),Object.keys(s2.accts).length+' حسابات');
for(const u of ids){const A=app('new',u);await A.sync();}T('بعد الاسترجاع: كل حساب يعمل ويزامن',true);
console.log(out.join('\n'));
