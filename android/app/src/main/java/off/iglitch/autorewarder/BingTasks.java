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

/** Check-in / news in a WebView. Done only when getuserinfo says so. */
final class BingTasks {
    static final String UA =
            "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 "
                    + "(KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 "
                    + "BingSapphire/30.0.410309301";

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
                    + " const r=await fetch('https://rewards.bing.com/api/getuserinfo?type=1',{credentials:'include'});"
                    + " if(!r.ok) return JSON.stringify({readable:false,status:r.status});"
                    + " const data=await r.json();"
                    + " const dash=data.dashboard||{};"
                    + " const counters=((dash.userStatus||{}).counters)||{};"
                    + " function frac(keys){"
                    + "  for(var i=0;i<keys.length;i++){"
                    + "   var blob=counters[keys[i]];"
                    + "   if(Array.isArray(blob)) blob=blob[0];"
                    + "   if(!blob) continue;"
                    + "   var done=blob.pointProgress, max=blob.pointProgressMax;"
                    + "   if(typeof done==='number'&&typeof max==='number'&&max>0) return [done,max];"
                    + "  }"
                    + "  return null;"
                    + " }"
                    + " var news=frac(['readArticle','readarticle','newsSearch']);"
                    + " var checkin=null;"
                    + " var promos=[].concat(dash.promotionalItems||[], dash.morePromotions||[]);"
                    + " for(var i=0;i<promos.length;i++){"
                    + "  var p=promos[i]||{}; var parent=p.parentPromotion||p;"
                    + "  var ptype=String(parent.promotionType||'').toLowerCase();"
                    + "  var title=((parent.name||'')+' '+(parent.title||'')+' '+(parent.description||'')).toLowerCase();"
                    + "  if(ptype==='checkin'||title.indexOf('check-in')>=0||title.indexOf('check in')>=0){"
                    + "   checkin=parent.complete?[1,1]:[0,1]; break;"
                    + "  }"
                    + " }"
                    + " return JSON.stringify({readable:true,checkin:checkin,news:news});"
                    + "}catch(e){return JSON.stringify({readable:false,error:String(e)});}"
                    + "})();";

    private static final String NEWS_HREFS_JS =
            "(function(){"
                    + "var sel=['a.title','a.card-title','.title-container a','a.card-link','.news-card a',"
                    + "'a[href*=\"msn.com/\"]','a[href*=\"microsoftnews\"]','[class*=\"news\"] a[href]'];"
                    + "var out=[], seen={};"
                    + "for(var s=0;s<sel.length;s++){"
                    + " var els=document.querySelectorAll(sel[s]);"
                    + " for(var i=0;i<els.length;i++){"
                    + "  var h=els[i].href||'';"
                    + "  if(!h||seen[h]) continue;"
                    + "  if(h.indexOf('bing.com/search')>=0) continue;"
                    + "  if(h.indexOf('login')>=0) continue;"
                    + "  if(h.indexOf('http')!==0) continue;"
                    + "  seen[h]=1; out.push(h);"
                    + "  if(out.length>=8) return JSON.stringify(out);"
                    + " }"
                    + "}"
                    + "return JSON.stringify(out);"
                    + "})();";

    private static final String REWARDS_HOME = "https://rewards.bing.com/";
    private static final String LOGIN_URL =
            "https://login.live.com/login.srf?wa=wsignin1.0&wp=MBI_SSL&wreply="
                    + Uri.encode(REWARDS_HOME);
    private static final int TASK_DEADLINE_MS = 90000;
    private static final int PROBE_TIMEOUT_MS = 20000;
    private static final int LOGIN_COOKIE_SETTLE_MS = 700;
    private static final int LOGIN_REWARDS_LOAD_WAIT_MS = 1200;

