/* AutoRewarder phone companion — LAN or remote HTTPS tunnel (v4.4.6). */
function native() {
  try { return window.Android || null; } catch (e) { return null; }
}
const PHONE_PROTOCOL = 2;
const PHONE_JOB_KINDS = { checkin: 1, news: 1 };
const state = {
  base: "",
  lan: "",
  token: "",
  account: "",
  membership: "",
  phone: "",
  pendingJob: null,
  market: "",
  askingVerify: false,
  pairing: false,
  scanningQr: false,
  pcBusy: false,
  pcRunning: false,
  pendingPhoneUpdate: null,
  phoneUpdateCheckRunning: false,
  phoneUpdateDownloading: false,
  originalUpdateNotified: false,
  restored: false,
  bingReady: false,
  autoQueue: [],
};

// Keep slow mobile networks from stacking identical requests.
let overviewInFlight = false;
let jobsInFlight = false;
let heartbeatInFlight = false;

// Non-blocking native HTTP callback table so the WebView UI thread never freezes.
let _httpSeq = 0;
const _httpWaiters = {};

window.__onHttpAsync = function (reqId, resp) {
  const entry = _httpWaiters[reqId];
  if (!entry) return;
  delete _httpWaiters[reqId];
  clearTimeout(entry.timer);
  entry.resolve(resp);
};

function httpNativeAsync(method, url, body, token, timeoutMs) {
  const n = native();
  if (!n) return Promise.resolve(null);
  const payload = body ? JSON.stringify(body) : "";
  if (typeof n.httpAsync === "function") {
    return new Promise(function (resolve) {
      const reqId = "r" + (++_httpSeq) + "_" + Date.now();
      const ms = timeoutMs || (isLanUrl(url) ? 3200 : 14000);
      const timer = setTimeout(function () {
        if (_httpWaiters[reqId]) {
          delete _httpWaiters[reqId];
          resolve(JSON.stringify({ ok: false, error: "timeout" }));
        }
      }, ms);
      _httpWaiters[reqId] = { resolve: resolve, timer: timer };
      try {
        n.httpAsync(reqId, method, url, payload, token || "");
      } catch (e) {
        clearTimeout(timer);
        delete _httpWaiters[reqId];
        resolve(null);
      }
    });
  }
  if (typeof n.http === "function") {
    return new Promise(function (resolve) {
      setTimeout(function () {
        try {
          resolve(n.http(method, url, payload, token || ""));
        } catch (e) {
          resolve(null);
        }
      }, 0);
    });
  }
  return Promise.resolve(null);
}

function initLanguage() {
  try {
    const n = native();
    if (n && typeof n.getUiLang === "function") {
      const natLang = String(n.getUiLang() || "").trim();
      if (natLang && ["en", "es", "pt", "zh"].indexOf(natLang) >= 0) {
        applyUiLanguage(natLang);
        return;
      }
    }
  } catch (e) {}
  try {
    const saved = localStorage.getItem("ar_ui_lang");
    if (saved && ["en", "es", "pt", "zh"].indexOf(saved) >= 0) {
      applyUiLanguage(saved);
      return;
    }
  } catch (e) {}
  const nav = String((navigator && navigator.language) || "es").toLowerCase();
  let lang = "es";
  if (nav.indexOf("en") === 0) lang = "en";
  else if (nav.indexOf("pt") === 0) lang = "pt";
  else if (nav.indexOf("zh") === 0) lang = "zh";
  applyUiLanguage(lang);
}

function applyUiLanguage(locale) {
  if (!locale || typeof set_ui_lang !== "function") return;
  const clean = String(locale).trim().toLowerCase().split(/[-_]/)[0];
  if (["en", "es", "pt", "zh"].indexOf(clean) < 0) return;
  try { localStorage.setItem("ar_ui_lang", clean); } catch (e) {}
  try {
    const n = native();
    if (n && typeof n.setUiLang === "function") n.setUiLang(clean);
  } catch (e) {}
  if (typeof _uiLang === "undefined" || _uiLang !== clean) {
    set_ui_lang(clean);
  } else {
    set_ui_lang(clean);
  }
}

/**
 * Automatically mirror the PC's language, active account, membership, market,
 * and search counts whenever any response arrives from the PC bridge.
 */
function syncPcConfig(data) {
  if (!data || typeof data !== "object") return;
  if (data.ui_locale) {
    const clean = String(data.ui_locale).trim().toLowerCase().split(/[-_]/)[0];
    if (["en", "es", "pt", "zh"].indexOf(clean) >= 0 && (typeof _uiLang === "undefined" || _uiLang !== clean)) {
      applyUiLanguage(clean);
    }
  }
  let accountChanged = false;
  if (typeof data.account === "string" && data.account && data.account !== state.account) {
    state.account = data.account;
    accountChanged = true;
  }
  if (typeof data.membership === "string" && data.membership && data.membership !== state.membership) {
    state.membership = data.membership;
    accountChanged = true;
  }
  if (typeof data.ready === "boolean" && data.ready !== state.ready) {
    state.ready = data.ready;
    accountChanged = true;
  }
  if (data.market) {
    applyMarket(data.market);
  }
  if (data.queries && typeof data.queries === "object") {
    const pcEl = document.getElementById("count_pc");
    const mobEl = document.getElementById("count_mobile");
    if (pcEl && data.queries.pc != null && document.activeElement !== pcEl) {
      pcEl.value = data.queries.pc;
    }
    if (mobEl && data.queries.mobile != null && document.activeElement !== mobEl) {
      mobEl.value = data.queries.mobile;
    }
  }
  if (accountChanged && state.token) {
    persist();
    renderAccountHeader();
  }
}

function renderAccountHeader() {
  const msName = document.getElementById("ms_name");
  const msAvatar = document.getElementById("ms_avatar");
  const phName = document.getElementById("ph_name");
  const msMeta = document.getElementById("ms_meta");
  const phMeta = document.getElementById("ph_meta");
  if (msName) msName.textContent = state.account || t("phone.account");
  if (msAvatar) msAvatar.textContent = initials(state.account || "MS");
  if (phName) phName.textContent = state.phone || deviceName();
  const ready = state.ready ? t("phone.ready_state") : t("phone.setup_state");
  const mem = typeof translate_runtime_text === "function"
    ? translate_runtime_text(state.membership || "Microsoft Rewards")
    : (state.membership || "Microsoft Rewards");
  if (msMeta) msMeta.textContent = ready + " · " + mem + " · " + t("phone.by_microsoft");
  if (phMeta) phMeta.textContent = ready + " · " + mem + " · " + t("phone.by_phone");
}

