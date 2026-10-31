/* AutoRewarder phone companion — LAN or remote HTTPS tunnel (v4.4.4). */
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
    const saved = localStorage.getItem("ar_ui_lang");
    if (saved && typeof set_ui_lang === "function") {
      set_ui_lang(saved);
      return;
    }
  } catch (e) {}
  const nav = String((navigator && navigator.language) || "es").toLowerCase();
  let lang = "es";
  if (nav.indexOf("en") === 0) lang = "en";
  else if (nav.indexOf("pt") === 0) lang = "pt";
  else if (nav.indexOf("zh") === 0) lang = "zh";
  if (typeof set_ui_lang === "function") set_ui_lang(lang);
}

function applyUiLanguage(locale) {
  if (!locale || typeof set_ui_lang !== "function") return;
  try { localStorage.setItem("ar_ui_lang", locale); } catch (e) {}
  set_ui_lang(locale);
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
    log("El PC usa protocolo " + p + ". Actualiza AutoRewarder Mobile.");
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
  const status = document.getElementById("pair_status");
  if (status && reason) status.textContent = typeof translate_runtime_text === "function" ? translate_runtime_text(reason) : reason;
  try { if (native() && native().discover) native().discover(); } catch (e) {}
}

function forgetStaleOn(url) {
  const id = androidId();
  if (!id || !url || state.token) return;
  const base = String(url).replace(/\/$/, "");
  const body = { android_id: id, name: deviceName(), model: deviceModel() };
  sendHttp("POST", base + "/phone/forget", body, "", 2500).catch(function () {});
}

async function request(method, path, body) {
  const urls = bases();
  if (!urls.length) throw new Error("not linked");
  let last = null;
  const maxAttempts = method === "GET" ? 1 : 2;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i] + path;
      try {
        const text = await sendHttp(
          method, url, body, state.token, isLanUrl(url) ? 2200 : 12000
        );
        const data = JSON.parse(text || "{}");
        if (data && data.error === "auth") throw new Error("auth");
        if (!protocolOk(data)) throw new Error("protocol");
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
  document.getElementById("ms_name").textContent = state.account || "Microsoft account";
  document.getElementById("ms_avatar").textContent = initials(state.account || "MS");
  document.getElementById("ph_name").textContent = state.phone || deviceName();
  const ready = state.ready ? t("phone.ready_state") : t("phone.setup_state");
  const mem = state.membership || "Microsoft Rewards";
  document.getElementById("ms_meta").textContent = ready + " · " + mem + " · " + t("phone.by_microsoft");
  document.getElementById("ph_meta").textContent = ready + " · " + mem + " · " + t("phone.by_phone");
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
  const tag = parts[0] || "";
  const ver = Number(String(tag).replace(/^AR/i, ""));
  if (tag.indexOf("AR") === 0 && isFinite(ver) && ver > 2) {
    log("Este PC usa un beacon más nuevo (AR" + ver + "). Actualiza AutoRewarder Mobile.");
    setPairStatus("Este PC es más nuevo. Actualiza AutoRewarder en el celular.");
    return;
  }
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
      request("GET", "/me").then(function (me) {
        if (me && me.ok) log("PC actualizado.");
      }).catch(function () {});
    }
    return;
  }
  if (found.code && found.code !== "-") {
    setPairStatus("PC encontrado. Confirma el código y vincula.");
  } else if (found.url) {
    setPairStatus("PC encontrado. Escribe el código y pulsa Vincular.");
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
    setPairStatus(state.pairing ? "Ya se está vinculando…" : "La cámara ya está abierta.");
    return;
  }
  setPairStatus("Abriendo la cámara…");
  if (native() && native().scanQr) {
    state.scanningQr = true;
    setPairBusy(true);
    native().scanQr();
    return;
  }
  setPairStatus("La cámara solo está en la app Android.");
}

