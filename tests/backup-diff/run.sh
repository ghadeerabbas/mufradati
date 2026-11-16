#!/bin/bash
# فروق «تحقق كامل»: شيفرة الخادم الحالية (main) مع قاعدة وتخزين في الذاكرة. لا شبكة ولا مفاتيح ولا بيانات حقيقية.
set -e;D=$(cd "$(dirname "$0")" && pwd);R=$(cd "$D/../.." && pwd);W=$(mktemp -d)
cp "$R/server/worker.js" "$W/w_old.mjs";cp "$R/server/worker.js" "$W/w_new.mjs";cp "$R/core.js" "$W/core_old.js";cp "$R/core.js" "$W/core_new.js"
cd "$D" && node diff.mjs "$W" "$R"
