import {T,out,user,post,ctl,memfs} from './it.mjs';
const words=[...Array(3000)].map((_,i)=>'wort'+i),P={},L=[];const t0=Date.parse('2026-01-20T06:00:00Z');
for(let i=0;i<60000;i++){const k=words[i%3000];const t=t0+i*430000;L.push([t,k,2,P[k]?0:1]);P[k]={box:2,due:t,t}}
const pack=L=>{const K=[],ix={},F=[];let p=0;for(const [t,k,r,n] of L){if(ix[k]===undefined){ix[k]=K.length;K.push(k)}const s=Math.round(t/1000);F.push(s-p,ix[k],r,n);p=s}return {K,F}};
await user('b1');await memfs.commit([{path:'users/b1/data/core',data:{v:JSON.stringify({P,QLOG:[],BUY:[],R:{bank:0,ach:[],lv:1,ts:0},LG:{tier:0,w:'',hist:[],ts:0},EN:{v:30,t:0},STN:[],STV:0,ver:1,lf:1})}},{path:'users/b1/data/log',data:{v:JSON.stringify(pack(L))}}]);
ctl.ACTIVE='old';ctl.NOW=Date.parse('2026-11-16T09:00:00Z');
for(let i=0;i<5;i++){ctl.NOW+=2000;await post('/sync','b1',{evs:[{type:'rate',k:'wort'+i,r:2,t:ctl.NOW}]})}
const d=JSON.parse((await memfs.get('users/b1/data/log')).data.v);let p=0;for(let i=0;i<d.F.length;i+=4)p+=d.F[i];
T('الخادم الحالي عند 60000: هل حُفظت المراجعات الجديدة في السجل؟',true,(p*1000>=Date.parse('2026-11-16')?'نعم':'لا — آخر حدث محفوظ '+new Date(p*1000).toISOString().slice(0,10))+' · حجم وثيقة السجل '+Math.round(JSON.stringify(d).length/1024)+' ك.ب');
console.log(out.join('\n'));
