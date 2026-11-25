#!/usr/bin/env python3
# مولّد الصفحة التجريبية: يتوقّف عند أي نقص أو إشارة إلى الإنتاج، ولا يترك أثرًا للإنتاج، والفرق مع الأصل محصور في المتوقَّع.
import json, os, subprocess, sys, tempfile, difflib
R = sys.argv[1]; G = os.path.join(R, "tools", "staging.py"); out = []
T = lambda n, c, x=None: out.append(("PASS " if c else "FAIL ") + n + ("" if x is None else " → " + str(x)[:200]))
OK = {"firebase": {"apiKey": "stgkey1", "authDomain": "mufradati-stg.firebaseapp.com", "projectId": "mufradati-stg", "storageBucket": "mufradati-stg.firebasestorage.app", "messagingSenderId": "1234", "appId": "1:1234:web:abc"},
      "api": "https://mufradati-api-stg.example-stg.workers.dev", "origin": "https://mufradati-stg.pages.dev", "admin": "stg-admin@mufradati.app"}
def run(cfg, extra=()):
    d = tempfile.mkdtemp(); c = os.path.join(d, "cfg.json"); json.dump(cfg, open(c, "w")); o = os.path.join(d, "out")
    p = subprocess.run([sys.executable, G, c, o, *extra], capture_output=True, text=True); return p.returncode, p.stdout + p.stderr, o
rc, msg, o = run(OK); T("إعداد كامل: يولّد الصفحة", rc == 0 and os.path.exists(os.path.join(o, "index.html")), msg.strip())
if rc == 0:
    h = open(os.path.join(o, "index.html"), encoding="utf-8").read(); src = open(os.path.join(R, "index.html"), encoding="utf-8").read()
    T("إعدادات Firebase وعنوان الخادم التجريبيان في الصفحة", '"projectId": "mufradati-stg"' in h and OK["api"] in h)
    T("حارس النطاق وشريط «نسخة تجريبية» في أول الرأس", h.index("/*staging*/") < h.index("</head>") and "نسخة تجريبية" in h)
    d = [l for l in difflib.unified_diff(src.splitlines(), h.splitlines(), lineterm="", n=0) if l[:1] in "+-" and l[:3] not in ("+++", "---")]
    T("الفرق مع الأصل محصور في الرأس وإعدادات Firebase وعنوان الخادم", all(("<head>" in l) or ("initializeApp" in l) or ("storageBucket" in l) or ("workers.dev" in l) for l in d), len(d))
    T("لا أصوات افتراضيًّا، والمناهج منسوخة", not os.path.exists(os.path.join(o, "audio")) and os.path.exists(os.path.join(o, "words-a1.json")))
    r = open(os.path.join(o, "firestore.staging.rules"), encoding="utf-8").read(); T("قواعد الحماية التجريبية مولَّدة", "isAdmin" in r)
for k in ["apiKey", "projectId", "appId"]:
    c = json.loads(json.dumps(OK)); c["firebase"][k] = ""; rc, msg, o = run(c); T("بلا firebase." + k + ": يتوقّف دون إخراج", rc == 2 and not os.path.exists(o), msg.strip())
for k in ["api", "origin", "admin"]:
    c = dict(OK); del c[k]; rc, msg, o = run(c); T("بلا " + k + ": يتوقّف دون إخراج", rc == 2 and not os.path.exists(o), msg.strip())
for n, ch in [("مشروع الإنتاج", lambda c: c["firebase"].update(projectId="mufradati-406bd")), ("خادم الإنتاج", lambda c: c.update(api="https://mufradati-api.afunogrv.workers.dev")),
              ("نطاق الإنتاج", lambda c: c.update(origin="https://ghadeerabbas.github.io")), ("نطاق github.io آخر", lambda c: c.update(origin="https://x.github.io")), ("نطاق بمسار", lambda c: c.update(origin="https://a.pages.dev/x")), ("بريد مشرف الإنتاج", lambda c: c.update(admin="admin@mufradati.app")), ("بريد مشرف الإنتاج بأحرف كبيرة", lambda c: c.update(admin="Admin@Mufradati.App"))]:
    c = json.loads(json.dumps(OK)); ch(c); rc, msg, o = run(c); T("إعداد يشير إلى " + n + ": يتوقّف دون إخراج", rc == 2 and not os.path.exists(o), msg.strip())
rc, msg, _ = subprocess.run([sys.executable, G, "/nonexistent.json", "/tmp/x-out-stg"], capture_output=True, text=True).returncode, "", None
T("ملف إعداد غير موجود: يتوقّف", rc == 2)
print("\n".join(out))
