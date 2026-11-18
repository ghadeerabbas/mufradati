// اختبار تكامل محلي: شيفرة الخادم الحقيقية (worker.js) مع قاعدة بيانات في الذاكرة ومفاتيح تجريبية، وتطبيقات مُحاكاة بشيفرة core.js
// الاستعمال: node it.mjs <dir> — يحتاج في dir: w_old.mjs w_new.mjs core_old.js core_new.js، وملفات الموقع (courses.json وملفات الكلمات) في SITE_DIR
import vm from 'node:vm';import fs from 'node:fs';import path from 'node:path';import {webcrypto as wc} from 'node:crypto';import {pathToFileURL} from 'node:url';
const DIR=process.argv[2],SITE_DIR=process.argv[3];
// ---- الوقت ----
let NOW=Date.parse('2026-11-16T07:00:00Z');const RD=Date;
class FD extends RD{constructor(...a){a.length?super(...a):super(NOW)}static now(){return NOW}}globalThis.Date=FD;
// ---- مفاتيح تجريبية (لا علاقة لها بالمفاتيح الحقيقية) ----
const kp=await wc.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...(await wc.subtle.exportKey('jwk',kp.publicKey)),kid:'test',alg:'RS256',use:'sig'};
const b64u=b=>Buffer.from(b).toString('base64url');
async function token(uid,email){const h=b64u(JSON.stringify({alg:'RS256',kid:'test'})),p=b64u(JSON.stringify({aud:'mufradati-406bd',iss:'https://securetoken.google.com/mufradati-406bd',sub:uid,email,exp:Math.floor(NOW/1000)+3600,iat:Math.floor(NOW/1000)}));
  return h+'.'+p+'.'+b64u(await wc.subtle.sign('RSASSA-PKCS1-v1_5',kp.privateKey,new TextEncoder().encode(h+'.'+p)))}
const realFetch=globalThis.fetch;
globalThis.fetch=async(u,o)=>{u=String(u);
  if(u.includes('securetoken@system.gserviceaccount.com'))return new Response(JSON.stringify({keys:[jwk]}));
  if(u.startsWith('https://ghadeerabbas.github.io/mufradati/')){const f=path.join(SITE_DIR,u.split('/mufradati/')[1].split('?')[0]);return fs.existsSync(f)?new Response(fs.readFileSync(f)):new Response('',{status:404})}
  throw new Error('شبكة غير مسموحة في الاختبار: '+u)};
// ---- قاعدة بيانات في الذاكرة بواجهة makeFS نفسها ----
const DB=new Map();let UT=0;const cl=x=>JSON.parse(JSON.stringify(x));
const memfs={async get(p){const d=DB.get(p);return d?{data:cl(d.data),updateTime:d.ut}:null},
  async where(c,f,v){for(const [p,d] of DB)if(p.startsWith(c+'/')&&p.split('/').length===2&&d.data[f]===v)return p.split('/')[1];return ''},
  async many(ps){const o={};for(const p of ps)if(DB.has(p))o[p]=cl(DB.get(p).data);return o},
  async manyT(ps){const o={};for(const p of ps){const d=DB.get(p);o[p]=d?{data:cl(d.data),updateTime:d.ut}:null}return o},   // مثل makeFS.manyT
  async group(c){const o=[];for(const [p,d] of DB){const s=p.split('/');if(s.length>=4&&s.length%2===0&&s[s.length-2]===c)o.push({path:p,data:cl(d.data),updateTime:d.ut})}return o},   // مثل makeFS.group
  async list(c){const n=c.split('/').length+1,o=[];for(const [p,d] of DB)if(p.startsWith(c+'/')&&p.split('/').length===n)o.push({id:p.split('/').pop(),...cl(d.data)});return o},
  async page(c,ob,n){return {items:(await this.list(c)).slice(0,n),tok:''}},
  async commit(ws){for(const w of ws){const d=DB.get(w.path);if(w.ifUpdateTime&&(!d||d.ut!==w.ifUpdateTime)){const e=new Error('conflict');e.conflict=true;throw e}if(w.ifMissing&&d){const e=new Error('conflict');e.conflict=true;throw e}}
    for(const w of ws){if(w.del){DB.delete(w.path);continue}const d=DB.get(w.path);
      if(w.inc){const x=d?d.data:{};for(const k in w.inc)x[k]=(x[k]||0)+w.inc[k];DB.set(w.path,{data:x,ut:new RD(NOW).toISOString().replace('Z','')+String(++UT).padStart(6,'0')+'Z'});continue}
      const data=cl(w.data);for(const k in data)if(data[k]&&data[k].__ts)data[k]={ms:data[k].__ts};
      DB.set(w.path,{data:w.merge&&d?{...d.data,...data}:data,ut:new RD(NOW).toISOString().replace('Z','')+String(++UT).padStart(6,'0')+'Z'})}}};
