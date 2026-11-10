package org.keylight.piano;

import android.app.Activity;
import android.content.*;
import android.net.Uri;
import android.webkit.*;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayInputStream;
import java.util.*;

final class LocalContent extends WebViewClient {
    static final String ORIGIN = "https://appassets.androidplatform.net";
    static final String PAGE = ORIGIN + "/assets/renderer/index.html?appVersion=" + BuildConfig.VERSION_NAME;
    private final Activity activity;
    private final WebViewAssetLoader loader;
    private static final String CSP = "default-src 'self'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; "
            + "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; "
            + "connect-src 'self' blob:; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; "
            + "base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

    LocalContent(Activity activity) {
        this.activity = activity;
        loader = new WebViewAssetLoader.Builder().addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(activity)).build();
    }

    static boolean trusted(Uri uri) {
        return "https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost())
                && (uri.getPort() == -1 || uri.getPort() == 443);
    }

    @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        if (!trusted(uri) || (request.isForMainFrame() && !"/assets/renderer/index.html".equals(uri.getPath()))) return blocked();
        WebResourceResponse response = loader.shouldInterceptRequest(uri);
        if (response == null) return blocked();
        String path = uri.getPath();
        if (path.endsWith(".js") || path.endsWith(".mjs")) response.setMimeType("text/javascript");
        if (path.endsWith(".wasm")) response.setMimeType("application/wasm");
        Map<String, String> headers = new HashMap<>();
        headers.put("Content-Security-Policy", CSP);
        headers.put("X-Content-Type-Options", "nosniff");
        headers.put("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
        response.setResponseHeaders(headers);
        return response;
    }

    private WebResourceResponse blocked() {
        return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }

    @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        if (request.isForMainFrame() && trusted(uri) && "/assets/renderer/index.html".equals(uri.getPath())) return false;
        if (request.isForMainFrame() && request.hasGesture() && LinkPolicy.allowed(uri.toString())) {
            try { activity.startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); }
            catch (ActivityNotFoundException error) { android.widget.Toast.makeText(activity, "No browser available", android.widget.Toast.LENGTH_LONG).show(); }
        }
        return true;
    }
}
