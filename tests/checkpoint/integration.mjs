import {T,out,user,post,ctl,memfs} from './it.mjs';import vm from 'node:vm';import fs from 'node:fs';
const INFO=(n,x)=>out.push('INFO '+n+(x!==undefined?' → '+x:''));   // معلومة للعرض فقط: لا تُحسب نجاحًا ولا فشلًا
const PK=fs.readFileSync('w_new.mjs','utf8').split('\n').filter(l=>/^function (un)?pack(Log|QA)/.test(l)).join('\n');
const FD=globalThis.Date;
function ctx(src){const c={console,Math,Date:FD,JSON,Array,Object,String,Number,Set,Map,Intl};vm.createContext(c);
  vm.runInContext('let P={},LOG=[],QLOG=[],QA=[],BUY=[],R={bank:0,ach:[],lv:1,ts:0},LG={tier:0,w:"",hist:[],ts:0},EN={v:30,t:0},STN=[],STV=0,GIFTS=[],CW=0;'+src+'\n'+PK+`
  this.X={econ:()=>{EC=null;const e=econ();return {xp:e.xp,lv:e.lv,earned:e.earned,rev:e.s.reviews,mem:e.s.mem,mast:e.s.mast,best:e.s.best,perfect:e.s.perfect,maxDay:e.s.maxDay,days:Object.keys(e.per).length}},
   fromServer(j){const c=JSON.parse(j.core);P=c.P;QLOG=c.QLOG;BUY=c.BUY;R=c.R;LG=c.LG;EN=c.EN;STN=c.STN;STV=c.STV;LOG=unpackLog(JSON.parse(j.log));if(typeof CK!=='undefined'&&j.ck!==undefined)CK=j.ck?JSON.parse(j.ck):null;EC=null},
   get CK(){return typeof CK==='undefined'?null:CK},get LOG(){return LOG},set LOG(v){LOG=v},get P(){return P},packLog,applyEv};`,c);return c.X}
const NEWC=fs.readFileSync('core_new.js','utf8'),OLDC=fs.readFileSync('core_old.js','utf8'),REFC=OLDC.replace('if(LOG.length>60000)LOG=LOG.slice(-60000);','');
// حساب اختبار وهمي بسجلّ قريب من الحدّ (59,990 حدثًا على نحو 300 يوم)
const words=[...Array(4000)].map((_,i)=>'wort'+i);const t0=Date.parse('2026-01-20T06:00:00Z');const LOGS=[];const P={};let s=7;const rnd=()=>(s=(s*1103515245+12345)%2147483648)/2147483648;
for(let i=0;i<59990;i++){const k=words[Math.floor(rnd()*words.length)];const t=Math.round((t0+i*430e3/1)/1000)*1000;const nw=P[k]?(rnd()<.1?2:0):1;LOGS.push([t,k,rnd()<.15?0:rnd()<.3?1:2,nw]);P[k]={box:2,due:t,t}}
const REF=ctx(REFC);REF.LOG=LOGS.map(x=>[...x]);
const seed={P,QLOG:[],BUY:[],R:{bank:0,ach:[],lv:1,ts:0},LG:{tier:0,w:'',hist:[],ts:0},EN:{v:30,t:0},STN:[],STV:0,ver:1,lf:1};
await user('ck1');await memfs.commit([{path:'users/ck1/data/core',data:{v:JSON.stringify(seed)}},{path:'users/ck1/data/log',data:{v:JSON.stringify(REF.packLog(LOGS))}}]);
ctl.ACTIVE='new';ctl.NOW=Date.parse('2026-11-16T09:00:00Z');
let D1=ctx(NEWC),ckt=0,ckSent=0,noCk=0;
let j=await post('/sync','ck1',{evs:[],ckt});D1.fromServer(j);REF.fromServer(j);
T('قبل الحدّ: لا نقطة حفظ',!D1.CK&&D1.LOG.length===59990);
const keys=Object.keys(P);
for(let i=0;i<40;i++){ctl.NOW+=2000;const e={type:'rate',k:keys[i*7%keys.length],r:2,t:ctl.NOW};REF.applyEv(e,ctl.NOW,{server:true});
  j=await post('/sync','ck1',{evs:[e],ckt});if(j.ck!==undefined){ckSent++}else noCk++;D1.fromServer(j);ckt=D1.CK?D1.CK.t:0}
const ckDoc=await memfs.get('users/ck1/data/ck');
T('عند تجاوز 60000: طيّ ونقطة حفظ في وثيقة مستقلة',!!(ckDoc&&ckDoc.data.v)&&D1.LOG.length<=51000,'السجل الحيّ '+D1.LOG.length+' · نقطة الحفظ '+Math.round((ckDoc?.data.v.length||0)/1024)+' ك.ب');
T('نقطة الحفظ تُرسل للتطبيق مرة واحدة فقط',ckSent===1,ckSent+' مرة من '+(ckSent+noCk));
const a=REF.econ(),b=D1.econ();T('أرقام التطبيق بعد المزامنة = المرجع (السجل كاملًا)',JSON.stringify(a)===JSON.stringify(b),JSON.stringify(b));
const D2=ctx(NEWC);j=await post('/sync','ck1',{evs:[],ckt:0});D2.fromServer(j);T('جهاز جديد أو إعادة تثبيت: يستلم نقطة الحفظ والأرقام نفسها',j.ck!==undefined&&JSON.stringify(D2.econ())===JSON.stringify(a));
const O=ctx(OLDC);O.fromServer(j);const o=O.econ();INFO('تطبيق قديم مع الخادم الجديد (خطر، تعالجه المرحلة 0)','خبرة '+o.xp+' بدل '+a.xp+' · مراجعات '+o.rev+' بدل '+a.rev);
// الخادم يحسب من نقطة الحفظ أيضًا: الملف العام (pub) يحمل الخبرة الصحيحة
ctl.NOW+=11*60e3;await post('/sync','ck1',{evs:[],ckt});const pub=await memfs.get('pub/ck1');T('الخادم يحسب من نقطة الحفظ (الخبرة في الملف العام)',pub&&pub.data.xp===a.xp,pub&&pub.data.xp);
// حذف المشرف بيانات الحساب
await post('/wipe','admin',{uid:'ck1'});const ck2=await memfs.get('users/ck1/data/ck');T('حذف المشرف يمسح نقطة الحفظ',ck2&&ck2.data.v==='');
j=await post('/sync','ck1',{evs:[],ckt});D1.fromServer(j);T('التطبيق بعد الحذف: لا نقطة حفظ',!D1.CK&&j.ck==='');
console.log(out.join('\n'));
