#!/bin/bash
# فحص مفتاح خدمة النطق: طلب نطق واحد لكلمة قصيرة، ويُطبع رمز الردّ وحجمه فقط.
# لا يُطبع المفتاح ولا المنطقة، ولا يُحفظ الصوت في المستودع، ولا يُرفع شيء.
# TTS_URL للاختبار المحلي فقط؛ سير العمل لا يضبطه.
set -u
K=$(printf %s "${AZURE_SPEECH_KEY:-}" | tr -d '[:space:]')
R=$(printf %s "${AZURE_SPEECH_REGION:-westeurope}" | tr -d '[:space:]' | tr 'A-Z' 'a-z')
[ -n "$K" ] || { echo "::error::السرّ AZURE_SPEECH_KEY فارغ أو غير موجود"; exit 1; }
[[ "$R" =~ ^[a-z0-9]{3,30}$ ]] || { echo "::error::قيمة AZURE_SPEECH_REGION ليست اسم منطقة صحيحًا (أحرف لاتينية صغيرة وأرقام فقط، مثل westeurope)"; exit 1; }
URL="${TTS_URL:-https://${R}.tts.speech.microsoft.com/cognitiveservices/v1}"
OUT=$(mktemp); trap 'rm -f "$OUT"' EXIT
SSML="<speak version='1.0' xml:lang='de-DE'><voice name='de-DE-KatjaNeural'>Hallo</voice></speak>"
CODE=$(curl -s -o "$OUT" -w '%{http_code}' -m 30 -X POST "$URL" \
  -H "Ocp-Apim-Subscription-Key: $K" -H "Content-Type: application/ssml+xml" \
  -H "X-Microsoft-OutputFormat: audio-24khz-48kbitrate-mono-mp3" -H "User-Agent: mufradati-check" \
  --data "$SSML") || CODE=000
SIZE=$(wc -c < "$OUT" | tr -d ' ')
case "$CODE" in
  200) if [ "$SIZE" -gt 1000 ]; then echo "نجاح: المفتاح والمنطقة صالحان (200، صوت ${SIZE} بايت)"; exit 0
       else echo "::error::ردّ 200 لكن الصوت صغير على غير العادة (${SIZE} بايت)"; exit 1; fi ;;
  401) echo "::error::401: المفتاح مرفوض. انسخ KEY 1 من صفحة Keys and Endpoint، وتأكد أن المنطقة هي منطقة المورد نفسه" ;;
  403) echo "::error::403: المورد معطّل أو انتهت حصته" ;;
  404) echo "::error::404: اسم المنطقة غير صحيح على الأرجح" ;;
  429) echo "::error::429: طلبات كثيرة الآن، أعد المحاولة بعد دقيقة" ;;
  000) echo "::error::تعذّر الوصول إلى الخدمة (اسم منطقة غير موجود أو مشكلة شبكة)" ;;
  *)   echo "::error::ردّ غير متوقع: ${CODE}" ;;
esac
exit 1
