#!/bin/bash
# فحص الأسرار والبيانات الحساسة قبل أي رفع إلى GitHub (قاعدة إلزامية: لا رفع إن فشل الفحص أو تعذّر تشغيله).
# الاستعمال: bash tests/secret-scan.sh <المرجع الأساس> [المرجع المرفوع، افتراضيًا HEAD]
#   مثال: bash tests/secret-scan.sh origin/claude/fix-sync-server && git push …
# يفحص كل الأسطر المضافة بين الأساس والمرفوع، وأسماء الملفات، والملفات الثنائية. الخروج 0 = نظيف فقط.
set -euo pipefail
BASE=${1:?"المرجع الأساس مطلوب"}; HEAD_REF=${2:-HEAD}
cd "$(git rev-parse --show-toplevel)"
git rev-parse -q --verify "$BASE^{commit}" >/dev/null || { echo "فشل الفحص: المرجع الأساس $BASE غير موجود"; exit 2; }
git rev-parse -q --verify "$HEAD_REF^{commit}" >/dev/null || { echo "فشل الفحص: المرجع $HEAD_REF غير موجود"; exit 2; }
ADDED=$(git diff "$BASE" "$HEAD_REF" -U0 --no-color | grep '^+' | grep -v '^+++' || true)
FILES=$(git diff --name-only "$BASE" "$HEAD_REF")
[ -n "$FILES" ] || { echo "لا تغييرات بين $BASE و$HEAD_REF"; exit 0; }
bad=0; hit(){ echo "✗ $1"; echo "$2" | head -5 | cut -c1-160; bad=1; }
# مفاتيح ورموز معروفة الشكل
P_KEYS='AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{10,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|xox[abpr]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}|"private_key"\s*:|"client_email"\s*:\s*"[^"]+iam\.gserviceaccount\.com"'
x=$(echo "$ADDED" | grep -nE "$P_KEYS" || true); [ -z "$x" ] || hit "مفتاح أو رمز" "$x"
# كلمات مرور وأسرار مكتوبة قيمًا حرفية
x=$(echo "$ADDED" | grep -niE "(password|passwd|secret|api[_-]?key|token|KS_PASS|storepass)[\"']?\s*[:=]\s*[\"'][^\"' ]{8,}[\"']" | grep -viE "getIdToken|token\(|tok=|\\\$\{\{|secrets\.|process\.env|env\." || true); [ -z "$x" ] || hit "قيمة سرّ حرفية" "$x"
# بريد إلكتروني حقيقي (غير عناوين الاختبار والمشرف المعروفة في الشيفرة)
x=$(echo "$ADDED" | grep -noE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}" | grep -vE "@(mufradati\.app|anthropic\.com|example\.(com|org)|users\.noreply\.github\.com)$|noreply@" || true); [ -z "$x" ] || hit "بريد إلكتروني" "$x"
# معرّفات حسابات Firebase الحقيقية (28 محرفًا) ومعرّفات Cloudflare (32 ستّ عشري) غير المعروفة في المستودع
x=$(echo "$ADDED" | grep -noE "\b[A-Za-z0-9]{28}\b" | grep -E "[A-Z]" | grep -E "[a-z]" | grep -E "[0-9]" || true); [ -z "$x" ] || hit "يشبه معرّف حساب Firebase" "$x"
# ملفات لا تُرفع: نسخ احتياطية، ومفاتيح، وبيانات مستخدمين مصدَّرة، وملفات ثنائية
x=$(echo "$FILES" | grep -iE "\.(p12|jks|keystore|pem|key|gz|zip|sqlite|db|bak)$|backup|bak-|export|dump|\.env|credentials|service.?account" || true); [ -z "$x" ] || hit "اسم ملف حساس" "$x"
x=$(git diff --numstat "$BASE" "$HEAD_REF" | awk '$1=="-"{print $3}'); [ -z "$x" ] || hit "ملف ثنائي" "$x"
if [ $bad = 1 ]; then echo "== فشل فحص الأسرار: لا رفع"; exit 1; fi
echo "== فحص الأسرار نظيف: $(echo "$FILES" | wc -l) ملفًا، $(echo "$ADDED" | wc -l) سطرًا مضافًا"
