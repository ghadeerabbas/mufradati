package de.mufradati.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.speech.tts.TextToSpeech;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.FrameLayout;
import java.util.Locale;

// تطبيق مفرداتي: يعرض الموقع بملء الشاشة، فيتحدّث تلقائيًّا مع كل تحديث للموقع.
public class MainActivity extends Activity {
    private static final String HOME = "https://ghadeerabbas.github.io/mufradati/";
    private static final String HOST = "ghadeerabbas.github.io";
    private WebView web;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    // غطاء شاشة البداية فوق الصفحة: الصفحة تُرسم تحته، ويُزال حين تقول إنها جاهزة (MufApp.ready) أو بعد 8 ثوانٍ
    private View cover;
    private boolean ready = false;
    private void markReady() {
        runOnUiThread(() -> {
            if (ready || cover == null) return;
            ready = true;
            final View c = cover;
            c.animate().alpha(0f).setDuration(180).withEndAction(() -> { ((FrameLayout) c.getParent()).removeView(c); cover = null; }).start();
        });
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(Color.TRANSPARENT);   // تظهر شاشة البداية (خلفية النافذة) حتى ترسم الصفحة نفسها
        FrameLayout root = new FrameLayout(this);
        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        if (state == null) {
            cover = new View(this);
            cover.setBackgroundResource(R.drawable.splash);
            cover.setClickable(true);   // لا تصل اللمسات إلى الصفحة قبل ظهورها
            root.addView(cover, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
            new Handler(Looper.getMainLooper()).postDelayed(this::markReady, 8000);
        }
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);                     // لا نسخ قديمة مخزّنة
        s.setMediaPlaybackRequiresUserGesture(false);

        // النطق الألماني من محرّك النطق في الهاتف
        tts = new TextToSpeech(this, st -> {
            if (st == TextToSpeech.SUCCESS) { tts.setLanguage(Locale.GERMANY); tts.setSpeechRate(0.9f); ttsReady = true; }
        });
        // جسر بين الموقع والتطبيق: النطق والتذكير اليومي
        web.addJavascriptInterface(new Bridge(), "MufApp");

        // نوافذ التأكيد والإدخال (تصفير التقدّم، الشراء...) تعمل عبر هذا
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (HOST.equals(u.getHost())) return false;          // صفحات الموقع داخل التطبيق
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {}
                return true;                                          // تيليغرام وغيره خارج التطبيق
            }
            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) {
                    markReady();
                    v.loadDataWithBaseURL(null,
                        "<html dir='rtl'><body style='background:#1f2a5a;color:#fff;font-family:sans-serif;text-align:center;padding-top:40vh'>"
                        + "<h2>لا يوجد اتصال بالإنترنت</h2><p>تأكّد من الاتصال ثم اضغط للمحاولة مجددًا</p>"
                        + "<button onclick=\"location.href='" + HOME + "?t='+Date.now()\" style='font-size:18px;padding:10px 24px;border:0;border-radius:12px'>إعادة المحاولة</button></body></html>",
                        "text/html", "utf-8", null);
                }
            }
        });

        if (state != null) web.restoreState(state);
        else web.loadUrl(HOME + "?t=" + System.currentTimeMillis());   // دائمًا آخر نسخة من الموقع
    }

    public class Bridge {
        @JavascriptInterface public void speak(String text) { speakRate(text, 0.9f); }
        // النطق البطيء: السرعة بين 0.3 و 1.5
        @JavascriptInterface public void speakRate(String text, float rate) {
            if (ttsReady && text != null) { tts.setSpeechRate(Math.max(0.3f, Math.min(1.5f, rate))); tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "muf"); }
        }
        @JavascriptInterface public void setReminder(boolean on, int hour, int minute) {
            if (on && Build.VERSION.SDK_INT >= 33
                && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED)
                runOnUiThread(() -> requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1));
            Reminder.set(MainActivity.this, on, hour, minute);
        }
        @JavascriptInterface public void markStudied(String day) { Reminder.markStudied(MainActivity.this, day); }
        @JavascriptInterface public void ready() { markReady(); }
        @JavascriptInterface public void exit() { runOnUiThread(MainActivity.this::finish); }
    }

    @Override
    protected void onDestroy() {
        if (tts != null) tts.shutdown();
        super.onDestroy();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        // زر الرجوع تتولّاه الصفحة: تأكيد الخروج من المحطة أو المراجعة أو التطبيق
        web.evaluateJavascript("(function(){try{if(window.mufBack){mufBack();return 'ok'}}catch(e){}return 'no'})()", v -> {
            if (!"\"ok\"".equals(v)) { if (web.canGoBack()) web.goBack(); else finish(); }
        });
    }
}
