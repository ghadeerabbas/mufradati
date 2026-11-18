#!/bin/bash
# المرحلة الأولى (التحقّق من التذكّر): اختبارات وحدة على core.js، وتكامل مع الخادم الحقيقي (الحالي والمنشور RELEASED) في الذاكرة. بيانات اصطناعية فقط، لا شبكة.
D=$(cd "$(dirname "$0")" && pwd); . "$D/../lib.sh"; W=$(mktemp -d)
B=$(base RELEASED); oldfile "$B" server/worker.js "$W/w_old.mjs"; cp "$R/server/worker.js" "$W/w_new.mjs"
oldfile "$B" core.js "$W/core_old.js"; cp "$R/core.js" "$W/core_new.js"
{ echo "== وحدة"; node "$D/unit.mjs" "$R/core.js" "$W/core_old.js"; echo "== تكامل"; cd "$D" && node scen.mjs "$W" "$R"; echo __END; } | verdict
