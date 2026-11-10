package org.keylight.piano;

import android.app.*;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.*;
import android.view.*;
import android.webkit.*;
import android.widget.FrameLayout;
import android.widget.TextView;
import androidx.webkit.*;
import org.json.*;
import java.io.IOException;
import java.util.Collections;
import java.util.concurrent.*;

public final class MainActivity extends Activity {
    private WebView web;
    private MidiTransport midi;
    private BleMidi ble;
    private ChromePermissions chrome;
    private ExportStore exports;
    private HostTools tools;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private boolean destroyed;
    private static final int MAX_MESSAGE = 400000;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            TextView message = new TextView(this); message.setText(R.string.update_webview); setContentView(message); return;
        }
        FrameLayout content = new FrameLayout(this);
        content.setBackgroundColor(0xFF080B20);   // the page's own colour shows behind the transparent system bars
        web = new WebView(this);
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true);   // debug builds only: lets QA drive the page over adb
        content.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            content.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                // Resize the WebView itself; its padding does not resize the CSS viewport.
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return WindowInsets.CONSUMED;
            });
        }
        setContentView(content);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false); settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportMultipleWindows(false);
        settings.setUserAgentString(settings.getUserAgentString() + " KeylightAndroid/1 Keylight/" + BuildConfig.VERSION_NAME);
        web.setWebViewClient(new LocalContent(this));
        chrome = new ChromePermissions(this); web.setWebChromeClient(chrome);
        exports = new ExportStore(this, io, state == null ? null : state.getString(ExportStore.STATE_KEY));
        tools = new HostTools(this);
        midi = new MidiTransport(this, this::deliver, this::deliver);
        ble = new BleMidi(this, midi, this::deliver);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) WebViewCompat.addWebMessageListener(web, "KeylightNative", Collections.singleton(LocalContent.ORIGIN),
                (view, message, origin, mainFrame, reply) -> {
                    try {
                        if (!mainFrame || !LocalContent.trusted(origin) || !LocalContent.PAGE.equals(web.getUrl())) return;
                        if (message.getType() != WebMessageCompat.TYPE_STRING) return;      // an ArrayBuffer makes getData() throw
                        String raw = message.getData();
                        if (raw == null || raw.length() > MAX_MESSAGE) return;
                        receive(raw);
                    } catch (RuntimeException error) {
                        // Whatever the page sends must never take the host down.
                        android.util.Log.w("Keylight", "Ignored a bad message from the page (" + error.getClass().getSimpleName() + ")");
                    }
                });
        web.loadUrl(LocalContent.PAGE);
        if (Build.VERSION.SDK_INT >= 33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::goBack);
    }

    /** Back: the page closes a dialog or goes up a screen; only from Home (it answers false) does the app leave. */
    private void goBack() {
        if (web == null || destroyed || !LocalContent.PAGE.equals(web.getUrl())) { finish(); return; }
        web.evaluateJavascript("globalThis.__keylightBack ? globalThis.__keylightBack() : false", value -> { if (!"true".equals(value)) finish(); });
    }
    // API 33+ uses the OnBackInvokedCallback registered in onCreate (predictive back, enableOnBackInvokedCallback); older
    // systems deliver Back as a key.
    @Override public boolean onKeyUp(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && Build.VERSION.SDK_INT < 33 && !event.isCanceled()) { goBack(); return true; }
        return super.onKeyUp(keyCode, event);
    }

    @Override public boolean dispatchTouchEvent(MotionEvent event) {
        if (chrome != null && event.getAction() == MotionEvent.ACTION_UP) chrome.lastTouch = SystemClock.elapsedRealtime();
        return super.dispatchTouchEvent(event);
    }
    @Override public boolean dispatchKeyEvent(KeyEvent event) {
        if (chrome != null && event.getAction() == KeyEvent.ACTION_UP) chrome.lastTouch = SystemClock.elapsedRealtime();
        return super.dispatchKeyEvent(event);
    }

    private void receive(String raw) {
        long id = 0;
        try {
            JSONObject request = new JSONObject(raw); id = request.getLong("id");
            String op = request.getString("op"); final long requestId = id;
            if (op.startsWith("export")) io.execute(() -> {
                try { respond(requestId, exports.request(request), null); }
                catch (IOException | JSONException | RuntimeException error) { respond(requestId, null, error.toString()); }
            });
            else if (HostTools.handles(op)) runOnUiThread(() -> {
                try { respond(requestId, tools.request(request), null); }
                catch (JSONException | RuntimeException error) { respond(requestId, null, error.toString()); }
            });
            else if (op.startsWith("ble")) ble.request(request, result -> respond(requestId, result, null), error -> respond(requestId, null, error));
            else midi.request(request, result -> respond(requestId, result, null), error -> respond(requestId, null, error));
        } catch (JSONException | RuntimeException error) { respond(id, null, error.toString()); }
    }

    private void respond(long id, Object result, String error) {
        try { deliver(new JSONObject().put("id", id).put("result", result).put("error", error)); }
        catch (JSONException invalid) { throw new IllegalStateException(invalid); }
    }
    private void deliver(JSONObject event) {
        runOnUiThread(() -> {
            if (!destroyed && LocalContent.PAGE.equals(web.getUrl())) web.evaluateJavascript("globalThis.__keylightNativeReceive?.(" + event + ")", null);
        });
    }
    /** Delivers on the UI thread and then runs delivered (also when the page is gone, so a sender is never stuck waiting). */
    private void deliver(JSONObject event, Runnable delivered) {
        runOnUiThread(() -> {
            try { if (!destroyed && LocalContent.PAGE.equals(web.getUrl())) web.evaluateJavascript("globalThis.__keylightNativeReceive?.(" + event + ")", null); }
            finally { delivered.run(); }
        });
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == 50) chrome.fileResult(result, data);
        if (request == 51) exports.result(result, data);
        if (request == BleMidi.REQ_ENABLE && ble != null) ble.enableResult();
    }
    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (request == 60) chrome.cameraResult(results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED);
        if (request == BleMidi.REQ_PERMISSION && ble != null) ble.permissionResult();
    }
    @Override protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        // "Don't keep activities" destroys us while the save picker is open: remember the staged exports so its result can still be written.
        if (exports != null) { String pending = exports.saveState(); if (pending != null) out.putString(ExportStore.STATE_KEY, pending); }
    }
    @Override protected void onPause() { if (ble != null) ble.pause(); super.onPause(); }
    @Override protected void onStart() { super.onStart(); if (midi != null) midi.setActive(true); }
    @Override protected void onStop() { if (midi != null) midi.setActive(false); super.onStop(); }
    @Override protected void onDestroy() {
        destroyed = true;
        if (ble != null) ble.destroy();
        if (midi != null) midi.destroy();
        if (chrome != null) chrome.destroy();
        final boolean finishing = isFinishing();
        if (exports != null) io.execute(() -> {
            try { exports.destroy(finishing); }
            catch (IOException error) { android.util.Log.e("Keylight", "Export cleanup failed", error); }
        });
        io.shutdown();
        if (web != null) {
            web.stopLoading();
            if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) WebViewCompat.removeWebMessageListener(web, "KeylightNative");
            web.destroy();
        }
        super.onDestroy();
    }
}
