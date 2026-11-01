/* ===========================================================
   خادم مفرداتي (Cloudflare Worker)
   يتحقّق من هوية المستخدم، ويطبّق أحداثه (مراجعة، محطة، اختبار، شراء…)
   بالقواعد نفسها التي في التطبيق، ثم يحفظ النتيجة في Firebase.
   المستخدم لا يستطيع الكتابة في تقدّمه أو جواهره أو الدوري إلا عبر هذا الخادم.
   السرّ المطلوب: SA = محتوى ملف مفتاح الخدمة من Firebase (JSON)
   =========================================================== */
const PROJECT = "mufradati-406bd";
const ADMIN = "admin@mufradati.app";
const ORIGINS = ["https://ghadeerabbas.github.io", "http://localhost:8765"];
const SITE = "https://ghadeerabbas.github.io/mufradati/";
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

/* ---------- متغيّرات الحالة التي يعمل عليها المنطق المشترك ---------- */
let P = {}, LOG = [], QLOG = [], QA = [], BUY = [], R = { bank: 0, ach: [], lv: 1, ts: 0 },
  LG = { tier: null, w: "", hist: [], ts: 0 }, EN = { v: 30, t: 0 }, STN = [], STV = 0, GIFTS = [], CW = 0;

/* @@CORE@@ */

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
    const r = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
    JWKS = { at: Date.now(), keys: (await r.json()).keys || [] };
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
      if (r.status === 409 || r.status === 400 && (await r.clone().text()).includes("FAILED_PRECONDITION")) { const e = new Error("conflict"); e.conflict = true; throw e }
      if (!r.ok) throw new Error("fs commit " + r.status + " " + (await r.text()).slice(0, 200));
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
function setState(c, log, qa) {
  P = c.P || {}; QLOG = c.QLOG || []; BUY = c.BUY || []; R = Object.assign({ bank: 0, ach: [], lv: 1, ts: 0 }, c.R || {});
  LG = Object.assign({ tier: null, w: "", hist: [], ts: 0 }, c.LG || {}); EN = c.EN || { v: 30, t: 0 }; STN = c.STN || []; STV = c.STV || 0;
  LOG = unpackLog(log); QA = unpackQA(qa); EC = null; CW = c.wiped || 0;
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
      LG.hist = [...(LG.hist || []), { w: last, tier: me.tier, rank, n, mv, g: prizeOf(realRank, me.xp), xp: me.xp }].slice(-52);
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
async function handleSync(fs, user, body) {
  FREEU = false; STMAXU = 0;
  const now = Date.now(), uid = user.uid, admin = user.email === ADMIN;
  await loadCfg(fs);
  FREEU = CFG.free.includes(uid);   // الدراسة الحرّة لهذا الحساب
  STMAXU = (CFG.stn || {})[uid] || 0;   // عدد محطاته اليومية إن حدّده المشرف
  const [uDoc, coreD, logD, qaD, nameD, gifts] = await Promise.all([
    fs.get(`users/${uid}`), fs.get(`users/${uid}/data/core`), fs.get(`users/${uid}/data/log`), fs.get(`users/${uid}/data/qa`),
    fs.get(`names/${uid}`), fs.list(`gifts/${uid}/g`)]);
  // الحساب المفعّل فقط
  if (!admin && !uDoc && !(await fs.get(`members/${uid}`))) return { status: 403, json: { error: "inactive" } };
  const u = uDoc ? uDoc.data : {};
  // أول مرة: نقل البيانات الحالية من الحساب (قبل الخادم) مرة واحدة
  let c;
  if (coreD) c = parseJ(coreD.data.v, {});
  else { const m = parseJ(u.main, {}); c = { P: m.P, QLOG: m.QLOG, BUY: m.BUY, R: m.R, LG: m.LG, EN: m.EN, STN: m.STN, STV: 0 } }
  setState(c, parseJ(logD && logD.data.v, null), parseJ(qaD && qaD.data.v, null));
  // مستخدم جديد تمامًا (أول دخول، بلا بيانات سابقة): طاقة بلا حدود أول 24 ساعة، ليتعلّم ما يكفي فتكون له كلمات يراجعها في اليوم التالي
  if (!coreD && !u.main) EN.u = Math.max(EN.u || 0, now + 24 * 3600e3);
  GIFTS = gifts.map(g => ({ id: g.id, g: g.g || 0, note: g.note || "", ts: g.ts }));
  const before = { log: LOG.length, qa: QA.length, core: JSON.stringify(coreObj()) };
  // الأحداث
  const evs = Array.isArray(body.evs) ? body.evs.slice(0, 300) : [], rej = [];
  let words = null;
  for (let i = 0; i < evs.length; i++) {
    const e = evs[i]; if (!e || typeof e !== "object") { rej.push(i); continue }
    if (CW && (+e.t || 0) < CW) { rej.push([i, "wiped"]); continue }      // أحداث من قبل حذف المشرف لا تُقبل
    if (e.type === "stDone" && !words) words = await wordSet();
    EC = null; const r = applyEv(e, Math.max(now - 1, Date.now()), { server: true, admin, words });
    if (r !== true) rej.push([i, r]);
  }
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
  if (!logD || LOG.length !== before.log || !c.lf || evs.some(x => x && x.type === "reset")) cw.push({ path: `users/${uid}/data/log`, data: { v: logJ } });
  if (!qaD || QA.length !== before.qa || evs.some(x => x && x.type === "reset")) cw.push({ path: `users/${uid}/data/qa`, data: { v: qaJ } });
  if (c.pubJ !== pubJ) cw.push({ path: `pub/${uid}`, data: { ...pub, ts: { __ts: now } } });
  await fs.commit([...cw, ...writes]);
  return { status: 200, json: { core: coreJ, log: logJ, qa: qaJ, rej, prefs: u.prefs || "" } };
}

/* ---------- المشرف: حذف كل بيانات مستخدم ليبدأ من الصفر ---------- */
// يبقى حسابه وتفعيله واسمه الظاهر ورسائله، ويُحذف ما سوى ذلك: التقدّم والجواهر والمشتريات والهدايا والدوري والملف العام والمظهر
async function handleWipe(fs, user, body) {
  if (user.email !== ADMIN) return { status: 403, json: { error: "admin" } };
  const uid = String(body.uid || ""); if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return { status: 400, json: { error: "uid" } };
  const now = Date.now(), [uDoc, gifts] = await Promise.all([fs.get(`users/${uid}`), fs.list(`gifts/${uid}/g`)]);
  const core = { P: {}, QLOG: [], BUY: [], R: { bank: 0, ach: [], lv: 1, ts: now }, LG: { tier: 0, w: "", hist: [], ts: now, v: 2, best: 0 }, EN: { v: 30, t: 0 }, STN: [], STV: 0, ver: 1, lf: 1, wiped: now };
  const empty = JSON.stringify({ K: [], F: [] });
  await fs.commit([
    { path: `users/${uid}`, data: { name: (uDoc && uDoc.data.name) || "", wiped: now } },
    { path: `users/${uid}/data/core`, data: { v: JSON.stringify(core) } },
    { path: `users/${uid}/data/log`, data: { v: empty } },
    { path: `users/${uid}/data/qa`, data: { v: empty } },
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
  const [coreD, logD, qaD] = await Promise.all([fs.get(`users/${uid}/data/core`), fs.get(`users/${uid}/data/log`), fs.get(`users/${uid}/data/qa`)]);
  if (!coreD) return { status: 404, json: { error: "nouser" } };
  setState(parseJ(coreD.data.v, {}), parseJ(logD && logD.data.v, null), parseJ(qaD && qaD.data.v, null));
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
    async commit(ws) { stAdd("sw", ws.length); return fs.commit(ws) }
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
  const isQuota = m => /4006|daily|neuron|quota|limit/i.test(m), fail = e => { const m = String(e && e.message || e); return { status: isQuota(m) ? 429 : 502, json: { error: isQuota(m) ? "quota" : "ai", detail: m.slice(0, 200) } } };
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
const BAK_KEEP = 14;   // تبقى آخر 14 نسخة
const DOCROOT = `projects/${PROJECT}/databases/(default)/documents`;
async function gauth(env) { return { Authorization: "Bearer " + await googleToken(env), "Content-Type": "application/json" } }
// كل وثائق قاعدة البيانات بصيغتها الأصلية (الأنواع محفوظة كما هي). تُحفظ الردود كما وصلت بلا تحليل، توفيرًا لوقت المعالج
// صور مساعد الوظيفة محفوظة في تخزين Cloudflare لا في قاعدة البيانات، فلا تدخل النسخة (وتُحذف وحدها بعد شهر)
async function exportAll(env) {
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
async function backupNow(env, why) {
  const ex = await exportAll(env), now = Date.now(), key = "bak-" + new Date(now).toISOString().replace(/[:.]/g, "-");
  const body = await gz('{"v":2,"at":' + now + ',"parts":[' + ex.parts.join(",") + "]}");
  const meta = { at: now, n: ex.n, users: ex.users, size: body.length, why: why || "auto" };
  await env.BAK.put(key, body, { metadata: meta });
  const all = (await env.BAK.list({ prefix: "bak-" })).keys.sort((a, b) => a.name < b.name ? 1 : -1);
  for (const k of all.slice(BAK_KEEP)) await env.BAK.delete(k.name);
  return { key, ...meta };
}
// تفكّ النسخة وتعيد وثائقها: [{name, fields}]
async function loadBak(env, key) {
  if (!/^bak-[0-9TZ-]+$/.test(key)) throw new Error("key");
  const b = await env.BAK.get(key, "arrayBuffer"); if (!b) throw new Error("nobak");
  const j = JSON.parse(await gunz(b)), docs = new Map();
  for (const part of j.parts || []) for (const x of part) if (x && x.document) docs.set(x.document.name, x.document.fields || {});
  return { at: j.at, docs: [...docs].map(([name, fields]) => ({ name, fields })) };
}
// المشرف: قائمة النسخ، نسخة الآن، تجربة الاسترجاع (فكّ النسخة وفحصها بلا كتابة)، الاسترجاع الفعلي
async function handleBackup(fs, user, body, env) {
  if (user.email !== ADMIN) return { status: 403, json: { error: "admin" } };
  if (!env.BAK) return { status: 500, json: { error: "nokv" } };
  const op = String(body.op || "list"), key = String(body.key || "");
  if (op === "list") { const l = (await env.BAK.list({ prefix: "bak-" })).keys.sort((a, b) => a.name < b.name ? 1 : -1); return { status: 200, json: { items: l.map(k => ({ key: k.name, ...(k.metadata || {}) })) } } }
  if (op === "now") return { status: 200, json: await backupNow(env, "manual") };
  const b = await loadBak(env, key);
  if (op === "test") {
    const per = {}; for (const d of b.docs) { const p = d.name.slice(DOCROOT.length + 1).split("/"), c = p.length > 2 ? p[0] + "/…/" + p[p.length - 2] : p[0]; per[c] = (per[c] || 0) + 1 }
    const bad = b.docs.filter(d => !d.name.startsWith(DOCROOT + "/") || typeof d.fields !== "object").length;
    return { status: 200, json: { ok: !bad, at: b.at, n: b.docs.length, bad, per } };
  }
  if (op === "restore") {
    if (body.confirm !== key) return { status: 400, json: { error: "confirm" } };
    const before = await backupNow(env, "before-restore");   // نسخة من الوضع الحالي أولًا، للتراجع إن لزم
    const H = await gauth(env), W = b.docs.filter(d => d.name.startsWith(DOCROOT + "/")).map(d => ({ update: { name: d.name, fields: d.fields }, ...(/\/aichat\/[^/]+\/m\//.test(d.name) ? { updateMask: { fieldPaths: Object.keys(d.fields) } } : {}) }));
    for (let k = 0; k < W.length; k += 400) { const r = await fetch(FS_BASE + ":commit", { method: "POST", headers: H, body: JSON.stringify({ writes: W.slice(k, k + 400) }) }); if (!r.ok) throw new Error("restore " + r.status + " " + (await r.text()).slice(0, 150)) }
    return { status: 200, json: { ok: true, n: W.length, before: before.key } };
  }
  return { status: 400, json: { error: "op" } };
}

/* ---------- تتبّع الأخطاء: أخطاء التطبيق والخادم تُجمع هنا ويراها المشرف ---------- */
async function errHash(s) { return [...new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s)))].slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("") }
async function logErr(fs, e) {
  const msg = String(e.msg || "").slice(0, 300), stack = String(e.stack || "").slice(0, 1500), src = e.src === "server" ? "server" : "app";
  if (!msg) return;
  const top = stack.split("\n").find(l => /:\d+:\d+/.test(l)) || "", id = await errHash(src + "|" + msg.replace(/\d+/g, "#") + "|" + top.replace(/\?[^:]*/, ""));
  const now = Date.now(), old = await fs.get(`errs/${id}`), d = old ? old.data : null;
  const users = [...new Set([...(d && d.users || []), e.uid || ""].filter(Boolean))].slice(-20);
  await fs.commit([{ path: `errs/${id}`, data: { msg, stack: d && d.stack || stack, src, where: String(e.where || d && d.where || "").slice(0, 200), ua: String(e.ua || d && d.ua || "").slice(0, 200),
    ver: String(e.ver || "").slice(0, 40), n: (d && d.n || 0) + 1, first: d && d.first ? { __ts: d.first.ms } : { __ts: now }, last: { __ts: now }, users } }]);
}
let ERRN = { t: 0, n: 0 };   // حماية من الإغراق: 30 خطأ في الدقيقة على الأكثر لكل نسخة من الخادم
async function handleErr(req, env, H) {
  if (Date.now() - ERRN.t > 60e3) ERRN = { t: Date.now(), n: 0 };
  if (++ERRN.n > 30) return new Response("{}", { status: 429, headers: H });
  const txt = await req.text(); if (txt.length > 6000) return new Response("{}", { status: 413, headers: H });
  let b = {}; try { b = JSON.parse(txt) } catch (e) { }
  let uid = ""; try { uid = (await verifyIdToken((req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, ""))).uid } catch (e) { }
  try { await logErr(env.__fs || makeFS(env), { ...b, uid, src: "app" }) } catch (e) { }
  return new Response("{}", { headers: { ...H, "Content-Type": "application/json" } });
}
async function handleErrs(fs, user, body, env) {
  if (user.email !== ADMIN) return { status: 403, json: { error: "admin" } };
  if (body.del) { const all = body.del === "all" ? (await fs.list("errs")).map(x => x.id) : [String(body.del)].filter(x => /^[0-9a-f]{16}$/.test(x)); for (let k = 0; k < all.length; k += 400) await fs.commit(all.slice(k, k + 400).map(id => ({ path: `errs/${id}`, del: true }))); return { status: 200, json: { ok: true } } }
  const l = (await fs.list("errs")).map(x => ({ id: x.id, msg: x.msg, stack: x.stack, src: x.src, where: x.where, ua: x.ua, ver: x.ver, n: x.n, first: x.first && x.first.ms || 0, last: x.last && x.last.ms || 0, users: x.users || [] })).sort((a, b) => b.last - a.last).slice(0, 100);
  return { status: 200, json: { items: l } };
}

/* ---------- نقطة الدخول ---------- */
function cors(req) {
  const o = req.headers.get("Origin") || "";
  return { "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0], "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Max-Age": "86400", "Vary": "Origin" };
}
export default {
  async scheduled(ev, env, ctx) { ctx.waitUntil((async () => { try { await aiCleanup(env) } catch (e) { } try { if (env.BAK) await backupNow(env, "auto") } catch (e) { try { await logErr(makeFS(env), { src: "server", msg: "النسخ الاحتياطي فشل: " + String(e && e.message || e), where: "backup" }) } catch (_) { } } })()) },
  async fetch(req, env, ctx) {
    const H = cors(req), url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: H });
    if (url.pathname === "/" && req.method === "GET") return new Response("mufradati-api ✓", { headers: H });
    if (url.pathname === "/err" && req.method === "POST") return handleErr(req, env, H);
    if (url.pathname === "/bakping" && req.method === "GET") { try { const m = await backupNow(env, "manual"); const b = await loadBak(env, m.key); return new Response(JSON.stringify({ ok: true, meta: m, restored_docs: b.docs.length }), { headers: H }) } catch (e) { return new Response(JSON.stringify({ ok: false, e: String(e && e.message || e).slice(0, 300) }), { status: 500, headers: H }) } }
    if (!["/sync", "/wipe", "/report", "/stats", "/create", "/pass", "/fix", "/msg", "/ai", "/ailog", "/aidel", "/backup", "/errs"].includes(url.pathname) || req.method !== "POST") return new Response("not found", { status: 404, headers: H });
    try {
      const user = await verifyIdToken((req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, ""));
      const body = await req.json().catch(() => ({}));
      const fs0 = env.__fs || makeFS(env), fs = countFS(fs0);
      stAdd("req", 1);
      // قراءات وكتابات التطبيق نفسه (يرسلها مع كل حفظ)، بحدود معقولة
      if (body.st && typeof body.st === "object") { stAdd("cr", Math.min(20000, Math.max(0, +body.st.r || 0))); stAdd("cw", Math.min(5000, Math.max(0, +body.st.w || 0))) }
      let out;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { out = url.pathname === "/ai" ? await handleAi(fs, user, body, env) : url.pathname === "/ailog" ? await handleAiLog(fs0, user, body, env) : url.pathname === "/aidel" ? await handleAiDel(fs0, user, body, env) : url.pathname === "/backup" ? await handleBackup(fs0, user, body, env) : url.pathname === "/errs" ? await handleErrs(fs0, user, body, env) : url.pathname === "/msg" ? await handleMsg(fs, user, body) : url.pathname === "/create" ? await handleCreate(fs, user, body, env) : url.pathname === "/pass" ? await handlePass(fs, user, body, env) : url.pathname === "/fix" ? await serial(() => handleFix(fs, user, body, env)) : url.pathname === "/stats" ? await handleStats(fs0, user, body) : url.pathname === "/report" ? await handleReport(fs, user, body) : await serial(() => url.pathname === "/wipe" ? handleWipe(fs, user, body) : handleSync(fs, user, body)); break }
        catch (e) { if (!e.conflict || attempt === 2) throw e }       // تعديل متزامن من جهازين: نعيد المحاولة
      }
      const fl = stFlush(fs0); if (ctx && ctx.waitUntil) ctx.waitUntil(fl); else await fl;
      return new Response(JSON.stringify(out.json), { status: out.status, headers: { ...H, "Content-Type": "application/json" } });
    } catch (e) {
      const auth = /token|key/.test(e.message);
      if (!auth) { const p = (async () => { try { await logErr(env.__fs || makeFS(env), { src: "server", msg: String(e && e.message || e), stack: String(e && e.stack || ""), where: url.pathname }) } catch (_) { } })(); if (ctx && ctx.waitUntil) ctx.waitUntil(p) }
      return new Response(JSON.stringify({ error: auth ? "auth" : "server", detail: String(e.message).slice(0, 200) }), { status: auth ? 401 : 500, headers: { ...H, "Content-Type": "application/json" } });
    }
  }
};
