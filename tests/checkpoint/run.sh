#!/bin/bash
# اختبار محلي فقط. الاستعمال: run.sh [عدد السنوات، الافتراضي 10]
set -e;D=$(cd "$(dirname "$0")" && pwd);R=$(cd "$D/../.." && pwd);W=$(mktemp -d)
git -C "$R" show origin/main:core.js > "$W/old.js";node --max-old-space-size=4096 "$D/sim.js" "$R" "$W/old.js" "$R/core.js" "${1:-10}"
