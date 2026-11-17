#!/bin/bash
# رقم النسخة في الخادم: الخادم الحالي، وخادم ما قبل رقم النسخة (PRE_VER) للتوافق. قاعدة في الذاكرة، لا شبكة ولا مفاتيح.
D=$(cd "$(dirname "$0")" && pwd); . "$D/../lib.sh"; W=$(mktemp -d)
B=$(base PRE_VER); oldfile "$B" server/worker.js "$W/w_old.mjs"; cp "$R/server/worker.js" "$W/w_new.mjs"
oldfile "$B" core.js "$W/core_old.js"; cp "$R/core.js" "$W/core_new.js"
! grep -q "CORE_V" "$W/w_old.mjs" || { echo "FAIL PRE_VER=$B فيه رقم النسخة: ليس خادمًا قديمًا"; exit 1; }
cp "$D/../integration/it.mjs" "$D/server.mjs" "$W/"
{ echo "== الخادم القديم: $B"; cd "$W" && node server.mjs "$W" "$R"; } | verdict
