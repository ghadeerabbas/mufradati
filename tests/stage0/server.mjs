import {T,out,user,post,ctl,memfs} from './it.mjs';
ctl.ACTIVE='new';await user('s1');
let j=await post('/sync','s1',{evs:[]});T('الخادم يرسل رقم نسخته دائمًا',!!j.cv,j.cv);
j=await post('/sync','s1',{evs:[],cv:j.cv});T('التطبيق بالنسخة نفسها: لا ملخّص',!j.sum);
j=await post('/sync','s1',{evs:[],cv:'aaaaaaaaaa'});T('التطبيق بنسخة أخرى: ملخّص الأرقام من الخادم',!!j.sum&&'gems' in j.sum,JSON.stringify(j.sum));
j=await post('/sync','s1',{evs:[]});T('تطبيق قديم لا يرسل رقمًا: لا ملخّص (لا كلفة إضافية)',!j.sum);
ctl.ACTIVE='old';j=await post('/sync','s1',{evs:[],cv:'aaaaaaaaaa'});T('خادم قديم: لا رقم نسخة، فالتطبيق الجديد لا يغيّر شيئًا',!j.cv);
console.log(out.join('\n'));
