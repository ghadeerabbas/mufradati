// التراجع من الإصدار 1 إلى R1 بعد أن بدأ الطيّ: لا يضيع شيء
import {T,out,app,user,station,memfs,ctl} from './it.mjs';
ctl.NOW=Date.parse('2026-12-01T08:00:00Z');await user('u5');
const seed={R:{bank:0,ach:[],lv:1,ts:0,qd:[...Array(599)].map((_,i)=>[new Date(Date.parse('2025-01-01')+i*864e5).toISOString().slice(0,10),'rv15',3])},LG:{tier:0,w:'',hist:[],ts:0},STN:[],EN:{v:30,t:0},P:{},QLOG:[],BUY:[],STV:0,ver:1,lf:1};
await memfs.commit([{path:'users/u5/data/core',data:{v:JSON.stringify(seed)}}]);
const led=X=>(+X.R.qdg||0)+X.R.qd.reduce((a,x)=>a+(+x[2]||0),0);
let A;
for(const [srv,n] of [['new',5],['old',5],['new',5]]){ctl.ACTIVE=srv;A=app(srv==='new'?'new':'old',srv==='old'?'u5':'u5');
  for(let k=0;k<n;k++){ctl.NOW+=864e5;await A.sync();await station(A,{syncEach:false});A.ev({type:'quest',id:'perf'});await A.sync()}}
const B=app('new','u5');ctl.ACTIVE='new';await B.sync();
const exp=1797+B.R.qd.filter(x=>x[0]>='2026-12-01').reduce((a,x)=>a+(+x[2]||0),0);
T('إصدار 1 ← R1 ← إصدار 1: جواهر الصناديق كاملة',led(B)===exp,'الموجود '+led(B)+' · المستحقّ '+exp+' · مطويّ '+B.R.qdg);
console.log(out.join('\n'));
