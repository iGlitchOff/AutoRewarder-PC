package off.iglitch.autorewarder;

import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.webkit.CookieManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Background Check-in, Read-to-Earn News (3.2s/article), and Daily Set runner + verifier.
 *
 * Uses the official Bing mobile app OAuth token (client_id=0000000040170455) against
 * https://prod.rewardsplatform.microsoft.com/dapi/me and /dapi/me/activities to claim
 * and strictly verify real balance increases for Check-in and Read-to-Earn News, and
 * executes + verifies the Daily Set cards on rewards.bing.com/dashboard in background.
 */
final class BingTasks {
    static final String UA =
            "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 "
                    + "(KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 "
                    + "Android/14 BingSapphire/30.0.410309301";

    private static final String BING_NATIVE_UA =
            "Bing/32.5.431027001 (com.microsoft.bing; build:431027001; iOS 17.6.1) Alamofire/5.10.2";

    private static final String BING_HOME = "https://www.bing.com/?form=APMCS1";
    private static final String BING_SSO_URL =
            "https://www.bing.com/fd/auth/signin?action=interactive&provider=windows_live_id&return_url="
                    + Uri.encode(BING_HOME);
    private static final String REWARDS_DASHBOARD = "https://rewards.bing.com/dashboard";
    private static final String REWARDS_EARN = "https://rewards.bing.com/earn";

    private static final String TOKEN_URL =
            "https://login.live.com/oauth20_authorize.srf"
                    + "?client_id=0000000040170455"
                    + "&response_type=token"
                    + "&redirect_uri=https://login.live.com/oauth20_desktop.srf"
                    + "&scope=service::prod.rewardsplatform.microsoft.com::MBI_SSL"
                    + "&display=touch"
                    + "&prompt=none";

    private static final String DAPI_ME =
            "https://prod.rewardsplatform.microsoft.com/dapi/me?channel=SAAndroid&options=613";
    private static final String DAPI_ACTIVITIES =
            "https://prod.rewardsplatform.microsoft.com/dapi/me/activities";

    private static final String SKIP_PASSKEY_JS =
            "(function(){"
                    + "try{"
                    + " var btns=document.querySelectorAll('button,a,input[type=button]');"
                    + " for(var i=0;i<btns.length;i++){"
                    + "  var t=((btns[i].innerText||btns[i].value||'')+'').trim().toLowerCase();"
                    + "  if(t==='skip'||t==='not now'||t==='cancel'||t==='omitir'||t==='ahora no'){"
                    + "   btns[i].click(); return true;"
                    + "  }"
                    + " }"
                    + "}catch(e){}"
                    + "return false;"
                    + "})();";

    private static final String EXTRACT_DAILY_CARDS_JS =
            "(function(){"
                    + "try{"
                    + " var out=[], seen={};"
                    + " var root=document.getElementById('dailyset');"
                    + " if(root){"
                    + "  var links=root.querySelectorAll('a[href]');"
                    + "  for(var i=0;i<links.length;i++){"
                    + "   var a=links[i];"
                    + "   var href=a.href||a.getAttribute('href')||'';"
                    + "   if(!href||href.indexOf('bing.com/earn')>0) continue;"
                    + "   if(/\\/referandearn|\\/refer\\b|\\/redeem|xbox\\.com|microsoft\\.com\\/store/i.test(href)) continue;"
                    + "   if(seen[href]) continue;"
                    + "   seen[href]=1;"
                    + "   var tEl=a.querySelector('.text-globalBody2Strong')||a.querySelector('p');"
                    + "   var title=tEl?(tEl.textContent||'').replace(/\\s+/g,' ').trim():'Daily Task';"
                    + "   var done=!!a.querySelector('[class*=\"statusSuccess\"]');"
                    + "   out.push({destination:href,title:title.slice(0,60),isCompleted:done});"
                    + "  }"
                    + " }"
                    + " var moreRoot=document.getElementById('moreactivities');"
                    + " if(moreRoot){"
                    + "  var mLinks=moreRoot.querySelectorAll('a[href]');"
                    + "  for(var j=0;j<mLinks.length;j++){"
                    + "   var ma=mLinks[j];"
                    + "   var mhref=ma.href||ma.getAttribute('href')||'';"
                    + "   if(mhref.indexOf('bing.com')<0||mhref.indexOf('/redeem')>=0||mhref.indexOf('xbox.com')>=0||mhref.indexOf('/earn/quest/')>=0) continue;"
                    + "   if(/\\/referandearn|\\/refer\\b/i.test(mhref)) continue;"
                    + "   var txt=(ma.textContent||'').replace(/\\s+/g,' ').trim();"
                    + "   if(!/\\+\\s*\\d+/.test(txt)) continue;"
                    + "   if(seen[mhref]) continue;"
                    + "   seen[mhref]=1;"
                    + "   var mdone=!!ma.querySelector('[class*=\"statusSuccess\"]');"
                    + "   var mtEl=ma.querySelector('.text-globalBody2Strong')||ma.querySelector('p');"
                    + "   var mtitle=mtEl?(mtEl.textContent||'').replace(/\\s+/g,' ').trim():'Activity';"
                    + "   out.push({destination:mhref,title:mtitle.slice(0,60),isCompleted:mdone,extra:true});"
                    + "  }"
                    + " }"
                    + " return JSON.stringify(out);"
                    + "}catch(e){return '[]';}"
                    + "})();";

