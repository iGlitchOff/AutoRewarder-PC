package off.iglitch.autorewarder;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Collections;
import java.util.Enumeration;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import org.json.JSONObject;

public class AndroidJs {
    private final MainActivity activity;
    private final WebView webView;
    private final SharedPreferences prefs;
    private final ExecutorService io = Executors.newFixedThreadPool(4);
    private volatile boolean discovering = false;
    private final AtomicBoolean downloadCancel = new AtomicBoolean(false);

    public AndroidJs(MainActivity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        this.prefs = activity.getSharedPreferences("autorewarder", Context.MODE_PRIVATE);
        io.execute(this::pulseLoop);
    }

    private void pulseLoop() {
        while (!io.isShutdown()) {
            try {
                pulseMe();
            } catch (Exception ignored) {}
            try {
                Thread.sleep(60_000);
            } catch (InterruptedException e) {
                return;
            }
        }
    }

    private void pulseMe() {
        String raw = loadPairing();
        String token = jsonField(raw, "token");
        if (token.isEmpty()) return;
        String[] urls = new String[] { jsonField(raw, "lan"), jsonField(raw, "base") };
        for (String url : urls) {
            if (url == null || url.isEmpty()) continue;
            String base = url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
            String resp = http("GET", base + "/me", "", token);
            if (resp != null && resp.contains("\"ok\":true")) return;
        }
    }

    @JavascriptInterface
    public String deviceName() {
        String name = null;
        try {
            name = Settings.Global.getString(activity.getContentResolver(), Settings.Global.DEVICE_NAME);
        } catch (Exception ignored) {}
        if (name == null || name.trim().isEmpty()) {
            name = Build.MODEL;
        }
        return name;
    }

    @JavascriptInterface
    public String deviceModel() {
        return (Build.MANUFACTURER + " " + Build.MODEL).trim();
    }

    @JavascriptInterface
    public String androidId() {
        try {
            String id = Settings.Secure.getString(
                    activity.getContentResolver(), Settings.Secure.ANDROID_ID);
            return id == null ? "" : id;
        } catch (Exception e) {
            return "";
        }
    }

    @JavascriptInterface
    public int appVersionCode() {
        try {
            return activity.getPackageManager()
                    .getPackageInfo(activity.getPackageName(), 0).versionCode;
        } catch (Exception e) {
            return 0;
        }
    }

