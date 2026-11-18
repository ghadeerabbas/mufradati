#!/bin/bash
# اختبار محلي فقط: core.js المنشور (RELEASED) مقابل الحالي
D=$(cd "$(dirname "$0")" && pwd); . "$D/../lib.sh"; W=$(mktemp -d)
B=$(base RELEASED); oldfile "$B" core.js "$W/old.js"
{ same_note "$W/old.js" "$R/core.js"; node "$D/perf.js" "$R" "$W/old.js" "$R/core.js"; echo __END; } | verdict
