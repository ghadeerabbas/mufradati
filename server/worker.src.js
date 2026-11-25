/* ===========================================================
   خادم مفرداتي (Cloudflare Worker)
   يتحقّق من هوية المستخدم، ويطبّق أحداثه (مراجعة، محطة، اختبار، شراء…)
   بالقواعد نفسها التي في التطبيق، ثم يحفظ النتيجة في Firebase.
   المستخدم لا يستطيع الكتابة في تقدّمه أو جواهره أو الدوري إلا عبر هذا الخادم.
   السرّ المطلوب: SA = محتوى ملف مفتاح الخدمة من Firebase (JSON)
   =========================================================== */
const PROJECT = "mufradati-406bd";
const ADMIN = "admin@mufradati.app";
const ORIGINS = ["https://ghadeerabbas.github.io"];
const SITE = "https://ghadeerabbas.github.io/mufradati/";
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

/* ---------- متغيّرات الحالة التي يعمل عليها المنطق المشترك ---------- */
let P = {}, LOG = [], QLOG = [], QA = [], BUY = [], R = { bank: 0, ach: [], lv: 1, ts: 0 },
  LG = { tier: null, w: "", hist: [], ts: 0 }, EN = { v: 30, t: 0 }, STN = [], STV = 0, GIFTS = [], CW = 0;

/* @@CORE@@ */
/* @@CORE_V@@ */

/* ---------- ضغط السجلّات (الصيغة نفسها التي في التطبيق) ---------- */
function packLog(L) { const K = [], ix = {}, F = []; let p = 0; for (const [t, k, r, n] of L) { if (ix[k] === undefined) { ix[k] = K.length; K.push(k) } const s = Math.round(t / 1000); F.push(s - p, ix[k], r, n); p = s } return { K, F } }
function unpackLog(o) { if (!o) return []; if (Array.isArray(o)) return o; const L = []; let p = 0; for (let i = 0; i < o.F.length; i += 4) { p += o.F[i]; L.push([p * 1000, o.K[o.F[i + 1]], o.F[i + 2], o.F[i + 3]]) } return L }
function packQA(L) { const K = [], ix = {}, F = []; let p = 0; for (const [t, k, ok] of L) { if (ix[k] === undefined) { ix[k] = K.length; K.push(k) } const s = Math.round(t / 1000); F.push(s - p, ix[k], ok); p = s } return { K, F } }
function unpackQA(o) { if (!o) return []; if (Array.isArray(o)) return o; const L = []; let p = 0; for (let i = 0; i < o.F.length; i += 3) { p += o.F[i]; L.push([p * 1000, o.K[o.F[i + 1]], o.F[i + 2]]) } return L }

/* ---------- أدوات التشفير ---------- */
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64uStr = s => b64u(new TextEncoder().encode(s));
const fromB64u = s => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)) };

/* ---------- التحقق من هوية مستخدم Firebase ---------- */
let JWKS = { at: 0, keys: [] };
async function verifyIdToken(tok) {
  const [h, p, sig] = String(tok || "").split(".");
  if (!sig) throw new Error("token");
  const head = JSON.parse(new TextDecoder().decode(fromB64u(h))), pay = JSON.parse(new TextDecoder().decode(fromB64u(p)));
  if (Date.now() - JWKS.at > 3600e3 || !JWKS.keys.find(k => k.kid === head.kid)) {
    // تعذّر جلب مفاتيح Google عطل مؤقت لا رمز خاطئ: يُميَّز حتى يردّ الخادم 503 (فيعيد التطبيق المحاولة) لا 401 («أعد تسجيل الدخول»)
    try { const r = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"); if (!r.ok) throw 0; JWKS = { at: Date.now(), keys: (await r.json()).keys || [] } }
    catch (e) { const x = new Error("jwks unavailable"); x.transient = true; throw x }
  }
  const jwk = JWKS.keys.find(k => k.kid === head.kid);
  if (!jwk || head.alg !== "RS256") throw new Error("key");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, fromB64u(sig), new TextEncoder().encode(h + "." + p));
  const now = Date.now() / 1000;
  if (!ok || pay.aud !== PROJECT || pay.iss !== "https://securetoken.google.com/" + PROJECT || pay.exp < now || !pay.sub) throw new Error("token");
  return { uid: pay.sub, email: String(pay.email || "").toLowerCase() };
}

