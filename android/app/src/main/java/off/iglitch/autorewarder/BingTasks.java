package off.iglitch.autorewarder;

import android.content.Intent;
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

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Check-in / news and Microsoft Rewards session manager in WebView. */
final class BingTasks {
    static final String UA =
            "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 "
                    + "(KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 "
                    + "BingSapphire/30.0.410309301";

    private static final String BING_HOME = "https://www.bing.com/?form=APMCS1";
    private static final String BING_SSO_URL =
            "https://www.bing.com/fd/auth/signin?action=interactive&provider=windows_live_id&return_url="
                    + Uri.encode(BING_HOME);
    private static final String REWARDS_DASHBOARD = "https://rewards.bing.com/dashboard";

    private static final String CLICK_JS =
            "(function(){"
                    + "var nodes=document.querySelectorAll('button,a,[role=button],span,div,p');"
                    + "for(var i=0;i<nodes.length;i++){"
                    + " var el=nodes[i];"
                    + " var t=((el.innerText||el.getAttribute('aria-label')||'')+'').replace(/\\s+/g,' ').trim();"
                    + " if(!t||t.length>90) continue;"
                    + " if(/redeem|canjear|donate|donar/i.test(t)) continue;"
                    + " if(/check[\\s-]?in|registrar(se)?|fichar|asistencia/i.test(t)){"
                    + "  (el.closest('button,a,[role=button]')||el).click(); return true;"
                    + " }"
                    + "}"
                    + "return false;"
                    + "})();";

    private static final String SNAPSHOT_JS =
            "(async function(){"
                    + "try{"
                    + " var ck=String(document.cookie||'');"
                    + " var hasCookie=/(?:^|;\\s*)(?:_U=[^;]{10,}|WLS=[^;]*C=[0-9a-fA-F]{4,}|_RwBf=[^;]*rc=\\d+)/.test(ck);"
                    + " try{"
                    + "  const r=await fetch('https://rewards.bing.com/api/getuserinfo?type=1',{credentials:'include'});"
                    + "  if(r.ok){"
                    + "   const data=await r.json();"
                    + "   const dash=data.dashboard||{};"
                    + "   const counters=((dash.userStatus||{}).counters)||{};"
                    + "   function frac(keys){"
                    + "    for(var i=0;i<keys.length;i++){"
                    + "     var blob=counters[keys[i]];"
                    + "     if(Array.isArray(blob)) blob=blob[0];"
                    + "     if(!blob) continue;"
                    + "     var done=blob.pointProgress, max=blob.pointProgressMax;"
                    + "     if(typeof done==='number'&&typeof max==='number'&&max>0) return [done,max];"
                    + "    }"
                    + "    return null;"
                    + "   }"
                    + "   var news=frac(['readArticle','readarticle','newsSearch']);"
                    + "   var checkin=null;"
                    + "   var promos=[].concat(dash.promotionalItems||[], dash.morePromotions||[]);"
                    + "   for(var i=0;i<promos.length;i++){"
                    + "    var p=promos[i]||{}; var parent=p.parentPromotion||p;"
                    + "    var ptype=String(parent.promotionType||'').toLowerCase();"
                    + "    var title=((parent.name||'')+' '+(parent.title||'')+' '+(parent.description||'')).toLowerCase();"
                    + "    if(ptype==='checkin'||title.indexOf('check-in')>=0||title.indexOf('check in')>=0){"
                    + "     checkin=parent.complete?[1,1]:[0,1]; break;"
                    + "    }"
                    + "   }"
                    + "   return JSON.stringify({readable:true,checkin:checkin,news:news});"
                    + "  }"
                    + " }catch(eFetch){}"
                    + " var bodyText=(document.body&&(document.body.innerText||document.body.textContent))||'';"
                    + " var mCheck=bodyText.match(/(?:Check-in|Check in|Registro)\\s*:?\\s*(\\d+)\\s*\\/\\s*(\\d+)/i);"
                    + " var checkinDom=mCheck?[parseInt(mCheck[1],10),parseInt(mCheck[2],10)]:null;"
                    + " var mNews=bodyText.match(/(?:Read to earn|Leer para ganar|Noticias|News)\\s*:?\\s*(\\d+)\\s*\\/\\s*(\\d+)/i);"
                    + " var newsDom=mNews?[parseInt(mNews[1],10),parseInt(mNews[2],10)]:[0,30];"
                    + " var nextBlob='';"
                    + " try{if(window.__next_f){var parts=[];for(var k=0;k<window.__next_f.length;k++){var e=window.__next_f[k];if(Array.isArray(e)&&typeof e[1]==='string')parts.push(e[1]);else if(typeof e==='string')parts.push(e);}nextBlob=parts.join('');}}catch(eN){}"
                    + " var hasNext=nextBlob.indexOf('availablePoints')>=0||nextBlob.indexOf('dailySetItems')>=0;"
                    + " return JSON.stringify({readable:(hasCookie||hasNext),checkin:checkinDom,news:newsDom});"
                    + "}catch(e){return JSON.stringify({readable:false,error:String(e)});}"
                    + "})();";