window.onQrScanFailed = function (msg) {
  state.scanningQr = false;
  if (!state.pairing) setPairBusy(false);
  setPairStatus(msg || "Cámara cerrada. Escribe el código o vuelve a escanear.");
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
    setPairStatus("QR leído. Vinculando…");
    doPair();
    return;
  }
  if (parsed && parsed.code) {
    setPairStatus("Código leído. Buscando el PC…");
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
    setPairStatus("Ya se está vinculando…");
    return;
  }
  const code = String(document.getElementById("pair_code").value || "").replace(/\D/g, "");
  if (code.length !== 6) {
    setPairBusy(false);
    setPairStatus("Pon el código de 6 dígitos del PC.");
    return;
  }
  state.pairing = true;
  setPairBusy(true);
  try {
    if (!state.found || !state.found.url) {
      setPairStatus("Buscando el PC…");
      try { if (native() && native().discover) native().discover(); } catch (e) {}
      try { if (native() && native().scanLan) native().scanLan(); } catch (e) {}
      await waitForUrl(6000);
    }
    const found = state.found;
    if (!found || !found.url) {
      setPairStatus("Aún no se ve el PC. AutoRewarder en el PC tiene que ser 4.3 o más (el 4.2 no tiene puente). En Wi‑Fi reintenta; en datos, escanea el QR.");
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
    setPairStatus("Vinculando…");
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
      if (data && !protocolOk(data)) {
        setPairStatus("Este PC usa un protocolo más nuevo. Actualiza la app.");
        return;
      }
      if (data && data.ok && data.token) {
        used = base;
        break;
      }
    }
    if (!data || !data.ok || !data.token) {
      const msg = (data && (data.message || data.error)) || "";
      if (!data) {
        setPairStatus("No hay puente en ese PC (¿versión 4.2?). Actualiza AutoRewarder a 4.3 o más.");
      } else if (data.error === "no_microsoft_account") {
        setPairStatus(data.message || "No hay cuenta Microsoft seleccionada en el PC.");
      } else if (data.error === "rate_limit") {
        setPairStatus("Demasiados intentos. Espera un minuto y usa el código nuevo del PC.");
      } else if (data.error === "expired") {
        setPairStatus(data.message || "Ese código ya caducó. En el PC abre Account → Vincular un celular otra vez.");
      } else if (data.error === "protocol") {
        setPairStatus(data.message || "Actualiza AutoRewarder en el PC.");
      } else {
        setPairStatus(msg || "Código no activo. En el PC: Account → Vincular un celular, y usa ese código.");
      }
      return;
    }
    state.token = data.token;
    state.account = data.account;
    state.membership = data.membership;
    state.phone = data.phone || deviceName();
    state.ready = !!data.ready;
    state.base = data.public_url || data.url || used;
    state.lan = data.lan_url || (used.indexOf("192.") >= 0 || used.indexOf("10.") >= 0 ? used : state.lan);
    persist();
    showMain();
    log("Linked to " + state.account);
    refreshOverview();
    reportEvent("paired", true, "linked");
    ensureBingSetup(true);
  } catch (e) {
    setPairStatus("No se alcanzó el PC. ¿AutoRewarder 4.3+ abierto en la misma red? El 4.2 no tiene puente. Escanea el QR si hace falta.");
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
  showMain();
  try { if (native() && native().discover) native().discover(); } catch (e) {}
  try {
    const me = await request("GET", "/me");
    if (me && me.error === "auth") throw new Error("auth");
    if (!me || !me.ok) throw new Error("unreachable");
    state.account = me.account || state.account;
    state.membership = me.membership || state.membership;
    state.phone = me.phone || state.phone;
    state.ready = me.ready;
    if (me.ui_locale) applyUiLanguage(me.ui_locale);
    if (me.market) applyMarket(me.market);
    showAppVersion();
    persist();
    showMain();
    refreshOverview();
    ensureBingSetup(false);
  } catch (e) {
    if (isAuthError(e)) {
      dropLink("El PC te desvinculó. Escanea el QR para volver a unir.");
      return;
    }
    log("PC no reachable. Reintentando con la última URL…");
    const again = await reconnect(state.lan || state.base);
    if (again) return;
    const hint = document.getElementById("offline_hint");
    if (hint) {
      hint.hidden = false;
      hint.textContent = typeof translate_runtime_text === "function"
        ? translate_runtime_text("Sin conexión al PC. Abre AutoRewarder en el PC y, si hace falta, escanea el QR otra vez. No se desvincula al cerrar esta app.")
        : "Sin conexión al PC. Abre AutoRewarder en el PC y, si hace falta, escanea el QR otra vez. No se desvincula al cerrar esta app.";
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
      log("Reconectado.");
      const recon = document.getElementById("reconnect_wrap");
      if (recon) recon.hidden = true;
      const hint = document.getElementById("offline_hint");
      if (hint) hint.hidden = true;
      refreshOverview();
      return true;
    }
    log("Ese enlace no aceptó este teléfono.");
  } catch (e) {
    log("No se pudo reconectar.");
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
    const profile = data.profile || {};
    const progress = data.progress || {};
    const set = function (id, v) {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    set("rewards_level", profile.membership || state.membership || "Microsoft Rewards");
    set("rewards_region", profile.country || "Colombia");
    const frac = function (obj, fallback) {
      if (obj && typeof obj === "object") return obj.label || fallback || "—";
      if (obj != null && obj !== "") return String(obj);
      return fallback || "—";
    };
    set("progress_pc", t("phone.progress.pc") + ": " + frac(progress.pc));
    set("progress_mobile", t("phone.progress.mobile") + ": " + frac(progress.mobile));
    set("progress_daily", t("phone.progress.daily") + ": " + frac(progress.daily));
    set("progress_visual", t("phone.progress.visual") + ": " + frac(progress.visual));
    set("progress_checkin", t("phone.progress.checkin") + ": " + frac(progress.checkin));
    set("progress_news", t("phone.progress.news") + ": " + frac(progress.news));
    set("progress_edge", t("phone.progress.edge") + ": " + frac(progress.edge));
    set("progress_reset", t("phone.progress.reset") + ": " + (progress.reset || "—"));
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
    const q = data.queries || {};
    const pcEl = document.getElementById("count_pc");
    const mobEl = document.getElementById("count_mobile");
    if (pcEl && q.pc != null && document.activeElement !== pcEl) pcEl.value = q.pc;
    if (mobEl && q.mobile != null && document.activeElement !== mobEl) mobEl.value = q.mobile;
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
  } catch (e) {
    log("No se guardaron las búsquedas en el PC.");
  }
}

async function pollJobs() {
  if (!state.token || jobsInFlight) return;
  jobsInFlight = true;
  try {
    const data = await request("GET", "/jobs");
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
  if (!id) {
    log("PC job ignorado (sin id)");
    return;
  }
  if (!PHONE_JOB_KINDS[kind]) {
    log("PC job ignorado (kind desconocido): " + kind);
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
  runPhone(kind);
}

function detailDeniesSuccess(detail) {
  const text = String(detail || "").toLowerCase();
  const blocked = ["not verified", "ask:", "opened", "no se pudo", "timeout", "abiertas"];
  for (let i = 0; i < blocked.length; i++) {
    if (text.indexOf(blocked[i]) >= 0) return true;
  }
  return false;
}

function detailHasTaskCounter(detail) {
  const m = String(detail || "").match(/(?:check-in|noticias)\s+(\d+)\s*\/\s*(\d+)/i);
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
  log(ok ? (detail || "Listo") : (detail || "No terminó"));
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
      if (data && data.kind === "microsoft") {
        log("No se puede iniciar: " + msg + " (cuenta Microsoft en el PC, no el celular).");
      } else {
        log("No se puede iniciar: " + msg);
      }
    }
  } catch (e) {
    log("No se alcanzó el PC (" + (e.message || e) + ")");
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
      log("PC stop enviado.");
      const st = document.getElementById("status_text");
      if (st) st.textContent = t("phone.stop");
    } else {
      log("Stop falló: " + JSON.stringify(data));
    }
  } catch (e) {
    log("Stop no llegó al PC: " + (e.message || e));
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
  const installed = st === "installed";
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
    else if (!installed) pill.textContent = t("bing.nosession");
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
    setBingBanner("Inicia sesión con la cuenta Microsoft. La sesión queda en esta app.", true);
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

function installBingApp() {
  log("Abriendo Play Store para instalar Bing…");
  state.waitingBingInstall = true;
  let ok = true;
  try {
    if (native() && native().installBing) ok = native().installBing() !== false;
  } catch (e) {
    ok = false;
  }
  if (!ok) {
    state.waitingBingInstall = false;
    log("No se pudo abrir Play Store.");
    setBingBanner("No se pudo abrir Play Store.", true);
    return;
  }
  setBingBanner("Instala Bing y vuelve a AutoRewarder. La UI se actualiza sola.", true);
}

function confirmBingReady() {
  if (state.pendingVerify) {
    verifyPending();
    return;
  }
  log("Comprobando la sesión de Rewards…");
  setBingBanner("Comprobando la sesión de Rewards…", false);
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
  let ver = "4.4.4";
  try {
    const n = native();
    if (n && n.appVersionName) ver = String(n.appVersionName() || ver);
  } catch (e) {}
  el.textContent = "Microsoft Rewards · " + ver;
}

function askPending(kind) {
  state.askingVerify = true;
  state.pendingVerify = kind || state.pendingVerify;
  const label = state.pendingVerify === "news" ? "las noticias" : "el check-in";
  setBingBanner("No pude leer el contador. Si ya completaste " + label + " en Bing, pulsa Comprobar sesión.", true);
  log("No se marca done hasta leer getuserinfo.");
  updateBingUi();
}

function verifyPending() {
  const kind = state.pendingVerify;
  if (!kind) return;
  state.askingVerify = false;
  state.verifying = true;
  updateBingUi();
  setBingBanner("Verificando en Rewards…", true);
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
      log("Sin sesión de Rewards. No se marca la tarea.");
      state.bingReady = !!loggedIn;
      state.pendingVerify = kind;
      state.askingVerify = true;
      state.verifying = false;
      state.autoQueue = [];
      updateBingUi();
      setBingBanner("Bing: sin sesión", true);
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
      log("Sin sesión de Rewards. No se marca la tarea.");
      state.pendingVerify = kind;
      state.askingVerify = true;
      state.verifying = false;
      updateBingUi();
      setBingBanner("Bing: sin sesión", true);
      return;
    }
    log("Sesión vista. Verificando " + (kind === "news" ? "noticias" : "check-in") + "…");
    setBingBanner("Verificando en Rewards…", true);
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
      log("Sesión de Rewards lista en esta app.");
    }
    setBingBanner("");
    if (state.pendingBingKind) {
      const kind = state.pendingBingKind;
      state.pendingBingKind = null;
      runPhone(kind);
    }
    return;
  }
  if (purpose === "manual") {
    log("No se detectó sesión activa. Pulsa Iniciar sesión en Rewards.");
    setBingBanner(t("bing.nosession"), true);
    return;
  }
  if (purpose === "paired" && !state.waitingBingLogin) {
    log("Inicia sesión en Rewards en esta app.");
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
  log("Abriendo el inicio de sesión de Rewards…");
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
    log("No se pudo abrir el inicio de sesión.");
    setBingBanner("No se pudo abrir el inicio de sesión.", true);
    updateBingUi();
  }
}

