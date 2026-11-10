package org.keylight.piano;

import android.app.Activity;
import android.content.*;
import android.hardware.usb.*;
import android.net.Uri;
import android.os.Build;
import android.widget.Toast;
import org.json.*;
import java.util.*;

/**
 * The small bridge operations that are not MIDI or export: the "Support my device" USB read, opening an allow-listed
 * link, and copying text. Every request is validated here again, whatever the page already checked.
 */
final class HostTools {
    private static final int MAX_DEVICES = 12, MAX_TEXT = 80, MAX_CLIPBOARD = 100_000;
    private final Activity activity;

    HostTools(Activity activity) { this.activity = activity; }

    static boolean handles(String op) { return op.equals("deviceUsb") || op.equals("openLink") || op.equals("clipboard"); }

    /** Runs on the UI thread. */
    Object request(JSONObject request) throws JSONException {
        switch (request.getString("op")) {
            case "deviceUsb": return deviceUsb();
            case "openLink": return openLink(request.get("url"));
            case "clipboard": return copy(request.get("text"));
            default: throw new IllegalArgumentException("Unknown operation");
        }
    }

    private Object openLink(Object value) {
        if (!(value instanceof String) || !LinkPolicy.allowed((String) value)) throw new IllegalArgumentException("Link not allowed");
        try { activity.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse((String) value)).addCategory(Intent.CATEGORY_BROWSABLE)); return true; }
        catch (ActivityNotFoundException error) { Toast.makeText(activity, "No browser available", Toast.LENGTH_LONG).show(); return false; }
    }

    private Object copy(Object value) {
        if (!(value instanceof String) || ((String) value).length() > MAX_CLIPBOARD) throw new IllegalArgumentException("Invalid text");
        ClipboardManager manager = activity.getSystemService(ClipboardManager.class);
        if (manager == null) throw new IllegalArgumentException("Clipboard unavailable");
        manager.setPrimaryClip(ClipData.newPlainText("Keylight", (String) value));
        return true;
    }

    private static String hex4(int value) { return String.format(Locale.ROOT, "0x%04x", value & 0xffff); }
    private static String text(String value) {
        if (value == null) return "";
        String clean = value.replaceAll("[\\p{Cntrl}]", " ").trim();
        return clean.length() > MAX_TEXT ? clean.substring(0, MAX_TEXT) : clean;
    }
    private static String className(int usbClass) {
        switch (usbClass) { case UsbConstants.USB_CLASS_AUDIO: return "audio"; case UsbConstants.USB_CLASS_HID: return "hid";
            case UsbConstants.USB_CLASS_HUB: return "hub"; case UsbConstants.USB_CLASS_MASS_STORAGE: return "storage"; default: return ""; }
    }

    /**
     * What Android lists for each attached USB device without asking for permission: vendor and product id, the
     * class triple and, only if the system hands them over unasked, the product name and maker. Never the serial
     * number (getSerialNumber is not called), never the device path (it names the port the cable is in).
     */
    private JSONObject deviceUsb() throws JSONException {
        JSONObject os = new JSONObject().put("platform", "android").put("release", Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + ")")
                .put("arch", Build.SUPPORTED_ABIS.length > 0 ? Build.SUPPORTED_ABIS[0] : "");
        JSONObject result = new JSONObject().put("ok", false).put("devices", new JSONArray()).put("source", "").put("reason", "not available")
                .put("os", os).put("redact", new JSONArray());
        UsbManager manager = activity.getSystemService(UsbManager.class);
        if (manager == null) return result;
        try {
            List<UsbDevice> found = new ArrayList<>(manager.getDeviceList().values());
            JSONArray devices = new JSONArray();
            Set<String> seen = new HashSet<>();
            for (UsbDevice device : found) {
                boolean music = device.getDeviceClass() == UsbConstants.USB_CLASS_AUDIO;
                for (int i = 0; i < device.getInterfaceCount() && !music; i++) {
                    UsbInterface face = device.getInterface(i);
                    music = face.getInterfaceClass() == UsbConstants.USB_CLASS_AUDIO && face.getInterfaceSubclass() == 3;   // MIDI streaming
                }
                if (!music || device.getVendorId() == 0 || device.getProductId() == 0) continue;
                String product = "", maker = "", version = "";
                try { product = text(device.getProductName()); maker = text(device.getManufacturerName()); } catch (SecurityException denied) { /* not given without permission */ }
                try { version = Build.VERSION.SDK_INT >= 23 ? text(device.getVersion()) : ""; } catch (SecurityException denied) { /* same */ }
                if (!version.matches("\\d{1,3}\\.\\d{1,3}")) version = "";
                String key = device.getVendorId() + ":" + device.getProductId();
                if (!seen.add(key) || devices.length() >= MAX_DEVICES) continue;
                devices.put(new JSONObject().put("vendorId", hex4(device.getVendorId())).put("productId", hex4(device.getProductId()))
                        .put("product", product).put("manufacturer", maker).put("bcdDevice", version).put("class", "audio")
                        .put("subclass", device.getDeviceSubclass()).put("protocol", device.getDeviceProtocol()));
            }
            return result.put("ok", true).put("devices", devices).put("source", "UsbManager").put("reason", "");
        } catch (RuntimeException error) { return result; }
    }
}