function log(msg) {
  const area = document.getElementById("log_area");
  if (!area) return;
  const line = document.createElement("div");
  line.textContent = typeof translate_runtime_text === "function" ? translate_runtime_text(msg) : msg;
  area.appendChild(line);
  while (area.childElementCount > 400) {
    area.removeChild(area.firstChild);
  }
  area.scrollTop = area.scrollHeight;
}

function initials(name) {
  const parts = String(name || "?").trim().split(/\s+/);
  const a = (parts[0] || "?").charAt(0);
  const b = parts.length > 1 ? parts[1].charAt(0) : (parts[0] || "").charAt(1) || "";
  return (a + b).toUpperCase();
}

function loadSaved() {
  const n = native();
  try {
    if (n && n.loadPairing) {
      const raw = n.loadPairing();
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {}
  try {
    const raw = localStorage.getItem("ar_pair");
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

function savePair(data) {
  const raw = JSON.stringify(data);
  try { localStorage.setItem("ar_pair", raw); } catch (e) {}
  try {
    const n = native();
    if (n && n.savePairing) n.savePairing(raw);
  } catch (e) {}
}

function persist() {
  savePair({
    base: state.base,
    lan: state.lan,
    token: state.token,
    account: state.account,
    membership: state.membership,
    phone: state.phone,
    ready: state.ready,
  });
}

function clearPair() {
  try { localStorage.removeItem("ar_pair"); } catch (e) {}
  try {
    const n = native();
    if (n && n.clearPairing) n.clearPairing();
  } catch (e) {}
  state.token = "";
  state.base = "";
  state.lan = "";
}

function deviceName() {
  try { const n = native(); if (n && n.deviceName) return n.deviceName(); } catch (e) {}
  return "Phone";
}

function deviceModel() {
  try { const n = native(); if (n && n.deviceModel) return n.deviceModel(); } catch (e) {}
  return "";
}

function bases() {
  const out = [];
  const add = function (u) {
    if (!u) return;
    u = String(u).replace(/\/$/, "");
    if (out.indexOf(u) < 0) out.push(u);
  };
  add(state.base);
  add(state.lan);
  return out;
}

function isLanUrl(url) {
  try {
    const parsed = new URL(String(url));
    if (parsed.protocol !== "http:") return false;
    const host = parsed.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" ||
      /^10\./.test(host) || /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      /^169\.254\./.test(host) || host.endsWith(".local");
  } catch (e) {
    return false;
  }
}

async function fetchRaw(method, url, body, token, timeoutMs) {
  const github = String(url || "").indexOf("api.github.com") >= 0;
  const headers = {
    "Content-Type": "application/json",
    Accept: github ? "application/vnd.github+json" : "application/json",
  };
  if (token) headers.Authorization = "Bearer " + token;
  const ms = timeoutMs || 10000;
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, ms) : null;
  try {
    const res = await fetch(url, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl ? ctrl.signal : undefined,
    });
    const text = await res.text();
    if (res.ok) return text;
    try {
      const data = JSON.parse(text || "{}");
      if (data && typeof data === "object") {
        if (data.status == null) data.status = res.status;
        if (data.ok == null) data.ok = false;
        if (!data.error) data.error = "http";
        return JSON.stringify(data);
      }
    } catch (e) {}
    return JSON.stringify({ ok: false, status: res.status, error: "http" });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function sendHttp(method, url, body, token, timeoutMs) {
  const ms = timeoutMs || (isLanUrl(url) ? 2800 : 12000);
  const text = await httpNativeAsync(method, url, body, token, ms);
  if (text != null && text !== "") return text;
  return fetchRaw(method, url, body, token, ms);
}

function isAuthError(e) {
  return String((e && e.message) || e) === "auth";
}

function isPcAppError(data) {
  if (!data || data.ok !== false || !data.error) return false;
  const known = {
    already_running: 1,
    no_microsoft_account: 1,
    microsoft_setup_pending: 1,
    browser_loading: 1,
    bad_code: 1,
    rate_limit: 1,
    expired: 1,
    no_account: 1,
    busy: 1,
    unknown_job: 1,
    unknown_mode: 1,
    protocol: 1,
    already_done: 1,
  };
  return !!known[data.error];
}

function protocolOk(data) {
  if (!data || data.protocol == null || data.protocol === "") return true;
  const p = Number(data.protocol);
  if (!isFinite(p)) return true;
  if (p > PHONE_PROTOCOL) {
    return false;
  }
  return true;
}

function androidId() {
  try {
    const n = native();
    if (n && n.androidId) return String(n.androidId() || "");
  } catch (e) {}
  return "";
}

function dropLink(reason) {
  clearPair();
  showPair();
  if (reason) setPairStatus(reason);
  try { if (native() && native().discover) native().discover(); } catch (e) {}
}

function forgetStaleOn(url) {
  const id = androidId();
  if (!id || !url || state.token) return;
  const base = String(url).replace(/\/$/, "");
  const body = { android_id: id, name: deviceName(), model: deviceModel() };
  sendHttp("POST", base + "/phone/forget", body, "", 2500).catch(function () {});
  sendHttp("GET", base + "/discover", null, "", 2500).then(function (txt) {
    try {
      const d = JSON.parse(txt || "{}");
      if (d && d.ui_locale) syncPcConfig(d);
    } catch (e) {}
  }).catch(function () {});
}

async function request(method, path, body, customTimeoutMs) {
  const urls = bases();
  if (!urls.length) throw new Error("not linked");
  let last = null;
  const maxAttempts = method === "GET" ? 1 : 2;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i] + path;
      try {
        const text = await sendHttp(
          method, url, body, state.token, customTimeoutMs || (isLanUrl(url) ? 2200 : 12000)
        );
        const data = JSON.parse(text || "{}");
        if (data && data.error === "auth") throw new Error("auth");
        if (!protocolOk(data)) throw new Error("protocol");
        if (data && typeof data === "object") syncPcConfig(data);
        if (isPcAppError(data)) return data;
        if (data && data.ok === false && data.error && data.status == null) {
          last = new Error(data.error);
          continue;
        }
        if (urls[i].indexOf("192.") >= 0 || urls[i].indexOf("10.") >= 0 || urls[i].indexOf("172.") >= 0) {
          state.lan = urls[i];
        } else {
          state.base = urls[i];
        }
        persist();
        return data;
      } catch (e) {
        last = e;
      }
    }
  }
  throw last || new Error("offline");
}

function showMain() {
  document.getElementById("pair_screen").hidden = true;
  document.getElementById("main_screen").hidden = false;
  renderAccountHeader();
  updateBingUi();
}

function showPair() {
  document.getElementById("pair_screen").hidden = false;
  document.getElementById("main_screen").hidden = true;
}

function setPairStatus(msg) {
  const status = document.getElementById("pair_status");
  if (!status) return;
  status.textContent = typeof translate_runtime_text === "function" ? translate_runtime_text(msg) : msg;
}

function parseAr2(msg) {
  const parts = String(msg || "").split("|");
  if (parts[0] !== "AR2" || parts.length < 3) return null;
  if (parts.length >= 5) {
    return {
      url: parts.slice(1, parts.length - 3).join("|"),
      code: parts[parts.length - 3] || "",
      sig: parts[parts.length - 2] || "",
      until: Number(parts[parts.length - 1] || 0),
    };
  }
  return { url: parts[1], code: parts[2] || "", sig: parts[3] || "", until: 0 };
}

window.onBeaconRaw = function (msg) {
  const raw = String(msg || "");
  const parts = raw.split("|");
  if (parts[0] === "AR1" && parts.length >= 4) {
    const ip = parts[1];
    const port = parts[2];
    const code = parts[3];
    const remote = parts.length >= 5 ? parts[4] : "";
    const url = remote && remote.indexOf("http") === 0 ? remote : ("http://" + ip + ":" + port);
    applyFound({ url: url, code: code, sig: "" });
    return;
  }
  const found = parseAr2(raw);
  if (!found) return;
  if (found.until && found.until * 1000 < Date.now() - 30000) return;
  applyFound(found);
};

function applyFound(found) {
  if (!found || !found.url || found.url.indexOf("http") !== 0) return;
  state.found = found;
  const codeEl = document.getElementById("pair_code");
  if (found.code && found.code.length === 6 && codeEl) {
    codeEl.value = found.code;
  }
  if (state.token && found.url && found.code === "-") {
    if (found.url !== state.base) {
      state.base = found.url;
      persist();
      request("GET", "/me").catch(function () {});
    }
    return;
  }
  if (found.code && found.code !== "-") {
    setPairStatus(t("phone.pc_found_confirm"));
  } else if (found.url) {
    setPairStatus(t("phone.pc_found_enter"));
  }
  if (!state.token && found.url) forgetStaleOn(found.url);
}

function parsePairText(text) {
  text = String(text || "").trim();
  if (!text) return null;
  if (/github\.com\/.*\/releases|\.apk(?:\?|#|$)/i.test(text)) {
    return { kind: "apk_qr" };
  }
  if (/^\d{6}$/.test(text)) {
    const codeEl = document.getElementById("pair_code");
    if (codeEl) codeEl.value = text;
    return { code: text };
  }
  if (/^AR\d+\|/i.test(text)) {
    window.onBeaconRaw(text);
    const parts = text.split("|");
    const url = parts.length >= 2 ? parts[1] : "";
    const code = parts.length >= 3 ? parts[2] : "";
    if (url && /^https?:\/\//i.test(url)) {
      return { url: url, code: code };
    }
  }
  return null;
}

function normalizeBase(raw) {
  let v = String(raw || "").trim();
  if (!v) return "";
  if (v.indexOf("http") !== 0) v = "http://" + v;
  return v.replace(/\/$/, "");
}

function setPairBusy(busy) {
  const btn = document.querySelector("#pair_screen .primary-btn-lg");
  const qr = document.querySelector("#pair_screen .qr-square");
  if (btn) btn.disabled = !!busy;
  if (qr) qr.disabled = !!busy;
}

function scanQr() {
  if (state.scanningQr || state.pairing) {
    setPairStatus(state.pairing ? t("phone.already_pairing") : t("phone.camera_open"));
    return;
  }
  setPairStatus(t("camera_opening"));
  if (native() && native().scanQr) {
    state.scanningQr = true;
    setPairBusy(true);
    native().scanQr();
    return;
  }
  setPairStatus(t("camera_android_only"));
}

window.onQrScanFailed = function (msg) {
  state.scanningQr = false;
  if (!state.pairing) setPairBusy(false);
  if (msg === "camera_denied") setPairStatus(t("phone.camera_denied"));
  else if (msg === "camera_closed" || !msg) setPairStatus(t("phone.camera_closed"));
  else setPairStatus(msg);
};

window.onLanFound = function (url) {
  if (url) applyFound({ url: url, code: "-", sig: "" });
  state.lanScanDone = true;
};

window.onQrScanned = function (text) {
  state.scanningQr = false;
  if (!state.pairing) setPairBusy(false);
  let parsed = null;
  try {
    parsed = parsePairText(text);
  } catch (e) {
    parsed = null;
  }
  if (parsed && parsed.kind === "apk_qr") {
    setPairStatus(t("phone.qr_step1_notice"));
    return;
  }
  if (parsed && parsed.url) {
    setPairStatus(t("phone.qr_scanned_linking"));
    doPair();
    return;
  }
  if (parsed && parsed.code) {
    setPairStatus(t("phone.code_read_looking"));
    doPair();
    return;
  }
  setPairStatus(t("phone.qr_invalid_notice"));
};

function waitForUrl(ms) {
  return new Promise(function (resolve) {
    const start = Date.now();
    const tick = function () {
      if (state.found && state.found.url) return resolve(true);
      if (Date.now() - start >= ms) return resolve(false);
      setTimeout(tick, 200);
    };
    tick();
  });
}

async function doPair() {
  if (state.pairing) {
    setPairStatus(t("phone.already_pairing"));
    return;
  }
  const code = String(document.getElementById("pair_code").value || "").replace(/\D/g, "");
  if (code.length !== 6) {
    setPairBusy(false);
    setPairStatus(t("phone.enter_code"));
    return;
  }
  state.pairing = true;
  setPairBusy(true);
  try {
    if (!state.found || !state.found.url) {
      setPairStatus(t("phone_searching"));
      try { if (native() && native().discover) native().discover(); } catch (e) {}
      try { if (native() && native().scanLan) native().scanLan(); } catch (e) {}
      await waitForUrl(6000);
    }
    const found = state.found;
    if (!found || !found.url) {
      setPairStatus(t("phone.pc_not_seen"));
      return;
    }
    const urls = [];
    const addUrl = function (u) {
      u = normalizeBase(u);
      if (u && urls.indexOf(u) < 0) urls.push(u);
    };
    addUrl(found.url);
    addUrl(state.lan);
    addUrl(state.base);
    setPairStatus(t("phone_pairing"));
    let data = null;
    let used = "";
    for (let i = 0; i < urls.length; i++) {
      const base = urls[i];
      const payload = {
        code: code,
        sig: found.sig || "",
        url: base,
        name: deviceName(),
        model: deviceModel(),
        android_id: androidId(),
        protocol: PHONE_PROTOCOL,
      };
      try {
        const text = await sendHttp("POST", base + "/pair", payload, "", isLanUrl(base) ? 3000 : 12000);
        data = JSON.parse(text || "{}");
      } catch (e) {
        data = null;
        continue;
      }
      if (data && data.ok && data.token) {
        used = base;
        break;
      }
    }
    if (!data || !data.ok || !data.token) {
      const msg = (data && (data.message || data.error)) || "";
      setPairStatus(msg || t("phone.pc_not_seen"));
      return;
    }
    state.token = data.token;
    state.account = data.account || state.account;
    state.membership = data.membership || state.membership;
    state.phone = data.phone || deviceName();
    state.ready = !!data.ready;
    state.base = data.public_url || data.url || used;
    state.lan = data.lan_url || (used.indexOf("192.") >= 0 || used.indexOf("10.") >= 0 ? used : state.lan);
    syncPcConfig(data);
    persist();
    showMain();
    log("Linked to " + state.account);
    refreshOverview();
    reportEvent("paired", true, "linked");
    ensureBingSetup(true);
  } catch (e) {
    setPairStatus(t("phone.pc_not_seen"));
  } finally {
    state.pairing = false;
    setPairBusy(false);
  }
}

async function restore() {
  const saved = loadSaved();
  if (!saved || !saved.token) {
    showPair();
    try { if (native() && native().discover) native().discover(); } catch (e) {}
    try { if (native() && native().scanLan) native().scanLan(); } catch (e) {}
    if (state.found && state.found.url) forgetStaleOn(state.found.url);
    return;
  }
  state.base = saved.base || saved.public_url || "";
  state.lan = saved.lan || saved.lan_url || "";
  state.token = saved.token;
  state.account = saved.account;
  state.membership = saved.membership;
  state.phone = saved.phone || deviceName();
  state.ready = !!saved.ready;
  showMain();
  try { if (native() && native().discover) native().discover(); } catch (e) {}
  try {
    const me = await request("GET", "/me");
    if (me && me.error === "auth") throw new Error("auth");
    if (!me || !me.ok) throw new Error("unreachable");
    syncPcConfig(me);
    showAppVersion();
    persist();
    showMain();
    refreshOverview();
    ensureBingSetup(false);
  } catch (e) {
    if (isAuthError(e)) {
      dropLink(t("phone.unlinked_by_pc"));
      return;
    }
    const again = await reconnect(state.lan || state.base);
    if (again) return;
    const hint = document.getElementById("offline_hint");
    if (hint) {
      hint.hidden = false;
      hint.textContent = t("phone.offline_banner");
    }
  }
}

let reconnecting = false;
async function reconnect(hostOverride) {
  if (reconnecting) return false;
  const typed = String((document.getElementById("reconnect_host") || {}).value || "").trim();
  const host = hostOverride || typed || state.lan || state.base;
  if (!host) return false;
  reconnecting = true;
  state.base = normalizeBase(host.indexOf("http") === 0 || host.indexOf(":") >= 0 ? host : host + ":38471");
  persist();
  try {
    const me = await request("GET", "/me");
    if (me && me.ok) {
      syncPcConfig(me);
      log(t("phone.reconnected"));
      const recon = document.getElementById("reconnect_wrap");
      if (recon) recon.hidden = true;
      const hint = document.getElementById("offline_hint");
      if (hint) hint.hidden = true;
      refreshOverview();
      return true;
    }
  } catch (e) {
  } finally {
    reconnecting = false;
  }
  return false;
}

async function refreshOverview() {
  if (overviewInFlight) return;
  overviewInFlight = true;
  try {
    const data = await request("GET", "/overview");
    if (!data || !data.ok) {
      applyPcButtons(state.pcRunning);
      return;
    }
    syncPcConfig(data);
    const profile = data.profile || {};
    const progress = data.progress || {};
    const set = function (id, v) {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    const memText = typeof translate_runtime_text === "function"
      ? translate_runtime_text(profile.membership || state.membership || "Microsoft Rewards")
      : (profile.membership || state.membership || "Microsoft Rewards");
    const regText = typeof translate_runtime_text === "function"
      ? translate_runtime_text(profile.country || "Colombia")
      : (profile.country || "Colombia");
    set("rewards_level", memText);
    set("rewards_region", regText);
    const frac = function (obj, fallback) {
      if (obj && typeof obj === "object") return obj.label || fallback || "—";
      if (obj != null && obj !== "") return String(obj);
      return fallback || "—";
    };
    set("progress_pc", t("phone.progress.pc") + ": " + frac(progress.pc));
    set("progress_mobile", t("phone.progress.mobile") + ": " + frac(progress.mobile));
    set("progress_daily", t("phone.progress.daily") + ": " + (typeof translate_runtime_text === "function" ? translate_runtime_text(frac(progress.daily)) : frac(progress.daily)));
    set("progress_visual", t("phone.progress.visual") + ": " + (typeof translate_runtime_text === "function" ? translate_runtime_text(frac(progress.visual)) : frac(progress.visual)));
    set("progress_checkin", t("phone.progress.checkin") + ": " + frac(progress.checkin));
    set("progress_news", t("phone.progress.news") + ": " + frac(progress.news));
    set("progress_edge", t("phone.progress.edge") + ": " + frac(progress.edge));
    set("progress_reset", t("phone.progress.reset") + ": " + (typeof translate_runtime_text === "function" ? translate_runtime_text(progress.reset || "—") : (progress.reset || "—")));
    const st = document.getElementById("status_text");
    const dot = document.getElementById("dot");
    if (st) st.textContent = data.running ? t("phone.pc_running") : t("phone.linked_ready");
    if (dot) {
      dot.classList.toggle("active", !!data.running);
      dot.classList.toggle("ready", !data.running);
    }
    const hint = document.getElementById("offline_hint");
    if (hint) hint.hidden = true;
    const running = !!data.running;
    applyPcButtons(running);
    const derived = data.stats || {};
    set("stat_total", derived.is_estimate ? "—" : (derived.total_points == null ? "—" : Number(derived.total_points).toLocaleString()));
    set("stat_today", derived.today_is_estimate ? "—" : (derived.today_points == null ? "—" : Number(derived.today_points).toLocaleString()));
    const block = data.block;
    const br = document.getElementById("run_block_reason");
    if (br) {
      if (block && block.message) {
        br.hidden = false;
        br.textContent = typeof translate_runtime_text === "function" ? translate_runtime_text(block.message) : block.message;
      } else {
        br.hidden = true;
      }
    }
  } catch (e) {
    applyPcButtons(state.pcRunning);
  } finally {
    overviewInFlight = false;
  }
}

async function saveQueries() {
  const pcEl = document.getElementById("count_pc");
  const mobEl = document.getElementById("count_mobile");
  let pc = Math.max(0, Math.min(130, Math.floor(Number((pcEl || {}).value || 0))));
  let mobile = Math.max(0, Math.min(99, Math.floor(Number((mobEl || {}).value || 0))));
  if (pcEl) pcEl.value = pc;
  if (mobEl) mobEl.value = mobile;
  try {
    const data = await request("POST", "/pc/queries", { pc: pc, mobile: mobile });
    if (data && data.pc != null) pc = data.pc;
    if (data && data.mobile != null) mobile = data.mobile;
    if (pcEl) pcEl.value = pc;
    if (mobEl) mobEl.value = mobile;
    log(t("phone.searches_saved").replace("{pc}", pc).replace("{mobile}", mobile));
  } catch (e) {}
}

async function pollJobs() {
  if (!state.token || jobsInFlight) return;
  jobsInFlight = true;
  try {
    const data = await request("GET", "/jobs");
    if (data) syncPcConfig(data);
    const jobs = (data && data.jobs) || [];
    for (let i = 0; i < jobs.length; i++) handleJob(jobs[i]);
  } catch (e) {} finally {
    jobsInFlight = false;
  }
}

function handleJob(job) {
  if (!job || typeof job !== "object") return;
  const id = String(job.id || "").trim();
  const kind = String(job.kind || "");
  if (!id) return;
  if (!PHONE_JOB_KINDS[kind]) {
    request("POST", "/jobs/" + encodeURIComponent(id) + "/done", { ok: false, detail: "unknown_job" }).catch(function () {});
    return;
  }
  state.pendingJob = job;
  if (job.market) applyMarket(job.market);
  log(t("phone.pc_job").replace("{kind}", kind));
  const banner = document.getElementById("job_banner");
  if (banner) {
    banner.hidden = false;
    banner.textContent = t("phone.pc_job").replace("{kind}", kind);
  }
  runPhone(kind, true);
}

function detailDeniesSuccess(detail) {
  const text = String(detail || "").toLowerCase();
  const blocked = ["not verified", "ask:", "opened", "no se pudo", "timeout", "abiertas", "closed"];
  for (let i = 0; i < blocked.length; i++) {
    if (text.indexOf(blocked[i]) >= 0) return true;
  }
  return false;
}

function detailHasTaskCounter(detail) {
  const m = String(detail || "").match(/(?:check-in|noticias|news)\s+(\d+)\s*\/\s*(\d+)/i);
  if (!m) return false;
  const done = Number(m[1]);
  const max = Number(m[2]);
  return done > 0 && max > 0;
}

function reportedTaskOk(ok, detail) {
  if (!ok || detailDeniesSuccess(detail)) return false;
  return detailHasTaskCounter(detail);
}

async function finishPending(ok, detail) {
  ok = reportedTaskOk(ok, detail);
  const job = state.pendingJob;
  const id = job ? String(job.id || "").trim() : "";
  if (id) {
    try {
      await request("POST", "/jobs/" + encodeURIComponent(id) + "/done", { ok: !!ok, detail: detail || "" });
    } catch (e) {}
  }
  state.pendingJob = null;
  const banner = document.getElementById("job_banner");
  if (banner) {
    banner.hidden = true;
    banner.textContent = "";
  }
  log(ok ? (detail || t("ready")) : (detail || t("status.pending")));
}

function applyPcButtons(running) {
  state.pcRunning = !!running;
  if (state.pcBusy) return;
  ["pc_start_btn", "pc_tasks_btn", "pc_edge_btn"].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.disabled = !!running;
  });
  const stop = document.getElementById("pc_stop_btn");
  if (stop) stop.disabled = !running;
}

async function runPc(mode) {
  if (state.pcBusy) return;
  state.pcBusy = true;
  ["pc_start_btn", "pc_tasks_btn", "pc_edge_btn"].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });
  try {
    const data = await request("POST", "/pc/run", { mode: mode });
    if (data && data.ok) log("PC: " + mode);
    else {
      const msg = (data && data.message) || (data && data.error) || "blocked";
      log(msg);
    }
  } catch (e) {
    log(t("phone.offline_banner"));
  } finally {
    state.pcBusy = false;
    refreshOverview();
  }
}

