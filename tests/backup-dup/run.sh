#!/bin/bash
# «نسخة الآن» لا تتكرّر: الخادم الحالي (main) والجديد (هذا الفرع)، تخزين النسخ وقاعدة البيانات في الذاكرة. لا شبكة ولا مفاتيح.
set -e;D=$(cd "$(dirname "$0")" && pwd);R=$(cd "$D/../.." && pwd);W=$(mktemp -d)
git -C "$R" show origin/main:server/worker.js | sed 's/^async function exportAll(env) {$/async function exportAll(env) { if (env.__export) return env.__export();   \/\/ للاختبار فقط: نفس الخادم الحالي مع قاعدة في الذاكرة/' > "$W/w_old.mjs";grep -q "env.__export" "$W/w_old.mjs";cp "$R/server/worker.js" "$W/w_new.mjs"
git -C "$R" show origin/main:core.js > "$W/core_old.js";cp "$R/core.js" "$W/core_new.js"
cd "$D" && node dup.mjs "$W" "$R"
