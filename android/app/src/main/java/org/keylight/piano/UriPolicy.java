package org.keylight.piano;

import java.util.List;
import java.util.Locale;

/** Pure rules (no Android classes, so a plain JVM test covers them) for URIs that come back from a picker. */
final class UriPolicy {
    private UriPolicy() { }

    /**
     * Only content:// URIs from another app's provider are accepted. file:, android.resource:, data:, http(s) and a missing or
     * empty authority are refused, and so is every authority that belongs to this app (its own provider could expose private files).
     */
    static boolean acceptable(String scheme, String authority, String ownPackage) {
        if (scheme == null || !scheme.equalsIgnoreCase("content")) return false;
        if (authority == null || authority.isEmpty() || authority.indexOf('@') >= 0) return false;
        String lower = authority.toLowerCase(Locale.ROOT), own = ownPackage == null ? "" : ownPackage.toLowerCase(Locale.ROOT);
        return own.isEmpty() || !(lower.equals(own) || lower.startsWith(own + ".") || lower.startsWith(own + ":"));
    }

    /** True when an already canonical path is one of the private roots or inside one. */
    static boolean insideAny(String canonicalPath, List<String> roots) {
        if (canonicalPath == null) return false;
        for (String root : roots) {
            if (root == null || root.isEmpty()) continue;
            String base = root.endsWith("/") ? root.substring(0, root.length() - 1) : root;
            if (canonicalPath.equals(base) || canonicalPath.startsWith(base + "/")) return true;
        }
        return false;
    }

    static final int FLAG_READ = 1, FLAG_WRITE = 2;      // Intent.FLAG_GRANT_READ_URI_PERMISSION / FLAG_GRANT_WRITE_URI_PERMISSION

    /** The picker's own result Intent must carry the grant flag for this use; an older grant for the same URI does not count. */
    static boolean hasResultGrant(int resultFlags, boolean write) { return (resultFlags & (write ? FLAG_WRITE : FLAG_READ)) != 0; }
}
