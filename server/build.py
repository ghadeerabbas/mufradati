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
