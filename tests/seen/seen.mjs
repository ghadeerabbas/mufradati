import {T,out,app,user,memfs,DB,post,ctl} from './it.mjs';
const H=36e5,M=6e4;
const mkFriends=async()=>{for(const [a,b] of [['ali','moh'],['moh','ali']])await memfs.commit([{path:'fr/'+a,data:{list:{[b]:{s:'f',n:b}}}}])};
const seenOf=async who=>{const j=await post('/fr','moh',{op:'list'});const x=(j.items||[]).find(i=>i.uid===who);return x};
const onDoc=()=>JSON.stringify(DB.get('on/ali')?.data||null);
for(const V of ['old','new']){
  DB.clear();ctl.ACTIVE=V;ctl.NOW=Date.parse('2026-11-16T08:00:00Z');
  for(const u of ['ali','moh','acc3'])await user(u);await mkFriends();
  const A=app(V,'ali');await A.sync();
  // 1) علي يفتح التطبيق ويدرس (لمس) الساعة 8:00
  await post('/fr','ali',{op:'tick',act:1});let x=await seenOf('ali');const t8=ctl.NOW;
  T(`[${V}] بعد استعمال حقيقي: آخر ظهور = وقت الاستعمال`,x.seen===t8);
  // 2) التطبيق يبقى مفتوحًا ظاهرًا ساعتين بلا لمس (نبضات كل دقيقة)
  for(let i=0;i<120;i++){ctl.NOW+=M;await post('/fr','ali',{op:'tick',act:0})}
  x=await seenOf('ali');
  T(`[${V}] تطبيق مفتوح بلا لمس ساعتين: «آخر ظهور» يبقى وقت آخر استعمال`,x.seen===t8,'الفرق '+Math.round((ctl.NOW-x.seen)/M)+' دقيقة');
  // 3) عمليات المشرف والخادم بعد ساعة أخرى بلا أي نبضة من علي
  ctl.NOW+=H;const before=onDoc();
  await post('/sync','admin',{evs:[]});await post('/backup','admin',{op:'snap'});
  const fl=await post('/fr','admin',{op:'list'}).catch(e=>({err:1}));
  await A.sync();   // مزامنة علي نفسه (في الخلفية) لا تُعدّ ظهورًا
  await post('/sync','moh',{evs:[]});
  T(`[${V}] المشرف (مزامنة، لقطة النسخ) ومزامنة الخلفية لا تغيّر وثيقة الظهور`,onDoc()===before);
  // 4) فتح التطبيق دون لمس (إعادة تحميل تلقائية مثلًا): نبضة بلا نشاط
  await post('/fr','ali',{op:'tick'});x=await seenOf('ali');
  T(`[${V}] فتح التطبيق أو إعادة تحميله دون لمس: لا يحدّث «آخر ظهور»`,x.seen===t8,'الفرق '+Math.round((ctl.NOW-x.seen)/M)+' دقيقة');
  T(`[${V}] «متصل الآن» يبقى مرتبطًا بالتطبيق المفتوح (لدعوات التحدي)`,x.on===true);
}
// 5) تطبيق قديم (لا يرسل النشاط) مع الخادم الجديد: كما كان قبل التعديل، لا يختفي الظهور
DB.clear();ctl.ACTIVE='new';ctl.NOW=Date.parse('2026-11-20T08:00:00Z');for(const u of ['ali','moh'])await user(u);await mkFriends();
await post('/fr','ali',{op:'tick'});let x=await seenOf('ali');T('[new] تطبيق قديم لم يُحدَّث: «آخر ظهور» كما كان (لا يصبح «لم يظهر بعد»)',x.seen===ctl.NOW);
// 6) كتابة واحدة فقط لكل دقيقة تقريبًا حتى مع نبضات كل 3 ثوانٍ ولمس دائم
let w0=+DB.get('on/ali').ut;for(let i=0;i<40;i++){ctl.NOW+=3000;await post('/fr','ali',{op:'tick',act:1})}
T('[new] لمس مستمر ونبضة كل 3 ثوانٍ لمدة دقيقتين: كتابات قليلة',(+DB.get('on/ali').ut-w0)<=8,'كتابات تقريبًا '+(+DB.get('on/ali').ut-w0)+' (العدّاد مشترك)');
console.log(out.join('\n'));
