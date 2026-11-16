#!/bin/bash
# «آخر ظهور»: شيفرة الخادم الحقيقية القديمة (main) والجديدة (هذا الفرع) مع قاعدة في الذاكرة. لا شبكة ولا مفاتيح.
set -e;D=$(cd "$(dirname "$0")" && pwd);R=$(cd "$D/../.." && pwd);W=$(mktemp -d)
git -C "$R" show origin/main:server/worker.js > "$W/w_old.mjs";cp "$R/server/worker.js" "$W/w_new.mjs"
git -C "$R" show origin/main:core.js > "$W/core_old.js";cp "$R/core.js" "$W/core_new.js"
cd "$D" && node seen.mjs "$W" "$R"
