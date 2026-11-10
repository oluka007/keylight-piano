package org.keylight.piano;

import java.net.URI;
import java.util.Set;

/**
 * Which addresses the page may ask the phone to open. A line-for-line port of renderer/external-links.cjs:
 * the check reads the raw string (a parser would tidy away a user name, port, backslash, capital letters or a
 * trailing dot), so only an exact address from the list, or a new-issue address that carries exactly the keys
 * title and body, each once and once-encoded, passes. Pure Java, so scripts/test-android-midi.js can run it.
 */
final class LinkPolicy {
    private static final Set<String> DESTINATIONS = Set.of(
            "https://ko-fi.com/scizers",
            "https://ko-fi.com/scizers/",
            "https://github.com/scizerss/keylight-piano",
            "https://github.com/scizerss/keylight-piano/issues",
            "https://github.com/scizerss/keylight-piano/releases",
            "https://github.com/scizerss/keylight-piano/releases/latest",
            "https://github.com/demixme/GRAB");
    private static final String ISSUE_NEW = "https://github.com/scizerss/keylight-piano/issues/new";

    private LinkPolicy() { }

    private static boolean encoded(String value) {
        if (value.isEmpty()) return false;
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || "-._~!*'()".indexOf(c) >= 0) continue;
            if (c == '%' && i + 2 < value.length() && hex(value.charAt(i + 1)) && hex(value.charAt(i + 2))) { i += 2; continue; }
            return false;
        }
        return !value.contains("%25");
    }
    private static boolean hex(char c) { return (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F'); }

    static boolean isIssue(String value) {
        if (value.length() > 2000 || !value.startsWith(ISSUE_NEW + "?")) return false;
        String[] pairs = value.substring(ISSUE_NEW.length() + 1).split("&", -1);
        if (pairs.length != 2) return false;
        String first = null;
        for (String pair : pairs) {
            int at = pair.indexOf('=');
            if (at < 1) return false;
            String key = pair.substring(0, at), val = pair.substring(at + 1);
            if (!(key.equals("title") || key.equals("body")) || !encoded(val)) return false;
            if (key.equals(first)) return false;
            first = key;
        }
        try {
            URI u = new URI(value);
            return "https".equals(u.getScheme()) && "github.com".equals(u.getHost()) && "/scizerss/keylight-piano/issues/new".equals(u.getRawPath())
                    && u.getRawUserInfo() == null && u.getPort() == -1 && u.getRawFragment() == null;
        } catch (Exception invalid) { return false; }
    }

    static boolean allowed(String value) {
        return value != null && (DESTINATIONS.contains(value) || isIssue(value));
    }
}
