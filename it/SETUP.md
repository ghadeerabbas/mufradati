# إعداد بيئة الاختبار المعزولة — خطوات صاحب الحسابات

لا تُرسل أي مفتاح سرّي في المحادثة. المفتاح السرّي الوحيد (مفتاح حساب الخدمة) يذهب مباشرة من Firebase إلى Cloudflare.
القيم التي في it/config.json معرّفات عامة تظهر في أي موقع Firebase، وليست أسرارًا.

## أ) Firebase — مشروع اختبار منفصل (مجاني)
1. console.firebase.google.com ← «إضافة مشروع» ← اسم مثل mufradati-it. لا تفعّل Google Analytics. الخطة Spark (مجانية، بلا بطاقة).
2. Build ← Authentication ← Get started ← Sign-in method ← Email/Password ← Enable.
3. Build ← Firestore Database ← Create database ← المنطقة نفسها التي في المشروع الحقيقي ← Production mode.
4. Firestore ← Rules: الصق محتوى ملف firestore.rules من المستودع كما هو ← Publish.
5. Authentication ← Users ← Add user: admin@mufradati.app بكلمة مرور جديدة خاصة بالاختبار (غير كلمة مرور الحساب الحقيقي). بقية حسابات الاختبار تُنشأ لاحقًا من صفحة المشرف في موقع الاختبار.
6. إعدادات المشروع (الترس) ← General ← Your apps ← Web (</>) ← اسم mufradati-it-web ← انسخ قيم firebaseConfig إلى it/config.json في الفرع it-env (حقل web، وحقل project = projectId). يمكنك تعديله من موقع GitHub مباشرة، أو إرسال هذه القيم العامة لي.
7. إعدادات المشروع ← Service accounts ← Generate new private key ← ينزل ملف JSON. احتفظ به في جهازك فقط حتى الخطوة ب-4، ثم احذفه.

## ب) Cloudflare — عامل اختبار منفصل (مجاني)
1. بعد موافقتك على النشر التجريبي أدفع وسمًا it-deploy-1، فيبني GitHub نسخة الاختبار ويتحقق من الحواجز وينشرها باسم mufradati-api-it (بمفتاح Cloudflare الموجود في أسرار المستودع). العامل الحقيقي mufradati-api لا يُمسّ.
2. dash.cloudflare.com ← Workers & Pages ← mufradati-api-it ← انسخ عنوانه (…workers.dev) إلى حقل api في it/config.json.
3. Settings ← Variables and Secrets ← Add ← النوع Secret ← الاسم SA ← القيمة: محتوى ملف JSON من الخطوة أ-7 كاملًا ← Save. ثم احذف الملف من جهازك.
4. لا تضف إلى هذا العامل أي مفتاح من المشروع الحقيقي. إن حدث خطأ، يرفض العامل العمل: «sa: not the test project».

## ج) موقع الاختبار
- أنشره (بعد موافقتك) في مسار مستقل: https://ghadeerabbas.github.io/mufradati1/it/
- عليه شارة حمراء «بيئة اختبار»، ولا يستطيع الاتصال بالمشروع الحقيقي ولا بعامله.

## الحواجز التي تمنع الوصول إلى المشروع الحقيقي
- البناء (it/build_it.py) يتوقف إن كان المشروع أو مفتاح الويب أو عنوان العامل هو الحقيقي، أو إن بقي أي أثر له في الناتج.
- الخادم: يرفض رموز دخول المشروع الحقيقي، ويرفض مفتاح خدمة ليس لمشروع الاختبار، ويمنع أي طلب شبكة يذكر المشروع الحقيقي أو عامله.
- الموقع: يتوقف كليًا إن أشار إلى الإنتاج، ويمنع fetch وXHR وWebSocket وsendBeacon إلى المشروع الحقيقي أو عامله أو بمفتاح ويبه.
- سير النشر لا يعمل إلا بوسم it-deploy-*، ولا ينشر إلا الاسم mufradati-api-it.

## التكلفة
صفر ضمن الحصص المجانية: Cloudflare Workers (100 ألف طلب يوميًا)، Firestore Spark (50 ألف قراءة و20 ألف كتابة يوميًا)، GitHub Pages.
