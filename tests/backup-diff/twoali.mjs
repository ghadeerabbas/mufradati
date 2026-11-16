// «مطابقة» مع أرقام مختلفة في الجدول: حسابان بالاسم نفسه. كل جدول يعرض عمودًا لكل حساب، فيبدو العمودان «علي مقابل علي»
import {T,out,user,post,ctl,DB,app,station,memfs,env} from './it.mjs';
const ROOT='projects/mufradati-406bd/databases/(default)/documents';
const enc=v=>v===null||v===undefined?{nullValue:null}:typeof v==='string'?{stringValue:v}:typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?(Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v}):Array.isArray(v)?{arrayValue:{values:v.map(enc)}}:(v&&v.ms!==undefined&&Object.keys(v).length===1)?{timestampValue:new Date(v.ms).toISOString()}:{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,enc(x)]))}};
env.__export=async()=>{const arr=[...DB].map(([p,d])=>({document:{name:ROOT+'/'+p,fields:Object.fromEntries(Object.entries(d.data).map(([k,v])=>[k,enc(v)])),updateTime:d.ut},readTime:''}));return {parts:[JSON.stringify(arr)],n:arr.length,users:3}};
ctl.NOW=Date.parse('2026-11-10T15:00:00Z');ctl.ACTIVE='new';
// حساب قديم لعلي توقف عنده النشاط، وحسابه الحالي باسم «علي» أيضًا
for(const u of ['aliOLD1','aliNEW2']){await user(u);await memfs.commit([{path:'names/'+u,data:{name:'علي'}}])}
const O=app('new','aliOLD1'),N=app('new','aliNEW2');await O.sync();await N.sync();
for(let d=0;d<2;d++){await station(O);await station(N);await station(N);ctl.NOW+=864e5}
for(let d=0;d<3;d++){await station(N);await station(N);ctl.NOW+=864e5}
ctl.NOW+=3600e3;const k=(await post('/backup','admin',{op:'now',rid:'clickTWO00001'})).key;ctl.NOW+=600e3;
const v=await post('/backup','admin',{op:'verify',key:k});
T('بلا نشاط بعد النسخة: «مطابقة»، وكل وثائق الحسابين مطابقة',v.result==='match'&&Object.values(v.accts).every(a=>a.docSame&&!a.diff.length));
const cols=Object.entries(v.bak).filter(([,a])=>a.name==='علي');
T('جدول «من النسخة» فيه عمودان باسم «علي» بأرقام مختلفة (وهذا ما يبدو «فرقًا»)',cols.length===2&&cols[0][1].stations!==cols[1][1].stations,cols.map(([u,a])=>u+': جواهر '+a.gems+' · محطات '+a.stations).join(' | '));
T('ولكل حساب: النسخة = الآن',cols.every(([u,a])=>JSON.stringify(a)===JSON.stringify(v.live[u])));
// حساب بلا وثيقة أسماء (مثل محمد ونانا وسمارة في النسخة الحقيقية): العنوان من وثيقة المستخدم، ومعه رقم الحساب
await memfs.commit([{path:'users/mohX1',data:{name:'mohamad'}},{path:'members/mohX1',data:{no:5}}]);const M=app('new','mohX1');await M.sync();await station(M);
const k2=(await post('/backup','admin',{op:'now',rid:'clickTWO00002'})).key;const v2=await post('/backup','admin',{op:'verify',key:k2});
T('حساب بلا وثيقة أسماء: عنوان عموده اسمه في قائمة المستخدمين ورقمه، لا معرّفه الطويل',v2.accts.mohX1.name==='mohamad'&&v2.accts.mohX1.no===5&&v2.bak.mohX1.name==='mohamad',JSON.stringify({name:v2.accts.mohX1.name,no:v2.accts.mohX1.no}));
console.log(out.join('\n'));
