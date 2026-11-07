# صنع ملفات النطق لكل الكلمات وجمل الأمثلة بصوت Azure العصبي، مرة واحدة لكل نص
# الاسم = بصمة FNV-1a للنص بعد تهيئته بالطريقة نفسها التي ينطق بها التطبيق (speakable في index.html)
import json, os, re, sys, time, subprocess, urllib.request, urllib.error, html

KEY = os.environ.get("AZURE_SPEECH_KEY", "").strip()
REGION = os.environ.get("AZURE_SPEECH_REGION", "westeurope").strip()
VOICE = os.environ.get("TTS_VOICE", "de-DE-KatjaNeural")
OUT = "audio"
PACE = 3.2          # الخطة المجانية: نحو 20 طلبًا في الدقيقة
COMMIT_EVERY = 200

def speakable(s):
    s = str(s or "")
    if s.find("+") > 0: s = s[:s.find("+")]   # ما بعد «+» ملاحظة لا تُقرأ
    s = re.sub(r"\([^)]*\)", " ", s)
    parts = [p.strip() for p in s.split(",")]
    keep = [p for i, p in enumerate(parts) if i == 0 or (not re.match(r"^[-–]", p) and len(re.sub(r"[^A-Za-zÄÖÜäöüß]", "", p)) >= 3)]
    return re.sub(r"\s+", " ", ", ".join(keep)).strip()

def answer0(de):
    s = re.sub(r"\([^)]*\)", "", str(de).split(",")[0])
    xs = [re.sub(r"\s+", " ", x).strip() for x in s.split("/")]
    xs = [x for x in xs if x]
    return xs[0] if xs else ""

def fnv(s):
    h = 0x811C9DC5
    for b in s.encode("utf-8"):
        h ^= b; h = (h * 0x01000193) & 0xFFFFFFFF
    return format(h, "08x")

def texts():
    out = set()
    courses = json.load(open("courses.json", encoding="utf-8"))["courses"]
    for c in courses:
        d = json.load(open(c["file"], encoding="utf-8"))
        words = d["words"] if isinstance(d, dict) else d
        for w in words:
            for t in [w.get("de", ""), answer0(w.get("de", ""))] + str(w.get("ex", "") or "").split("\n"):
                t = speakable(t.strip())
                if t and re.search(r"[A-Za-zÄÖÜäöüß]", t): out.add(t)
    return sorted(out)

def synth(text):
    ssml = f"<speak version='1.0' xml:lang='de-DE'><voice name='{VOICE}'><prosody rate='-6%'>{html.escape(text)}</prosody></voice></speak>"
    req = urllib.request.Request(f"https://{REGION}.tts.speech.microsoft.com/cognitiveservices/v1", data=ssml.encode("utf-8"), method="POST",
        headers={"Ocp-Apim-Subscription-Key": KEY, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3", "User-Agent": "mufradati"})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=60) as r: return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503): time.sleep(20 * (attempt + 1)); continue
            raise
        except urllib.error.URLError:
            time.sleep(10 * (attempt + 1))
    raise RuntimeError("tts failed: " + text[:60])

def save_index():
    hs = sorted(f[:-4] for f in os.listdir(OUT) if f.endswith(".mp3"))
    json.dump({"v": VOICE, "h": " ".join(hs)}, open(os.path.join(OUT, "index.json"), "w"))

def commit(msg):
    save_index()
    subprocess.run(["git", "add", OUT], check=True)
    if subprocess.run(["git", "diff", "--cached", "--quiet"]).returncode == 0: return
    subprocess.run(["git", "commit", "-q", "-m", msg], check=True)
    for _ in range(5):
        subprocess.run(["git", "fetch", "-q", "origin", "main"]); subprocess.run(["git", "rebase", "-q", "origin/main"])
        if subprocess.run(["git", "push", "-q", "origin", "HEAD:main"]).returncode == 0: return
        time.sleep(5)

if __name__ == "__main__":
    if not KEY: print("::warning::أضف السرّ AZURE_SPEECH_KEY"); sys.exit(0)
    os.makedirs(OUT, exist_ok=True)
    all_t = texts(); todo = [t for t in all_t if not os.path.exists(os.path.join(OUT, fnv(t) + ".mp3"))]
    print(f"texts {len(all_t)}, missing {len(todo)}")
    n = 0; t0 = time.time()
    for t in todo:
        open(os.path.join(OUT, fnv(t) + ".mp3"), "wb").write(synth(t)); n += 1
        if n % COMMIT_EVERY == 0: commit(f"أصوات النطق: {n} من {len(todo)}"); print(n, "done", int(time.time() - t0), "s")
        time.sleep(PACE)
    commit(f"أصوات النطق: اكتملت ({len(all_t)} نصًّا)")
    print("finished", n)
