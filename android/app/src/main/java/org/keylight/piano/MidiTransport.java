package org.keylight.piano;

import android.content.Context;
import android.content.pm.PackageManager;
import android.media.midi.*;
import android.os.*;
import org.json.*;
import java.io.*;
import java.util.*;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

final class MidiTransport {
    private final MidiManager manager;
    private final HandlerThread thread = new HandlerThread("keylight-midi");
    private final Handler queue;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Consumer<JSONObject> emit;
    private final BiConsumer<JSONObject, Runnable> emitAck;   // delivers on the UI thread, then runs the Runnable
    private final Map<Integer, MidiDevice> devices = new HashMap<>();
    private final Map<String, Closeable> ports = new HashMap<>();
    private final Map<Integer, List<Runnable>> opening = new HashMap<>();
    private final Set<Integer> failed = new HashSet<>();
    private final Map<Integer, MidiDevice> links = new HashMap<>();   // Bluetooth links held open for the keyboard's whole session
    private Consumer<Integer> removed = id -> { };
    private final boolean usbHost, bluetoothLe;
    private boolean active = true;
    private boolean terminating;
    private final AttemptTracker attempts = new AttemptTracker();
    private long generation;
    private final MidiManager.DeviceCallback callback = new MidiManager.DeviceCallback() {
        @Override public void onDeviceAdded(MidiDeviceInfo info) { failed.remove(info.getId()); publish(); }
        @Override public void onDeviceRemoved(MidiDeviceInfo info) {
            generation++; releaseDevice(info.getId()); publish();
        }
    };

