#!/bin/bash
# بوّابة الأخطاء في محرّك Cloudflare الحقيقي محليًا (Miniflare/workerd). تحتاج Miniflare مثبّتًا في ~/.cache/muf-miniflare:
#   mkdir -p ~/.cache/muf-miniflare && cd ~/.cache/muf-miniflare && npm init -y && npm i miniflare@4
# إن لم يكن مثبّتًا: «لم تُشغَّل» (لا تُعدّ نجاحًا). المدة نحو دقيقتين (منبّهان حقيقيان).
D=$(cd "$(dirname "$0")" && pwd); . "$D/../lib.sh"
M=${MF_DIR:-$HOME/.cache/muf-miniflare}
[ -d "$M/node_modules/miniflare" ] || { echo "SKIP لا يوجد Miniflare في $M"; exit 3; }
{ node "$D/workerd.mjs" "$R/server/worker.js" "$M"; echo __END; } | verdict