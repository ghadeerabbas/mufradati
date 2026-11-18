#!/bin/bash
# يشغّل كل الاختبارات الآلية ويطبع ملخّصًا. لا شبكة (عدا قراءة سجل النشر من GitHub) ولا مفاتيح ولا بيانات حقيقية.
# الاستعمال: tests/run-all.sh        السجلات الكاملة في مجلد مؤقت يُطبع مساره
# الخروج: 0 كل شيء نجح · 1 فشل فحص أو RELEASED قديم · 2 بعض المجموعات لم تُشغَّل (لا يُعدّ نجاحًا)
D=$(cd "$(dirname "$0")" && pwd); L=$(mktemp -d); bad=0; skip=0; nocmp=""
SUITES="golden rewards checkpoint checkpoint-it:checkpoint/run-it.sh combined perf integration seen stage0 backup backup-dup backup-diff browser auth"
echo "== هل RELEASED هو المنشور فعلًا؟"
if bash "$D/check-released.sh" > "$L/released.log" 2>&1; then rel="مطابق"; else rel="قديم أو غير صحيح"; bad=$((bad+1)); fi; cat "$L/released.log"; echo
printf '%-14s %-28s %s\n' "المجموعة" "الحالة" "ناجح · فاشل · معلومات · المدة"
for x in $SUITES; do s=${x%%:*}; f=${x#*:}; [ "$f" = "$x" ] && f="$s/run.sh"; t0=$(date +%s)
  bash "$D/$f" > "$L/$s.log" 2>&1; rc=$?
  p=$(grep -c '^PASS' "$L/$s.log"); fl=$(grep -c '^FAIL' "$L/$s.log"); i=$(grep -c '^INFO' "$L/$s.log")
  if [ $rc = 3 ]; then st="لم تُشغَّل"; skip=$((skip+1))
  elif [ $rc != 0 ]; then st="فشل"; bad=$((bad+1))
  elif grep -q '^NOCMP' "$L/$s.log"; then st="نجاح، المقارنة غير فعّالة"; nocmp="$nocmp $s"
  else st="نجاح"; fi
  printf '%-14s %-28s %s\n' "$s" "$st" "$p · $fl · $i · $(( $(date +%s)-t0 )) ث"
done
echo; echo "RELEASED: $rel · السجلات: $L"
[ -n "$nocmp" ] && echo "المقارنة غير فعّالة في:$nocmp — النسخة المنشورة مطابقة للحالية فلا يوجد ما يُقارَن؛ فحوصها المطلقة وحدها ذات معنى. متوقَّع على main، وليس فشلًا."
grep -h '^SKIP' "$L"/*.log 2>/dev/null | sed 's/^SKIP /لم تُشغَّل: /'
if [ $bad -gt 0 ]; then echo "== فشل: $bad"; exit 1; elif [ $skip -gt 0 ]; then echo "== غير مكتمل: $skip مجموعة لم تُشغَّل"; exit 2; else echo "== كل المجموعات نجحت"; fi
