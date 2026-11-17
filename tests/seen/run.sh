#!/bin/bash
# «آخر ظهور»: شيفرة الخادم الحقيقية القديمة (RELEASED) والجديدة (هذا الفرع) مع قاعدة في الذاكرة. لا شبكة ولا مفاتيح.
D=$(cd "$(dirname "$0")" && pwd); . "$D/../lib.sh"; W=$(mktemp -d)
B=$(base RELEASED); oldfile "$B" server/worker.js "$W/w_old.mjs"; cp "$R/server/worker.js" "$W/w_new.mjs"
oldfile "$B" core.js "$W/core_old.js"; cp "$R/core.js" "$W/core_new.js"
{ same_note "$W/w_old.mjs" "$W/w_new.mjs" "$W/core_old.js" "$W/core_new.js"; cd "$D" && node seen.mjs "$W" "$R"; } | verdict
