schedSync=function(){};syncNow=async function(){return true};
window.__rl=0;doReload=async()=>{window.__rl++;try{sessionStorage.setItem("muf_vrl",JSON.stringify({sv:VMIS.sv,t:Date.now()}))}catch(e){}};
try{sessionStorage.removeItem("muf_vrl")}catch(e){}
const SUM={gems:999,xp:4321,lv:17,rest:3,need:200,streak:42,today:true};
T('رقم نسخة التطبيق مقروء من الصفحة',!!CORE_V,CORE_V);
verCheck({cv:CORE_V});T('النسخة نفسها: لا شريط ولا إعادة',!document.getElementById('vbar')&&window.__rl===0);
// أثناء درس
STS={x:1};verCheck({cv:'aaaaaaaaaa',sum:SUM});T('أثناء الدرس: لا إعادة تحميل',window.__rl===0);
T('أثناء الدرس: الشريط ظاهر',!!document.getElementById('vbar'),document.getElementById('vbar')?.textContent);
EC=null;renderHeader();T('الرصيد المعروض من الخادم',/999/.test($('hGem').textContent),$('hGem').textContent);
T('السلسلة المعروضة من الخادم',/42/.test($('hFire').textContent),$('hFire').textContent.trim());
STS=null;
// أحداث لم تُزامن
EVQ.push({type:'x',t:Date.now()});verCheck({cv:'aaaaaaaaaa',sum:SUM});T('أحداث لم تصل إلى الخادم: لا إعادة',window.__rl===0);EVQ.length=0;
// نافذة مفتوحة
$('fbModal').style.display='flex';verCheck({cv:'aaaaaaaaaa',sum:SUM});T('نافذة مفتوحة: لا إعادة',window.__rl===0);$('fbModal').style.display='none';
// وقت آمن
verCheck({cv:'aaaaaaaaaa',sum:SUM});T('وقت آمن: إعادة تحميل مرة واحدة',window.__rl===1,window.__rl);
verCheck({cv:'aaaaaaaaaa',sum:SUM});T('الاختلاف نفسه بعد الإعادة: لا إعادة ثانية (الخادم متأخر)',window.__rl===1&&/يجري تحديث الخادم/.test(document.getElementById('vbar').textContent),document.getElementById('vbar').textContent);
// الدوري والصناديق
goTab('rewards');drawLeague([{id:UID,name:'me',xp:20,av:'x',tier:0},{id:'bot1',bot:1,name:'b',xp:5,av:'x',tier:0}]);await sleep(300);T('الدوري: الترتيب مخفي',/قيد التحديث/.test(document.getElementById('rewards').textContent));
const h=document.createElement('div');document.body.appendChild(h);openPuzzle(h,()=>{});const n0=(R.pz||[]).length;h.querySelector('.chbox').click();await sleep(300);
T('الصندوق لا يُفتح أثناء الاختلاف',!h.querySelector('.chbox').classList.contains('open')&&(R.pz||[]).length===n0);h.remove();
// عودة التطابق
verCheck({cv:CORE_V});EC=null;renderHeader();T('بعد التحديث: الشريط يختفي والأرقام محلية',!document.getElementById('vbar')&&!/999/.test($('hGem').textContent),$('hGem').textContent);
// زر «تحديث الآن» أثناء الدرس
try{sessionStorage.removeItem("muf_vrl")}catch(e){}STS={x:1};verCheck({cv:'bbbbbbbbbb',sum:SUM});const r0=window.__rl;document.getElementById('vbarGo').click();await sleep(300);
T('زر «تحديث الآن» أثناء الدرس لا يقطعه',window.__rl===r0);STS=null;verCheck({cv:CORE_V});
