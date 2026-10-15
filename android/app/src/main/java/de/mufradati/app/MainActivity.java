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

// تطبيق مفرداتي: يعرض الموقع بملء الشاشة، فيتحدّث تلقائيًّا مع كل تحديث للموقع.
public class MainActivity extends Activity {
    private static final String HOME = "https://ghadeerabbas.github.io/mufradati/";
    private static final String HOST = "ghadeerabbas.github.io";
    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#1f2a5a"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);                     // لا نسخ قديمة مخزّنة
        s.setMediaPlaybackRequiresUserGesture(false);

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

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
