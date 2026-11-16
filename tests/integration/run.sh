#!/bin/bash
# اختبار تكامل محلي: شيفرة الخادم الحقيقية (القديمة من main والجديدة من هذا الفرع) مع قاعدة بيانات في الذاكرة. لا شبكة ولا مفاتيح حقيقية.
set -e;D=$(cd "$(dirname "$0")" && pwd);R=$(cd "$D/../.." && pwd);W=$(mktemp -d)
git -C "$R" show origin/main:server/worker.js > "$W/w_old.mjs";cp "$R/server/worker.js" "$W/w_new.mjs"
git -C "$R" show origin/main:core.js > "$W/core_old.js";cp "$R/core.js" "$W/core_new.js"
cd "$D" && node scen.mjs "$W" "$R"
