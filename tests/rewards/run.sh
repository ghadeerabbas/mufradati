#!/bin/bash
# اختبار محلي فقط: core.js الحالي مقابل نسخة ما قبل الطيّ (PRE_FOLD) ومقابل المرجع = النسخة نفسها بلا أي قصّ
D=$(cd "$(dirname "$0")" && pwd); . "$D/../lib.sh"; W=$(mktemp -d)
B=$(base PRE_FOLD); oldfile "$B" core.js "$W/core_old.js"; cp "$R/core.js" "$W/core_new.js"
python3 - "$W" <<'P'
import sys;w=sys.argv[1];s=open(w+'/core_old.js',encoding='utf8').read()
for a in ["if(R.dw.length>2000)R.dw=R.dw.slice(-2000)","if(R.dd.length>400)R.dd=R.dd.slice(-400)","if(R.pz.length>800)R.pz=R.pz.slice(-800)","if(R.qd.length>600)R.qd=R.qd.slice(-600)"]:
    assert a in s,a;s=s.replace(a,"")
open(w+'/core_ref.js','w',encoding='utf8').write(s)
P
cp "$D/sim.js" "$D/sync.js" "$W/"; cd "$W"
{ echo "== المرجع: $B بلا قصّ"; echo "== محاكاة 10 سنوات"; node sim.js; echo "== الترحيل والمزامنة"; node sync.js | grep -v '^DBG'; echo __END; } | verdict
