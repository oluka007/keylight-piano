package org.keylight.piano;

import android.app.Activity;
import android.content.*;
import android.net.Uri;
import android.os.Handler;
import android.os.ParcelFileDescriptor;
import android.os.Looper;
import android.util.Base64;
import android.widget.Toast;
import org.json.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.ExecutorService;

final class ExportStore {
    private static final long LIMIT = 256L * 1024 * 1024;
    private final Activity activity;
    private final ExecutorService io;
    private final Map<String, Transfer> transfers = new HashMap<>();
    private final ArrayDeque<Transfer> ready = new ArrayDeque<>();
    static final String STATE_KEY = "keylight.exports";
    private static final String STAGING = "keylight-export-";
    private static final java.util.regex.Pattern STAGED = java.util.regex.Pattern.compile("keylight-export-[0-9A-Za-z_-]+\\.part");
    private Transfer choosing;
    private final Set<String> copyingFiles = new HashSet<>();
    private static final class Transfer {
        final File file;
        final String name, mime;
        final long size;
        final OutputStream stream;
        long written;
        boolean finished, copying;
        /** A staged file that survived an Activity recreation: complete, nothing more is written to it. */
        Transfer(File file, String name, String mime, long size) { this.file = file; this.name = name; this.mime = mime; this.size = size; this.written = size; this.finished = true; this.stream = null; }
        static boolean validMeta(String name, String mime, long size) {
            return name.matches("[A-Za-z0-9][A-Za-z0-9._ -]{0,127}") && mime.matches("[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+") && size >= 0 && size <= LIMIT;
        }
        Transfer(Activity activity, JSONObject request) throws IOException, JSONException {
            name = request.getString("name"); mime = request.getString("mime"); size = request.getLong("size");
            if (!validMeta(name, mime, size))
                throw new IllegalArgumentException("Invalid export metadata or 256 MiB limit exceeded");
            file = File.createTempFile(STAGING, ".part", activity.getCacheDir());
            stream = new FileOutputStream(file);
        }
    }

    /**
     * saved is the string from saveState() of the previous Activity instance (null on a fresh start). Staged files it names are kept
     * so a result that arrives after "Don't keep activities" can still be written; every other staging file is stale and deleted.
     */
    ExportStore(Activity activity, ExecutorService io, String saved) {
        this.activity = activity; this.io = io;
        restore(saved);
        io.execute(this::deleteStale);
        if (choosing == null && !ready.isEmpty()) new Handler(Looper.getMainLooper()).post(this::chooseNext);
    }

    /** Pending exports (the one the picker is open for and the queued ones) as a small string for onSaveInstanceState. */
    String saveState() {
        JSONArray list = new JSONArray();
        try {
            List<Transfer> pending = new ArrayList<>();
            if (choosing != null) pending.add(choosing);
            pending.addAll(ready);
            synchronized (this) { for (Transfer transfer : transfers.values()) if (transfer.copying && !pending.contains(transfer)) pending.add(transfer); }
            for (Transfer transfer : pending) {
                if (!transfer.finished) continue;
                list.put(new JSONObject().put("file", transfer.file.getName()).put("name", transfer.name).put("mime", transfer.mime)
                        .put("size", transfer.size).put("choosing", transfer == choosing).put("copying", transfer.copying));
            }
        } catch (JSONException error) { throw new IllegalStateException(error); }
        return list.length() == 0 ? null : list.toString();
    }

    private void restore(String saved) {
        if (saved == null || saved.length() > 65536) return;
        File cache = activity.getCacheDir();
        try {
            JSONArray list = new JSONArray(saved);
            for (int i = 0; i < list.length() && i < 8; i++) {
                JSONObject entry = list.getJSONObject(i);
                String fileName = entry.getString("file"), name = entry.getString("name"), mime = entry.getString("mime"); long size = entry.getLong("size");
                if (!STAGED.matcher(fileName).matches() || !Transfer.validMeta(name, mime, size)) continue;
                File file = new File(cache, fileName);
                if (!file.isFile() || file.length() != size) continue;
                // A copy that the previous instance is still running owns its file until it finishes; this instance only protects it.
                if (entry.optBoolean("copying")) { copyingFiles.add(fileName); continue; }
                Transfer transfer = new Transfer(file, name, mime, size);
                transfers.put(UUID.randomUUID().toString(), transfer);
                if (entry.optBoolean("choosing") && choosing == null) choosing = transfer; else ready.add(transfer);
            }
        } catch (JSONException invalid) { android.util.Log.w("Keylight", "Ignored unreadable export state"); }
    }

