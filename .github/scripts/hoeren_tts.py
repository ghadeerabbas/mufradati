# أصوات مؤقتة لدفتر الاستماع — تُصنع في هذا الفرع فقط ولا تُدفع إلى main
import os, sys, time, subprocess
sys.path.insert(0, os.path.dirname(__file__))
import tts
OUT = "hoeren_audio"
os.makedirs(OUT, exist_ok=True)
todo = [t for t in open("hoeren_texts.txt", encoding="utf-8").read().split("\n") if t.strip()]
print("texts", len(todo))
for t in todo:
    p = os.path.join(OUT, tts.fnv(t) + ".mp3")
    if os.path.exists(p): continue
    open(p, "wb").write(tts.synth(t))
    time.sleep(tts.PACE)
subprocess.run(["git", "add", OUT], check=True)
subprocess.run(["git", "commit", "-q", "-m", "أصوات دفتر الاستماع"], check=True)
subprocess.run(["git", "push", "-q", "origin", "HEAD:hoeren-audio"], check=True)
print("finished")