async function stopPc() {
  if (state.pcBusy) return;
  state.pcBusy = true;
  const stop = document.getElementById("pc_stop_btn");
  if (stop) stop.disabled = true;
  try {
    const data = await request("POST", "/pc/stop", { manual: true });
    if (data && (data.ok || data.stopped)) {
      const st = document.getElementById("status_text");
      if (st) st.textContent = t("phone.stop");
    }
  } catch (e) {
  } finally {
    state.pcBusy = false;
    refreshOverview();
  }
}

function bingPackageState() {
  try {
    const n = native();
    if (n && n.bingPackageState) {
      const s = String(n.bingPackageState() || "");
      if (s === "disabled" || s === "installed" || s === "missing") return s;
    }
    if (n && n.hasBing) return n.hasBing() ? "installed" : "missing";
  } catch (e) {}
  return "missing";
}

function bingInstalled() {
  return bingPackageState() === "installed";
}

function setBingBanner(msg, warn) {
  const el = document.getElementById("bing_banner");
  if (!el) return;
  if (!msg) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = typeof translate_runtime_text === "function" ? translate_runtime_text(msg) : msg;
  el.classList.toggle("warn", !!warn);
}

function updateBingUi() {
  const st = bingPackageState();
  const pill = document.getElementById("bing_pill");
  const loginBtn = document.getElementById("bing_login_btn");
  const setup = document.getElementById("bing_setup_actions");
  const autoAllBtn = document.getElementById("phone_auto_all_btn");
  const checkinBtn = document.getElementById("phone_checkin_btn");
  const newsBtn = document.getElementById("phone_news_btn");
  const readyBtn = document.getElementById("bing_ready_btn");
  if (pill) {
    pill.classList.toggle("ready", !!state.bingReady);
    if (state.bingReady) pill.textContent = t("bing.ready");
    else if (st === "disabled") pill.textContent = t("bing.disabled");
    else pill.textContent = t("bing.nosession");
  }
  const showLogin = !state.bingReady;
  const showReady = !state.bingReady;
  if (loginBtn) loginBtn.hidden = !showLogin;
  if (readyBtn) readyBtn.hidden = !showReady;
  if (setup) setup.hidden = !(showLogin || showReady);
  const busy = !!state.pendingVerify || !!state.verifying;
  [autoAllBtn, checkinBtn, newsBtn].forEach(function (el) {
    if (el) el.disabled = !state.bingReady || busy;
  });
  if (state.waitingBingLogin) {
    setBingBanner(t("bing.install_banner"), true);
  } else if (state.probingSession || state.verifying) {
    // Keep active status banner
  } else if (state.askingVerify) {
    // askPending sets its own banner
  } else if (!state.bingReady) {
    setBingBanner(t("bing.nosession"), true);
  } else if (!state.pendingVerify) {
    setBingBanner("");
  }
}