    MidiTransport(Context context, Consumer<JSONObject> emit, BiConsumer<JSONObject, Runnable> emitAck) {
        this.emit = emit; this.emitAck = emitAck;
        PackageManager features = context.getPackageManager();
        usbHost = features.hasSystemFeature(PackageManager.FEATURE_USB_HOST);
        bluetoothLe = features.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE);
        manager = features.hasSystemFeature(PackageManager.FEATURE_MIDI) && (usbHost || bluetoothLe)
                ? context.getSystemService(MidiManager.class) : null;
        thread.start(); queue = new Handler(thread.getLooper());
        if (manager != null) {
            if (Build.VERSION.SDK_INT >= 33) manager.registerDeviceCallback(MidiManager.TRANSPORT_MIDI_BYTE_STREAM, queue::post, callback);
            else manager.registerDeviceCallback(callback, queue);
        }
    }

    private Collection<MidiDeviceInfo> available() {
        if (manager == null || !active) return Collections.emptyList();
        if (Build.VERSION.SDK_INT >= 33) return manager.getDevicesForTransport(MidiManager.TRANSPORT_MIDI_BYTE_STREAM);
        return Arrays.asList(manager.getDevices());
    }

    private JSONArray list() throws JSONException {
        JSONArray result = new JSONArray();
        for (MidiDeviceInfo device : available()) {
            if (!supportedType(device) || failed.contains(device.getId())) continue;
            for (MidiDeviceInfo.PortInfo port : device.getPorts()) {
                String type = port.getType() == MidiDeviceInfo.PortInfo.TYPE_OUTPUT ? "input" : "output";
                Bundle props = device.getProperties();
                String name = props.getString(MidiDeviceInfo.PROPERTY_NAME, device.getType() == MidiDeviceInfo.TYPE_USB ? "USB MIDI" : "Bluetooth MIDI");
                result.put(new JSONObject().put("id", device.getId() + ":" + type + ":" + port.getPortNumber())
                        .put("type", type).put("name", name).put("portName", port.getName())
                        .put("transport", device.getType() == MidiDeviceInfo.TYPE_USB ? "usb" : "ble")
                        .put("manufacturer", props.getString(MidiDeviceInfo.PROPERTY_MANUFACTURER, ""))
                        .put("version", props.getString(MidiDeviceInfo.PROPERTY_VERSION, "")));
            }
        }
        return result;
    }

    // USB needs the host feature, Bluetooth the LE feature: a tablet without one still serves the other
    private boolean supportedType(MidiDeviceInfo info) {
        return (info.getType() == MidiDeviceInfo.TYPE_USB && usbHost) || (info.getType() == MidiDeviceInfo.TYPE_BLUETOOTH && bluetoothLe);
    }

    Handler handler() { return queue; }
    /** Callbacks that must survive the MIDI thread's shutdown are delivered here (main thread). */
    Handler mainHandler() { return mainHandler; }
    void onRemoved(Consumer<Integer> listener) { removed = listener; }

    /** BleMidi hands over the opened link: its ports then appear and open like any USB device's (queue thread). */
    boolean adopt(MidiDevice device) {
        int id = device.getInfo().getId();
        if (!active || terminating) { close(device); return false; }
        MidiDevice old = links.put(id, device);
        if (old != null && old != device) close(old);
        if (!devices.containsKey(id)) devices.put(id, device);
        failed.remove(id);
        publish();
        return true;
    }

    /** One entry per Bluetooth open in flight: the thread outlives shutdown until every one has answered, so a late device is always closed. */
    AttemptTracker attempts() { return attempts; }
    /** Call on the queue thread after an attempt answered and its device was adopted or closed. */
    void attemptAnswered() { quitIfIdle(); }
    private void quitIfIdle() { if (terminating && opening.isEmpty() && attempts.idle()) thread.quitSafely(); }

    /** Disconnect a Bluetooth keyboard on purpose. */
    void release(int id) { queue.post(() -> { generation++; releaseDevice(id); publish(); }); }

    private void publish() {
        try { emit.accept(new JSONObject().put("kind", "ports").put("ports", list())); }
        catch (JSONException error) { throw new IllegalStateException(error); }
    }

    void request(JSONObject request, Consumer<Object> done, Consumer<String> fail) {
        queue.post(() -> {
            try {
                if (manager == null) { fail.accept("Android MIDI with USB host or Bluetooth LE is required"); return; }
                String op = request.getString("op");
                if (op.equals("list")) { done.accept(list()); return; }
                String id = request.getString("port");
                String[] parts = id.split(":");
                if (parts.length != 3) throw new IllegalArgumentException("Invalid port ID");
                int deviceId = Integer.parseInt(parts[0]);
                Integer.parseInt(parts[2]);
                if (!parts[1].equals("input") && !parts[1].equals("output")) throw new IllegalArgumentException("Invalid port type");
                MidiDeviceInfo found = null;
                for (MidiDeviceInfo info : available()) if (info.getId() == deviceId && supportedType(info)) found = info;
                if (found == null || failed.contains(deviceId)) { fail.accept("MIDI device disconnected; reconnect after an I/O failure"); return; }
                if (!op.equals("close") && !op.equals("open") && !op.equals("send") && !op.equals("clear")) throw new IllegalArgumentException("Unknown MIDI operation");
                Runnable action = () -> operate(request, done, fail);
                if (op.equals("close") && !opening.containsKey(deviceId)) { action.run(); return; }
                if (devices.containsKey(deviceId)) { action.run(); return; }
                List<Runnable> waiting = opening.get(deviceId);
                if (waiting != null) { waiting.add(action); return; }
                waiting = new ArrayList<>(); waiting.add(action); opening.put(deviceId, waiting);
                long started = generation;
                try {
                    // The callback arrives on the main thread, which outlives the MIDI thread; it hops to the queue, and when the
                    // queue is already shut down the late device is closed right there.
                    manager.openDevice(found, device -> {
                        if (!queue.post(() -> openAnswered(deviceId, started, device))) close(device);
                    }, mainHandler);
                } catch (RuntimeException failure) {
                    opening.remove(deviceId); quitIfIdle();       // a synchronous failure must not leave an entry that blocks shutdown
                    throw failure;
                }
            } catch (JSONException | RuntimeException error) { fail.accept(error.toString()); }
        });
    }

    private void openAnswered(int deviceId, long started, MidiDevice device) {
        List<Runnable> actions = opening.remove(deviceId);
        try {
            boolean connected = available().stream().anyMatch(info -> info.getId() == deviceId);
            if (device != null && connected && started == generation) devices.put(deviceId, device);
            else close(device);
            if (actions != null) for (Runnable next : actions) next.run();
        } finally { quitIfIdle(); }
    }

    private void operate(JSONObject request, Consumer<Object> done, Consumer<String> fail) {
        try {
            String id = request.getString("port");
            if (request.getString("op").equals("close")) { close(ports.remove(id)); done.accept(true); return; }
            String[] parts = id.split(":");
            MidiDevice device = devices.get(Integer.parseInt(parts[0]));
            if (device == null) { fail.accept("Cannot open USB MIDI device (busy or disconnected)"); return; }
            if (!ports.containsKey(id)) {
                int number = Integer.parseInt(parts[2]);
                if (parts[1].equals("input")) {
                    MidiOutputPort port = device.openOutputPort(number);
                    if (port == null) { fail.accept("MIDI input port busy"); return; }
                    PortFeed feed = new PortFeed(new PortFeed.Scheduler() {
                        @Override public void postDelayed(Runnable task, long delayMs) { queue.postDelayed(task, delayMs); }
                        @Override public void post(Runnable task) { queue.post(task); }
                    }, new PortFeed.Sink() {
                        @Override public void data(byte[] bytes, Runnable delivered) {
                            try {
                                JSONArray values = new JSONArray();
                                for (byte b : bytes) values.put(b & 255);
                                emitAck.accept(new JSONObject().put("kind", "data").put("port", id).put("bytes", values), delivered);
                            } catch (JSONException error) { throw new IllegalStateException(error); }
                        }
                        @Override public void dropped(long count) {
                            try { emit.accept(new JSONObject().put("kind", "dropped").put("port", id).put("count", count)); }
                            catch (JSONException error) { throw new IllegalStateException(error); }
                        }
                    }, SystemClock::elapsedRealtime, () -> ports.get(id) == port);
                    port.connect(new MidiReceiver() {
                        @Override public void onSend(byte[] data, int offset, int count, long timestamp) { feed.onBytes(data, offset, count); }
                    });
                    ports.put(id, port);
                } else {
                    MidiInputPort port = device.openInputPort(number);
                    if (port == null) { fail.accept("MIDI output port busy"); return; }
                    ports.put(id, port);
                }
            }
            if (request.getString("op").equals("clear")) {
                Closeable port = ports.get(id);
                if (!(port instanceof MidiInputPort)) throw new IllegalArgumentException("Expected output port");
                ((MidiInputPort) port).flush();
            } else if (request.getString("op").equals("send")) {
                Closeable port = ports.get(id);
                if (!(port instanceof MidiInputPort)) throw new IllegalArgumentException("Expected output port");
                JSONArray values = request.getJSONArray("bytes");
                if (values.length() < 1 || values.length() > 65536) throw new IllegalArgumentException("MIDI size limit");
                byte[] bytes = new byte[values.length()];
                for (int i = 0; i < bytes.length; i++) {
                    int value = values.getInt(i);
                    if (value < 0 || value > 255 || values.getDouble(i) != value) throw new IllegalArgumentException("Invalid MIDI byte");
                    bytes[i] = (byte) value;
                }
                double delay = request.optDouble("delay", 0);
                if (!Double.isFinite(delay) || delay < 0 || delay > 60000) throw new IllegalArgumentException("Schedule limit is 60 seconds");
                ((MidiInputPort) port).send(bytes, 0, bytes.length, delay == 0 ? 0 : System.nanoTime() + (long) (delay * 1000000));
            }
            done.accept(true);
        } catch (IOException error) {
            try {
                int id = Integer.parseInt(request.getString("port").split(":")[0]);
                failed.add(id); releaseDevice(id); publish();
            }
            catch (JSONException invalid) { throw new IllegalStateException(invalid); }
            fail.accept(error.toString());
        } catch (JSONException | RuntimeException error) { fail.accept(error.toString()); }
    }

    private void releaseDevice(int id) {
        Iterator<Map.Entry<String, Closeable>> iterator = ports.entrySet().iterator();
        while (iterator.hasNext()) {
            Map.Entry<String, Closeable> entry = iterator.next();
            if (entry.getKey().startsWith(id + ":")) { close(entry.getValue()); iterator.remove(); }
        }
        MidiDevice device = devices.remove(id), link = links.remove(id);
        close(device);
        if (link != device) close(link);
        removed.accept(id);
    }

    private void close(Closeable resource) {
        if (resource == null) return;
        try (resource) {
            if (resource instanceof MidiInputPort) {
                MidiInputPort output = (MidiInputPort) resource;
                output.flush();
                for (int channel = 0; channel < 16; channel++) output.send(new byte[]{(byte) (0xb0 | channel), 64, 0, (byte) (0xb0 | channel), 123, 0, (byte) (0xb0 | channel), 120, 0}, 0, 9);
            }
        }
        catch (IOException error) {
            try { emit.accept(new JSONObject().put("kind", "error").put("error", error.toString())); }
            catch (JSONException invalid) { throw new IllegalStateException(invalid); }
        }
    }

    void setActive(boolean value) {
        queue.post(() -> {
            active = value;
            if (!value) { generation++; for (int id : new ArrayList<>(devices.keySet())) releaseDevice(id); for (int id : new ArrayList<>(links.keySet())) releaseDevice(id); }
            publish();
        });
    }
    void destroy() {
        if (manager != null) manager.unregisterDeviceCallback(callback);
        queue.post(() -> {
            active = false; terminating = true; generation++; attempts.shutdown();
            for (int id : new ArrayList<>(devices.keySet())) releaseDevice(id);
            for (int id : new ArrayList<>(links.keySet())) releaseDevice(id);
            quitIfIdle();
            if (!attempts.idle()) queue.postDelayed(thread::quitSafely, 30000);   // an open that never answers must not keep the thread forever
        });
    }
}
