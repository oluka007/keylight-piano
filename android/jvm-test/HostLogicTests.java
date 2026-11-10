package org.keylight.piano;

import java.util.*;

/** Plain JVM tests (no Android) for the pure host logic. Run by scripts/test-android-midi.js with assertions enabled. */
public final class HostLogicTests {
    static int count;
    static void check(boolean condition, String name) { if (!condition) throw new AssertionError(name); count++; }

    public static void main(String[] args) {
        floodIsBounded(); sysexSurvivesAFloodOfNotes(); sysexIsCapped(); runningStatusSurvivesOverflow(); backpressure(); stagingFiles(); droppedIsReportedOncePerSecond(); orderIsKept();
        staleBluetoothAttempts(); pickerUris();
        System.out.println("jvm host logic: " + count + " checks passed");
    }

    static void floodIsBounded() {
        MidiBuffer buffer = new MidiBuffer();
        byte[] note = {(byte) 0x90, 60, 100};
        for (int i = 0; i < 2_000_000; i++) buffer.offer(note, 0, 3);
        check(buffer.size() <= MidiBuffer.MAX_MESSAGES, "message count is bounded: " + buffer.size());
        check(buffer.byteCount() <= MidiBuffer.MAX_BYTES, "byte count is bounded");
        check(buffer.takeDropped(10_000) == 2_000_000 - MidiBuffer.MAX_MESSAGES, "every drop is counted");
        MidiBuffer big = new MidiBuffer();
        byte[] chunk = new byte[1000]; Arrays.fill(chunk, (byte) 0x40); chunk[0] = (byte) 0xB0;
        for (int i = 0; i < 5000; i++) big.offer(chunk, 0, 1000);
        check(big.byteCount() <= MidiBuffer.MAX_BYTES, "byte cap holds with large chunks");
        check(big.hasDropped(), "large chunk flood drops");
    }

    static void orderIsKept() {
        MidiBuffer buffer = new MidiBuffer();
        for (int i = 0; i < MidiBuffer.MAX_MESSAGES + 10; i++) buffer.offer(new byte[]{(byte) 0x90, (byte) (i & 127), (byte) (i >> 7 & 127)}, 0, 3);
        byte[] first = buffer.drain(3 * 100);
        check(first.length == 300, "drain honours its byte limit");
        check((first[1] & 255) == 10 && (first[0] & 255) == 0x90, "the oldest 10 were dropped, the rest keep arrival order");
        int total = first.length; byte[] more;
        while ((more = buffer.drain(16 * 1024)) != null) total += more.length;
        check(total == 3 * MidiBuffer.MAX_MESSAGES, "everything kept is delivered exactly once");
    }

    static void sysexSurvivesAFloodOfNotes() {
        MidiBuffer buffer = new MidiBuffer();
        buffer.offer(new byte[]{(byte) 0xF0, 1, 2, 3, (byte) 0xF7}, 0, 5);
        byte[] note = {(byte) 0x90, 60, 100};
        for (int i = 0; i < 10_000; i++) buffer.offer(note, 0, 3);
        byte[] out = buffer.drain(Integer.MAX_VALUE);
        check((out[0] & 255) == 0xF0 && (out[4] & 255) == 0xF7, "non-SysEx is dropped before SysEx");
    }

    static void sysexIsCapped() {
        MidiBuffer buffer = new MidiBuffer();
        byte[] part = new byte[1000]; Arrays.fill(part, (byte) 5); part[0] = (byte) 0xF0;
        buffer.offer(part, 0, 1000);
        byte[] middle = new byte[1000]; Arrays.fill(middle, (byte) 5);
        for (int i = 0; i < 200; i++) buffer.offer(middle, 0, 1000);      // 200 KB of one SysEx
        buffer.offer(new byte[]{(byte) 0xF7, (byte) 0x90, 64, 90}, 0, 4);
        byte[] all = new byte[0], out;
        while ((out = buffer.drain(16 * 1024)) != null) all = concat(all, out);
        check(Arrays.equals(all, new byte[]{(byte) 0x90, 64, 90}), "an over-long SysEx is discarded whole, the note after it arrives");
        check(buffer.hasDropped(), "the discard is counted");
        MidiBuffer ok = new MidiBuffer();
        ok.offer(new byte[]{(byte) 0xF0, 1, 0x7E}, 0, 3); ok.offer(new byte[]{2, (byte) 0xF8, (byte) 0xF7}, 0, 3);
        check(Arrays.equals(ok.drain(100), new byte[]{(byte) 0xF8, (byte) 0xF0, 1, 0x7E, 2, (byte) 0xF7}), "SysEx split over chunks is assembled; real-time passes");
    }

