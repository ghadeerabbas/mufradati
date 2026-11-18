#!/bin/bash
# نقطة الحفظ بشيفرة الخادم الحقيقية: القديم = PRE_FOLD (قبل الطيّ)، والجديد = الحالي. قاعدة في الذاكرة، لا شبكة ولا مفاتيح.
D=$(cd "$(dirname "$0")" && pwd); . "$D/../lib.sh"; W=$(mktemp -d)
B=$(base PRE_FOLD); oldfile "$B" server/worker.js "$W/w_old.mjs"; cp "$R/server/worker.js" "$W/w_new.mjs"
oldfile "$B" core.js "$W/core_old.js"; cp "$R/core.js" "$W/core_new.js"
cp "$D/../integration/it.mjs" "$D/integration.mjs" "$D/log-at-cap-bug.mjs" "$W/"
{ echo "== المرجع: $B"; cd "$W" && node integration.mjs "$W" "$R" && node log-at-cap-bug.mjs "$W" "$R"; echo __END; } | verdict