const KV={m:new Map(),puts:0,async put(k,v,o){this.puts++;this.m.set(k,{v,o})},async list(o){const p=(o&&o.prefix)||'';return {keys:[...this.m.keys()].filter(n=>n.startsWith(p)).map(name=>({name,metadata:this.m.get(name).o&&this.m.get(name).o.metadata}))}},async get(k,o){return this.m.get(k)?.v??null},async delete(k){this.m.delete(k)}};
const env={__fs:memfs,BAK:KV};export {env};
// ---- الخادمان: القديم (main) والجديد (combined-test) ----
const SRV={old:(await import(pathToFileURL(path.resolve(DIR,'w_old.mjs')).href)).default,new:(await import(pathToFileURL(path.resolve(DIR,'w_new.mjs')).href)).default,new2:(await import(pathToFileURL(path.resolve(DIR,'w_new.mjs')).href+'?isolate2')).default,new3:(await import(pathToFileURL(path.resolve(DIR,'w_new.mjs')).href+'?isolate3')).default};
let ACTIVE='new';
async function post(p,uid,body){const r=await SRV[ACTIVE].fetch(new Request('https://api.test'+p,{method:'POST',headers:{Authorization:'Bearer '+await token(uid,uid+'@mufradati.app'),'Content-Type':'application/json',Origin:'https://ghadeerabbas.github.io'},body:JSON.stringify(body)}),env,{});const j=await r.json();if(r.status!==200)throw new Error(p+' '+r.status+' '+JSON.stringify(j));return j}
// ---- التطبيق: core.js (القديم أو الجديد) مع منطق applyServer نفسه في index.html ----
const PK=fs.readFileSync(path.join(DIR,'w_new.mjs'),'utf8').split('\n').filter(l=>/^function (un)?pack(Log|QA)/.test(l)).join('\n');
function app(kind,uid){const c={console,Math,Date:FD,JSON,Array,Object,String,Number,Set,Map,Intl};vm.createContext(c);
  vm.runInContext('let P={},LOG=[],QLOG=[],QA=[],BUY=[],R={bank:0,ach:[],lv:1,ts:0},LG={tier:null,w:"",hist:[],ts:0},EN={v:30,t:0},STN=[],STV=0,GIFTS=[],CW=0;'+fs.readFileSync(path.join(DIR,'core_'+kind+'.js'),'utf8')+'\n'+PK+`
  let EVQ=[];
  function applyServer(j){const c=JSON.parse(j.core);P=c.P||{};QLOG=c.QLOG||[];BUY=c.BUY||[];R=Object.assign({bank:0,ach:[],lv:1,ts:0},c.R||{});
    LG=Object.assign({tier:null,w:"",hist:[],ts:0},c.LG||{});EN=c.EN||{v:30,t:0};STN=c.STN||[];STV=c.STV||0;LOG=unpackLog(JSON.parse(j.log||"null"));QA=unpackQA(JSON.parse(j.qa||"null"));
    for(const e of EVQ)applyEv(e,e.t,{admin:false});EC=null}
  this.A={ev(e){e.t=e.t||Date.now();const r=applyEv(e,e.t,{admin:false});if(r===true)EVQ.push(e);EC=null;return r},take(){const q=EVQ;return q},done(n){EVQ=EVQ.slice(n)},applyServer,
    quest(id){const d=today(),q=QUESTS.find(x=>x.id===id);return {v:Math.min(q.f(d),q.goal),got:questGot(d,id)}},gems(){EC=null;return econ().gems},earned(){EC=null;return econ().earned},
    pz(m){return [...pzMonth(m).have].sort()},table(w,docs,prev,prog){return tableFor("${uid}",w,docs,prev,prog)},get R(){return R},get LG(){return LG},get q(){return EVQ.length},weekId,dkey,today};`,c);
  const A=c.A;A.kind=kind;A.uid=uid;A.sync=async()=>{const q=A.take().slice(0,300);const j=await post('/sync',uid,{evs:q});A.done(q.length);A.applyServer(j);A.rej=j.rej;return j};return A}
// ---- أدوات ----
const out=[],T=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?' → '+x:''));
const words=JSON.parse(fs.readFileSync(path.join(SITE_DIR,'words-a1.json'),'utf8')).words.map(w=>String(w.de).trim().toLowerCase());let wi=0;
const nextWords=()=>{const o=[];while(o.length<5){const k=words[wi++];if(!o.includes(k))o.push(k)}return o};
const user=async uid=>{await memfs.commit([{path:'users/'+uid,data:{name:uid}},{path:'names/'+uid,data:{name:uid}}])};
const adv=ms=>{NOW+=ms};
async function station(A,{miss=false,drill=true,syncEach=true}={}){
  A.ev({type:'stStart'});if(syncEach)await A.sync();adv(15e3+Math.floor(Math.random()*999));
  const ws=nextWords();A.ev({type:'stDone',words:ws,miss:miss?[ws[1]]:[]});if(syncEach)await A.sync();adv(20e3);
  if(drill){A.ev({type:'quiz',kind:'drill',ok:4,total:5,ms:9000});if(syncEach)await A.sync()}adv(30e3)}
async function duelDoc(id,winner,other){await memfs.commit([{path:'duel/'+id,data:{st:'done',ps:[winner,other],rank:[winner,other],['p_'+winner]:{d:true,c:4,ms:9000},['p_'+other]:{d:true,c:1,ms:12000}}}])}
export {T,out,app,user,station,adv,duelDoc,memfs,DB,post,SRV,KV};
export const ctl={get NOW(){return NOW},set NOW(v){NOW=v},set ACTIVE(v){ACTIVE=v},get ACTIVE(){return ACTIVE}};
