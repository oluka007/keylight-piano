package org.keylight.piano;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.os.Process;
import android.system.ErrnoException;
import android.system.Os;
import android.system.OsConstants;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/** Validates every URI a picker hands back before the app opens it or gives it to the WebView. */
final class PickerUris {
    private PickerUris() { }

    /**
     * Opens the picker's URI ONCE and inspects that very descriptor; the caller must use the returned descriptor and never reopen
     * the URI. Returns null when anything is wrong (fails closed). write=true: export destination, opened "w" (no truncation before
     * the checks); use truncate() afterwards. write=false: upload, opened "r".
     * resultFlags are the flags of the picker's result Intent: its own grant, not an older one for the same URI.
     */
    static ParcelFileDescriptor open(Context context, Uri uri, boolean write, int resultFlags) {
        if (uri == null || !UriPolicy.acceptable(uri.getScheme(), uri.getAuthority(), context.getPackageName())) return null;
        if (!UriPolicy.hasResultGrant(resultFlags, write)) return null;
        int mode = write ? Intent.FLAG_GRANT_WRITE_URI_PERMISSION : Intent.FLAG_GRANT_READ_URI_PERMISSION;
        if (context.checkUriPermission(uri, Process.myPid(), Process.myUid(), mode) != android.content.pm.PackageManager.PERMISSION_GRANTED) return null;
        ParcelFileDescriptor fd = null;
        try {
            fd = context.getContentResolver().openFileDescriptor(uri, write ? "w" : "r");
            if (fd == null) return null;
            String link = Os.readlink("/proc/self/fd/" + fd.getFd());       // where this exact descriptor points
            boolean regular = OsConstants.S_ISREG(Os.fstat(fd.getFileDescriptor()).st_mode);
            if (regular && UriPolicy.insideAny(new File(link).getCanonicalPath(), privateRoots(context))) { fd.close(); return null; }
            if (regular && !link.startsWith("/")) { fd.close(); return null; }
            return fd;
        } catch (IOException | ErrnoException | RuntimeException refused) {
            if (fd != null) try { fd.close(); } catch (IOException ignored) { }
            return null;
        }
    }

    /** Upload validation for the WebView chooser (the WebView reopens the URI itself, so only this check is possible). */
    static boolean safeForUpload(Context context, Uri uri, int resultFlags) {
        ParcelFileDescriptor fd = open(context, uri, false, resultFlags);
        if (fd == null) return false;
        try { fd.close(); } catch (IOException ignored) { }
        return true;
    }

    /** True when the destination is a regular file (not a pipe of a cloud provider), so it may be truncated. */
    static boolean isRegular(ParcelFileDescriptor fd) {
        try { return OsConstants.S_ISREG(Os.fstat(fd.getFileDescriptor()).st_mode); } catch (ErrnoException error) { return false; }
    }

    private static List<String> privateRoots(Context context) {
        List<String> roots = new ArrayList<>();
        add(roots, context.getDataDir());
        add(roots, context.createDeviceProtectedStorageContext().getDataDir());
        roots.add("/data/data/" + context.getPackageName());
        roots.add("/data/user/" + (Process.myUid() / 100000) + "/" + context.getPackageName());
        for (File dir : context.getExternalFilesDirs(null)) if (dir != null) add(roots, dir.getParentFile());
        return roots;
    }
    private static void add(List<String> roots, File file) {
        if (file == null) return;
        roots.add(file.getAbsolutePath());
        try { roots.add(file.getCanonicalPath()); } catch (IOException ignored) { }
    }
}