/* ---------- رمز الدخول إلى Firestore بمفتاح الخدمة ---------- */
let GTOKEN = { at: 0, v: "" };
async function googleToken(env) {
  if (GTOKEN.v && Date.now() - GTOKEN.at < 50 * 60e3) return GTOKEN.v;
  const sa = JSON.parse(env.SA), now = Math.floor(Date.now() / 1000);
  const head = b64uStr(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64uStr(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const key = await crypto.subtle.importKey("pkcs8", fromB64u(pem.replace(/\+/g, "-").replace(/\//g, "_")), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = b64u(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(head + "." + body)));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + head + "." + body + "." + sig });
  const j = await r.json();
  if (!j.access_token) throw new Error("google auth: " + JSON.stringify(j).slice(0, 200));
  GTOKEN = { at: Date.now(), v: j.access_token };
  return GTOKEN.v;
}

/* ---------- Firestore عبر REST ---------- */
function enc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v && v.__ts) return { timestampValue: new Date(v.__ts).toISOString() };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  const fields = {}; for (const k in v) if (v[k] !== undefined) fields[k] = enc(v[k]); return { mapValue: { fields } };
}
function dec(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return { ms: Date.parse(v.timestampValue) };
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(dec);
  if ("mapValue" in v) { const o = {}; for (const k in v.mapValue.fields || {}) o[k] = dec(v.mapValue.fields[k]); return o }
  return null;
}
const docData = d => { const o = {}; for (const k in d.fields || {}) o[k] = dec(d.fields[k]); return o };
function makeFS(env) {
  const H = async () => ({ Authorization: "Bearer " + await googleToken(env), "Content-Type": "application/json" });
  return {
    async get(path) {
      const r = await fetch(FS_BASE + "/" + path, { headers: await H() });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("fs get " + r.status);
      const d = await r.json(); return { data: docData(d), updateTime: d.updateTime };
    },
    async where(coll, field, val) {   // أول وثيقة قيمة حقلها تساوي val (يعيد معرّفها)
      const r = await fetch(FS_BASE + ":runQuery", { method: "POST", headers: await H(), body: JSON.stringify({ structuredQuery: { from: [{ collectionId: coll }], where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: enc(val) } }, limit: 1 } }) });
      if (!r.ok) throw new Error("fs where " + r.status);
      const x = (await r.json()).find(y => y.document); return x ? x.document.name.split("/").pop() : "";
    },
    async many(paths) {   // قراءة عدة وثائق بطلب واحد
      if (!paths.length) return {};
      const r = await fetch(FS_BASE + ":batchGet", { method: "POST", headers: await H(), body: JSON.stringify({ documents: paths.map(p => `projects/${PROJECT}/databases/(default)/documents/${p}`) }) });
      if (!r.ok) throw new Error("fs many " + r.status);
      const out = {}; for (const x of await r.json()) if (x.found) out[x.found.name.split("/documents/")[1]] = docData(x.found); return out;
    },
    // قراءة مجمّعة لوثائق بأسمائها مع وقت آخر تعديل: {مسار: {data, updateTime}} أو null إن لم توجد. 100 وثيقة في الطلب.
    // كل وثيقة مطلوبة يجب أن تعود «موجودة» أو «غير موجودة»؛ أي ردّ ناقص أو خطأ = استثناء، فلا تُبنى مقارنة على قراءة ناقصة
    async manyT(paths) {
      const want = [...new Set(paths)], out = {};
      for (let i = 0; i < want.length; i += 100) {
        const part = want.slice(i, i + 100), seen = new Set();
        const r = await fetch(FS_BASE + ":batchGet", { method: "POST", headers: await H(), body: JSON.stringify({ documents: part.map(p => `projects/${PROJECT}/databases/(default)/documents/${p}`) }) });
        if (!r.ok) throw new Error("fs manyT " + r.status);
        const j = await r.json(); if (!Array.isArray(j)) throw new Error("fs manyT: ردّ غير متوقع");
        for (const x of j) {
          if (x.found) { const p = x.found.name.split("/documents/")[1]; out[p] = { data: docData(x.found), updateTime: x.found.updateTime }; seen.add(p) }
          else if (x.missing) { const p = String(x.missing).split("/documents/")[1]; out[p] = null; seen.add(p) }
        }
        for (const p of part) if (!seen.has(p)) throw new Error("fs manyT: ردّ ناقص (" + p + ")");
      }
      return out;
    },
    // كل وثائق المجموعات التي اسمها coll في القاعدة كلها (الاستعلام نفسه الذي تأخذ به النسخة الاحتياطية الهدايا): [{path, data, updateTime}]
    async group(coll) {
      const r = await fetch(FS_BASE + ":runQuery", { method: "POST", headers: await H(), body: JSON.stringify({ structuredQuery: { from: [{ collectionId: coll, allDescendants: true }] } }) });
      if (!r.ok) throw new Error("fs group " + r.status);
      const j = await r.json(); if (!Array.isArray(j)) throw new Error("fs group: ردّ غير متوقع");
      const out = []; for (const x of j) { if (x.error) throw new Error("fs group: " + JSON.stringify(x.error).slice(0, 120)); if (x.document) out.push({ path: x.document.name.split("/documents/")[1], data: docData(x.document), updateTime: x.document.updateTime }) }
      return out;
    },
    async list(coll) {
      const out = []; let tok = "";
      do {
        const r = await fetch(FS_BASE + "/" + coll + "?pageSize=300" + (tok ? "&pageToken=" + tok : ""), { headers: await H() });
        if (!r.ok) throw new Error("fs list " + r.status);
        const j = await r.json(); for (const d of j.documents || []) out.push({ id: d.name.split("/").pop(), ...docData(d) }); tok = j.nextPageToken || "";
      } while (tok);
      return out;
    },
    async page(coll, orderBy, n, tok) {
      const r = await fetch(FS_BASE + "/" + coll + "?pageSize=" + n + "&orderBy=" + encodeURIComponent(orderBy) + (tok ? "&pageToken=" + encodeURIComponent(tok) : ""), { headers: await H() });
      if (!r.ok) throw new Error("fs page " + r.status);
      const j = await r.json(); return { items: (j.documents || []).map(d => ({ id: d.name.split("/").pop(), ...docData(d) })), tok: j.nextPageToken || "" };
    },
    // writes: [{path, data, ifUpdateTime?, ifMissing?}] أو [{path, del: true}] للحذف
    async commit(writes) {
      if (!writes.length) return;
      const body = { writes: writes.map(w => { if (w.del) return { delete: `projects/${PROJECT}/databases/(default)/documents/${w.path}` };
        if (w.inc) return { update: { name: `projects/${PROJECT}/databases/(default)/documents/${w.path}`, fields: {} }, updateMask: { fieldPaths: [] }, updateTransforms: Object.entries(w.inc).map(([f, v]) => ({ fieldPath: f, increment: { integerValue: String(Math.round(v)) } })) }; const x = { update: { name: `projects/${PROJECT}/databases/(default)/documents/${w.path}`, fields: enc(w.data).mapValue.fields } }; if (w.merge) x.updateMask = { fieldPaths: Object.keys(w.data) }; if (w.ifUpdateTime) x.currentDocument = { updateTime: w.ifUpdateTime }; else if (w.ifMissing) x.currentDocument = { exists: false }; return x }) };
      const r = await fetch(FS_BASE + ":commit", { method: "POST", headers: await H(), body: JSON.stringify(body) });
      if (r.status === 409 || r.status === 400 && (await r.clone().text()).includes("FAILED_PRECONDITION")) { const e = new Error("conflict"); e.conflict = true; e.status = r.status; throw e }
      if (!r.ok) { const e = new Error("fs commit " + r.status + " " + (await r.text()).slice(0, 200)); e.status = r.status; throw e }
      // وقت آخر تعديل لكل وثيقة كُتبت (تستعمله بوّابة الأخطاء شرطًا للكتابة التالية)
      try { return ((await r.json()).writeResults || []).map(w => w.updateTime || "") } catch (e) { return [] }
    }
  };
}

/* ---------- كلمات المناهج (للتحقق من كلمات المحطات) ---------- */
let WORDS = { at: 0, set: null };
async function wordSet() {
  if (WORDS.set && Date.now() - WORDS.at < 10 * 60e3) return WORDS.set;
  const c = await (await fetch(SITE + "courses.json?v=" + Date.now())).json(), set = new Set();
  for (const co of c.courses || []) { try { const d = await (await fetch(SITE + co.file + "?v=" + Date.now())).json(); for (const w of d.words || []) set.add(String(w.de).trim().toLowerCase()) } catch (e) { } }
  WORDS = { at: Date.now(), set }; return set;
}

/* ---------- إعدادات المشرف (تُقرأ كل دقيقة على الأكثر) ---------- */
let CFGC = { at: 0, j: null };
async function loadCfg(fs) {
  if (Date.now() - CFGC.at > 60e3) { const d = await fs.get("config/app"); CFGC = { at: Date.now(), j: d ? d.data.v || "" : "" } }
  applyCfg(parseJ(CFGC.j, null));
}

/* ---------- الحالة: تحميلها وحفظها ---------- */
function setState(c, log, qa, ck) {
  P = c.P || {}; QLOG = c.QLOG || []; BUY = c.BUY || []; R = Object.assign({ bank: 0, ach: [], lv: 1, ts: 0 }, c.R || {});
  LG = Object.assign({ tier: null, w: "", hist: [], ts: 0 }, c.LG || {}); EN = c.EN || { v: 30, t: 0 }; STN = c.STN || []; STV = c.STV || 0;
  LOG = unpackLog(log); QA = unpackQA(qa); CK = ck && ck.v ? ck : null; EC = null; CW = c.wiped || 0;
  if (!c.lf) flagLog();             // مرة واحدة: وسم التدريب في السجلّ القديم
  if ((LG.v || 1) < 2) { if (LG.tier != null) LG.tier = 0; LG.v = 2 }
}
const coreObj = () => ({ P, QLOG, BUY, R, LG, EN, STN, STV, ver: 1, lf: 1, ...(CW ? { wiped: CW } : {}) });
const parseJ = (s, d) => { try { return s ? JSON.parse(s) : d } catch (e) { return d } };

/* ---------- الدوري: التسوية الأسبوعية وسطر المتعلّم ---------- */
async function leagueStep(fs, uid, prof, now, writes) {
  const cur = weekId(now);
  if (LG.tier == null) { LG.tier = 0; LG.v = 2; LG.w = cur; LG.ts = now }
  else if (LG.w !== cur) {
    const last = weekId(weekStart(now) - 3 * DAY), docs = await fs.list(`lg/${last}/m`), me = docs.find(d => d.id === uid);
    if (me && me.xp > 0) {
      const prev = await fs.list(`lg/${weekId(weekStart(now) - 10 * DAY)}/m`), rows = tableFor(uid, last, docs, prev, 1);
      const n = rows.length, rank = rows.findIndex(r => r.id === uid) + 1, realRank = rows.filter(r => !r.bot).findIndex(r => r.id === uid) + 1, { up, down } = zones(n, me.tier);
      let mv = 0; if (rank && rank <= up && me.xp >= PROMO_MIN && me.tier < 9) mv = 1; else if (rank && down && rank > n - down && me.tier > 0) mv = -1;
      lgPush({ w: last, tier: me.tier, rank, n, mv, g: prizeOf(realRank, me.xp), xp: me.xp });   // آخر 52 أسبوعًا، وجوائز ما قبلها تُطوى في LG.hg
      LG.tier = me.tier + mv; LG.best = Math.max(LG.best || 0, LG.tier);
    }
    LG.w = cur; LG.ts = now;
  }
  const ws = weekStart(now), xp = weekXP(ws), path = `lg/${cur}/m/${uid}`, mine = await fs.get(path), me = mine && mine.data;
  if (!me && !xp) return;
  let grp, b;
  if (me && me.tier === LG.tier) { grp = me.grp; b = me.b }
  else { b = Math.min(5, Math.floor(measure().total / 20)); grp = chooseGroupFrom(await fs.list(`lg/${cur}/m`), LG.tier, b) }
  const doc = { name: prof.name, av: prof.av, fr: prof.fr, st: prof.st, nc: prof.nc, tier: LG.tier, grp, b, xp };
  if (prof.solo) doc.solo = true;
  const same = me && Object.keys(doc).every(k => me[k] === doc[k]) && !!me.solo === !!prof.solo;
  if (!same) writes.push({ path, data: { ...doc, ts: { __ts: now } } });
}

/* ---------- طلب واحد في كل مرة: المنطق المشترك يعمل على متغيّرات عامة ---------- */
let LOCK = Promise.resolve();
function serial(fn) { const p = LOCK.then(fn, fn); LOCK = p.then(() => { }, () => { }); return p }

/* ---------- معالجة طلب المزامنة ---------- */
// opts.reapply (من handleSxq وحدها، لا من جسم الطلب): إعادة تطبيق حدث من الحجر بأمر المشرف. انظر sxReapply
async function handleSync(fs, user, body, opts) {
  const RE = opts && opts.reapply ? opts : null;
  FREEU = false; STMAXU = 0; SRSU = false; SXU = false; LATE = []; LATEF = {};
  const now = Date.now(), uid = user.uid, admin = user.email === ADMIN;
  await loadCfg(fs);
  FREEU = CFG.free.includes(uid);   // الدراسة الحرّة لهذا الحساب
  STMAXU = (CFG.stn || {})[uid] || 0;   // عدد محطاته اليومية إن حدّده المشرف
  SRSU = !admin && ((CFG.srs || {}).u || []).includes(uid);   // التحقّق من التذكّر: للحسابات التي يختارها المشرف فقط (ومع on وt0 في srsOn)
  SXU = !!(RE || CFG.sx && (CFG.sx.on || CFG.sx.u.includes(uid)));   // المزامنة الجديدة (مفتاح الإيقاف): للجميع أو لحسابات بأعيانها
  const SXI = SXU || !!(CFG.sx && CFG.sx.ids);   // أرقام الأحداث ومنع التكرار: مع المزامنة الجديدة، أو وحدهما بالقواعد القديمة (وضع التراجع الآمن)
  const [uDoc, coreD, logD, qaD, nameD, gifts, ckD, sxD] = await Promise.all([
    fs.get(`users/${uid}`), fs.get(`users/${uid}/data/core`), fs.get(`users/${uid}/data/log`), fs.get(`users/${uid}/data/qa`),
    fs.get(`names/${uid}`), fs.list(`gifts/${uid}/g`), fs.get(`users/${uid}/data/ck`), SXI ? fs.get(`users/${uid}/data/sx`) : null]);
  // الحساب المفعّل فقط
  if (!admin && !uDoc && !(await fs.get(`members/${uid}`))) return { status: 403, json: { error: "inactive" } };
  const u = uDoc ? uDoc.data : {};
  // أول مرة: نقل البيانات الحالية من الحساب (قبل الخادم) مرة واحدة
  let c;
  if (coreD) c = parseJ(coreD.data.v, {});
  else { const m = parseJ(u.main, {}); c = { P: m.P, QLOG: m.QLOG, BUY: m.BUY, R: m.R, LG: m.LG, EN: m.EN, STN: m.STN, STV: 0 } }
  setState(c, parseJ(logD && logD.data.v, null), parseJ(qaD && qaD.data.v, null), parseJ(ckD && ckD.data.v, null));
  // مستخدم جديد تمامًا (أول دخول، بلا بيانات سابقة): طاقة بلا حدود أول 24 ساعة، ليتعلّم ما يكفي فتكون له كلمات يراجعها في اليوم التالي
  if (!coreD && !u.main) EN.u = Math.max(EN.u || 0, now + 24 * 3600e3);
  GIFTS = gifts.map(g => ({ id: g.id, g: g.g || 0, note: g.note || "", ts: g.ts }));
  // وثيقة sx المستقلّة (لا يقرؤها الخادم القديم ولا يكتبها): أرقام كل جهاز، والمراجعات المتأخّرة، والحجر
  const sx = sxLoad(sxD), sxBefore = sxSave(sx); if (SXI) { LATE = sx.late; LATEF = sx.lf }
  const before = { log: LOG.length, l0: LOG.length ? LOG[0][0] : 0, l1: LOG.length ? LOG[LOG.length - 1][0] : 0, qa: QA.length, core: JSON.stringify(coreObj()), ck: CK ? CK.t : 0 };
  // الأحداث
  const evs = Array.isArray(body.evs) ? body.evs.slice(0, 300) : [], rej = [], st = [], sxArch = [];
  // فرق ساعة الهاتف (ct: ساعته لحظة الإرسال) عن ساعة الخادم؛ يُهمل ما دون دقيقتين (تأخّر الشبكة) وما فوق سنة (قيمة غير معقولة)
  const ct = +body.ct, sk0 = Number.isFinite(ct) && ct > 0 ? ct - now : 0, sk = Math.abs(sk0) > 120e3 && Math.abs(sk0) < 365 * 864e5 ? sk0 : 0;
  let words = null;
  for (let i = 0; i < evs.length; i++) {
    const e = evs[i]; if (!e || typeof e !== "object") { rej.push(i); st.push("bad"); continue }
    // المزامنة الجديدة: الحدث المعروف (الجهاز والرقم نفسهما) «وصل سابقًا» فلا يُطبَّق مرة ثانية
    // التحقق من الهوية: معرّف جهاز بالشكل المقبول، ورقم صحيح موجب آمن لا يتجاوز الآن بأكثر من 400 يوم (الرقم ≈ وقت الإنشاء بالملّي ثانية).
    // حدث بلا هوية (تطبيق قديم، ومفرداتي ٢ اليوم) يُقبل جهازًا «_» كما كان؛ وهوية موجودة لكنها غير صالحة → الحجر «badid» (لا تطبيق بلا منع تكرار)
    const badId = SXI && ((e.d !== undefined && (typeof e.d !== "string" || !SX_DEV.test(e.d))) || (e.n !== undefined && !(Number.isSafeInteger(e.n) && e.n > 0 && e.n <= now + 400 * 864e5)));
    if (badId && !RE) { if (SXU) { const q = sxPut(sx, sxArch, uid, now, "badid", e, i); st.push(q); rej.push([i, q === "big" ? "big" : "badid"]) } else { st.push("rej"); rej.push([i, "badid"]) } continue }
    // حدّ سجلّات الأجهزة (وإعادة التطبيق لا تتجاوزه أيضًا): جهاز جديد بعد بلوغ SX_DEVCAP سجلًّا (لا يحدث إلا بآلاف المعرّفات في أسابيع) → الحجر «devmax»، لا طيّ لأرض حديثة
    if (SXI && !sx.dv[sxDevKey(e)] && Object.keys(sx.dv).length >= SX_DEVCAP) { if (RE) { st.push("q"); rej.push([i, "devmax"]); sxMark(sx, RE.qids ? RE.qids[i] : RE.qid, now, "devmax", RE.rd); continue } const q = sxPut(sx, sxArch, uid, now, "devmax", e, i); st.push(q); rej.push([i, q === "big" ? "big" : "devmax"]); continue }
    const dv = SXI ? sxDev(sx, e) : null, n = SXI && Number.isSafeInteger(e.n) && e.n > 0 ? e.n : 0;
    if (RE && CW && (+e.t || 0) < CW) { st.push("wiped"); rej.push([i, "wiped"]); continue }   // ما قبل حذف بيانات الحساب لا يُعاد
    if (RE) { if (RE.qids) RE.qid = RE.qids[i]; const r = sxReapply(sx, dv, e, now, { server: true, admin, words: e.type === "stDone" ? await wordSet() : null, duelOk: false, dwinOk: false }, RE);
      st.push(r === true ? "ok" : r === "late" ? "late" : "q"); if (r !== true && r !== "late") rej.push([i, r]); continue }
    if (dv && n && sxHas(dv, n)) { st.push("dup"); continue }
    // رقم لا يزيد على أرض الجهاز lo: حدث أُنشئ قبل حدثٍ وصل قبل أكثر من أطول مدّة قبول، فهو أقدم منها مهما قالت ساعة الهاتف → الحجر «old»
    const below = dv && n && n <= dv.lo;
    if (CW && (+e.t || 0) < CW) { rej.push([i, "wiped"]); st.push("wiped"); if (dv && n) sxSeen(dv, n, now); continue }      // أحداث من قبل حذف المشرف لا تُقبل
    // حدث أكبر مما تتّسع له وثيقة واحدة: لا يُقرّ باستلامه (لا يحذفه الهاتف)، ولا يُطبَّق
    const eb = SXI ? sxBytes(JSON.stringify(e)) : 0;
    if (eb > SX_EVMAX) { st.push("big"); rej.push([i, "big"]); continue }
    if (e.type === "stDone" && !words) words = await wordSet();
    let duelOk = false, dwinOk = false;
    if (e.type === "dwin") { const dd = /^[A-Za-z0-9_-]{4,40}$/.test(String(e.id || "")) ? await fs.get(`duel/${e.id}`) : null;
      dwinOk = !!(dd && duelWinner(dd.data) === uid) }   // حدث التحدي: يُقبل فقط إن كان لاعبًا فيه وأنهى كل أسئلته
    if (e.type === "duel") { const dd = /^[A-Za-z0-9_-]{4,40}$/.test(String(e.id || "")) ? await fs.get(`duel/${e.id}`) : null;
      duelOk = !!(dd && dAct(dd.data).includes(uid) && dProg(dd.data, uid).d && !dProg(dd.data, uid).q) }
    EC = null; const r = below ? "old" : applyEv(e, Math.max(now - 1, Date.now()), { server: true, admin, words, duelOk, dwinOk, ...(SXU && dv ? { dv, sk } : {}) });
    if (!SXU) { if (dv && n) sxSeen(dv, n, now); if (r !== true) rej.push([i, r]); st.push(r === true ? "ok" : "rej"); continue }   // وضع الأرقام وحدها: القواعد القديمة
    // لا حذف بصمت: ما لم يُقبل يُحفظ في الحجر مع سببه، ويُسجَّل رقمه فلا يتكرّر في الحجر عند إعادة الإرسال
    if (n) sxSeen(dv, n, now);
    if (r === true) st.push("ok"); else if (r === "late") st.push("late");
    else { sxPut(sx, sxArch, uid, now, String(r), e, i, eb); rej.push([i, r]); st.push("q") }
  }
  if (SXU) { for (let i = 1; i < LOG.length; i++) if (LOG[i][0] < LOG[i - 1][0]) { LOG.sort((a, b) => a[0] - b[0]); break }   // احتياط: السجلّ مرتّب دائمًا
    }
  if (SXI) sxArch.push(...sxTrim(sx, now, uid, sxArch.length));
  // المظهر الذي اختاره المتعلّم (يُتحقّق من ملكيّته)
  const pr = parseJ(u.prefs, {}), E = pr.E || {};
  const avIt = SHOP.find(x => x.cat === "avatar" && x.val === E.avatar), lf = E.lgFrame ?? E.frame, ls = E.lgSticker ?? E.sticker;
  const prof = {
    name: String((nameD && nameD.data.name) || user.email.split("@")[0]).slice(0, 60),
    av: avIt && owned("avatar", avIt.id) ? avIt.val : "🎓",
    fr: lf && owned("frame", lf) ? lf : "none",
    st: (() => { const v = stkVal(ls); const it = SHOP.find(x => x.cat === "sticker" && x.val === v); return it && owned("sticker", it.id) ? v : "" })(),
    nc: E.ncolor && E.ncolor !== "none" && owned("namecolor", E.ncolor) ? E.ncolor : (admin ? "admin" : ""),
    solo: admin && !!E.lgSolo
  };
  const writes = [];
  EC = null; await leagueStep(fs, uid, prof, now, writes);
  // الملف العام: المظهر عند كل تغيير، والأرقام (المستوى والسلسلة والإنجازات) كل 10 دقائق على الأكثر توفيرًا للمعالجة
  const hide = !!E.hidePub;   // المتعلّم اختار إخفاء ملفه: يظهر اسمه ومظهره ودوريه فقط
  const look = hide ? { name: prof.name, av: prof.av, nc: prof.nc, fr: prof.fr, tier: LG.tier ?? 0, hide: 1 } : { name: prof.name, av: prof.av, nc: prof.nc, fr: prof.fr, tier: LG.tier ?? 0,
    stk: SHOP.filter(x => x.cat === "sticker" && owned("sticker", x.id)).map(x => x.val) };
  const lookJ = JSON.stringify(look), old = parseJ(c.pubJ, null);
  let pub, pubAt = c.pubAt || 0;
  if (old && c.pubL === lookJ && now - pubAt < 10 * 60e3 && !evs.some(x => x && (x.type === "reset" || x.type === "buy"))) pub = old;
  else {
    const e = EC || econ(), alv = {}; achList().forEach(a => { if (e.alv[a.id]) alv[a.id] = e.alv[a.id] });
    pub = hide ? { ...look } : { ...look, lv: e.lv, xp: e.xp, streak: e.s.streak, best: e.s.best, alv }; pubAt = now;
  }
  const pubJ = JSON.stringify(pub);
  // الحفظ
  const coreJ = JSON.stringify(coreObj()), logJ = JSON.stringify(packLog(LOG)), qaJ = JSON.stringify(packQA(QA));
  const cw = [];
  if (!coreD || coreJ !== before.core || c.pubJ !== pubJ || c.pubAt !== pubAt) cw.push({ path: `users/${uid}/data/core`, data: { v: coreJ.slice(0, -1) + "," + JSON.stringify({ pubJ, pubL: lookJ, pubAt }).slice(1) }, ...(coreD ? { ifUpdateTime: coreD.updateTime } : { ifMissing: true }) });
  // السجل يُحفظ إن تغيّر طوله أو أوّله أو آخره (عند الحدّ يبقى الطول ثابتًا وإن تغيّر المحتوى)
  const l0 = LOG.length ? LOG[0][0] : 0, l1 = LOG.length ? LOG[LOG.length - 1][0] : 0;
  if (!logD || LOG.length !== before.log || l0 !== before.l0 || l1 !== before.l1 || !c.lf || evs.some(x => x && x.type === "reset")) cw.push({ path: `users/${uid}/data/log`, data: { v: logJ } });
  // نقطة الحفظ: وثيقة مستقلة تُكتب عند الطيّ فقط
  const ckT = CK ? CK.t : 0, ckJ = CK ? JSON.stringify(CK) : "";
  if (ckT !== before.ck) cw.push({ path: `users/${uid}/data/ck`, data: { v: ckJ } });
  if (!qaD || QA.length !== before.qa || evs.some(x => x && x.type === "reset")) cw.push({ path: `users/${uid}/data/qa`, data: { v: qaJ } });
  if (c.pubJ !== pubJ) cw.push({ path: `pub/${uid}`, data: { ...pub, ts: { __ts: now } } });
  const sxJ = sxSave(sx);
  if (sxBytes(sxJ) > SX_HARD) throw new Error("sx too big " + sxBytes(sxJ));   // لا تُكتب وثيقة تتجاوز حدّ Firestore (يُرفض الطلب كله، ولا يُقرّ بشيء)
  if (SXI && sxJ !== sxBefore) cw.push({ path: `users/${uid}/data/sx`, data: { v: sxJ }, ...(sxD ? { ifUpdateTime: sxD.updateTime } : { ifMissing: true }) }, ...sxArch);
  await fs.commit([...cw, ...writes]);
  // آلية رقم النسخة: إن أرسل التطبيق رقم نسخة مختلفًا، نرسل له الأرقام كما يحسبها الخادم ليعرضها بدل حسابه هو (لا تغيير في أي قاعدة)
  let sum;
  if (body.cv && body.cv !== CORE_V) { EC = null; const x = econ(); sum = { gems: x.gems, xp: x.xp, lv: x.lv, rest: x.rest, need: x.need, streak: x.s.streak, today: !!x.s.today } }
  // نقطة الحفظ تُرسل للتطبيق فقط حين تختلف عمّا عنده (يرسل وقتها ckt)
  // المزامنة الجديدة: حالة كل حدث (ok | late | dup | q | wiped | bad)، والمراجعات المتأخّرة، وأعلى رقم يعرفه الخادم لهذا الجهاز
  // sxv: هذا خادم يعرف الإقرار بحالة لكل حدث، فيعيد st دائمًا (ولو كان المفتاح مطفأً). التطبيق لا يحذف شيئًا من ردّ فيه sxv دون st كاملة
  const sxOut = { sxv: 1, st, ...(SXI ? { dn: sxMax(sx, body.dev), now } : {}), late: JSON.stringify(SXI ? { L: LATE, F: LATEF } : { L: [], F: {} }) };   // المتأخّرات تُرسل دائمًا كما حسبها الخادم (فارغة إن كان المفتاح مطفأً كليًّا)، فلا تبقى في الصفحة نسخة قديمة تخالفه
  return { status: 200, json: { core: coreJ, log: logJ, qa: qaJ, rej, prefs: u.prefs || "", cv: CORE_V, ...sxOut, ...(sum ? { sum } : {}), ...(+body.ckt !== ckT ? { ck: ckJ } : {}) } };
}

/* ---------- الحجر: لوحة المشرف وإعادة التطبيق ---------- */
// مفتاح الحدث: الجهاز والرقم، أو بصمة محتواه إن لم يكن له رقم. sx.ap: مفاتيح ما أُعيد تطبيقه (لا يُعاد مرتين أبدًا)
const sxKey = e => e && e.n ? `${e.d || "_"}:${e.n}` : "h:" + JSON.stringify(e).length + ":" + [...JSON.stringify(e)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36);
// إعادة التطبيق: مرة واحدة لكل حدث، بقواعد المتأخّر كلها (انظر applySx: re)، والنتيجة تُسجَّل على مدخل الحجر نفسه
// مدخل الحجر: [وقت الاستلام، السبب، الحدث، نتيجة إعادة التطبيق أو null، معرّف ثابت]. المعرّف لا يتغيّر بالأرشفة ولا بترتيب القائمة
const sxQ = (now, why, ev, i) => [now, why, ev, null, "q" + now.toString(36) + "-" + i + "-" + Math.random().toString(36).slice(2, 7)];
// الإدخال الوحيد إلى الحجر (كل الأسباب، ومنها الهوية غير الصالحة): الحجم بالبايت أولًا. أكبر مما تتّسع له وثيقة → «big» (لا يُحفظ ولا يُقرّ به)؛
// أكبر من 32 كيلوبايت → وثيقة أرشيف مستقلة بالحدث كاملًا والمدخل يشير إليها؛ وإلا فالحدث كاملًا في المدخل
function sxPut(sx, sxArch, uid, now, why, e, i, eb) {
  eb = eb || sxBytes(JSON.stringify(e)); if (eb > SX_EVMAX) return "big";
  if (eb > SX_EVDOC) { const ref = sxArchName(now, sxArch.length); sxArch.push({ path: `users/${uid}/data/${ref}`, data: { v: JSON.stringify({ ev: e, why, at: now }) }, ifMissing: true }); sx.an.push(ref); sx.qz.push(sxQ(now, why, { ref, bytes: eb }, i)) }
  else sx.qz.push(sxQ(now, why, JSON.parse(JSON.stringify(e)), i));
  return "q";
}
function sxReapply(sx, dv, e, now, ctx, RE) {
  const key = sxKey(e); if (sx.ap.includes(key) || (RE.apx && RE.apx.has(key))) return "applied";
  if (e.type === "dwin" || e.type === "duel") return "noverify";   // يحتاج تحقّقًا من وثيقة التحدّي: لا يُعاد من هنا
  EC = null; const r = applyEv(e, now, { ...ctx, dv, reapply: true });
  if (r === true || r === "late") sx.ap.push(key);
  sxMark(sx, RE.qid, now, r === true ? "ok" : String(r), RE.rd);
  return r;
}
// نتيجة محاولة إعادة التطبيق على مدخلها: في الحجر الحالي، أو في سجلّ نتائج الأرشيف بالمعرّف (rd: جولة الاستعادة بالترتيب)
function sxMark(sx, qid, now, r, rd) { if (!qid) return; const mark = { ap: now, r, ...(rd ? { rd } : {}) };
  const q = sx.qz.find(x => x[4] === qid); if (q) q[3] = mark; else (sx.am = sx.am || {})[qid] = mark }
/* ---------- استعادة جهاز بالترتيب (المشرف) ----------
   الخطة: كل مدخلات الحجر لجهاز واحد (في الوثيقة والأرشيف معًا) مرتّبة برقم الحدث n، أي ترتيب إنشائها على الجهاز (المحطة قبل مراجعات كلماتها).
   «preview»: تشغيل كامل على نسخة في الذاكرة (لا كتابة إطلاقًا)، بجولات يُعاد فيها ما رُفض لأن كلمته لم تُتعلَّم بعد؛ ونتيجة كل مدخل، والأرقام قبل وبعد، وبصمة الخطة.
   «run»: يتطلّب confirm وبصمة الخطة نفسها (مدخل جديد للجهاز منذ المعاينة يغيّر البصمة → «stale» وتُعاد المعاينة)، وينفّذ دفعة (حتى SX_RSN مدخلًا)
   في طلب واحد ويعيد more إن بقي شيء، والصفحة تكرّر الطلب. منع التكرار: مفاتيح ما أُعيد تطبيقه (ap) ونتيجة كل مدخل مسجّلة عليه؛
   فالضغط مرتين أو انقطاع الشبكة أو إعادة التشغيل لا يطبّق شيئًا مرتين («applied»). وإعادة التطبيق لا تتجاوز حدّ سجلّات الأجهزة («devmax»). */
const SX_RSN = 50, SX_RSPASS = 3, SX_RSDONE = new Set(["ok", "late", "applied", "dupc", "dup", "wiped"]);
async function sxCands(fs, uid, sx, IX, dev) {
  const out = [], add = (q, src) => out.push({ q, src, ref: q[2] && q[2].ref ? q[2].ref : null, e: q[2] && q[2].ref ? null : q[2] });
  for (const q of sx.qz) add(q, "qz");
  if (IX.an.length) { const A = await fs.manyT(IX.an.map(n => `users/${uid}/data/${n}`));
    for (const n of IX.an) { const a = A[`users/${uid}/data/${n}`], x = a ? parseJ(a.data.v, null) : null;
      if (!x || typeof x !== "object") throw Object.assign(new Error(a ? "sx archive corrupt" : "sx archive missing"), { sxIdx: n });
      for (const q of x.qz || []) add(q, n) } }
  const refs = out.filter(c => c.ref); if (refs.length) { const R = await fs.manyT(refs.map(c => `users/${uid}/data/${c.ref}`));   // الأحداث الكبيرة: من وثيقتها المرجعية
    for (const c of refs) { const a = R[`users/${uid}/data/${c.ref}`], x = a ? parseJ(a.data.v, null) : null; if (!x || !x.ev) throw Object.assign(new Error("sx ref missing"), { sxIdx: c.ref }); c.e = x.ev } }
  const C = out.filter(c => c.e && typeof c.e === "object" && sxDevKey(c.e) === dev && Number.isSafeInteger(c.e.n) && c.e.n > 0);
  C.sort((a, b) => a.e.n - b.e.n || (a.q[4] < b.q[4] ? -1 : 1)); return C;
}
const sxPlanHash = C => { let h = 2166136261 >>> 0; for (const c of C) for (const ch of c.q[4] + ";") { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0 } return C.length + "-" + h.toString(36) };
// نسخة في الذاكرة فوق قاعدة البيانات: القراءة منها أولًا، والكتابة إليها وحدها (للمعاينة)
function overlayFS(fs) { const M = new Map(); let ut = 0;
  const g = p => M.has(p) ? (M.get(p) ? { data: JSON.parse(JSON.stringify(M.get(p).data)), updateTime: M.get(p).ut } : null) : undefined;
  return { async get(p) { const x = g(p); return x !== undefined ? x : fs.get(p) }, async list(c) { return fs.list(c) },
    async manyT(ps) { const miss = ps.filter(p => g(p) === undefined), R = miss.length ? await fs.manyT(miss) : {}, o = {}; for (const p of ps) { const x = g(p); o[p] = x !== undefined ? x : R[p] } return o },
    async many(ps) { return this.manyT(ps) },
    async commit(ws) { for (const w of ws) { if (w.del) { M.set(w.path, null); continue } if (w.inc) continue; const o = g(w.path); M.set(w.path, { data: w.merge && o ? { ...o.data, ...w.data } : w.data, ut: "ov" + (++ut) }) } return {} } } }
async function sxSnap(fs, uid) { await handleSync(fs, { uid, email: "(restore)" }, { evs: [] }, { reapply: true, qid: "" }); EC = null; const x = econ(); return { xp: x.xp, gems: x.gems, reviews: x.s.reviews, words: Object.keys(P).length, stations: STN.length } }
// بصمة حالة تقدّم الحساب: أوقات آخر تعديل لوثائقه (التقدّم والسجلّ والإجابات ونقطة الحفظ وsx). أي مزامنة أو تعديل بعد المعاينة يغيّرها
const SX_STK = ["core", "log", "qa", "ck", "sx"];
async function sxStateTok(fs, uid) { const D = await fs.manyT(SX_STK.map(k => `users/${uid}/data/${k}`)); let h = 2166136261 >>> 0;
  for (const k of SX_STK) { const d = D[`users/${uid}/data/${k}`]; for (const ch of k + "=" + (d ? String(d.updateTime || "") : "-") + ";") { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0 } } return h.toString(36) }
async function sxRestore(fs, uid, sx, d, IX, body) {
  const dev = String(body.dev || ""); if (!(dev === "_" || SX_DEV.test(dev))) return { status: 400, json: { error: "dev" } };
  const mode = String(body.mode || "preview"), C = await sxCands(fs, uid, sx, IX, dev), plan = sxPlanHash(C);
  if (!C.length) return { status: 200, json: { plan, n: 0, done: true } };
  if (mode === "preview") {
    const state = await sxStateTok(fs, uid);   // قبل أي شيء: حالة الحساب التي بُنيت عليها المعاينة
    const O = overlayFS(fs), before = await sxSnap(O, uid), res = {}; let todo = C.filter(c => !c.q[3] || !SX_RSDONE.has(c.q[3].r)); const skipped = C.length - todo.length;
    for (let pass = 1; pass <= SX_RSPASS && todo.length; pass++) { const again = [];
      for (let i = 0; i < todo.length; i += SX_RSN) { const B = todo.slice(i, i + SX_RSN);
        const r = await handleSync(O, { uid, email: "(restore)" }, { evs: B.map(c => c.e) }, { reapply: true, qids: B.map(c => c.q[4]), apx: IX.ap, rd: pass });
        B.forEach((c, j) => { const st = r.json.st[j], why = st === "ok" || st === "late" ? st : ((r.json.rej.find(x => x[0] === j) || [])[1] || st); res[c.q[4]] = why; if (why === "word") again.push(c) }) }
      if (again.length === todo.length) break; todo = again }
    const after = await sxSnap(O, uid), count = {}; for (const k in res) count[res[k]] = (count[res[k]] || 0) + 1;
    return { status: 200, json: { plan, state, n: C.length, skipped, count, before, after,
      rows: C.map(c => ({ qid: c.q[4], type: c.e.type, n: c.e.n, t: c.e.t, k: c.e.k, why: c.q[1], prev: c.q[3] ? c.q[3].r : null, will: res[c.q[4]] || (c.q[3] && c.q[3].r) || null })) } } }
  if (mode !== "run") return { status: 400, json: { error: "mode" } };
  if (body.confirm !== true) return { status: 400, json: { error: "confirm" } };
  if (String(body.plan || "") !== plan) return { status: 409, json: { error: "stale", plan } };
  // تغيّرت حالة تقدّم الحساب منذ المعاينة (أو منذ الدفعة السابقة من هذا التنفيذ نفسه): رفض، وتُعاد المعاينة. كل دفعة تعيد البصمة الجديدة بعد كتابتها
  if (String(body.state || "") !== await sxStateTok(fs, uid)) return { status: 409, json: { error: "stale-state" } };
  const rd = Math.max(1, Math.min(SX_RSPASS, +body.round || 1));
  // المعلّق في هذه الجولة: بلا نتيجة، أو «word» من جولة سابقة
  const pend = C.filter(c => !c.q[3] || (c.q[3].r === "word" && (c.q[3].rd || 0) < rd)), todo = pend.slice(0, SX_RSN);
  if (!todo.length) return { status: 200, json: { plan, state: String(body.state), done: true, more: false, round: rd, word: C.filter(c => c.q[3] && c.q[3].r === "word").length } };
  const r = await handleSync(fs, { uid, email: "(restore)" }, { evs: todo.map(c => c.e) }, { reapply: true, qids: todo.map(c => c.q[4]), apx: IX.ap, rd });
  return { status: 200, json: { plan, state: await sxStateTok(fs, uid), done: false, more: true, round: rd, left: pend.length - todo.length,
    out: todo.map((c, j) => ({ qid: c.q[4], st: r.json.st[j], why: (r.json.rej.find(x => x[0] === j) || [])[1] || null })) } };
}
// /sxq (المشرف): users | list | arch | apply | restore
async function handleSxq(fs, user, body) {
  if (user.email !== ADMIN) return { status: 403, json: { error: "admin" } };
  const op = String(body.op || "users"), uid = String(body.uid || "");
  if (op !== "users" && !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return { status: 400, json: { error: "uid" } };
  const ev = x => x && x.ref ? { type: "(كبير)", ref: x.ref, bytes: x.bytes } : x;
  const row = (src, q, m) => { const e = ev(q[2]) || {}; return { qid: q[4], src, at: q[0], why: q[1], type: e.type, t: e.t, n: e.n, d: e.d, k: e.k, kind: e.kind, ref: e.ref, ap: m || null } };
  if (op === "users") {
    const us = await fs.list("users"), D = await fs.manyT(us.map(u => `users/${u.id}/data/sx`)), N = await fs.manyT(us.map(u => `names/${u.id}`)), out = [];
    for (const u of us) { const d = D[`users/${u.id}/data/sx`]; if (!d) continue; const x = sxLoad(d);
      out.push({ uid: u.id, name: (N[`names/${u.id}`] || { data: {} }).data.name || u.name || "", qz: x.qz.length, open: x.qz.filter(q => !q[3]).length, an: x.an.length, ap: x.ap.length, dev: Object.keys(x.dv).length }) }
    return { status: 200, json: { users: out } } }
  const d = await fs.get(`users/${uid}/data/sx`); if (!d) return { status: 404, json: { error: "nosx" } }; const sx = sxLoad(d);
  const IX = await sxIndex(fs, uid, sx);   // أسماء الأرشيف ونتائجه ومفاتيح ما أُعيد تطبيقه، بما نُقل منها إلى وثائق الفهرس
  if (op === "list") return { status: 200, json: { qz: sx.qz.map(q => row("qz", q, q[3])), an: IX.an } };
  if (op === "arch") { const name = String(body.name || ""); if (!IX.an.includes(name)) return { status: 404, json: { error: "noarch" } };
    const a = await fs.get(`users/${uid}/data/${name}`); const x = parseJ(a && a.data.v, {}) || {};
    if (x.ev) return { status: 200, json: { big: 1, ev: x.ev, why: x.why, at: x.at } };
    return { status: 200, json: { qz: (x.qz || []).map(q => row(name, q, IX.am[q[4]])), late: (x.late || []).length } } }
  if (op === "restore") return await sxRestore(fs, uid, sx, d, IX, body);
  if (op === "apply") {
    // بالمعرّف الثابت: يُبحث في الحجر الحالي، ثم في وثائق الأرشيف (لو نقلته مزامنةٌ إلى الأرشيف بعد عرض القائمة)
    const qid = String(body.qid || ""); if (!/^q[a-z0-9-]{4,40}$/.test(qid)) return { status: 400, json: { error: "qid" } };
    let q = sx.qz.find(x => x[4] === qid) || null;
    for (let k = IX.an.length - 1; !q && k >= 0; k--) { const a = await fs.get(`users/${uid}/data/${IX.an[k]}`); const x = a ? parseJ(a.data.v, null) : null;
      if (!x || typeof x !== "object") throw Object.assign(new Error(a ? "sx archive corrupt" : "sx archive missing"), { sxIdx: IX.an[k] }); q = (x.qz || []).find(y => y[4] === qid) || null }
    if (!q) return { status: 404, json: { error: "noentry" } };
    let e = q[2];
    if (e && e.ref) { const a = await fs.get(`users/${uid}/data/${e.ref}`); e = (parseJ(a && a.data.v, {}) || {}).ev; if (!e) return { status: 404, json: { error: "noref" } } }
    const r = await handleSync(fs, { uid, email: "(reapply)" }, { evs: [e] }, { reapply: true, qid, apx: IX.ap });
    return { status: 200, json: { st: r.json.st && r.json.st[0], rej: r.json.rej } } }
  return { status: 400, json: { error: "op" } };
}

// الفهرس كاملًا: ما في sx مع ما نُقل إلى وثائق الفهرس (sxi-…)
// وثائق الفهرس سلسلة: حين تبلغ قائمة ai في sx حدّها SX_AIMAX تنتقل أسماؤها كلها إلى وثيقة الفهرس الجديدة (حقل ai فيها)، فتُقرأ طبقة بعد طبقة
async function sxIndex(fs, uid, sx) {
  const ap = new Set(sx.ap), am = {}, old = [], all = []; let q = [...(sx.ai || [])]; const seen = new Set();
  for (let depth = 0; q.length; depth++) { q = q.filter(n => !seen.has(n) && seen.add(n)); if (!q.length) break;
    if (depth >= SX_AIDEPTH) throw Object.assign(new Error("sx index depth"), { sxDeep: true });   // لا تجاهل صامت: العملية كلها تتوقّف ويُبلَّغ المشرف
    const D = await fs.manyT(q.map(n => `users/${uid}/data/${n}`)), next = [];
    for (const n of q) { all.push(n); const d = D[`users/${uid}/data/${n}`], x = d ? parseJ(d.data.v, null) : null;
      // وثيقة فهرس مفقودة أو تالفة: لا قائمة ناقصة — تتوقّف اللوحة والاستعادة والحذف بخطأ واضح
      if (!x || typeof x !== "object" || !Array.isArray(x.an) || !Array.isArray(x.ap) || (x.ai !== undefined && !Array.isArray(x.ai)) || (x.am !== undefined && (!x.am || typeof x.am !== "object" || Array.isArray(x.am))))
        throw Object.assign(new Error(d ? "sx index corrupt" : "sx index missing"), { sxIdx: n });
      old.unshift(...(x.an || [])); for (const k of x.ap || []) ap.add(k); for (const k in x.am || {}) if (!(k in am)) am[k] = x.am[k];
      for (const m of x.ai || []) if (typeof m === "string" && /^sxi-[a-z0-9-]+$/.test(m)) next.push(m) }
    q = next }
  Object.assign(am, sx.am || {});
  return { an: [...old, ...sx.an], ap, am, ai: all };
}
/* ---------- وثيقة sx (المزامنة الجديدة) ---------- */
// dv: {جهاز: {g: {يوم الاستلام (بتوقيت الخادم): أرقام الأحداث التي وصلت فيه}, lo: أرض الجهاز, lt, r0, q}}
// late/lf: المراجعات المتأخّرة، qz: الحجر [[وقت الاستلام، السبب، الحدث كاملًا أو {ref, bytes}]]، ax: عدد وثائق الأرشيف
//
// منع التكرار بالرقم نفسه (لا «كل ما دون رقم»). الأرقام تُجمع بيوم استلامها في الخادم، وتُحذف مجموعة اليوم بعد أطول مدّة قبول + يومين
// (بساعة الخادم وحدها). عند حذفها ترتفع أرض الجهاز lo إلى أكبر رقم فيها. والحدث برقم ≤ lo لا يُطبَّق أبدًا (الحجر «old»).
// لماذا هذا آمن مهما فعلت ساعة الهاتف: كل رقم حُذف ≤ lo، فإعادته لا تُطبَّق؛ وكل رقم > lo وصل في آخر 32 يومًا محفوظ بعينه.
// والحدث الحقيقي الذي لم يصل ورقمه ≤ lo أُنشئ (بترتيب الأرقام المتزايد على الجهاز) قبل حدثٍ وصل قبل أكثر من 32 يومًا، فهو أقدم من كل مدّة قبول.
// الاستثناء الوحيد: جهاز فقد رقمه المحفوظ وساعته مُرجَعة معًا؛ عندها يذهب الحدث إلى الحجر (يُستعاد)، ولا يضيع ولا يتكرّر.
// سجلّ الجهاز لا يُحذف أبدًا؛ حين تفرغ مجموعاته يصغر إلى {lo} وحده (نحو 30 بايتًا).
// التضخّم: إن زادت أرقام جهاز على SX_IDN، أو أرقام كل الأجهزة على SX_IDB بايت، تُحذف أقدم مجموعة مبكّرًا وترتفع lo (المعادلة نفسها: لا تطبيق مرتين).
const SX_DEV = /^[A-Za-z0-9_-]{4,40}$/, SX_IDN = 15000, SX_IDB = 300000, SX_QZ = 300, SX_LATE = 3000, SX_MAXB = 400000, SX_AXB = 700000, SX_EVDOC = 32768, SX_EVMAX = 900000, SX_HARD = 1000000;
// الأرشفة بفجوة: تبدأ عند الحدّ الأعلى وتنقل حتى الأدنى دفعة واحدة، فتكون وثائق الأرشيف قليلة وكبيرة (لا وثيقة لكل مزامنة)
const SX_QZ_LOW = 200, SX_LATE_LOW = 2000, SX_MAXB_LOW = 300000;
// حدود بقية المكوّنات: سجلّات الأجهزة الخاملة (أرضها وحدها) ≤ 500 — الأقدم يُطوى في أرض عامة glo تبدأ بها كل الأجهزة الجديدة؛
// وقوائم الفهارس (أسماء الأرشيف an، ومفاتيح ما أُعيد تطبيقه ap، ونتائج الأرشيف am) ≤ 60 كيلوبايت معًا — الأقدم يُنقل إلى وثيقة فهرس sxi-… (أسماؤها في ai)
const SX_DEVMAX = 500, SX_DEVCAP = 2000, SX_IDX = 60000, SX_AIMAX = 50, SX_AIDEPTH = 64;
const sxBytes = s => new TextEncoder().encode(s).length;   // الحدود بالبايت (UTF-8) كما يحسبها Firestore، لا بعدد المحارف
function sxLoad(d) {
  const x = parseJ(d && d.data.v, null) || {}, o = { dv: {}, late: [], lf: {}, qz: [], ax: +x.ax || 0, glo: +x.glo || 0, ai: Array.isArray(x.ai) ? x.ai.filter(a => typeof a === "string" && /^sxi-[a-z0-9-]+$/.test(a)) : [],
    an: Array.isArray(x.an) ? x.an.filter(a => typeof a === "string" && /^sxa-[a-z0-9-]+$/.test(a)) : [],
    ap: Array.isArray(x.ap) ? x.ap.filter(a => typeof a === "string") : [], am: x.am && typeof x.am === "object" ? x.am : {} };
  if (x.dv && typeof x.dv === "object") for (const k in x.dv) { const v = x.dv[k]; if (!v || typeof v !== "object") continue;
    const g = {}; if (v.g && typeof v.g === "object") for (const day in v.g) g[day] = sxUnpack(v.g[day]);
    o.dv[k] = { g, lo: +v.lo || 0, lt: +v.lt || 0, r0: +v.r0 || 0, q: +v.q || 0, rt: +v.rt || 0, rr: +v.rr || 0 } }
  if (Array.isArray(x.late)) o.late = x.late.filter(a => Array.isArray(a) && a.length === 3);
  if (x.lf && typeof x.lf === "object") o.lf = x.lf;
  if (Array.isArray(x.qz)) o.qz = x.qz.filter(a => Array.isArray(a) && a.length >= 3 && a.length <= 5);
  return o;
}
// الأرقام مرتّبة تُحفظ فروقًا بالأساس 36 (أصغر بنحو النصف من الأرقام كاملة)
function sxPack(ids) { let p = 0; return ids.map(n => { const d = (n - p).toString(36); p = n; return d }).join(",") }
function sxUnpack(s) { if (typeof s !== "string" || !s) return []; let p = 0; const o = []; for (const d of s.split(",")) { const v = parseInt(d, 36); if (!Number.isFinite(v)) return o; p += v; o.push(p) } return o }
function sxSave(sx) { const dv = {}; for (const k in sx.dv) { const v = sx.dv[k], g = {}; for (const day in v.g) if (v.g[day].length) g[day] = sxPack(v.g[day]);
    dv[k] = Object.keys(g).length || v.lt ? { g, lo: v.lo, lt: v.lt, r0: v.r0, q: v.q, rt: v.rt || 0, rr: v.rr || 0 } : { lo: v.lo } }
  return JSON.stringify({ dv, late: sx.late, lf: sx.lf, qz: sx.qz, ax: sx.ax, an: sx.an, ap: sx.ap, am: sx.am, glo: sx.glo || 0, ai: sx.ai || [] }) }
// جهاز غير معروف يبدأ بالأرض العامة glo (أكبر أرض لأجهزة طُويت): فحدثٌ قديم من جهاز طُوي سجلّه لا يُطبَّق مرة ثانية
const sxDevKey = e => typeof e.d === "string" && SX_DEV.test(e.d) ? e.d : "_";
function sxDev(sx, e) { const k = sxDevKey(e); return sx.dv[k] || (sx.dv[k] = { g: {}, lo: sx.glo || 0, lt: 0, r0: 0, q: 0, rt: 0, rr: 0 }) }
function sxIdx(a, n) { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < n) lo = m + 1; else hi = m } return lo }
function sxHas(dv, n) { for (const day in dv.g) { const a = dv.g[day], i = sxIdx(a, n); if (a[i] === n) return true } return false }
function sxSeen(dv, n, now) { if (sxHas(dv, n)) return; const day = String(Math.floor(now / 864e5)), a = dv.g[day] || (dv.g[day] = []), i = sxIdx(a, n); a.splice(i, 0, n) }
// جهاز بلا سجلّ: رقمه التالي بعد الأرض العامة glo
function sxMax(sx, dev) { const v = typeof dev === "string" && sx.dv[dev]; if (!v) return sx.glo || 0; let m = v.lo; for (const day in v.g || {}) { const a = v.g[day]; if (a.length) m = Math.max(m, a[a.length - 1]) } return m }
function sxDrop(v, day) { const a = v.g[day]; if (a && a.length) v.lo = Math.max(v.lo, a[a.length - 1]); delete v.g[day] }
// اسم وثيقة أرشيف فريد (وقت الخادم + ترتيبها في الطلب + عشوائي): لا يتصادم بعد استرجاع نسخة احتياطية أعادت العدّاد إلى الوراء
const sxArchName = (now, k) => "sxa-" + now.toString(36) + "-" + k + "-" + Math.random().toString(36).slice(2, 8);
// الحدود دون حذف: الحجر فوق 300، أو المتأخّرات فوق 3000، أو الوثيقة فوق 400 كيلوبايت → الأقدم إلى وثائق أرشيف جديدة
// (كل واحدة ≤ 700 كيلوبايت، تُكتب مرة واحدة بشرط عدم وجودها، في الدفعة الذرّية نفسها، ولا تُحذف). المتأخّرات المنقولة تبقى محسوبة في lf.
function sxTrim(sx, now, uid, k0) {
  const cutDay = Math.floor((now - sxWinMax() - 2 * 864e5) / 864e5);
  let idb = 0; const all = [];
  for (const k of Object.keys(sx.dv)) { const v = sx.dv[k];
    for (const day of Object.keys(v.g)) if (+day < cutDay) sxDrop(v, day);
    // جهاز خامل (لا أرقام، وآخر حدث قبل أطول مدّة قبول): يصغر إلى أرضه وحدها. حدّه الأدنى للوقت لم يعد يلزم: أي حدث منه أقدم من ذلك يردّه حدّ القبول
    if (!Object.keys(v.g).length && v.lt && v.lt < cutDay * 864e5) { v.lt = 0; v.r0 = 0; v.q = 0; v.rt = 0; v.rr = 0 }
    let n = 0; for (const day in v.g) n += v.g[day].length;
    while (n > SX_IDN) { const d0 = Object.keys(v.g).sort((a, b) => a - b)[0]; n -= v.g[d0].length; sxDrop(v, d0) }
    for (const day in v.g) { const b = sxPack(v.g[day]).length + 12; idb += b; all.push([+day, k, b]) } }
  if (idb > SX_IDB) { all.sort((a, b) => a[0] - b[0]); for (const [day, k, b] of all) { if (idb <= SX_IDB) break; sxDrop(sx.dv[k], String(day)); idb -= b } }
  // الأجهزة الخاملة فوق الحدّ: الأقدم أرضًا يُطوى في glo
  // لا تُطوى إلا أرضٌ أقدم من أطول مدّة قبول + يومين (بساعة الخادم)، فالأرض العامة glo أقدم دائمًا من كل مدّة قبول: أي حدث برقم ≤ glo
  // من جهاز ساعته صحيحة أو متقدّمة أُنشئ قبل مدّة القبول، فكان سيُرفض أصلًا. وأرضٌ أحدث من ذلك (جهاز ساعته متقدّمة) لا تُطوى أبدًا؛
  // تُطوى حين يتجاوزها الوقت. والحدّ الكلّي لسجلّات الأجهزة SX_DEVCAP (جهاز جديد بعده إلى الحجر «devmax»)، فيبقى حجمها محدودًا (نحو 2000 × 40 بايت).
  { const idle = Object.keys(sx.dv).filter(k => !sx.dv[k].lt && !Object.keys(sx.dv[k].g).length).sort((a, b) => sx.dv[a].lo - sx.dv[b].lo);
    const fold = k => { sx.glo = Math.max(sx.glo || 0, sx.dv[k].lo); delete sx.dv[k] };
    let over = idle.length - SX_DEVMAX; for (const k of idle) { if (over <= 0 || sx.dv[k].lo > cutDay * 864e5) break; fold(k); over-- } }
  sx.late = LATE; sx.lf = LATEF;
  const out = []; let qz = [], late = [], size = sxBytes(sxSave(sx)), ab = 0;
  const go = sx.qz.length > SX_QZ || sx.late.length > SX_LATE || size > SX_MAXB;   // تجاوز حدًّا أعلى؟ عندها يُنقل حتى الأدنى
  if (go) sx.late.sort((a, b) => a[0] - b[0]);
  while (go && (sx.qz.length > SX_QZ_LOW || sx.late.length > SX_LATE_LOW || size > SX_MAXB_LOW) && (sx.qz.length || sx.late.length)) {
    let x;
    if (sx.qz.length && (sx.qz.length > SX_QZ_LOW || sx.late.length <= SX_LATE_LOW)) { x = sx.qz.shift(); qz.push(x) }
    else { x = sx.late.shift(); late.push(x); const d = dkey(x[0]); LATEF[d] = (+LATEF[d] || 0) + 1 }
    const n = sxBytes(JSON.stringify(x)) + 1; size -= n; ab += n;
    if (ab > SX_AXB) { out.push({ qz, late }); qz = []; late = []; ab = 0 }
  }
  if (qz.length || late.length) out.push({ qz, late });
  const W = out.map((a, i) => { sx.ax++; const nm = sxArchName(now, k0 + i); sx.an.push(nm); return { path: `users/${uid}/data/${nm}`, data: { v: JSON.stringify({ ...a, at: now }) }, ifMissing: true } });
  // الفهارس فوق الحدّ: النصف الأقدم من an وap، ونصف am، إلى وثيقة فهرس جديدة
  if (sxBytes(JSON.stringify([sx.an, sx.ap, sx.am])) > SX_IDX) {
    const h = a => a.splice(0, Math.ceil(a.length / 2)), ks = Object.keys(sx.am), mk = ks.slice(0, Math.ceil(ks.length / 2)), am = {};
    for (const k of mk) { am[k] = sx.am[k]; delete sx.am[k] }
    const nm = "sxi-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 8); sx.ai = sx.ai || [];
    const chain = sx.ai.length >= SX_AIMAX ? sx.ai.splice(0) : [];   // قائمة ai نفسها محدودة: أسماؤها تنتقل إلى الوثيقة الجديدة
    sx.ai.push(nm);
    W.push({ path: `users/${uid}/data/${nm}`, data: { v: JSON.stringify({ an: h(sx.an), ap: h(sx.ap), am, ai: chain, at: now }) }, ifMissing: true }) }
  return W;
}

