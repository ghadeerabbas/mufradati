#!/bin/bash
# اختبارات داخل الصفحة: index.html الحالي في Chromium محاكي (Playwright)، Firebase مزيّف، والخادم يُرَدّ عليه بـ{}. لا شبكة ولا بيانات حقيقية.
# الخروج 3 إن لم يتوفر Playwright أو Chromium: «لم تُشغَّل»، لا نجاح.
D=$(cd "$(dirname "$0")" && pwd); . "$D/../lib.sh"
python3 -c "import playwright" 2>/dev/null || { echo "SKIP لا يوجد Playwright لبايثون (pip install playwright && playwright install chromium)"; exit 3; }
# الملف والحساب: المشرف لأدوات الحماية، وحساب عادي لغيرها
LIST="stage0/browser.js:tester stage0/offline-background.js:tester ui-tweaks/station.js:tester seen/browser.js:tester backup-dup/browser.js:admin backup-diff/browser.js:admin backup-diff/browser2.js:admin"
{ for x in $LIST; do f=${x%%:*}; u=${x##*:}; echo "== $f"
    USR=$u timeout 300 python3 "$D/page.py" "$R" "$R/tests/$f" 2>&1 || echo "FAIL تعذّر تشغيل $f (Chromium؟)"; done; } | verdict