    /** Staging files nobody owns and nobody touched for a while (a dead process, an old crash) are deleted (io thread). */
    private synchronized void deleteStale() {
        File[] files = activity.getCacheDir().listFiles();
        if (files == null) return;
        Set<String> owned = new HashSet<>(copyingFiles);
        for (Transfer transfer : transfers.values()) owned.add(transfer.file.getName());
        long now = System.currentTimeMillis();
        for (File file : files) if (StagingPolicy.shouldDelete(file.getName(), file.lastModified(), now, owned)) file.delete();
    }

    synchronized Object request(JSONObject request) throws IOException, JSONException {
        String op = request.getString("op");
        if (op.equals("exportBegin")) {
            if (transfers.size() >= 4) throw new IllegalArgumentException("Finish or cancel pending exports first");
            String token = UUID.randomUUID().toString(); transfers.put(token, new Transfer(activity, request)); return token;
        }
        String token = request.getString("token");
        Transfer transfer = transfers.get(token);
        if (transfer == null) throw new IllegalArgumentException("Unknown export");
        if (transfer.finished && !op.equals("exportAbort")) throw new IllegalArgumentException("Export already staged");
        switch (op) {
            case "exportChunk":
                String encoded = request.getString("data");
                if (encoded.length() > 43692) throw new IllegalArgumentException("Chunk limit 32 KiB");
                byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
                if (bytes.length > 32768 || transfer.written + bytes.length > transfer.size) throw new IllegalArgumentException("Export size mismatch");
                transfer.stream.write(bytes); transfer.written += bytes.length; return true;
            case "exportFinish":
                if (transfer.written != transfer.size) throw new IllegalArgumentException("Incomplete export");
                if (transfer.stream != null) transfer.stream.close();
                transfer.finished = true;
                activity.runOnUiThread(() -> { ready.add(transfer); chooseNext(); }); return true;
            case "exportAbort":
                if (transfer.stream != null) transfer.stream.close(); discard(transfer); return true;
            default: throw new IllegalArgumentException("Unknown export operation");
        }
    }

    private void chooseNext() {
        if (choosing != null || ready.isEmpty()) return;
        choosing = ready.remove();
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                .setType(choosing.mime).putExtra(Intent.EXTRA_TITLE, choosing.name);
        try { activity.startActivityForResult(intent, 51); }
        catch (ActivityNotFoundException error) {
            Transfer failed = choosing; choosing = null;
            io.execute(() -> discard(failed)); Toast.makeText(activity, "No file provider available", Toast.LENGTH_LONG).show(); chooseNext();
        }
    }

    void result(int result, Intent data) {
        Transfer transfer = choosing; choosing = null;
        if (transfer == null) return;      // nothing pending: an unexpected result is ignored, never acted on
        Uri uri = result == Activity.RESULT_OK && data != null ? data.getData() : null;
        int flags = data == null ? 0 : data.getFlags();
        if (uri != null) transfer.copying = true;      // saveState keeps naming this file until the copy is done
        io.execute(() -> {
            try {
                if (uri != null) {
                    // Only a content:// URI of another app, granted by the picker's own result for this request. The descriptor is
                    // opened once, inspected, and used for the copy; the URI is never reopened.
                    try (ParcelFileDescriptor fd = PickerUris.open(activity, uri, true, flags)) {
                        if (fd == null) throw new IOException("Unexpected save location refused");
                        try (InputStream input = new FileInputStream(transfer.file);
                             FileOutputStream output = new FileOutputStream(fd.getFileDescriptor())) {
                            if (PickerUris.isRegular(fd)) output.getChannel().truncate(0);
                            byte[] buffer = new byte[32768]; int count;
                            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                        }
                    }
                    activity.runOnUiThread(() -> Toast.makeText(activity, "Saved " + transfer.name, Toast.LENGTH_LONG).show());
                }
            } catch (IOException | SecurityException | IllegalArgumentException error) {
                activity.runOnUiThread(() -> Toast.makeText(activity, "Export failed: " + error.getMessage(), Toast.LENGTH_LONG).show());
            } finally { discard(transfer); }
        });
        chooseNext();
    }

    private synchronized void discard(Transfer transfer) {
        transfers.values().remove(transfer);
        if (transfer.file.exists() && !transfer.file.delete()) transfer.file.deleteOnExit();
    }
    /** finishing=false (the system is recreating the Activity): staged files that wait for a picker result are kept. */
    synchronized void destroy(boolean finishing) throws IOException {
        for (Transfer transfer : new ArrayList<>(transfers.values())) {
            if (!finishing && transfer.finished) continue;
            if (transfer.stream != null) transfer.stream.close();
            discard(transfer);
        }
    }
}
