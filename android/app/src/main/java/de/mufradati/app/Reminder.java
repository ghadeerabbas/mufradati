package de.mufradati.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

// التذكيرات (لا تصل إلا إن سمح المستخدم بإشعارات التطبيق، وإلا إن لم يكمل دراسة اليوم):
// 1) تذكير يومي في الساعة والدقيقة التي يختارها المستخدم (إن فعّله).
// 2) تذكيرات قبل نهاية اليوم (منتصف الليل بتوقيت ألمانيا، كحدود أيام التطبيق): قبل ساعة، ونصف ساعة، وربع ساعة، و5 دقائق.
// منبّه واحد في كل مرة: عند وصوله يُعرض الإشعار ثم يُضبط التالي.
public class Reminder extends BroadcastReceiver {
    static final String PREFS = "muf", CH = "daily";
    static final TimeZone BERLIN = TimeZone.getTimeZone("Europe/Berlin");
    static final int[] EOD = {60, 30, 15, 5};   // دقائق قبل منتصف الليل

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
    static String today() { SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US); f.setTimeZone(BERLIN); return f.format(new Date()); }

    static PendingIntent pi(Context c, String kind, long t) {
        Intent i = new Intent(c, Reminder.class).setAction("de.mufradati.REMIND").putExtra("kind", kind).putExtra("t", t);
        return PendingIntent.getBroadcast(c, 7, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void set(Context c, boolean on, int hour, int minute) {
        prefs(c).edit().putBoolean("on", on).putInt("h", hour).putInt("m", minute).apply();
        schedule(c);
    }
    static void setEod(Context c, boolean on) {
        prefs(c).edit().putBoolean("eod", on).apply();
        schedule(c);
    }

    // أقرب موعد قادم من بين التذكير اليومي وتذكيرات نهاية اليوم
    static void schedule(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        SharedPreferences p = prefs(c);
        am.cancel(pi(c, "", 0));
        long now = System.currentTimeMillis(), after = Math.max(now, p.getLong("lastT", 0));
        long best = Long.MAX_VALUE; String kind = null;
        if (p.getBoolean("on", false)) {
            Calendar t = Calendar.getInstance();
            t.set(Calendar.HOUR_OF_DAY, p.getInt("h", 19)); t.set(Calendar.MINUTE, p.getInt("m", 0));
            t.set(Calendar.SECOND, 0); t.set(Calendar.MILLISECOND, 0);
            while (t.getTimeInMillis() <= after) t.add(Calendar.DAY_OF_YEAR, 1);
            best = t.getTimeInMillis(); kind = "custom";
        }
        if (p.getBoolean("eod", true)) {
            for (int mins : EOD) {
                Calendar t = Calendar.getInstance(BERLIN);
                t.set(Calendar.HOUR_OF_DAY, 0); t.set(Calendar.MINUTE, 0); t.set(Calendar.SECOND, 0); t.set(Calendar.MILLISECOND, 0);
                t.add(Calendar.DAY_OF_YEAR, 1); t.add(Calendar.MINUTE, -mins);
                while (t.getTimeInMillis() <= after) t.add(Calendar.DAY_OF_YEAR, 1);
                if (t.getTimeInMillis() < best) { best = t.getTimeInMillis(); kind = "eod" + mins; }
            }
        }
        if (kind == null) return;
        PendingIntent op = pi(c, kind, best);
        // التذكير اليومي يصل في ساعته أو بعدها بقليل؛ وتذكيرات نهاية اليوم قبل موعدها بقليل حتى لا تتجاوز منتصف الليل
        long ws = kind.equals("custom") ? best : best - 11 * 60000L;
        boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
        try {
            if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, best, op);
            else {
                // بلا إذن المنبّه الدقيق: نافذة 10 دقائق
                am.setWindow(AlarmManager.RTC_WAKEUP, ws, 10 * 60000L, op);
            }
        } catch (SecurityException e) {
            am.setWindow(AlarmManager.RTC_WAKEUP, ws, 10 * 60000L, op);
        }
    }

    static void markStudied(Context c, String day) {
        prefs(c).edit().putString("studied", day).apply();
        // أكمل دراسة اليوم: لا يبقى تذكير ظاهر
        try { ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(1); } catch (Exception ignored) {}
    }

    @Override
    public void onReceive(Context c, Intent intent) {
        String a = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) { schedule(c); return; }
        SharedPreferences p = prefs(c);
        String kind = intent.getStringExtra("kind");
        long t = intent.getLongExtra("t", System.currentTimeMillis());
        p.edit().putLong("lastT", t).apply();
        boolean wanted = "custom".equals(kind) ? p.getBoolean("on", false) : kind != null && kind.startsWith("eod") && p.getBoolean("eod", true);
        if (wanted && !today().equals(p.getString("studied", ""))) notifyNow(c, kind);
        schedule(c);
    }

    static void notifyNow(Context c, String kind) {
        String title, text;
        switch (kind) {
            case "eod60": title = "بقيت ساعة على نهاية اليوم ⏰"; text = "محطة واحدة الآن تحافظ على سلسلتك 🔥"; break;
            case "eod30": title = "بقيت نصف ساعة ⏳"; text = "لم تكمل دراسة اليوم بعد. هيا قبل أن تنطفئ شعلتك 🔥"; break;
            case "eod15": title = "بقيت ربع ساعة! 🔥"; text = "دقائق قليلة تكفي لتحافظ على سلسلتك"; break;
            case "eod5": title = "بقيت 5 دقائق فقط! 🚨"; text = "ادرس الآن قبل أن ينتهي اليوم"; break;
            default: title = "حان وقت مفرداتك 📚"; text = "بضع دقائق اليوم تحافظ على سلسلتك 🔥";
        }
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26)
            nm.createNotificationChannel(new NotificationChannel(CH, "التذكير اليومي", NotificationManager.IMPORTANCE_DEFAULT));
        PendingIntent open = PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CH) : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_stat).setContentTitle(title).setContentText(text).setContentIntent(open).setAutoCancel(true);
        try { nm.notify(1, b.build()); } catch (SecurityException ignored) {}
    }
}
