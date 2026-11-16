// «نسخة الآن» لا تتكرّر + سياسة الاحتفاظ الجديدة. SRV.new وnew2 وnew3: ثلاث نسخ مستقلة من الخادم الجديد (مثل نسخ Cloudflare المختلفة) تتشارك القاعدة والتخزين
import {T,out,user,post,ctl,KV,env,DB,SRV} from './it.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let EXP=0,FAILX=0,DELAY=30;env.__export=async()=>{EXP++;ctl.NOW+=1000;await sleep(DELAY);if(FAILX){FAILX--;throw new Error('export failed')}
  return {parts:['{"document":{"name":"projects/mufradati-406bd/databases/(default)/documents/users/acc1","fields":{}}}'],n:1,users:1}};
const baks=()=>[...KV.m.keys()].filter(k=>k.startsWith('bak-')).sort();
const meta=k=>KV.m.get(k).o.metadata||{};
const snapKV=keys=>JSON.stringify(keys.map(k=>[k,Buffer.from(KV.m.get(k).v).toString('base64'),KV.m.get(k).o]));
const at=(V,p,b)=>{ctl.ACTIVE=V;return post(p,'admin',b)};
const legacy=()=>{for(let i=1;i<=14;i++){const d=String(i).padStart(2,'0');KV.m.set(`bak-2026-11-${d}T02-17-00-000Z`,{v:new Uint8Array([i,1,2]),o:{metadata:{at:Date.parse(`2026-11-${d}T02:17:00Z`),n:9,users:3,size:3,why:'auto'}}})}
  for(let i=0;i<4;i++)KV.m.set(`bak-2026-11-16T08-1${7+i}-0${i}-000Z`,{v:new Uint8Array([9,i]),o:{metadata:{at:Date.parse('2026-11-16T08:17:00Z')+i*1000,n:9,users:3,size:2,why:'manual'}}});
  KV.m.set('bak-2026-11-10T10-00-00-000Z',{v:new Uint8Array([7]),o:{metadata:{at:1,why:'before-restore'}}})};
