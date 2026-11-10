package org.keylight.piano;

import java.util.ArrayDeque;

/**
 * Bounded buffer between a MIDI input port (any thread) and delivery to JavaScript. Incoming bytes are first parsed into COMPLETE
 * MIDI messages (running status per port is expanded, so every stored message carries its own status byte); only whole messages are
 * ever stored, dropped or delivered, so an overflow can never leave a partial or running-status message that plays a wrong note.
 * At most MAX_MESSAGES messages and MAX_BYTES bytes wait. When full the oldest non-SysEx message is dropped first, then the oldest
 * SysEx one; every drop is counted. A SysEx longer than MAX_SYSEX data bytes is discarded whole. Pure Java (JVM tested).
 */
final class MidiBuffer {
    static final int MAX_MESSAGES = 4096, MAX_BYTES = 256 * 1024, MAX_SYSEX = 64 * 1024;
    static final long REPORT_MS = 1000;
    private static final class Message { final byte[] data; final long seq; Message(byte[] data, long seq) { this.data = data; this.seq = seq; } }
    private final ArrayDeque<Message> plain = new ArrayDeque<>(), sysex = new ArrayDeque<>();
    private int bytes;
    private long seq, dropped, lastReport = Long.MIN_VALUE / 2;
    // parser state
    private int running, need;                          // running channel status (0 none) and data bytes still missing
    private final byte[] partial = new byte[3]; private int have;
    private byte[] sysexBuf = new byte[64]; private int sysexLen; private boolean inSysex, discarding;

    synchronized void offer(byte[] data, int offset, int count) {
        for (int i = 0; i < count; i++) push(data[offset + i] & 255);
    }

    private void push(int b) {
        if (b >= 0xF8) { store(new byte[]{(byte) b}, false); return; }           // real-time: its own message, never disturbs the rest
        if (b == 0xF0) { abortPartial(); inSysex = true; discarding = false; sysexLen = 0; running = 0; append(0xF0); return; }
        if (b == 0xF7) {
            if (inSysex) {
                inSysex = false;
                if (!discarding) { append(0xF7); store(java.util.Arrays.copyOf(sysexBuf, sysexLen), true); }
                discarding = false;
            }
            return;
        }
        if (b >= 0x80) {
            if (inSysex) { inSysex = false; if (discarding) discarding = false; else dropped++; }   // a status byte aborts the SysEx: not delivered
            have = 0;
            if (b >= 0xF1) {                                                       // system common: cancels running status
                running = 0;
                if (b == 0xF6) { store(new byte[]{(byte) b}, false); need = 0; }
                else if (b == 0xF4 || b == 0xF5) need = 0;                         // undefined: ignored
                else { partial[0] = (byte) b; have = 1; need = b == 0xF2 ? 2 : 1; }
            } else { running = b; partial[0] = (byte) b; have = 1; need = (b & 0xF0) == 0xC0 || (b & 0xF0) == 0xD0 ? 1 : 2; }
            return;
        }
        if (inSysex) {
            if (discarding) return;
            if (sysexLen > MAX_SYSEX) { discarding = true; dropped++; return; }
            append(b); return;
        }
        if (have == 0) {                                                           // data byte under running status starts a new message
            if (running == 0) return;
            partial[0] = (byte) running; have = 1; need = (running & 0xF0) == 0xC0 || (running & 0xF0) == 0xD0 ? 1 : 2;
        }
        partial[have++] = (byte) b;
        if (--need == 0) { store(java.util.Arrays.copyOf(partial, have), false); have = 0; }
    }

    private void abortPartial() { have = 0; need = 0; }
    private void append(int b) {
        if (sysexLen == sysexBuf.length) sysexBuf = java.util.Arrays.copyOf(sysexBuf, Math.min(sysexBuf.length * 2, MAX_SYSEX + 16));
        sysexBuf[sysexLen++] = (byte) b;
    }

    private void store(byte[] message, boolean isSysex) {
        if (message.length > MAX_BYTES) { dropped++; return; }
        while (plain.size() + sysex.size() >= MAX_MESSAGES || bytes + message.length > MAX_BYTES) {
            Message gone = !plain.isEmpty() ? plain.pollFirst() : sysex.pollFirst();
            if (gone == null) break;
            bytes -= gone.data.length; dropped++;
        }
        (isSysex ? sysex : plain).addLast(new Message(message, ++seq)); bytes += message.length;
    }

    /** Concatenation of the oldest whole messages, in arrival order, up to maxBytes (always at least one); null when empty. */
    synchronized byte[] drain(int maxBytes) {
        if (plain.isEmpty() && sysex.isEmpty()) return null;
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        while (!(plain.isEmpty() && sysex.isEmpty())) {
            Message a = plain.peekFirst(), b = sysex.peekFirst();
            Message next = b == null || (a != null && a.seq < b.seq) ? a : b;
            if (out.size() > 0 && out.size() + next.data.length > maxBytes) break;
            (next == a ? plain : sysex).pollFirst(); bytes -= next.data.length;
            out.write(next.data, 0, next.data.length);
        }
        return out.toByteArray();
    }

    synchronized boolean isEmpty() { return plain.isEmpty() && sysex.isEmpty(); }
    synchronized int size() { return plain.size() + sysex.size(); }
    synchronized int byteCount() { return bytes; }
    synchronized boolean hasDropped() { return dropped > 0; }
    /** Drops since the last report, at most once per REPORT_MS; 0 when nothing is due. */
    synchronized long takeDropped(long nowMs) {
        if (dropped == 0 || nowMs - lastReport < REPORT_MS) return 0;
        long count = dropped; dropped = 0; lastReport = nowMs; return count;
    }
    synchronized long millisUntilReport(long nowMs) { return Math.max(0, REPORT_MS - (nowMs - lastReport)); }
}
