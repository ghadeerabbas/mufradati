package de.mufradati.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;

// يعطي تطبيق الكاميرا مكانًا يحفظ فيه الصورة (داخل التطبيق)، ثم تقرؤها الصفحة لمساعد الوظيفة
public class PhotoProvider extends ContentProvider {
    static File fileFor(android.content.Context c, Uri u) {
        String n = u.getLastPathSegment();
        if (n == null || !n.matches("[0-9]+\\.jpg")) n = "photo.jpg";
        File d = new File(c.getCacheDir(), "photos");
        d.mkdirs();
        return new File(d, n);
    }
    @Override public boolean onCreate() { return true; }
    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        return ParcelFileDescriptor.open(fileFor(getContext(), uri), ParcelFileDescriptor.parseMode(mode));
    }
    @Override public String getType(Uri uri) { return "image/jpeg"; }
    @Override public Cursor query(Uri uri, String[] p, String s, String[] a, String o) {
        File f = fileFor(getContext(), uri);
        MatrixCursor c = new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE});
        c.addRow(new Object[]{f.getName(), f.length()});
        return c;
    }
    @Override public Uri insert(Uri uri, ContentValues v) { return null; }
    @Override public int delete(Uri uri, String s, String[] a) { return 0; }
    @Override public int update(Uri uri, ContentValues v, String s, String[] a) { return 0; }
}
