#!/bin/bash
# يشغّل كل اختبارات سطر الأوامر ويطبع ملخّصًا. لا شبكة ولا مفاتيح ولا بيانات حقيقية.
# الاستعمال: tests/run-all.sh   (السجلات الكاملة في مجلد مؤقت يُطبع مساره)
# اختبارات المتصفّح (stage0 وui-tweaks وbrowser*.js) لا تُشغَّل هنا: تحتاج المتصفّح المحاكي.
D=$(cd "$(dirname "$0")" && pwd); L=$(mktemp -d); bad=0
SUITES="golden rewards checkpoint combined perf integration seen backup backup-dup backup-diff"
printf '%-12s %-26s %s\n' "المجموعة" "الحالة" "الفحوص / المدة"
for s in $SUITES; do t0=$(date +%s)
  if bash "$D/$s/run.sh" > "$L/$s.log" 2>&1; then st="نجاح"; else st="فشل"; bad=$((bad+1)); fi
  p=$(grep -c '^PASS' "$L/$s.log" || true); f=$(grep -c '^FAIL' "$L/$s.log" || true)
  grep -q '^NOCMP' "$L/$s.log" && [ "$st" = "نجاح" ] && st="نجاح (المقارنة غير فعّالة)"
  printf '%-12s %-26s %s\n' "$s" "$st" "$p ناجح · $f فاشل · $(( $(date +%s)-t0 )) ث"
done
echo "السجلات: $L"
grep -l '^NOCMP' "$L"/*.log >/dev/null 2>&1 && echo "«المقارنة غير فعّالة»: النسخة المنشورة (RELEASED) مطابقة للحالية، فلا يوجد ما يُقارَن؛ هذا متوقَّع على main بعد النشر وليس فشلًا."
[ $bad = 0 ] && echo "== كل المجموعات نجحت" || { echo "== فشلت $bad مجموعة"; exit 1; }