function ensureBingSetup(justPaired) {
  updateBingUi();
  probeBingSession(justPaired ? "paired" : "status");
}

function confirmBingReady() {
  if (state.pendingVerify) {
    verifyPending();
    return;
  }
  log(t("phone.checking_session"));
  setBingBanner(t("phone.checking_session"), false);
  probeBingSession("manual");
}

function applyMarket(market) {
  const m = String(market || "").trim();
  if (!m) return;
  state.market = m;
  try { if (native() && native().setMarket) native().setMarket(m); } catch (e) {}
}

function showAppVersion() {
  const el = document.getElementById("app_version");
  if (!el) return;
  let ver = "4.4.6";
  try {
    const n = native();
    if (n && n.appVersionName) ver = String(n.appVersionName() || ver);
  } catch (e) {}
  el.textContent = "Microsoft Rewards · " + ver;
}

function askPending(kind) {
  state.askingVerify = true;
  state.pendingVerify = kind || state.pendingVerify;
  setBingBanner(t("phone.checking_session"), true);
  updateBingUi();
}

function verifyPending() {
  const kind = state.pendingVerify;
  if (!kind) return;
  state.askingVerify = false;
  state.verifying = true;
  updateBingUi();
  setBingBanner(t("phone.verifying_rewards"), true);
  try {
    if (native() && native().runTask) {
      native().runTask(kind);
      return;
    }
  } catch (e) {}
  state.verifying = false;
  askPending(kind);
}

