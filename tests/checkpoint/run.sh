#!/bin/bash
# اختبار محلي فقط. الاستعمال: run.sh [عدد السنوات، الافتراضي 10]
# المرجع = نسخة ما قبل نقطة الحفظ (PRE_FOLD) بلا حدّ للسجل، والجديد = core.js الحالي
D=$(cd "$(dirname "$0")" && pwd); . "$D/../lib.sh"; W=$(mktemp -d)
B=$(base PRE_FOLD); oldfile "$B" core.js "$W/old.js"
{ echo "== المرجع: $B بلا حدّ للسجل"; node --max-old-space-size=4096 "$D/sim.js" "$R" "$W/old.js" "$R/core.js" "${1:-10}"; } | verdict