    /** rewards / userInfo / userStatus id. HTML and an empty id are not a session. */
    private static final String SESSION_JS =
            "function clean(v){if(v==null)return '';v=String(v).trim();var l=v.toLowerCase();"
                    + "if(!v||l==='null'||l.indexOf('null-')===0||v==='0')return '';return v;}"
                    + "function fromUser(o){if(!o||typeof o!=='object')return '';"
                    + "return clean(o.id)||clean(o.userId)||clean(o.puid)||clean(o.ePuid)||clean(o.epuid)||'';}"
                    + "function sessionLoggedIn(data){"
                    + "if(!data||typeof data!=='object')return false;"
                    + "var rewards=data.rewards||{};"
                    + "var info=fromUser(data.userInfo)||fromUser(rewards.userInfo)||'';"
                    + "var dash=data.dashboard||data;"
                    + "var status=(dash&&dash.userStatus)||{};"
                    + "var statusId=clean(status.ePuid)||clean(status.epuid)||clean(status.id)||clean(status.puid)||clean(status.userId)||'';"
                    + "var attrs=(dash&&dash.userProfile&&dash.userProfile.attributes)||{};"
                    + "var profileId=clean(attrs.epuid)||clean(attrs.ePuid)||clean(attrs.id)||'';"
                    + "if(status.isRewardsUser===false&&!info)return false;"
                    + "return !!(info||statusId||profileId);"
                    + "}"
                    + "function resultFromText(text){"
                    + "text=String(text||'').replace(/^\\uFEFF/,'').trim();"
                    + "var low=text.slice(0,240).toLowerCase();"
                    + "if(!text)return {loggedIn:false,empty:true};"
                    + "if(low.indexOf('<!doctype')===0||low.indexOf('<html')===0||low.indexOf('<head')===0)"
                    + "return {loggedIn:false,html:true};"
                    + "var start=text.indexOf('{');var end=text.lastIndexOf('}');"
                    + "if(start<0||end<=start)return {loggedIn:false,html:low.indexOf('<')>=0};"
                    + "try{return {loggedIn:!!sessionLoggedIn(JSON.parse(text.slice(start,end+1)))};}"
                    + "catch(e){return {loggedIn:false,html:low.indexOf('<')>=0};}"
                    + "}";

    private static final String PROBE_BODY_JS =
            "(function(){" + SESSION_JS
                    + "var text='';"
                    + "try{text=(document.body&&(document.body.innerText||document.body.textContent))||'';}catch(e){}"
                    + "return JSON.stringify(resultFromText(text));"
                    + "})();";

