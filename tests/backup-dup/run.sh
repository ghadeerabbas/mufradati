#!/bin/bash
# «نسخة الآن» لا تتكرّر: الخادم المنشور (RELEASED) والحالي، تخزين النسخ وقاعدة البيانات في الذاكرة. لا شبكة ولا مفاتيح.
D=$(cd "$(dirname "$0")" && pwd); . "$D/../lib.sh"; W=$(mktemp -d)
B=$(base RELEASED)
git -C "$R" show "$B:server/worker.js" | sed 's/^async function exportAll(env) {$/async function exportAll(env) { if (env.__export) return env.__export();   \/\/ للاختبار فقط: نفس الخادم مع قاعدة في الذاكرة/' > "$W/w_old.mjs";grep -q "env.__export" "$W/w_old.mjs";cp "$R/server/worker.js" "$W/w_new.mjs"
oldfile "$B" core.js "$W/core_old.js";cp "$R/core.js" "$W/core_new.js"
git -C "$R" show "$B:server/worker.js" > "$W/w_old_raw.mjs"
{ same_note "$W/w_old_raw.mjs" "$W/w_new.mjs" "$W/core_old.js" "$W/core_new.js"; cd "$D" && node dup.mjs "$W" "$R"; echo __END; } | verdict
