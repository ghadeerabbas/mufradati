#!/bin/bash
# النسخة الاحتياطية: لقطة، تجربة، تحقق كامل، تنزيل، استرجاع إلى قاعدة فارغة — محلي، بحسابات وهمية
D=$(cd "$(dirname "$0")" && pwd); . "$D/../lib.sh"; W=$(mktemp -d)
B=$(base RELEASED); oldfile "$B" server/worker.js "$W/w_old.mjs"; cp "$R/server/worker.js" "$W/w_new.mjs"
oldfile "$B" core.js "$W/core_old.js"; cp "$R/core.js" "$W/core_new.js"
cp "$D/../integration/it.mjs" "$D/backup.mjs" "$W/"
{ same_note "$W/w_old.mjs" "$W/w_new.mjs" "$W/core_old.js" "$W/core_new.js"; cd "$W" && node backup.mjs "$W" "$R"; echo __END; } | verdict
