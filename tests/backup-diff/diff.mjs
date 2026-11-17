import {T,out,user,post,ctl,KV,env,DB,app,station,adv} from './it.mjs';
import zlib from 'node:zlib';
const ROOT='projects/mufradati-406bd/databases/(default)/documents';
const enc=v=>v===null||v===undefined?{nullValue:null}:typeof v==='string'?{stringValue:v}:typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?(Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v}):Array.isArray(v)?{arrayValue:{values:v.map(enc)}}:(v&&v.ms!==undefined&&Object.keys(v).length===1)?{timestampValue:new Date(v.ms).toISOString()}:{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,enc(x)]))}};
const dec=x=>'stringValue' in x?x.stringValue:'integerValue' in x?+x.integerValue:'doubleValue' in x?x.doubleValue:'booleanValue' in x?x.booleanValue:'nullValue' in x?null:'timestampValue' in x?{ms:Date.parse(x.timestampValue)}:'arrayValue' in x?(x.arrayValue.values||[]).map(dec):'mapValue' in x?Object.fromEntries(Object.entries(x.mapValue.fields||{}).map(([k,y])=>[k,dec(y)])):null;
// تصدير مثل exportAll: ردود runQuery كما هي، ومعها وقت آخر كتابة لكل وثيقة (updateTime)
env.__export=async()=>{const arr=[...DB].map(([p,d])=>({document:{name:ROOT+'/'+p,fields:Object.fromEntries(Object.entries(d.data).map(([k,v])=>[k,enc(v)])),updateTime:d.ut},readTime:new Date(Date.now()).toISOString()}));
  return {parts:[JSON.stringify(arr)],n:arr.length,users:[...DB.keys()].filter(p=>/^users\/[^/]+$/.test(p)).length}};
// أداة الفحص: تفكّ ملف النسخة، وتحسب ملخّص كل حساب بشيفرة الخادم نفسها («لقطة» على قاعدة فيها وثائق النسخة فقط)، وتُظهر أوقات وثائق كل حساب
async function inspect(bytes){const j=JSON.parse(zlib.gunzipSync(bytes).toString('utf8')),docs=j.parts.flat().filter(x=>x&&x.document);
  const save=new Map(DB);DB.clear();for(const x of docs)DB.set(x.document.name.slice(ROOT.length+1),{data:Object.fromEntries(Object.entries(x.document.fields||{}).map(([k,v])=>[k,dec(v)])),ut:x.document.updateTime});
  const snap=await post('/backup','admin',{op:'snap'});DB.clear();for(const [k,v] of save)DB.set(k,v);
  const acc={};for(const x of docs){const m=x.document.name.match(/\/users\/([^/]+)\/data\/core$/);if(!m)continue;const c=JSON.parse(dec(x.document.fields.v));
    acc[m[1]]={coreWritten:x.document.updateTime,lastStation:c.STN&&c.STN.length?new Date(c.STN[c.STN.length-1][0]).toISOString():'',stationTimes:(c.STN||[]).map(s=>s[0]),...snap.accts[m[1]]}}
  return {at:j.at,acc}}
