package org.keylight.piano;

import java.util.Set;

/** Pure rule for deleting export staging files left behind (JVM tested). */
final class StagingPolicy {
    static final long MIN_AGE_MS = 10 * 60 * 1000;
    private StagingPolicy() { }

    /**
     * A staging file is deleted only when no pending record owns it (queued, being chosen or being copied) AND it has not been
     * touched for MIN_AGE_MS, so another Activity instance's in-flight copy or transfer is never deleted from under it.
     */
    static boolean shouldDelete(String fileName, long lastModified, long now, Set<String> owned) {
        if (!fileName.startsWith("keylight-export-") || !fileName.endsWith(".part")) return false;
        if (owned.contains(fileName)) return false;
        return now - lastModified >= MIN_AGE_MS;
    }
}
