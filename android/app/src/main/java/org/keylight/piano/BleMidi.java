package org.keylight.piano;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.bluetooth.*;
import android.bluetooth.le.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.media.midi.*;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import org.json.*;
import java.util.*;
import java.util.function.Consumer;
import java.util.regex.Pattern;

/**
 * Bluetooth LE MIDI: scan, connect and hand the opened MidiDevice to MidiTransport, so JS sees the
 * keyboard through the same ports as a USB one. Everything runs on MidiTransport's Handler thread;
 * only permission and enable prompts touch the UI thread. Results reach JS as events
 * (bleState, bleDevice, bleScanEnd, bleError); requests return at once.
 */
final class BleMidi {
    static final int REQ_PERMISSION = 61, REQ_ENABLE = 62;
    static final UUID SERVICE = UUID.fromString("03B80E5A-EDE8-4B33-A751-6CE34EC4C700");
    private static final Pattern ADDRESS = Pattern.compile("^([0-9A-F]{2}:){5}[0-9A-F]{2}$");
    private static final long SCAN_MS = 15000, CONNECT_MS = 20000;
    private static final int SCANS_PER_30S = 4;      // Android silently ignores the sixth scan start in 30 seconds
    private static final int CONNECTS_PER_30S = 6, REQUESTS_PER_10S = 40, MAX_DEVICES = 64;

