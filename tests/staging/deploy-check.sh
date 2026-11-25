#!/bin/bash
# أمر النشر التجريبي يرفض قبل أي اتصال: القيم غير المملوءة، والإشارة إلى الإنتاج. لا شبكة (يتوقّف قبل wrangler).
R=$(git rev-parse --show-toplevel); T=$(mktemp -d); git -C "$R" worktree add -q --detach "$T/w" HEAD 2>/dev/null || { cp -r "$R" "$T/w"; }
cp "$R/server/wrangler.staging.toml" "$R/tools/deploy-staging.sh" "$T/" ; cp "$T/wrangler.staging.toml" "$T/w/server/"; cp "$T/deploy-staging.sh" "$T/w/tools/"
o=$(cd "$T/w" && bash tools/deploy-staging.sh --dry 2>&1); [ $? = 2 ] && echo "$o" | grep -q "قيم لم تُملأ" && echo "PASS الإعداد كما في المستودع (قيم REQUIRED): يرفض النشر" || echo "FAIL الإعداد غير المملوء لم يُرفض: $o"
sed -i 's/REQUIRED-staging-cloudflare-account-id/abc/;s/REQUIRED-staging-kv-namespace-id/kv1/;s/FB_PROJECT = "REQUIRED"/FB_PROJECT = "mufradati-406bd"/;s/ADMIN_EMAIL = "REQUIRED"/ADMIN_EMAIL = "stg@example.com"/;s#ORIGINS = "REQUIRED"#ORIGINS = "https://x.pages.dev"#;s#SITE = "REQUIRED"#SITE = "https://x.pages.dev/"#' "$T/w/server/wrangler.staging.toml"
o=$(cd "$T/w" && bash tools/deploy-staging.sh --dry 2>&1); [ $? = 2 ] && echo "$o" | grep -q "يشير إلى الإنتاج" && echo "PASS إعداد يشير إلى مشروع الإنتاج: يرفض النشر" || echo "FAIL لم يُرفض إعداد يشير إلى الإنتاج: $o"
sed -i 's/FB_PROJECT = "mufradati-406bd"/FB_PROJECT = "mufradati-stg"/;s/^MUF_ENV = "staging"/MUF_ENV = "production"/' "$T/w/server/wrangler.staging.toml"
o=$(cd "$T/w" && bash tools/deploy-staging.sh --dry 2>&1); [ $? = 2 ] && echo "$o" | grep -q "MUF_ENV" && echo "PASS MUF_ENV غير staging: يرفض النشر" || echo "FAIL لم يُرفض MUF_ENV غير staging: $o"
sed -i 's/^MUF_ENV = "production"/MUF_ENV = "staging"/;s/ADMIN_EMAIL = "stg@example.com"/ADMIN_EMAIL = "admin@mufradati.app"/' "$T/w/server/wrangler.staging.toml"
o=$(cd "$T/w" && bash tools/deploy-staging.sh --dry 2>&1); [ $? = 2 ] && echo "$o" | grep -q "مشرف الإنتاج" && echo "PASS بريد مشرف الإنتاج في التجريبية: يرفض النشر" || echo "FAIL لم يُرفض بريد مشرف الإنتاج: $o"
git -C "$R" worktree remove --force "$T/w" 2>/dev/null; rm -rf "$T"
