#!/bin/bash
# اختبار تكامل محلي: شيفرة الخادم الحقيقية (المنشورة RELEASED والحالية) مع قاعدة بيانات في الذاكرة. لا شبكة ولا مفاتيح حقيقية.
D=$(cd "$(dirname "$0")" && pwd); . "$D/../lib.sh"; W=$(mktemp -d)
B=$(base RELEASED); oldfile "$B" server/worker.js "$W/w_old.mjs"; cp "$R/server/worker.js" "$W/w_new.mjs"
oldfile "$B" core.js "$W/core_old.js"; cp "$R/core.js" "$W/core_new.js"
{ same_note "$W/w_old.mjs" "$W/w_new.mjs" "$W/core_old.js" "$W/core_new.js"; cd "$D" && node scen.mjs "$W" "$R"; } | verdict
