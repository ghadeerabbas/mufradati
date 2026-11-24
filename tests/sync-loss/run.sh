#!/bin/bash
# المزامنة: شيفرة الخادم الحقيقية (worker.js المبني من core.js) مع قاعدة بيانات في الذاكرة. لا شبكة ولا مفاتيح.
# كل سيناريو يُشغَّل مرتين في عمليتين مستقلتين: «ضابط» (جهاز واحد متصل يفعل الأحداث نفسها) و«اختبار» (الحالة الصعبة).
# المزامنة الجديدة مفعّلة (MUF_SX=1 ومفتاح CFG.sx.on). الشروط: صفر ضياع صامت، وصفر تكرار، والنتيجة تطابق الضابط،
# إلا ما تفرضه القرارات صراحةً (المحطات وما سوى المراجعات أقدم من 7 أيام → الحجر)، فيُفحص أنه في الحجر بالعدد المتوقَّع ويُعرض أثره.
D=$(cd "$(dirname "$0")" && pwd); . "$D/../lib.sh"; W=$(mktemp -d)
cp "$R/server/worker.js" "$W/w_old.mjs"; cp "$R/server/worker.js" "$W/w_new.mjs"; cp "$R/core.js" "$W/core_old.js"; cp "$R/core.js" "$W/core_new.js"
SC="clockAhead clockBack twoDevices offline8 offline30 resend doubleStart lateSame"
for s in $SC; do for m in ctrl test; do (cd "$D" && MUF_SX=1 node scen.mjs "$W" "$R" $s $m > "$W/$s.$m.json" 2> "$W/$s.$m.err") & done; done; wait
{ for s in $SC; do node -e '
const fs=require("fs"),[,w,s]=process.argv,rd=m=>{try{return JSON.parse(fs.readFileSync(`${w}/${s}.${m}.json`,"utf8"))}catch(e){return null}};
const c=rd("ctrl"),t=rd("test");if(!c||!t){console.log(`FAIL ${s}: لم يكتمل التشغيل (انظر ${w}/${s}.*.err)`);process.exit()}
const P=(n,ok,x)=>console.log((ok?"PASS ":"FAIL ")+s+": "+n+(x!==undefined?" → "+x:""));
const off=s.startsWith("offline");
const keys={clockAhead:["reviewsAdded","xpAdded"],clockBack:["reviewsAdded","xpAdded"],twoDevices:["xp","gems","streak","reviews","words"],
 offline8:[],offline30:[],resend:["xp","gems","quizzes","stations","words","energy"],doubleStart:["energySpent"],lateSame:[]}[s];
console.log(`INFO ${s}: الضابط ${JSON.stringify(c)}`);console.log(`INFO ${s}: الاختبار ${JSON.stringify(t)}`);
P("لا ضياع صامت (لكل حدث حالة من الخادم)",!t.st.silent&&!c.st.silent,t.st.silent);
P("الضابط بلا حجر",c.st.q===0,JSON.stringify(c.st.qWhy));
if(off){P("الحجر = ما سوى المراجعات أقدم من 7 أيام («old»)، ومراجعات كلمات المحطات التي في الحجر («word») — بالعدد المتوقَّع",
   (t.st.qWhy.old||0)===t.st.expOld&&(t.st.qWhy.word||0)===t.st.expWord&&t.st.q===t.st.expOld+t.st.expWord,JSON.stringify(t.st.qWhy)+" / متوقَّع old "+t.st.expOld+" وword "+t.st.expWord);
 P("كل مراجعة محسوبة: الفرق عن الضابط = كلمات المحطات في الحجر + مراجعاتها في الحجر",c.reviews-t.reviews===5*t.st.oldSt+t.st.expWord,(c.reviews-t.reviews)+" = 5×"+t.st.oldSt+" + "+t.st.expWord);
 for(const k of ["xp","gems","streak","words"])if(c[k]!==t[k])console.log(`INFO ${s}: أثر قرار السبعة أيام على ${k}: ${c[k]} ← ${t[k]}`)}
else P("لا حجر",t.st.q===0,JSON.stringify(t.st.qWhy));
if(s==="lateSame"){P("المراجعة المتأخّرة: حالتها «late»، ولا خبرة، ولا مراجعة محسوبة، والكلمة كما هي، والحدث محفوظ",t.st.late===1&&t.xpAfter===t.xpBefore&&t.reviewsAfter===t.reviewsBefore&&t.wordSame&&t.lateKept,JSON.stringify({late:t.st.late,xp:[t.xpBefore,t.xpAfter],rv:[t.reviewsBefore,t.reviewsAfter],word:t.wordSame,kept:t.lateKept}))}
if(s==="resend")P("إعادة الإرسال: كل الدفعة المعادة عُرفت «وصلت سابقًا»",t.st.dup===t.st.resent&&t.st.resent>0,t.st.dup+" / "+t.st.resent);
const diff=keys.filter(k=>JSON.stringify(c[k])!==JSON.stringify(t[k]));
if(keys.length)P("مطابق للضابط في "+keys.join("، "),!diff.length,diff.map(k=>k+" "+c[k]+"←"+t[k]).join("، ")||"")' "$W" $s; done; echo __END; } | verdict
