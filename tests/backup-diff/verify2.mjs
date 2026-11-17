// «تحقق كامل» نفسه: أيّ نسخة يقارن، وهل يقارن الوثائق، وهل تظهر فروق بلا أي نشاط. ثلاث نسخ مستقلة من الخادم (new وnew2 وnew3) تتشارك القاعدة والتخزين
import {T,out,user,post,ctl,DB,app,station,memfs,env,KV} from './it.mjs';import zlib from 'node:zlib';
const ROOT='projects/mufradati-406bd/databases/(default)/documents',sleep=ms=>new Promise(r=>setTimeout(r,ms));
const enc=v=>v===null||v===undefined?{nullValue:null}:typeof v==='string'?{stringValue:v}:typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?(Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v}):Array.isArray(v)?{arrayValue:{values:v.map(enc)}}:(v&&v.ms!==undefined&&Object.keys(v).length===1)?{timestampValue:new Date(v.ms).toISOString()}:{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,enc(x)]))}};
env.__export=async()=>{const arr=[...DB].map(([p,d])=>({document:{name:ROOT+'/'+p,fields:Object.fromEntries(Object.entries(d.data).map(([k,v])=>[k,enc(v)])),updateTime:d.ut},readTime:''}));return {parts:[JSON.stringify(arr)],n:arr.length,users:3}};
const at=(V,b)=>{ctl.ACTIVE=V;return post('/backup','admin',b)};
// إعدادات المشرف تختلف عن الافتراضية (جواهر وخبرة أعلى)
ctl.NOW=Date.parse('2026-11-13T15:00:00Z');ctl.ACTIVE='new';
await memfs.commit([{path:'config/app',data:{v:JSON.stringify({xp:{review:[2,3,6,6],stOk:5,stMiss:3,mem:20,solid:50,dayN:20,dayXp:15,quiz:2,level:80},gems:{station:3,level:8,quest:[0,5,0],puzzle:100,pdup:3,streak:[[7,10]],prize:[50,40,30]}})}}]);
const U=['ali','moh','acc3'];const A={};for(const u of U){await user(u);A[u]=app('new',u);await A[u].sync()}
for(let d=0;d<3;d++){for(const u of U)for(let s=0;s<(u==='ali'?4:2);s++)await station(A[u]);ctl.NOW+=864e5}
ctl.NOW=Date.parse('2026-11-16T20:40:00Z');for(const u of U)await A[u].sync();
const k1=(await at('new',{op:'now',rid:'clickVER00001'})).key;ctl.NOW+=60e3;
const k2=(await at('new',{op:'now',rid:'clickVER00002'})).key;ctl.NOW+=60e3;
const k3=(await at('new',{op:'now',rid:'clickVER00003'})).key;ctl.NOW+=5e3;
// ===== العملية القديمة verify1 (كانت «تحقق كامل» قبل backup-inspect): فحوصها تُثبت الخلل الذي استُبدلت لأجله =====
// خادم بارد (new3: لم يُجرِ أي مزامنة، مثل نسخة جديدة بعد النشر) وبلا أي نشاط
let v=await at('new3',{op:'verify1',key:k3});
T('[verify1] خادم بارد بلا نشاط: النتيجة مطابقة',Object.values(v.diff).every(d=>!d.length));
const cold=v.bak.ali;ctl.ACTIVE='new';const warm=(await post('/backup','admin',{op:'snap'})).accts.ali;
T('[خلل معروف في العملية القديمة verify1، ما زالت في الخادم ولا تستعملها الواجهة] خادم بارد لا يقرأ إعدادات المشرف: «من النسخة» يختلف عن «لقطة» الخادم الدافئ',cold.gems!==warm.gems||cold.xp!==warm.xp,'جواهر '+cold.gems+' مقابل '+warm.gems+' · خبرة '+cold.xp+' مقابل '+warm.xp+' · مستوى '+cold.lv+' مقابل '+warm.lv+' · محطات '+cold.stations+' مقابل '+warm.stations);
// تحقق في خادم بارد، وأثناءه طلب آخر (مساعد الوظيفة أو التحدي) يقرأ إعدادات المشرف
const g0=memfs.get.bind(memfs);memfs.get=async p=>{await sleep(3);return g0(p)};
ctl.ACTIVE='new2';const pv=post('/backup','admin',{op:'verify1',key:k3});await sleep(1);ctl.ACTIVE='new2';const pa=post('/ai','ali',{msgs:[{r:'u',t:'x'}]}).catch(()=>0);
v=await pv;await pa;memfs.get=g0;
const dd=Object.entries(v.diff).filter(([,d])=>d.length);
T('[خلل معروف في verify1] بلا أي نشاط، وطلب آخر أثناء التحقق: تظهر فروق وهمية (ولهذا استُبدلت بـverify)',dd.length>0,dd.map(([u,d])=>u+': '+d.join('، ')).join(' · ')+' · سامر: جواهر '+v.bak.ali.gems+'→'+v.live.ali.gems+' · خبرة '+v.bak.ali.xp+'→'+v.live.ali.xp);
// ===== «تحقق كامل» الجديد =====
for(const V of ['new3','new','new2']){v=await at(V,{op:'verify',key:k3});
  T(`[الجديد، خادم ${V}] بلا نشاط: «مطابقة»، والوثائق الأصلية مطابقة لكل حساب`,v.result==='match'&&Object.values(v.accts).every(a=>a.docSame&&!a.diff.length))}
