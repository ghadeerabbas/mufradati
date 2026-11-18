#!/bin/bash
# المصادقة: الخادم المنشور (RELEASED) مقابل الحالي. قاعدة في الذاكرة ومفاتيح تجريبية، لا شبكة.
D=$(cd "$(dirname "$0")" && pwd); . "$D/../lib.sh"; W=$(mktemp -d)
B=$(base RELEASED); oldfile "$B" server/worker.js "$W/w_old.mjs"; cp "$R/server/worker.js" "$W/w_new.mjs"
oldfile "$B" core.js "$W/core_old.js"; cp "$R/core.js" "$W/core_new.js"
cp "$D/../integration/it.mjs" "$D/auth.mjs" "$W/"
{ cd "$W" && node auth.mjs "$W" "$R"; echo __END; } | verdict
