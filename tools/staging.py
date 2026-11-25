#!/usr/bin/env python3
"""يولّد نسخة الصفحة التجريبية من هذا الفرع في مجلد مستقل، للنشر على النطاق التجريبي وحده.
الاستعمال: python3 tools/staging.py <ملف الإعداد JSON، خارج المستودع> <مجلد الإخراج (جديد)> [--audio]
ملف الإعداد: {"firebase": {apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId}, "api": "https://…", "origin": "https://…", "admin": "…"}
لا رجوع إلى الإنتاج: أي قيمة ناقصة أو فارغة أو تشير إلى الإنتاج، أو أي أثر لقيم الإنتاج في الناتج → يتوقّف دون إخراج (رمز خروج 2).
التغييرات في الصفحة محصورة في: إعدادات Firebase، وعنوان الخادم، وحارس النطاق وشريط «نسخة تجريبية». قواعد الحماية تُولَّد بمشرف التجريبية."""
import json, os, re, shutil, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROD = {"project": "mufradati-406bd", "api": "https://mufradati-api.afunogrv.workers.dev", "origin": "https://ghadeerabbas.github.io", "admin": "admin@mufradati.app"}
PROD_MARKS = ["mufradati-406bd", "afunogrv.workers.dev", "ghadeerabbas.github.io", "171055013286"]   # مشروع الإنتاج وخادمه ونطاقه ومعرّف المرسل
FB_KEYS = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"]
COPY = ["index.html", "core.js", "sw.js", "manifest.json", "courses.json", "sources.json", "math.json", "rdgloss.json"]
DIRS = ["fonts", "icons", "img"]

def die(msg):
    print("توقّف التوليد: " + msg); sys.exit(2)

def load_cfg(path):
    try: c = json.load(open(path, encoding="utf-8"))
    except Exception as e: die("ملف الإعداد غير مقروء (%s)" % e)
    fb = c.get("firebase") or {}
    miss = [k for k in FB_KEYS if not str(fb.get(k, "")).strip()] + [k for k in ("api", "origin", "admin") if not str(c.get(k, "")).strip()]
    if miss: die("قيم ناقصة: " + ", ".join(miss))
    if not re.fullmatch(r"https://[a-z0-9.-]+", c["origin"]): die("النطاق يجب أن يكون https://اسم-النطاق بلا مسار")
    if not re.fullmatch(r"https://[a-z0-9.-]+", c["api"]): die("عنوان الخادم يجب أن يكون https://اسم-النطاق بلا مسار")
    blob = json.dumps(c)
    for m in PROD_MARKS:
        if m in blob: die("الإعداد يشير إلى الإنتاج (%s)" % m)
    if c["origin"].endswith("github.io"): die("نطاق github.io يشارك تخزين متصفح الإنتاج")
    if c["admin"].strip().lower() == PROD["admin"]: die("بريد مشرف التجريبية هو بريد مشرف الإنتاج")
    return c

def main():
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    if len(a) != 2: die("الاستعمال: staging.py <الإعداد> <مجلد الإخراج> [--audio]")
    c = load_cfg(a[0]); out = a[1]
    if os.path.exists(out): die("مجلد الإخراج موجود؛ اختر مجلدًا جديدًا")
    if os.path.abspath(out).startswith(ROOT + os.sep): die("مجلد الإخراج داخل المستودع؛ اختر مجلدًا خارجه")
    src = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
    fb = c["firebase"]; cfg = "firebase.initializeApp(" + json.dumps({k: fb[k] for k in FB_KEYS}, ensure_ascii=False) + ");"
    html, n1 = re.subn(r"firebase\.initializeApp\(\{[^}]*\}\);", lambda m: cfg, src, flags=re.S)
    html, n2 = re.subn(re.escape(PROD["api"]), c["api"], html)
    guard = ('<script>/*staging*/(function(){if(location.origin!==%s){document.write("<p dir=rtl style=\\"font:18px sans-serif;padding:20px\\">نسخة تجريبية لا تعمل إلا على نطاقها.</p><plaintext hidden>");throw new Error("staging origin")}'
             'addEventListener("DOMContentLoaded",function(){var b=document.createElement("div");b.textContent="نسخة تجريبية — ليست مفرداتي الحقيقي";'
             'b.style.cssText="position:fixed;top:0;left:0;right:0;z-index:99999;background:#b91c1c;color:#fff;text-align:center;font:600 13px sans-serif;padding:3px;pointer-events:none";document.body.appendChild(b)})})();</script>') % json.dumps(c["origin"])
    html, n3 = re.subn(r"<head>", lambda m: "<head>" + guard, html, count=1)
    if (n1, n3) != (1, 1) or n2 < 1: die("بنية الصفحة تغيّرت (إعدادات Firebase %d، الخادم %d، الرأس %d)؛ حدّث المولّد" % (n1, n2, n3))
    os.makedirs(out)
    for f in COPY:
        p = os.path.join(ROOT, f)
        if f == "index.html": open(os.path.join(out, f), "w", encoding="utf-8").write(html)
        elif os.path.exists(p): shutil.copy2(p, out)
    for f in os.listdir(ROOT):
        if re.fullmatch(r"words.*\.json", f): shutil.copy2(os.path.join(ROOT, f), out)
    for d in DIRS + (["audio"] if "--audio" in sys.argv else []):
        if os.path.isdir(os.path.join(ROOT, d)): shutil.copytree(os.path.join(ROOT, d), os.path.join(out, d))
    rules = open(os.path.join(ROOT, "firestore.rules"), encoding="utf-8").read()
    if rules.count('"%s"' % PROD["admin"]) != 1: die("قواعد الحماية تغيّرت؛ حدّث المولّد")
    open(os.path.join(out, "firestore.staging.rules"), "w", encoding="utf-8").write(rules.replace('"%s"' % PROD["admin"], json.dumps(c["admin"])))
    # لا أثر للإنتاج في أي ملف نصّي ناتج
    for dp, _, fs in os.walk(out):
        for f in fs:
            if not re.search(r"\.(html|js|json|rules|css|txt)$", f): continue
            t = open(os.path.join(dp, f), encoding="utf-8", errors="ignore").read()
            for m in PROD_MARKS:
                if m in t: shutil.rmtree(out); die("بقي أثر للإنتاج (%s) في %s" % (m, f))
    print("✓ الصفحة التجريبية في %s (النطاق %s، الخادم %s، المشروع %s)%s" % (out, c["origin"], c["api"], fb["projectId"], "" if "--audio" in sys.argv else "، دون ملفات الأصوات"))

if __name__ == "__main__": main()