/* ---------- المشرف: حذف كل بيانات مستخدم ليبدأ من الصفر ---------- */
// يبقى حسابه وتفعيله واسمه الظاهر ورسائله، ويُحذف ما سوى ذلك: التقدّم والجواهر والمشتريات والهدايا والدوري والملف العام والمظهر
async function handleWipe(fs, user, body) {
  if (user.email !== ADMIN) return { status: 403, json: { error: "admin" } };
  const uid = String(body.uid || ""); if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return { status: 400, json: { error: "uid" } };
  const now = Date.now(), [uDoc, gifts, sxD] = await Promise.all([fs.get(`users/${uid}`), fs.list(`gifts/${uid}/g`), fs.get(`users/${uid}/data/sx`)]);
  // وثيقة sx: يبقى سجلّ الأجهزة (أرقام الأحداث، فلا يُطبَّق حدث قديم أُعيد إرساله)، ويُحذف الحجر والمتأخّرات ووثائق أرشيفها مع بقية البيانات
  const sx0 = sxD ? sxLoad(sxD) : null, IX0 = sx0 ? await sxIndex(fs, uid, sx0) : null;
  const arch = sx0 ? [...IX0.an, ...IX0.ai].map(a => ({ path: `users/${uid}/data/${a}`, del: true })) : [];   // الأرشيف كله ووثائق الفهرس
  const sxW = sx0 ? (() => { sx0.late = []; sx0.lf = {}; sx0.qz = []; sx0.an = []; sx0.ap = []; sx0.am = {}; sx0.ai = []; return [{ path: `users/${uid}/data/sx`, data: { v: sxSave(sx0) } }] })() : [];
  const core = { P: {}, QLOG: [], BUY: [], R: { bank: 0, ach: [], lv: 1, ts: now }, LG: { tier: 0, w: "", hist: [], ts: now, v: 2, best: 0 }, EN: { v: 30, t: 0 }, STN: [], STV: 0, ver: 1, lf: 1, wiped: now };
  const empty = JSON.stringify({ K: [], F: [] });
  await fs.commit([
    { path: `users/${uid}`, data: { name: (uDoc && uDoc.data.name) || "", wiped: now } },
    { path: `users/${uid}/data/core`, data: { v: JSON.stringify(core) } },
    { path: `users/${uid}/data/log`, data: { v: empty } },
    { path: `users/${uid}/data/qa`, data: { v: empty } },
    { path: `users/${uid}/data/ck`, data: { v: "" } },
    ...sxW, ...arch,
    { path: `pub/${uid}`, del: true },
    { path: `lg/${weekId(now)}/m/${uid}`, del: true },
    ...gifts.map(g => ({ path: `gifts/${uid}/g/${g.id}`, del: true }))]);
  return { status: 200, json: { ok: true } };
}

/* ---------- المشرف: استعادة سلسلة متعلّم ومستواه في الدوري (بعد تصفيرٍ قديم كان يمسحهما) ---------- */
// streak: السلسلة التي يجب أن تظهر له الآن (تُحفظ أيامًا متتالية تنتهي أمس، واليوم يُضاف إن درس)، tier: مستواه في الدوري
async function handleFix(fs, user, body, env) {
  if (user.email !== ADMIN) return { status: 403, json: { error: "admin" } };
  const uid = String(body.uid || ""); if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return { status: 400, json: { error: "uid" } };
  const streak = body.streak == null || body.streak === "" ? null : Math.floor(+body.streak), tier = body.tier == null || body.tier === "" ? null : Math.floor(+body.tier);
  if (streak != null && !(streak >= 0 && streak <= 3650)) return { status: 400, json: { error: "streak" } };
  if (tier != null && !(tier >= 0 && tier < CFG.league.up.length)) return { status: 400, json: { error: "tier" } };
  await loadCfg(fs);
  const [coreD, logD, qaD, ckD] = await Promise.all([fs.get(`users/${uid}/data/core`), fs.get(`users/${uid}/data/log`), fs.get(`users/${uid}/data/qa`), fs.get(`users/${uid}/data/ck`)]);
  if (!coreD) return { status: 404, json: { error: "nouser" } };
  setState(parseJ(coreD.data.v, {}), parseJ(logD && logD.data.v, null), parseJ(qaD && qaD.data.v, null), parseJ(ckD && ckD.data.v, null));
  const now = Date.now();
  if (streak != null) {
    R = { ...R }; delete R.sk; EC = null;
    const todayIn = econ().s.today, n = Math.max(0, streak - (todayIn ? 1 : 0));
    if (n > 0) R.sk = { t: dkey(now - DAY), n };
    EC = null;
  }
  if (tier != null) LG = { ...LG, tier, best: Math.max(LG.best || 0, tier) };
  await fs.commit([{ path: `users/${uid}/data/core`, data: { v: JSON.stringify(coreObj()) }, ifUpdateTime: coreD.updateTime }]);
  EC = null; const e = econ();
  return { status: 200, json: { ok: true, streak: e.s.streak, tier: LG.tier } };
}

