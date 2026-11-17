#!/bin/bash
# دوال مشتركة لسكربتات الاختبار. تُستدعى بـ: . "$D/../lib.sh"
set -eo pipefail
R=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

# قراءة نسخة مرجعية من tests/BASE (أو من متغيّر بالاسم نفسه إن وُضع عند التشغيل)
base(){ local n=$1 v; v=${!n:-$(grep -E "^$n=" "$R/tests/BASE" | cut -d= -f2)}
  [ -n "$v" ] || { echo "FAIL لا توجد قيمة $n في tests/BASE" >&2; exit 1; }
  git -C "$R" rev-parse -q --verify "$v^{commit}" >/dev/null || { echo "FAIL النسخة $n=$v غير موجودة في المستودع" >&2; exit 1; }
  git -C "$R" merge-base --is-ancestor "$v" HEAD || echo "تنبيه: $n=$v ليست ضمن تاريخ هذا الفرع" >&2
  echo "$v"; }

# ملف من نسخة مرجعية: oldfile REV path out
oldfile(){ git -C "$R" show "$1:$2" > "$3"; }

# هل القديم مطابق للجديد؟ عندها فحوص التوافق بين الإصدارين لا تختبر شيئًا: يُعلَن ذلك صراحة ولا يُحسب نجاحًا للمقارنة
same_note(){ local same=1 a b; while [ $# -ge 2 ]; do cmp -s "$1" "$2" || same=0; shift 2; done
  if [ $same = 1 ]; then echo "NOCMP القديمة (RELEASED) مطابقة للجديدة: فحوص «قديم مقابل جديد» هنا لا تقارن شيئًا، والفحوص المطلقة وحدها ذات معنى"; fi; }

# الحكم: يمرّر المخرجات كما هي، ويفشل إن وُجد سطر FAIL أو لم يوجد أي PASS (تشغيل فارغ لا يُعدّ نجاحًا)
verdict(){ awk '{print} /^FAIL/{f++} /^PASS/{p++} END{ if(f>0){print "== النتيجة: فشل ("f" فحص)";exit 1} if(!p){print "== النتيجة: فشل (لم يُنفَّذ أي فحص)";exit 1} print "== النتيجة: نجاح ("p" فحص)" }'; }
