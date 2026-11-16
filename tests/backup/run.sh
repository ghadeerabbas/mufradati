#!/bin/bash
# النسخة الاحتياطية: لقطة، تجربة، تحقق كامل، تنزيل، استرجاع إلى قاعدة فارغة — محلي، بحسابات وهمية
set -e;D=$(cd "$(dirname "$0")" && pwd);R=$(cd "$D/../.." && pwd);W=$(mktemp -d)
git -C "$R" show origin/main:server/worker.js > "$W/w_old.mjs";cp "$R/server/worker.js" "$W/w_new.mjs"
git -C "$R" show origin/main:core.js > "$W/core_old.js";cp "$R/core.js" "$W/core_new.js"
cp "$D/../integration/it.mjs" "$D/backup.mjs" "$W/";cd "$W" && node backup.mjs "$W" "$R"
