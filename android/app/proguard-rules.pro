# Keylight release rules. The native bridge uses androidx.webkit WebMessageListener (no
# @JavascriptInterface, no reflection), so only the manifest classes and the WebKit
# feature checks matter. AndroidX WebKit ships its own consumer rules.
-keep class org.keylight.piano.** { *; }
-keepattributes *Annotation*
-keep class androidx.webkit.** { *; }
