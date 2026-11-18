#!/bin/bash
# فحص مفتاح النطق (tts-check.sh) مع خادم مزيّف محلي: رموز الردّ، وعدم طباعة المفتاح أو المنطقة، وعدم ترك ملفات. لا شبكة.
D=$(cd "$(dirname "$0")" && pwd); . "$D/../lib.sh"; S="$R/.github/scripts/tts-check.sh"; W=$(mktemp -d); P=$((20000+RANDOM%20000))
python3 "$D/fake.py" $P "$W/req.log" & FP=$!; trap 'kill $FP 2>/dev/null; rm -rf "$W"' EXIT; sleep 1
run(){ local rc=0; (cd "$W" && AZURE_SPEECH_KEY="$1" AZURE_SPEECH_REGION="$2" TTS_URL="${3-http://127.0.0.1:$P/v1}" bash "$S") >"$W/o" 2>&1 || rc=$?; echo $rc >"$W/rc"; }
chk(){ local n="$1" key="$2" reg="$3" want="$4" pat="$5" url="${6-}"; if [ -n "$url" ]; then run "$key" "$reg" "$url"; else run "$key" "$reg"; fi
  local rc=$(cat "$W/rc") o=$(cat "$W/o")
  if [ "$rc" = "$want" ] && grep -q -- "$pat" "$W/o"; then echo "PASS $n → $o"; else echo "FAIL $n → rc=$rc: $o"; fi
  local k1; k1=$(printf %s "$key" | tr -d "[:space:]"); if [ -n "$k1" ] && grep -qF -- "$k1" "$W/o"; then echo "FAIL $n: المفتاح ظهر في المخرجات"; fi
  if grep -qF -- "$reg" "$W/o" && [ ${#reg} -gt 3 ]; then echo "FAIL $n: المنطقة ظهرت في المخرجات"; fi; }
{
chk "مفتاح صالح: نجاح" good westeurope 0 "نجاح"
chk "مفتاح مرفوض: 401" bad westeurope 1 "401"
chk "مورد معطّل: 403" off westeurope 1 "403"
chk "طلبات كثيرة: 429" busy westeurope 1 "429"
chk "200 بصوت صغير: فشل" tiny westeurope 1 "صغير"
chk "مفتاح فارغ: فشل دون طلب" "" westeurope 1 "فارغ"
chk "مسافات حول المفتاح تُحذف" " good
" westeurope 0 "نجاح"
chk "منطقة بأحرف كبيرة ومسافة تُصحَّح" good " WestEurope " 0 "نجاح"
chk "منطقة غير صالحة: فشل دون طلب" good "west europe!" 1 "ليست اسم منطقة"
chk "خدمة لا يُوصل إليها: 000" good westeurope 1 "تعذّر الوصول" "http://127.0.0.1:1/v1"
n=$(wc -l < "$W/req.log"); [ "$n" = 7 ] && echo "PASS طلب واحد لكل فحص وصل إلى الخادم المزيّف (7)، ولا طلب للمفتاح الفارغ أو المنطقة الخاطئة → $n" || echo "FAIL عدد الطلبات $n (المتوقع 7)"
[ -z "$(ls -A "$W" | grep -vE '^(o|rc|req.log)$')" ] && echo "PASS لا ملفات صوت متروكة" || echo "FAIL ملفات متروكة: $(ls "$W")"
y="$R/.github/workflows/tts-check.yml"
grep -qE '^  workflow_dispatch:' "$y" && ! grep -qE '^\s+(push|schedule|pull_request|workflow_run):' "$y" && echo "PASS سير العمل يدوي فقط" || echo "FAIL سير العمل ليس يدويًا فقط"
grep -qE 'contents: read' "$y" && ! grep -q 'write' "$y" && echo "PASS صلاحية قراءة فقط (لا رفع)" || echo "FAIL صلاحيات أوسع من القراءة"
! grep -qE 'git (push|commit)|wrangler|deploy' "$y" "$S" && echo "PASS لا رفع ولا نشر في الفحص" || echo "FAIL فيه رفع أو نشر"
git -C "$R" diff --quiet 1ad0a68 -- .github/workflows/tts.yml .github/scripts/tts.py && echo "PASS Pronunciation audio دون تغيير" || echo "FAIL تغيّر Pronunciation audio"
echo __END; } | verdict
