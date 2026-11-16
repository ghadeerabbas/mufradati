// هل يختلف ملخّص الحساب نفسه بين طلبين بسبب إعدادات المشرف (config/app)؟ handleBackup لا يقرأ الإعدادات
import {T,out,user,post,ctl,DB,app,station,memfs,SRV,env} from './it.mjs';
ctl.NOW=Date.parse('2026-11-13T15:00:00Z');ctl.ACTIVE='new';
await memfs.commit([{path:'config/app',data:{v:JSON.stringify({xp:{review:[2,3,6,6],stOk:5,stMiss:3,mem:20,solid:50,dayN:20,dayXp:15,quiz:2,level:80},gems:{station:3,level:8,quest:[0,5,0],puzzle:100,pdup:3,streak:[[7,10]],prize:[50,40,30]}})}}]);
await user('ali');const A=app('new','ali');await A.sync();for(let d=0;d<3;d++){for(let s=0;s<3;s++)await station(A);ctl.NOW+=864e5}
// «لقطة» في نسخة من الخادم لم تُجرِ أي مزامنة بعد (مثل نسخة جديدة بعد النشر) — new3
ctl.ACTIVE='new3';const fresh=(await post('/backup','admin',{op:'snap'})).accts.ali;
// «لقطة» في نسخة من الخادم أجرت مزامنة (قرأت الإعدادات) — new
ctl.ACTIVE='new';await A.sync();const warm=(await post('/backup','admin',{op:'snap'})).accts.ali;
const d=Object.keys(warm).filter(k=>JSON.stringify(warm[k])!==JSON.stringify(fresh[k]));
T('الحساب نفسه بلا أي تغيير: «لقطة» في خادم لم يقرأ الإعدادات = «لقطة» في خادم قرأها',!d.length,d.map(k=>k+' '+JSON.stringify(fresh[k])+'→'+JSON.stringify(warm[k])).join(' · '));
// والتطبيق نفسه يعرض أرقامه بإعدادات المشرف
T('رقم التطبيق (بإعدادات المشرف) = أي «لقطة»؟',A.gems()===warm.gems&&A.gems()===fresh.gems,'التطبيق '+A.gems()+' · لقطة باردة '+fresh.gems+' · لقطة دافئة '+warm.gems);
console.log(out.join('\n'));
