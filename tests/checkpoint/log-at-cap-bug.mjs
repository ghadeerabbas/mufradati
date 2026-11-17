import {T,out,user,post,ctl,memfs} from './it.mjs';
const words=[...Array(3000)].map((_,i)=>'wort'+i),P={},L=[];const t0=Date.parse('2026-01-20T06:00:00Z');
for(let i=0;i<60000;i++){const k=words[i%3000];const t=t0+i*430000;L.push([t,k,2,P[k]?0:1]);P[k]={box:2,due:t,t}}
const pack=L=>{const K=[],ix={},F=[];let p=0;for(const [t,k,r,n] of L){if(ix[k]===undefined){ix[k]=K.length;K.push(k)}const s=Math.round(t/1000);F.push(s-p,ix[k],r,n);p=s}return {K,F}};
// السيناريو نفسه على خادمين: القديم (PRE_FOLD، قبل الإصلاح) والحالي
async function atCap(V,uid){await user(uid);await memfs.commit([{path:`users/${uid}/data/core`,data:{v:JSON.stringify({P,QLOG:[],BUY:[],R:{bank:0,ach:[],lv:1,ts:0},LG:{tier:0,w:'',hist:[],ts:0},EN:{v:30,t:0},STN:[],STV:0,ver:1,lf:1})}},{path:`users/${uid}/data/log`,data:{v:JSON.stringify(pack(L))}}]);
  ctl.ACTIVE=V;ctl.NOW=Date.parse('2026-11-16T09:00:00Z');
  for(let i=0;i<5;i++){ctl.NOW+=2000;await post('/sync',uid,{evs:[{type:'rate',k:'wort'+i,r:2,t:ctl.NOW}]})}
  const d=JSON.parse((await memfs.get(`users/${uid}/data/log`)).data.v);let p=0;for(let i=0;i<d.F.length;i+=4)p+=d.F[i];
  return {saved:p*1000>=Date.parse('2026-11-16'),last:new Date(p*1000).toISOString().slice(0,10)}}
const o=await atCap('old','b1'),n=await atCap('new','b2');
T('[خلل معروف في الخادم القديم PRE_FOLD] عند 60000 حدث لا تُحفظ المراجعات الجديدة في السجل',!o.saved,'آخر حدث محفوظ '+o.last);
T('الخادم الحالي عند 60000: المراجعات الجديدة محفوظة في السجل',n.saved,'آخر حدث محفوظ '+n.last);
console.log(out.join('\n'));