    private static final String PROBE_FETCH_JS =
            "(function(){" + SESSION_JS
                    + "window.__arProbe='';"
                    + "function finish(obj){try{window.__arProbe=JSON.stringify(obj);}catch(e){window.__arProbe='{\"loggedIn\":false}';}}"
                    + "try{"
                    + "fetch('https://rewards.bing.com/api/getuserinfo?type=1&_='+Date.now(),{credentials:'include',headers:{Accept:'application/json'},cache:'no-store'})"
                    + ".then(function(r){var url=String(r.url||'');"
                    + "if(url.indexOf('login.live.com')>=0||url.indexOf('login.microsoftonline.com')>=0||url.indexOf('account.live.com')>=0){finish({loggedIn:false,html:true});return null;}"
                    + "return r.text();})"
                    + ".then(function(text){if(text==null)return;finish(resultFromText(text));})"
                    + ".catch(function(){finish({loggedIn:false});});"
                    + "}catch(e){finish({loggedIn:false});}"
                    + "return 'started';})();";

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
    private boolean newsSnapshotted = false;
    private int newsStart = -1;
    private String[] checkinUrls = new String[0];
    private boolean loginMode = false;
    private boolean probing = false;
    private int probeGeneration = 0;
    private boolean loginFallbackUsed = false;
    private String lastLoginProbeUrl = "";
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
                    activity.deliverSession(false);
                }
                return true;
            }
        });
    }

    boolean isLoginMode() {
        return loginMode;
    }

    void openLogin() {
        if (running) return;
        dropProbe();
        handler.removeCallbacksAndMessages(null);
        loginMode = true;
        loginFallbackUsed = false;
        lastLoginProbeUrl = "";
        bing.loadUrl(LOGIN_URL);
    }

    /** Close the login sheet, let WebView persist cookies, then verify from Rewards. */
    void finishLogin() {
        if (!loginMode) return;
        loginMode = false;
        lastLoginProbeUrl = "";
        activity.hideBingPanel();
        try { CookieManager.getInstance().flush(); } catch (Exception ignored) {}

        // The login redirect can finish just before Android has persisted the
        // account cookies. Probe only after that settles, and do it from a
        // Rewards page so the same-origin fetch can see the final session.
        handler.postDelayed(() -> {
            if (running) return;
            String current = bing.getUrl();
            if (canFetch(current)) {
                probeSession(activity::deliverSession);
                return;
            }
            bing.loadUrl(REWARDS_HOME);
            handler.postDelayed(() -> {
                if (!running) probeSession(activity::deliverSession);
            }, LOGIN_REWARDS_LOAD_WAIT_MS);
        }, LOGIN_COOKIE_SETTLE_MS);
    }

    void probeForUi() {
        probeSession(ok -> activity.deliverSession(ok));
    }

    private void probeSession(ProbeCallback callback) {
        if (running) {
            fetchProbe(probeGeneration, callback);
            return;
        }
        if (callback != null) probeWaiters.add(callback);
        if (probing) return;
        probing = true;
        final int gen = ++probeGeneration;
        armProbeTimeout(gen);
        String current = bing.getUrl();
        if (loginMode && isLogin(current)) {
            completeProbe(gen, false);
            return;
        }
        if (canFetch(current)) {
            fetchProbe(gen, ok -> completeProbe(gen, ok));
            return;
        }
        bing.loadUrl(probeUrl());
    }

    void start(String kind) {
        if (running) return;
        if (loginMode) {
            loginMode = false;
            lastLoginProbeUrl = "";
        }
        dropProbe();
        this.kind = kind == null ? "checkin" : kind;
        this.step = 0;
        this.waitingLogin = false;
        this.newsHrefs.clear();
        this.newsIndex = 0;
        this.running = true;
        this.sawReadable = false;
        this.newsSnapshotted = false;
        this.newsStart = -1;
        String mkt = BingMarket.get();
        this.checkinUrls = new String[] {
                "https://www.bing.com/?form=APMCS1&setmkt=" + mkt,
                "https://rewards.bing.com/dashboard?setmkt=" + mkt,
                "https://rewards.bing.com/?form=ML2N2V&setmkt=" + mkt
        };
        handler.removeCallbacksAndMessages(null);
        handler.postDelayed(() -> {
            if (running) finish(false, "no se pudo");
        }, TASK_DEADLINE_MS);
        if ("news".equals(this.kind)) {
            activity.setBingStatus("Abriendo noticias Bing…");
            bing.loadUrl("https://www.bing.com/news?form=APMCS1&setmkt=" + mkt + "&dcf=1");
        } else {
            activity.setBingStatus("Abriendo Rewards para check-in…");
            bing.loadUrl(checkinUrls[0]);
        }
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

    private static String probeUrl() {
        return "https://rewards.bing.com/api/getuserinfo?type=1&_=" + System.currentTimeMillis();
    }

    private static boolean canFetch(String url) {
        if (url == null) return false;
        return url.toLowerCase(Locale.US).startsWith("https://rewards.bing.com");
    }

    private void armProbeTimeout(int gen) {
        if (probeTimeout != null) handler.removeCallbacks(probeTimeout);
        probeTimeout = () -> completeProbe(gen, false);
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
        if (isLogin(url)) {
            completeProbe(gen, false);
            return;
        }
        String u = url == null ? "" : url.toLowerCase(Locale.US);
        if (!u.contains("getuserinfo")) return;
        readProbeBody(gen, 0);
    }

    private void readProbeBody(int gen, int attempt) {
        bing.evaluateJavascript(PROBE_BODY_JS, value -> {
            if (gen != probeGeneration || !probing) return;
            String raw = probeRaw(value);
            if ((raw == null || !raw.contains("loggedIn") || raw.contains("\"empty\":true")) && attempt < 1) {
                handler.postDelayed(() -> {
                    if (gen == probeGeneration && probing) readProbeBody(gen, attempt + 1);
                }, 700);
                return;
            }
            completeProbe(gen, probeLoggedIn(raw));
        });
    }

    private void onLoginPage(String url) {
        if (!loginMode || url == null) return;
        if (isLogin(url)) {
            activity.setBingStatus("Inicia sesión con la cuenta Microsoft. La sesión queda en esta app.");
            return;
        }
        String u = url.toLowerCase(Locale.US);
        boolean rewards = u.contains("rewards.bing.com");
        boolean bingHost = u.contains("://www.bing.com") || u.contains("://bing.com");
        if (!rewards && !bingHost) return;
        if (url.equals(lastLoginProbeUrl)) return;
        lastLoginProbeUrl = url;
        final int gen = probeGeneration;
        fetchProbe(gen, ok -> {
            if (!loginMode || gen != probeGeneration) return;
            if (ok) {
                sessionFoundFromLogin();
                return;
            }
            if (!loginFallbackUsed && !rewards) {
                loginFallbackUsed = true;
                lastLoginProbeUrl = "";
                bing.loadUrl(REWARDS_HOME);
            }
        });
    }

    private void sessionFoundFromLogin() {
        if (!loginMode) return;
        loginMode = false;
        lastLoginProbeUrl = "";
        probeGeneration++;
        probing = false;
        probeWaiters.clear();
        if (probeTimeout != null) handler.removeCallbacks(probeTimeout);
        try { CookieManager.getInstance().flush(); } catch (Exception ignored) {}
        activity.hideBingPanel();
        activity.deliverSession(true);
    }

    private void fetchProbe(int gen, ProbeCallback callback) {
        bing.evaluateJavascript(PROBE_FETCH_JS, value -> pollProbe(gen, 0, callback));
    }

    private void pollProbe(int gen, int tries, ProbeCallback callback) {
        if (gen != probeGeneration) return;
        if (tries > 40) {
            if (callback != null) callback.onResult(false);
            return;
        }
        handler.postDelayed(() -> {
            if (gen != probeGeneration) return;
            bing.evaluateJavascript("(function(){return window.__arProbe||'';})();", value -> {
                if (gen != probeGeneration) return;
                String raw = probeRaw(value);
                if (raw == null || !raw.contains("loggedIn")) {
                    pollProbe(gen, tries + 1, callback);
                    return;
                }
                if (callback != null) callback.onResult(probeLoggedIn(raw));
            });
        }, 300);
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
            if (o.optBoolean("html") || o.optBoolean("empty")) return false;
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
                || u.contains("account.live.com")
                || u.contains("account.microsoft.com");
    }

    private void onLoaded(String url) {
        if (!running) return;
        if (isLogin(url)) {
            waitingLogin = true;
            activity.setBingStatus("Inicia sesión con la misma cuenta Microsoft. Solo una vez; luego sigue solo.");
            return;
        }
        if (waitingLogin) {
            waitingLogin = false;
            activity.setBingStatus("Sesión guardada. Continuando…");
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
                if (o.optBoolean("readable")) {
                    sawReadable = true;
                    if (checkinDone(o)) {
                        finish(true, checkinLabel(o));
                        return;
                    }
                }
                bing.evaluateJavascript(CLICK_JS, clicked -> {
                    if (!running) return;
                    step++;
                    if (step < checkinUrls.length) {
                        activity.setBingStatus("Check-in, intento " + (step + 1) + "…");
                        bing.loadUrl(checkinUrls[step]);
                    } else {
                        confirmCheckin();
                    }
                });
            });
        }, 2500);
    }

    private void confirmCheckin() {
        handler.postDelayed(() -> {
            if (!running) return;
            bing.evaluateJavascript(SNAPSHOT_JS, value -> {
                if (!running) return;
                JSONObject o = parseObj(value);
                if (o.optBoolean("readable") && checkinDone(o)) {
                    finish(true, checkinLabel(o));
                    return;
                }
                if (!o.optBoolean("readable") && !sawReadable) {
                    finish(false, "ask:no se pudo leer getuserinfo");
                    return;
                }
                finish(false, "no se pudo");
            });
        }, 2500);
    }

    private void handleNews(String url) {
        if (!newsSnapshotted) {
            newsSnapshotted = true;
            final String page = url;
            handler.postDelayed(() -> {
                if (!running) return;
                bing.evaluateJavascript(SNAPSHOT_JS, value -> {
                    if (!running) return;
                    newsSnapshotted = true;
                    JSONObject o = parseObj(value);
                    if (!o.optBoolean("readable")) {
                        finish(false, "ask:no se pudo leer getuserinfo");
                        return;
                    }
                    JSONArray news = o.optJSONArray("news");
                    if (news == null || news.length() < 2 || news.optInt(1, 0) <= 0) {
                        finish(false, "no se pudo");
                        return;
                    }
                    int done = news.optInt(0, 0);
                    int max = news.optInt(1, 0);
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
            handler.postDelayed(this::openNextArticle, 12000);
        }
    }

    private void collectNews(String url) {
        if (url != null && url.contains("/news")) {
            handler.postDelayed(() -> bing.evaluateJavascript(NEWS_HREFS_JS, value -> {
                parseHrefs(value);
                openNextArticle();
            }), 2000);
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
        if (c == null || c.length() < 2) return "Check-in listo";
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
            finish(false, "No se encontraron noticias Bing para abrir");
            return;
        }
        if (newsIndex >= newsHrefs.size() || newsIndex >= 6) {
            verifyNews();
            return;
        }
        String href = newsHrefs.get(newsIndex);
        newsIndex++;
        activity.setBingStatus("Leyendo artículo " + newsIndex + "…");
        bing.loadUrl(href);
    }

    private void verifyNews() {
        bing.evaluateJavascript(SNAPSHOT_JS, value -> {
            if (!running) return;
            JSONObject o = parseObj(value);
            JSONArray news = o.optJSONArray("news");
            int now = news == null ? -1 : news.optInt(0, -1);
            int max = news == null ? 0 : news.optInt(1, 0);
            if (newsStart >= 0 && now > newsStart) {
                finish(true, "Noticias " + now + "/" + max);
                return;
            }
            finish(false, "no se pudo");
        });
    }

    private void finish(boolean ok, String detail) {
        running = false;
        handler.removeCallbacksAndMessages(null);
        try { CookieManager.getInstance().flush(); } catch (Exception ignored) {}
        activity.onBingTaskDone(ok, detail);
    }
}