T('[الجديد] الملخّص بإعدادات المشرف دائمًا (= لقطة الخادم الدافئ)',v.accts.ali.bak.gems===warm.gems&&v.accts.ali.bak.xp===warm.xp);
ctl.ACTIVE='new3';memfs.get=async p=>{await sleep(3);return g0(p)};const pv2=post('/backup','admin',{op:'verify',key:k3});await sleep(1);const pa2=post('/ai','ali',{msgs:[{r:'u',t:'x'}]}).catch(()=>0);v=await pv2;await pa2;memfs.get=g0;
T('[الجديد] طلب آخر أثناء التحقق: لا فروق',v.result==='match');
// 1) أيّ نسخة يقارن
for(const k of [k1,k2,k3]){v=await at('new',{op:'verify',key:k});const meta=(await at('new',{op:'list'})).items.find(x=>x.key===k);
  T('1) يقارن النسخة المختارة نفسها: '+k.slice(15),v.key===k&&v.at===meta.at,'وقت الإنشاء من الملف '+new Date(v.at).toISOString().slice(11,19)+' · وقت المقارنة '+new Date(v.cmpAt).toISOString().slice(11,19))}
// 3) و4) التصدير كامل وبأحدث القيم: وثائق سامر في النسخة = وثائقه في القاعدة بايتًا ببايت
const f=JSON.parse(zlib.gunzipSync(Buffer.from((await at('new',{op:'download',key:k3})).b64,'base64')).toString()).parts.flat();
const mine=f.filter(x=>x.document.name.includes('/ali'));const okAll=mine.every(x=>{const p=x.document.name.slice(ROOT.length+1),d=DB.get(p);return d&&JSON.stringify(Object.fromEntries(Object.entries(d.data).map(([k,v])=>[k,enc(v)])))===JSON.stringify(x.document.fields)});
T('3) كل وثائق سامر في الملف = القاعدة الآن (بلا نشاط بعد النسخة)',okAll,mine.map(x=>x.document.name.split('/documents/')[1]).join('، '));
// 5) نشاط بعد النسخة: «توجد فروقات»، والوثيقة المختلفة معروفة، وآخر كتابة لها بعد وقت النسخة
ctl.NOW+=600e3;await station(A.ali);v=await at('new',{op:'verify',key:k3});
T('5) نشاط بعد النسخة: «توجد فروقات» في سامر وحده، ووقت كتابة وثيقته الآن بعد النسخة',v.result==='diff'&&!v.accts.ali.docSame&&v.accts.moh.docSame&&Date.parse(v.accts.ali.coreUt.live)>v.at,'وثائق سامر: '+JSON.stringify(v.accts.ali.docs)+' · core '+v.accts.ali.coreUt.bak.slice(11,19)+'→'+v.accts.ali.coreUt.live.slice(11,19));
// حساب بلا وثيقة مستخدم (وثائقه موجودة تحت users/<id>/data): يظهر ولا يختفي من المقارنة
DB.set('users/ghost/data/core',DB.get('users/moh/data/core'));DB.set('names/ghost',{data:{name:'سامر'},ut:'x'});
const k4=(await at('new',{op:'now',rid:'clickVER00004'})).key;v=await at('new',{op:'verify',key:k4});
T('حساب بلا وثيقة مستخدم بالاسم نفسه: يظهر في المقارنة ومعلَّم',v.accts.ghost&&v.accts.ghost.userDoc===false,'الاسم '+(v.accts.ghost||{}).name);
console.log(out.join('\n'));