function runAllPhoneTasks() {
  if (state.pendingVerify || state.verifying) {
    log("Ya hay una tarea de Bing abierta.");
    return;
  }
  state.autoQueue = ["news"];
  runPhone("checkin", true);
}

function runPhone(kind, forceAutomated) {
  if (state.pendingVerify) {
    log("Ya hay una tarea de Bing abierta.");
    return;
  }
  updateBingUi();
  if (!state.bingReady) {
    state.pendingBingKind = kind;
    log("Hace falta la sesión de Rewards en esta app.");
    if (!state.waitingBingLogin) loginBingApp();
    return;
  }
  if (state.market) applyMarket(state.market);
  const label = kind === "news" ? "noticias" : "check-in";
  state.askingVerify = false;
  state.pendingVerify = kind;
  updateBingUi();
  // Prefer built-in automated WebView task when requested or when external Bing is absent
  if (forceAutomated || !bingInstalled()) {
    log("Automatizando " + label + "…");
    setBingBanner("Ejecutando " + label + " en Rewards…", false);
    state.verifying = true;
    updateBingUi();
    if (native() && native().runTask) {
      native().runTask(kind);
      return;
    }
  }
  let opened = false;
  try {
    if (native() && native().openBingApp) opened = !!native().openBingApp(kind);
  } catch (e) {}
  if (opened) {
    log("Abriendo " + label + " en Bing…");
    setBingBanner("Completa " + label + " en Bing. Al volver se lee el contador de Rewards.", true);
  } else {
    state.verifying = true;
    updateBingUi();
    if (native() && native().runTask) native().runTask(kind);
    else if (native() && native().openBing) native().openBing(kind);
  }
}

