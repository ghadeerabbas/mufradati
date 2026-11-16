# يبني نسختي بيئة الاختبار من شيفرة هذا الفرع، دون أي تغيير في ملفات الإنتاج:
#   server/worker-it.js  — الخادم مربوطًا بمشروع Firebase الاختباري فقط
#   it-site/             — الموقع مربوطًا بمشروع الاختبار وعامل الاختبار فقط
# ويتوقف بخطأ إن وُجد أي أثر للمشروع الحقيقي أو لعامله في الناتج.
# الاستعمال: python3 it/build_it.py   (أو --check لفحص الإعدادات فقط)
import json,os,re,shutil,sys,hashlib
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROD_PROJECT="mufradati-406bd";PROD_API="mufradati-api.afunogrv.workers.dev";PROD_WEB_KEY="AIzaSyBevgQRTKaRrrY9Q2RWPaWsY0UkfTaQu8o"
cfg=json.load(open(os.path.join(root,'it','config.json'),encoding='utf-8'))
def die(m):print('✗ '+m);sys.exit(1)
P=cfg['project'];W=cfg['web'];API=cfg['api'].rstrip('/')
# --- حواجز الإعدادات ---
if 'FILL-ME' in json.dumps(cfg):die('الإعدادات لم تُملأ بعد (it/config.json)')
if not re.fullmatch(r'[a-z0-9][a-z0-9-]{4,28}[a-z0-9]',P):die('معرّف مشروع غير صالح')
if P==PROD_PROJECT or W['projectId']!=P:die('مشروع الاختبار يجب أن يكون غير المشروع الحقيقي، ومطابقًا في كل الإعدادات')
if W['apiKey']==PROD_WEB_KEY or PROD_PROJECT in json.dumps(W):die('إعدادات الويب تشير إلى المشروع الحقيقي')
if PROD_API in API or not re.fullmatch(r'https://mufradati-api-it\.[a-z0-9-]+\.workers\.dev',API):die('عنوان العامل يجب أن يكون عامل الاختبار mufradati-api-it')
if '--check' in sys.argv:print('✓ الإعدادات سليمة');sys.exit(0)
# --- الخادم ---
os.system('python3 '+os.path.join(root,'server','build.py')+' > /dev/null')
src=open(os.path.join(root,'server','worker.js'),encoding='utf-8').read()
a='const PROJECT = "%s";'%PROD_PROJECT
if src.count(a)!=1:die('لم أجد تعريف PROJECT في الخادم')
guard='''const PROJECT = "%s";
// ⛔ بيئة اختبار: كل اتصال يذكر المشروع الحقيقي يُمنع، ومفتاح الخدمة يجب أن يكون لمشروع الاختبار
const __REALF = globalThis.fetch;
globalThis.fetch = (u, o) => { const s = String(u && u.url || u); if (s.includes("%s") || s.includes("%s")) return Promise.reject(new Error("blocked: production")); return __REALF(u, o) };
const __IT = true;'''%(P,PROD_PROJECT,PROD_API)
out=src.replace(a,guard)
b='const sa = JSON.parse(env.SA), now = Math.floor(Date.now() / 1000);'
if out.count(b)!=1:die('لم أجد قراءة مفتاح الخدمة')
out=out.replace(b,b+'\n  if (sa.project_id !== PROJECT) throw new Error("sa: not the test project");')
out='// ⚠️ نسخة بيئة الاختبار، مولَّدة من worker.js بالأداة it/build_it.py — لا تُنشر على العامل الحقيقي\n'+out
# لا أثر للمشروع الحقيقي إلا في سطر الحاجز
rest=out.replace([l for l in guard.split('\n') if 'blocked: production' in l][0],'')
if PROD_PROJECT in rest or PROD_API in rest:die('بقي أثر للمشروع الحقيقي في خادم الاختبار')
open(os.path.join(root,'server','worker-it.js'),'w',encoding='utf-8').write(out)
# --- الموقع ---
site=os.path.join(root,'it-site')
if os.path.isdir(site):shutil.rmtree(site)
os.makedirs(site)
for f in ['manifest.json','sw.js','core.js']:shutil.copy(os.path.join(root,f),site)
for d in ['img','icons','fonts']:
  if os.path.isdir(os.path.join(root,d)):shutil.copytree(os.path.join(root,d),os.path.join(site,d))
h=open(os.path.join(root,'index.html'),encoding='utf-8').read()
m=re.search(r'firebase\.initializeApp\(\{[^}]*\}\);',h)
if not m:die('لم أجد إعداد Firebase في الصفحة')
h=h.replace(m.group(0),'firebase.initializeApp('+json.dumps(W)+');')
h=h.replace('https://'+PROD_API,API)
# حاجز في الصفحة نفسها، قبل أي شيفرة أخرى: يتوقف إن أشار أي شيء إلى المشروع الحقيقي، ويمنع أي طلب إليه
pg='''<script>/* ⛔ بيئة اختبار */(function(){var P=%s,A=%s,BAD=["%s","%s","%s"];
if(P==="%s"||A.indexOf("%s")>=0){window.stop();document.documentElement.innerHTML="<body dir=rtl><h1>إعداد خاطئ: بيئة الاختبار تشير إلى الإنتاج</h1></body>";throw new Error("it-guard")}
var bad=function(u){var s=String(u&&u.url||u);for(var i=0;i<BAD.length;i++)if(s.indexOf(BAD[i])>=0)return true;return false};
var F=window.fetch;window.fetch=function(u,o){if(bad(u))return Promise.reject(new Error("blocked: production"));return F.apply(this,arguments)};
var XO=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){if(bad(u))throw new Error("blocked: production");return XO.apply(this,arguments)};
var WS=window.WebSocket;if(WS)window.WebSocket=function(u,p){if(bad(u))throw new Error("blocked: production");return new WS(u,p)};
var SB=navigator.sendBeacon&&navigator.sendBeacon.bind(navigator);if(SB)navigator.sendBeacon=function(u,d){if(bad(u))return false;return SB(u,d)};
window.MUF_IT=1;document.addEventListener("DOMContentLoaded",function(){var b=document.createElement("div");b.textContent=%s;b.style.cssText="position:fixed;top:0;left:0;z-index:99999;background:#D9483B;color:#fff;font:700 11px sans-serif;padding:2px 8px;border-radius:0 0 8px 0;pointer-events:none";document.body.appendChild(b)})})();</script>'''%(json.dumps(P),json.dumps(API),PROD_PROJECT,PROD_API,PROD_WEB_KEY,PROD_PROJECT,PROD_API,json.dumps(cfg.get('label','بيئة اختبار')))
h=h.replace('<head>','<head>\n'+pg,1)
rest=h.replace(pg,'')  # الحاجز وحده يذكر قيم الإنتاج ليمنعها
if PROD_PROJECT in rest or PROD_API in rest or PROD_WEB_KEY in rest:die('بقي أثر للمشروع الحقيقي في موقع الاختبار')
open(os.path.join(site,'index.html'),'w',encoding='utf-8').write(h)
for f in os.listdir(site):
  p=os.path.join(site,f)
  if os.path.isfile(p) and f.endswith(('.js','.json')) and (PROD_PROJECT in open(p,encoding='utf-8',errors='ignore').read()):die('أثر للمشروع الحقيقي في '+f)
print('✓ server/worker-it.js و it-site/ جاهزان لمشروع',P)