function probeBingSession(purpose) {
  purpose = purpose || "status";
  if (state.probingSession) {
    state.probeAgain = purpose;
    return;
  }
  state.probingSession = true;
  state.probePurpose = purpose;
  let started = false;
  try {
    if (native() && native().probeBingSession) {
      native().probeBingSession();
      started = true;
    }
  } catch (e) {}
  if (!started) {
    state.probingSession = false;
    state.probePurpose = "";
    deliverProbe(false, purpose);
  }
}

function deliverProbe(loggedIn, purpose) {
  const wasReady = !!state.bingReady;
  if (loggedIn) {
    state.bingReady = true;
    state.waitingBingLogin = false;
  } else if (state.waitingBingLogin && purpose !== "paired") {
    state.waitingBingLogin = false;
    state.bingReady = false;
  } else {
    state.bingReady = false;
  }
  updateBingUi();
  if (purpose === "success") {
    const pending = state.pendingSuccess;
    state.pendingSuccess = null;
    const kind = pending ? pending.kind : (state.pendingVerify || "task");
    const detail = pending ? pending.detail : "no se pudo";
    if (!loggedIn || !pending || !reportedTaskOk(true, detail)) {
      state.bingReady = !!loggedIn;
      state.pendingVerify = null;
      state.askingVerify = false;
      state.verifying = false;
      state.autoQueue = [];
      updateBingUi();
      setBingBanner(t("bing.nosession"), true);
      return;
    }
    state.pendingVerify = null;
    state.askingVerify = false;
    finishPending(true, detail);
    reportEvent(kind, true, detail);
    refreshAll();
    if (state.autoQueue && state.autoQueue.length > 0) {
      const nextKind = state.autoQueue.shift();
      setTimeout(function () { runPhone(nextKind, true); }, 600);
    }
    return;
  }
  if (purpose === "thenVerify") {
    const kind = state.probeKind || state.pendingVerify;
    if (!loggedIn) {
      state.pendingVerify = null;
      state.askingVerify = false;
      state.verifying = false;
      updateBingUi();
      setBingBanner(t("bing.nosession"), true);
      return;
    }
    setBingBanner(t("phone.verifying_rewards"), true);
    state.verifying = true;
    updateBingUi();
    let started = false;
    try {
      if (native() && native().runTask) {
        native().runTask(kind);
        started = true;
      }
    } catch (e) {}
    if (!started) {
      state.verifying = false;
      askPending(kind);
    }
    return;
  }
  if (loggedIn) {
    if (!wasReady || purpose === "manual") {
      log(t("phone.session_ready_log"));
    }
    setBingBanner("");
    if (state.pendingBingKind) {
      const kind = state.pendingBingKind;
      state.pendingBingKind = null;
      runPhone(kind, true);
    }
    return;
  }
  if (purpose === "manual") {
    log(t("phone.session_missing_log"));
    setBingBanner(t("bing.nosession"), true);
    return;
  }
  if (purpose === "paired" && !state.waitingBingLogin) {
    loginBingApp();
  }
}