window.onBingTask = function (ok, detail) {
  const kind = state.pendingVerify || "task";
  const text = String(detail || "");
  state.verifying = false;
  if (text.indexOf("ask:") === 0) {
    state.autoQueue = [];
    askPending(kind);
    return;
  }
  const msg = text || (ok ? "Listo" : "no se pudo");
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
  setBingBanner("Comprobando la sesión de Rewards…", true);
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
    log("Bing instalada. Ahora inicia sesión.");
    loginBingApp();
  } else if (state.waitingBingLogin || state.verifying || state.pendingSuccess) {
    updateBingUi();
  } else if (state.pendingVerify && !state.askingVerify) {
    const kind = state.pendingVerify;
    state.probeKind = kind;
    log("Volviste de Bing. Comprobando la sesión de Rewards…");
    setBingBanner("Comprobando la sesión de Rewards…", true);
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
    await request("GET", "/me");
    const hint = document.getElementById("offline_hint");
    if (hint) hint.hidden = true;
  } catch (e) {
    if (isAuthError(e)) {
      dropLink("El PC te desvinculó. Escanea el QR para volver a unir.");
      return;
    }
    const hint = document.getElementById("offline_hint");
    if (hint) {
      hint.hidden = false;
      hint.textContent = typeof translate_runtime_text === "function"
        ? translate_runtime_text("Sin conexión al PC. Reintentando sin bloquear la aplicación…")
        : "Sin conexión al PC. Reintentando sin bloquear la aplicación…";
    }
  } finally {
    heartbeatInFlight = false;
  }
}

