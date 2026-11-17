#!/bin/bash
# نتائج متوقَّعة ثابتة لـcore.js الحالي، بلا مقارنة بنسخة أخرى
D=$(cd "$(dirname "$0")" && pwd); . "$D/../lib.sh"
node "$D/golden.js" "$R/core.js" | verdict
