#!/bin/bash
# حماية /err: بوّابة الأخطاء والتنقية. شيفرة الخادم الحقيقية، وكائن دائم مُحاكى بـSQLite، وقاعدة في الذاكرة. لا شبكة ولا مفاتيح.
D=$(cd "$(dirname "$0")" && pwd); . "$D/../lib.sh"; W=$(mktemp -d)
cp "$R/server/worker.js" "$W/w_new.mjs"; cp "$R/server/worker.js" "$W/w_old.mjs"; cp "$R/core.js" "$W/core_new.js"; cp "$R/core.js" "$W/core_old.js"
cp "$D/../integration/it.mjs" "$D/dostub.mjs" "$D/gate.mjs" "$W/"
{ node "$D/sanitize.mjs" "$R/server/worker.js"; cd "$W" && node --no-warnings gate.mjs "$W" "$R"; } | verdict
