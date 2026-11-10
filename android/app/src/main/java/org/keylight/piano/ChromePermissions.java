package org.keylight.piano;

import android.Manifest;
import android.app.Activity;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.SystemClock;
import android.webkit.*;
import java.util.ArrayList;
import java.util.List;

final class ChromePermissions extends WebChromeClient {
    private final Activity activity;
    private ValueCallback<Uri[]> files;
    private PermissionRequest camera;
    private static final int MAX_FILES = 50;
    long lastTouch = -60000;

    ChromePermissions(Activity activity) { this.activity = activity; }

    @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> result, FileChooserParams params) {
        if (files != null) files.onReceiveValue(null);
        files = result;
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
        try { activity.startActivityForResult(intent, 50); }
        catch (ActivityNotFoundException error) { files.onReceiveValue(null); files = null; }
        return true;
    }

    /** Only content:// URIs of another app that the picker granted to us reach the page; anything else (file:, our own provider, private storage) is dropped. */
    void fileResult(int result, Intent data) {
        if (files == null) return;
        ValueCallback<Uri[]> callback = files; files = null;
        List<Uri> accepted = new ArrayList<>();
        if (result == Activity.RESULT_OK && data != null) {
            ClipData clip = data.getClipData();
            if (clip != null) {
                for (int i = 0; i < clip.getItemCount() && i < MAX_FILES; i++) {
                    Uri uri = clip.getItemAt(i).getUri();
                    if (PickerUris.safeForUpload(activity, uri, data.getFlags())) accepted.add(uri);
                }
            } else if (PickerUris.safeForUpload(activity, data.getData(), data.getFlags())) accepted.add(data.getData());
        }
        callback.onReceiveValue(accepted.isEmpty() ? null : accepted.toArray(new Uri[0]));
    }

    @Override public void onPermissionRequest(PermissionRequest request) {
        if (!LocalContent.trusted(request.getOrigin()) || SystemClock.elapsedRealtime() - lastTouch > 30000
                || request.getResources().length != 1 || !PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(request.getResources()[0]) || camera != null) {
            request.deny(); return;
        }
        camera = request;
        if (activity.checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) cameraResult(true);
        else activity.requestPermissions(new String[]{Manifest.permission.CAMERA}, 60);
    }

    @Override public void onPermissionRequestCanceled(PermissionRequest request) { if (camera == request) camera = null; }
    void cameraResult(boolean granted) {
        if (camera == null) return;
        if (granted) camera.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE}); else camera.deny();
        camera = null;
    }
    void destroy() {
        if (files != null) { files.onReceiveValue(null); files = null; }
        cameraResult(false);
    }
}