window.onBingSession = function (loggedIn) {
  const purpose = state.probingSession ? (state.probePurpose || "status") : "status";
  const again = state.probeAgain || "";
  state.probingSession = false;
  state.probePurpose = "";
  state.probeAgain = "";
  deliverProbe(!!loggedIn, purpose);
  if (again && again !== purpose) probeBingSession(again);
};

function loginBingApp() {
  log(t("phone.opening_login"));
  state.probingSession = false;
  state.probePurpose = "";
  state.waitingBingLogin = true;
  updateBingUi();
  let ok = true;
  try {
    if (native() && native().openRewardsLogin) ok = native().openRewardsLogin() !== false;
    else ok = false;
  } catch (e) {
    ok = false;
  }
  if (!ok) {
    state.waitingBingLogin = false;
    updateBingUi();
  }
}

function runAllPhoneTasks() {
  if (state.pendingVerify || state.verifying) return;
  state.autoQueue = ["news"];
  runPhone("checkin", true);
}

function runPhone(kind, forceAutomated) {
  if (state.pendingVerify) return;
  updateBingUi();
  if (!state.bingReady) {
    state.pendingBingKind = kind;
    if (!state.waitingBingLogin) loginBingApp();
    return;
  }
  if (state.market) applyMarket(state.market);
  const label = kind === "news" ? t("phone.news") : t("phone.checkin");
  state.askingVerify = false;
  state.pendingVerify = kind;
  state.verifying = true;
  updateBingUi();
  log(tf("phone.executing_task", { task: label }));
  setBingBanner(tf("phone.executing_task", { task: label }), false);
  if (native() && native().runTask) {
    native().runTask(kind);
    return;
  }
  if (native() && native().openBing) {
    native().openBing(kind);
  }
}