    private final Activity activity;
    private final MidiManager manager;
    private final BluetoothAdapter adapter;
    private final MidiTransport transport;
    private final Handler queue;
    private final Consumer<JSONObject> emit;
    private final boolean supported;
    private final Deque<Long> scanStarts = new ArrayDeque<>(), connectStarts = new ArrayDeque<>(), requests = new ArrayDeque<>();
    private final Set<String> seen = new HashSet<>();
    private ScanCallback scan;
    private Runnable scanTimeout, connectTimeout;
    private String connecting, connectedAddress, connectedName;
    private int connectedId = -1;
    private long token;
    private boolean asked, enablePending, permissionPending, destroyed;
    private final BroadcastReceiver adapterState = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            queue.post(() -> {
                if (adapter == null || adapter.isEnabled()) { push(); return; }
                if (scan != null) stopScan("bluetooth-off");
                connecting = null; token++; transport.attempts().cancel(); clearTimeout();
                push();
            });
        }
    };

    BleMidi(Activity activity, MidiTransport transport, Consumer<JSONObject> emit) {
        this.activity = activity; this.transport = transport; this.emit = emit; this.queue = transport.handler();
        PackageManager pm = activity.getPackageManager();
        BluetoothManager bluetooth = activity.getSystemService(BluetoothManager.class);
        adapter = bluetooth == null ? null : bluetooth.getAdapter();
        manager = pm.hasSystemFeature(PackageManager.FEATURE_MIDI) ? activity.getSystemService(MidiManager.class) : null;
        supported = adapter != null && manager != null && pm.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE);
        transport.onRemoved(id -> {
            if (id != connectedId) return;
            connectedAddress = null; connectedName = null; connectedId = -1; push();
        });
        if (supported) activity.registerReceiver(adapterState, new IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED));
    }

    static boolean validAddress(String address) { return address != null && ADDRESS.matcher(address).matches(); }

    private boolean granted(String permission) { return activity.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED; }
    private boolean canScan() { return Build.VERSION.SDK_INT >= 31 ? granted(Manifest.permission.BLUETOOTH_SCAN) : granted(Manifest.permission.ACCESS_FINE_LOCATION); }
    private boolean canConnect() { return Build.VERSION.SDK_INT < 31 || granted(Manifest.permission.BLUETOOTH_CONNECT); }
    private String[] missing() {
        List<String> list = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= 31) {
            if (!granted(Manifest.permission.BLUETOOTH_SCAN)) list.add(Manifest.permission.BLUETOOTH_SCAN);
            if (!granted(Manifest.permission.BLUETOOTH_CONNECT)) list.add(Manifest.permission.BLUETOOTH_CONNECT);
        } else if (!granted(Manifest.permission.ACCESS_FINE_LOCATION)) list.add(Manifest.permission.ACCESS_FINE_LOCATION);
        return list.toArray(new String[0]);
    }
    private boolean locationOn() {
        if (Build.VERSION.SDK_INT >= 31) return true;      // scanning there does not depend on location
        LocationManager location = activity.getSystemService(LocationManager.class);
        if (location == null) return false;
        if (Build.VERSION.SDK_INT >= 28) return location.isLocationEnabled();
        return location.isProviderEnabled(LocationManager.GPS_PROVIDER) || location.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
    }
    private boolean enabled() { return adapter != null && adapter.isEnabled(); }

    private String permissionState() {
        String[] need = missing();
        if (need.length == 0) return "granted";
        if (!asked) return "needed";
        for (String permission : need) if (activity.shouldShowRequestPermissionRationale(permission)) return "needed";
        return "blocked";      // asked, denied, and Android will no longer show the prompt: Settings is the only way
    }

    @SuppressLint("MissingPermission")
    JSONObject state() {
        try {
            JSONObject state = new JSONObject().put("kind", "bleState").put("supported", supported);
            state.put("enabled", supported && enabled()).put("permission", permissionState()).put("locationOn", locationOn());
            state.put("scanning", scan != null).put("connecting", connecting == null ? JSONObject.NULL : connecting);
            state.put("connected", connectedAddress == null ? JSONObject.NULL
                    : new JSONObject().put("address", connectedAddress).put("name", connectedName));
            state.put("sdk", Build.VERSION.SDK_INT);
            return state;
        } catch (JSONException error) { throw new IllegalStateException(error); }
    }
    private void push() { if (!destroyed) emit.accept(state()); }
    private void fire(JSONObject event) { if (!destroyed) emit.accept(event); }
    private void error(String code, String message, String address, boolean auto) {
        try { fire(new JSONObject().put("kind", "bleError").put("code", code).put("message", message)
                .put("address", address == null ? JSONObject.NULL : address).put("auto", auto)); }
        catch (JSONException invalid) { throw new IllegalStateException(invalid); }
    }

    private boolean within(Deque<Long> times, int limit, long window) {
        long now = SystemClock.elapsedRealtime();
        while (!times.isEmpty() && now - times.peekFirst() > window) times.removeFirst();
        if (times.size() >= limit) return false;
        times.addLast(now); return true;
    }

    /** Entry point for every ble* request from JS. Arguments are validated here, nothing is trusted. */
    void request(JSONObject request, Consumer<Object> done, Consumer<String> fail) {
        queue.post(() -> {
            try {
                if (destroyed) { fail.accept("Bluetooth is closed"); return; }
                if (!within(requests, REQUESTS_PER_10S, 10000)) { fail.accept("Too many Bluetooth requests"); return; }
                switch (request.getString("op")) {
                    case "bleSupported": done.accept(supported); return;
                    case "bleState": done.accept(state()); return;
                    case "blePermission": requestPermission(); done.accept(state()); return;
                    case "bleEnable": requestEnable(); done.accept(state()); return;
                    case "bleOpenSettings": openSettings(); done.accept(true); return;
                    case "bleScanStart": done.accept(scanStart()); return;
                    case "bleScanStop": stopScan("stopped"); done.accept(true); return;
                    case "bleConnect": {
                        String address = request.optString("address", "");
                        if (!validAddress(address)) throw new IllegalArgumentException("Invalid Bluetooth address");
                        done.accept(connect(address, request.optBoolean("auto", false))); return;
                    }
                    case "bleDisconnect": disconnect(); done.accept(true); return;
                    default: throw new IllegalArgumentException("Unknown Bluetooth operation");
                }
            } catch (JSONException | RuntimeException invalid) { fail.accept(invalid.toString()); }
        });
    }

    private void requestPermission() {
        String[] need = missing();
        if (need.length == 0 || permissionPending) return;
        permissionPending = true; asked = true;
        activity.runOnUiThread(() -> { if (!destroyed) activity.requestPermissions(need, REQ_PERMISSION); });
    }
    void permissionResult() { queue.post(() -> { permissionPending = false; push(); }); }

    @SuppressLint("MissingPermission")
    private void requestEnable() {
        if (!supported || enabled() || enablePending) return;
        if (!canConnect()) { requestPermission(); return; }      // the enable prompt itself needs BLUETOOTH_CONNECT on Android 12+
        enablePending = true;
        activity.runOnUiThread(() -> {
            try { activity.startActivityForResult(new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE), REQ_ENABLE); }
            catch (ActivityNotFoundException | SecurityException failure) { queue.post(() -> { enablePending = false; push(); }); }
        });
    }
    void enableResult() { queue.post(() -> { enablePending = false; push(); }); }

    private void openSettings() {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", activity.getPackageName(), null));
        activity.runOnUiThread(() -> { try { activity.startActivity(intent); } catch (ActivityNotFoundException ignored) { } });
    }

    private JSONObject refusal(String code, String message) throws JSONException {
        return new JSONObject().put("ok", false).put("code", code).put("message", message);
    }

    @SuppressLint("MissingPermission")
    private Object scanStart() throws JSONException {
        if (!supported) return refusal("unsupported", "Bluetooth keyboards are not supported on this device");
        if (!enabled()) return refusal("bluetooth-off", "Bluetooth is off");
        if (!canScan()) return refusal("permission", "Bluetooth permission is needed");
        if (!locationOn()) return refusal("location-off", "Location is off, and this Android version needs it to find Bluetooth devices");
        if (scan != null) stopScan("restarted");
        BluetoothLeScanner scanner = adapter.getBluetoothLeScanner();
        if (scanner == null) return refusal("bluetooth-off", "Bluetooth is off");
        if (!within(scanStarts, SCANS_PER_30S, 30000)) return refusal("rate-limit", "Searched too often: wait half a minute and try again");
        seen.clear();
        ScanCallback callback = new ScanCallback() {
            @Override public void onScanResult(int type, ScanResult result) { queue.post(() -> found(this, result)); }
            @Override public void onBatchScanResults(List<ScanResult> results) { queue.post(() -> { for (ScanResult result : results) found(this, result); }); }
            @Override public void onScanFailed(int code) { queue.post(() -> { if (scan == this) { error("scan-failed", "Bluetooth search failed (" + code + ")", null, false); stopScan("error"); } }); }
        };
        try {
            scanner.startScan(Collections.singletonList(new ScanFilter.Builder().setServiceUuid(new ParcelUuid(SERVICE)).build()),
                    new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(), callback);
        } catch (IllegalStateException | SecurityException failure) { return refusal("scan-failed", "Bluetooth search could not start"); }
        scan = callback;
        scanTimeout = () -> stopScan("timeout");
        queue.postDelayed(scanTimeout, SCAN_MS);
        listKnown();
        push();
        return new JSONObject().put("ok", true);
    }

    @SuppressLint("MissingPermission")
    private void found(ScanCallback source, ScanResult result) {
        if (source != scan || result == null || seen.size() >= MAX_DEVICES) return;
        BluetoothDevice device = result.getDevice();
        String address = device.getAddress();
        if (!validAddress(address) || !seen.add(address)) return;
        String name = result.getScanRecord() == null ? null : result.getScanRecord().getDeviceName();
        if (name == null && canConnect()) name = device.getName();
        report(address, name, result.getRssi(), canConnect() && device.getBondState() == BluetoothDevice.BOND_BONDED, false);
    }

    /** Keyboards Android already knows: paired ones that advertise the MIDI service, and ones another app has open. */
    @SuppressLint({"MissingPermission", "NewApi"})
    private void listKnown() {
        if (!canConnect()) return;
        Set<BluetoothDevice> bonded = adapter.getBondedDevices();
        if (bonded != null) for (BluetoothDevice device : bonded) {
            android.os.ParcelUuid[] uuids = device.getUuids();
            if (uuids == null) continue;
            for (ParcelUuid uuid : uuids) if (SERVICE.equals(uuid.getUuid()) && seen.size() < MAX_DEVICES && seen.add(device.getAddress())) {
                report(device.getAddress(), device.getName(), null, true, false); break;
            }
        }
        for (MidiDeviceInfo info : manager.getDevices()) {
            if (info.getType() != MidiDeviceInfo.TYPE_BLUETOOTH || info.getId() == connectedId) continue;
            Object raw = info.getProperties().get(MidiDeviceInfo.PROPERTY_BLUETOOTH_DEVICE);
            if (!(raw instanceof BluetoothDevice) || !seen.add(((BluetoothDevice) raw).getAddress())) continue;
            report(((BluetoothDevice) raw).getAddress(), info.getProperties().getString(MidiDeviceInfo.PROPERTY_NAME), null, true, true);
        }
    }

    private void report(String address, String name, Integer rssi, boolean bonded, boolean open) {
        try {
            String clean = name == null ? "" : name.replaceAll("[\\p{Cntrl}]", "").trim();
            if (clean.length() > 60) clean = clean.substring(0, 60);
            fire(new JSONObject().put("kind", "bleDevice").put("address", address).put("name", clean.isEmpty() ? "Bluetooth keyboard" : clean)
                    .put("rssi", rssi == null ? JSONObject.NULL : rssi).put("bonded", bonded).put("open", open));
        } catch (JSONException invalid) { throw new IllegalStateException(invalid); }
    }

    @SuppressLint("MissingPermission")
    private void stopScan(String reason) {
        if (scanTimeout != null) { queue.removeCallbacks(scanTimeout); scanTimeout = null; }
        ScanCallback callback = scan;
        if (callback == null) return;
        scan = null;
        try {
            BluetoothLeScanner scanner = adapter == null ? null : adapter.getBluetoothLeScanner();
            if (scanner != null && canScan()) scanner.stopScan(callback);
        } catch (IllegalStateException | SecurityException ignored) { }
        try { fire(new JSONObject().put("kind", "bleScanEnd").put("reason", reason).put("count", seen.size())); }
        catch (JSONException invalid) { throw new IllegalStateException(invalid); }
        push();
    }

    private void clearTimeout() { if (connectTimeout != null) { queue.removeCallbacks(connectTimeout); connectTimeout = null; } }

    @SuppressLint("MissingPermission")
    private Object connect(String address, boolean auto) throws JSONException {
        if (!supported) return refusal("unsupported", "Bluetooth keyboards are not supported on this device");
        if (!enabled()) return refusal("bluetooth-off", "Bluetooth is off");
        if (!canConnect()) return refusal("permission", "Bluetooth permission is needed");
        if (address.equals(connectedAddress)) return new JSONObject().put("ok", true);
        if (address.equals(connecting)) return new JSONObject().put("ok", true);
        if (!within(connectStarts, CONNECTS_PER_30S, 30000)) return refusal("rate-limit", "Too many connection attempts: wait a moment");
        if (scan != null) stopScan("connecting");
        if (connectedAddress != null) disconnect();
        BluetoothDevice device;
        try { device = adapter.getRemoteDevice(address); } catch (IllegalArgumentException invalid) { return refusal("invalid", "Invalid Bluetooth address"); }
        final long mine = ++token;
        final AttemptTracker attempts = transport.attempts();
        final long attempt = attempts.begin();      // an earlier attempt that is still outstanding becomes stale; it is closed when it answers
        connecting = address;
        clearTimeout();
        connectTimeout = () -> {
            if (token != mine || connecting == null) return;
            connecting = null; token++; attempts.cancel();      // a device that arrives later is closed by its callback
            error("connect-timeout", "The keyboard did not answer. Switch it on, bring it close and try again", address, auto); push();
        };
        queue.postDelayed(connectTimeout, CONNECT_MS);
        try {
            // The result comes back on the main thread (which outlives the MIDI thread) and hops to the queue. If the queue has
            // already been shut down the late device is closed right there, so nothing opened is ever left open.
            manager.openBluetoothDevice(device, opened -> {
                if (!queue.post(() -> answered(attempt, mine, address, auto, opened))) { attempts.finish(attempt); closeQuietly(opened); }
            }, transport.mainHandler());
        } catch (SecurityException failure) {
            attempts.finish(attempt); clearTimeout(); connecting = null;
            return refusal("permission", "Bluetooth permission is needed");
        }
        push();
        return new JSONObject().put("ok", true);
    }

    private void answered(long attempt, long mine, String address, boolean auto, MidiDevice opened) {
        AttemptTracker attempts = transport.attempts();
        boolean adopt = attempts.finish(attempt) && !destroyed && token == mine;
        try {
            if (!adopt) { closeQuietly(opened); return; }      // stale, cancelled, timed out or shut down: never keep it
            clearTimeout(); connecting = null;
            if (opened == null) { error("connect-failed", "Could not connect. Check the keyboard is switched on and close by", address, auto); push(); return; }
            MidiDeviceInfo info = opened.getInfo();
            int openedId = info.getId();
            String name = info.getProperties().getString(MidiDeviceInfo.PROPERTY_NAME);
            String shown = name == null || name.trim().isEmpty() ? "Bluetooth keyboard" : name.replaceAll("[\\p{Cntrl}]", "").trim();
            if (!transport.adopt(opened)) { push(); return; }     // the app went to the background meanwhile: the link is already closed
            connectedAddress = address; connectedId = openedId; connectedName = shown;
            push();
        } finally { transport.attemptAnswered(); }
    }

    private void closeQuietly(MidiDevice device) { if (device != null) try { device.close(); } catch (java.io.IOException ignored) { } }

    private void disconnect() {
        token++; transport.attempts().cancel(); clearTimeout(); connecting = null;
        if (connectedId >= 0) transport.release(connectedId);
        connectedAddress = null; connectedName = null; connectedId = -1;
        push();
    }

    /** Activity left the foreground: searching stops at once (it drains the battery); the link closes with the MIDI ports. */
    void pause() { queue.post(() -> { if (scan != null) stopScan("paused"); }); }

    void destroy() {
        destroyed = true;
        if (supported) try { activity.unregisterReceiver(adapterState); } catch (IllegalArgumentException ignored) { }
        queue.post(() -> { stopScan("closed"); token++; transport.attempts().cancel(); clearTimeout(); connecting = null; });
    }
}
