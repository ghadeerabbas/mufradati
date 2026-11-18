// تنقية نصوص الأخطاء: ما يجب أن يبقى حرفًا بحرف، وما يجب أن يُزال، وأن معلومات التشخيص لا تتغير، مع فحص عكسي يثبت أن الاختبار يكشف التنقية الزائدة أو الناقصة.
// حدود التنقية (موثّقة في الخادم أيضًا): أنماط محددة فقط (رموز، بريد، معرّفات حسابات في المسارات، معاملات روابط). لا تكتشف الأسماء ولا النص الحر؛ ليست ضمانًا كاملًا لإزالة البيانات الشخصية.
import fs from 'node:fs';import vm from 'node:vm';
const SRC=fs.readFileSync(process.argv[2],'utf8');
const piece=src=>{const a=src.indexOf('const SAN_COLL'),b=src.indexOf('\n',src.indexOf('const sanTag'));if(a<0||b<0)throw new Error('لم أجد دوال التنقية');return src.slice(a,b)};
function load(code){const c={RegExp,String,Object};vm.createContext(c);vm.runInContext(code+';this.sanErr=sanErr;this.sanWhere=sanWhere;',c);return c}
const U='https://ghadeerabbas.github.io/mufradati/index.html',V='?v=9ef4ef4607';
const KEEP=[
 "TypeError: Cannot read properties of undefined (reading 'box')",
 `TypeError: x\n    at renderSafe (${U}${V}:5175:23)\n    at async syncNow (${U}${V}:5773:101)\n    at HTMLButtonElement.<anonymous> (${U}:3302:9)`,
 `    at drawLeague (${U}:3621:184467)`,
 `    at applyAt (https://ghadeerabbas.github.io/mufradati/core.js${V}:488:61)`,
 `renderSafe@${U}${V}:5175:23\nsyncNow@${U}:5773:101`,
 `renderSafe@${U}:5175:23\nglobal code@${U}:12:3`,
 `    at Object.apiPost [as post] (https://ghadeerabbas.github.io/mufradati1/index.html?v=abc_DEF-12.x:44:5)`,
 `    at https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js:1:23456`,
 `TypeError: e.k.toLowerCase is not a function at ${U}:900:12`,
 "FirebaseError: Missing or insufficient permissions.",
 "FirebaseError: [code=unavailable]: The operation could not be completed",
 "TypeError: Failed to fetch","TypeError: Load failed","TypeError: NetworkError when attempting to fetch resource.",
 "QuotaExceededError: Failed to execute 'setItem' on 'Storage': Setting the value of 'muf_testuid_q' exceeded the quota.",
 'fs commit 400 {"error":{"code":400,"message":"Document too large"}}',"Error: fs get 503","google auth: {\"error\":\"invalid_grant\"}",
 "Error: duel/abc123 not found","users/testuid/data/core missing",
 "SyntaxError: Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON","RangeError: Maximum call stack size exceeded",
 "ReferenceError: QUESTS is not defined","Error: stale 1794864936611 > 1794864996611",
 "NotAllowedError: play() failed because the user didn't interact with the document first. https://goo.gl/xX8pDD",
 "Error: audio https://ghadeerabbas.github.io/mufradati/audio/3f2a9c81.mp3 404",
 "Error: Wort nicht gefunden: Bäckerei","خطأ: تعذّر الحفظ في الخادم","النسخ الاحتياطي فشل: fs list 500",
 "AbortError: The user aborted a request.","InvalidStateError: An attempt was made to use an object that is not, or is no longer, usable",
 `    at Array.forEach (<anonymous>)\n    at render (${U}${V}:2231:15)`,
 "Error: errgate 500","TypeError: Cannot set properties of null (setting 'textContent')",
 `Uncaught Error: x (${U}#review:10:2)`,
 "#review","index.html:5175","promise","backup","summary","/sync","",
 "Mozilla/5.0 (Linux; Android 14; SM-A546B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.6778.135 Mobile Safari/537.36",
 "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"];
const REMOVE=[   // [النص، ما يجب ألا يبقى، ما يجب أن يبقى]
 [`Error: login failed for ali@mufradati.app\n    at renderLogin (${U}:1200:5)`,['ali@mufradati.app'],['renderLogin','index.html:1200:5','Error: login failed for']],
 ["FirebaseError: No document to update: projects/mufradati-406bd/databases/(default)/documents/users/FIrNA0FPnYSEZDIwIJOfda0BYej2/data/core",['FIrNA0FPnYSEZDIwIJOfda0BYej2'],['users/[معرّف]/data/core','FirebaseError: No document to update']],
 ["Error: token eyJhbGciOiJSUzI1NiIsImtpZCI6InRlc3QifQ.eyJzdWIiOiJ1MSJ9.c2lnbmF0dXJlLXRlc3Q expired",['eyJhbGci','c2lnbmF0dXJl'],['Error: token','expired']],
 ["Request failed: Authorization: Bearer ya29.a0AfB_byC-test_token_value at x",['ya29.a0AfB'],['Bearer [رمز]','Request failed']],
 ["fetch https://mufradati-api.afunogrv.workers.dev/sync?uid=FIrNA0FPnYSEZDIwIJOfda0BYej2&token=abc failed",['FIrNA0FPnYSEZDIwIJOfda0BYej2','token=abc'],['https://mufradati-api.afunogrv.workers.dev/sync','failed']],
 ["uid=FIrNA0FPnYSEZDIwIJOfda0BYej2 not allowed",['FIrNA0FPnYSEZDIwIJOfda0BYej2'],['uid=[معرّف]','not allowed']],
 [`    at loadImg (${U}${V}&key=secret123:77:9)`,['secret123'],['loadImg',`${U}${V}:77:9`]],
 [`    at go (${U}#/u/x?k=1:5:5)`,['#/u/x'],['go','index.html#[…]:5:5']],
 ["names/AbCdEfGhIjKlMnOpQrStUvWxYz12 missing; mail moh.k@gmail.com",['AbCdEfGhIjKlMnOpQrStUvWxYz12','moh.k@gmail.com'],['names/[معرّف]','missing; mail [بريد]']]];