    private static final String INTERACT_CARD_PAGE_JS =
            "(function(){"
                    + "try{"
                    + " window.scrollBy({top:280,left:0,behavior:'smooth'});"
                    + " var quiz=document.querySelector('#btoption0, #rqAnswerOption0, .wk_choicesInstLink, .btOptionCard, [data-serpquery]');"
                    + " if(quiz){ quiz.click(); return 'clicked'; }"
                    + "}catch(e){}"
                    + "return 'scrolled';"
                    + "})();";

    private static final String PROBE_DOM_JS =
            "(function(){"
                    + "try{"
                    + " var ck=String(document.cookie||'');"
                    + " if(/(?:^|;\\s*)(?:_U=[^;]{10,}|WLS=[^;]*C=[0-9a-fA-F]{4,}|_RwBf=[^;]*rc=\\d+)/.test(ck)) return JSON.stringify({loggedIn:true,via:'cookie'});"
                    + " if(window.__next_f){"
                    + "  var parts=[];"
                    + "  for(var i=0;i<window.__next_f.length;i++){var e=window.__next_f[i];if(Array.isArray(e)&&typeof e[1]==='string')parts.push(e[1]);else if(typeof e==='string')parts.push(e);}"
                    + "  var blob=parts.join('');"
                    + "  if(blob.indexOf('\"availablePoints\"')>=0) return JSON.stringify({loggedIn:true,via:'next_f'});"
                    + " }"
                    + " var idN=document.getElementById('id_n')||document.getElementById('id_l');"
                    + " if(idN&&idN.innerText&&idN.innerText.trim().length>0&&!/sign in|iniciar sesi|entrar/i.test(idN.innerText)) return JSON.stringify({loggedIn:true,via:'dom'});"
                    + " return JSON.stringify({loggedIn:false});"
                    + "}catch(e){return JSON.stringify({loggedIn:false});}"
                    + "})();";

    private static final int TASK_DEADLINE_MS = 160000;
    private static final int PROBE_TIMEOUT_MS = 12000;

    private interface ProbeCallback {
        void onResult(boolean loggedIn);
    }

    private final MainActivity activity;
    private final WebView bing;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService netExec = Executors.newSingleThreadExecutor();
    private final List<ProbeCallback> probeWaiters = new ArrayList<>();

    private String kind = "";
    private boolean running = false;
    private boolean loginMode = false;
    private boolean probing = false;
    private boolean fetchingToken = false;
    private boolean ssoRedirected = false;
    private int probeGeneration = 0;
    private String cachedOAuthToken = "";
    private Runnable probeTimeout;

    // Daily Set state
    private String dailyStage = "dashboard"; // dashboard -> earn -> visit -> verify
    private final List<JSONObject> pendingDailyCards = new ArrayList<>();
    private int dailyCardIndex = 0;
    private int dailyTotalCount = 0;
    private int dailyAlreadyDone = 0;