const liveInfo=uid=>{const d=DB.get(`users/${uid}/data/core`),c=JSON.parse(d.data.v);return {coreWritten:d.ut,stationTimes:c.STN.map(s=>s[0])}};
const iso=t=>new Date(t).toISOString().slice(11,19);
// ===== الحسابات: سامر ومحمد وحساب ثالث، نشاط عادي متزامن لثلاثة أيام =====
ctl.NOW=Date.parse('2026-11-13T15:00:00Z');ctl.ACTIVE='new';
const U={ali:'سامر',moh:'رامي',acc3:'باسل'};const A={};
for(const [u,n] of Object.entries(U)){await user(u);A[u]=app('new',u);await A[u].sync()}
for(let d=0;d<3;d++){for(const u of Object.keys(U)){for(let s=0;s<2+(u==='ali'?2:0);s++)await station(A[u])}ctl.NOW+=864e5}
// ===== اليوم: سامر يدرس 4 محطات الساعة 18:00 وهاتفه بلا اتصال (أو التطبيق في الخلفية)، فتبقى الأحداث في الهاتف =====
ctl.NOW=Date.parse('2026-11-16T18:00:00Z');for(let s=0;s<4;s++)await station(A.ali,{syncEach:false});
const pending=A.ali.q;
// ===== 20:46:41 النسخة اليدوية =====
ctl.NOW=Date.parse('2026-11-16T20:46:41Z');const bk=await post('/backup','admin',{op:'now',rid:'clickDIAG0001'});
T('1) النسخة المفحوصة هي نسخة 20:46:41 نفسها (وقتها من داخل الملف، لا من القائمة)',new Date(bk.at).toISOString()==='2026-11-16T20:46:41.000Z',bk.key);
let v=await post('/backup','admin',{op:'verify',key:bk.key});
T('مباشرة بعد النسخ: «تحقق كامل» مطابق لكل الحسابات (النسخة تحفظ أحدث ما وصل إلى الخادم)',Object.values(v.diff).every(d=>!d.length),'سامر في هاتفه '+pending+' أحداث لم تصل بعد');
// ===== 23:30 سامر نائم؛ هاتفه يتصل فيُرسل التطبيق الأحداث المعلّقة =====
ctl.NOW=Date.parse('2026-11-16T23:30:00Z');await A.ali.sync();
v=await post('/backup','admin',{op:'verify',key:bk.key});
T('بعد المزامنة المتأخرة: الفروق في حساب سامر وحده',v.diff.ali.length>0&&!v.diff.moh.length&&!v.diff.acc3.length,'سامر: '+v.diff.ali.join('، '));
const b=v.bak.ali,l=v.live.ali;
T('الأرقام: النسخة أقل من الآن في الجواهر والخبرة والمحطات (الشكل نفسه الذي رأيته)',b.gems<l.gems&&b.xp<l.xp&&b.stations<l.stations,`جواهر ${b.gems}→${l.gems} · خبرة ${b.xp}→${l.xp} · مستوى ${b.lv}→${l.lv} · محطات ${b.stations}→${l.stations} · كلمات ${b.words}→${l.words}`);
// ===== 3) متى حدثت الفروق؟ الأدلة من الملف نفسه =====
const raw=Buffer.from((await post('/backup','admin',{op:'download',key:bk.key})).b64,'base64');const I=await inspect(raw);
const li=liveInfo('ali'),extra=li.stationTimes.filter(t=>!I.acc.ali.stationTimes.includes(t));
T('3) المحطات الزائدة الآن حدثت قبل وقت النسخة، لكن وثيقة سامر في الخادم كُتبت بعدها',extra.length===l.stations-b.stations&&extra.length>0&&extra.every(t=>t<I.at)&&Date.parse(li.coreWritten)>I.at,
  'أوقات المحطات الزائدة '+extra.map(iso).join(' ')+' · وقت النسخة '+iso(I.at)+' · آخر كتابة لوثيقة سامر في النسخة '+I.acc.ali.coreWritten.slice(11,19)+' والآن '+li.coreWritten.slice(11,19));
T('4) النسخة تحفظ أحدث ما في الخادم وقتها: آخر كتابة لكل حساب في النسخة قبل وقت النسخة، ولا شيء أحدث منها كان في الخادم',Object.values(I.acc).every(a=>Date.parse(a.coreWritten)<=I.at));
// ===== 2) الربط بين الحسابات والأعمدة =====
const rev=JSON.parse(zlib.gunzipSync(raw).toString('utf8'));rev.parts=[rev.parts.flat().reverse()];const I2=await inspect(zlib.gzipSync(JSON.stringify(rev)));
T('2) ترتيب الوثائق في النسخة لا يغيّر ملخّص أي حساب (لا تسرّب بين الحسابات)',Object.keys(U).every(u=>JSON.stringify({...I.acc[u],stationTimes:0})===JSON.stringify({...I2.acc[u],stationTimes:0})));
T('2) كل عمود باسم صاحبه، وملخّص النسخة لكل حساب = ملخّص أداة الفحص المستقلة',Object.keys(U).every(u=>v.bak[u].name===u&&v.bak[u].gems===I.acc[u].gems&&v.bak[u].stations===I.acc[u].stations));
// ===== 5) لا تغيّر بلا أحداث: نسخة ثانية الآن وتحقق =====
ctl.NOW+=60e3;const bk2=await post('/backup','admin',{op:'now',rid:'clickDIAG0002'});v=await post('/backup','admin',{op:'verify',key:bk2.key});
T('5) بلا أحداث جديدة: نسخة جديدة مطابقة تمامًا للحالة الآن',Object.values(v.diff).every(d=>!d.length));
ctl.NOW+=3*3600e3;v=await post('/backup','admin',{op:'verify',key:bk2.key});
T('5) مرور الوقت وحده (3 ساعات بلا نشاط): لا فرق',Object.values(v.diff).every(d=>!d.length),JSON.stringify(v.diff));
ctl.NOW=Date.parse('2026-11-17T00:10:00Z');v=await post('/backup','admin',{op:'verify',key:bk2.key});
T('5) تجاوز منتصف الليل (UTC): لا فرق في الجواهر والخبرة والمحطات',['gems','xp','lv','stations','words'].every(k=>v.bak.ali[k]===v.live.ali[k]),v.diff.ali.join('، ')||'لا فرق');
if(process.env.DUMP){const fs=await import('node:fs');fs.writeFileSync(process.env.DUMP+'/a.json.gz',raw);fs.writeFileSync(process.env.DUMP+'/b.json.gz',Buffer.from((await post('/backup','admin',{op:'download',key:bk2.key})).b64,'base64'))}
console.log(out.join('\n'));
