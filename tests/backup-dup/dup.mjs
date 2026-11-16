import {T,out,user,post,ctl,KV,env,DB} from './it.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let EXP=0;env.__export=async()=>{EXP++;ctl.NOW+=1000;await sleep(30);   // تصدير يستغرق وقتًا، والساعة تتقدّم ثانية
  return {parts:['{"document":{"name":"projects/mufradati-406bd/databases/(default)/documents/users/acc1","fields":{}}}'],n:1,users:1}};
const baks=()=>[...KV.m.keys()].filter(k=>k.startsWith('bak-')).sort();
const snapKV=()=>JSON.stringify([...KV.m].filter(([k])=>k.startsWith('bak-')).map(([k,x])=>[k,Buffer.from(x.v).toString('base64'),x.o]));
ctl.NOW=Date.parse('2026-11-16T08:17:00Z');await user('acc1');const DB0=JSON.stringify([...DB]);
for(const V of ['old','new']){
  KV.m.clear();ctl.ACTIVE=V;
  // نسخ صحيحة موجودة من قبل (ليلية)
  for(let i=1;i<=3;i++){ctl.NOW-=864e5*0;await KV.put('bak-2026-11-1'+i+'T02-17-00-000Z',new Uint8Array([i,i,i]),{metadata:{at:Date.parse('2026-11-1'+i+'T02:17:00Z'),n:9,users:3,size:3,why:'auto'}})}
  const before=snapKV();EXP=0;
  // 1) ضغطة واحدة = طلب واحد
  let r=await post('/backup','admin',{op:'now',rid:'clickAAAA0001'});
  T(`[${V}] ضغطة واحدة: نسخة واحدة`,baks().length===4,baks().slice(-1)[0]);
  // 2) إعادة الطلب نفسه (إعادة محاولة بعد خطأ، أو تكرار من الشبكة) بعد أن حُفظت
  await post('/backup','admin',{op:'now',rid:'clickAAAA0001'});
  T(`[${V}] الطلب نفسه مرة ثانية: لا نسخة جديدة`,baks().length===4,'عدد النسخ '+baks().length);
  // 3) أربعة طلبات متطابقة في الوقت نفسه (مثل صورة الساعة 09:17)
  await Promise.all([1,2,3,4].map(()=>post('/backup','admin',{op:'now',rid:'clickBBBB0002'})));
  T(`[${V}] أربعة طلبات متطابقة معًا: نسخة واحدة`,baks().length===5,'عدد النسخ '+baks().length+' · مفاتيحها '+baks().slice(4).map(k=>k.slice(15)).join(' '));
  // 4) تطبيق قديم بلا معرّف: ضغطتان خلال دقيقة
  ctl.NOW+=130e3;const n0=baks().length;await post('/backup','admin',{op:'now'});await post('/backup','admin',{op:'now'});
  T(`[${V}] تطبيق قديم بلا معرّف، طلبان خلال دقيقتين: نسخة واحدة`,baks().length===n0+1,'زادت '+(baks().length-n0));
  // 5) طلب مكرّر وصل إلى نسخة أخرى من الخادم أثناء النسخ: العلامة «قيد الإنشاء»
  if(V==='new'){await KV.put('brid-clickCCCC0003','{}');const n1=baks().length;const j=await post('/backup','admin',{op:'now',rid:'clickCCCC0003'});
    T('[new] طلب مكرّر أثناء نسخ جارٍ في مكان آخر: «قيد الإنشاء» بلا نسخة ثانية',j.pending===1&&baks().length===n1);}
  // 6) ضغطة جديدة مقصودة (معرّف جديد) بعد دقيقتين: نسخة جديدة
  ctl.NOW+=130e3;const n2=baks().length;await post('/backup','admin',{op:'now',rid:'clickDDDD0004'});
  T(`[${V}] ضغطة جديدة مقصودة: نسخة جديدة`,baks().length===n2+1);
  // 7) النسخ الصحيحة السابقة لم تتغيّر
  const after=JSON.parse(snapKV()),b0=JSON.parse(before);
  T(`[${V}] النسخ الثلاث الموجودة من قبل لم تتغيّر بايتًا ولا بيانات وصفية`,b0.every(x=>after.some(y=>JSON.stringify(y)===JSON.stringify(x))));
  // 8) كل نسخة جديدة لها معرّف فريد ووقت بالملّي ثانية
  const L=(await post('/backup','admin',{op:'list'})).items;const ks=L.map(x=>x.key);
  T(`[${V}] المعرّفات فريدة`,new Set(ks).size===ks.length,L.filter(x=>x.why==='manual').map(x=>x.key.slice(15)+' '+(x.rid||'-')).join(' | '));
}
// 9) الحسابات نفسها لم تُلمس
{const A=JSON.parse(DB0).filter(([p])=>/^(users|names|members)\//.test(p)),B=[...DB].filter(([p])=>/^(users|names|members)\//.test(p)).map(([p,d])=>[p,d]);T('بيانات الحسابات (users وnames وmembers) لم تتغيّر بأي نسخ',JSON.stringify(A)===JSON.stringify(JSON.parse(JSON.stringify(B))),'الوثائق الأخرى: '+[...DB.keys()].filter(p=>!/^(users|names|members)\//.test(p)).join('، '))}
// 10) الخطر الجانبي في الخادم الحالي: النسخ المكرّرة تُخرج نسخًا ليلية صحيحة (تبقى آخر 14 فقط)
KV.m.clear();ctl.ACTIVE='old';for(let i=0;i<13;i++)await KV.put('bak-2026-11-0'+String(i).padStart(1,'0')+'T02-17-00-000Z'.replace('0'+i,String(i).padStart(2,'0')),new Uint8Array([i]),{metadata:{at:i,why:'auto'}});
const k13=baks().length;await Promise.all([1,2,3,4].map(()=>post('/backup','admin',{op:'now'})));
T('[old] 13 نسخة ليلية ثم 4 نسخ مكرّرة: كم نسخة ليلية بقيت؟',true,'كانت '+k13+'، بقي منها '+baks().filter(k=>k.includes('T02-17')).length+'، والمجموع '+baks().length);
console.log(out.join('\n'));