    /** A running-status stream cut at arbitrary chunk borders and overflowed must deliver exactly a suffix of the notes sent: never a wrong note. */
    static void runningStatusSurvivesOverflow() {
        for (int chunkSize : new int[]{1, 2, 3, 5, 7, 64}) {
            MidiBuffer buffer = new MidiBuffer();
            int notes = MidiBuffer.MAX_MESSAGES * 3 + 11; ByteArrayStream stream = new ByteArrayStream();
            stream.add(0x90);                                   // status once, then running status only
            for (int i = 0; i < notes; i++) { stream.add(i % 100); stream.add(1 + (i * 7) % 126); }
            byte[] all = stream.bytes();
            for (int at = 0; at < all.length; at += chunkSize) buffer.offer(all, at, Math.min(chunkSize, all.length - at));
            byte[] out = new byte[0], part;
            while ((part = buffer.drain(16 * 1024)) != null) out = concat(out, part);
            check(out.length % 3 == 0 && out.length / 3 <= MidiBuffer.MAX_MESSAGES, "delivered whole messages only (chunk " + chunkSize + ")");
            int first = notes - out.length / 3;
            for (int k = 0; k < out.length / 3; k++) {
                int i = first + k;
                check((out[3 * k] & 255) == 0x90 && out[3 * k + 1] == i % 100 && out[3 * k + 2] == 1 + (i * 7) % 126, "no wrong note after overflow at " + i);
            }
            check(buffer.hasDropped(), "overflow counted");
        }
        // a message cut in the middle by a dropped neighbour cannot happen: a partial message at the end of the input just waits
        MidiBuffer half = new MidiBuffer();
        half.offer(new byte[]{(byte) 0x90, 60}, 0, 2);
        check(half.drain(10) == null, "an incomplete message is not delivered");
        half.offer(new byte[]{100, 61, 90, (byte) 0xC0, 5}, 0, 5);
        check(Arrays.equals(half.drain(100), new byte[]{(byte) 0x90, 60, 100, (byte) 0x90, 61, 90, (byte) 0xC0, 5}), "completed later, running status expanded");
    }

    static final class ByteArrayStream {
        private final java.io.ByteArrayOutputStream o = new java.io.ByteArrayOutputStream();
        void add(int b) { o.write(b); }
        byte[] bytes() { return o.toByteArray(); }
    }

    /** One delivery in flight per port: a flood never queues more than one batch on the receiving thread. */
    static void backpressure() {
        final ArrayDeque<Runnable> queue = new ArrayDeque<>();
        final List<Runnable> acks = new ArrayList<>(); final int[] delivered = {0}; final long[] lost = {0}; final long[] clock = {0};
        PortFeed feed = new PortFeed(new PortFeed.Scheduler() {
            public void postDelayed(Runnable task, long ms) { queue.add(task); }
            public void post(Runnable task) { queue.add(task); }
        }, new PortFeed.Sink() {
            public void data(byte[] bytes, Runnable done) { delivered[0] += bytes.length; acks.add(done); }
            public void dropped(long count) { lost[0] += count; }
        }, () -> clock[0], () -> true);
        byte[] note = {(byte) 0x90, 60, 100};
        int maxQueued = 0;
        for (int i = 0; i < 1_000_000; i++) { feed.onBytes(note, 0, 3); maxQueued = Math.max(maxQueued, queue.size() + acks.size()); }
        check(maxQueued <= 1, "a flood posts at most one delivery per port (" + maxQueued + ")");
        queue.poll().run();
        check(acks.size() == 1 && queue.isEmpty(), "one batch in flight, nothing else posted until it ran");
        for (int i = 0; i < 100_000; i++) feed.onBytes(note, 0, 3);
        check(queue.isEmpty() && acks.size() == 1, "still nothing posted while the first batch is unacknowledged");
        acks.remove(0).run();
        check(queue.size() == 1, "acknowledging allows exactly the next delivery");
        clock[0] = 5000; queue.poll().run();
        check(lost[0] > 0, "drops were reported");
        check(delivered[0] <= 2 * PortFeed.BATCH_BYTES + 3, "batches stay small");
    }

