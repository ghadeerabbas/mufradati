#!/bin/bash
# التراجع من release-1 إلى هذا الفرع (R1) ثم العودة، بعد بدء الطيّ: لا يضيع شيء. محلي.
set -e;D=$(cd "$(dirname "$0")" && pwd);R=$(cd "$D/../.." && pwd);W=$(mktemp -d)
cp "$R/server/worker.js" "$W/w_old.mjs";REL=$(git -C "$R" rev-parse -q --verify origin/release-1 || git -C "$R" rev-parse release-1);git -C "$R" show $REL:server/worker.js > "$W/w_new.mjs"
cp "$R/core.js" "$W/core_old.js";git -C "$R" show $REL:core.js > "$W/core_new.js"
cp "$D/../integration/it.mjs" "$D/rollback.mjs" "$W/";cd "$W" && node rollback.mjs "$W" "$R"
