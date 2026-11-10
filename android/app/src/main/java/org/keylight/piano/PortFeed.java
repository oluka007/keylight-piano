package org.keylight.piano;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.BooleanSupplier;
import java.util.function.LongSupplier;

/**
 * Delivery of one input port's buffered messages to JavaScript with backpressure: at most ONE delivery is in flight per port. A
 * new one is posted only after the previous one has really run on the receiving side (the sink calls delivered), so the receiving
 * thread's queue never holds more than one batch per port. Pure Java (JVM tested with a fake scheduler).
 */
final class PortFeed {
    interface Scheduler { void postDelayed(Runnable task, long delayMs); void post(Runnable task); }
    interface Sink { void data(byte[] bytes, Runnable delivered); void dropped(long count); }
    static final long FRAME_MS = 16;
    static final int BATCH_BYTES = 16 * 1024;

    final MidiBuffer buffer = new MidiBuffer();
    private final AtomicBoolean inFlight = new AtomicBoolean();
    private final Scheduler scheduler; private final Sink sink; private final LongSupplier clock; private final BooleanSupplier open;

    PortFeed(Scheduler scheduler, Sink sink, LongSupplier clock, BooleanSupplier open) { this.scheduler = scheduler; this.sink = sink; this.clock = clock; this.open = open; }

    /** Any thread. */
    void onBytes(byte[] data, int offset, int count) { buffer.offer(data, offset, count); kick(); }

    private void kick() { if (inFlight.compareAndSet(false, true)) scheduler.postDelayed(this::run, FRAME_MS); }

    private void run() {                       // scheduler thread
        if (!open.getAsBoolean()) { buffer.drain(Integer.MAX_VALUE); inFlight.set(false); return; }
        long now = clock.getAsLong();
        long lost = buffer.takeDropped(now);
        if (lost > 0) sink.dropped(lost);
        byte[] bytes = buffer.drain(BATCH_BYTES);
        if (bytes != null) { sink.data(bytes, () -> scheduler.post(this::after)); return; }    // stay "in flight" until it ran
        inFlight.set(false);
        if (buffer.hasDropped()) { if (inFlight.compareAndSet(false, true)) scheduler.postDelayed(this::run, Math.max(1, buffer.millisUntilReport(now))); }
        else if (!buffer.isEmpty()) kick();    // something arrived while we were finishing
    }

    private void after() { inFlight.set(false); if (!buffer.isEmpty() || buffer.hasDropped()) kick(); }
}
