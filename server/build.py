# يبني server/worker.js من worker.src.js مع إدراج المنطق المشترك core.js
# الاستعمال: python3 server/build.py
import os
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src=open(os.path.join(root,'server','worker.src.js'),encoding='utf-8').read()
core=open(os.path.join(root,'core.js'),encoding='utf-8').read()
assert '/* @@CORE@@ */' in src
out='// ⚠️ ملف مُولَّد تلقائيًا من server/worker.src.js و core.js — لا تعدّله يدويًا\n'+src.replace('/* @@CORE@@ */',core)
open(os.path.join(root,'server','worker.js'),'w',encoding='utf-8').write(out)
print('server/worker.js',len(out),'bytes')

# رقم نسخة core.js في index.html = بصمة محتواه، فيتغيّر تلقائيًا مع كل تعديل ولا يبقى عند أحد core.js قديم محفوظ في هاتفه
import hashlib,re
v=hashlib.sha1(core.encode('utf-8')).hexdigest()[:10]
ip=os.path.join(root,'index.html');h=open(ip,encoding='utf-8').read()
h2=re.sub(r'core\.js\?v=[0-9a-zA-Z]+','core.js?v='+v,h,count=1)
if h2!=h:open(ip,'w',encoding='utf-8').write(h2)
print('index.html core.js?v='+v)
