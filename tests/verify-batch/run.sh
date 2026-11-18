#!/bin/bash
# «تحقق كامل» بالقراءة المجمّعة: makeFS الحقيقية مع Firestore مزيّفة عبر REST، وعدّ الطلبات الفرعية. المقارنة بالخادم الذي سبق الإصلاح (681a513، ثابت عمدًا: بعد نشر الإصلاح صار RELEASED يحتويه فلا يبقى فرق يُقاس). لا شبكة، بيانات اصطناعية.
D=$(cd "$(dirname "$0")" && pwd); . "$D/../lib.sh"; W=$(mktemp -d)
B=681a513; oldfile "$B" server/worker.js "$W/w_old.mjs"; cp "$R/server/worker.js" "$W/w_new.mjs"
{ cd "$D" && node vb.mjs "$W/w_old.mjs" "$W/w_new.mjs"; echo __END; } | verdict
