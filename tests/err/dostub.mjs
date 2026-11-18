// كائن دائم مُحاكى في Node للاختبار المحلي: تخزين SQLite حقيقي (node:sqlite) بواجهة ctx.storage.sql نفسها، ومنبّه واحد.
// التنفيذ المتزامن في Node لا يتداخل، كما في الكائن الحقيقي؛ والتداخل يحدث فقط عند await (مثل الاتصال بـFirestore)، كما في الحقيقي.
import {DatabaseSync} from 'node:sqlite';
export function newDB(){return new DatabaseSync(':memory:')}
export function makeCtx(db){
  const st={alarm:null,rowsWritten:0,rowsRead:0,sets:0};
  const sql={exec(q,...a){const s=db.prepare(q);if(/^\s*(SELECT|WITH)/i.test(q)){const rows=s.all(...a).map(r=>({...r}));st.rowsRead+=rows.length;return {toArray:()=>rows}}
    const r=s.run(...a);st.rowsWritten+=Number(r.changes||0);return {toArray:()=>[]}}};
  return {st,storage:{sql,setAlarm(t){st.alarm=t;st.sets++;return Promise.resolve()},getAlarm(){return Promise.resolve(st.alarm)},deleteAlarm(){st.alarm=null;return Promise.resolve()}}};
}