async function unlinkPhone() {
  const btn = document.getElementById("unlink_btn") || document.querySelector("button.phone-mini");
  if (btn) {
    if (btn.disabled) return;
    btn.disabled = true;
  }
  try {
    const data = await request("POST", "/phone/unlink", {});
    if (!data || !data.ok) {
      log("No se pudo desvincular en el PC. Inténtalo de nuevo.");
      return;
    }
    dropLink("Desvinculado. Escanea el QR para volver a unir.");
  } catch (e) {
    if (isAuthError(e)) {
      dropLink("El PC te desvinculó. Escanea el QR para volver a unir.");
      return;
    }
    log("No se pudo desvincular: " + (e.message || e));
  } finally {
    if (btn && state.token) btn.disabled = false;
  }
}

function setUpdateBanner(msg, warn) {
  const el = document.getElementById("update_banner");
  const text = document.getElementById("update_text");
  if (!el) return;
  if (!msg) {
    el.hidden = true;
    if (text) text.textContent = "";
    return;
  }
  el.hidden = false;
  const translated = typeof translate_runtime_text === "function" ? translate_runtime_text(msg) : msg;
  if (text) text.textContent = translated;
  else el.textContent = translated;
  el.classList.toggle("warn", !!warn);
  const download = document.getElementById("update_download_btn");
  const canDownload = !!(state.pendingPhoneUpdate && state.pendingPhoneUpdate.download_url);
  if (download) {
    download.hidden = !canDownload;
    download.disabled = !canDownload;
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

function downloadPhoneUpdate() {
  const update = state.pendingPhoneUpdate;
  if (!update || !update.download_url || state.phoneUpdateDownloading) return;
  state.phoneUpdateDownloading = true;
  setUpdateBanner(t("updates.phone_down"));
  const download = document.getElementById("update_download_btn");
  if (download) download.disabled = true;
  const n = native();
  if (n && n.downloadUpdate) {
    n.downloadUpdate(update.download_url, update.digest || "");
  } else {
    state.phoneUpdateDownloading = false;
    setUpdateBanner("Esta versión no puede descargar el APK automáticamente.", true);
  }
}

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
    setUpdateBanner(t("updates.checking"));
  }
  const n = native();
  try {
    const mine = n && n.appVersionName ? String(n.appVersionName() || "4.4.4") : "4.4.4";
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
    if (ghUpdate && ghUpdate.tag && newerThanMine(ghUpdate)) {
      candidate = ghUpdate;
    } else if (pcUpdate && pcUpdate.tag && newerThanMine(pcUpdate)) {
      candidate = pcUpdate;
    }
    const customFailed = !!(ghUpdate && ghUpdate.error) && !pcUpdate;
    if (candidate) {
      state.pendingPhoneUpdate = candidate;
      if (candidate.download_url) {
        setUpdateBanner(tf("updates.phone_ask", { tag: candidate.tag }));
      } else {
        state.pendingPhoneUpdate = null;
        setUpdateBanner(tf("updates.no_installer", { tag: candidate.tag }), true);
      }
    } else if (manual) {
      state.pendingPhoneUpdate = null;
      if (customFailed) {
        setUpdateBanner(t("updates.github"), true);
      } else {
        setUpdateBanner(t("updates.phone_none"));
        setTimeout(function () { if (!state.pendingPhoneUpdate) setUpdateBanner(""); }, 4000);
      }
    } else {
      state.pendingPhoneUpdate = null;
      setUpdateBanner("");
    }
  } catch (e) {
    if (manual) setUpdateBanner(t("updates.github"), true);
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
  setUpdateBanner("Instala la actualización. La sesión se conserva.");
};

window.onUpdateFailed = function (msg) {
  state.phoneUpdateDownloading = false;
  setUpdateBanner(msg || "No se pudo actualizar.", true);
};

initLanguage();
try { if (native() && native().discover) native().discover(); } catch (e) {}
showAppVersion();
restore();
setInterval(pollJobs, 5000);
setInterval(refreshOverview, 30000);
setInterval(heartbeat, 30000);
setTimeout(function () { if (state.token) checkPhoneUpdate(false); }, 30000);
