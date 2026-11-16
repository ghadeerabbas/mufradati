#!/bin/bash
# الاستعمال: bash tests/backup-diff/inspect.sh نسخة1.json.gz [نسخة2.json.gz]
set -e;D=$(cd "$(dirname "$0")" && pwd);R=$(cd "$D/../.." && pwd);W=$(mktemp -d)
cp "$R/server/worker.js" "$W/w_old.mjs";cp "$R/server/worker.js" "$W/w_new.mjs";cp "$R/core.js" "$W/core_old.js";cp "$R/core.js" "$W/core_new.js"
F=();for f in "$@";do F+=("$(cd "$(dirname "$f")" && pwd)/$(basename "$f")");done
cd "$D" && node inspect.mjs "$W" "$R" "${F[@]}"
