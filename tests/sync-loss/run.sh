#!/bin/bash
# ضياع المراجعات وتكرارها عند المزامنة: شيفرة الخادم الحقيقية الحالية مع قاعدة بيانات في الذاكرة. لا شبكة ولا مفاتيح.
# كل سيناريو يُشغَّل مرتين في عمليتين مستقلتين: «ضابط» (جهاز واحد متصل يفعل الأحداث نفسها) و«اختبار» (الحالة الصعبة)،
# والشرط أن تطابق النتيجة الضابط: صفر ضياع صامت، وصفر تكرار.
# على main قبل إصلاح المزامنة تفشل هذه المجموعة عمدًا (توثّق العيوب)، ولذلك لا تدخل run-all.sh قبل الإصلاح.
D=$(cd "$(dirname "$0")" && pwd); . "$D/../lib.sh"; W=$(mktemp -d)
cp "$R/server/worker.js" "$W/w_old.mjs"; cp "$R/server/worker.js" "$W/w_new.mjs"; cp "$R/core.js" "$W/core_old.js"; cp "$R/core.js" "$W/core_new.js"
SC="clockAhead clockBack twoDevices offline8 offline30 resend doubleStart"
for s in $SC; do for m in ctrl test; do (cd "$D" && node scen.mjs "$W" "$R" $s $m > "$W/$s.$m.json" 2> "$W/$s.$m.err") & done; done; wait
{ for s in $SC; do node -e '
const fs=require("fs"),[,w,s]=process.argv,rd=m=>{try{return JSON.parse(fs.readFileSync(`${w}/${s}.${m}.json`,"utf8"))}catch(e){return null}};
const c=rd("ctrl"),t=rd("test");if(!c||!t){console.log(`FAIL ${s}: لم يكتمل التشغيل (انظر ${w}/${s}.*.err)`);process.exit()}
const keys={clockAhead:["rejected","reviewsAdded","xpAdded"],clockBack:["rejected","reviewsAdded","xpAdded"],
 twoDevices:["rejected","xp","gems","streak","reviews","words"],offline8:["rejected","xp","gems","streak","reviews","words"],offline30:["rejected","xp","gems","streak","reviews","words"],
 resend:["xp","gems","quizzes","stations","words","energy"],doubleStart:["energySpent"]}[s];
const diff=keys.filter(k=>JSON.stringify(c[k])!==JSON.stringify(t[k]));
console.log(`INFO ${s}: الضابط ${JSON.stringify(c)}`);console.log(`INFO ${s}: الاختبار ${JSON.stringify(t)}`);
console.log(diff.length?`FAIL ${s}: يختلف عن الضابط في ${diff.map(k=>k+" "+c[k]+"←"+t[k]).join("، ")}`:`PASS ${s}: مطابق للضابط`)' "$W" $s; done; echo __END; } | verdict