// معلومات التشخيص: أسماء الدوال، والملفات، والسطر والعمود، ونوع الخطأ
const diag=s=>({fn:[...s.matchAll(/(?:\bat\s+(?:async\s+)?([\w$.<>\[\] ]+?)\s+\(|^\s*([\w$. ]+)@)/gm)].map(m=>(m[1]||m[2]).trim()).join('|'),
  files:[...s.matchAll(/([\w.-]+\.(?:html|js|mjs|mp3))/g)].map(m=>m[1]).join('|'),lc:[...s.matchAll(/:(\d+):(\d+)/g)].map(m=>m[1]+':'+m[2]).join('|'),
  type:(s.match(/^(\w*Error|Error)\b/)||[''])[0]});
function check(C){const r=[];const T=(n,c,x)=>r.push((c?'PASS ':'FAIL ')+n+(x!==undefined?' → '+x:''));
  const bad=KEEP.filter(s=>{const t={};return C.sanErr(s,t)!==s||Object.keys(t).length});T(`ما يجب أن يبقى: ${KEEP.length} نصًّا تقنيًا بلا أي تغيير`,!bad.length,bad.length?bad[0].slice(0,90)+' → '+C.sanErr(bad[0],{}).slice(0,90):'');
  const w=['#review','#settings','#a-b_c'].filter(x=>C.sanWhere(x,{})!==x);T('أسماء الصفحات بعد # تبقى',!w.length,w.join());
  const rb=[];for(const [s,no,yes] of REMOVE){const o=C.sanErr(s,{});if(no.some(x=>o.includes(x))||yes.some(x=>!o.includes(x)))rb.push(s.slice(0,50)+' → '+o.slice(0,120))}
  T(`ما يجب أن يُزال: ${REMOVE.length} حالات (بريد، رمز، معرّف، معاملات روابط) ويبقى ما حولها`,!rb.length,rb.join(' | '));
  const dd=[...KEEP,...REMOVE.map(x=>x[0])].filter(s=>JSON.stringify(diag(s))!==JSON.stringify(diag(C.sanErr(s,{}))));
  T('معلومات التشخيص (الدوال والملفات والسطر والعمود ونوع الخطأ) مطابقة قبل التنقية وبعدها في كل النصوص',!dd.length,dd.length?dd[0].slice(0,80):'');
  const id=[...KEEP,...REMOVE.map(x=>x[0])].filter(s=>{const a=C.sanErr(s,{});return C.sanErr(a,{})!==a});T('التنقية ثابتة: تنقية الناتج مرة ثانية لا تغيّره',!id.length);
  const tg={};C.sanErr(REMOVE[8][0],tg);T('كل وثيقة تحمل أنواع ما نُقّي وعدده',tg['معرّف']===1&&tg['بريد']===1,JSON.stringify(tg));
  return r}
const real=check(load(piece(SRC)));
// فحص عكسي: قاعدة مفرطة (حذف كل رقم من 6 خانات فأكثر) يجب أن تفشل، وقاعدة ناقصة (بلا البريد) يجب أن تفشل
const over=check(load(piece(SRC).replace('s = String(s == null ? "" : s);','s = String(s == null ? "" : s); s = s.replace(/\\d{6,}/g, "#");')));
const under=check(load(piece(SRC).replace(/s = s\.replace\(\/\[\\w\.%\+-\]\+@[^\n]*\n/,'\n')));
const T=(n,c,x)=>real.push((c?'PASS ':'FAIL ')+n+(x!==undefined?' → '+x:''));
T('فحص عكسي: تنقية مفرطة (حذف الأرقام الطويلة) يكتشفها الاختبار',over.some(l=>l.startsWith('FAIL')),over.filter(l=>l.startsWith('FAIL')).length+' فشل');
T('فحص عكسي: تنقية ناقصة (بلا قاعدة البريد) يكتشفها الاختبار',under.some(l=>l.startsWith('FAIL'))&&piece(SRC)!==piece(SRC).replace(/s = s\.replace\(\/\[\\w\.%\+-\]\+@[^\n]*\n/,'\n'),under.filter(l=>l.startsWith('FAIL')).length+' فشل');
console.log(real.join('\n'));