    static void stagingFiles() {
        Set<String> owned = new HashSet<>(Arrays.asList("keylight-export-1.part"));
        long now = 10_000_000, old = now - StagingPolicy.MIN_AGE_MS - 1;
        check(!StagingPolicy.shouldDelete("keylight-export-1.part", old, now, owned), "an owned file is never deleted");
        check(!StagingPolicy.shouldDelete("keylight-export-2.part", now - 1000, now, owned), "a recent file (another instance's copy) is kept");
        check(StagingPolicy.shouldDelete("keylight-export-2.part", old, now, owned), "an old unowned file is deleted");
        check(!StagingPolicy.shouldDelete("other.txt", old, now, owned), "only staging files are touched");
    }

    static byte[] concat(byte[] a, byte[] b) { byte[] r = Arrays.copyOf(a, a.length + b.length); System.arraycopy(b, 0, r, a.length, b.length); return r; }

    static void droppedIsReportedOncePerSecond() {
        MidiBuffer buffer = new MidiBuffer();
        byte[] note = {(byte) 0x90, 60, 100};
        for (int i = 0; i < MidiBuffer.MAX_MESSAGES + 5; i++) buffer.offer(note, 0, 3);
        check(buffer.takeDropped(5_000) == 5, "first report is immediate");
        for (int i = 0; i < 50; i++) buffer.offer(note, 0, 3);
        check(buffer.takeDropped(5_500) == 0, "no second report inside one second");
        check(buffer.millisUntilReport(5_500) == 500, "time to the next report");
        check(buffer.takeDropped(6_000) == 50, "reported once the second has passed");
    }

    static void staleBluetoothAttempts() {
        // start A, cancel, start B, A returns, activity destroyed, B returns: neither device may be adopted, both are closed
        AttemptTracker t = new AttemptTracker();
        long a = t.begin(); t.cancel(); long b = t.begin();
        check(t.outstanding() == 2, "both attempts are tracked");
        check(!t.finish(a), "stale A is closed immediately");
        check(t.outstanding() == 1 && !t.idle(), "the thread must stay alive for B");
        t.shutdown();
        check(!t.finish(b), "B after destroy is closed");
        check(t.idle(), "idle only after every attempt answered");
        check(!t.finish(b), "a duplicate callback is closed too");

        AttemptTracker u = new AttemptTracker();
        long c = u.begin(), d = u.begin();         // a new attempt supersedes the earlier one
        check(!u.finish(c) && u.finish(d), "only the newest attempt is adopted");
        long e = u.begin(); u.cancel();
        check(!u.finish(e) && u.idle(), "a cancelled attempt is closed");
        check(!u.isCurrent(e), "cancelled is not current");
    }

    static void pickerUris() {
        String me = "org.keylight.piano";
        check(UriPolicy.acceptable("content", "com.android.providers.downloads.documents", me), "a document provider is accepted");
        check(UriPolicy.acceptable("CONTENT", "com.android.externalstorage.documents", me), "scheme case is ignored");
        for (String scheme : new String[]{"file", "android.resource", "data", "http", "https", "javascript", "", null})
            check(!UriPolicy.acceptable(scheme, "x.y", me), "scheme refused: " + scheme);
        check(UriPolicy.hasResultGrant(1, false) && !UriPolicy.hasResultGrant(1, true) && UriPolicy.hasResultGrant(3, true) && !UriPolicy.hasResultGrant(0, false), "the result Intent must carry the grant for the use");
        check(!UriPolicy.acceptable("content", null, me), "null authority refused");
        check(!UriPolicy.acceptable("content", "", me), "empty authority refused");
        check(!UriPolicy.acceptable("content", me, me), "own authority refused");
        check(!UriPolicy.acceptable("content", me + ".fileprovider", me), "own provider refused");
        check(!UriPolicy.acceptable("content", "ORG.KEYLIGHT.PIANO.files", me), "own provider refused in any case");
        check(!UriPolicy.acceptable("content", "evil@" + me, me), "user-info trick refused");
        check(UriPolicy.acceptable("content", "org.keylight.pianola.documents", me), "a different package that merely shares the prefix is another app");
        List<String> roots = Arrays.asList("/data/user/0/org.keylight.piano", "/data/data/org.keylight.piano/");
        check(UriPolicy.insideAny("/data/user/0/org.keylight.piano/app_webview/Default/Preferences", roots), "private file detected");
        check(UriPolicy.insideAny("/data/data/org.keylight.piano", roots), "the private root itself");
        check(!UriPolicy.insideAny("/data/user/0/org.keylight.pianoX/f", roots), "a sibling prefix is not inside");
        check(!UriPolicy.insideAny("/storage/emulated/0/Download/a.mid", roots), "shared storage is fine");
    }
}
