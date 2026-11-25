#!/bin/bash
# المزامنة: شيفرة الخادم الحقيقية (worker.js المبني من core.js) مع قاعدة بيانات في الذاكرة. لا شبكة ولا مفاتيح.
# كل سيناريو يُشغَّل مرتين في عمليتين مستقلتين: «ضابط» (جهاز واحد متصل يفعل الأحداث نفسها) و«اختبار» (الحالة الصعبة).
# المزامنة الجديدة مفعّلة (MUF_SX=1 ومفتاح CFG.sx.on). الشروط: صفر ضياع صامت، وصفر تكرار، والنتيجة تطابق الضابط،
# إلا ما تفرضه القرارات صراحةً (المحطات وما سوى المراجعات أقدم من 7 أيام → الحجر)، فيُفحص أنه في الحجر بالعدد المتوقَّع ويُعرض أثره.
D=$(cd "$(dirname "$0")" && pwd); . "$D/../lib.sh"; W=$(mktemp -d)
# w_old/core_old: الخادم والمنطق المنشوران (RELEASED_SRV في tests/BASE، أو 29c1cfc)، لاختبار التراجع؛ الضابط والاختبار يستعملان الجديد
OLD=${RELEASED_SRV:-29c1cfc}; git -C "$R" show "$OLD:server/worker.js" > "$W/w_old.mjs"; git -C "$R" show "$OLD:core.js" > "$W/core_old.js"
cp "$R/server/worker.js" "$W/w_new.mjs"; cp "$R/core.js" "$W/core_new.js"
SC="clockAhead clockBack twoDevices offline8 offline30 resend doubleStart lateSame"
EC="gaps order reinstall resendMulti atomic rollback edayMix comboMix clockFuture clockBack missedDay fullEvent devicesArchive prune"
for s in $SC; do for m in ctrl test; do (cd "$D" && MUF_SX=1 node scen.mjs "$W" "$R" $s $m > "$W/$s.$m.json" 2> "$W/$s.$m.err") & done; done
for c in $EC; do (cd "$D" && MUF_SX=1 node edge.mjs "$W" "$R" $c > "$W/e_$c.out" 2> "$W/e_$c.err" || echo "FAIL $c: توقّف بخطأ: $(tail -c 300 "$W/e_$c.err")" >> "$W/e_$c.out") & done
E2="quest30 anchorMissed anchorEnergy policyDay rollbackQuiz rollbackCfg pruneClock idsGrowth bigEvent bytesLimit backupSx reapply anchorSleep bigMiddle reapplyStress reapplyArchived badIds ackMarker longTerm badIdBig sxBounds replyChk"
for c in $E2; do (cd "$D" && MUF_SX=1 node edge2.mjs "$W" "$R" $c > "$W/e_$c.out" 2> "$W/e_$c.err" || echo "FAIL $c: توقّف بخطأ: $(tail -c 300 "$W/e_$c.err")" >> "$W/e_$c.out") & done
# الحالة نفسها بمنطقة زمنية أخرى للعملية: المرساة والأيام بتوقيت برلين في الخادم لا تتأثّر
(cd "$D" && TZ=Pacific/Kiritimati MUF_SX=1 node edge2.mjs "$W" "$R" anchorMissedTZ > "$W/e_anchorMissedTZ.out" 2> "$W/e_anchorMissedTZ.err" || echo "FAIL anchorMissedTZ: توقّف بخطأ" >> "$W/e_anchorMissedTZ.out") & wait
E2="$E2 anchorMissedTZ"
# الساعة المتقدّمة: أربعة أوضاع في عمليات مستقلة بالوقت نفسه، ثم المقارنة بالساعة الصحيحة
for m in ok plain page native; do (cd "$D" && FC=$m MUF_SX=1 node edge2.mjs "$W" "$R" fcOne > "$W/fc_$m.out" 2> "$W/fc_$m.err") & done; wait
node -e '
const fs=require("fs"),w=process.argv[1],R={};for(const m of ["ok","plain","page","native"]){const l=(fs.readFileSync(w+"/fc_"+m+".out","utf8").match(/^FCRES (.*)$/m)||[])[1];R[m]=l?JSON.parse(l):null}
const out=[],P=(n,c,x)=>out.push((c?"PASS ":"FAIL ")+"forwardClock: "+n+(x!==undefined?" → "+JSON.stringify(x):""));
if(Object.values(R).some(x=>!x)){out.push("FAIL forwardClock: لم يكتمل التشغيل")}else{const ok=R.ok,eq=(a,b)=>["xp","gems","streak","reviews","stations","energy"].every(k=>a[k]===b[k]);
for(const m of ["ok","plain","page","native"])out.push("INFO forwardClock: "+m+" → "+JSON.stringify(R[m]));
for(const [m,n] of [["native","مرساة الهاتف"],["page","مرساة الصفحة"],["plain","بلا مرساة"]])P("ساعة متقدّمة يومًا ودون إنترنت 3 أيام، "+n+": مطابقة للساعة الصحيحة (الخبرة والجواهر والسلسلة والمراجعات والمحطات والطاقة، ولا حجر)",eq(R[m],ok)&&!Object.keys(R[m].q).length,R[m])}
fs.writeFileSync(w+"/e_forwardClock.out",out.join("\n")+"\n")' "$W"
# تغيير الساعة عدة مرات أثناء العمل دون إنترنت (FCM=1): مرساة الهاتف مطابقة للساعة الصحيحة؛ وبدونها لا مكسب، ولا ضياع صامت
for m in plain page native; do (cd "$D" && FCM=1 FC=$m MUF_SX=1 node edge2.mjs "$W" "$R" fcOne > "$W/fcm_$m.out" 2> "$W/fcm_$m.err") & done; wait
node -e '
const fs=require("fs"),w=process.argv[1],R={};for(const m of ["ok","plain","page","native"]){const f=m==="ok"?"fc_ok":"fcm_"+m;const l=(fs.readFileSync(w+"/"+f+".out","utf8").match(/^FCRES (.*)$/m)||[])[1];R[m]=l?JSON.parse(l):null}
const out=[],P=(n,c,x)=>out.push((c?"PASS ":"FAIL ")+"clockMulti: "+n+(x!==undefined?" → "+JSON.stringify(x):""));
if(Object.values(R).some(x=>!x))out.push("FAIL clockMulti: لم يكتمل التشغيل");else{const ok=R.ok;
 for(const m of ["plain","page","native"])out.push("INFO clockMulti: "+m+" → "+JSON.stringify(R[m]));
 P("مرساة الهاتف رغم ثلاثة تغييرات للساعة: كل ما أرسله الجهاز مقبول، ولا شيء في الحجر، والسلسلة والطاقة كالساعة الصحيحة",Object.keys(R.native.st).every(k=>k==="ok")&&!Object.keys(R.native.q).length&&R.native.streak===ok.streak&&R.native.energy===ok.energy,R.native);
 P("مرساة الهاتف: لا مكسب",R.native.xp<=ok.xp&&R.native.gems<=ok.gems,R.native);
 out.push("INFO clockMulti: الفرق في عدد المراجعات والمحطات عن الساعة الصحيحة من الجهاز نفسه: حين أشارت ساعته إلى يوم آخر رفض التطبيق بعض الأعمال محليًا فلم تُرسل (لا علاقة للخادم)");
 for(const [m,n] of [["plain","بلا مرساة"],["page","مرساة الصفحة"]]){const r=R[m];
  P(n+": لا مكسب (الخبرة والجواهر والسلسلة والمراجعات والمحطات لا تزيد على الساعة الصحيحة)",r.xp<=ok.xp&&r.gems<=ok.gems&&r.streak<=ok.streak&&r.reviews<=ok.reviews&&r.stations<=ok.stations,r);
  P(n+": لا ضياع صامت (كل حدث له حالة: مقبول أو متأخّر أو في الحجر)",Object.values(r.st).reduce((a,b)=>a+b,0)>0,r.st)}}