window.onBingProgress = function (msg) {
  if (!msg) return;
  if (state.verifying || state.pendingVerify) {
    setBingBanner(msg, false);
  }
};

window.onBingTask = function (ok, detail) {
  const kind = state.pendingVerify || "task";
  const text = String(detail || "");
  state.verifying = false;
  if (text === "closed") {
    state.pendingVerify = null;
    state.askingVerify = false;
    state.autoQueue = [];
    updateBingUi();
    return;
  }
  if (text.indexOf("ask:") === 0) {
    state.autoQueue = [];
    askPending(kind);
    return;
  }
  const msg = text || (ok ? t("ready") : "no se pudo");
  const reported = reportedTaskOk(ok, msg);
  if (!reported) {
    state.pendingVerify = null;
    state.askingVerify = false;
    finishPending(false, msg);
    reportEvent(kind, false, msg);
    refreshAll();
    if (state.autoQueue && state.autoQueue.length > 0) {
      const nextKind = state.autoQueue.shift();
      setTimeout(function () { runPhone(nextKind, true); }, 600);
    }
    return;
  }
  state.pendingSuccess = { kind: kind, detail: msg };
  setBingBanner(t("phone.checking_session"), false);
  probeBingSession("success");
};

function reportEvent(kind, ok, detail) {
  if (!state.token) return;
  if (kind === "checkin" || kind === "news" || kind === "task") ok = reportedTaskOk(ok, detail);
  else if (detailDeniesSuccess(detail)) ok = false;
  request("POST", "/phone/event", {
    kind: kind || "",
    ok: !!ok,
    detail: detail || "",
  }).then(function () {
    refreshOverview();
  }).catch(function () {});
}

function refreshAll() {
  updateBingUi();
  refreshOverview();
  pollJobs();
}

window.onAppResume = function () {
  try { if (native() && native().keepDiscovering) native().keepDiscovering(); } catch (e) {}
  try { if (native() && native().discover) native().discover(); } catch (e) {}
  const st = bingPackageState();
  updateBingUi();
  if (state.waitingBingInstall && st === "installed") {
    state.waitingBingInstall = false;
    state.bingReady = false;
    loginBingApp();
  } else if (state.waitingBingLogin || state.verifying || state.pendingSuccess) {
    updateBingUi();
  } else if (state.pendingVerify && !state.askingVerify) {
    const kind = state.pendingVerify;
    state.probeKind = kind;
    setBingBanner(t("phone.checking_session"), false);
    probeBingSession("thenVerify");
  } else if (!state.bingReady) {
    probeBingSession("status");
  }
  if (state.token) refreshAll();
};

async function heartbeat() {
  if (!state.token || heartbeatInFlight) return;
  heartbeatInFlight = true;
  try { if (native() && native().keepDiscovering) native().keepDiscovering(); } catch (e) {}
  try {
    const me = await request("GET", "/me");
    if (me) syncPcConfig(me);
    const hint = document.getElementById("offline_hint");
    if (hint) hint.hidden = true;
  } catch (e) {
    if (isAuthError(e)) {
      dropLink(t("phone.unlinked_by_pc"));
      return;
    }
    const hint = document.getElementById("offline_hint");
    if (hint) {
      hint.hidden = false;
      hint.textContent = t("phone.offline_banner");
    }
  } finally {
    heartbeatInFlight = false;
  }
}

/**
 * Unlink this phone immediately. Attempts to notify the PC first with a short
 * timeout, then always clears local pairing and returns to the link screen.
 */
async function unlinkPhone() {
  const btn = document.getElementById("unlink_btn") || document.querySelector("button.phone-mini");
  if (btn) btn.disabled = true;
  try {
    if (state.token) {
      await request("POST", "/phone/unlink", {}, 2500);
    }
  } catch (e) {
    // Even if the PC is offline or unreachable, always unlink locally.
  } finally {
    dropLink(t("phone.unlinked_msg"));
    if (btn) btn.disabled = false;
  }
}

function setUpdateBanner(msg, warn, showProgress, pct) {
  const el = document.getElementById("update_banner");
  const text = document.getElementById("update_text");
  const cancelBtn = document.getElementById("update_cancel_btn");
  const progWrap = document.getElementById("update_progress_wrap");
  const progBar = document.getElementById("update_progress_bar");
  if (!el) return;
  if (!msg) {
    el.hidden = true;
    if (text) text.textContent = "";
    if (cancelBtn) cancelBtn.hidden = true;
    if (progWrap) progWrap.hidden = true;
    return;
  }
  el.hidden = false;
  const translated = typeof translate_runtime_text === "function" ? translate_runtime_text(msg) : msg;
  if (text) text.textContent = translated;
  el.classList.toggle("warn", !!warn);
  if (cancelBtn) cancelBtn.hidden = !state.phoneUpdateDownloading;
  if (progWrap) progWrap.hidden = !showProgress;
  if (progBar && typeof pct === "number" && pct >= 0) {
    progBar.style.width = Math.min(100, Math.max(2, pct)) + "%";
  }
}

function cancelPhoneUpdate() {
  state.phoneUpdateDownloading = false;
  state.pendingPhoneUpdate = null;
  try {
    const n = native();
    if (n && n.cancelDownloadUpdate) n.cancelDownloadUpdate();
  } catch (e) {}
  setUpdateBanner("");
}

function startAutomaticPhoneUpdate(update) {
  if (!update || !update.download_url || state.phoneUpdateDownloading) return;
  state.pendingPhoneUpdate = update;
  state.phoneUpdateDownloading = true;
  const tag = update.tag || "";
  setUpdateBanner(tf("updates.downloading_pct", { tag: tag, pct: 0 }), false, true, 2);
  const n = native();
  if (n && n.downloadUpdate) {
    n.downloadUpdate(update.download_url, update.digest || "");
  } else {
    state.phoneUpdateDownloading = false;
    setUpdateBanner(t("updates.github"), true, false, 0);
  }
}

