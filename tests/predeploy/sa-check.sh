#!/bin/bash
# أداة فحص حساب الخدمة: تعرض اسم المشروع فقط، ولا تكشف المفتاح ولا البريد كاملًا. ملفات وهمية تُنشأ وقت الاختبار ولا تُحفظ.
R=$(git rev-parse --show-toplevel); T=$(mktemp -d); K=private_key
mk(){ python3 -c "import json,sys; d={'type':'service_account','project_id':sys.argv[1],'client_email':'x@'+sys.argv[2]+'.iam.gserviceaccount.com','private_key_id':'id-SECRET-ID','$K':'-----SECRET-MATERIAL-----'}; json.dump(d,open(sys.argv[3],'w'))" "$1" "$2" "$3"; }
mk mufradati-406bd mufradati-406bd $T/p.json; mk mufradati-stg mufradati-stg $T/s.json; mk mufradati-stg mufradati-406bd $T/mix.json; echo '{bad' > $T/bad.json
o=$(python3 "$R/tools/sa-check.py" $T/p.json production); rc=$?; [ $rc = 0 ] && echo "PASS مفتاح الإنتاج مع «production»: مطابق" || echo "FAIL مفتاح الإنتاج: $rc"
echo "$o" | grep -qE "SECRET|x@" && echo "FAIL الناتج يكشف شيئًا من المفتاح أو البريد" || echo "PASS الناتج لا يكشف المفتاح ولا رقمه ولا البريد"
python3 "$R/tools/sa-check.py" $T/s.json production >/dev/null; [ $? = 1 ] && echo "PASS مفتاح تجريبي مع «production»: غير مطابق" || echo "FAIL"
python3 "$R/tools/sa-check.py" $T/s.json staging:mufradati-stg >/dev/null; [ $? = 0 ] && echo "PASS مفتاح تجريبي مع مشروعه: مطابق" || echo "FAIL"
python3 "$R/tools/sa-check.py" $T/p.json staging:mufradati-406bd >/dev/null; [ $? = 2 ] && echo "PASS «staging» بمشروع الإنتاج: مرفوض" || echo "FAIL"
python3 "$R/tools/sa-check.py" $T/mix.json staging:mufradati-stg >/dev/null; [ $? = 1 ] && echo "PASS اسم المشروع ونطاق البريد مختلفان: غير مطابق" || echo "FAIL"
python3 "$R/tools/sa-check.py" $T/bad.json production >/dev/null; [ $? = 2 ] && echo "PASS ملف تالف: مرفوض" || echo "FAIL"
rm -rf $T