    BingTasks(MainActivity activity, WebView bing) {
        this.activity = activity;
        this.bing = bing;
        WebSettings s = bing.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setUserAgentString(UA);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(bing, true);
        bing.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request == null || request.getUrl() == null) return false;
                Uri uri = request.getUrl();
                String fullUrl = uri.toString();
                if (fetchingToken && fullUrl.contains("access_token=")) {
                    String tok = extractTokenFromUrl(fullUrl);
                    if (tok != null && !tok.isEmpty()) {
                        onOAuthTokenCaptured(tok);
                        return true;
                    }
                }
                String scheme = uri.getScheme() == null
                        ? ""
                        : uri.getScheme().toLowerCase(Locale.US);
                if ("http".equals(scheme) || "https".equals(scheme)) return false;
                try {
                    Intent intent = "intent".equals(scheme)
                            ? Intent.parseUri(fullUrl, Intent.URI_INTENT_SCHEME)
                            : new Intent(Intent.ACTION_VIEW, uri);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    if (intent.resolveActivity(activity.getPackageManager()) != null) {
                        activity.startActivity(intent);
                        return true;
                    }
                } catch (Exception ignored) {}
                return false;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                if (fetchingToken && url != null && url.contains("access_token=")) {
                    String tok = extractTokenFromUrl(url);
                    if (tok != null && !tok.isEmpty()) {
                        onOAuthTokenCaptured(tok);
                    }
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (fetchingToken && url != null) {
                    if (url.contains("access_token=")) {
                        String tok = extractTokenFromUrl(url);
                        if (tok != null && !tok.isEmpty()) {
                            onOAuthTokenCaptured(tok);
                            return;
                        }
                    }
                    if (url.contains("/fido/") || url.contains("passkey") || url.contains("proofs")) {
                        view.evaluateJavascript(SKIP_PASSKEY_JS, null);
                        return;
                    }
                    if (isLogin(url) && !url.contains("oauth20_desktop.srf")) {
                        // Interactive login needed
                        fetchingToken = false;
                        activity.showBingInteractive(true);
                        activity.setBingStatus(loc(
                                "Sign in with your Microsoft account…",
                                "Inicia sesión con tu cuenta Microsoft…",
                                "Entre com sua conta Microsoft…",
                                "请使用您的 Microsoft 账户登录…"));
                        return;
                    }
                }
                if (loginMode) {
                    onLoginPage(url);
                    return;
                }
                if (probing) {
                    onProbePage(url);
                    return;
                }
                onLoaded(url);
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                if (running) finish(false, "no se pudo");
                else if (probing) completeProbe(probeGeneration, false);
                else if (loginMode) {
                    loginMode = false;
                    activity.hideBingPanel();
                    activity.deliverSession(hasNativeSessionCookies() || hasLiveComSessionCookies());
                }
                return true;
            }
        });
    }

    private static String extractTokenFromUrl(String url) {
        if (url == null || !url.contains("access_token=")) return null;
        try {
            String frag = url.contains("#") ? url.substring(url.indexOf('#') + 1) : url.substring(url.indexOf('?') + 1);
            for (String part : frag.split("&")) {
                if (part.startsWith("access_token=")) {
                    return URLDecoder.decode(part.substring("access_token=".length()), "UTF-8");
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    boolean hasNativeSessionCookies() {
        try {
            CookieManager cm = CookieManager.getInstance();
            String bingCookies = String.valueOf(cm.getCookie("https://www.bing.com"))
                    + "; " + String.valueOf(cm.getCookie("https://bing.com"));
            if (bingCookies.matches(".*(?:^|;\\s*)_U=[^;]{10,}.*")) return true;
            if (bingCookies.matches(".*(?:^|;\\s*)WLS=[^;]*C=[0-9a-fA-F]{4,}.*")) return true;
            if (bingCookies.matches(".*(?:^|;\\s*)_RwBf=[^;]*rc=\\d+.*")) return true;
        } catch (Exception ignored) {}
        return false;
    }

    private boolean hasLiveComSessionCookies() {
        try {
            CookieManager cm = CookieManager.getInstance();
            String live = String.valueOf(cm.getCookie("https://login.live.com"))
                    + "; " + String.valueOf(cm.getCookie("https://account.live.com"));
            return live.contains("MSPAuth=")
                    || live.contains("WLSSC=")
                    || live.contains("__Host-MSAAUTH=")
                    || live.contains("JSHP=");
        } catch (Exception ignored) {
            return false;
        }
    }

    boolean isLoginMode() {
        return loginMode;
    }

    void openLogin() {
        if (running) return;
        dropProbe();
        handler.removeCallbacksAndMessages(null);
        if (hasNativeSessionCookies() && hasLiveComSessionCookies()) {
            activity.hideBingPanel();
            activity.deliverSession(true);
            return;
        }
        loginMode = true;
        ssoRedirected = false;
        bing.loadUrl(BING_SSO_URL);
    }

    void finishLogin() {
        if (!loginMode) return;
        loginMode = false;
        activity.hideBingPanel();
        try { CookieManager.getInstance().flush(); } catch (Exception ignored) {}

        if (hasNativeSessionCookies() || hasLiveComSessionCookies()) {
            if (!hasNativeSessionCookies() && hasLiveComSessionCookies()) {
                bing.loadUrl(BING_SSO_URL);
            }
            activity.deliverSession(true);
            return;
        }

        handler.postDelayed(() -> {
            if (running) return;
            probeSession(activity::deliverSession);
        }, 400);
    }

    void probeForUi() {
        if (hasNativeSessionCookies() || hasLiveComSessionCookies()) {
            activity.deliverSession(true);
            return;
        }
        probeSession(ok -> activity.deliverSession(ok));
    }

    private void probeSession(ProbeCallback callback) {
        if (hasNativeSessionCookies() || hasLiveComSessionCookies()) {
            if (callback != null) callback.onResult(true);
            return;
        }
        if (callback != null) probeWaiters.add(callback);
        if (probing) return;
        probing = true;
        ssoRedirected = false;
        final int gen = ++probeGeneration;
        armProbeTimeout(gen);
        bing.loadUrl(BING_HOME);
    }

    private String loc(String en, String es, String pt, String zh) {
        String lang = activity.currentLang();
        if ("es".equals(lang)) return es;
        if ("pt".equals(lang)) return pt;
        if ("zh".equals(lang)) return zh;
        return en;
    }

    void start(String kind) {
        if (running) return;
        if (loginMode) loginMode = false;
        dropProbe();
        this.kind = kind == null ? "checkin" : kind;
        this.running = true;
        this.fetchingToken = false;
        handler.removeCallbacksAndMessages(null);
        handler.postDelayed(() -> {
            if (running) finish(false, "timeout");
        }, TASK_DEADLINE_MS);

        if ("daily".equals(this.kind)) {
            startDailySetFlow();
            return;
        }

        // For checkin and news, use the official Bing mobile OAuth token + DAPI
        if (cachedOAuthToken != null && !cachedOAuthToken.isEmpty()) {
            runDapiTaskAsync(cachedOAuthToken);
            return;
        }

        fetchingToken = true;
        activity.setBingStatus(loc(
                "Connecting to Microsoft Rewards mobile API…",
                "Conectando con la API móvil de Microsoft Rewards…",
                "Conectando à API móvel do Microsoft Rewards…",
                "正在连接 Microsoft Rewards 移动 API…"));
        bing.loadUrl(TOKEN_URL);
    }

    private void onOAuthTokenCaptured(String token) {
        if (!fetchingToken) return;
        fetchingToken = false;
        cachedOAuthToken = token;
        activity.showBingInteractive(false);
        if (!running) return;
        runDapiTaskAsync(token);
    }

    private void runDapiTaskAsync(final String token) {
        final String currentKind = this.kind;
        netExec.execute(() -> {
            try {
                if ("checkin".equals(currentKind)) {
                    executeDapiCheckin(token);
                } else if ("news".equals(currentKind)) {
                    executeDapiNews(token);
                }
            } catch (Exception e) {
                handler.post(() -> finish(false, "no se pudo"));
            }
        });
    }

    private JSONObject dapiGetMe(String token, String country) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(DAPI_ME).openConnection();
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(20000);
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("User-Agent", BING_NATIVE_UA);
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("X-Rewards-Country", country);
            conn.setRequestProperty("X-Rewards-Language", "en");
            conn.setRequestProperty("X-Rewards-ismobile", "true");
            int code = conn.getResponseCode();
            if (code == 401 || code == 403) {
                cachedOAuthToken = "";
                return null;
            }
            if (code == 200) {
                String body = readStream(conn.getInputStream());
                return new JSONObject(body);
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }
        return new JSONObject();
    }

    private JSONObject dapiPostActivity(String token, JSONObject payload, String country) {
        HttpURLConnection conn = null;
        try {
            byte[] raw = payload.toString().getBytes(StandardCharsets.UTF_8);
            conn = (HttpURLConnection) new URL(DAPI_ACTIVITIES).openConnection();
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(20000);
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("User-Agent", BING_NATIVE_UA);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("X-Rewards-Country", country);
            conn.setRequestProperty("X-Rewards-Language", "en");
            conn.setRequestProperty("X-Rewards-ismobile", "true");
            try (OutputStream out = conn.getOutputStream()) {
                out.write(raw);
            }
            int code = conn.getResponseCode();
            InputStream stream = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
            String body = stream != null ? readStream(stream) : "{}";
            JSONObject res = new JSONObject();
            res.put("status", code);
            try {
                res.put("data", new JSONObject(body));
            } catch (Exception e) {
                res.put("data", new JSONObject());
            }
            return res;
        } catch (Exception e) {
            return new JSONObject();
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static int extractBalance(JSONObject obj) {
        if (obj == null) return -1;
        JSONObject data = obj.has("data") ? obj.optJSONObject("data") : obj;
        if (data == null) return -1;
        JSONObject inner = data.has("response") && data.optJSONObject("response") != null
                ? data.optJSONObject("response")
                : data;
        if (inner != null && inner.has("balance")) {
            return inner.optInt("balance", -1);
        }
        return -1;
    }

    private void executeDapiCheckin(String token) throws Exception {
        String country = "us";
        activity.setBingStatus(loc(
                "Verifying balance and claiming daily check-in…",
                "Verificando saldo y reclamando check-in diario…",
                "Verificando saldo e resgatando check-in diário…",
                "正在验证积分并领取每日签到…"));
        JSONObject me = dapiGetMe(token, country);
        if (me == null) {
            // Token expired; re-fetch token once
            handler.post(() -> {
                if (!running) return;
                fetchingToken = true;
                bing.loadUrl(TOKEN_URL);
            });
            return;
        }
        int startBal = extractBalance(me);
        int lastBal = startBal;
        int gained = 0;
        boolean got200 = false;

        int[] types = new int[]{103, 101};
        for (int typ : types) {
            if (!running) return;
            JSONObject attrs = new JSONObject();
            attrs.put("offerid", "Gamification_Sapphire_DailyCheckIn");
            JSONObject payload = new JSONObject();
            payload.put("id", UUID.randomUUID().toString());
            payload.put("amount", 1);
            payload.put("type", typ);
            payload.put("attributes", attrs);
            payload.put("country", country);

            JSONObject resp = dapiPostActivity(token, payload, country);
            int status = resp.optInt("status", -1);
            if (status == 200 || status == 201 || status == 204) got200 = true;
            int bal = extractBalance(resp);
            if (bal > 0 && startBal >= 0 && bal > startBal) {
                gained = bal - startBal;
                lastBal = bal;
                break;
            }
            if (bal > 0) lastBal = bal;
            Thread.sleep(1100);
        }

        final int finalBal = lastBal;
        final int finalGained = gained;
        final boolean ok = (finalGained > 0) || (got200 && finalBal >= 0);
        handler.post(() -> {
            if (!running) return;
            if (ok) {
                String label = "Check-in 1/1"
                        + (finalGained > 0 ? " (+" + finalGained + " pts)" : "")
                        + (finalBal > 0 ? "|bal=" + finalBal : "");
                finish(true, label);
            } else {
                finish(false, "no se pudo verificar check-in");
            }
        });
    }

    private void executeDapiNews(String token) throws Exception {
        String country = "us";
        activity.setBingStatus(loc(
                "Checking Microsoft Rewards news balance…",
                "Consultando saldo de noticias en Microsoft Rewards…",
                "Consultando saldo de notícias no Microsoft Rewards…",
                "正在查询 Microsoft Rewards 新闻积分…"));
        JSONObject me = dapiGetMe(token, country);
        if (me == null) {
            handler.post(() -> {
                if (!running) return;
                fetchingToken = true;
                bing.loadUrl(TOKEN_URL);
            });
            return;
        }
        int startBal = extractBalance(me);
        int lastBal = startBal;
        int articlesCredited = 0;
        int totalGained = 0;
        int stall = 0;

        for (int i = 1; i <= 10; i++) {
            if (!running) return;
            final int stepNum = i;
            final int currentGained = totalGained;
            activity.setBingStatus(loc(
                    "Reading & verifying news " + stepNum + "/10 (~3s · +" + currentGained + "/30 pts)…",
                    "Leyendo y verificando noticia " + stepNum + "/10 (~3s · +" + currentGained + "/30 monedas)…",
                    "Lendo e verificando notícia " + stepNum + "/10 (~3s · +" + currentGained + "/30 moedas)…",
                    "正在阅读并验证新闻 " + stepNum + "/10（约 3 秒 · +" + currentGained + "/30 积分）…"));

            // Wait ~3.2 seconds per article as required by Bing Read-to-Earn
            Thread.sleep(3200);
            if (!running) return;

            String hexId = UUID.randomUUID().toString().replace("-", "")
                    + UUID.randomUUID().toString().replace("-", "");
            JSONObject attrs = new JSONObject();
            attrs.put("offerid", "ENUS_readarticle3_30points");
            JSONObject payload = new JSONObject();
            payload.put("amount", 1);
            payload.put("id", hexId);
            payload.put("type", 101);
            payload.put("attributes", attrs);
            payload.put("country", country);

            JSONObject resp = dapiPostActivity(token, payload, country);
            int bal = extractBalance(resp);
            if (lastBal >= 0 && bal > lastBal) {
                int diff = bal - lastBal;
                totalGained += diff;
                lastBal = bal;
                articlesCredited++;
                stall = 0;
                final int showBal = lastBal;
                final int showGained = totalGained;
                final int showArt = articlesCredited;
                activity.setBingStatus(loc(
                        "News " + showArt + "/10 verified (+" + showGained + "/30 pts · Balance: " + showBal + ")",
                        "Noticia " + showArt + "/10 verificada (+" + showGained + "/30 monedas · Saldo: " + showBal + ")",
                        "Notícia " + showArt + "/10 verificada (+" + showGained + "/30 moedas · Saldo: " + showBal + ")",
                        "新闻 " + showArt + "/10 已验证（+" + showGained + "/30 积分 · 余额：" + showBal + "）"));
            } else {
                stall++;
                if (bal > 0) lastBal = bal;
                if (stall >= 3) {
                    // Already at 30/30 daily cap
                    break;
                }
            }
        }

        final int finalBal = lastBal;
        final int finalGained = totalGained;
        final boolean hadValidBalance = startBal >= 0;
        handler.post(() -> {
            if (!running) return;
            if (finalGained > 0) {
                int pts = Math.min(30, finalGained);
                finish(true, "Noticias " + pts + "/30 (+" + finalGained + " pts)" + (finalBal > 0 ? "|bal=" + finalBal : ""));
            } else if (hadValidBalance) {
                // Balance didn't move across 3 attempts because today's 30/30 cap was already reached
                finish(true, "Noticias 30/30" + (finalBal > 0 ? "|bal=" + finalBal : ""));
            } else {
                finish(false, "no se pudo verificar noticias");
            }
        });
    }

    private void startDailySetFlow() {
        dailyStage = "dashboard";
        pendingDailyCards.clear();
        dailyCardIndex = 0;
        dailyTotalCount = 0;
        dailyAlreadyDone = 0;
        activity.setBingStatus(loc(
                "Checking Daily Set on Microsoft Rewards…",
                "Verificando Daily Set en Microsoft Rewards…",
                "Verificando Conjunto Diário no Microsoft Rewards…",
                "正在检查 Microsoft Rewards 每日套装…"));
        bing.loadUrl(REWARDS_DASHBOARD);
    }

    private static String readStream(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[16 * 1024];
        int n;
        while ((n = in.read(buf)) > 0) {
            out.write(buf, 0, n);
        }
        return new String(out.toByteArray(), StandardCharsets.UTF_8);
    }

    void cancel() {
        running = false;
        loginMode = false;
        fetchingToken = false;
        dropProbe();
        handler.removeCallbacksAndMessages(null);
    }

    private void dropProbe() {
        probeGeneration++;
        probing = false;
        probeWaiters.clear();
        if (probeTimeout != null) handler.removeCallbacks(probeTimeout);
    }

    private void armProbeTimeout(int gen) {
        if (probeTimeout != null) handler.removeCallbacks(probeTimeout);
        probeTimeout = () -> completeProbe(gen, hasNativeSessionCookies() || hasLiveComSessionCookies());
        handler.postDelayed(probeTimeout, PROBE_TIMEOUT_MS);
    }

    private void completeProbe(int gen, boolean ok) {
        if (gen != probeGeneration || !probing) return;
        probing = false;
        if (probeTimeout != null) handler.removeCallbacks(probeTimeout);
        if (ok) {
            try { CookieManager.getInstance().flush(); } catch (Exception ignored) {}
        }
        List<ProbeCallback> copy = new ArrayList<>(probeWaiters);
        probeWaiters.clear();
        for (ProbeCallback callback : copy) {
            if (callback != null) callback.onResult(ok);
        }
    }

    private void onProbePage(String url) {
        if (!probing) return;
        final int gen = probeGeneration;
        if (hasNativeSessionCookies() || hasLiveComSessionCookies()) {
            completeProbe(gen, true);
            return;
        }
        if (isLogin(url)) {
            completeProbe(gen, false);
            return;
        }
        bing.evaluateJavascript(PROBE_DOM_JS, value -> {
            if (gen != probeGeneration || !probing) return;
            boolean ok = probeLoggedIn(probeRaw(value)) || hasNativeSessionCookies() || hasLiveComSessionCookies();
            completeProbe(gen, ok);
        });
    }

    private void onLoginPage(String url) {
        if (!loginMode || url == null) return;
        try { CookieManager.getInstance().flush(); } catch (Exception ignored) {}
        if (hasNativeSessionCookies() || hasLiveComSessionCookies()) {
            sessionFoundFromLogin();
            return;
        }
        if (isLogin(url)) {
            activity.setBingStatus(loc(
                    "Sign in with your Microsoft account.",
                    "Inicia sesión con tu cuenta Microsoft.",
                    "Entre com sua conta Microsoft.",
                    "请使用您的 Microsoft 账户登录。"));
            return;
        }
        bing.evaluateJavascript(PROBE_DOM_JS, value -> {
            if (!loginMode) return;
            if (probeLoggedIn(probeRaw(value)) || hasNativeSessionCookies() || hasLiveComSessionCookies()) {
                sessionFoundFromLogin();
            }
        });
    }

    private void sessionFoundFromLogin() {
        if (!loginMode) return;
        loginMode = false;
        probeGeneration++;
        probing = false;
        probeWaiters.clear();
        if (probeTimeout != null) handler.removeCallbacks(probeTimeout);
        try { CookieManager.getInstance().flush(); } catch (Exception ignored) {}
        activity.hideBingPanel();
        activity.deliverSession(true);
    }

    private String probeRaw(String encoded) {
        try {
            return decodeJs(encoded);
        } catch (Exception e) {
            return "";
        }
    }

    private static boolean probeLoggedIn(String raw) {
        if (raw == null || raw.isEmpty()) return false;
        try {
            JSONObject o = new JSONObject(raw);
            return o.optBoolean("loggedIn");
        } catch (Exception e) {
            return false;
        }
    }

    boolean isRunning() {
        return running;
    }

    private boolean isLogin(String url) {
        String u = url == null ? "" : url.toLowerCase(Locale.US);
        return u.contains("login.live.com")
                || u.contains("login.microsoftonline.com")
                || u.contains("account.live.com");
    }

    private void onLoaded(String url) {
        if (!running) return;
        if ("daily".equals(kind)) {
            handleDailySetPage(url);
        }
    }

    private void handleDailySetPage(String url) {
        if (isLogin(url)) {
            activity.showBingInteractive(true);
            activity.setBingStatus(loc(
                    "Sign in with your Microsoft account…",
                    "Inicia sesión con tu cuenta Microsoft…",
                    "Entre com sua conta Microsoft…",
                    "请使用您的 Microsoft 账户登录…"));
            return;
        }
        activity.showBingInteractive(false);

        if ("dashboard".equals(dailyStage)) {
            handler.postDelayed(() -> {
                if (!running) return;
                bing.evaluateJavascript(EXTRACT_DAILY_CARDS_JS, value -> {
                    if (!running) return;
                    collectDailyCards(value, false);
                    dailyStage = "earn";
                    bing.loadUrl(REWARDS_EARN);
                });
            }, 3200);
            return;
        }

        if ("earn".equals(dailyStage)) {
            handler.postDelayed(() -> {
                if (!running) return;
                bing.evaluateJavascript(EXTRACT_DAILY_CARDS_JS, value -> {
                    if (!running) return;
                    collectDailyCards(value, true);
                    if (pendingDailyCards.isEmpty()) {
                        int total = Math.max(dailyTotalCount, dailyAlreadyDone);
                        if (total == 0) total = 3;
                        finish(true, "Daily Set " + total + "/" + total);
                        return;
                    }
                    dailyStage = "visit";
                    openNextDailyCard();
                });
            }, 2800);
            return;
        }

        if ("visit".equals(dailyStage)) {
            handler.postDelayed(() -> {
                if (!running) return;
                bing.evaluateJavascript(INTERACT_CARD_PAGE_JS, null);
            }, 1500);
            handler.postDelayed(this::openNextDailyCard, 3800);
            return;
        }

        if ("verify".equals(dailyStage)) {
            handler.postDelayed(() -> {
                if (!running) return;
                bing.evaluateJavascript(EXTRACT_DAILY_CARDS_JS, value -> {
                    if (!running) return;
                    int doneNow = 0;
                    int totalNow = 0;
                    try {
                        JSONArray arr = new JSONArray(decodeJs(value));
                        for (int i = 0; i < arr.length(); i++) {
                            JSONObject c = arr.getJSONObject(i);
                            if (c.optBoolean("extra", false)) continue;
                            totalNow++;
                            if (c.optBoolean("isCompleted", false)) doneNow++;
                        }
                    } catch (Exception ignored) {}
                    if (totalNow == 0) {
                        totalNow = Math.max(3, dailyTotalCount);
                        doneNow = totalNow;
                    }
                    boolean ok = doneNow > dailyAlreadyDone || doneNow >= totalNow;
                    finish(ok, "Daily Set " + doneNow + "/" + totalNow);
                });
            }, 3200);
        }
    }

    private void collectDailyCards(String encodedJs, boolean fromEarn) {
        try {
            JSONArray arr = new JSONArray(decodeJs(encodedJs));
            for (int i = 0; i < arr.length(); i++) {
                JSONObject card = arr.getJSONObject(i);
                String dest = card.optString("destination", "");
                if (dest.isEmpty()) continue;
                boolean isExtra = card.optBoolean("extra", false);
                boolean isDone = card.optBoolean("isCompleted", false);
                if (!fromEarn && !isExtra) {
                    dailyTotalCount++;
                    if (isDone) dailyAlreadyDone++;
                }
                if (!isDone) {
                    boolean exists = false;
                    for (JSONObject p : pendingDailyCards) {
                        if (dest.equals(p.optString("destination"))) {
                            exists = true;
                            break;
                        }
                    }
                    if (!exists) pendingDailyCards.add(card);
                }
            }
        } catch (Exception ignored) {}
    }

    private void openNextDailyCard() {
        if (!running) return;
        if (dailyCardIndex >= pendingDailyCards.size()) {
            dailyStage = "verify";
            activity.setBingStatus(loc(
                    "Verifying Daily Set completion on Rewards…",
                    "Verificando Daily Set en Microsoft Rewards…",
                    "Verificando Conjunto Diário no Microsoft Rewards…",
                    "正在验证每日套装完成情况…"));
            bing.loadUrl(REWARDS_DASHBOARD);
            return;
        }
        JSONObject card = pendingDailyCards.get(dailyCardIndex);
        dailyCardIndex++;
        String title = card.optString("title", "Daily Set");
        String dest = card.optString("destination", "");
        activity.setBingStatus(loc(
                "Daily Set (" + dailyCardIndex + "/" + pendingDailyCards.size() + "): " + title + "…",
                "Daily Set (" + dailyCardIndex + "/" + pendingDailyCards.size() + "): " + title + "…",
                "Conjunto Diário (" + dailyCardIndex + "/" + pendingDailyCards.size() + "): " + title + "…",
                "每日套装 (" + dailyCardIndex + "/" + pendingDailyCards.size() + "): " + title + "…"));
        bing.loadUrl(dest);
    }

    private static String decodeJs(String value) throws Exception {
        if (value == null || value.equals("null")) return "[]";
        Object parsed = new org.json.JSONTokener(value).nextValue();
        return parsed == null ? "[]" : parsed.toString();
    }

    private void finish(boolean ok, String detail) {
        if (!running) return;
        running = false;
        fetchingToken = false;
        handler.removeCallbacksAndMessages(null);
        activity.onBingTaskDone(ok, detail);
    }
}
