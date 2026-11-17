#!/bin/bash
# هل RELEASED في tests/BASE هو فعلًا آخر ما نُشر؟ لا يغيّر شيئًا: يكشف فقط.
# المنشور يُعرف من سجل GitHub Actions: آخر نشر ناجح للموقع (pages-build-deployment) وللخادم (نشر الخادم) من main.
# إن تعذّر الوصول إليه يُستعمل origin/main تقديرًا، مع تنبيه.
# الخروج: 0 مطابق · 1 RELEASED قديم أو يشير إلى نسخة غير منشورة
D=$(cd "$(dirname "$0")" && pwd); . "$D/lib.sh"
REL=$(base RELEASED); REL=$(git -C "$R" rev-parse "$REL")
git -C "$R" fetch -q origin main 2>/dev/null || echo "تنبيه: تعذّر تحديث origin/main، أستعمل النسخة المحلية منه"
last_ok(){ command -v gh >/dev/null || return 1
  gh run list -R ghadeerabbas/mufradati -b main -L 60 --json headSha,workflowName,conclusion,createdAt \
   --jq "[.[]|select(.workflowName==\"$1\" and .conclusion==\"success\")][0]|.headSha+\" \"+.createdAt" 2>/dev/null | grep -E '^[0-9a-f]{40} ' ; }
SITE=$(last_ok pages-build-deployment) && SRC="سجل النشر" || { SITE="$(git -C "$R" rev-parse origin/main) ?"; SRC="origin/main (تقدير: سجل النشر غير متاح)"; }
WRK=$(last_ok "نشر الخادم") || WRK="$(git -C "$R" rev-parse origin/main) ?"
S=${SITE%% *}; Wk=${WRK%% *}
echo "RELEASED=${REL:0:7} · الموقع المنشور ${S:0:7} (${SITE#* }) · الخادم المنشور ${Wk:0:7} (${WRK#* }) · المصدر: $SRC"
bad=0
# 1) RELEASED يجب أن يكون ضمن main المنشور، لا نسخة من فرع غير مدموج
git -C "$R" merge-base --is-ancestor "$REL" "$S" || { echo "FAIL RELEASED=${REL:0:7} ليس ضمن الموقع المنشور: يشير إلى نسخة غير منشورة"; bad=1; }
# 2) ملفات التطبيق في RELEASED = المنشور فعلًا (الموقع والخادم كلٌّ من آخر نشر ناجح له)
for f in index.html core.js sw.js; do
  [ "$(git -C "$R" rev-parse "$REL:$f" 2>/dev/null)" = "$(git -C "$R" rev-parse "$S:$f" 2>/dev/null)" ] || { echo "FAIL $f في RELEASED يختلف عن الموقع المنشور (${S:0:7})"; bad=1; }; done
[ "$(git -C "$R" rev-parse "$REL:server/worker.js")" = "$(git -C "$R" rev-parse "$Wk:server/worker.js")" ] || { echo "FAIL server/worker.js في RELEASED يختلف عن الخادم المنشور (${Wk:0:7})"; bad=1; }
if [ $bad = 1 ]; then echo "== RELEASED قديم أو غير صحيح. بعد التأكد من نجاح النشر، حدّثه يدويًا بـ: tests/set-released.sh ${S:0:7}"; exit 1; fi
echo "PASS RELEASED مطابق للمنشور (الموقع والخادم)"