ctl.NOW=Date.parse('2026-11-17T09:17:00Z');await user('acc1');const ACC0=JSON.stringify([...DB].filter(([p])=>/^(users|names|members)\//.test(p)));
const fire=(n,b,srvs)=>Promise.all([...Array(n)].map((_,i)=>{const V=srvs[i%srvs.length];return SRV[V].fetch(new Request('https://api.test/backup',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),env,{}).catch(()=>0)}));
// ===== أ) التكرار =====
KV.m.clear();legacy();const LEG=baks(),LEG0=snapKV(LEG);
let n=baks().length;
let r=await at('new','/backup',{op:'now',rid:'clickAAAA0001'});T('ضغطة واحدة: نسخة واحدة',baks().length===n+1,r.key);n=baks().length;
r=await at('new','/backup',{op:'now',rid:'clickAAAA0001'});T('انقطع الاتصال بعد الحفظ فأُعيد الطلب نفسه: لا نسخة جديدة، ويُرجع النسخة نفسها',baks().length===n&&r.dup===1&&r.key===baks().find(k=>meta(k).rid==='clickAAAA0001'),r.key);
r=await at('new2','/backup',{op:'now',rid:'clickAAAA0001'});T('الطلب نفسه وصل إلى نسخة أخرى من الخادم: لا نسخة جديدة',baks().length===n&&r.dup===1);
// تزامن: 12 طلبًا بالمعرّف نفسه، موزّعة على ثلاث نسخ من الخادم، في اللحظة نفسها، والتصدير بطيء
DELAY=200;EXP=0;ctl.ACTIVE='new';
const R12=await Promise.all([...Array(12)].map((_,i)=>{ctl.ACTIVE=['new','new2','new3'][i%3];return post('/backup','admin',{op:'now',rid:'clickRACE0002'})}));
DELAY=30;
T('تزامن: 12 طلبًا بالمعرّف نفسه على 3 نسخ من الخادم: نسخة واحدة وتصدير واحد',baks().filter(k=>meta(k).rid==='clickRACE0002').length===1&&EXP===1,'نُسخ '+baks().filter(k=>meta(k).rid==='clickRACE0002').length+' · تصدير '+EXP+' · قيد الإنشاء '+R12.filter(x=>x.pending).length+' · النسخة نفسها '+R12.filter(x=>x.key&&!x.pending).length);
r=await at('new3','/backup',{op:'now',rid:'clickRACE0002'});T('بعدها: الطلب المكرّر يُرجع النسخة المنتهية',r.dup===1&&!!r.key&&!r.pending);
// تزامن بمعرّفات مختلفة (ضغطات مقصودة): لكلٍّ نسخته
n=baks().length;ctl.NOW+=5000;await Promise.all(['clickDIFF0003','clickDIFF0004'].map((x,i)=>{ctl.ACTIVE=i?'new2':'new';return post('/backup','admin',{op:'now',rid:x})}));   // متزامنتان وفي الجزء نفسه من الألف من الثانية (الساعة في الاختبار ثابتة)
T('ضغطتان مقصودتان بمعرّفين مختلفين في اللحظة نفسها: نسختان بمفتاحين مختلفين',['clickDIFF0003','clickDIFF0004'].every(x=>baks().some(k=>meta(k).rid===x)),baks().filter(k=>/DIFF/.test(meta(k).rid||'')).join(' '));
// تطبيق قديم بلا معرّف: طلبات متزامنة خلال دقيقتين
ctl.NOW=Math.ceil(ctl.NOW/120e3)*120e3+1000;n=baks().length;EXP=0;await Promise.all([1,2,3,4].map(i=>{ctl.ACTIVE=i%2?'new':'new2';return post('/backup','admin',{op:'now'})}));
T('تطبيق قديم بلا معرّف، 4 طلبات متزامنة: نسخة واحدة',baks().filter(k=>/^m-/.test(meta(k).rid||'')).length===1&&EXP===1,'تصدير '+EXP);
// فشل التصدير: يُحذف القفل، وإعادة المحاولة تنجح بنسخة واحدة
n=baks().length;FAILX=1;let fe=null;try{await at('new','/backup',{op:'now',rid:'clickFAIL0005'})}catch(e){fe=e}
T('فشل النسخ: لا نسخة ولا قفل عالق',!!fe&&!baks().some(k=>meta(k).rid==='clickFAIL0005')&&!DB.has('bakrid/clickFAIL0005'));
await at('new','/backup',{op:'now',rid:'clickFAIL0005'});await at('new2','/backup',{op:'now',rid:'clickFAIL0005'});T('إعادة المحاولة بعد الفشل (مرتين): نسخة واحدة',baks().filter(k=>meta(k).rid==='clickFAIL0005').length===1);
// قفل عالق من عملية توقفت (أقدم من 15 دقيقة)
n=baks().length;DB.set('bakrid/clickSTAL0006',{data:{st:'run',at:ctl.NOW-20*60e3,why:'manual'},ut:'99999'});
r=await at('new','/backup',{op:'now',rid:'clickSTAL0006'});T('قفل عالق أقدم من 15 دقيقة: يُستولى عليه وتُنشأ نسخة واحدة',baks().filter(k=>meta(k).rid==='clickSTAL0006').length===1&&!r.dup);
DB.set('bakrid/clickPEND0007',{data:{st:'run',at:ctl.NOW-60e3,why:'manual'},ut:'99998'});n=baks().length;
r=await at('new2','/backup',{op:'now',rid:'clickPEND0007'});T('قفل حديث (نسخ جارٍ): «قيد الإنشاء» بلا نسخة',r.pending===1&&baks().length===n);
// النسخة الليلية: تشغيل مزدوج في اليوم نفسه
n=baks().length;const W=[];const cx={waitUntil:p=>W.push(p)};await SRV.new.scheduled({},env,cx);await SRV.new2.scheduled({},env,cx);await Promise.all(W);
T('النسخة الليلية شُغّلت مرتين في اليوم نفسه: نسخة واحدة',baks().length===n+1,baks().filter(k=>meta(k).why==='auto'&&meta(k).pol===2).join(' '));
// ===== ب) الاحتفاظ =====
for(let d=0;d<20;d++){ctl.NOW+=864e5;const W2=[];await SRV[d%2?'new':'new2'].scheduled({},env,{waitUntil:p=>W2.push(p)});await Promise.all(W2)}
for(let i=0;i<8;i++){ctl.NOW+=60e3;await at(i%2?'new':'new3','/backup',{op:'now',rid:'clickKEEP00'+String(i).padStart(2,'0')})}
const p2=w=>baks().filter(k=>meta(k).pol===2&&meta(k).why===w);
console.log(out.join("\n"));out.length=0;T('بعد 21 نسخة ليلية جديدة: تبقى آخر 14 منها',p2('auto').length===14,p2('auto').length+' · أقدمها '+p2('auto')[0].slice(4,14)+' · أحدثها '+p2('auto').slice(-1)[0].slice(4,14));
T('النسخ اليدوية الجديدة: تبقى آخر 5',p2('manual').length===5,p2('manual').map(k=>meta(k).rid).join(' '));
T('النسخ الموجودة قبل السياسة الجديدة (14 ليلية و4 يدوية مكرّرة و«قبل الاسترجاع»): كلها باقية بلا تغيير',snapKV(LEG)===LEG0,LEG.length+' نسخة');
T('اليدوية لا تُخرج الليلية: 30 ضغطة يدوية لا تمسّ الليلية',await (async()=>{const a=p2('auto').join();for(let i=0;i<30;i++){ctl.NOW+=60e3;await at('new','/backup',{op:'now',rid:'clickMANY00'+String(i).padStart(2,'0')})}return p2('auto').join()===a&&p2('manual').length===5})());
T('المجموع بالسياسة الجديدة = 19 + القديمة',baks().length===19+LEG.length,baks().length+' = 19 + '+LEG.length);
T('بيانات الحسابات لم تتغيّر',JSON.stringify([...DB].filter(([p])=>/^(users|names|members)\//.test(p)))===ACC0);
T('الأقفال وثائق صغيرة مستقلة (bakrid)',[...DB.keys()].filter(p=>p.startsWith('bakrid/')).length>0,[...DB.keys()].filter(p=>p.startsWith('bakrid/')).length+' قفل');
// ===== ج) الخادم الحالي للمقارنة =====
KV.m.clear();legacy();const L0=baks();ctl.ACTIVE='old';await Promise.all([1,2,3,4].map(()=>post('/backup','admin',{op:'now',rid:'clickOLD00001'})));
const made=baks().filter(k=>!L0.includes(k)).length,gone=L0.filter(k=>!baks().includes(k));
T('[الخادم الحالي، للمقارنة] 4 طلبات بالمعرّف نفسه',made===1&&!gone.length,'أنشأ '+made+' نسخ، وحذف '+gone.length+' نسخ موجودة، منها '+gone.filter(k=>/T02-17/.test(k)).length+' ليلية');
console.log(out.join('\n'));
