// بوت مفرداتي على تيليغرام — يعمل على Cloudflare Workers
// القاعدة: كل شخص يرسل رسالة واحدة، ثم ينتظر رد المدير قبل أن تُقبل رسالة أخرى.
//
// المتغيّرات المطلوبة في إعدادات العامل (Settings → Variables and Secrets):
//   BOT_TOKEN       (سرّي)  مفتاح البوت من BotFather
//   ADMIN_ID        رقم حسابك في تيليغرام
//   WEBHOOK_SECRET  (سرّي)  كلمة عشوائية من اختيارك (أحرف إنجليزية وأرقام فقط)
// وربط تخزين KV باسم المتغيّر: STATE

const MAX_LEN = 1000;          // أقصى طول للرسالة
const MAX_NEW_PER_HOUR = 30;   // حماية من الإغراق: أقصى عدد طلبات جديدة في الساعة

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // تفعيل الربط مع تيليغرام مرة واحدة: افتح /setup?key=WEBHOOK_SECRET في المتصفح
    if (url.pathname === "/setup") {
      if (url.searchParams.get("key") !== env.WEBHOOK_SECRET) return new Response("مفتاح غير صحيح", { status: 403 });
      const r = await tg(env, "setWebhook", {
        url: `${url.origin}/hook`,
        secret_token: env.WEBHOOK_SECRET,
        allowed_updates: ["message"],
        drop_pending_updates: true,
      });
      await tg(env, "setMyCommands", { commands: [{ command: "start", description: "البداية" }] });
      return new Response(JSON.stringify(r, null, 2), { headers: { "content-type": "application/json; charset=utf-8" } });
    }

    if (url.pathname !== "/hook" || request.method !== "POST") return new Response("مفرداتي", { status: 200 });
    // لا نقبل إلا الطلبات القادمة من تيليغرام
    if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) return new Response("", { status: 403 });

    let update;
    try { update = await request.json(); } catch { return new Response("") }
    const msg = update.message;
    if (!msg || !msg.chat || msg.chat.type !== "private") return new Response("");

    try {
      if (String(msg.from.id) === String(env.ADMIN_ID)) await fromAdmin(env, msg);
      else await fromUser(env, msg);
    } catch (e) { console.log("error", e && e.stack); }
    return new Response("");
  },
};

/* ---------- رسائل المستخدمين ---------- */
async function fromUser(env, msg) {
  const uid = String(msg.from.id);
  if (await env.STATE.get("blocked:" + uid)) return;               // محظور: تجاهل تام

  const text = (msg.text || "").trim();
  const state = await env.STATE.get("state:" + uid);               // waiting = ينتظر الرد

  if (text.startsWith("/start")) {
    if (state === "waiting") return notice(env, uid, "⏳ رسالتك السابقة وصلت. انتظر الرد، وستصلك هنا.");
    return send(env, uid,
      "أهلًا بك في مفرداتي 📚\n\n" +
      "اكتب اسم المستخدم وكلمة المرور اللتين تريدهما:\n" +
      "• اسم المستخدم: أحرف إنجليزية وأرقام فقط\n" +
      "• كلمة المرور: ٦ أحرف على الأقل");
  }

  if (state === "waiting") return notice(env, uid, "⏳ رسالتك السابقة وصلت. لا تُقبل رسائل جديدة حتى يصلك الرد.");
  if (!text) return notice(env, uid, "أرسل رسالة نصية فقط من فضلك.");
  if (text.length > MAX_LEN) return send(env, uid, `رسالتك طويلة (${text.length} حرفًا). اختصرها إلى ${MAX_LEN} حرف أو أقل وأعد الإرسال.`);

  // حماية عامة من الإغراق
  const hourKey = "count:" + new Date().toISOString().slice(0, 13);
  const count = parseInt(await env.STATE.get(hourKey) || "0", 10);
  if (count >= MAX_NEW_PER_HOUR) {
    if (!(await env.STATE.get("flood_alert:" + hourKey))) {
      await env.STATE.put("flood_alert:" + hourKey, "1", { expirationTtl: 3600 });
      await send(env, env.ADMIN_ID, "⚠️ وصل عدد الرسائل الجديدة إلى الحد الأقصى هذه الساعة. أُوقف استقبال الجديد مؤقتًا.");
    }
    return notice(env, uid, "البوت مشغول الآن، حاول بعد ساعة.");
  }
  await env.STATE.put(hourKey, String(count + 1), { expirationTtl: 7200 });

  const f = msg.from;
  const who = [f.first_name, f.last_name].filter(Boolean).join(" ") || "بلا اسم";
  const header =
    "📩 رسالة جديدة\n" +
    `الاسم: ${who}\n` +
    `الحساب: ${f.username ? "@" + f.username : "بلا معرّف"}\n` +
    `الرقم: ${uid}\n` +
    "———\n";
  const sent = await send(env, env.ADMIN_ID, header + text +
    "\n\n↩️ ردّ على هذه الرسالة ليصل ردّك إليه. وللحظر: ردّ عليها بكلمة /block");
  if (!sent.ok) return send(env, uid, "تعذّر إيصال رسالتك الآن، حاول لاحقًا.");

  await env.STATE.put("map:" + sent.result.message_id, uid);       // لربط ردّك بصاحب الرسالة
  await env.STATE.put("state:" + uid, "waiting");
  await send(env, uid, "✅ وصلت رسالتك. انتظر الرد هنا، ولن تُقبل رسائل أخرى حتى يصلك.");
}

