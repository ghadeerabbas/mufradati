#!/bin/bash
# نشر الخادم التجريبي وحده (بعد موافقة صاحب المشروع). يرفض قبل أي اتصال إن كان الإعداد ناقصًا أو يشير إلى الإنتاج.
# الاستعمال (من الحاسوب، بمفتاح Cloudflare للحساب التجريبي فقط): bash tools/deploy-staging.sh [--dry]
set -euo pipefail
cd "$(git rev-parse --show-toplevel)/server"; C=wrangler.staging.toml
die(){ echo "توقّف النشر التجريبي: $1"; exit 2; }
grep -v '^\s*#' "$C" | grep -q 'REQUIRED' && die "قيم لم تُملأ في $C: $(grep -n REQUIRED "$C" | grep -v ':\s*#' | cut -d: -f1 | tr '\n' ' ')"
grep -qE '^name = "mufradati-api-stg"$' "$C" || die "اسم الخادم يجب أن يبقى mufradati-api-stg"
grep -qE '^MUF_ENV = "staging"$' "$C" || die "MUF_ENV يجب أن يكون staging"
grep -v '^\s*#' "$C" | grep -qiE 'mufradati-406bd|github\.io|afunogrv' && die "الإعداد يشير إلى الإنتاج"
PROD_ACC=$(grep -E '^account_id' wrangler.toml 2>/dev/null | cut -d'"' -f2 || true); STG_ACC=$(grep -E '^account_id' "$C" | cut -d'"' -f2)
[ -n "$PROD_ACC" ] && [ "$PROD_ACC" = "$STG_ACC" ] && die "حساب Cloudflare هو حساب الإنتاج"
[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ] && [ "$CLOUDFLARE_ACCOUNT_ID" != "$STG_ACC" ] && die "CLOUDFLARE_ACCOUNT_ID لا يطابق الحساب التجريبي"
python3 build.py >/dev/null
if [ "${1:-}" = "--dry" ]; then npx wrangler deploy -c "$C" --dry-run; else npx wrangler deploy -c "$C"; fi
