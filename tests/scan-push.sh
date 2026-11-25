#!/bin/bash
# الفحص الإلزامي قبل رفع فرع (لا رفع إن فشل أي جزء أو تعذّر تشغيله). الاستعمال: bash tests/scan-push.sh <الفرع المحلي> <الفرع البعيد، مثل claude/fix-sync-server>
#  1) كل ما يضيفه الفرع مقارنةً بـmain (origin/main...الفرع): يشمل كل محتوى الفرع غير المنشور في main، دون أي استثناء.
#  2) الإيداعات الجديدة منذ آخر رفع لهذا الفرع (origin/<البعيد>...الفرع): كلها تُفحص؛ ويُستثنى فقط ملف محتواه مطابق تمامًا لـorigin/main
#     (ملفات الأصوات والكلمات الآتية بتحديث الفرع من main، وهي منشورة أصلًا). ملف ثنائي جديد أو مختلف عن main يُفشل الفحص.
set -uo pipefail
L=${1:?"الفرع المحلي مطلوب"}; RB=${2:?"الفرع البعيد مطلوب"}; D=$(cd "$(dirname "$0")" && pwd); cd "$(git rev-parse --show-toplevel)"
git fetch -q origin main "+refs/heads/$RB:refs/remotes/origin/$RB" 2>/dev/null || git fetch -q origin main || { echo "فشل الفحص: تعذّر جلب origin/main"; exit 2; }
echo "== 1) كل محتوى الفرع مقارنةً بـmain"; bash "$D/secret-scan.sh" origin/main "$L" || { echo "== لا رفع"; exit 1; }
if git rev-parse -q --verify "origin/$RB^{commit}" >/dev/null; then echo "== 2) الإيداعات الجديدة منذ آخر رفع"
  SCAN_SAME_AS=origin/main bash "$D/secret-scan.sh" "origin/$RB" "$L" || { echo "== لا رفع"; exit 1; }
else echo "== 2) فرع جديد: الجزء 1 يغطّي كل إيداعاته"; fi
echo "== الفحص كله نظيف: يمكن الرفع"