    @JavascriptInterface
    public String appVersionName() {
        try {
            return activity.getPackageManager()
                    .getPackageInfo(activity.getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "";
        }
    }

    @JavascriptInterface
    public String loadPairing() {
        String fromPrefs = prefs.getString("pair", "");
        if (fromPrefs != null && !fromPrefs.isEmpty()) return fromPrefs;
        String fromFile = readPairFile();
        if (fromFile != null && !fromFile.isEmpty()) {
            prefs.edit().putString("pair", fromFile).commit();
            return fromFile;
        }
        return "";
    }

    @JavascriptInterface
    public void savePairing(String json) {
        String raw = json == null ? "" : json;
        prefs.edit().putString("pair", raw).commit();
        writePairFile(raw);
    }

    @JavascriptInterface
    public void clearPairing() {
        prefs.edit().remove("pair").commit();
        File f = pairFile();
        if (f.exists()) {
            //noinspection ResultOfMethodCallIgnored
            f.delete();
        }
    }

    private File pairFile() {
        return new File(activity.getFilesDir(), "pair.json");
    }

    private String readPairFile() {
        File f = pairFile();
        if (!f.isFile()) return "";
        try (FileInputStream in = new FileInputStream(f)) {
            byte[] buf = new byte[(int) Math.min(f.length(), 32_000)];
            int n = in.read(buf);
            return n <= 0 ? "" : new String(buf, 0, n, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "";
        }
    }

    private void writePairFile(String raw) {
        File dest = pairFile();
        File tmp = new File(dest.getParentFile(), "pair.json.tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(raw.getBytes(StandardCharsets.UTF_8));
            out.getFD().sync();
        } catch (Exception ignored) {
            return;
        }
        if (dest.exists() && !dest.delete()) {
            tmp.delete();
            return;
        }
        if (!tmp.renameTo(dest)) {
            tmp.delete();
        }
    }

    @JavascriptInterface
    public void setUiLang(String lang) {
        String safe = (lang == null || lang.trim().isEmpty()) ? "en" : lang.trim().toLowerCase(Locale.US);
        prefs.edit().putString("ui_lang", safe).apply();
        activity.applyNativeLang(safe);
    }

    @JavascriptInterface
    public String getUiLang() {
        return prefs.getString("ui_lang", "");
    }

    @JavascriptInterface
    public void cancelDownloadUpdate() {
        downloadCancel.set(true);
    }

    @JavascriptInterface
    public void downloadUpdate(String url) {
        downloadUpdate(url, "");
    }

    @JavascriptInterface
    public void downloadUpdate(String url, String digest) {
        if (url == null || url.trim().isEmpty()) {
            activity.onUpdateFailed("No hay un APK para descargar.");
            return;
        }
        final String sourceUrl = url.trim();
        if (!allowedUpdateUrl(sourceUrl)) {
            activity.onUpdateFailed("La URL del APK no es HTTPS ni la LAN del PC.");
            return;
        }
        downloadCancel.set(false);
        final String wantDigest = digest == null ? "" : digest.trim();
        io.execute(() -> {
            File dir = new File(activity.getFilesDir(), "updates");
            if (!dir.exists() && !dir.mkdirs()) {
                activity.onUpdateFailed("No se pudo crear la carpeta de actualización.");
                return;
            }
            File apk = new File(dir, "AutoRewarder.apk");
            HttpURLConnection conn = null;
            try {
                if (!urlAllowed(sourceUrl)) {
                    activity.onUpdateFailed("La URL del APK no es HTTPS ni la LAN del PC.");
                    return;
                }
                conn = (HttpURLConnection) new URL(sourceUrl).openConnection();
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(120000);
                conn.setInstanceFollowRedirects(
                        "https".equalsIgnoreCase(new URL(sourceUrl).getProtocol()));
                conn.setRequestMethod("GET");
                conn.setRequestProperty("User-Agent", "AutoRewarder-Phone");
                int code = conn.getResponseCode();
                URL landed = conn.getURL();
                if (landed == null || !urlAllowed(landed.toString())) {
                    activity.onUpdateFailed("La URL del APK no es HTTPS ni la LAN del PC.");
                    return;
                }
                if (code >= 400) {
                    boolean github = sourceUrl.contains("github.com")
                            || sourceUrl.contains("githubusercontent.com");
                    String who = github ? "GitHub no sirvió el APK" : "El PC no sirvió el APK";
                    activity.onUpdateFailed(who + " (" + code + ").");
                    return;
                }
                long expected = conn.getContentLengthLong();
                if (expected > 0 && dir.getUsableSpace() < expected + 1024L * 1024L) {
                    activity.onUpdateFailed("No hay espacio suficiente para el APK.");
                    return;
                }
                long written = 0;
                int lastPct = -1;
                boolean cancelled = false;
                activity.onUpdateProgress(0);
                try (InputStream in = conn.getInputStream();
                     FileOutputStream out = new FileOutputStream(apk)) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        if (downloadCancel.get()) {
                            cancelled = true;
                            break;
                        }
                        written += n;
                        out.write(buf, 0, n);
                        if (expected > 0) {
                            int pct = (int) Math.min(99L, (written * 100L) / expected);
                            if (pct != lastPct) {
                                lastPct = pct;
                                activity.onUpdateProgress(pct);
                            }
                        }
                    }
                    if (!cancelled) out.getFD().sync();
                }
                if (cancelled) {
                    //noinspection ResultOfMethodCallIgnored
                    apk.delete();
                    activity.onUpdateFailed("Descarga cancelada.");
                    return;
                }
                if (expected > 0 && written != expected) {
                    //noinspection ResultOfMethodCallIgnored
                    apk.delete();
                    activity.onUpdateFailed("Descarga incompleta (" + written + "/" + expected + ").");
                    return;
                }
                if (written < 100 || !isZipApk(apk)) {
                    //noinspection ResultOfMethodCallIgnored
                    apk.delete();
                    activity.onUpdateFailed("El archivo descargado no es un APK válido.");
                    return;
                }
                if (!wantDigest.isEmpty() && !digestMatches(apk, wantDigest)) {
                    //noinspection ResultOfMethodCallIgnored
                    apk.delete();
                    activity.onUpdateFailed("El checksum del APK no coincide.");
                    return;
                }
                String why = apkNotInstallable(apk);
                if (why != null) {
                    //noinspection ResultOfMethodCallIgnored
                    apk.delete();
                    activity.onUpdateFailed(why);
                    return;
                }
                activity.onUpdateProgress(100);
                activity.installApk(apk);
            } catch (Exception e) {
                //noinspection ResultOfMethodCallIgnored
                apk.delete();
                String msg = e.getMessage() == null ? "error" : e.getMessage();
                activity.onUpdateFailed("Descarga falló: " + msg);
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }

    private static boolean allowedUpdateUrl(String url) {
        return urlAllowed(url);
    }

    /**
     * Cleartext only on LAN. Android domain-config cannot express RFC1918,
     * so every HttpURLConnection helper rejects http unless the host is
     * loopback (127.0.0.0/8, ::1, localhost), private (10/8, 172.16/12,
     * 192.168/16), link-local (169.254/16), or an mDNS .local name.
     * HTTPS to Bing, Rewards, and GitHub stays allowed.
     */
    static boolean urlAllowed(String url) {
        if (url == null || url.isEmpty()) return false;
        try {
            URL parsed = new URL(url);
            String proto = parsed.getProtocol();
            if (proto == null) return false;
            if ("https".equalsIgnoreCase(proto)) return true;
            if (!"http".equalsIgnoreCase(proto)) return false;
            return cleartextHostAllowed(parsed.getHost());
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean cleartextHostAllowed(String host) {
        if (host == null) return false;
        host = host.trim().toLowerCase(Locale.US);
        if (host.startsWith("[") && host.endsWith("]") && host.length() > 2) {
            host = host.substring(1, host.length() - 1).trim();
        }
        while (host.endsWith(".") && host.length() > 1) {
            host = host.substring(0, host.length() - 1);
        }
        if (host.isEmpty()) return false;
        if ("localhost".equals(host) || "::1".equals(host)) return true;
        if (host.endsWith(".local") && host.length() > ".local".length() && host.charAt(0) != '.') {
            return true;
        }
        int[] v4 = parseIpv4(host);
        if (v4 == null) return false;
        int a = v4[0];
        int b = v4[1];
        if (a == 127 || a == 10) return true;
        if (a == 172 && b >= 16 && b <= 31) return true;
        if (a == 192 && b == 168) return true;
        if (a == 169 && b == 254) return true;
        return false;
    }

    private static int[] parseIpv4(String host) {
        String[] parts = host.split("\\.", -1);
        if (parts.length != 4) return null;
        int[] out = new int[4];
        for (int i = 0; i < 4; i++) {
            String part = parts[i];
            if (part.isEmpty() || part.length() > 3) return null;
            for (int c = 0; c < part.length(); c++) {
                char ch = part.charAt(c);
                if (ch < '0' || ch > '9') return null;
            }
            try {
                out[i] = Integer.parseInt(part);
            } catch (NumberFormatException e) {
                return null;
            }
            if (out[i] > 255) return null;
        }
        return out;
    }

    private static boolean digestMatches(File apk, String spec) {
        try {
            String want = spec.trim();
            String algo = "SHA-256";
            String hex = want;
            int colon = want.indexOf(':');
            if (colon > 0) {
                String name = want.substring(0, colon);
                hex = want.substring(colon + 1);
                if (name.equalsIgnoreCase("sha256")) algo = "SHA-256";
                else if (name.equalsIgnoreCase("sha1")) algo = "SHA-1";
            }
            MessageDigest md = MessageDigest.getInstance(algo);
            try (FileInputStream in = new FileInputStream(apk)) {
                byte[] buf = new byte[64 * 1024];
                int n;
                while ((n = in.read(buf)) > 0) md.update(buf, 0, n);
            }
            StringBuilder got = new StringBuilder();
            for (byte b : md.digest()) got.append(String.format("%02x", b));
            return got.toString().equalsIgnoreCase(hex);
        } catch (Exception e) {
            return false;
        }
    }

    private String apkNotInstallable(File apk) {
        try {
            PackageManager pm = activity.getPackageManager();
            String path = apk.getAbsolutePath();
            PackageInfo archive = pm.getPackageArchiveInfo(path, 0);
            if (archive == null || archive.packageName == null) {
                return "El APK no se puede leer.";
            }
            if (archive.applicationInfo != null) {
                archive.applicationInfo.sourceDir = path;
                archive.applicationInfo.publicSourceDir = path;
            }
            if (!archive.packageName.equals(activity.getPackageName())) {
                return "El APK no es AutoRewarder.";
            }
            long mine = appVersionCode();
            long theirs = Build.VERSION.SDK_INT >= 28
                    ? archive.getLongVersionCode()
                    : archive.versionCode;
            if (theirs <= mine) {
                return "Ese APK no es más nuevo que el instalado.";
            }
            PackageInfo installed = pm.getPackageInfo(
                    activity.getPackageName(), PackageManager.GET_SIGNATURES);
            PackageInfo signed = pm.getPackageArchiveInfo(
                    path, PackageManager.GET_SIGNATURES);
            if (!sameSigner(installed, signed)) {
                return "La firma del APK no coincide con la app instalada.";
            }
            return null;
        } catch (Exception e) {
            return "No se pudo verificar el APK.";
        }
    }

    private static boolean sameSigner(PackageInfo installed, PackageInfo archive) {
        Signature[] a = signaturesOf(installed);
        Signature[] b = signaturesOf(archive);
        if (a == null || b == null || a.length == 0 || b.length == 0) return false;
        for (Signature left : a) {
            for (Signature right : b) {
                if (left != null && left.equals(right)) return true;
            }
        }
        return false;
    }

    private static Signature[] signaturesOf(PackageInfo info) {
        if (info == null) return null;
        if (Build.VERSION.SDK_INT >= 28 && info.signingInfo != null) {
            if (info.signingInfo.hasMultipleSigners()) {
                return info.signingInfo.getApkContentsSigners();
            }
            return info.signingInfo.getSigningCertificateHistory();
        }
        return info.signatures;
    }

    private static boolean isZipApk(File apk) {
        try (FileInputStream in = new FileInputStream(apk)) {
            byte[] mag = new byte[4];
            if (in.read(mag) != 4) return false;
            return mag[0] == 0x50 && mag[1] == 0x4B
                    && (mag[2] == 0x03 || mag[2] == 0x05 || mag[2] == 0x07);
        } catch (Exception e) {
            return false;
        }
    }

    @JavascriptInterface
    public void discover() {
        if (discovering) return;
        discovering = true;
        io.execute(this::listenBeacon);
    }

    @JavascriptInterface
    public void scanLan() {
        io.execute(this::probeLan);
    }

    @JavascriptInterface
    public boolean hasBing() {
        return BingLauncher.isInstalled(activity);
    }

    /** "missing", "disabled", or "installed". Disabled is not installed. */
    @JavascriptInterface
    public String bingPackageState() {
        int state = BingLauncher.packageState(activity);
        if (state == BingLauncher.DISABLED) return "disabled";
        if (state == BingLauncher.INSTALLED) return "installed";
        return "missing";
    }

    @JavascriptInterface
    public boolean openRewardsLogin() {
        activity.openRewardsLogin();
        return true;
    }

    @JavascriptInterface
    public void probeBingSession() {
        activity.probeBingSession();
    }

    @JavascriptInterface
    public boolean installBing() {
        return BingLauncher.install(activity);
    }

    @JavascriptInterface
    public void setMarket(String market) {
        BingMarket.set(market);
    }

    @JavascriptInterface
    public boolean openBingApp(String kind) {
        return BingLauncher.open(activity, kind);
    }

    @JavascriptInterface
    public boolean openBing(String kind) {
        if (BingLauncher.isInstalled(activity) && BingLauncher.open(activity, kind)) {
            return true;
        }
        activity.startBingTask(kind);
        return true;
    }

    @JavascriptInterface
    public void runTask(String kind) {
        activity.startBingTask(kind);
    }

    @JavascriptInterface
    public void keepDiscovering() {
        if (discovering) return;
        discovering = true;
        io.execute(this::listenBeacon);
    }

    @JavascriptInterface
    public void scanQr() {
        activity.startQrScan();
    }

    @JavascriptInterface
    public void httpAsync(String reqId, String method, String url, String body, String token) {
        final String safeId = reqId == null ? "" : reqId;
        io.execute(() -> {
            String resp = http(method, url, body, token);
            final String jsCall = "window.__onHttpAsync && __onHttpAsync("
                    + JSONObject.quote(safeId) + ","
                    + JSONObject.quote(resp == null ? "" : resp) + ")";
            activity.runOnUiThread(() -> {
                try {
                    if (webView != null) {
                        webView.evaluateJavascript(jsCall, null);
                    }
                } catch (Exception ignored) {}
            });
        });
    }

    @JavascriptInterface
    public String http(String method, String url, String body, String token) {
        if (!urlAllowed(url)) {
            return "{\"ok\":false,\"error\":\"cleartext_blocked\"}";
        }
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            // A stale LAN address is common when the phone moves to mobile
            // data. Fail it quickly so the saved public URL can be tried
            // instead of freezing every WebView request for 23 seconds.
            URL parsedUrl = new URL(url);
            boolean privateHttp = "http".equalsIgnoreCase(parsedUrl.getProtocol())
                    && cleartextHostAllowed(parsedUrl.getHost());
            conn.setConnectTimeout(privateHttp ? 900 : 5000);
            conn.setReadTimeout(privateHttp ? 1800 : 8000);
            conn.setInstanceFollowRedirects("https".equalsIgnoreCase(new URL(url).getProtocol()));
            conn.setRequestMethod(method == null ? "GET" : method.toUpperCase());
            boolean github = url != null && url.contains("api.github.com");
            conn.setRequestProperty(
                    "Accept",
                    github ? "application/vnd.github+json" : "application/json");
            conn.setRequestProperty("User-Agent", "AutoRewarder-Phone");
            if (token != null && !token.isEmpty()) {
                conn.setRequestProperty("Authorization", "Bearer " + token);
            }
            if (body != null && !body.isEmpty() && !"GET".equalsIgnoreCase(method)) {
                byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                conn.setRequestProperty("Content-Length", String.valueOf(bytes.length));
                OutputStream os = conn.getOutputStream();
                os.write(bytes);
                os.close();
            }
            int code = conn.getResponseCode();
            URL landed = conn.getURL();
            if (landed == null || !urlAllowed(landed.toString())) {
                return "{\"ok\":false,\"error\":\"cleartext_blocked\"}";
            }
            InputStream in = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
            if (in == null) in = conn.getInputStream();
            String text = readStream(in);
            if (text == null || text.isEmpty()) {
                return "{\"ok\":false,\"status\":" + code + ",\"error\":\"empty\"}";
            }
            try {
                JSONObject obj = new JSONObject(text);
                if (!obj.has("status")) obj.put("status", code);
                return obj.toString();
            } catch (Exception ignore) {
                return text;
            }
        } catch (Exception e) {
            String msg = e.getMessage() == null ? "error" : e.getMessage().replace("\"", "'");
            return "{\"ok\":false,\"error\":\"" + msg + "\"}";
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static String readStream(InputStream in) {
        if (in == null) return "";
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) sb.append(line);
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }

    void sendUnlinkBestEffort() {
        String raw = loadPairing();
        if (raw == null || raw.isEmpty()) return;
        String token = jsonField(raw, "token");
        if (token.isEmpty()) return;
        String[] urls = new String[] { jsonField(raw, "lan"), jsonField(raw, "base") };
        for (String url : urls) {
            if (url == null || url.isEmpty()) continue;
            String base = url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
            String resp = http("POST", base + "/phone/unlink", "{}", token);
            if (resp != null && resp.contains("\"ok\":true")) return;
        }
    }

    private static String jsonField(String json, String key) {
        if (json == null || key == null) return "";
        String needle = "\"" + key + "\"";
        int at = json.indexOf(needle);
        if (at < 0) return "";
        int colon = json.indexOf(':', at + needle.length());
        if (colon < 0) return "";
        int i = colon + 1;
        while (i < json.length() && Character.isWhitespace(json.charAt(i))) i++;
        if (i >= json.length() || json.charAt(i) != '"') return "";
        i++;
        StringBuilder sb = new StringBuilder();
        while (i < json.length()) {
            char c = json.charAt(i++);
            if (c == '\\' && i < json.length()) {
                sb.append(json.charAt(i++));
                continue;
            }
            if (c == '"') break;
            sb.append(c);
        }
        return sb.toString();
    }

    void shutdown() {
        discovering = false;
        io.shutdownNow();
    }

    private void listenBeacon() {
        WifiManager wifi = (WifiManager) activity.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        WifiManager.MulticastLock lock = null;
        if (wifi != null) {
            lock = wifi.createMulticastLock("autorewarder-beacon");
            lock.setReferenceCounted(true);
            try { lock.acquire(); } catch (Exception ignored) {}
        }
        DatagramSocket socket = null;
        try {
            while (discovering && socket == null) {
                try {
                    DatagramSocket candidate = new DatagramSocket(null);
                    candidate.setReuseAddress(true);
                    candidate.bind(new InetSocketAddress(38472));
                    candidate.setBroadcast(true);
                    candidate.setSoTimeout(1500);
                    socket = candidate;
                } catch (Exception bindErr) {
                    android.util.Log.w("AutoRewarder", "beacon bind failed", bindErr);
                    try { Thread.sleep(5000); } catch (Exception ignored) {}
                }
            }
            if (socket == null) return;
            byte[] buf = new byte[1024];
            while (discovering) {
                DatagramPacket packet = new DatagramPacket(buf, buf.length);
                try {
                    socket.receive(packet);
                } catch (Exception timeout) {
                    continue;
                }
                String msg = new String(packet.getData(), 0, packet.getLength(), StandardCharsets.UTF_8).trim();
                if (!msg.matches("^AR\\d+\\|.*")) continue;
                final String raw = msg;
                activity.runOnUiThread(() -> webView.evaluateJavascript(
                        "window.onBeaconRaw && onBeaconRaw(" + json(raw) + ")",
                        null));
            }
        } catch (Exception e) {
            android.util.Log.w("AutoRewarder", "beacon listen failed", e);
        } finally {
            discovering = false;
            if (socket != null) socket.close();
            if (lock != null && lock.isHeld()) {
                try { lock.release(); } catch (Exception ignored) {}
            }
        }
    }

    private void probeLan() {
        Set<String> prefixes = new LinkedHashSet<>();
        try {
            Enumeration<NetworkInterface> nifs = NetworkInterface.getNetworkInterfaces();
            while (nifs.hasMoreElements()) {
                NetworkInterface nif = nifs.nextElement();
                try {
                    if (!nif.isUp() || nif.isLoopback()) continue;
                } catch (Exception ignored) {
                    continue;
                }
                for (InetAddress addr : Collections.list(nif.getInetAddresses())) {
                    if (!(addr instanceof Inet4Address) || addr.isLoopbackAddress()) continue;
                    String ip = addr.getHostAddress();
                    if (ip == null) continue;
                    if (ip.startsWith("192.168.") || ip.startsWith("10.") || isPrivate172(ip)) {
                        prefixes.add(ip.substring(0, ip.lastIndexOf('.') + 1));
                    }
                }
            }
        } catch (Exception ignored) {}
        if (prefixes.isEmpty()) {
            notifyLan("");
            return;
        }
        ExecutorService pool = Executors.newFixedThreadPool(32);
        AtomicBoolean found = new AtomicBoolean(false);
        for (String prefix : prefixes) {
            for (int i = 1; i <= 254; i++) {
                final String host = prefix + i;
                pool.execute(() -> {
                    if (found.get()) return;
                    if (!pingBridge(host)) return;
                    if (found.compareAndSet(false, true)) {
                        notifyLan("http://" + host + ":38471");
                    }
                });
            }
        }
        pool.shutdown();
        try {
            pool.awaitTermination(8, TimeUnit.SECONDS);
        } catch (Exception ignored) {}
        pool.shutdownNow();
        if (!found.get()) notifyLan("");
    }

    private static boolean isPrivate172(String ip) {
        if (!ip.startsWith("172.")) return false;
        try {
            int second = Integer.parseInt(ip.split("\\.")[1]);
            return second >= 16 && second <= 31;
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean pingBridge(String host) {
        String url = "http://" + host + ":38471/ping";
        if (!urlAllowed(url)) return false;
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setConnectTimeout(280);
            conn.setReadTimeout(280);
            conn.setInstanceFollowRedirects(false);
            conn.setRequestMethod("GET");
            int code = conn.getResponseCode();
            if (code >= 400) return false;
            URL landed = conn.getURL();
            if (landed == null || !urlAllowed(landed.toString())) return false;
            InputStream in = conn.getInputStream();
            String body = readStream(in);
            return body != null && body.contains("\"ok\"");
        } catch (Exception e) {
            return false;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private void notifyLan(String url) {
        activity.runOnUiThread(() -> webView.evaluateJavascript(
                "window.onLanFound && onLanFound(" + json(url) + ")",
                null));
    }

    private static String json(String value) {
        return JSONObject.quote(value == null ? "" : value);
    }
}