/* ---------- رسائل المدير ---------- */
async function fromAdmin(env, msg) {
  const text = (msg.text || "").trim();
  const reply = msg.reply_to_message;

  if (text === "/start" || text === "/help") {
    return send(env, env.ADMIN_ID,
      "أنت المدير ✅\n\n" +
      "• للرد على أحد: اضغط مطوّلًا على رسالته ثم «رد»، واكتب ردّك (نص أو صورة أو أي شيء).\n" +
      "• للحظر: ردّ على رسالته بـ /block\n" +
      "• لفك الحظر: /unblock ثم الرقم\n" +
      "• لفتح الإرسال له دون رد: ردّ على رسالته بـ /open");
  }
  if (text.startsWith("/unblock")) {
    const id = text.split(/\s+/)[1];
    if (!id) return send(env, env.ADMIN_ID, "اكتب: /unblock ثم الرقم");
    await env.STATE.delete("blocked:" + id);
    await env.STATE.delete("state:" + id);
    return send(env, env.ADMIN_ID, "✓ فُكّ الحظر عن " + id);
  }

  if (!reply) return send(env, env.ADMIN_ID, "لتردّ على أحد، استعمل «رد» على رسالته.");
  const uid = await env.STATE.get("map:" + reply.message_id);
  if (!uid) return send(env, env.ADMIN_ID, "لم أعرف صاحب هذه الرسالة. ردّ على رسالة «📩 رسالة جديدة» نفسها.");

  if (text === "/block") {
    await env.STATE.put("blocked:" + uid, "1");
    return send(env, env.ADMIN_ID, "⛔ حُظر " + uid + ". لن تصلك منه رسائل.");
  }
  if (text === "/open") {
    await env.STATE.delete("state:" + uid);
    return send(env, env.ADMIN_ID, "✓ يستطيع " + uid + " إرسال رسالة واحدة جديدة.");
  }

  // نسخ ردّك (أي نوع) إلى صاحب الرسالة، ثم فتح الإرسال له مرة واحدة
  const r = await tg(env, "copyMessage", { chat_id: uid, from_chat_id: msg.chat.id, message_id: msg.message_id });
  if (!r.ok) return send(env, env.ADMIN_ID, "✗ لم يصل الرد (ربما أوقف البوت): " + (r.description || ""));
  await env.STATE.delete("state:" + uid);
  await send(env, uid, "↩️ يمكنك الرد برسالة واحدة إن احتجت.");
  return send(env, env.ADMIN_ID, "✓ وصل ردّك.");
}

/* ---------- أدوات ---------- */
// تنبيه لا يتكرر أكثر من مرة كل ساعة، حتى لا يصبح البوت نفسه مصدر إزعاج
async function notice(env, uid, text) {
  const k = "notice:" + uid;
  if (await env.STATE.get(k)) return;
  await env.STATE.put(k, "1", { expirationTtl: 3600 });
  return send(env, uid, text);
}
function send(env, chat_id, text) {
  return tg(env, "sendMessage", { chat_id, text, disable_web_page_preview: true });
}
async function tg(env, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}
