package org.keylight.piano;

import java.util.HashSet;
import java.util.Set;

/**
 * Every asynchronous Bluetooth open is an attempt with its own id. A late result from a stale attempt is closed at once and
 * the callback thread stays alive until every attempt has answered. Pure Java so a JVM test covers the state machine.
 */
final class AttemptTracker {
    private long next, current;
    private final Set<Long> outstanding = new HashSet<>();
    private boolean shutdown;

    /** Starts an attempt; any earlier one becomes stale. */
    synchronized long begin() { long id = ++next; current = id; outstanding.add(id); return id; }
    /** Disconnect, timeout, Bluetooth off or a new request: the running attempt may no longer be adopted. */
    synchronized void cancel() { current = 0; }
    synchronized void shutdown() { shutdown = true; current = 0; }
    synchronized boolean isCurrent(long id) { return !shutdown && id == current; }
    /** The attempt answered (device or failure). True only if the result may be adopted; false means close it now. */
    synchronized boolean finish(long id) {
        boolean known = outstanding.remove(id);
        boolean adopt = known && !shutdown && id == current;
        if (adopt) current = 0;
        return adopt;
    }
    synchronized int outstanding() { return outstanding.size(); }
    synchronized boolean idle() { return outstanding.isEmpty(); }
}