/* ---------- بلاغات الأخطاء في الكلمات: المتعلّم يرسل، والمشرف يقرأ ويحذف ---------- */
const RKINDS = ["ar", "de", "ex", "audio", "other"];
async function handleReport(fs, user, body) {
  const op = String(body.op || "add");
  if (op === "list" || op === "del") {
    if (user.email !== ADMIN) return { status: 403, json: { error: "admin" } };
    if (op === "del") { const id = String(body.id || ""); if (!/^[A-Za-z0-9_-]{1,200}$/.test(id)) return { status: 400, json: { error: "id" } }; await fs.commit([{ path: `reports/${id}`, del: true }]); return { status: 200, json: { ok: true } } }
    const list = (await fs.list("reports")).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 300);
    return { status: 200, json: { list } };
  }
  const k = String(body.k || "").slice(0, 200), kind = RKINDS.includes(body.kind) ? body.kind : "other";
  if (!k) return { status: 400, json: { error: "word" } };
  const uDoc = await fs.get(`users/${user.uid}`);
  if (!uDoc && user.email !== ADMIN) return { status: 403, json: { error: "inactive" } };
  // بلاغ واحد لكل متعلّم لكل كلمة (يُستبدل إن أعاده)، فلا يمتلئ الصندوق بالتكرار
  let h = 0; for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const id = user.uid.replace(/[^A-Za-z0-9_-]/g, "") + "_" + h.toString(36);
  await fs.commit([{ path: `reports/${id}`, data: { uid: user.uid, name: String((uDoc && uDoc.data.name) || user.email.split("@")[0]).slice(0, 60), k,
    de: String(body.de || "").slice(0, 300), ar: String(body.ar || "").slice(0, 300), course: String(body.course || "").slice(0, 60), kind, note: String(body.note || "").slice(0, 500), at: Date.now() } }]);
  return { status: 200, json: { ok: true } };
}

/* ---------- عدّاد الاستهلاك: طلبات وقراءات وكتابات لكل ساعة، يُجمع في الذاكرة ويُحفظ دفعة كل دقيقتين ---------- */
let ST = {}, ST_AT = Date.now(), ST_N = 0;
function stAdd(f, v) { if (!v) return; const now = Date.now(), d = dkey(now), h = String(hourOf(now)).padStart(2, "0"), o = ST[d] || (ST[d] = {}); o[f] = (o[f] || 0) + v; o[f + "_" + h] = (o[f + "_" + h] || 0) + v }
function countFS(fs) {
  return {
    async get(p) { stAdd("sr", 1); return fs.get(p) },
    async list(c) { const r = await fs.list(c); stAdd("sr", Math.max(1, r.length)); return r },
    async commit(ws) { stAdd("sw", ws.length); return fs.commit(ws) },
    async manyT(ps) { stAdd("sr", Math.max(1, ps.length)); return fs.manyT(ps) }
  };
}
async function stFlush(fs, force) {
  ST_N++;
  if (!force && Date.now() - ST_AT < 120e3 && ST_N < 100) return;
  const S = ST; ST = {}; ST_AT = Date.now(); ST_N = 0;
  const hh = "sw_" + String(hourOf(Date.now())).padStart(2, "0");   // كتابة الإحصاء نفسها تُحسب أيضًا
  const ws = Object.entries(S).map(([d, inc]) => ({ path: `stats/${d}`, inc: { ...inc, sw: (inc.sw || 0) + 1, [hh]: (inc[hh] || 0) + 1 } }));
  if (!ws.length) return;
  try { await fs.commit(ws) } catch (e) { for (const [d, o] of Object.entries(S)) for (const [f, v] of Object.entries(o)) { const t = ST[d] || (ST[d] = {}); t[f] = (t[f] || 0) + v } }
}
async function handleStats(fs, user, body) {
  if (user.email !== ADMIN) return { status: 403, json: { error: "admin" } };
  await stFlush(fs, true);
  const days = (await fs.list("stats")).sort((a, b) => a.id < b.id ? 1 : -1).slice(0, 31);
  return { status: 200, json: { days } };
}

/* ---------- إنشاء حساب من لوحة الإشراف: يُنشأ في Firebase Auth ويُفعَّل فورًا ---------- */
/* ---------- رسالة يبدؤها المشرف لمتعلّم لم يراسله بعد (قواعد Firestore لا تسمح للمشرف بإنشاء المحادثة) ---------- */
async function handleMsg(fs, user, body) {
  if (user.email !== ADMIN) return { status: 403, json: { error: "admin" } };
  const to = String(body.to || ""), text = String(body.text || "").trim().slice(0, 500);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(to) || !text) return { status: 400, json: { error: "bad" } };
  const [nm, ud] = await Promise.all([fs.get(`names/${to}`), fs.get(`users/${to}`)]);
  const name = String((nm && nm.data.name) || (ud && ud.data.name) || "مستخدم").slice(0, 60);
  const now = Date.now(), id = "a" + now.toString(36) + Math.random().toString(36).slice(2, 6);
  await fs.commit([
    { path: `threads/${to}/msgs/${id}`, data: { from: "admin", text, ts: { __ts: now } } },
    { path: `threads/${to}`, data: { name, state: "open", lastFrom: "admin", unreadUser: true, updated: { __ts: now }, lastMsg: id }, merge: true }]);
  return { status: 200, json: { ok: true } };
}

async function handleCreate(fs, user, body, env) {
  if (user.email !== ADMIN) return { status: 403, json: { error: "admin" } };
  const login = String(body.login || "").trim().toLowerCase(), pass = String(body.pass || ""), name = String(body.name || "").trim().slice(0, 40);
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(login)) return { status: 400, json: { error: "login" } };
  if (pass.length < 6 || pass.length > 64) return { status: 400, json: { error: "pass" } };
  const courses = Array.isArray(body.courses) ? body.courses.map(String).filter(x => /^[A-Za-z0-9_-]{1,40}$/.test(x)).slice(0, 20) : [];
  let uid;
  if (env.__fs) uid = "u_" + login;   // الاختبار المحلي
  else {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts`, { method: "POST", headers: { Authorization: "Bearer " + await googleToken(env), "Content-Type": "application/json" },
      body: JSON.stringify({ email: login + "@mufradati.app", password: pass, displayName: name || login }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const m = String((j.error && j.error.message) || r.status); return { status: m.includes("EXISTS") ? 409 : r.status === 403 ? 403 : 500, json: { error: m.includes("EXISTS") ? "exists" : r.status === 403 ? "perm" : "auth", detail: m.slice(0, 200) } } }
    uid = j.localId;
  }
  const now = Date.now(), w = [{ path: `members/${uid}`, data: { ts: { __ts: now }, by: "admin" } }];
  if (name) w.push({ path: `names/${uid}`, data: { name, pending: "", okAt: { __ts: now } } });
  if (courses.length) w.push({ path: `assign/${uid}`, data: { courses, ts: { __ts: now } } });
  await fs.commit(w);
  return { status: 200, json: { ok: true, uid } };
}

// تعيين كلمة مرور جديدة لمستخدم (المشرف وحده). يخرج المستخدم من أجهزته الأخرى، ويبقى تقدّمه كما هو
async function handlePass(fs, user, body, env) {
  if (user.email !== ADMIN) return { status: 403, json: { error: "admin" } };
  const uid = String(body.uid || ""), pass = String(body.pass || "");
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return { status: 400, json: { error: "uid" } };
  if (pass.length < 6 || pass.length > 64) return { status: 400, json: { error: "pass" } };
  if (uid === user.uid) return { status: 400, json: { error: "self" } };
  if (env.__fs) return { status: 200, json: { ok: true } };   // الاختبار المحلي
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`, { method: "POST", headers: { Authorization: "Bearer " + await googleToken(env), "Content-Type": "application/json" },
    body: JSON.stringify({ localId: uid, password: pass }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const m = String((j.error && j.error.message) || r.status); return { status: m.includes("USER_NOT_FOUND") ? 404 : r.status === 403 ? 403 : 500, json: { error: m.includes("USER_NOT_FOUND") ? "nouser" : r.status === 403 ? "perm" : "auth", detail: m.slice(0, 200) } } }
  return { status: 200, json: { ok: true } };
}

/* ---------- مساعد الوظيفة: ذكاء صناعي مجاني من Cloudflare لحسابات يختارها المشرف ---------- */
// نموذجان مجانيان: الأول يقرأ صورة الورقة ويكتب نصّها (رخيص ودقيق)، والثاني يشرح للطفل (أذكى)، وإن تعطّل يشرح الأول
const AI_MODEL = "@cf/google/gemma-4-26b-a4b-it", AI_TUTOR = "@cf/qwen/qwen3.8-27b", AI_DAY = 60;   // الحدّ اليومي للأسئلة لكل حساب
function aiPrompt(name, grade) {
  return `Du bist „Eule“, eine Hausaufgabenhilfe für ${name ? "das Kind " + name : "ein Kind"} (${grade ? grade + ". Klasse" : "3. oder 4. Klasse"}, Grundschule in Sachsen). Das Kind spricht Arabisch (Familie aus Syrien). Die Eltern sind nicht zu Hause.

ANTWORT-FORM (sehr wichtig):
- Ganz kurz: höchstens 2 Gedanken pro Antwort.
- Jeder Gedanke: eine Zeile einfaches Deutsch, darunter dieselbe Zeile auf einfachem Arabisch (Hocharabisch mit in Syrien üblichen Wörtern). Wörter aus der Aufgabe bleiben auf Deutsch.
- Im Arabischen: sprich das Kind passend zu seinem Namen an (Junge männlich, Mädchen weiblich; unklar: männlich). Über dich selbst sprichst du immer in männlicher Form (z. B. „أنا آسف“).
- Kein Markdown außer **fett**. Keine Begrüßung, keine Wiederholung der Aufgabe, keine Entschuldigungs-Romane.

DAS ARBEITSBLATT:
- Wenn ein Arbeitsblatt abgeschrieben mitgeschickt wird, ist das die einzige Quelle. Zitiere nur Wörter und Sätze, die wirklich dort stehen. Behaupte nie, ein Wort stehe in einem Satz, wenn es dort nicht steht.
- Hat das Blatt mehrere Aufgaben und das Kind hat nicht gesagt welche: frage zuerst kurz „Welche Aufgabe?“ und nichts sonst.
- Nennt das Kind eine Nummer, arbeite nur an genau dieser Aufgabe.

SO HILFST DU:
- Gehe in sinnvollen Schritten vor, nicht in Mini-Schritten. Frage nichts, was offensichtlich ist (z. B. nicht „Siehst du das Wort …?“).
- Pro Antwort: einen kurzen Tipp oder eine Erklärung + eine klare Frage, mit der das Kind den nächsten Teil selbst löst.
- Lobe nur, wenn das Kind gerade etwas richtig beantwortet hat: dann kurz („Super!“) und weiter. Falsch: sagen, was falsch ist, kurzer Tipp, noch einmal.
- Nach 2 falschen Versuchen, bei „ich weiß nicht“ oder wenn das Kind die Lösung will: zeige die Lösung dieses Teils mit einem kurzen Grund.
- Am Ende: die ganze Lösung in einer kurzen Liste zum Abschreiben.
- Rechne sorgfältig und prüfe jedes Ergebnis, bevor du es sagst.

REGELN:
- Nur Schule und Lernen; sonst freundlich zurück zur Aufgabe.
- Frage nie nach Adresse, Telefonnummer, Passwörtern oder Fotos von Personen.
- Ist das Kind traurig, hat Angst, ist verletzt oder in Gefahr: sag liebevoll, es soll sofort Papa oder Mama anrufen oder einem Erwachsenen Bescheid sagen; bei Gefahr 112.
- Keine Inhalte, die nicht für Kinder geeignet sind.`;
}
const OCR_PROMPT = "Schreibe den gesamten Text auf diesem Foto eines Arbeitsblatts exakt ab, Zeile für Zeile, in der Reihenfolge des Blatts. Behalte Aufgabennummern, Lücken (als ____), Ankreuzkästchen (als ☐) und Beispiele bei. Erfinde nichts und korrigiere nichts; unlesbare Stellen als [?]. Wenn Handschrift des Kindes zu sehen ist, schreibe sie in eckigen Klammern mit „Kind:“ davor. Gib nur den abgeschriebenen Text aus.";
const aiText = r => {
  let t = r && r.choices && r.choices[0] && r.choices[0].message ? r.choices[0].message.content : r && r.response;
  if (Array.isArray(t)) t = t.map(x => x && x.text || "").join("");
  return String(t || "").replace(/<think>[\s\S]*?<\/think>/g, "").replace(/<\|?channel\|?>thought[\s\S]*?<\|?channel\|?>/g, "").trim();
};
async function handleAi(fs, user, body, env) {
  await loadCfg(fs);
  if (!(CFG.ai || []).includes(user.uid)) return { status: 403, json: { error: "noai" } };
  if (body.peek) { const q0 = await fs.get(`aiq/${user.uid}`), u0 = q0 && q0.data.d === dkey(Date.now()) ? +q0.data.n || 0 : 0; return { status: 200, json: { left: Math.max(0, AI_DAY - u0), max: AI_DAY } } }
  const msgs = (Array.isArray(body.msgs) ? body.msgs : []).slice(-16).map(m => ({ r: m && m.r === "a" ? "a" : "u", t: String(m && m.t || "").slice(0, 2000), i: !!(m && m.i), o: String(m && m.o || "").slice(0, 5000) }));
  if (!msgs.length || msgs[msgs.length - 1].r !== "u") return { status: 400, json: { error: "bad" } };
  const img = typeof body.img === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(body.img) && body.img.length < 700000 ? body.img : "";
  const cid = String(body.cid || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "c";
  const now = Date.now(), day = dkey(now);
  const [q, as, nm] = await Promise.all([fs.get(`aiq/${user.uid}`), fs.get(`assign/${user.uid}`), fs.get(`names/${user.uid}`)]);
  const used = q && q.data.d === day ? +q.data.n || 0 : 0;
  if (used >= AI_DAY) return { status: 429, json: { error: "limit", left: 0, max: AI_DAY } };
  const cs = as && Array.isArray(as.data.courses) ? as.data.courses : [], grade = cs.includes("k4") ? 4 : cs.includes("k3") ? 3 : 0;
  const name = String(nm && nm.data.name || "").split(/\s+/)[0].slice(0, 30);
  const isQuota = m => /4006|daily|neuron|quota|limit/i.test(m), fail = e => { const m = String(e && e.message || e); return { status: isQuota(m) ? 429 : 502, json: { error: isQuota(m) ? "quota" : "ai", ...(user.email === ADMIN ? { detail: m.slice(0, 200) } : {}) } } };
  // صورة جديدة لم تُقرأ بعد: يُكتب نصّها أولًا، ثم يُشرح من النص (لا يخمّن الشارح ما في الصورة)
  let ocr = "", ocrAt = -1;
  if (img) {
    ocrAt = msgs.map(m => m.i && !m.o).lastIndexOf(true);
    if (ocrAt >= 0) {
      try { ocr = aiText(await env.AI.run(AI_MODEL, { messages: [{ role: "user", content: [{ type: "text", text: OCR_PROMPT }, { type: "image_url", image_url: { url: img } }] }], max_completion_tokens: 1500, temperature: 0, chat_template_kwargs: { enable_thinking: false } })).slice(0, 5000) }
      catch (e) { return fail(e) }
      msgs[ocrAt].o = ocr || "[Foto nicht lesbar]";
    }
  }
  const messages = [{ role: "system", content: aiPrompt(name, grade) }, ...msgs.map(m => ({ role: m.r === "a" ? "assistant" : "user",
    content: m.o ? "Arbeitsblatt (vom Foto abgeschrieben):\n" + m.o + "\n\nKind: " + (m.t || "Hilf mir bei dieser Aufgabe.") : m.i ? "(Foto, nicht mehr verfügbar) " + (m.t || "…") : (m.t || "…") }))];
  let a = "";
  try { a = aiText(await env.AI.run(AI_TUTOR, { messages, max_completion_tokens: 700, temperature: 0.3, chat_template_kwargs: { enable_thinking: false } })) } catch (e) { a = "" }
  if (!a) { try { a = aiText(await env.AI.run(AI_MODEL, { messages, max_completion_tokens: 700, temperature: 0.3, chat_template_kwargs: { enable_thinking: false } })) } catch (e) { return fail(e) } }
  if (!a) return { status: 502, json: { error: "ai", detail: "empty" } };
  const last = msgs[msgs.length - 1], id = now.toString(36) + Math.random().toString(36).slice(2, 6);
  // صورة الورقة تُحفظ في تخزين Cloudflare 31 يومًا ثم تُحذف وحدها؛ يراها المشرف مع المحادثة
  let ik = "";
  if (ocrAt === msgs.length - 1 && img && env.BAK) { ik = "img-" + user.uid + "-" + id; try { await env.BAK.put(ik, img, { expirationTtl: 31 * 86400 }) } catch (e) { ik = "" } }
  await fs.commit([
    { path: `aichat/${user.uid}/m/${id}`, data: { c: cid, q: last.t, img: "", ik: ik, o: ocr, a, ts: { __ts: now } } },
    { path: `aichat/${user.uid}`, data: { last: { __ts: now }, name }, merge: true },
    { path: `aiq/${user.uid}`, data: { d: day, n: used + 1 } }]);
  return { status: 200, json: { a, ocr, ocrAt: ocrAt >= 0 ? msgs.length - 1 - ocrAt : -1, left: AI_DAY - used - 1, max: AI_DAY } };
}
// المشرف يقرأ محادثات المساعد لحساب معيّن، الأحدث أولًا
// حذف محادثات المساعد: كلها، أو محادثة واحدة (c)، أو الأقدم من تاريخ (before)
const AI_KEEP = 30 * DAY;   // تُحذف المحادثات تلقائيًّا بعد شهر
async function aiPurge(fs, uid, f) {
  let tok = "", n = 0;
  do {
    const r = await fs.page(`aichat/${uid}/m`, "ts", 200, tok); tok = r.tok;
    const hit = r.items.filter(x => (f.c ? x.c === f.c : true) && (f.before ? (x.ts && x.ts.ms || 0) < f.before : true)), del = hit.map(x => ({ path: `aichat/${uid}/m/${x.id}`, del: true }));
    if (f.env && f.env.BAK) for (const x of hit) if (x.ik) { try { await f.env.BAK.delete(x.ik) } catch (e) { } }
    for (let k = 0; k < del.length; k += 400) await fs.commit(del.slice(k, k + 400));
    n += del.length;
    if (f.before && r.items.length && (r.items[r.items.length - 1].ts || {}).ms >= f.before) break;   // مرتّبة من الأقدم: ما بعدها أحدث
  } while (tok);
  return n;
}
async function handleAiDel(fs, user, body, env) {
  if (user.email !== ADMIN) return { status: 403, json: { error: "admin" } };
  const uid = String(body.uid || ""), c = String(body.c || "");
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid) || c && !/^[A-Za-z0-9_-]{1,40}$/.test(c)) return { status: 400, json: { error: "bad" } };
  return { status: 200, json: { ok: true, n: await aiPurge(fs, uid, c ? { c, env } : { env }) } };
}
// يعمل كل ليلة: يحذف من كل الحسابات ما مضى عليه أكثر من شهر
async function aiCleanup(env) {
  const fs = env.__fs || makeFS(env), before = Date.now() - AI_KEEP;
  for (const d of await fs.list("aichat")) { try { await aiPurge(fs, d.id, { before }) } catch (e) { } }
}
async function handleAiLog(fs, user, body, env) {
  if (user.email !== ADMIN) return { status: 403, json: { error: "admin" } };
  const uid = String(body.uid || "");
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return { status: 400, json: { error: "uid" } };
  const r = await fs.page(`aichat/${uid}/m`, "ts desc", 30, String(body.tok || ""));
  const imgs = await Promise.all(r.items.map(x => x.img ? x.img : x.ik && env.BAK ? env.BAK.get(x.ik).catch(() => "") : ""));
  return { status: 200, json: { items: r.items.map((x, k) => ({ c: x.c, q: x.q, img: imgs[k] || "", a: x.a, ts: x.ts && x.ts.ms || 0 })), tok: r.tok, keep: AI_KEEP / DAY } };
}



