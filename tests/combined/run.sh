#!/bin/bash
set -e;D=$(cd "$(dirname "$0")" && pwd);R=$(cd "$D/../.." && pwd);W=$(mktemp -d)
git -C "$R" show origin/main:core.js > "$W/old.js";node "$D/combined.js" "$R" "$W/old.js" "$R/core.js"