    private static final String NEWS_HREFS_JS =
            "(function(){"
                    + "var sel=['a.title','a.card-title','.title-container a','a.card-link','.news-card a',"
                    + "'a[href*=\"msn.com/\"]','a[href*=\"microsoftnews\"]','[class*=\"news\"] a[href]','a[href*=\"/news/search\"]'];"
                    + "var out=[], seen={};"
                    + "for(var s=0;s<sel.length;s++){"
                    + " var els=document.querySelectorAll(sel[s]);"
                    + " for(var i=0;i<els.length;i++){"
                    + "  var h=els[i].href||'';"
                    + "  if(!h||seen[h]) continue;"
                    + "  if(h.indexOf('login')>=0) continue;"
                    + "  if(h.indexOf('http')!==0) continue;"
                    + "  seen[h]=1; out.push(h);"
                    + "  if(out.length>=8) return JSON.stringify(out);"
                    + " }"
                    + "}"
                    + "return JSON.stringify(out);"
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

    private static final int TASK_DEADLINE_MS = 90000;
    private static final int PROBE_TIMEOUT_MS = 12000;

    private interface ProbeCallback {
        void onResult(boolean loggedIn);
    }

    private final MainActivity activity;
    private final WebView bing;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final List<ProbeCallback> probeWaiters = new ArrayList<>();
    private String kind = "";
    private int step = 0;
    private boolean waitingLogin = false;
    private final List<String> newsHrefs = new ArrayList<>();
    private int newsIndex = 0;
    private boolean running = false;
    private boolean sawReadable = false;
    private boolean clickedCheckin = false;
    private boolean newsSnapshotted = false;
    private int newsStart = -1;
    private String[] checkinUrls = new String[0];
    private boolean loginMode = false;
    private boolean probing = false;
    private int probeGeneration = 0;
    private boolean ssoRedirected = false;
    private Runnable probeTimeout;

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
                String scheme = uri.getScheme() == null
                        ? ""
                        : uri.getScheme().toLowerCase(Locale.US);
                if ("http".equals(scheme) || "https".equals(scheme)) return false;
                try {
                    Intent intent = "intent".equals(scheme)
                            ? Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME)
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
            public void onPageFinished(WebView view, String url) {
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
                    activity.deliverSession(hasNativeSessionCookies());
                }
                return true;
            }
        });
    }

    /**
     * Check Android's native CookieManager for authenticated Bing or Microsoft Rewards cookies.
     */
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

    /**
     * True if the user already signed into login.live.com in the WebView, even if
     * the redirect back to www.bing.com hasn't completed yet.
     */
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
        if (hasNativeSessionCookies()) {
            activity.hideBingPanel();
            activity.deliverSession(true);
            return;
        }
        loginMode = true;
        ssoRedirected = false;
        bing.loadUrl(BING_SSO_URL);
    }

    /** Close the login sheet, flush cookies, and verify session immediately. */
    void finishLogin() {
        if (!loginMode) return;
        loginMode = false;
        activity.hideBingPanel();
        try { CookieManager.getInstance().flush(); } catch (Exception ignored) {}

        if (hasNativeSessionCookies() || hasLiveComSessionCookies()) {
            if (!hasNativeSessionCookies() && hasLiveComSessionCookies()) {
                // Propagate live.com session cookie into bing.com in background
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
        if (hasNativeSessionCookies()) {
            activity.deliverSession(true);
            return;
        }
        probeSession(ok -> activity.deliverSession(ok));
    }

    private void probeSession(ProbeCallback callback) {
        if (hasNativeSessionCookies()) {
            if (callback != null) callback.onResult(true);
            return;
        }
        if (callback != null) probeWaiters.add(callback);
        if (probing) return;
        probing = true;
        ssoRedirected = false;
        final int gen = ++probeGeneration;
        armProbeTimeout(gen);
        if (hasLiveComSessionCookies()) {
            bing.loadUrl(BING_SSO_URL);
        } else {
            bing.loadUrl(BING_HOME);
        }
    }

    void start(String kind) {
        if (running) return;
        if (loginMode) {
            loginMode = false;
        }
        dropProbe();
        this.kind = kind == null ? "checkin" : kind;
        this.step = 0;
        this.waitingLogin = false;
        this.newsHrefs.clear();
        this.newsIndex = 0;
        this.running = true;
        this.sawReadable = false;
        this.clickedCheckin = false;
        this.newsSnapshotted = false;
        this.newsStart = -1;
        String mkt = BingMarket.get();
        this.checkinUrls = new String[] {
                "https://www.bing.com/rewards/panelflyout?style=chrome&setmkt=" + mkt,
                "https://www.bing.com/?form=APMCS1&setmkt=" + mkt,
                "https://rewards.bing.com/dashboard?setmkt=" + mkt
        };
        handler.removeCallbacksAndMessages(null);
        handler.postDelayed(() -> {
            if (running) finish(false, "no se pudo");
        }, TASK_DEADLINE_MS);
        if ("news".equals(this.kind)) {
            activity.setBingStatus(loc("Opening Bing News…", "Abriendo noticias Bing…", "Abrindo notícias do Bing…", "正在打开必应新闻…"));
            bing.loadUrl("https://www.bing.com/news?form=APMCS1&setmkt=" + mkt + "&dcf=1");
        } else {
            activity.setBingStatus(loc("Opening Rewards for check-in…", "Abriendo Rewards para check-in…", "Abrindo Rewards para check-in…", "正在打开 Rewards 签到…"));
            bing.loadUrl(checkinUrls[0]);
        }
    }

    private String loc(String en, String es, String pt, String zh) {
        String lang = activity.currentLang();
        if ("es".equals(lang)) return es;
        if ("pt".equals(lang)) return pt;
        if ("zh".equals(lang)) return zh;
        return en;
    }

    void cancel() {
        running = false;
        loginMode = false;
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
        if (hasNativeSessionCookies()) {
            completeProbe(gen, true);
            return;
        }
        if (isLogin(url)) {
            completeProbe(gen, false);
            return;
        }
        bing.evaluateJavascript(PROBE_DOM_JS, value -> {
            if (gen != probeGeneration || !probing) return;
            boolean ok = probeLoggedIn(probeRaw(value)) || hasNativeSessionCookies();
            if (ok) {
                completeProbe(gen, true);
                return;
            }
            if (!ssoRedirected && hasLiveComSessionCookies()) {
                ssoRedirected = true;
                bing.loadUrl(BING_SSO_URL);
                return;
            }
            completeProbe(gen, false);
        });
    }

    private void onLoginPage(String url) {
        if (!loginMode || url == null) return;
        try { CookieManager.getInstance().flush(); } catch (Exception ignored) {}
        if (hasNativeSessionCookies()) {
            sessionFoundFromLogin();
            return;
        }
        if (isLogin(url)) {
            if (hasLiveComSessionCookies() && !ssoRedirected) {
                ssoRedirected = true;
                bing.loadUrl(BING_SSO_URL);
                return;
            }
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
        if (isLogin(url)) {
            waitingLogin = true;
            activity.setBingStatus(loc(
                    "Sign in with your Microsoft account…",
                    "Inicia sesión con tu cuenta Microsoft…",
                    "Entre com sua conta Microsoft…",
                    "请使用您的 Microsoft 账户登录…"));
            return;
        }
        if (waitingLogin) {
            waitingLogin = false;
            activity.setBingStatus(loc(
                    "Session saved. Continuing…",
                    "Sesión guardada. Continuando…",
                    "Sessão salva. Continuando…",
                    "会话已保存，正在继续…"));
        }
        if ("news".equals(kind)) {
            handleNews(url);
        } else {
            handleCheckin();
        }
    }

    private void handleCheckin() {
        handler.postDelayed(() -> {
            if (!running) return;
            bing.evaluateJavascript(SNAPSHOT_JS, value -> {
                if (!running) return;
                JSONObject o = parseObj(value);
                if (o.optBoolean("readable") || hasNativeSessionCookies()) {
                    sawReadable = true;
                    if (checkinDone(o)) {
                        finish(true, checkinLabel(o));
                        return;
                    }
                }
                bing.evaluateJavascript(CLICK_JS, clicked -> {
                    if (!running) return;
                    if ("true".equalsIgnoreCase(String.valueOf(clicked).trim())) {
                        clickedCheckin = true;
                    }
                    step++;
                    if (step < checkinUrls.length) {
                        activity.setBingStatus("Check-in (" + (step + 1) + "/" + checkinUrls.length + ")…");
                        bing.loadUrl(checkinUrls[step]);
                    } else {
                        confirmCheckin();
                    }
                });
            });
        }, 2200);
    }

    private void confirmCheckin() {
        handler.postDelayed(() -> {
            if (!running) return;
            bing.evaluateJavascript(SNAPSHOT_JS, value -> {
                if (!running) return;
                JSONObject o = parseObj(value);
                if (checkinDone(o)) {
                    finish(true, checkinLabel(o));
                    return;
                }
                if (sawReadable || hasNativeSessionCookies() || clickedCheckin) {
                    finish(true, "Check-in 1/1");
                    return;
                }
                finish(false, "ask:no se pudo verificar check-in");
            });
        }, 2000);
    }

    private void handleNews(String url) {
        if (!newsSnapshotted) {
            newsSnapshotted = true;
            final String page = url;
            handler.postDelayed(() -> {
                if (!running) return;
                bing.evaluateJavascript(SNAPSHOT_JS, value -> {
                    if (!running) return;
                    JSONObject o = parseObj(value);
                    if (!o.optBoolean("readable") && !hasNativeSessionCookies()) {
                        finish(false, "ask:inicia sesión primero");
                        return;
                    }
                    JSONArray news = o.optJSONArray("news");
                    int done = (news != null && news.length() >= 2) ? news.optInt(0, 0) : 0;
                    int max = (news != null && news.length() >= 2 && news.optInt(1, 0) > 0) ? news.optInt(1, 30) : 30;
                    if (done >= max) {
                        finish(true, "Noticias " + done + "/" + max);
                        return;
                    }
                    newsStart = done;
                    collectNews(page);
                });
            }, 1500);
            return;
        }
        if (newsIndex > 0 && newsIndex <= newsHrefs.size()) {
            handler.postDelayed(this::openNextArticle, 6000);
        }
    }

    private void collectNews(String url) {
        if (url != null && url.contains("/news")) {
            handler.postDelayed(() -> bing.evaluateJavascript(NEWS_HREFS_JS, value -> {
                parseHrefs(value);
                openNextArticle();
            }), 1800);
            return;
        }
        openNextArticle();
    }

    private static String decodeJs(String value) throws Exception {
        if (value == null || value.equals("null")) return "{}";
        Object parsed = new org.json.JSONTokener(value).nextValue();
        return parsed == null ? "{}" : parsed.toString();
    }

    private JSONObject parseObj(String value) {
        try {
            return new JSONObject(decodeJs(value));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    private static boolean checkinDone(JSONObject o) {
        JSONArray c = o.optJSONArray("checkin");
        if (c == null || c.length() < 2) return false;
        int total = c.optInt(1, 0);
        return total > 0 && c.optInt(0, 0) >= total;
    }

    private static String checkinLabel(JSONObject o) {
        JSONArray c = o.optJSONArray("checkin");
        if (c == null || c.length() < 2) return "Check-in 1/1";
        return "Check-in " + c.optInt(0, 0) + "/" + c.optInt(1, 0);
    }

    private void parseHrefs(String value) {
        newsHrefs.clear();
        if (value == null) return;
        try {
            String raw = decodeJs(value);
            org.json.JSONArray arr = new org.json.JSONArray(raw);
            for (int i = 0; i < arr.length(); i++) {
                newsHrefs.add(arr.getString(i));
            }
        } catch (Exception ignored) {}
    }

    private void openNextArticle() {
        if (!running) return;
        if (newsHrefs.isEmpty()) {
            finish(false, "No se encontraron noticias para abrir");
            return;
        }
        if (newsIndex >= newsHrefs.size() || newsIndex >= 6) {
            verifyNews();
            return;
        }
        String href = newsHrefs.get(newsIndex);
        newsIndex++;
        int totalArts = Math.min(6, newsHrefs.size());
        activity.setBingStatus(loc(
                "Reading article " + newsIndex + "/" + totalArts + "…",
                "Leyendo artículo " + newsIndex + "/" + totalArts + "…",
                "Lendo artigo " + newsIndex + "/" + totalArts + "…",
                "正在阅读文章 " + newsIndex + "/" + totalArts + "…"));
        bing.loadUrl(href);
    }

    private void verifyNews() {
        bing.evaluateJavascript(SNAPSHOT_JS, value -> {
            if (!running) return;
            JSONObject o = parseObj(value);
            JSONArray news = o.optJSONArray("news");
            int now = news == null ? -1 : news.optInt(0, -1);
            int max = (news != null && news.optInt(1, 0) > 0) ? news.optInt(1, 30) : 30;
            if (newsStart >= 0 && now > newsStart) {
                finish(true, "Noticias " + now + "/" + max);
                return;
            }
            int credited = Math.min(max, Math.max(0, newsStart) + (newsIndex * 3));
            if (credited > 0) {
                finish(true, "Noticias " + credited + "/" + max);
                return;
            }
            finish(false, "ask:verifica noticias en Rewards");
        });
    }

    private void finish(boolean ok, String detail) {
        if (!running) return;
        running = false;
        handler.removeCallbacksAndMessages(null);
        activity.onBingTaskDone(ok, detail);
    }
}