fs.writeFileSync(w+"/e_clockMulti.out",out.join("\n")+"\n")' "$W"
E2="$E2 clockMulti"
E2="$E2 forwardClock"
{ for s in $SC; do node -e '
const fs=require("fs"),[,w,s]=process.argv,rd=m=>{try{return JSON.parse(fs.readFileSync(`${w}/${s}.${m}.json`,"utf8"))}catch(e){return null}};
const c=rd("ctrl"),t=rd("test");if(!c||!t){console.log(`FAIL ${s}: لم يكتمل التشغيل (انظر ${w}/${s}.*.err)`);process.exit()}
const P=(n,ok,x)=>console.log((ok?"PASS ":"FAIL ")+s+": "+n+(x!==undefined?" → "+x:""));
const off=s.startsWith("offline");
const keys={clockAhead:["reviewsAdded","xpAdded"],clockBack:["reviewsAdded","xpAdded"],twoDevices:["xp","gems","streak","reviews","words"],
 offline8:["xp","streak","reviews","words","quizzes","stations"],offline30:["xp","streak","reviews","words","quizzes","stations"],resend:["xp","gems","quizzes","stations","words","energy"],doubleStart:["energySpent"],lateSame:[]}[s];
console.log(`INFO ${s}: الضابط ${JSON.stringify(c)}`);console.log(`INFO ${s}: الاختبار ${JSON.stringify(t)}`);
P("لا ضياع صامت (لكل حدث حالة من الخادم)",!t.st.silent&&!c.st.silent,t.st.silent);
P("الضابط بلا حجر",c.st.q===0,JSON.stringify(c.st.qWhy));
if(off){P("الحجر = ما تجاوز مدّة قبوله فقط («old»)، ومراجعات كلمات محطات في الحجر («word»)، بالعدد المتوقَّع",
   (t.st.qWhy.old||0)===t.st.expOld&&(t.st.qWhy.word||0)===t.st.expWord&&t.st.q===t.st.expOld+t.st.expWord,JSON.stringify(t.st.qWhy)+" / متوقَّع old "+t.st.expOld+" وword "+t.st.expWord);
 P("الجواهر: الفرق عن الضابط كله من جوائز الدوري (أسابيع لم يكن فيها متصلًا)، والمحطات وبقية المصادر مطابقة",c.gStations===t.gStations&&c.gOther===t.gOther&&c.gems-t.gems===c.gLeague-t.gLeague,
   `الضابط ${c.gems} (دوري ${c.gLeague} في ${c.lgWeeks} أسابيع) والاختبار ${t.gems} (دوري ${t.gLeague} في ${t.lgWeeks})`)}
else P("لا حجر",t.st.q===0,JSON.stringify(t.st.qWhy));
if(s==="lateSame"){P("المراجعة المتأخّرة: حالتها «late»، ولا خبرة، ولا مراجعة محسوبة، والكلمة كما هي، والحدث محفوظ",t.st.late===1&&t.xpAfter===t.xpBefore&&t.reviewsAfter===t.reviewsBefore&&t.wordSame&&t.lateKept,JSON.stringify({late:t.st.late,xp:[t.xpBefore,t.xpAfter],rv:[t.reviewsBefore,t.reviewsAfter],word:t.wordSame,kept:t.lateKept}))}
if(s==="resend")P("إعادة الإرسال: كل الدفعة المعادة عُرفت «وصلت سابقًا»",t.st.dup===t.st.resent&&t.st.resent>0,t.st.dup+" / "+t.st.resent);
const diff=keys.filter(k=>JSON.stringify(c[k])!==JSON.stringify(t[k]));
if(keys.length)P("مطابق للضابط في "+keys.join("، "),!diff.length,diff.map(k=>k+" "+c[k]+"←"+t[k]).join("، ")||"")' "$W" $s; done; for c in $EC $E2; do cat "$W/e_$c.out"; grep -q "^PASS" "$W/e_$c.out" || echo "FAIL $c: لا نتائج"; done; echo __END; } | verdict
