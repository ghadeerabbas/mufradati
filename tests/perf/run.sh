#!/bin/bash
# اختبار محلي فقط
set -e;D=$(cd "$(dirname "$0")" && pwd);R=$(cd "$D/../.." && pwd);W=$(mktemp -d)
git -C "$R" show origin/main:core.js > "$W/old.js";node "$D/perf.js" "$R" "$W/old.js" "$R/core.js"