/* ---------- النسخ الاحتياطي: كل ليلة تُحفظ نسخة كاملة من قاعدة البيانات في تخزين Cloudflare (منفصل عن Firebase) ---------- */
// الاحتفاظ (السياسة 2): آخر 14 نسخة ليلية وآخر 5 يدوية، كلٌّ على حدة، فلا تُخرج اليدويةُ الليليةَ.
// يُطبَّق فقط على النسخ التي أُنشئت بهذه السياسة (pol: 2)؛ النسخ الأقدم لا تُحذف تلقائيًا أبدًا، ولا نسخة «قبل الاسترجاع»
const BAK_KEEP = { auto: 14, manual: 5 }, BAK_POL = 2;
const DOCROOT = `projects/${PROJECT}/databases/(default)/documents`;
async function gauth(env) { return { Authorization: "Bearer " + await googleToken(env), "Content-Type": "application/json" } }
// كل وثائق قاعدة البيانات بصيغتها الأصلية (الأنواع محفوظة كما هي). تُحفظ الردود كما وصلت بلا تحليل، توفيرًا لوقت المعالج
// صور مساعد الوظيفة محفوظة في تخزين Cloudflare لا في قاعدة البيانات، فلا تدخل النسخة (وتُحذف وحدها بعد شهر)
async function exportAll(env) {
  if (env.__export) return env.__export();   // للاختبار المحلي فقط (قاعدة في الذاكرة)
  const H = await gauth(env);
  const r0 = await fetch(FS_BASE + ":listCollectionIds", { method: "POST", headers: H, body: JSON.stringify({ pageSize: 300 }) });
  if (!r0.ok) throw new Error("ids " + r0.status);
  const top = (await r0.json()).collectionIds || [];
  const Q = top.map(id => ({ parent: "", q: { from: [{ collectionId: id }] } }));
  for (const id of ["data", "g", "msgs", "m"]) Q.push({ parent: "", q: { from: [{ collectionId: id, allDescendants: true }] } });
  const parts = [];
  for (const x of Q) {
    const r = await fetch(FS_BASE + x.parent + ":runQuery", { method: "POST", headers: H, body: JSON.stringify({ structuredQuery: x.q }) });
    if (!r.ok) throw new Error("query " + r.status + " " + (await r.text()).slice(0, 120));
    parts.push(await r.text());
  }
  const all = parts.join(","), cnt = re => (all.match(re) || []).length;
  return { parts, n: cnt(/"document"\s*:/g), users: cnt(new RegExp('"name"\\s*:\\s*"' + DOCROOT.replace(/[()]/g, "\\$&") + '/users/[^/"]+"', "g")) };
}
const gz = async s => new Uint8Array(await new Response(new Blob([s]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
const gunz = async b => await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
async function backupNow(env, why, rid) {
  const ex = await exportAll(env); let now = Date.now(), key;
  // مفتاح فريد: إن وُجدت نسخة بالجزء نفسه من الألف من الثانية (نادر جدًا) يُزاد جزءًا، فلا تُكتب نسخة فوق أخرى
  // ولكل عملية لاحقة رقمية من معرّفها، فعمليتان مختلفتان في اللحظة نفسها لا تتشاركان المفتاح
  let h = 0; for (const ch of String(rid || "")) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  const suf = rid ? "-" + String(h).padStart(4, "0") : "";
  for (let i = 0; i < 20; i++, now++) { key = "bak-" + new Date(now).toISOString().replace(/[:.]/g, "-") + suf; if (!(await env.BAK.get(key, { type: "stream" }).then(v => { if (v && v.cancel) v.cancel(); return v }))) break }
  const body = await gz('{"v":2,"at":' + now + ',"parts":[' + ex.parts.join(",") + "]}");
  const meta = { at: now, n: ex.n, users: ex.users, size: body.length, why: why || "auto", pol: BAK_POL, ...(rid ? { rid } : {}) };
  await env.BAK.put(key, body, { metadata: meta });
  await bakPrune(env);
  return { key, ...meta };
}
// «نسخة الآن» عملية لا تتكرّر. لكل عملية معرّف (rid): ضغطة في التطبيق، أو «auto-<اليوم>» للنسخة الليلية، أو للتطبيق القديم بلا معرّف «m-<فترة دقيقتين>».
// القفل وثيقة bakrid/<rid> تُنشأ بشرط ألّا تكون موجودة (ذرّيًّا في قاعدة البيانات): مهما تزامنت الطلبات أو اختلفت نسخ الخادم التي وصلت إليها،
// يفوز طلب واحد فقط بإنشاء النسخة، والباقي يُرجع النسخة نفسها أو «قيد الإنشاء». الوثيقة صغيرة ولا تمسّ بيانات الحسابات.
const BAKRUN = new Map(), BAK_STALE = 15 * 60e3;
const RID_OK = r => typeof r === "string" && /^[A-Za-z0-9_-]{8,40}$/.test(r);
async function backupOnce(env, fs, rid, why) {
  const now = Date.now(); why = why === "auto" ? "auto" : "manual";
  if (!RID_OK(rid)) rid = why === "auto" ? "auto-" + new Date(now).toISOString().slice(0, 10) : "m-" + Math.floor(now / 120e3);
  if (BAKRUN.has(rid)) { const r = await BAKRUN.get(rid).catch(() => null); if (r) return { ...r, dup: 1 } }
  const lock = `bakrid/${rid}`;
  try { await fs.commit([{ path: lock, data: { st: "run", at: now, why }, ifMissing: true }]) }
  catch (e) {
    if (!e.conflict) throw e;
    const d = await fs.get(lock), x = d ? d.data : {};
    if (x.st === "done") return { ...parseJ(x.r, {}), dup: 1 };
    if (now - (+x.at || 0) < BAK_STALE) return { pending: 1, dup: 1 };
    // قفل قديم من عملية توقفت: يُستولى عليه بشرط ألّا يكون قد تغيّر منذ قرأناه (ذرّيًّا أيضًا)
    try { await fs.commit([{ path: lock, data: { st: "run", at: now, why }, ifUpdateTime: d.updateTime }]) }
    catch (e2) { if (e2.conflict) return { pending: 1, dup: 1 }; throw e2 }
  }
  const p = backupNow(env, why, rid);
  BAKRUN.set(rid, p); if (BAKRUN.size > 20) BAKRUN.delete(BAKRUN.keys().next().value);
  try {
    const r = await p; await fs.commit([{ path: lock, data: { st: "done", at: now, why, r: JSON.stringify(r) } }]);
    try { const old = (await fs.list("bakrid")).filter(x => x.st === "done" && now - (+x.at || 0) > 30 * 864e5).slice(0, 50); if (old.length) await fs.commit(old.map(x => ({ path: "bakrid/" + x.id, del: true }))) } catch (e) { }   // أقفال أقدم من شهر
    return r;
  }
  catch (e) { BAKRUN.delete(rid); try { await fs.commit([{ path: lock, del: true }]) } catch (x) { } throw e }
}
async function bakPrune(env) {
  const all = (await env.BAK.list({ prefix: "bak-" })).keys.sort((a, b) => a.name < b.name ? 1 : -1), del = [];
  for (const why of ["auto", "manual"]) del.push(...all.filter(k => k.metadata && k.metadata.pol === BAK_POL && k.metadata.why === why).slice(BAK_KEEP[why]));
  for (const k of del) await env.BAK.delete(k.name);
  return del.map(k => k.name);
}
// ما يُكتب عند الاسترجاع لوثائق ليست في النسخة: نقطة حفظ السجل (وإلا اختلطت بسجلّ أقدم منها)، ووثيقة sx
// (تُصفَّر لتطابق الحالة المسترجَعة: لو بقيت أرقام أحداث طُبّقت بعد النسخة ثم ألغاها الاسترجاع، لعُدّت إعادةُ إرسالها مكرّرة فضاعت).
// وثائق أرشيف sx تبقى كما هي (أسماؤها فريدة، ولا تُحذف).
function restoreExtra(inBak, uids) {
  const W = [];
  for (const id of uids) for (const [k, v] of [["ck", ""], ["sx", "{}"]]) { const n = `${DOCROOT}/users/${id}/data/${k}`; if (!inBak.has(n)) W.push({ update: { name: n, fields: { v: { stringValue: v } } } }) }
  return W;
}
// تفكّ النسخة وتعيد وثائقها: [{name, fields}]
async function loadBak(env, key) {
  if (!/^bak-[0-9TZ-]+$/.test(key)) throw new Error("key");
  const b = await env.BAK.get(key, "arrayBuffer"); if (!b) throw new Error("nobak");
  const j = JSON.parse(await gunz(b)), docs = new Map();
  for (const part of j.parts || []) for (const x of part) if (x && x.document) docs.set(x.document.name, { fields: x.document.fields || {}, ut: x.document.updateTime || "" });
  return { at: j.at, docs: [...docs].map(([name, d]) => ({ name, fields: d.fields, ut: d.ut })) };
}
// ملخّص حساب واحد كما يحسبه الخادم: للتوثيق قبل التحديث وبعده، وللتحقق من النسخة الاحتياطية. لا يكتب شيئًا
function acctSum(c, log, qa, ck, gifts, sxv) {
  setState(c, log, qa, ck); GIFTS = (gifts || []).map(g => ({ id: g.id, g: g.g || 0, note: g.note || "", ts: g.ts }));
  { const x = sxLoad(sxv ? { data: { v: sxv } } : null); LATE = x.late; LATEF = x.lf }   // المراجعات المتأخّرة تدخل السلسلة كما في المزامنة
  EC = null;
  const e = econ(), ms = new Set([...(Array.isArray(R.pz) ? R.pz : []).map(x => String(x[0]).slice(0, 7)), ...Object.keys(R.pza || {})]);
  const pz = {}; for (const m of [...ms].sort()) pz[m] = pzMonth(m).have.size;
  return { gems: e.gems, earned: e.earned, xp: e.xp, lv: e.lv, streak: e.s.streak, best: e.s.best, reviews: e.s.reviews, mem: e.s.mem, mast: e.s.mast,
    words: Object.keys(P).length, stations: STN.length, quizzes: QLOG.length, buys: BUY.length, ach: (R.ach || []).length,
    quests: (R.qd || []).length, qdg: +R.qdg || 0, duelWins: (R.dw || []).length, dwg: +R.dwg || 0, duelDays: duelDays().length,
    tier: LG.tier, weeks: (LG.hist || []).length, lgg: (LG.hist || []).reduce((a, h) => a + (h.g || 0), 0) + (+LG.hg || 0), pz, album: Object.values(pz).filter(n => n >= PZ_N).length,
    log: LOG.length, ck: typeof CK !== "undefined" && CK ? 1 : 0,
    // ما طُوي في الأرشيف الدائم (0 حتى يبلغ الحساب حدود السجلّات): يحدّد هل التراجع إلى النسخة القديمة آمن
    folded: (+R.qdg || 0) + (+R.dwg || 0) + (+LG.hg || 0) + Object.keys(R.dda || {}).length + (typeof CK !== "undefined" && CK ? 1 : 0) };
}
// ملخّصات كل الحسابات من قاعدة البيانات الحيّة
async function liveSums(fs) {
  const us = await fs.list("users"), out = {};
  for (const u of us) {
    const uid = u.id, [coreD, logD, qaD, ckD, gifts, nm, sxD] = await Promise.all([fs.get(`users/${uid}/data/core`), fs.get(`users/${uid}/data/log`), fs.get(`users/${uid}/data/qa`), fs.get(`users/${uid}/data/ck`), fs.list(`gifts/${uid}/g`), fs.get(`names/${uid}`), fs.get(`users/${uid}/data/sx`)]);
    if (!coreD) continue;
    out[uid] = { name: (nm && nm.data.name) || u.name || "", ...acctSum(parseJ(coreD.data.v, {}), parseJ(logD && logD.data.v, null), parseJ(qaD && qaD.data.v, null), parseJ(ckD && ckD.data.v, null), gifts, sxD && sxD.data.v) };
  }
  return out;
}
// ملخّصات كل الحسابات من نسخة احتياطية (بعد فكّها كاملة) — تثبت أن النسخة تكفي لإعادة بناء كل حساب
function bakSums(b) {
  const at = d => d.name.slice(DOCROOT.length + 1), docs = new Map(), val = f => { const o = {}; for (const k in f) o[k] = dec(f[k]); return o };
  for (const d of b.docs) docs.set(at(d), val(d.fields));
  const out = {};
  for (const [p, v] of docs) {
    const m = p.match(/^users\/([^/]+)\/data\/core$/); if (!m) continue; const uid = m[1], g = k => docs.get(`users/${uid}/data/${k}`);
    const gifts = [...docs].filter(([q]) => q.startsWith(`gifts/${uid}/g/`)).map(([q, x]) => ({ id: q.split("/").pop(), ...x }));
    out[uid] = { name: (docs.get(`names/${uid}`) || {}).name || "", ...acctSum(parseJ(v.v, {}), parseJ(g("log") && g("log").v, null), parseJ(g("qa") && g("qa").v, null), parseJ(g("ck") && g("ck").v, null), gifts, g("sx") && g("sx").v) };
  }
  return out;
}
// «تحقق كامل» (2): يقارن الوثائق الأصلية لكل حساب (core وlog وqa وck والهدايا) بين النسخة والحالة الآن، ثم الملخّصات.
// الحالة الآن تُقرأ كلها أولًا، ثم تُحسب ملخّصات الطرفين معًا دون أي انتظار بينهما، وبإعدادات المشرف نفسها (فلا يتغيّر شيء أثناء الحساب)
const stab = v => Array.isArray(v) ? "[" + v.map(stab).join(",") + "]" : v && typeof v === "object" ? "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + stab(v[k])).join(",") + "}" : JSON.stringify(v);
async function verifyBak(fs, b, key) {
  const cmpAt = Date.now(), at = d => d.name.slice(DOCROOT.length + 1), B = new Map();
  for (const d of b.docs) { const o = {}; for (const k in d.fields) o[k] = dec(d.fields[k]); B.set(at(d), { data: o, ut: d.ut || "" }) }
  const uids = new Set([...B.keys()].map(p => (p.match(/^users\/([^/]+)\/data\/core$/) || [])[1]).filter(Boolean));
  for (const u of await fs.list("users")) uids.add(u.id);
  const K = ["core", "log", "qa", "ck", "sx"], L = {};   // sx: أرقام الأحداث والمتأخّرات والحجر (المزامنة الجديدة)
  // القراءة الحيّة مجمّعة: كل وثائق الحسابات في طلبات batchGet (100 وثيقة في الطلب)، وكل الهدايا باستعلام واحد.
  // كانت 8 طلبات لكل حساب، فتجاوزت حدّ Cloudflare (نحو 50 في الاستدعاء) عند الحساب السابع. الآن: قائمة المستخدمين + ⌈7×الحسابات/100⌉ + 1
  const U = [...uids], docs = await fs.manyT(U.flatMap(uid => [...K.map(k => `users/${uid}/data/${k}`), `names/${uid}`, `users/${uid}`, `members/${uid}`]));
  const GF = {}; for (const x of await fs.group("g")) { const m = x.path.match(/^gifts\/([^/]+)\/g\/([^/]+)$/); if (m) (GF[m[1]] = GF[m[1]] || []).push({ id: m[2], ...x.data }) }
  // وثائق أرشيف sx (sxa-…): أسماؤها في قائمة sx.an (في النسخة والحالة الآن)، فتُقرأ بأسمائها في طلب واحد وتُقارن كاملة
  const AN = {}, aiOf = d => d && d.data ? sxLoad({ data: d.data }).ai || [] : [], anOf = d => d && d.data ? sxLoad({ data: d.data }).an : [];
  // أسماء وثائق الفهرس (حالة الآن والنسخة)، ثم أسماء الأرشيف فيها، فتُقرأ كلها بأسمائها
  const AI = {}, AID = {}; let Q = {}; for (const uid of uids) { AI[uid] = []; Q[uid] = [...new Set([...aiOf(docs[`users/${uid}/data/sx`]), ...aiOf(B.get(`users/${uid}/data/sx`))])] }
  for (let depth = 0; Object.values(Q).some(a => a.length); depth++) { if (depth >= SX_AIDEPTH) break;   // سلسلة وثائق الفهرس، طبقة بعد طبقة (من الحالة الآن ومن النسخة)
    Object.assign(AID, await fs.manyT(Object.entries(Q).flatMap(([u, a]) => a.map(n => `users/${u}/data/${n}`)))); const N = {};
    for (const [u, a] of Object.entries(Q)) { N[u] = []; for (const n of a) { AI[u].push(n); const p = `users/${u}/data/${n}`, v = (AID[p] && AID[p].data) || (B.get(p) && B.get(p).data), x = parseJ(v && v.v, {}) || {};
      for (const m of x.ai || []) if (typeof m === "string" && /^sxi-[a-z0-9-]+$/.test(m) && !AI[u].includes(m) && !N[u].includes(m)) N[u].push(m) } }
    Q = N }
  for (const uid of uids) { const sp = []; for (const n of AI[uid]) { const p = `users/${uid}/data/${n}`, v = (AID[p] && AID[p].data) || (B.get(p) && B.get(p).data); const x = parseJ(v && v.v, {}) || {}; sp.push(...(x.an || []), n) }
    AN[uid] = [...new Set([...anOf(docs[`users/${uid}/data/sx`]), ...anOf(B.get(`users/${uid}/data/sx`)), ...sp])] }
  const ARD = await fs.manyT(Object.entries(AN).flatMap(([u, a]) => a.map(n => `users/${u}/data/${n}`))), AR = {};
  for (const [p, d] of Object.entries(ARD)) { const m = p.match(/^users\/([^/]+)\/data\/(sx[ai]-[^/]+)$/); if (m && d) (AR[m[1]] = AR[m[1]] || {})[m[2]] = d.data }
  for (const uid of uids) {
    const g = [...K.map(k => docs[`users/${uid}/data/${k}`] || null), GF[uid] || [], docs[`names/${uid}`] || null, docs[`users/${uid}`] || null, docs[`members/${uid}`] || null];
    // الاسم من وثيقة الأسماء، وإن لم تكن (كبعض الحسابات القديمة) فمن وثيقة المستخدم كما في قائمة المستخدمين و«لقطة الحسابات»؛ ورقم الحساب من وثيقة التفعيل
    const j = K.length;   // ما بعد وثائق الحساب: الهدايا، ثم الاسم، ثم وثيقة المستخدم، ثم العضوية (المواضع نسبية، فإضافة وثيقة إلى K لا تزيحها)
    L[uid] = { d: Object.fromEntries(K.map((k, i) => [k, g[i]])), gifts: g[j], name: g[j + 1] && g[j + 1].data.name || g[j + 2] && g[j + 2].data.name || "", user: !!g[j + 2], no: g[j + 3] && g[j + 3].data.no != null ? +g[j + 3].data.no : null };
  }
  await loadCfg(fs);   // إعدادات المشرف، كما يحسبها التطبيق والمزامنة
  const accts = {}; let same = true;
  for (const uid of uids) {
    const l = L[uid], bd = k => B.get(`users/${uid}/data/${k}`), docs = {};
    for (const k of K) { const x = bd(k), y = l.d[k]; docs[k] = !x && !y ? "none" : !x ? "missing-bak" : !y ? "missing-live" : stab(x.data) === stab(y.data) ? "same" : "diff" }
    const bg = [...B].filter(([p]) => p.startsWith(`gifts/${uid}/g/`)).map(([p, x]) => ({ id: p.split("/").pop(), ...x.data })).sort((a, c) => a.id < c.id ? -1 : 1);
    const lg = [...l.gifts].sort((a, c) => a.id < c.id ? -1 : 1);
    docs.gifts = stab(bg) === stab(lg) ? "same" : "diff";
    const ba = {}; for (const [p, x] of B) { const m = p.match(new RegExp(`^users/${uid}/data/(sx[ai]-[^/]+)$`)); if (m) ba[m[1]] = x.data }
    const la = AR[uid] || {}; docs.sxa = (Q[uid] || []).length ? "incomplete" : !Object.keys(ba).length && !Object.keys(la).length ? "none" : stab(ba) === stab(la) ? "same" : "diff";   // سلسلة فهرس أعمق من الحدّ: «incomplete» لا «same»
    if (docs.sx === "none") delete docs.sx; if (docs.sxa === "none") delete docs.sxa;   // حساب بلا مزامنة جديدة: النتيجة كما كانت تمامًا
    const sum = (d, gifts) => d.core ? acctSum(parseJ(d.core.v, {}), parseJ(d.log && d.log.v, null), parseJ(d.qa && d.qa.v, null), parseJ(d.ck && d.ck.v, null), gifts, d.sx && d.sx.v) : null;
    const bs = sum(Object.fromEntries(K.map(k => [k, bd(k) && bd(k).data])), bg), ls = sum(Object.fromEntries(K.map(k => [k, l.d[k] && l.d[k].data])), lg);
    const sd = bs && ls ? Object.keys(bs).filter(k => stab(bs[k]) !== stab(ls[k])) : [bs ? "غير موجود الآن" : "غير موجود في النسخة"];
    const docSame = Object.values(docs).every(v => v === "same" || v === "none");
    if (!docSame || sd.length) same = false;
    accts[uid] = { name: l.name || (B.get(`names/${uid}`) || { data: {} }).data.name || (B.get(`users/${uid}`) || { data: {} }).data.name || "", no: l.no, userDoc: l.user, docs, docSame,
      coreUt: { bak: bd("core") ? bd("core").ut : "", live: l.d.core ? l.d.core.updateTime : "" }, bak: bs, live: ls, diff: sd };
  }
  return { ok: true, key, at: b.at, cmpAt, n: b.docs.length, result: same ? "match" : "diff", accts,
    // للتوافق مع الواجهة القديمة
    bak: Object.fromEntries(Object.entries(accts).filter(([, a]) => a.bak).map(([u, a]) => [u, { name: a.name, ...a.bak }])),
    live: Object.fromEntries(Object.entries(accts).filter(([, a]) => a.live).map(([u, a]) => [u, { name: a.name, ...a.live }])),
    diff: Object.fromEntries(Object.entries(accts).map(([u, a]) => [u, a.docSame ? a.diff : [...new Set([...a.diff, ...Object.entries(a.docs).filter(([, v]) => v !== "same" && v !== "none").map(([k]) => "وثيقة " + k)])]])) };
}
// المشرف: قائمة النسخ، نسخة الآن، تجربة الاسترجاع (فكّ النسخة وفحصها بلا كتابة)، الاسترجاع الفعلي
async function handleBackup(fs, user, body, env) {
  if (user.email !== ADMIN) return { status: 403, json: { error: "admin" } };
  if (!env.BAK) return { status: 500, json: { error: "nokv" } };
  const op = String(body.op || "list"), key = String(body.key || "");
  if (op === "list") { const l = (await env.BAK.list({ prefix: "bak-" })).keys.sort((a, b) => a.name < b.name ? 1 : -1); return { status: 200, json: { items: l.map(k => ({ key: k.name, ...(k.metadata || {}) })) } } }
  if (op === "now") return { status: 200, json: await backupOnce(env, fs, body.rid, "manual") };
  // لقطة الحسابات الآن (للتوثيق قبل التحديث وبعده)
  if (op === "snap") { await loadCfg(fs); return { status: 200, json: { at: Date.now(), cv: typeof CORE_V !== "undefined" ? CORE_V : "", accts: await liveSums(fs) } } }
  const b = await loadBak(env, key);
  if (op === "test") {
    const per = {}; for (const d of b.docs) { const p = d.name.slice(DOCROOT.length + 1).split("/"), c = p.length > 2 ? p[0] + "/…/" + p[p.length - 2] : p[0]; per[c] = (per[c] || 0) + 1 }
    const bad = b.docs.filter(d => !d.name.startsWith(DOCROOT + "/") || typeof d.fields !== "object").length;
    return { status: 200, json: { ok: !bad, at: b.at, n: b.docs.length, bad, per } };
  }
  // تحقق كامل بلا كتابة: تُفكّ النسخة وتُعاد بناء كل الحسابات منها، وتُقارن بالحسابات الحيّة
  if (op === "verify") return { status: 200, json: await verifyBak(fs, b, key) };
  if (op === "verify1") {
    const fromBak = bakSums(b), live = await liveSums(fs), diff = {};
    for (const uid of new Set([...Object.keys(fromBak), ...Object.keys(live)])) {
      const a = fromBak[uid], c = live[uid], d = [];
      if (!a || !c) d.push(!a ? "غير موجود في النسخة" : "غير موجود الآن");
      else for (const k of Object.keys(a)) if (JSON.stringify(a[k]) !== JSON.stringify(c[k])) d.push(k);
      diff[uid] = d;
    }
    return { status: 200, json: { ok: true, at: b.at, n: b.docs.length, bak: fromBak, live, diff } };
  }
  // تنزيل النسخة ملفًّا إلى جهاز المشرف (نسخة خارج Cloudflare وFirebase)
  if (op === "download") {
    const raw = new Uint8Array(await env.BAK.get(key, "arrayBuffer")); let bin = ""; for (let i = 0; i < raw.length; i += 32768) bin += String.fromCharCode.apply(null, raw.subarray(i, i + 32768));
    return { status: 200, json: { name: key + ".json.gz", b64: btoa(bin), size: raw.length } };
  }
  if (op === "restore") {
    if (body.confirm !== key) return { status: 400, json: { error: "confirm" } };
    const before = await backupNow(env, "before-restore");   // نسخة من الوضع الحالي أولًا، للتراجع إن لزم
    const H = await gauth(env), W = b.docs.filter(d => d.name.startsWith(DOCROOT + "/")).map(d => ({ update: { name: d.name, fields: d.fields }, ...(/\/aichat\/[^/]+\/m\//.test(d.name) ? { updateMask: { fieldPaths: Object.keys(d.fields) } } : {}) }));
    // نقطة حفظ السجل التي لم تكن في النسخة تُفرَّغ: وإلا اختلطت بسجلّ أقدم منها
    const inBak = new Set(b.docs.map(d => d.name));
    W.push(...restoreExtra(inBak, (await fs.list("users")).map(u => u.id)));
    for (let k = 0; k < W.length; k += 400) { const r = await fetch(FS_BASE + ":commit", { method: "POST", headers: H, body: JSON.stringify({ writes: W.slice(k, k + 400) }) }); if (!r.ok) throw new Error("restore " + r.status + " " + (await r.text()).slice(0, 150)) }
    return { status: 200, json: { ok: true, n: W.length, before: before.key } };
  }
  return { status: 400, json: { error: "op" } };
}

/* ---------- تتبّع الأخطاء: أخطاء التطبيق والخادم تُجمع هنا ويراها المشرف ---------- */
async function errHash(s) { return [...new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s)))].slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("") }

/* تنقية نص الخطأ قبل حفظه. تزيل أنماطًا محددة فقط، وكل ما عداها يبقى كما هو:
   - رموز الدخول (eyJ… وما بعد Bearer) ← [رمز]
   - عناوين البريد ← [بريد]
   - معرّفات الحسابات داخل مسارات المجموعات (users/…) أو بعد uid= ← [معرّف]
   - معاملات الروابط ما عدا v= (رقم نسخة core.js)، وما بعد # إن لم يكن اسم صفحة قصيرًا
   يبقى: نوع الخطأ والرسالة وأسماء الدوال والملفات وأرقام السطور والأعمدة ورقم النسخة والأرقام عمومًا.
   حدودها: لا تكتشف الأسماء الشخصية ولا أي نص حرّ آخر داخل الرسالة؛ فهي ليست ضمانًا كاملًا لإزالة البيانات الشخصية. */
const SAN_COLL = "users|names|pub|fr|on|gifts|members|assign|threads|feedback|rd|join|duel|bakrid|m|g|lg";
const SAN_ID = new RegExp(`((?:^|[\\s/'"(\`])(?:${SAN_COLL})/)([A-Za-z0-9]{20,40})(?=$|[\\s/'"\`)?#.,:;])`, "g");
function sanErr(s, tags) {
  s = String(s == null ? "" : s); const add = (k, n) => { if (n) tags[k] = (tags[k] || 0) + n }; let n = 0;
  // الروابط أولًا: يبقى العنوان والمسار ورقم النسخة v= والسطر والعمود؛ تُحذف بقية المعاملات وما بعد # إن لم يكن اسم صفحة
  s = s.replace(/(https?:\/\/[^\s?#'"()<>`]+)(\?[^\s#'"()<>`]*?)?(#[^\s'"()<>`]*?)?((?::\d+){0,2})(?=$|[\s'"()<>`,;])/g, (m, u, q, h, lc) => {
    let o = u;
    if (q) { const ps = q.slice(1).split("&").filter(Boolean), keep = ps.filter(p => /^v=[0-9A-Za-z._-]{1,24}$/.test(p)); if (keep.length) o += "?" + keep.join("&"); if (keep.length !== ps.length) n++ }
    if (h) { if (/^#[A-Za-z0-9_-]{0,30}$/.test(h)) o += h; else { o += "#[…]"; n++ } }
    return o + (lc || "");
  }); add("رابط", n); n = 0;
  s = s.replace(/eyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]{5,}/g, () => (n++, "[رمز]"));
  s = s.replace(/\b(Bearer)\s+(?!\[رمز\])[\w.~+\/-]+=*/gi, (m, b) => (n++, b + " [رمز]")); add("رمز", n); n = 0;
  s = s.replace(/[\w.%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g, () => (n++, "[بريد]")); add("بريد", n); n = 0;
  s = s.replace(SAN_ID, (m, a) => (n++, a + "[معرّف]"));
  s = s.replace(/\b(uid|userId|user)([=:]\s*)([A-Za-z0-9]{20,40})\b/g, (m, a, b) => (n++, a + b + "[معرّف]")); add("معرّف", n);
  return s;
}
const sanWhere = (w, tags) => { w = sanErr(w, tags); if (/^#/.test(w) && !/^#[A-Za-z0-9_-]{0,30}$/.test(w)) { tags["رابط"] = (tags["رابط"] || 0) + 1; return "#[…]" } return w };
const sanTag = tags => Object.entries(tags).map(([k, v]) => k + ":" + v).join("،");
// حقول الخطأ بعد القصّ والتنقية، والبصمة من النص المنقّى (فالخطأ نفسه لحسابين مختلفين مجموعة واحدة)
async function errFields(e, src) {
  const tags = {}, msg = sanErr(String(e.msg || "").slice(0, 300), tags).slice(0, 300);
  if (!msg) return null;
  const stack = sanErr(String(e.stack || "").slice(0, 1500), tags).slice(0, 1500), where = sanWhere(String(e.where || "").slice(0, 200), tags).slice(0, 200);
  const top = stack.split("\n").find(l => /:\d+:\d+/.test(l)) || "";
  const id = await errHash(src + "|" + msg.replace(/\d+/g, "#") + "|" + top.replace(/\?[^:]*/, ""));
  return { id, msg, stack, src, where, ua: sanErr(String(e.ua || "").slice(0, 200), tags).slice(0, 200), ver: String(e.ver || "").slice(0, 40), san: sanTag(tags) };
}
// أخطاء الخادم نفسه: تُسجَّل مباشرة كما كانت (خارج البوّابة)، بعد التنقية
async function logErr(fs, e) {
  const f = await errFields(e, e.src === "server" ? "server" : "app"); if (!f) return;
  const now = Date.now(), old = await fs.get(`errs/${f.id}`), d = old ? old.data : null;
  const users = [...new Set([...(d && d.users || []), e.uid || ""].filter(Boolean))].slice(-20);
  await fs.commit([{ path: `errs/${f.id}`, data: { msg: f.msg, stack: d && d.stack || f.stack, src: f.src, where: f.where || d && d.where || "", ua: f.ua || d && d.ua || "",
    ver: f.ver, san: f.san, n: (d && d.n || 0) + 1, first: d && d.first ? { __ts: d.first.ms } : { __ts: now }, last: { __ts: now }, users } }]);
}

// أخطاء الخادم نفسه تمرّ بالبوّابة أيضًا (السقوف نفسها: المستخدم الذي سبّبها، أو «server» للأعمال المجدولة).
// إن تعذّرت البوّابة: كتابة مباشرة مرة واحدة على الأكثر كل 10 دقائق لكل نسخة من الخادم (حتى لا يختفي عطل النسخ الاحتياطي مثلًا).
// ERR_MODE=off (متغيّر في لوحة Cloudflare): إيقاف تسجيل الأخطاء كله فورًا دون نشر شيفرة (للتراجع السريع).
let SRVDIRECT = 0;
async function srvErr(env, e, uid) {
  try {
    if (env.ERR_MODE === "off") return;
    const f = await errFields(e, "server"); if (!f) return;
    if (env.ERRGATE) { try { await egCall(env, "report", { ...f, uid: uid || "server" }); return } catch (x) { } }
    if (Date.now() - SRVDIRECT < 10 * 60e3) return; SRVDIRECT = Date.now();
    await logErr(env.__fs || makeFS(env), { ...e, src: "server", uid: uid && uid !== "server" ? uid : "" });
  } catch (x) { }
}

/* ---------- بوّابة الأخطاء (Durable Object واحد للعالم) ----------
   أخطاء التطبيق (/err) لا تُكتب في Firestore مباشرة ولا يُقرأ Firestore في مسارها: البوّابة تقرّر وتعدّ وتكتب على دفعات.
   - السقوف اليومية (يوم برلين): المجهولون 30 مجموعة جديدة و300 بلاغ؛ كل مستخدم مسجّل 30 مجموعة و200 بلاغ؛ الكل 2000 بلاغ.
     ما زاد للمسجّلين يُجمع في «ملخّص اليوم» (لا يُحجب بصمت)؛ وما زاد للمجهولين يُعدّ فقط.
   - الكتابة في Firestore: من المنبّه وحده، بقيمة مطلقة للعدد (لا زيادة)، مشروطة بوقت آخر تعديل تعرفه البوّابة،
     فلا تُكرَّر الأعداد عند إعادة المحاولة، ولا تُنزلها كتابة متأخرة.
   - محاولات الكتابة والقراءة في Firestore: 2000 على الأكثر في أي 24 ساعة متتالية (مجموعات 1880، ملخّص 96، سجلّ errq 24).
   - حذف المشرف: تُبلَّغ البوّابة أولًا (تنسى ما رآه المشرف، وتحتفظ بالبلاغات التي لم تصل إليه بعد)، ولا يرجع الردّ قبل أن تنتهي أي كتابة جارية. */
const EG = { anNew: 30, anRep: 300, uNew: 30, uRep: 200, allRep: 2000, wb: { g: 1880, s: 96, q: 24 }, rb: 2000, anGap: 30 * 60e3, flushGap: 60e3, slowAfter: 60, slowGap: 15 * 60e3, sumGap: 15 * 60e3,
  users: 20, ru: 50, sumMax: 50, perAlarm: 15, backoff: [60e3, 120e3, 300e3, 900e3, 3600e3], delWait: 5 * 60e3 };
const egStub = env => env.ERRGATE.get(env.ERRGATE.idFromName("errgate"));
async function egCall(env, op, body) { const r = await egStub(env).fetch("https://errgate/" + op, { method: "POST", body: JSON.stringify(body || {}) }); if (!r.ok) throw new Error("errgate " + r.status); return r.json() }
const egSumId = day => errHash("summary|" + day);

export class ErrGate {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env; this.sql = ctx.storage.sql; this.anonMem = new Map(); this.anonDrop = 0; this.inflight = null;
    for (const q of [
      "CREATE TABLE IF NOT EXISTS g(id TEXT PRIMARY KEY, kind TEXT, msg TEXT, stack TEXT, src TEXT, wh TEXT, ua TEXT, ver TEXT, san TEXT, first INTEGER, last INTEGER, users TEXT, total INTEGER, base INTEGER, conf INTEGER, sent INTEGER, ut TEXT, st TEXT, gen INTEGER, delAt INTEGER, lastAn INTEGER, ru TEXT, rf INTEGER, wday TEXT, wn INTEGER, lastW INTEGER)",
      "CREATE TABLE IF NOT EXISTS q(day TEXT PRIMARY KEY, an INTEGER, aw INTEGER, tw INTEGER, sm INTEGER)",
      "CREATE TABLE IF NOT EXISTS qu(day TEXT, uid TEXT, ng INTEGER, w INTEGER, PRIMARY KEY(day, uid))",
      "CREATE TABLE IF NOT EXISTS wb(h INTEGER, k TEXT, n INTEGER, PRIMARY KEY(h, k))",
      "CREATE TABLE IF NOT EXISTS sx(day TEXT PRIMARY KEY, data TEXT, n INTEGER, ver INTEGER)",
      "CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT)"]) this.sql.exec(q);
  }
  rows(q, ...a) { return this.sql.exec(q, ...a).toArray() }
  row(q, ...a) { return this.rows(q, ...a)[0] || null }
  meta(k, v) { if (v === undefined) { const r = this.row("SELECT v FROM meta WHERE k=?", k); return r ? r.v : null } this.sql.exec("INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", k, String(v)) }
  ensureAlarm(at) { const cur = +this.meta("alarm") || 0; if (cur && cur <= at) return; this.meta("alarm", at); const p = this.ctx.storage.setAlarm(at); if (p && p.catch) p.catch(() => { }) }
  async fetch(req) {
    const op = new URL(req.url).pathname.slice(1), b = await req.json().catch(() => ({}));
    try {
      if (op === "report") return Response.json(this.report(b));
      if (op === "del") return Response.json(await this.del(b));
      if (op === "state") return Response.json(this.state());
      return new Response("op", { status: 400 });
    } catch (e) { return new Response(String(e && e.message || e), { status: 500 }) }
  }
  // بلاغ واحد: كل ما هنا متزامن (بلا await)، فيُنفَّذ كاملًا قبل أي حدث آخر ويُحفظ كمعاملة واحدة
  report(b) {
    const now = Date.now(), day = dkey(now), anon = !b.uid, id = String(b.id || "");
    if (!/^[0-9a-f]{16}$/.test(id)) return { r: "id" };
    const q = this.row("SELECT * FROM q WHERE day=?", day) || { day, an: 0, aw: 0, tw: 0, sm: 0 };
    let g = this.row("SELECT * FROM g WHERE id=?", id);
    const fresh = !g || (g.st === "gone" && !g.total);
    const saveQ = () => this.sql.exec("INSERT INTO q(day,an,aw,tw,sm) VALUES(?,?,?,?,?) ON CONFLICT(day) DO UPDATE SET an=excluded.an,aw=excluded.aw,tw=excluded.tw,sm=excluded.sm", day, q.an, q.aw, q.tw, q.sm);
    if (anon) {
      if (!fresh && now - (g.lastAn || 0) < EG.anGap) { this.anonMem.set(id, (this.anonMem.get(id) || 0) + 1); this.ensureAlarm(now + EG.flushGap); return { r: "mem" } }
      if ((fresh && q.an >= EG.anNew) || q.aw >= EG.anRep || q.tw >= EG.allRep) { this.anonDrop++; return { r: "drop" } }
      if (fresh) q.an++; q.aw++;
    } else {
      const u = this.row("SELECT * FROM qu WHERE day=? AND uid=?", day, b.uid) || { ng: 0, w: 0 };
      if ((fresh && u.ng >= EG.uNew) || u.w >= EG.uRep || q.tw >= EG.allRep) { this.toSum(day, b, now); q.sm++; saveQ(); this.ensureAlarm(now + EG.flushGap); return { r: "sum" } }
      if (fresh) u.ng++; u.w++;
      this.sql.exec("INSERT INTO qu(day,uid,ng,w) VALUES(?,?,?,?) ON CONFLICT(day,uid) DO UPDATE SET ng=excluded.ng,w=excluded.w", day, b.uid, u.ng, u.w);
    }
    q.tw++; saveQ();
    if (!g) {
      this.sql.exec("INSERT INTO g(id,kind,msg,stack,src,wh,ua,ver,san,first,last,users,total,base,conf,sent,ut,st,gen,delAt,lastAn,ru,rf,wday,wn,lastW) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        id, "err", b.msg || "", b.stack || "", b.src || "app", b.where || "", b.ua || "", b.ver || "", b.san || "", now, now, JSON.stringify(b.uid ? [b.uid] : []), 1, 0, 0, -1, "", "new", 0, 0, anon ? now : 0,
        JSON.stringify(b.uid ? [b.uid] : []), now, day, 0, 0);
    } else {
      if (g.st === "gone") { g.st = "new"; g.total = 0; g.base = 0; g.conf = 0; g.sent = -1; g.users = "[]"; g.first = now; g.ru = "[]"; g.rf = 0; g.msg = b.msg || g.msg; g.stack = b.stack || g.stack }
      const users = JSON.parse(g.users || "[]"), ru = JSON.parse(g.ru || "[]");
      if (b.uid && !users.includes(b.uid)) { users.push(b.uid); if (users.length > EG.users) users.shift() }
      if (b.uid && !ru.includes(b.uid) && ru.length < EG.ru) ru.push(b.uid);
      const rf = g.total > g.conf ? g.rf : now;   // أول بلاغ لم يصل إلى المشرف بعد
      this.sql.exec("UPDATE g SET st=?,msg=?,stack=?,first=?,last=?,users=?,total=?,base=?,conf=?,sent=?,wh=?,ua=?,ver=?,san=?,lastAn=?,ru=?,rf=? WHERE id=?",
        g.st, g.msg, g.stack || b.stack || "", g.first, now, JSON.stringify(users), g.total + 1, g.base, g.conf, g.sent, b.where || g.wh, b.ua || g.ua, b.ver || g.ver, b.san || g.san, anon ? now : g.lastAn, JSON.stringify(ru), rf, id);
    }
    this.ensureAlarm(now + EG.flushGap);
    return { r: "ok" };
  }
  // بلاغ مسجّل فوق السقف: يُعدّ في ملخّص اليوم (البصمة والرسالة المنقّاة وأول ملف:سطر، وعدد المستخدمين لا معرّفاتهم)
  toSum(day, b, now) {
    const r = this.row("SELECT * FROM sx WHERE day=?", day), d = r ? JSON.parse(r.data) : { g: {}, more: 0, an: 0, first: now, last: now };
    const top = (String(b.stack || "").split("\n").find(l => /:\d+:\d+/.test(l)) || b.where || "").trim().slice(0, 120);
    let x = d.g[b.id];
    if (!x) { if (Object.keys(d.g).length >= EG.sumMax) { d.more++; x = null } else x = d.g[b.id] = { m: String(b.msg || "").slice(0, 120), f: top, n: 0, u: [] } }
    if (x) { x.n++; if (b.uid && !x.u.includes(b.uid) && x.u.length < 50) x.u.push(b.uid) }
    d.last = now;
    this.sql.exec("INSERT INTO sx(day,data,n,ver) VALUES(?,?,?,?) ON CONFLICT(day) DO UPDATE SET data=excluded.data,n=excluded.n,ver=excluded.ver", day, JSON.stringify(d), (r ? r.n : 0) + 1, (r ? r.ver : 0) + 1);
  }
  // حذف المشرف: تُنسى الأعداد التي وصلت إليه، وتبقى البلاغات التي لم تُكتب بعد (لم يرها)، ولا نرد قبل انتهاء أي كتابة جارية
  async del(b) {
    const now = Date.now(), ids = b.all ? this.rows("SELECT id FROM g").map(r => r.id) : (b.ids || []).filter(x => /^[0-9a-f]{16}$/.test(x));
    for (const id of ids) {
      const g = this.row("SELECT * FROM g WHERE id=?", id); if (!g) continue;
      const keep = Math.max(0, g.total - g.conf) + (this.anonMem.get(id) || 0); this.anonMem.delete(id);
      const ru = JSON.parse(g.ru || "[]");
      this.sql.exec("UPDATE g SET st=?,total=?,base=0,conf=0,sent=-1,ut='',users=?,first=?,gen=gen+1,delAt=?,ru='[]',rf=0 WHERE id=?",
        keep ? "new" : "gone", keep, JSON.stringify(keep ? ru : []), keep ? (g.rf || now) : now, now, id);
    }
    if (b.all) { this.sql.exec("DELETE FROM sx"); this.anonDrop = 0 }
    else for (const id of ids) { const g = this.row("SELECT kind,msg FROM g WHERE id=?", id); if (g && g.kind === "sum") this.sql.exec("DELETE FROM sx WHERE day=?", g.msg) }
    if (this.inflight) { try { await this.inflight } catch (e) { } }
    return { ok: true, n: ids.length };
  }
  state() { return { g: this.rows("SELECT * FROM g"), q: this.rows("SELECT * FROM q"), qu: this.rows("SELECT * FROM qu"), wb: this.rows("SELECT * FROM wb"), sx: this.rows("SELECT * FROM sx"), anonMem: [...this.anonMem], anonDrop: this.anonDrop, alarm: +this.meta("alarm") || 0 } }
  // ميزانية Firestore: المحاولات في آخر 24 ساعة (سلال ساعية)
  used(k) { const h = Math.floor(Date.now() / 3600e3); const r = this.row("SELECT SUM(n) s FROM wb WHERE k=? AND h>?", k, h - 24); return r && r.s || 0 }
  spend(k) { const h = Math.floor(Date.now() / 3600e3); this.sql.exec("INSERT INTO wb(h,k,n) VALUES(?,?,1) ON CONFLICT(h,k) DO UPDATE SET n=n+1", h, k); this.sql.exec("DELETE FROM wb WHERE h<?", h - 48) }
  can(k) { return k === "r" ? this.used("r") < EG.rb : this.used(k) < EG.wb[k] }
  docOf(g) { return { msg: g.msg, stack: g.stack, src: g.src, where: g.wh, ua: g.ua, ver: g.ver, san: g.san, n: g.base + g.total, first: { __ts: g.first }, last: { __ts: g.last }, users: JSON.parse(g.users || "[]") } }
  // كتابة واحدة بشرط: «غير موجودة» للجديدة، أو «لم تتغير منذ وقت آخر تعديل نعرفه». تعيد: ok | conflict | error
  async put(fs, path, data, g) {
    const w = g.st === "live" && g.ut ? { path, data, ifUpdateTime: g.ut } : { path, data, ifMissing: true };
    try { const r = await fs.commit([w]); return { r: "ok", ut: r && r[0] || "" } }
    catch (e) { return { r: e && (e.conflict || e.status === 404) ? "conflict" : "error", e } }
  }
  async alarm() {
    this.meta("alarm", 0);
    let p; this.inflight = p = this.flush().finally(() => { if (this.inflight === p) this.inflight = null });
    let res; try { res = await p } catch (e) { res = { failed: true } }
    const fails = res && res.failed ? (+this.meta("fails") || 0) + 1 : 0; this.meta("fails", fails);
    const now = Date.now();
    if (res && (res.pending || res.failed)) this.ensureAlarm(now + (fails ? EG.backoff[Math.min(fails - 1, EG.backoff.length - 1)] : res.wait || EG.flushGap));
  }
  pending() { return this.rows("SELECT * FROM g WHERE kind='err' AND st!='gone' AND total>0 AND (base+total)!=sent ORDER BY last") }
  async flush() {
    const fs = this.env.__fs || makeFS(this.env), now = Date.now(); let failed = false, pending = false, done = 0, wait = 0;
    // البلاغات المجهولة المقيّدة (في الذاكرة) تُضاف الآن إلى أعداد مجموعاتها
    for (const [id, n] of this.anonMem) this.sql.exec("UPDATE g SET total=total+?, last=? WHERE id=? AND st!='gone'", n, now, id); this.anonMem.clear();
    if (this.anonDrop) { const day = dkey(now), r = this.row("SELECT * FROM sx WHERE day=?", day), d = r ? JSON.parse(r.data) : { g: {}, more: 0, an: 0, first: now, last: now }; d.an += this.anonDrop; d.last = now; this.anonDrop = 0;
      this.sql.exec("INSERT INTO sx(day,data,n,ver) VALUES(?,?,?,?) ON CONFLICT(day) DO UPDATE SET data=excluded.data,n=excluded.n,ver=excluded.ver", day, JSON.stringify(d), (r ? r.n : 0), (r ? r.ver : 0) + 1) }
    // 1) المجموعات
    for (const g0 of this.pending()) {
      if (done >= EG.perAlarm) { pending = true; break }
      const day = dkey(now), wn = g0.wday === day ? g0.wn : 0;
      if (wn >= EG.slowAfter && now - g0.lastW < EG.slowGap) { pending = true; continue }
      if (!this.can("g")) { pending = true; wait = 3600e3; break }
      const snap = { total: g0.total, base: g0.base, gen: g0.gen }, data = this.docOf(g0);
      this.spend("g"); done++; this.sql.exec("UPDATE g SET wday=?, wn=?, lastW=? WHERE id=?", day, wn + 1, now, g0.id);
      const r = await this.put(fs, `errs/${g0.id}`, data, g0);
      const g = this.row("SELECT * FROM g WHERE id=?", g0.id);
      if (!g || g.gen !== snap.gen) continue;            // حُذفت أثناء الكتابة: النتيجة لا تُعتمد
      if (r.r === "ok") { const caught = g.total === snap.total; this.sql.exec("UPDATE g SET st='live', ut=?, sent=?, conf=?, ru=? WHERE id=?", r.ut, snap.base + snap.total, snap.total, caught ? "[]" : g.ru, g.id); if (!caught) pending = true; continue }
      if (r.r === "error") { failed = true; pending = true; break }
      // تعارض: نقرأ الوثيقة وحدها
      if (!this.can("r")) { pending = true; wait = 3600e3; continue }
      this.spend("r"); let cur; try { cur = await fs.get(`errs/${g.id}`) } catch (e) { failed = true; pending = true; break }
      const g2 = this.row("SELECT * FROM g WHERE id=?", g.id); if (!g2 || g2.gen !== snap.gen) continue;
      if (!cur) {
        if (g2.st === "live") {                          // حذفها المشرف دون أن تصلنا رسالته: نعاملها كحذف
          const keep = Math.max(0, g2.total - g2.conf);
          this.sql.exec("UPDATE g SET st=?,total=?,base=0,conf=0,sent=-1,ut='',users=?,first=?,gen=gen+1,delAt=?,ru='[]',rf=0 WHERE id=?", keep ? "new" : "gone", keep, keep ? g2.ru : "[]", keep ? (g2.rf || now) : now, now, g2.id);
        }
        pending = true; continue;                        // الجديدة تُعاد بشرط «غير موجودة»
      }
      const n = +cur.data.n || 0;
      if (g2.st === "live") {                            // كتابة سابقة لنا وصلت متأخرة: نأخذ وقتها، والعدد لا ينزل أبدًا
        const mine = g2.base + g2.total; this.sql.exec("UPDATE g SET ut=?, sent=?, base=? WHERE id=?", cur.updateTime, n, n > mine ? g2.base + (n - mine) : g2.base, g2.id); pending = true; continue;
      }
      if (g2.gen > 0) {                                  // بعد حذف المشرف: الوثيقة القديمة لم تُحذف بعد من Firestore
        if (now - (g2.delAt || 0) < EG.delWait) { pending = true; continue }
        this.sql.exec("UPDATE g SET st='live', ut=?, sent=? WHERE id=?", cur.updateTime, n, g2.id); pending = true; continue;   // تعذّر حذفها: نكتب فوقها بأعداد ما بعد الحذف
      }
      // وثيقة موجودة من قبل البوّابة: نبدأ من عددها، ونجمع المستخدمين، ونأخذ أول ظهور
      const users = [...new Set([...(cur.data.users || []), ...JSON.parse(g2.users || "[]")])].slice(-EG.users), first = Math.min(g2.first, cur.data.first && cur.data.first.ms || g2.first);
      this.sql.exec("UPDATE g SET st='live', ut=?, sent=?, base=?, users=?, first=?, stack=? WHERE id=?", cur.updateTime, n, n, JSON.stringify(users), first, cur.data.stack || g2.stack, g2.id); pending = true;
    }
    // 2) ملخّص الأيام: كل 15 دقيقة على الأكثر، وفقط إن تغيّر
    for (const s of this.rows("SELECT * FROM sx ORDER BY day")) {
      const id = await egSumId(s.day); let g = this.row("SELECT * FROM g WHERE id=?", id);
      if (!g) { this.sql.exec("INSERT INTO g(id,kind,msg,stack,src,wh,ua,ver,san,first,last,users,total,base,conf,sent,ut,st,gen,delAt,lastAn,ru,rf,wday,wn,lastW) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        id, "sum", s.day, "", "app", "summary", "", "", "", now, now, "[]", 0, 0, 0, -1, "", "new", 0, 0, 0, "[]", 0, "", 0, 0); g = this.row("SELECT * FROM g WHERE id=?", id) }
      if (g.sent === s.ver) continue;
      if (now - g.lastW < EG.sumGap) { pending = true; continue }
      if (!this.can("s")) { pending = true; wait = 3600e3; continue }
      const d = JSON.parse(s.data), list = Object.values(d.g).sort((a, b) => b.n - a.n), tot = list.reduce((a, x) => a + x.n, 0) + d.an;
      const lines = list.map(x => `${x.n}× [مسجّل، ${x.u.length} مستخدم] ${x.m}${x.f ? " — " + x.f : ""}`);
      if (d.more) lines.push(`… و${d.more} خطأ آخر لم يُفصَّل`); if (d.an) lines.push(`${d.an} بلاغ من غير مسجّلين حُجب (العدد فقط)`);
      const data = { msg: `⚠️ بلاغات فوق السقف يوم ${s.day}: ${tot}`, stack: lines.join("\n").slice(0, 6000), src: "app", where: "summary", ua: "", ver: "", san: "", n: tot, first: { __ts: d.first }, last: { __ts: d.last }, users: [] };
      const ver = s.ver, gen = g.gen; this.spend("s"); this.sql.exec("UPDATE g SET lastW=? WHERE id=?", now, id);
      const r = await this.put(fs, `errs/${id}`, data, g);
      const g2 = this.row("SELECT * FROM g WHERE id=?", id); if (!g2 || g2.gen !== gen) continue;
      if (r.r === "ok") { this.sql.exec("UPDATE g SET st='live', ut=?, sent=? WHERE id=?", r.ut, ver, id); continue }
      if (r.r === "error") { failed = true; pending = true; break }
      if (!this.can("r")) { pending = true; continue }
      this.spend("r"); let cur; try { cur = await fs.get(`errs/${id}`) } catch (e) { failed = true; pending = true; break }
      const g3 = this.row("SELECT * FROM g WHERE id=?", id); if (!g3 || g3.gen !== gen) continue;
      this.sql.exec("UPDATE g SET st=?, ut=? WHERE id=?", cur ? "live" : "new", cur ? cur.updateTime : "", id); pending = true;
    }
    // 3) سجلّ اليوم السابق في errq (مرة واحدة لكل يوم، بلا معرّفات)
    const today = dkey(now);
    for (const d of this.rows("SELECT * FROM q WHERE day<? ORDER BY day", today)) {
      if (this.meta("errq:" + d.day)) continue;
      if (!this.can("q")) { pending = true; break }
      this.spend("q");
      const users = this.row("SELECT COUNT(*) c FROM qu WHERE day=?", d.day).c;
      try { await fs.commit([{ path: `errq/${d.day}`, data: { day: d.day, anonNew: d.an, anonReports: d.aw, reports: d.tw, overCap: d.sm, users }, ifMissing: true }]); this.meta("errq:" + d.day, 1) }
      catch (e) { if (e && e.conflict) this.meta("errq:" + d.day, 1); else { failed = true; pending = true; break } }
    }
    if (!failed && this.pending().length) pending = true;
    return { pending, failed, wait };
  }
}

let ERRN = { t: 0, n: 0 };   // طبقة أولى رخيصة: 30 خطأ في الدقيقة على الأكثر لكل نسخة من الخادم
async function handleErr(req, env, H) {
  const ok = () => new Response("{}", { headers: { ...H, "Content-Type": "application/json" } });
  if (env.ERR_MODE === "off") return ok();     // مفتاح الإيقاف: لا تسجيل ولا Firestore ولا بوّابة
  if (!ORIGINS.includes(req.headers.get("Origin") || "")) return new Response("{}", { status: 403, headers: H });
  if (Date.now() - ERRN.t > 60e3) ERRN = { t: Date.now(), n: 0 };
  if (++ERRN.n > 30) return new Response("{}", { status: 429, headers: H });
  const txt = await req.text(); if (txt.length > 6000) return new Response("{}", { status: 413, headers: H });
  let b = {}; try { b = JSON.parse(txt) } catch (e) { return ok() }
  const f = await errFields(b || {}, "app"); if (!f) return ok();
  let uid = ""; try { uid = (await verifyIdToken((req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, ""))).uid } catch (e) { }
  if (!env.ERRGATE) return ok();                 // بلا بوّابة لا كتابة أبدًا (الفشل مغلق)
  try { await egCall(env, "report", { ...f, uid }) } catch (e) { }
  return ok();
}
async function handleErrs(fs, user, body, env) {
  if (user.email !== ADMIN) return { status: 403, json: { error: "admin" } };
  if (body.del) {
    const all = body.del === "all", ids = all ? [] : [String(body.del)].filter(x => /^[0-9a-f]{16}$/.test(x));
    // البوّابة أولًا: إن لم تؤكّد فلا حذف (لا حالة نصفها محذوف)
    if (env.ERRGATE && (all || ids.length)) { try { await egCall(env, "del", all ? { all: true } : { ids }) } catch (e) { return { status: 503, json: { error: "gate" } } } }
    const del = all ? (await fs.list("errs")).map(x => x.id) : ids;
    for (let k = 0; k < del.length; k += 400) await fs.commit(del.slice(k, k + 400).map(id => ({ path: `errs/${id}`, del: true })));
    return { status: 200, json: { ok: true } };
  }
  const l = (await fs.list("errs")).map(x => ({ id: x.id, msg: x.msg, stack: x.stack, src: x.src, where: x.where, ua: x.ua, ver: x.ver, san: x.san || "", n: x.n, first: x.first && x.first.ms || 0, last: x.last && x.last.ms || 0, users: x.users || [] })).sort((a, b) => b.last - a.last).slice(0, 100);
  return { status: 200, json: { items: l } };
}


/* ---------- الأصدقاء والتحدي المباشر ---------- */
// fr/{uid}: { list: { uid: { s: "f" صديق | "out" طلب أرسلته | "in" طلب وصلني, n: اسم الدخول, t, w: فوز, l: خسارة } }, inv: دعوة تحدٍّ واردة }
// on/{uid}: آخر ظهور (يُكتب مرة في الدقيقة على الأكثر). duel/{id}: التحدي نفسه
const ONLINE = 90e3, INV_TTL = 60e3, DUEL_N = 10;
// لا حدّ كلّي ظاهر: لكل سؤال d.qt ثانية (يحدّدها المشرف ويُثبَّت في التحدي عند إنشائه)،
// وحدّ احتياطي فقط لمن أغلق التطبيق = الأسئلة × (ثواني السؤال + 2) + 15 ثانية
const dQt = d => Math.min(120, Math.max(5, +d.qt || 15));
const dLen = d => DUEL_N * (dQt(d) * 1e3 + 2e3) + 15e3;
const ONA = new Map();   // آخر كتابة لوقت النشاط الحقيقي (لمس أو كتابة من المتعلّم) في هذه النسخة من الخادم
const ONW = new Map();   // آخر كتابة للظهور في هذه النسخة من الخادم (توفير الكتابات)
const loginOf = u => String(u.email || "").split("@")[0];
async function frGet(fs, uid) { const d = await fs.get(`fr/${uid}`); return Object.assign({ list: {}, inv: null }, d ? d.data : {}) }
async function uidOfLogin(env, login) {
  if (env.__fs) return (await env.__fs.get(`members/u_${login}`)) ? "u_" + login : "";
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`, { method: "POST", headers: { Authorization: "Bearer " + await googleToken(env), "Content-Type": "application/json" }, body: JSON.stringify({ email: [login + "@mufradati.app"] }) });
  const j = await r.json().catch(() => ({})); return j.users && j.users[0] ? j.users[0].localId : "";
}
async function loginOfUid(env, uid) {
  if (env.__fs) return uid.replace(/^u_/, "");
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`, { method: "POST", headers: { Authorization: "Bearer " + await googleToken(env), "Content-Type": "application/json" }, body: JSON.stringify({ localId: [uid] }) });
  const j = await r.json().catch(() => ({})); return j.users && j.users[0] ? String(j.users[0].email || "").split("@")[0] : "";
}
// الحساب المفعّل: المشرف، أو له وثيقة تقدّم (users)، أو فعّله المشرف (members) — القاعدة نفسها في المزامنة وقواعد Firestore.
// نتيجة «مفعّل» تُحفظ 10 دقائق في ذاكرة النسخة توفيرًا للقراءات (لا يوجد إلغاء تفعيل في التطبيق)؛ نتيجة «غير مفعّل» لا تُحفظ.
const ACTIVE = new Map();
async function isActive(fs, user) {
  if (user.email === ADMIN) return true;
  const c = ACTIVE.get(user.uid); if (c && Date.now() - c < 10 * 60e3) return true;
  const ok = !!(await fs.get(`members/${user.uid}`)) || !!(await fs.get(`users/${user.uid}`));
  if (ok) { if (ACTIVE.size > 5000) ACTIVE.clear(); ACTIVE.set(user.uid, Date.now()) }
  return ok;
}
async function handleFriends(fs, user, body, env) {
  const me = user.uid, op = String(body.op || "tick"), now = Date.now();
  if (user.email === ADMIN) return { status: 403, json: { error: "admin" } };
  if (!(await isActive(fs, user))) return { status: 403, json: { error: "inactive" } };   // حساب غير مفعّل: لا صداقة ولا ظهور
  if (op === "tick") {
    // نبضة كل بضع ثوانٍ: «أنا متصل»، وهل وصلتني دعوة تحدٍّ؟
    const w = [];
    // t: التطبيق مفتوح وظاهر (للاتصال الآن ودعوات التحدي). a: آخر نشاط حقيقي، فقط إن أخبر التطبيق أن المتعلّم لمس الشاشة أو كتب منذ النبضة السابقة
    const d = {};
    if (now - (ONW.get(me) || 0) > 50e3) { ONW.set(me, now); d.t = { __ts: now } }
    if (body.act && now - (ONA.get(me) || 0) > 50e3) { ONA.set(me, now); d.a = { __ts: now } }
    if (d.t || d.a) w.push({ path: `on/${me}`, data: d, merge: true });
    const f = await frGet(fs, me); if (w.length) await fs.commit(w);
    const inv = f.inv && now - (f.inv.t && f.inv.t.ms || f.inv.t || 0) < INV_TTL ? { id: f.inv.id, from: f.inv.from, name: f.inv.name, with: f.inv.with || [] } : null;
    const L = Object.values(f.list || {});
    return { status: 200, json: { inv, nf: L.filter(x => x.s === "f").length, nin: L.filter(x => x.s === "in").length } };
  }
  if (op === "list") {
    const f = await frGet(fs, me), ids = Object.keys(f.list || {});
    const mm = await fs.get(`members/${me}`), myNo = mm && mm.data.no != null ? String(mm.data.no).padStart(6, "0") : "";   // رقم الحساب نفسه (يظهر في الإعدادات)
    const got = await fs.many(ids.flatMap(id => [`names/${id}`, `on/${id}`]));
    return { status: 200, json: { items: ids.map(id => { const x = f.list[id], nm = got[`names/${id}`], on = got[`on/${id}`], t = on && on.t ? on.t.ms || 0 : 0, a = on && on.a ? on.a.ms || 0 : 0;
      // «آخر ظهور»: آخر نشاط حقيقي (a)، وللحساب الذي لم يرسل تطبيقه النشاط بعد (نسخة قديمة) وقت الظهور كما كان
      return { uid: id, s: x.s, login: x.n || "", name: nm && nm.name || x.n || "", on: now - t < ONLINE, seen: a || t, w: x.w || 0, l: x.l || 0 } }), code: myNo } };
  }
  const other = String(body.uid || "");
  if (op === "add") {
    let login = String(body.login || "").trim().toLowerCase().replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\s/g, ""), o = "";
    if (/^\d{1,9}$/.test(login)) {   // إضافة برقم الحساب (الظاهر في الإعدادات)
      const n = +login; if (n === 0) return { status: 404, json: { error: "nouser" } };
      const hit = await fs.where("members", "no", n); if (!hit) return { status: 404, json: { error: "nouser" } };
      o = hit; if (o === me) return { status: 400, json: { error: "self" } };
      login = await loginOfUid(env, o);
    } else {
      if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(login)) return { status: 400, json: { error: "login" } };
      if (login === loginOf(user) || login === "admin") return { status: 400, json: { error: "self" } };
      o = await uidOfLogin(env, login); if (!o || !(await isActive(fs, { uid: o }))) return { status: 404, json: { error: "nouser" } };
    }
    const [a, b] = await Promise.all([frGet(fs, me), frGet(fs, o)]);
    if (Object.keys(a.list).length >= 100) return { status: 400, json: { error: "many" } };
    const cur = a.list[o];
    if (cur && cur.s === "f") return { status: 200, json: { ok: true, s: "f" } };
    const both = cur && cur.s === "in";   // كان قد أرسل لي طلبًا: نصبح أصدقاء مباشرة
    a.list[o] = { ...(cur || {}), s: both ? "f" : "out", n: login, t: { __ts: now } };
    b.list[me] = { ...(b.list[me] || {}), s: both ? "f" : "in", n: loginOf(user), t: { __ts: now } };
    await fs.commit([{ path: `fr/${me}`, data: { list: a.list }, merge: true }, { path: `fr/${o}`, data: { list: b.list }, merge: true }]);
    return { status: 200, json: { ok: true, s: a.list[o].s } };
  }
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(other)) return { status: 400, json: { error: "uid" } };
  const [a, b] = await Promise.all([frGet(fs, me), frGet(fs, other)]);
  if (op === "acc") {
    if (!a.list[other] || a.list[other].s !== "in") return { status: 400, json: { error: "noreq" } };
    a.list[other].s = "f"; b.list[me] = { ...(b.list[me] || { n: loginOf(user) }), s: "f" };
  } else if (op === "del") { delete a.list[other]; delete b.list[me] }   // رفض طلب، أو إلغاء طلبي، أو حذف صديق
  else return { status: 400, json: { error: "op" } };
  await fs.commit([{ path: `fr/${me}`, data: { list: a.list }, merge: true }, { path: `fr/${other}`, data: { list: b.list }, merge: true }]);
  return { status: 200, json: { ok: true } };
}
// التحدي: ps = اللاعبون (الأوّل هو صاحب الدعوة، حتى 4)، nm = أسماؤهم، a_<uid> = ردّ كل مدعوّ، p_<uid> = تقدّم كل لاعب
// (حقول منفصلة لكل لاعب حتى لا تمحو كتابةُ لاعبٍ كتابةَ آخر)
const DUEL_MAX = 4;
const dAct = d => (d.ps || []).filter((u, k) => k === 0 || d["a_" + u] === "acc");   // اللاعبون الفعليون
const dProg = (d, u) => Object.assign({ i: 0, c: 0, ms: 0, d: false, h: "", x: [] }, d["p_" + u]);   // h: صح/خطأ لكل سؤال، x: الأخطاء
const duelView = (d, id, me) => ({ id, ps: d.ps || [], nm: d.nm || {}, ac: Object.fromEntries((d.ps || []).slice(1).map(u => [u, d["a_" + u] || "inv"])),
  p: Object.fromEntries((d.ps || []).map(u => [u, dProg(d, u)])), st: d.st, s: d.s || 0, qt: dQt(d), rank: d.rank || [], me, now: Date.now() });
// الترتيب: الأكثر إجابات صحيحة، ثم الأسرع (من لم يُنهِ يُعدّ أبطأ). السجلّ (فوز/خسارة) للتحدي الثنائي فقط
// الفائز: صاحب المركز الأول إن تفوّق فعلًا على الثاني (لا تعادل، ولا منسحب، وأنهى وأجاب صحيحًا مرة على الأقل)
function duelWinner(d) {
  if (d.st !== "done") return null;
  const R = (d.rank || []).filter(u => u !== "tie"); if ((d.rank || [])[0] === "tie" || R.length < 2) return null;
  const a = dProg(d, R[0]), b = dProg(d, R[1]);
  if (a.q || !a.d || !(a.c > 0)) return null;
  if (b.q) return R[0];
  return a.c > b.c || (a.c === b.c && (!b.d || a.ms < b.ms)) ? R[0] : null;
}
async function duelFinishW(fs, d, now) {
  const A = dAct(d), key = u => { const p = dProg(d, u); return p.q ? [1, Infinity] : [-(p.c || 0), p.d ? p.ms : Infinity] };   // المنسحب آخرًا
  d.rank = A.slice().sort((x, y) => { const a = key(x), b = key(y); return a[0] - b[0] || a[1] - b[1] }); d.st = "done";
  const w = [];
  if ((d.ps || []).length === 2 && A.length === 2) {   // التحدي الجماعي لا يدخل السجلّ
    const [x, y] = d.rank, kx = key(x), ky = key(y);
    if (kx[0] !== ky[0] || kx[1] !== ky[1]) {
      const [fx, fy] = await Promise.all([frGet(fs, x), frGet(fs, y)]);
      if (fx.list[y] && fy.list[x]) { fx.list[y].w = (fx.list[y].w || 0) + 1; fy.list[x].l = (fy.list[x].l || 0) + 1;
        w.push({ path: `fr/${x}`, data: { list: fx.list }, merge: true }, { path: `fr/${y}`, data: { list: fy.list }, merge: true }) }
    } else d.rank = ["tie", ...d.rank];
  }
  return w;
}
// يبدأ التحدي إن ردّ كل المدعوّين أو انتهت المهلة وقد قبل واحد على الأقل
function duelMaybeStart(d, now, force) {
  if (d.st !== "inv") return false;
  const inv = (d.ps || []).slice(1), acc = inv.filter(u => d["a_" + u] === "acc"), left = inv.filter(u => !d["a_" + u] || d["a_" + u] === "inv");
  const late = now - (d.t && d.t.ms || 0) > INV_TTL;
  if (acc.length && (force || !left.length || late)) { d.st = "on"; d.s = now + 4000; return true }
  if (!acc.length && (!left.length || late)) { d.st = left.length ? "x" : "no"; return true }
  return false;
}
async function handleDuel(fs, user, body, env) {
  const me = user.uid, op = String(body.op || "st"), now = Date.now();
  if (!(await isActive(fs, user))) return { status: 403, json: { error: "inactive" } };
  if (op === "inv") {
    const to = [...new Set((Array.isArray(body.to) ? body.to : [body.to]).map(String))].filter(u => /^[A-Za-z0-9_-]{1,128}$/.test(u) && u !== me);
    if (!to.length || to.length > DUEL_MAX - 1) return { status: 400, json: { error: "uid" } };
    const [f, nm, ...rest] = await Promise.all([frGet(fs, me), fs.get(`names/${me}`), ...to.flatMap(u => [fs.get(`on/${u}`), fs.get(`names/${u}`), frGet(fs, u)])]);
    const names = { [me]: nm && nm.data.name || loginOf(user) }, bad = { notfriend: [], offline: [], busy: [] };
    to.forEach((u, k) => { const on = rest[k * 3], n = rest[k * 3 + 1], fr = rest[k * 3 + 2];
      names[u] = n && n.data.name || (f.list[u] && f.list[u].n) || "";
      if (!f.list[u] || f.list[u].s !== "f") bad.notfriend.push(u);
      else if (!on || now - (on.data.t && on.data.t.ms || 0) > ONLINE) bad.offline.push(u);
      else if (fr.inv && now - (fr.inv.t && fr.inv.t.ms || 0) < INV_TTL && fr.inv.from !== me) bad.busy.push(u) });
    const e = bad.notfriend.length ? "notfriend" : bad.offline.length ? "offline" : bad.busy.length ? "busy" : "";
    if (e) return { status: e === "notfriend" ? 403 : 409, json: { error: e, who: bad[e].map(u => names[u]) } };
    const id = now.toString(36) + Math.random().toString(36).slice(2, 7), ps = [me, ...to];
    await loadCfg(fs);
    const d = { ps, nm: names, st: "inv", t: { __ts: now }, s: 0, rank: [], qt: CFG.duel.qt };
    for (const u of ps) d["p_" + u] = { i: 0, c: 0, ms: 0, d: false };
    for (const u of to) d["a_" + u] = "inv";
    await fs.commit([{ path: `duel/${id}`, data: d }, ...to.map(u => ({ path: `fr/${u}`, data: { inv: { id, from: me, name: names[me], with: to.filter(x => x !== u).map(x => names[x]), t: { __ts: now } } }, merge: true }))]);
    d.t = { ms: now }; return { status: 200, json: duelView(d, id, me) };
  }
  const id = String(body.id || ""); if (!/^[a-z0-9]{6,20}$/.test(id)) return { status: 400, json: { error: "id" } };
  const doc = await fs.get(`duel/${id}`); if (!doc) return { status: 404, json: { error: "nodule" } };
  const d = doc.data, host = (d.ps || [])[0]; if (!(d.ps || []).includes(me)) return { status: 403, json: { error: "notyours" } };
  const st0 = d.st;
  const upd = {}, extra = [];
  if (op === "acc" || op === "no") {
    if (d.st !== "inv") return { status: 409, json: duelView(d, id, me) };
    if (me === host) { if (op === "no") { d.st = "x"; upd.st = "x" } }   // صاحب الدعوة يلغي
    else { d["a_" + me] = op === "acc" ? "acc" : "no"; upd["a_" + me] = d["a_" + me]; extra.push({ path: `fr/${me}`, data: { inv: null }, merge: true }) }
  }
  if (op === "go" && me === host) duelMaybeStart(d, now, true);   // «ابدأ الآن» مع من قبل
  else duelMaybeStart(d, now, false);
  if (d.st !== st0 || upd.st) Object.assign(upd, { st: d.st, s: d.s || 0 });
  if (op === "ans" && d.st === "on") {
    const k = "p_" + me, p = dProg(d, me), i = +body.i;
    if (dAct(d).includes(me) && !p.d && now >= d.s && i === p.i + 1 && i <= DUEL_N && now - d.s <= dLen(d)) {
      p.i = i; p.c += body.ok ? 1 : 0; p.ms = now - d.s; p.d = i === DUEL_N; p.h = (p.h || "") + (body.ok ? "1" : "0");
      if (!body.ok && p.x.length < DUEL_N) { const t = v => String(v || "").slice(0, 80); p.x.push({ de: t(body.de), ar: t(body.ar), pk: t(body.pk) }) }   // تقرير الأخطاء
      d[k] = p;
      await fs.commit([{ path: `duel/${id}`, data: { [k]: p }, merge: true }]);   // حقل اللاعب وحده: لا يتعارض مع الآخرين
    }
  }
  // الانسحاب أثناء اللعب: يُعدّ منتهيًا (ويأتي آخرًا) فلا ينتظره الباقون
  if (op === "quit" && d.st === "on" && dAct(d).includes(me)) {
    const k = "p_" + me, p = dProg(d, me);
    if (!p.d) { p.d = true; p.q = 1; p.ms = dLen(d); d[k] = p; await fs.commit([{ path: `duel/${id}`, data: { [k]: p }, merge: true }]) }
  }
  // ينتهي حين يُنهي كل اللاعبين، أو تنقضي الدقائق الثلاث
  let w = [];
  if (d.st === "on" && (dAct(d).every(u => dProg(d, u).d) || now - d.s > dLen(d) + 5e3)) { w = await duelFinishW(fs, d, now); Object.assign(upd, { st: "done", rank: d.rank, end: { __ts: now } }) }
  if (Object.keys(upd).length || extra.length) {
    const cur = op === "ans" || op === "quit" ? await fs.get(`duel/${id}`) : doc;   // بعد كتابة الإجابة تغيّر وقت التحديث
    try { await fs.commit([...(Object.keys(upd).length ? [{ path: `duel/${id}`, data: upd, merge: true, ifUpdateTime: cur.updateTime }] : []), ...extra, ...(st0 === "inv" && d.st !== "inv" ? (d.ps || []).slice(1).map(u => ({ path: `fr/${u}`, data: { inv: null }, merge: true })) : []), ...w]) }
    catch (e) { if (!e.conflict) throw e; const again = await fs.get(`duel/${id}`); return { status: 200, json: { ...duelView(again.data, id, me), retry: 1 } } }
  }
  return { status: 200, json: duelView(d, id, me) };
}

/* ---------- نقطة الدخول ---------- */
function cors(req) {
  const o = req.headers.get("Origin") || "";
  return { "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0], "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Max-Age": "86400", "Vary": "Origin" };
}

/* ---------- القراءة: مجموعات جمل يُدخلها المشرف لحسابات ولديه، تُقرأ جملةً جملة بصوت Azure ----------
   rd/{uid}: g_<id> = {ti, s:[جمل], o, t} ، p_<id> = موضع المتعلّم. الصوت في BAK: rda-<بصمة> (يُصنع عند أول طلب ويُحفظ) */
const RD_MAX_S = 300, RD_MAX_LEN = 400;
const RD_ABBR = /(?:^|\s)(?:\d+|[A-Za-zÄÖÜäöü]|z|d|u|ca|Nr|Dr|bzw|usw|vgl|Hr|Fr|St|Str|evtl|ggf|inkl|etc)\.$/;
function rdSplit(txt) {
  const out = [];
  for (const line of String(txt || "").replace(/\r/g, "").split(/\n+/)) {
    const L = line.replace(/\s+/g, " ").trim(); if (!L) continue;
    const parts = L.match(/[^.!?…]+(?:[.!?…]+["“”»«›‹'’)]*|$)/g) || [L];   // ›‹ علامتا الاقتباس الداخلي
    let cur = "";
    for (const raw of parts) {
      const x = raw.trim(); if (!x) continue;
      // «z. B.» و«16. Juli» وما يبدأ بحرف صغير: تكملة للجملة نفسها
      if (cur && (RD_ABBR.test(cur) || /^[a-zäöüß,;:)]/.test(x))) cur += (/^[,;:)]/.test(x) ? "" : " ") + x; else { if (cur) out.push(cur); cur = x }
    }
    if (cur) out.push(cur);
  }
  return out.map(x => x.slice(0, RD_MAX_LEN)).slice(0, RD_MAX_S);
}
const rdGroups = d => Object.entries(d || {}).filter(([k, v]) => k.startsWith("g_") && v && Array.isArray(v.s)).map(([k, v]) => ({ id: k.slice(2), ...v })).sort((a, b) => (a.o || 0) - (b.o || 0));
async function rdHash(t) { const b = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("Katja|" + t))); return [...b.slice(0, 12)].map(x => x.toString(16).padStart(2, "0")).join("") }
function b64(buf) { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s) }
async function rdAudio(env, t) {
  if (!env.BAK) return null;
  const k = "rda-" + await rdHash(t), have = await env.BAK.get(k, "arrayBuffer"); if (have) return have;
  const key = String(env.AZURE_SPEECH_KEY || "").trim(); if (!key) return null;
  const esc = x => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const ssml = `<speak version='1.0' xml:lang='de-DE'><voice name='de-DE-KatjaNeural'><prosody rate='-6%'>${esc(t)}</prosody></voice></speak>`;
  const r = await fetch(`https://${String(env.AZURE_SPEECH_REGION || "westeurope").trim()}.tts.speech.microsoft.com/cognitiveservices/v1`, { method: "POST", body: ssml,
    headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3", "User-Agent": "mufradati" } });
  if (!r.ok) return null;
  const buf = await r.arrayBuffer(); await env.BAK.put(k, buf); return buf;
}
// نتائج أوراق الرياضيات (mt/{uid}): الحقل m_<ورقة> = {i: السؤال الحالي, r: نص JSON {رقم: {v, ok}}, t}
// المتعلّم يحفظ ويقرأ نتائجه؛ المشرف يقرأ نتائج أي متعلّم ويصفّر ورقة
async function handleMt(fs, user, body) {
  const admin = user.email === ADMIN, op = String(body.op || "get");
  const u = admin ? String(body.u || "") : user.uid;
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(u)) return { status: 400, json: { error: "u" } };
  const sid = String(body.set || "");
  if (sid && !/^[A-Za-z0-9_-]{3,40}$/.test(sid)) return { status: 400, json: { error: "set" } };
  const key = "m_" + sid.replace(/[^A-Za-z0-9]/g, "_");
  if (op === "get") {
    const doc = await fs.get(`mt/${u}`), d = doc ? doc.data : {}, out = {};
    for (const k in d) if (k.startsWith("m_") && d[k] && typeof d[k] === "object") { let r = {}; try { r = JSON.parse(d[k].r || "{}") } catch (e) {} let f = {}; try { f = JSON.parse(d[k].f || "{}") } catch (e) {} out[d[k].id || k.slice(2)] = { i: +d[k].i || 0, r, f, t: d[k].t || 0, z: +d[k].z || 0 } }
    const arr = x => { try { const a = JSON.parse(x || "[]"); return Array.isArray(a) ? a : [] } catch (e) { return [] } };
    return { status: 200, json: { m: out, hid: arr(d.hid), shw: arr(d.shw) } };
  }
  if (!sid) return { status: 400, json: { error: "set" } };
  if (op === "save" && !admin) {
    // جهاز لم يعلم بعدُ بـ«من الأوّل» (z أقدم) لا يكتب فوق الإعادة
    const cur = await fs.get(`mt/${u}`), cz = cur && cur.data[key] && +cur.data[key].z || 0;
    if ((+body.z || 0) < cz) return { status: 200, json: { ok: false, reset: 1 } };
    const i = Math.max(0, Math.min(500, Math.floor(+body.i || 0)));
    // r: آخر جواب لكل سؤال؛ f: أول جواب (لا يتغيّر بالإعادة، ليرى المشرف أخطاءه الأولى)
    const clean = o => { const x = {}; o = o && typeof o === "object" ? o : {}; for (const k of Object.keys(o).slice(0, 500)) if (/^\d{1,3}$/.test(k) && o[k]) x[k] = { v: String(o[k].v || "").slice(0, 1500), ok: !!o[k].ok } /* 1500: نصوص الكتابة الحرّة */; return x };
    await fs.commit([{ path: `mt/${u}`, data: { [key]: { id: sid, i, r: JSON.stringify(clean(body.r)), f: JSON.stringify(clean(body.f)), t: Date.now(), z: cz } }, merge: true }]); return { status: 200, json: { ok: true } };
  }
  // إخفاء ورقة عن المتعلّم أو إظهارها (hid: قائمة الأوراق المخفية)
  if (op === "vis" && admin) {
    // shw: أوراق مخفية أصلًا (hide في math.json) أظهرها المشرف لهذا المتعلّم
    const doc = await fs.get(`mt/${u}`), dd = doc ? doc.data : {}, arr = x => { try { const a = JSON.parse(x || "[]"); return Array.isArray(a) ? a : [] } catch (e) { return [] } };
    let h = arr(dd.hid).filter(x => x !== sid), s = arr(dd.shw).filter(x => x !== sid); if (body.h) h.push(sid); else s.push(sid);
    await fs.commit([{ path: `mt/${u}`, data: { hid: JSON.stringify(h.slice(-200)), shw: JSON.stringify(s.slice(-200)) }, merge: true }]); return { status: 200, json: { ok: true } };
  }
  if (op === "reset" && admin) { await fs.commit([{ path: `mt/${u}`, data: { [key]: { id: sid, i: 0, r: "{}", f: "{}", t: Date.now(), z: Date.now() } }, merge: true }]); return { status: 200, json: { ok: true } } }
  return { status: 400, json: { error: "op" } };
}
async function handleRd(fs, user, body, env) {
  const admin = user.email === ADMIN, op = String(body.op || "list");
  const u = admin ? String(body.u || "") : user.uid;
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(u)) return { status: 400, json: { error: "u" } };
  const id = String(body.id || "");
  if (id && !/^[A-Za-z0-9]{4,20}$/.test(id)) return { status: 400, json: { error: "id" } };
  const doc = await fs.get(`rd/${u}`), d = doc ? doc.data : {};
  // المجموعة المخفية (h) لا تظهر للمتعلّم، والمشرف يراها كلها
  if (op === "list") return { status: 200, json: { g: rdGroups(d).filter(g => admin || !g.h).map(g => ({ id: g.id, ti: g.ti, n: g.s.length, p: +d["p_" + g.id] || 0, t: g.t || 0, h: g.h ? 1 : 0 })) } };
  const g0 = id ? d["g_" + id] : null, g = g0 && (admin || !g0.h) ? g0 : null;
  if (op === "get") { if (!g) return { status: 404, json: { error: "nog" } }; return { status: 200, json: { ti: g.ti, s: g.s, ar: Array.isArray(g.ar) ? g.ar : [], p: +d["p_" + id] || 0 } } }
  if (op === "pos") { if (admin || !g) return { status: 400, json: { error: "pos" } };
    const i = Math.max(0, Math.min(g.s.length, Math.floor(+body.i || 0))); await fs.commit([{ path: `rd/${u}`, data: { ["p_" + id]: i }, merge: true }]); return { status: 200, json: { ok: true } } }
  if (op === "aud") {
    if (!g) return { status: 404, json: { error: "nog" } };
    const i = Math.floor(+body.i || 0), t = g.s[i]; if (t == null) return { status: 400, json: { error: "i" } };
    const a = await rdAudio(env, t); return { status: 200, json: a ? { a: b64(a) } : { a: "" } };
  }
  if (!admin) return { status: 403, json: { error: "admin" } };
  if (op === "save") {
    const ti = String(body.ti || "").replace(/\s+/g, " ").trim().slice(0, 80), s = rdSplit(body.txt);
    if (!ti || !s.length) return { status: 400, json: { error: "empty" } };
    const nid = id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)), old = d["g_" + nid];
    const o = old ? old.o : Math.max(0, ...rdGroups(d).map(x => x.o || 0)) + 1;
    // ترجمة كل جملة يكتبها المشرف بنفسه: {الجملة: ترجمتها}، وتُحفظ بترتيب الجمل
    const trm = body.tr && typeof body.tr === "object" ? body.tr : {}, ar = s.map(x => String(trm[x] || "").replace(/\s+/g, " ").trim().slice(0, RD_MAX_LEN));
    const nd = { ...d, ["g_" + nid]: { ti, s, ar, o, h: old && old.h ? 1 : 0, t: { __ts: Date.now() } } };
    // إن تغيّرت الجمل يبدأ المتعلّم المجموعة من أوّلها
    if (old && JSON.stringify(old.s) !== JSON.stringify(s)) nd["p_" + nid] = 0;
    await fs.commit([{ path: `rd/${u}`, data: nd }]);
    // تجهيز صوت أول الجمل مسبقًا (الخطة المجانية ~20 طلبًا في الدقيقة)
    if (env.__ctx && env.__ctx.waitUntil) env.__ctx.waitUntil((async () => { for (const t of s.slice(0, 6)) { try { await rdAudio(env, t) } catch (e) { break } } })());
    return { status: 200, json: { ok: true, id: nid, n: s.length } };
  }
  if (op === "del") {
    if (!g) return { status: 404, json: { error: "nog" } };
    const nd = { ...d }; delete nd["g_" + id]; delete nd["p_" + id];
    await fs.commit([Object.keys(nd).length ? { path: `rd/${u}`, data: nd } : { path: `rd/${u}`, del: true }]);
    return { status: 200, json: { ok: true, left: rdGroups(nd).length } };
  }
  if (op === "reset") {   // تصفير تقدّم المتعلّم في المجموعة: يبدأها من أوّل جملة
    if (!g) return { status: 404, json: { error: "nog" } };
    await fs.commit([{ path: `rd/${u}`, data: { ["p_" + id]: 0 }, merge: true }]); return { status: 200, json: { ok: true } };
  }
  if (op === "vis") {   // إظهار المجموعة للمتعلّم أو إخفاؤها
    if (!g) return { status: 404, json: { error: "nog" } };
    await fs.commit([{ path: `rd/${u}`, data: { ["g_" + id]: { ...g, h: body.h ? 1 : 0 } }, merge: true }]); return { status: 200, json: { ok: true, h: body.h ? 1 : 0 } };
  }
  if (op === "split") return { status: 200, json: { s: rdSplit(body.txt) } };
  return { status: 400, json: { error: "op" } };
}

export default {
  async scheduled(ev, env, ctx) { ctx.waitUntil((async () => { try { await aiCleanup(env) } catch (e) { } try { if (env.BAK) await backupOnce(env, env.__fs || makeFS(env), null, "auto") } catch (e) { await srvErr(env, { msg: "النسخ الاحتياطي فشل: " + String(e && e.message || e), where: "backup" }, "server") } })()) },
  async fetch(req, env, ctx) {
    env.__ctx = ctx;
    const H = cors(req), url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: H });
    if (url.pathname === "/" && req.method === "GET") return new Response("mufradati-api ✓", { headers: H });
    if (url.pathname === "/err" && req.method === "POST") return handleErr(req, env, H);
    if (!["/sync", "/wipe", "/report", "/stats", "/create", "/pass", "/fix", "/sxq", "/msg", "/ai", "/ailog", "/aidel", "/backup", "/errs", "/fr", "/duel", "/rd", "/mt"].includes(url.pathname) || req.method !== "POST") return new Response("not found", { status: 404, headers: H });
    // التحقق من الهوية أولًا وبمعزل: أي فشل فيه (رمز مشوّه أو منتهٍ) ردّ 401 ولا يُسجَّل خطأً أبدًا، فلا يستطيع طلب مجهول أن يكتب في Firestore
    let user; try { user = await verifyIdToken((req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "")) }
    catch (e) {
      if (e && e.transient) { const p = srvErr(env, { msg: e.message, where: url.pathname }, "server"); if (ctx && ctx.waitUntil) ctx.waitUntil(p); else await p;
        return new Response(JSON.stringify({ error: "server", detail: "auth unavailable" }), { status: 503, headers: { ...H, "Content-Type": "application/json" } }) }
      return new Response(JSON.stringify({ error: "auth", detail: "token" }), { status: 401, headers: { ...H, "Content-Type": "application/json" } });
    }
    try {
      const body = await req.json().catch(() => ({}));
      const fs0 = env.__fs || makeFS(env), fs = countFS(fs0);
      stAdd("req", 1);
      // قراءات وكتابات التطبيق نفسه (يرسلها مع كل حفظ)، بحدود معقولة
      if (body.st && typeof body.st === "object") { stAdd("cr", Math.min(20000, Math.max(0, +body.st.r || 0))); stAdd("cw", Math.min(5000, Math.max(0, +body.st.w || 0))) }
      let out;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { out = url.pathname === "/ai" ? await handleAi(fs, user, body, env) : url.pathname === "/ailog" ? await handleAiLog(fs0, user, body, env) : url.pathname === "/aidel" ? await handleAiDel(fs0, user, body, env) : url.pathname === "/backup" ? await serial(() => handleBackup(fs0, user, body, env)) : url.pathname === "/errs" ? await handleErrs(fs0, user, body, env) : url.pathname === "/fr" ? await handleFriends(fs0, user, body, env) : url.pathname === "/duel" ? await handleDuel(fs0, user, body, env) : url.pathname === "/rd" ? await handleRd(fs0, user, body, env) : url.pathname === "/mt" ? await handleMt(fs0, user, body) : url.pathname === "/msg" ? await handleMsg(fs, user, body) : url.pathname === "/create" ? await handleCreate(fs, user, body, env) : url.pathname === "/pass" ? await handlePass(fs, user, body, env) : url.pathname === "/fix" ? await serial(() => handleFix(fs, user, body, env)) : url.pathname === "/sxq" ? await serial(() => handleSxq(fs0, user, body)) : url.pathname === "/stats" ? await handleStats(fs0, user, body) : url.pathname === "/report" ? await handleReport(fs, user, body) : await serial(() => url.pathname === "/wipe" ? handleWipe(fs, user, body) : handleSync(fs, user, body)); break }
        catch (e) { if (!e.conflict || attempt === 2) throw e }       // تعديل متزامن من جهازين: نعيد المحاولة
      }
      const fl = stFlush(fs0); if (ctx && ctx.waitUntil) ctx.waitUntil(fl); else await fl;
      return new Response(JSON.stringify(out.json), { status: out.status, headers: { ...H, "Content-Type": "application/json" } });
    } catch (e) {
      const auth = /token|key/.test(e.message);
      if (!auth) { const p = srvErr(env, { msg: String(e && e.message || e), stack: String(e && e.stack || ""), where: url.pathname }, user.uid); if (ctx && ctx.waitUntil) ctx.waitUntil(p); else await p }
      // التفاصيل التقنية للمشرف وحده (تظهر في رسائل أدواته)؛ المستخدم يرى «خطأ في الخادم» فقط
      const out = { error: auth ? "auth" : "server" }; if (user.email === ADMIN) out.detail = String(e && e.message || e).slice(0, 200);
      return new Response(JSON.stringify(out), { status: auth ? 401 : 500, headers: { ...H, "Content-Type": "application/json" } });
    }
  }
};
