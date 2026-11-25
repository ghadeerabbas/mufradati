#!/bin/bash
# البيئة التجريبية: الخادم يتوقّف عند أي نقص أو إشارة إلى الإنتاج، ومولّد الصفحة لا يترك أي قيمة إنتاج. لا شبكة.
D=$(cd "$(dirname "$0")" && pwd); . "$D/../lib.sh"; W=$(mktemp -d); cp "$R/server/worker.js" "$W/w.mjs"
printf '%s' '{"firebase":{"apiKey":"stgkey1","authDomain":"mufradati-stg.firebaseapp.com","projectId":"mufradati-stg","storageBucket":"s","messagingSenderId":"1234","appId":"1:1234:web:abc"},"api":"https://mufradati-api-stg.example-stg.workers.dev","origin":"https://mufradati-stg.pages.dev","admin":"admin@mufradati.app"}' > "$W/c.json"
{ node "$D/env.mjs" "$W/w.mjs"; python3 "$D/gen-test.py" "$R"; python3 "$R/tools/staging.py" "$W/c.json" "$W/out" >/dev/null && python3 "$D/page-guard.py" "$W/out" || echo "FAIL الصفحة التجريبية: تعذّر التوليد أو الفحص"; bash "$D/deploy-check.sh"; echo __END; } | verdict