window.onUpdateProgress = function (pct) {
  if (!state.phoneUpdateDownloading) return;
  const tag = (state.pendingPhoneUpdate && state.pendingPhoneUpdate.tag) || "";
  const num = Number(pct || 0);
  if (num >= 100) {
    setUpdateBanner(t("updates.installing_apk"), false, true, 100);
  } else {
    setUpdateBanner(tf("updates.downloading_pct", { tag: tag, pct: num }), false, true, num);
  }
};

function _phoneVersion(value) {
  const nums = String(value || "").match(/\d+/g) || [];
  return [0, 1, 2].map(function (_, i) { return Number(nums[i] || 0); });
}

function _phoneReleaseNewer(latest, current) {
  const a = _phoneVersion(latest);
  const b = _phoneVersion(current);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

function _phoneCodeNewer(remote, mine) {
  remote = Number(remote || 0);
  mine = Number(mine || 0);
  if (!(remote > 0) || !(mine > 0)) return null;
  return remote > mine;
}

async function _pcPhoneUpdate() {
  const urls = bases();
  for (let i = 0; i < urls.length; i++) {
    try {
      const text = await sendHttp("GET", urls[i] + "/update", null, state.token, 2500);
      const data = JSON.parse(text || "{}");
      if (!data || data.ok === false) continue;
      const name = String(data.versionName || data.versionCode || "");
      if (!name) continue;
      const apk = String(data.apk || "/update/apk");
      const path = apk.indexOf("http") === 0 ? apk : (urls[i] + (apk.charAt(0) === "/" ? apk : "/" + apk));
      return {
        repo: "pc",
        tag: name,
        url: path,
        download_url: path,
        source: "pc",
        versionCode: Number(data.versionCode || 0),
        digest: String(data.digest || ""),
        size: Number(data.size || 0),
      };
    } catch (e) {}
  }
  return null;
}

async function _githubPhoneRelease(repo) {
  try {
    const url = "https://api.github.com/repos/" + repo + "/releases/latest";
    const text = await sendHttp("GET", url, null, "", 12000);
    const data = JSON.parse(text || "{}");
    if (data && data.ok === false && !data.tag_name) {
      return { error: data.error || "github", repo: repo };
    }
    if (data && data.message && !data.tag_name) return { error: "github", repo: repo };
    if (!data || !data.tag_name) return { error: "no_tag", repo: repo };
    const assets = Array.isArray(data.assets) ? data.assets : [];
    const apk = assets.find(function (item) {
      return String(item.name || "").toLowerCase().endsWith(".apk");
    });
    return {
      repo: repo,
      tag: data.tag_name,
      url: data.html_url || ("https://github.com/" + repo + "/releases/latest"),
      download_url: apk ? apk.browser_download_url : "",
      digest: apk ? String(apk.digest || "") : "",
      size: apk ? Number(apk.size || 0) : 0,
    };
  } catch (e) {
    return { error: "network", repo: repo };
  }
}

async function checkPhoneUpdate(manual) {
  if (state.phoneUpdateDownloading) return;
  if (state.phoneUpdateCheckRunning && !manual) return;
  state.phoneUpdateCheckRunning = true;
  const watchdog = setTimeout(function () { state.phoneUpdateCheckRunning = false; }, 25000);
  const button = document.getElementById("updates_btn");
  if (manual && button) {
    button.disabled = true;
    button.textContent = t("updates.checking");
    setUpdateBanner(t("updates.checking"), false, false, 0);
  }
  const n = native();
  try {
    const mine = n && n.appVersionName ? String(n.appVersionName() || "4.4.6") : "4.4.6";
    const mineCode = n && n.appVersionCode ? Number(n.appVersionCode() || 0) : 0;
    const newerThanMine = function (update) {
      if (!update) return false;
      const byCode = _phoneCodeNewer(update.versionCode, mineCode);
      if (byCode != null) return byCode;
      return !!(update.tag && _phoneReleaseNewer(update.tag, mine));
    };
    const results = await Promise.all([
      _githubPhoneRelease("iGlitchOn/AutoRewarder-Mobile"),
      state.token ? _pcPhoneUpdate() : Promise.resolve(null),
    ]);
    const ghUpdate = results[0];
    const pcUpdate = results[1];
    let candidate = null;
    if (ghUpdate && ghUpdate.tag && newerThanMine(ghUpdate) && ghUpdate.download_url) {
      candidate = ghUpdate;
    } else if (pcUpdate && pcUpdate.tag && newerThanMine(pcUpdate) && pcUpdate.download_url) {
      candidate = pcUpdate;
    }
    const customFailed = !!(ghUpdate && ghUpdate.error) && !pcUpdate;
    if (candidate) {
      startAutomaticPhoneUpdate(candidate);
    } else if (manual) {
      state.pendingPhoneUpdate = null;
      if (customFailed) {
        setUpdateBanner(t("updates.github"), true, false, 0);
      } else {
        setUpdateBanner(t("updates.phone_none"), false, false, 0);
        setTimeout(function () { if (!state.phoneUpdateDownloading) setUpdateBanner(""); }, 3500);
      }
    } else {
      state.pendingPhoneUpdate = null;
      setUpdateBanner("");
    }
  } catch (e) {
    if (manual) setUpdateBanner(t("updates.github"), true, false, 0);
    else {
      state.pendingPhoneUpdate = null;
      setUpdateBanner("");
    }
  } finally {
    clearTimeout(watchdog);
    state.phoneUpdateCheckRunning = false;
    if (manual && button) { button.disabled = false; button.textContent = t("phone.updates"); }
  }
}

window.onNativeReady = function () {
  initLanguage();
  showAppVersion();
  try { if (native() && native().discover) native().discover(); } catch (e) {}
  restore();
};

window.onUpdateReady = function () {
  state.phoneUpdateDownloading = false;
  state.pendingPhoneUpdate = null;
  setUpdateBanner("");
};

window.onUpdateFailed = function (msg) {
  state.phoneUpdateDownloading = false;
  state.pendingPhoneUpdate = null;
  setUpdateBanner(msg || t("updates.github"), true, false, 0);
  setTimeout(function () { if (!state.phoneUpdateDownloading) setUpdateBanner(""); }, 5000);
};

initLanguage();
try { if (native() && native().discover) native().discover(); } catch (e) {}
showAppVersion();
restore();
setInterval(pollJobs, 5000);
setInterval(refreshOverview, 30000);
setInterval(heartbeat, 30000);
setTimeout(function () { checkPhoneUpdate(false); }, 15000);
