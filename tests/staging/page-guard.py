# الصفحة التجريبية في Chromium: تعمل على نطاقها وحده مع الشريط، وتتوقّف على أي نطاق آخر (ومنه نطاق الإنتاج). الاستعمال: python3 page-guard.py <مجلد الصفحة التجريبية>
import sys, os, mimetypes, asyncio
from playwright.async_api import async_playwright
OUT = sys.argv[1]; FAKE = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "browser", "fakefb.js"), encoding="utf8").read()
res = []; ALL = []
async def one(origin):
  async with async_playwright() as p:
    b = await p.chromium.launch(); ctx = await b.new_context(); reqs = []
    async def route(r):
      u = r.request.url; reqs.append(u); ALL.append(u)
      if "gstatic.com/firebasejs" in u: return await r.fulfill(body=FAKE if "firebase-app" in u else "", content_type="application/javascript")
      if u.startswith(origin + "/"):
        fp = os.path.join(OUT, u[len(origin) + 1:].split("?")[0] or "index.html")
        if os.path.isfile(fp): return await r.fulfill(body=open(fp, "rb").read(), content_type=mimetypes.guess_type(fp)[0] or "application/octet-stream")
      return await r.fulfill(status=404, body="")
    await ctx.route("**/*", route); pg = await ctx.new_page()
    await pg.goto(origin + "/index.html", wait_until="commit"); await pg.wait_for_timeout(2500)
    t = await pg.evaluate("document.body?document.body.innerText:''"); fb = await pg.evaluate("(typeof firebase!=='undefined'&&!!window.auth)||typeof econ!=='undefined'||typeof syncNow!=='undefined'")   # لم تُنفَّذ شيفرة الموقع
    # المسموح على نطاق غير نطاقها: الصفحة نفسها والخطوط والصور التي يطلبها المتصفح مسبقًا من النطاق نفسه؛ لا شيفرة ولا بيانات ولا Firebase ولا خادم
    # المتصفح يجلب مسبقًا ملفات ثابتة (خطوط وصور ومكتبة Firebase من CDN) لكنها لا تُنفَّذ؛ الممنوع: أي طلب إلى الخادم أو إلى خدمات Firebase، وتنفيذ أي شيفرة من الموقع
    import re; ext = [u for u in reqs if re.search(r"workers\.dev|googleapis\.com|firebaseio|identitytoolkit|securetoken|firebaseapp\.com", u)]; await b.close(); return t, fb, ext
async def main():
  t, fb, ext = await one("https://mufradati-stg.pages.dev"); res.append(("PASS " if "نسخة تجريبية — ليست مفرداتي الحقيقي" in t else "FAIL ") + "على النطاق التجريبي: تعمل مع شريط «نسخة تجريبية»")
  prod = [u for u in ALL if "afunogrv" in u or "mufradati-406bd" in u or "ghadeerabbas.github.io" in u]; res.append(("PASS " if not prod else "FAIL ") + "على النطاق التجريبي: لا طلب واحد إلى خادم الإنتاج أو مشروعه أو نطاقه → " + repr(prod[:3]))
  for o in ["https://ghadeerabbas.github.io", "https://other.pages.dev"]:
    t, fb, ext = await one(o); res.append(("PASS " if "لا تعمل إلا على نطاقها" in t and "التفعيل" not in t and not fb and not ext else "FAIL ") + "على " + o + ": تتوقّف قبل تشغيل الصفحة (لا طلب آخر ولا Firebase) → " + repr((t[:50], ext[:3])))
  print("\n".join(res))
asyncio.run(main())
