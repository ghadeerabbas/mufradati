#!/usr/bin/env python3
"""يتحقّق من ملف مفتاح حساب خدمة (JSON) قبل وضعه سرًّا في الخادم، دون كشف أي شيء منه سوى اسم مشروعه ونطاق بريده.
لا يطبع المفتاح الخاص ولا رقمه ولا البريد كاملًا، ولا يكتب شيئًا، ولا يتصل بالشبكة.
الاستعمال: python3 tools/sa-check.py <مسار ملف المفتاح> <المشروع المتوقَّع: production | staging:اسم-المشروع>
الخروج: 0 مطابق · 1 غير مطابق · 2 ملف غير صالح"""
import json, re, sys
PROD = "mufradati-406bd"
def main():
    if len(sys.argv) != 3: print(__doc__); sys.exit(2)
    want = sys.argv[2]
    exp = PROD if want == "production" else want.split(":", 1)[1] if want.startswith("staging:") else None
    if not exp or (want.startswith("staging:") and exp == PROD): print("المشروع المتوقَّع غير صالح (والتجريبي لا يكون مشروع الإنتاج)"); sys.exit(2)
    try: a = json.load(open(sys.argv[1], encoding="utf-8"))
    except Exception: print("ملف غير مقروء أو ليس JSON"); sys.exit(2)
    if not isinstance(a, dict) or a.get("type") != "service_account": print("ليس ملف حساب خدمة"); sys.exit(2)
    pid = str(a.get("project_id") or ""); dom = (re.search(r"@([a-z0-9-]+)\.iam\.gserviceaccount\.com$", str(a.get("client_email") or "")) or [None, ""])[1]
    has_key = bool(a.get("private" + "_key"))
    print("اسم المشروع في الملف: %s" % (pid or "(غير موجود)"))
    print("مشروع نطاق البريد:   %s" % (dom or "(غير معروف)"))
    print("فيه مفتاح خاص:       %s" % ("نعم (لم يُعرض)" if has_key else "لا"))
    ok = pid == exp and (not dom or dom == exp) and has_key
    print(("✓ مطابق للمشروع المتوقَّع " if ok else "✗ غير مطابق للمشروع المتوقَّع ") + exp); sys.exit(0 if ok else 1)
if __name__ == "__main__": main()
