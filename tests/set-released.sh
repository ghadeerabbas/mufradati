#!/bin/bash
# يحدّث RELEASED في tests/BASE إلى نسخة منشورة فعلًا، بأمر صريح فقط. لا يُستدعى تلقائيًا من أي اختبار، ولا يودِع.
# الاستعمال: tests/set-released.sh <نسخة>   (يرفض أي نسخة تختلف ملفاتها عن آخر نشر ناجح)
D=$(cd "$(dirname "$0")" && pwd); . "$D/lib.sh"
[ -n "$1" ] || { echo "الاستعمال: tests/set-released.sh <نسخة>"; exit 1; }
NEW=$(git -C "$R" rev-parse --short=7 "$1^{commit}") || exit 1
OLD=$(grep -E '^RELEASED=' "$R/tests/BASE" | cut -d= -f2)
sed -i "s/^RELEASED=.*/RELEASED=$NEW/" "$R/tests/BASE"
if bash "$D/check-released.sh"; then echo "حُدِّث RELEASED: $OLD → $NEW (أودِعه في إيداع مستقل)"
else sed -i "s/^RELEASED=.*/RELEASED=$OLD/" "$R/tests/BASE"; echo "رُفض: $NEW لا يطابق المنشور، وبقي RELEASED=$OLD"; exit 1; fi
