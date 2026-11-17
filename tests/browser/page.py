# يشغّل ملف اختبار داخل index.html في متصفّح Chromium محاكي (Playwright)، دون أي اتصال حقيقي:
# Firebase مستبدَل بـfakefb.js، وكل طلب إلى الخادم يُرَدّ عليه بـ{}، وكل ما عدا ملفات المستودع يُمنع.
# الاستعمال: python3 page.py جذر_المستودع ملف_الاختبار.js   (المتغيّر USR=admin لحساب المشرف)
import sys, os, mimetypes, asyncio
from playwright.async_api import async_playwright
ROOT=sys.argv[1]; JS=open(sys.argv[2],encoding="utf8").read()
FAKE=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"fakefb.js"),encoding="utf8").read().replace("ghadeer@",os.environ.get("USR","ghadeer")+"@")
INIT='{"muf_testuid_myc":"[\\"b2\\",\\"c1\\",\\"deen\\",\\"a1\\"]","muf_testuid_course":"b2"}'
DOCS='{"assign/testuid":{"courses":["b2","c1","deen","a1"]}}'
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    ctx=await b.new_context(viewport={"width":390,"height":844})
    await ctx.add_init_script("var INIT="+INIT+";window.FAKEDOCS="+DOCS+";try{localStorage.setItem('muf_act_testuid','1');Object.entries(INIT).forEach(([k,v])=>localStorage.setItem(k,v))}catch(e){}")
    async def route(r):
      u=r.request.url
      if "gstatic.com/firebasejs" in u: return await r.fulfill(body=FAKE if "firebase-app" in u else "",content_type="application/javascript")
      if u.startswith("http://app.local/"):
        fp=os.path.join(ROOT,u[len("http://app.local/"):].split("?")[0] or "index.html")
        if os.path.isfile(fp): return await r.fulfill(body=open(fp,"rb").read(),content_type=mimetypes.guess_type(fp)[0] or "application/octet-stream")
        return await r.fulfill(status=404,body="")
      if "workers.dev" in u: return await r.fulfill(body="{}",content_type="application/json")
      return await r.fulfill(status=404,body="")
    await ctx.route("**/*",route)
    pg=await ctx.new_page(); errs=[]; dbg=[]
    pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.on("console",lambda m:dbg.append(m.text) if m.text.startswith("DBG") else None)
    await pg.goto("http://app.local/index.html"); await pg.wait_for_timeout(3500)
    res=await pg.evaluate("(async()=>{const sleep=t=>new Promise(r=>setTimeout(r,t));const OK=[];const T=(n,c,x)=>OK.push((c?'PASS ':'FAIL ')+n+(x!==undefined?' → '+x:''));\n"+JS+"\nreturn OK})()")
    if not res:   # ملفات تطبع نتائجها بـconsole.log("DBG\n...") بعد انتهائها
      for _ in range(240):
        if dbg: break
        await pg.wait_for_timeout(500)
      res=[l for d in dbg for l in d.split("\n")[1:]]
    for r in res: print(r)
    for e in errs[:5]: print("FAIL خطأ في الصفحة: "+e[:200])
    await b.close()
asyncio.run(main())
