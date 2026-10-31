// =========================================================================
// AutoRewarder — UI script
// =========================================================================

let accountsCache = [];
let currentAccountId = null;
// True while the background WebDriver warmup (which also refreshes the balance)
// is running at launch. Start must stay disabled until it finishes, so a run
// can't open a second driver on the same Edge profile.
let driverWarmingUp = false;
// True while a balance scrape holds a driver (launch refresh, manual refresh,
// or account-switch refresh). Start must stay disabled during it too.
let balanceFetching = false;
let runInProgress = false;

// =========================================================================
// Toasts
// =========================================================================

const TOAST_ICONS = {
  info:    '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  warning: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  error:   '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
};

function show_toast(message, type, opts) {
  const kind = TOAST_ICONS[type] ? type : 'info';
  const duration = (opts && opts.duration) || (kind === 'error' ? 5000 : 3500);

  const container = document.getElementById('toast_container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast ' + kind;
  toast.innerHTML =
    TOAST_ICONS[kind] +
    '<div class="toast-msg"></div>' +
    '<button class="toast-close" aria-label="Dismiss">&times;</button>';

  toast.querySelector('.toast-msg').textContent = typeof translate_runtime_text === 'function' ? translate_runtime_text(message) : message;

  const dismiss = () => {
    toast.classList.add('hiding');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };

  toast.querySelector('.toast-close').addEventListener('click', dismiss);
  container.appendChild(toast);

  if (duration > 0) setTimeout(dismiss, duration);
}

// =========================================================================
// Generic modal (prompt/confirm replacement)
// =========================================================================

let _modalResolve = null;

function open_modal(opts) {
  const backdrop = document.getElementById('app_modal');
  const title = document.getElementById('modal_title');
  const message = document.getElementById('modal_message');
  const input = document.getElementById('modal_input');
  const confirmBtn = document.getElementById('modal_confirm');
  const cancelBtn = document.getElementById('modal_cancel');

  title.textContent = typeof tr === 'function' ? tr(opts.title || '') : (opts.title || '');
  message.textContent = typeof translate_runtime_text === 'function' ? translate_runtime_text(opts.message || '') : (opts.message || '');

  const withInput = Boolean(opts.withInput);
  input.hidden = !withInput;
  input.value = opts.inputDefault || '';
  input.placeholder = opts.inputPlaceholder || '';

  confirmBtn.textContent = typeof tr === 'function' ? tr(opts.confirmLabel || 'OK') : (opts.confirmLabel || 'OK');
  cancelBtn.textContent = typeof tr === 'function' ? tr(opts.cancelLabel || 'Cancel') : (opts.cancelLabel || 'Cancel');
  cancelBtn.hidden = Boolean(opts.hideCancel);
  confirmBtn.className = 'btn-primary' + (opts.danger ? ' danger' : '');

  backdrop.hidden = false;
  setTimeout(() => (withInput ? input : confirmBtn).focus(), 30);

  return new Promise((resolve) => { _modalResolve = resolve; });
}

function close_modal(result) {
  const backdrop = document.getElementById('app_modal');
  backdrop.hidden = true;
  if (_modalResolve) {
    const r = _modalResolve;
    _modalResolve = null;
    r(result);
  }
}

function prompt_modal(title, message, inputDefault, opts) {
  return open_modal({
    title: title,
    message: message || '',
    withInput: true,
    inputDefault: inputDefault || '',
    inputPlaceholder: (opts && opts.placeholder) || '',
    confirmLabel: (opts && opts.confirmLabel) || 'OK',
  });
}

function confirm_modal(title, message, opts) {
  return open_modal({
    title: title,
    message: message || '',
    withInput: false,
    confirmLabel: (opts && opts.confirmLabel) || 'Confirm',
    danger: Boolean(opts && opts.danger),
  });
}

// =========================================================================
// Avatars
// =========================================================================

const AVATAR_PALETTE = [
  '#5b8eff', '#e879a0', '#f59e0b', '#34d399',
  '#a78bfa', '#fbbf24', '#fb7185', '#22d3ee',
];

function avatar_color(id) {
  if (!id) return AVATAR_PALETTE[0];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function avatar_initials(label) {
  const s = (label || '?').trim();
  if (!s) return '?';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + parts[parts.length - 1][0]);
}

function make_avatar(account, size) {
  const el = document.createElement('span');
  el.className = 'avatar' + (size ? ' avatar-' + size : '');
  el.style.backgroundColor = avatar_color(account ? account.id : '');
  el.textContent = account ? avatar_initials(account.label) : '?';
  return el;
}

// Backwards compat alias.
function create_avatar(account, size) { return make_avatar(account, size); }

// =========================================================================
// Activity log
//
// Security: log messages can contain user-controlled strings (account labels
// entered via the "Add/Rename" modals, Python exception messages, etc.).
// We therefore build the log line node with textContent/createElement only —
// never innerHTML — so a crafted account name like `<img src=x onerror=...>`
// renders as literal text. For the one legitimate case where we need a
// clickable element (update-available notice), see `update_log_link` below,
// which builds the anchor via createElement so the URL is never parsed as
// HTML.
// =========================================================================

function detect_log_severity(msg) {
  const s = String(msg);
  if (/\[ERROR\]/i.test(s)) return 'error';
  if (/\[WARNING\]/i.test(s)) return 'warning';
  if (/completed|success|done!|ready/i.test(s)) return 'success';
  return '';
}

function _new_log_line(message) {
  const severity = detect_log_severity(message);
  const line = document.createElement('div');
  line.className = 'log-line' + (severity ? ' ' + severity : '');

  // Preserve newlines without HTML: split → text nodes separated by <br>.
  const parts = translate_runtime_text(message).split('\n');
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) line.appendChild(document.createElement('br'));
    line.appendChild(document.createTextNode(parts[i]));
  }
  return line;
}

function update_log(message) {
  const logDiv = document.getElementById('log_area');
  if (!logDiv) return;

  logDiv.appendChild(_new_log_line(message));
  logDiv.scrollTop = logDiv.scrollHeight;
}

/**
 * Append a log line with a trailing clickable link. Only the `text` portion
 * is user-facing content (still safely inserted as text); the anchor is
 * built via createElement so the URL cannot be interpreted as HTML.
 * Called from Python via evaluate_js when an app update is available.
 */
function update_log_link(text, linkLabel, url) {
  const logDiv = document.getElementById('log_area');
  if (!logDiv) return;

  const line = _new_log_line(text);
  line.appendChild(document.createTextNode(' '));

  const a = document.createElement('a');
  a.href = '#';
  a.textContent = String(linkLabel);
  a.addEventListener('click', function (e) {
    e.preventDefault();
    if (window.pywebview && pywebview.api && typeof pywebview.api.open_link === 'function') {
      pywebview.api.open_link(String(url));
    }
  });
  line.appendChild(a);

  logDiv.appendChild(line);
  logDiv.scrollTop = logDiv.scrollHeight;
}

const _loggedOnce = new Set();
function update_log_once(message) {
  if (_loggedOnce.has(message)) return;
  _loggedOnce.add(message);
  update_log(message);
}

let _custom_update_url = '';
let _custom_update_asset_name = '';

const UPDATE_STAGES = {
  downloading: 'update.downloading',
  installing: 'update.installing',
  replacing: 'update.replacing',
  cleaning: 'update.cleaning',
  finished: 'update.finished',
};

function show_update_modal() {
  const modal = document.getElementById('update_modal');
  if (!modal) return;
  modal.hidden = false;
  document.body.classList.add('update-in-progress');
  update_update_progress('downloading', 0);
}

function update_update_progress(stage, progress) {
  const modal = document.getElementById('update_modal');
  const label = document.getElementById('update_modal_stage');
  const bar = document.getElementById('update_progress_bar');
  if (!modal || !label) return;
  modal.hidden = false;
  const key = UPDATE_STAGES[stage] || 'update.installing';
  label.textContent = typeof t === 'function' ? t(key) : stage;
  if (bar) {
    const stageBase = { downloading: 0, installing: 35, replacing: 65, cleaning: 85, finished: 100 }[stage] || 0;
    const fraction = typeof progress === 'number' ? progress : 0;
    const value = stage === 'downloading' ? Math.min(35, fraction * 35) : Math.max(stageBase, stageBase + fraction * 15);
    bar.style.width = `${Math.round(value)}%`;
  }
}

function _update_panel(message, url, assetName) {
  const panel = document.getElementById('updates_panel');
  const text = document.getElementById('updates_message');
  const download = document.getElementById('updates_download_btn');
  if (!panel || !text) return;
  text.textContent = message || '';
  _custom_update_url = String(url || '');
  _custom_update_asset_name = String(assetName || '');
  if (download) {
    download.hidden = !_custom_update_url;
    download.disabled = !_custom_update_url;
  }
  panel.hidden = !message;
}

function cancel_custom_update() {
  _custom_update_url = '';
  _custom_update_asset_name = '';
  const panel = document.getElementById('updates_panel');
  const download = document.getElementById('updates_download_btn');
  if (download) {
    download.hidden = true;
    download.disabled = true;
  }
  if (panel) panel.hidden = true;
}

function download_custom_update() {
  if (!_custom_update_url) return;
  if (window.pywebview && pywebview.api && typeof pywebview.api.open_update_window === 'function') {
    pywebview.api.open_update_window(_custom_update_url, _custom_update_asset_name);
    return;
  }
  if (window.pywebview && pywebview.api && typeof pywebview.api.download_and_install_update === 'function') {
    show_update_modal();
    const button = document.getElementById('updates_download_btn');
    if (button) { button.disabled = true; button.textContent = t('update.downloading'); }
    pywebview.api.download_and_install_update(_custom_update_url, _custom_update_asset_name).then(function (result) {
      if (!result || !result.ok) {
        const modal = document.getElementById('update_modal');
        if (modal) modal.hidden = true;
        document.body.classList.remove('update-in-progress');
        _update_panel('No se pudo descargar la actualización: ' + ((result && result.error) || 'error desconocido.'), '');
      }
    }).catch(function (error) {
      const modal = document.getElementById('update_modal');
      if (modal) modal.hidden = true;
      document.body.classList.remove('update-in-progress');
      _update_panel('No se pudo descargar la actualización: ' + (error && error.message ? error.message : 'error desconocido.'), '');
    });
  }
}

function show_update_notice(result, manual) {
  result = result || {};
  const releases = Array.isArray(result.releases) ? result.releases : [];
  const original = releases.find(function (item) { return item.kind === 'original' && item.newer; });
  const custom = releases.find(function (item) { return item.kind === 'custom' && item.newer; });
  if (original) {
    update_log_once('Hay una nueva versión del repositorio original (' + original.tag + '). Notifica al desarrollador; no se instalará automáticamente.');
  }
  if (custom) {
    _update_panel('Nueva actualización propia ' + custom.tag + '. ¿Quieres descargarla?', custom.download_url, custom.asset_name);
  } else if (manual) {
    _update_panel(t('update_no_custom'), '');
    setTimeout(cancel_custom_update, 4000);
    if (original) update_log('También hay una actualización del repositorio original para notificar al desarrollador.');
  }
  return result;
}

function check_updates_manual() {
  const button = document.getElementById('updates_btn');
  if (button) { button.disabled = true; button.textContent = t('checking'); }
  const done = function () {
  if (button) { button.disabled = false; button.textContent = t('check_updates'); }
  };
  try {
    if (!window.pywebview || !pywebview.api || typeof pywebview.api.check_updates !== 'function') {
      update_log(t('update_github_failed'));
      done();
      return;
    }
    pywebview.api.check_updates().then(function (result) {
      show_update_notice(result, true);
      done();
    }).catch(function () {
      update_log(t('update_github_failed'));
      done();
    });
  } catch (e) {
    update_log(t('update_github_failed'));
    done();
  }
}

// =========================================================================
// Start / bot control
// =========================================================================

function start_block_reason() {
  if (runInProgress) return t('run.already_running');
  if (driverWarmingUp) return t('run.browser_loading');
  if (balanceFetching) return t('run.browser_busy');
  if (!currentAccountId) return t('run.no_microsoft');
  const current = accountsCache.find(a => a.id === currentAccountId);
  if (!current) return t('run.no_microsoft');
  if (!current.first_setup_done) return t('run.microsoft_setup');
  return null;
}

function show_run_block_reason() {
  const el = document.getElementById('run_block_reason');
  if (!el) return;
  const reason = start_block_reason();
  if (reason && !runInProgress) {
    el.hidden = false;
    el.textContent = reason;
  } else {
    el.hidden = true;
    el.textContent = '';
  }
}

function set_running_ui(on) {
  runInProgress = Boolean(on);
  const startBtn = document.getElementById('start_btn');
  const tasksBtn = document.getElementById('tasks_only_btn');
  const stopBtn = document.getElementById('stop_btn');
  const label = startBtn && startBtn.querySelector('.btn-label');
  if (runInProgress) {
    if (startBtn) startBtn.disabled = true;
    if (label) label.textContent = t('run.running');
    if (tasksBtn) tasksBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;
    update_status_indicator('executing');
  } else {
    enable_start_button();
  }
  show_run_block_reason();
}

function start_bot() {
  const reason = start_block_reason();
  if (reason) {
    show_toast(reason, 'warning');
    show_run_block_reason();
    return;
  }

  const pc = parseInt(document.getElementById('count_pc').value, 10);
  const mobile = parseInt(document.getElementById('count_mobile').value, 10);

  const pcValid = !isNaN(pc) && pc >= 0 && pc <= 130;
  const mobileValid = !isNaN(mobile) && mobile >= 0 && mobile <= 99;
  if (!pcValid) {
    show_toast(t('pc_range'), 'warning');
    return;
  }
  if (!mobileValid) {
    show_toast(t('mobile_range'), 'warning');
    return;
  }
  if (pc + mobile === 0) {
    show_toast(t('choose_queries'), 'warning');
    return;
  }

  set_running_ui(true);

  // Save the query counts to global settings before running.
  pywebview.api.set_queries_counts(pc, mobile).then(ok => {
    if (!ok) console.error('Failed to save query counts (backend returned false).');
  }).catch(err => {
    console.error('Failed to save query counts:', err);
  });

  const tasksBtn = document.getElementById('tasks_only_btn');
  if (tasksBtn) tasksBtn.disabled = true;

  update_status_indicator('executing');
  pywebview.api.main(pc, mobile, false);
}

function start_tasks_only() {
  const reason = start_block_reason();
  if (reason) {
    show_toast(reason, 'warning');
    show_run_block_reason();
    return;
  }

  set_running_ui(true);
  update_log('Starting remaining daily tasks only…');
  pywebview.api.main(0, 0, true);
}

document.addEventListener('DOMContentLoaded', function () {
  // Auto-save query counts when they change (on blur).
  const pcField = document.getElementById('count_pc');
  const mobileField = document.getElementById('count_mobile');
  const save_counts = () => {
    if (pcField && mobileField) {
      const pc = parseInt(pcField.value, 10);
      const mobile = parseInt(mobileField.value, 10);
      if (!isNaN(pc) && !isNaN(mobile) && pc >= 0 && pc <= 130 && mobile >= 0 && mobile <= 99) {
        pywebview.api.set_queries_counts(pc, mobile).then(ok => {
          if (!ok) console.error('Failed to auto-save query counts (backend returned false).');
        }).catch(err => {
          console.error('Failed to auto-save query counts:', err);
        });
      }
    }
  };
  if (pcField) pcField.addEventListener('blur', save_counts);
  if (mobileField) mobileField.addEventListener('blur', save_counts);
});

function enable_start_button() {
  runInProgress = false;
  const btn = document.getElementById('start_btn');
  const label = btn.querySelector('.btn-label');
  if (label) label.textContent = t('run.start');
  const reason = start_block_reason();
  const canRun = !reason;
  btn.disabled = !canRun;
  const tasksBtn = document.getElementById('tasks_only_btn');
  if (tasksBtn) {
    tasksBtn.disabled = !canRun;
    tasksBtn.textContent = t('run.tasks');
  }
  show_run_block_reason();

  // Stop button is meaningful only while a run is in progress.
  const stopBtn = document.getElementById('stop_btn');
  if (stopBtn) {
    stopBtn.disabled = true;
    const stopLabel = stopBtn.querySelector('.stop-label');
    if (stopLabel) stopLabel.textContent = t('run.stop');
  }
  update_status_indicator();
  refresh_stats_ui();
  refresh_rewards_overview();
}

function stop_bot() {
  if (!window.pywebview || !pywebview.api || !pywebview.api.stop) return;
  const stopBtn = document.getElementById('stop_btn');
  if (stopBtn) {
    stopBtn.disabled = true;
    const stopLabel = stopBtn.querySelector('.stop-label');
  if (stopLabel) stopLabel.textContent = t('run.stopping_short');
  }
  update_status_indicator('executing');
  const text = document.getElementById('status_text');
  if (text) text.textContent = t('run.stopping_short');
  // Mark this as a user stop so a login-triggered run does not close the GUI.
  pywebview.api.stop(true).catch(err => console.error('stop failed:', err));
}

function update_status_indicator(forceState) {
  const dot = document.getElementById('dot');
  const text = document.getElementById('status_text');
  if (!dot || !text) return;

  dot.classList.remove('active', 'ready', 'warning');

  let state = forceState;
  if (!state) {
    const current = accountsCache.find(a => a.id === currentAccountId);
    if (!current) state = 'empty';
    else if (!current.first_setup_done) state = 'setup';
    else state = 'ready';
  }

  set_hide_browser_toggle_enabled(state !== 'executing');

  switch (state) {
    case 'executing':
      dot.classList.add('active');
      text.textContent = t('status.running');
      break;
    case 'ready':
      dot.classList.add('ready');
      text.textContent = t('status.ready');
      break;
    case 'setup':
      dot.classList.add('warning');
      text.textContent = t('status.setup');
      break;
    case 'empty':
    default:
      text.textContent = t('status.no_account');
      break;
  }
}

function show_history() {
  pywebview.api.open_history_window();
}

function show_background_logs() {
  if (window.pywebview && pywebview.api && pywebview.api.open_background_logs_window) {
    pywebview.api.open_background_logs_window();
  }
}

function show_stats() {
  if (!window.pywebview || !pywebview.api || !pywebview.api.open_stats_window) return;
  pywebview.api.open_stats_window();
}

/**
 * Format a points number for the compact card: thousands separators, with a
 * leading "~" when the figure is an estimate (no real balance scraped yet).
 */
function _fmt_points(value, isEstimate) {
  if (value == null || isNaN(value)) return '—';
  const sign = value > 0 && isEstimate === 'delta' ? '+' : '';
  const prefix = (isEstimate === true && value > 0) ? '~' : '';
  return prefix + sign + Number(value).toLocaleString();
}

/**
 * Toggle the compact stats card's "searching" animation. Called from Python
 * while it scrapes the real balance (at launch, or on a manual refresh).
 */
function set_stats_loading(on) {
  balanceFetching = Boolean(on);
  const card = document.getElementById('stats_card');
  if (card) card.classList.toggle('stats-loading', balanceFetching);

  // A balance scrape holds a driver on the profile → block Start meanwhile.
  const btn = document.getElementById('start_btn');
  if (!btn) return;
  const label = btn.querySelector('.btn-label');
  const txt = label ? label.textContent : '';
  if (txt === 'Running…') return;  // a run owns the button; leave it alone
  if (balanceFetching) {
    btn.disabled = true;
    if (label) label.textContent = t('run.loading_short');
  } else {
    const current = accountsCache.find(a => a.id === currentAccountId);
    btn.disabled = !(current && current.first_setup_done) || driverWarmingUp;
    if (label && !driverWarmingUp) label.textContent = t('run.start');
  }
}

/**
 * Refresh the compact stats card for the current account. Called on load,
 * after switching accounts, and (from Python) at the end of every run.
 */
function refresh_stats_ui() {
  if (!window.pywebview || !pywebview.api || !pywebview.api.get_stats) return;
  const totalEl = document.getElementById('stat_total');
  const sessionEl = document.getElementById('stat_session');
  const totalLabel = document.getElementById('stat_total_label');

  pywebview.api.get_stats().then(function (stats) {
    // Drop a response that arrived after the user switched accounts, so stale
    // data can't overwrite the card for the now-active account.
    if (stats && stats.account && stats.account.id !== currentAccountId) return;
    if (!stats || !stats.derived) {
      if (totalEl) totalEl.textContent = '—';
      if (sessionEl) sessionEl.textContent = '—';
      if (totalLabel) totalLabel.textContent = t('stats.total');
      const dateEl = document.getElementById('stat_session_date');
      if (dateEl) dateEl.textContent = '';
      return;
    }
    const d = stats.derived;
    if (totalEl) totalEl.textContent = _fmt_points(d.total_points, d.is_estimate);
    if (totalLabel) {
      totalLabel.textContent = d.is_estimate ? t('rewards.unverified') : t('stats.total');
    }
    if (sessionEl) {
      const flag = d.session_is_estimate ? true : 'delta';
      sessionEl.textContent = _fmt_points(d.today_points != null ? d.today_points : d.session_points, flag);
    }
    const dateEl = document.getElementById('stat_session_date');
    if (dateEl) {
      dateEl.textContent = d.last_run_date ? `(${d.last_run_date})` : '';
    }
  }).catch(function (err) {
    console.error('refresh_stats_ui failed:', err);
  });
}

function refresh_rewards_overview() {
  if (!window.pywebview || !pywebview.api || !pywebview.api.get_rewards_overview) return;
  pywebview.api.get_rewards_overview().then(function (info) {
    if (!info || !info.account || info.account.id !== currentAccountId) return;
    const profile = info.profile || {};
    const progress = info.progress || {};
    const estimate = info.estimate || {};
    const rawLevel = profile.membership || (profile.level ? `Level ${profile.level}` : t('membership_unavailable'));
    const level = translate_runtime_text(rawLevel);
    const region = translate_runtime_text(profile.country || profile.locale || t('rewards.region_unknown'));
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    set('rewards_level', level);
    set('rewards_region', region);
    set('rewards_estimate', `${t('rewards.estimate')}: ~${estimate.search_points || 0} ${t('pts_per_day')}`);
    const leftover = (obj, fallback) => {
      if (obj && typeof obj === 'object' && obj.label) {
        const left = obj.left;
        if (left > 0) return `${obj.label} (${left} ${t('left')})`;
        return `${obj.label} ${t('status.done')}`;
      }
      const s = translate_runtime_text(String(fallback || obj || ''));
      const m = s.match(/(\d+)\s*\/\s*(\d+)/);
      if (m) {
        const left = Math.max(0, parseInt(m[2], 10) - parseInt(m[1], 10));
        return left ? `${m[1]}/${m[2]} (${left} ${t('left')})` : `${m[1]}/${m[2]} ${t('status.done')}`;
      }
      return s || t('status.pending');
    };
    set('progress_pc', `${t('label.pc')}: ${leftover(progress.pc, (progress.pc || {}).label)}`);
    set('progress_mobile', `${t('label.mobile')}: ${leftover(progress.mobile, (progress.mobile || {}).label)}`);
    set('progress_daily', `${t('progress.daily')}: ${translate_runtime_text(progress.daily || t('status.unknown'))}`);
    set('progress_visual', `${t('progress.visual')}: ${translate_runtime_text(progress.visual || t('status.pending'))}`);
    set('progress_checkin', `${t('progress.checkin')}: ${leftover(progress.checkin, progress.checkin)}`);
    set('progress_news', `${t('progress.news')}: ${leftover(progress.news, progress.news)}`);
    set('progress_edge', `${t('progress.edge')}: ${leftover(progress.edge, progress.edge)}`);
    set('progress_reset', `${t('progress.reset')}: ${translate_runtime_text(progress.reset || t('status.resets_midnight'))}`);
    if (window.pywebview && pywebview.api && pywebview.api.get_manual_tasks) {
      pywebview.api.get_manual_tasks().then(render_manual_tasks).catch(function () {});
    }
    const pill = document.getElementById('daily_task_pill');
    if (pill) {
      const state = progress.daily_state || 'pending';
      pill.dataset.state = state;
      if (state === 'done') pill.textContent = `${t('status.daily')}: ${t('status.done')}`;
      else if (state === 'partial') pill.textContent = `${t('status.daily')}: ${progress.daily || t('status.partial')}`;
      else pill.textContent = `${t('status.daily')}: ${t('status.pending')}`;
    }
    const current = accountsCache.find(a => a.id === currentAccountId);
    const meta = document.getElementById('current_meta');
    if (current && meta) {
      meta.textContent = `${current.first_setup_done ? t('account.ready_to_run') : t('account.setup_pending')} · ${level} · ${region} · ${t('by_microsoft')}`;
    }
    refresh_phone_ui();
  }).catch(function (err) { console.error('refresh_rewards_overview failed:', err); });
}

function set_hide_browser_toggle_enabled(enabled) {
  const toggle = document.getElementById('hideBrowserToggle');
  if (!toggle) return;
  toggle.disabled = !enabled;
  toggle.setAttribute('aria-disabled', String(!enabled));
  const row = toggle.closest('.settings-row') || toggle.closest('.toggle-row');
  if (row) row.classList.toggle('row-disabled', !enabled);
}

function hideBrowserToggle() {
  const toggle = document.getElementById('hideBrowserToggle');
  if (!toggle) return;
  const hidden = Boolean(toggle.checked);
  pywebview.api.set_hide_browser(hidden).then(() => {
    show_toast(hidden ? tf('hide_browser_on') : tf('hide_browser_off'), 'success');
  }).catch(err => console.error('set_hide_browser failed:', err));
}

// =========================================================================
// Custom account dropdown
// =========================================================================

function toggle_account_menu(force) {
  const trigger = document.getElementById('account_trigger');
  const menu = document.getElementById('account_menu');
  if (!trigger || !menu) return;

  const shouldOpen = force === undefined ? menu.hidden : force;
  menu.hidden = !shouldOpen;
  trigger.setAttribute('aria-expanded', String(shouldOpen));
}

function render_account_menu() {
  const menu = document.getElementById('account_menu');
  if (!menu) return;

  menu.innerHTML = '';

  if (accountsCache.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'accounts-empty';
    empty.textContent = t('no_accounts');
    menu.appendChild(empty);
  } else {
    for (const acc of accountsCache) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'account-option' + (acc.is_current ? ' current' : '');
      btn.setAttribute('role', 'option');

      btn.appendChild(make_avatar(acc));

      const info = document.createElement('span');
      info.className = 'account-option-info';
      const name = document.createElement('span');
      name.className = 'account-option-name';
      name.textContent = acc.label;
      const meta = document.createElement('span');
      meta.className = 'account-option-meta';
      meta.textContent = acc.first_setup_done ? t('account.ready') : t('account.setup_pending');
      info.appendChild(name);
      info.appendChild(meta);
      btn.appendChild(info);

      const check = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      check.setAttribute('class', 'account-option-check');
      check.setAttribute('width', '14');
      check.setAttribute('height', '14');
      check.setAttribute('viewBox', '0 0 24 24');
      check.setAttribute('fill', 'none');
      check.setAttribute('stroke', 'currentColor');
      check.setAttribute('stroke-width', '2.5');
      check.setAttribute('stroke-linecap', 'round');
      check.setAttribute('stroke-linejoin', 'round');
      check.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
      btn.appendChild(check);

      btn.addEventListener('click', () => {
        toggle_account_menu(false);
        if (acc.id !== currentAccountId) {
          pywebview.api.switch_account(acc.id).then(ok => {
  if (!ok) show_toast(t('account_switch_error'), 'warning');
          });
        }
      });

      menu.appendChild(btn);
    }
  }

  // Divider + actions.
  if (accountsCache.length > 0) {
    const divider = document.createElement('div');
    divider.className = 'menu-divider';
    menu.appendChild(divider);
  }

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'menu-action';
  addBtn.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
    `<span>${t('add_account')}</span>`;
  addBtn.addEventListener('click', () => {
    toggle_account_menu(false);
    prompt_and_create_account();
  });
  menu.appendChild(addBtn);

  if (accountsCache.length > 0) {
    const manageBtn = document.createElement('button');
    manageBtn.type = 'button';
    manageBtn.className = 'menu-action';
    manageBtn.style.color = 'var(--text-muted)';
    manageBtn.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' +
      `<span>${t('manage_accounts')}…</span>`;
    manageBtn.addEventListener('click', () => {
      toggle_account_menu(false);
      open_accounts_modal();
    });
    menu.appendChild(manageBtn);
  }
}

function render_account_trigger() {
  const avatarEl = document.getElementById('current_avatar');
  const labelEl = document.getElementById('current_label');
  const metaEl = document.getElementById('current_meta');
  const trigger = document.getElementById('account_trigger');
  const deleteBtn = document.getElementById('deleteAccountBtn');
  if (!avatarEl || !labelEl || !metaEl || !trigger) return;

  const current = accountsCache.find(a => a.id === currentAccountId);

  if (current) {
    avatarEl.textContent = avatar_initials(current.label);
    avatarEl.style.backgroundColor = avatar_color(current.id);
    labelEl.textContent = current.label;
    metaEl.textContent = current.first_setup_done ? `${t('account.ready_to_run')} · ${t('by_microsoft')}` : `${t('account.setup_pending')} · ${t('by_microsoft')}`;
    if (deleteBtn) deleteBtn.hidden = false;
  } else {
    avatarEl.textContent = '+';
    avatarEl.style.backgroundColor = 'var(--surface-3)';
    labelEl.textContent = t('account.no_account');
    metaEl.textContent = accountsCache.length ? t('account.select_below') : t('account.add_first');
    if (deleteBtn) deleteBtn.hidden = true;
  }
}

async function delete_current_account(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  const current = accountsCache.find(a => a.id === currentAccountId);
  if (!current) return;
  const confirmed = await confirm_modal(
    tf('account.delete_question', { name: current.label }),
    t('account.delete_msg'),
    { confirmLabel: t('account.delete'), danger: true }
  );
  if (!confirmed) return;
  const deleted = await pywebview.api.delete_account(current.id);
  if (!deleted) {
    show_toast(t('account_delete_error'), 'warning');
    return;
  }
  show_toast(tf('account_deleted', { name: current.label }), 'success');
  refresh_account_ui();
}

// =========================================================================
// Account creation
// =========================================================================

async function prompt_and_create_account() {
  const defaultLabel = `Account ${accountsCache.length + 1}`;
  const label = await prompt_modal(
    t('add_account_title'),
    t('add_account_hint'),
    defaultLabel,
    { placeholder: defaultLabel, confirmLabel: t('continue') }
  );
  if (label === null) return;
  const trimmed = String(label).trim() || defaultLabel;

  show_toast(tf('account_open_login', { name: trimmed }), 'info', { duration: 6000 });

  pywebview.api.create_account(trimmed).then(result => {
    if (!result || !result.ok) {
      if (result && result.error === 'bot_running') {
      show_toast(t('account_bot_running'), 'warning');
      } else if (result && result.error === 'setup_failed') {
        show_toast(t('account_setup_failed'), 'warning');
      } else {
      show_toast(t('account_create_failed'), 'error');
      }
    } else {
      show_toast(tf('account_created', { name: result.label }), 'success');
    }
    refresh_account_ui();
  });
}

// =========================================================================
// Accounts management modal (opens from the header button or dropdown action)
// =========================================================================

function open_accounts_modal() {
  const backdrop = document.getElementById('accounts_modal');
  if (!backdrop) return;
  backdrop.hidden = false;
  if (typeof render_accounts_section === 'function') {
    render_accounts_section(accountsCache);
  }
}

function close_accounts_modal() {
  const backdrop = document.getElementById('accounts_modal');
  if (backdrop) backdrop.hidden = true;
}

// =========================================================================
// Settings modal (general + scheduled run)
// =========================================================================

let settingsLoaded = false;

function open_settings_modal() {
  const backdrop = document.getElementById('settings_modal');
  if (!backdrop) return;

  settingsLoaded = false;
  const saveBtn = document.getElementById('settingsSave');
  if (saveBtn) saveBtn.disabled = true;

  Promise.all([
    pywebview.api.get_all_schedules(),
    pywebview.api.get_launch_on_startup(),
    pywebview.api.get_open_on_login(),
    pywebview.api.get_close_to_tray(),
    pywebview.api.get_llm_config(),
    pywebview.api.get_force_tasks(),
    pywebview.api.get_settings(),
    pywebview.api.get_manual_search_delay ? pywebview.api.get_manual_search_delay() : Promise.resolve({ minimum: 4, maximum: 10 }),
  ]).then(([schedules, startup, openOnLogin, closeToTray, llmConfig, forceTasks, settings, manualSearchDelay]) => {
    render_schedule_cards(schedules || []);

    // Manual search delay fields.
    const delay = manualSearchDelay || {};
    const minInput = document.getElementById('manualSearchDelayMin');
    const maxInput = document.getElementById('manualSearchDelayMax');
    if (minInput) minInput.value = delay.minimum ?? 4;
    if (maxInput) maxInput.value = delay.maximum ?? 10;

    // Start-with-Windows toggle — disable row on unsupported OS.
    const startupToggle = document.getElementById('startupToggle');
    const startupRow = startupToggle.closest('.settings-row');
    const startupHint = document.getElementById('startup_hint');
    startupToggle.checked = Boolean(startup && startup.enabled);
    if (startup && !startup.supported) {
      startupRow.classList.add('row-disabled');
      startupToggle.disabled = true;
      startupHint.textContent = t('settings.windows_linux');
    } else {
      startupRow.classList.remove('row-disabled');
      startupToggle.disabled = false;
      startupHint.textContent = t('settings.background_hint');
    }

    const openOnLoginToggle = document.getElementById('openOnLoginToggle');
    const openOnLoginRow = openOnLoginToggle.closest('.settings-row');
    const openOnLoginHint = document.getElementById('open_on_login_hint');
    openOnLoginToggle.checked = Boolean(openOnLogin && openOnLogin.enabled);
    if (openOnLogin && !openOnLogin.supported) {
      openOnLoginRow.classList.add('row-disabled');
      openOnLoginToggle.disabled = true;
      openOnLoginHint.textContent = t('settings.windows_only');
    } else {
      openOnLoginRow.classList.remove('row-disabled');
      openOnLoginToggle.disabled = false;
      openOnLoginHint.textContent = t('settings.login_hint');
    }

    // Close-to-tray toggle — default to true if the API failed.
    const trayToggle = document.getElementById('closeToTrayToggle');
    if (trayToggle) {
      trayToggle.checked = closeToTray !== false;
    }

    const hideToggle = document.getElementById('hideBrowserToggle');
    if (hideToggle) {
      hideToggle.checked = Boolean(settings && settings.hide_browser);
    }

    // Force toggles — default to off if the API failed.
    const force = forceTasks || {};
    const forceDailyToggle = document.getElementById('forceDailyToggle');
    const forceVisualToggle = document.getElementById('forceVisualToggle');
    if (forceDailyToggle) forceDailyToggle.checked = Boolean(force.force_daily_tasks);
    if (forceVisualToggle) forceVisualToggle.checked = Boolean(force.force_visual_search);

    // LLM search-term generation.
    const cfg = llmConfig || {};
    const llmToggle = document.getElementById('llmToggle');
    const providerSel = document.getElementById('llmProvider');
    const modelInput = document.getElementById('llmModel');
    const keyInput = document.getElementById('llmApiKey');
    const baseUrlInput = document.getElementById('llmBaseUrl');
    const localeInput = document.getElementById('llmLocale');
    const localeHint = document.getElementById('llm_locale_hint');
    if (llmToggle) llmToggle.checked = Boolean(cfg.use_llm_queries);
    if (providerSel && cfg.llm_provider) providerSel.value = cfg.llm_provider;
    if (modelInput) modelInput.value = cfg.llm_model || '';
    if (keyInput) keyInput.value = cfg.llm_api_key || '';
    if (baseUrlInput) baseUrlInput.value = cfg.llm_base_url || '';
    if (localeInput) localeInput.value = cfg.search_locale || 'auto';
    if (localeHint) {
      const eff = cfg.effective_locale || 'en-US';
      localeHint.textContent =
        tf('settings.detected_language', { locale: eff });
    }
    apply_llm_field_state();
    settingsLoaded = true;
    if (saveBtn) saveBtn.disabled = false;
  }).catch(err => {
    console.error('Failed to load settings:', err);
    show_toast(t('settings_load_error'), 'error');
    close_settings_modal();
  });

  backdrop.hidden = false;
}

function close_settings_modal() {
  const backdrop = document.getElementById('settings_modal');
  if (backdrop) backdrop.hidden = true;
}

// Dim + disable the LLM config fields when the feature is toggled off.
function apply_llm_field_state() {
  const toggle = document.getElementById('llmToggle');
  const fields = document.getElementById('llm_fields');
  const providerSel = document.getElementById('llmProvider');
  const baseUrlField = document.getElementById('llm_base_url_field');
  if (baseUrlField && providerSel) {
    baseUrlField.hidden = providerSel.value !== 'openai-compatible';
  }
  if (!fields) return;
  fields.classList.toggle('dim', !(toggle && toggle.checked));
}

function render_schedule_cards(schedules) {
  const container = document.getElementById('schedule_accounts_list');
  const empty = document.getElementById('schedule_empty');
  if (!container || !empty) return;

  container.innerHTML = '';

  if (!schedules || schedules.length === 0) {
    container.hidden = true;
    empty.hidden = false;
    return;
  }
  container.hidden = false;
  empty.hidden = true;

  for (const item of schedules) {
    const card = build_schedule_card(item);
    container.appendChild(card);
  }
}

function format_schedule_summary(item, sched, enabled) {
  const prefix = item.first_setup_done ? '' : t('account.setup_pending') + ' · ';
  if (!enabled) return prefix + t('schedule_off');
  const pc = sched.queries_pc != null ? sched.queries_pc : 15;
  const mobile = sched.queries_mobile != null ? sched.queries_mobile : 15;
  const time = (sched.run_time && /^\d{2}:\d{2}$/.test(sched.run_time)) ? sched.run_time : '09:00';
  if (sched.advancedScheduling) {
    const dur = sched.runDuration != null ? sched.runDuration : 3;
    const qph = sched.queriesPerHour != null ? sched.queriesPerHour : 10;
    return `${prefix}${time} · ${t('label.pc')} ${pc} / ${t('label.mobile')} ${mobile} · ${dur}h @ ${qph}/h`;
  }
  return `${prefix}${time} · ${t('label.pc')} ${pc} / ${t('label.mobile')} ${mobile}`;
}

function build_schedule_card(item) {
  const acc = { id: item.id, label: item.label };
  const sched = item.schedule || {};

  const card = document.createElement('div');
  card.className = 'schedule-card' + (sched.enabled ? '' : ' disabled');
  card.dataset.id = item.id;

  // Header: accordion trigger (avatar + info + chevron) + enable toggle.
  const header = document.createElement('div');
  header.className = 'schedule-card-header';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'schedule-card-trigger';
  trigger.setAttribute('aria-expanded', 'false');

  trigger.appendChild(make_avatar(acc));

  const title = document.createElement('div');
  title.className = 'schedule-card-title';
  const name = document.createElement('div');
  name.className = 'schedule-card-name';
  name.textContent = acc.label;
  const status = document.createElement('div');
  status.className = 'schedule-card-status';
  status.textContent = format_schedule_summary(item, sched, Boolean(sched.enabled));
  title.appendChild(name);
  title.appendChild(status);
  trigger.appendChild(title);

  const chev = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  chev.setAttribute('class', 'schedule-card-chev');
  chev.setAttribute('width', '14');
  chev.setAttribute('height', '14');
  chev.setAttribute('viewBox', '0 0 24 24');
  chev.setAttribute('fill', 'none');
  chev.setAttribute('stroke', 'currentColor');
  chev.setAttribute('stroke-width', '2');
  chev.setAttribute('stroke-linecap', 'round');
  chev.setAttribute('stroke-linejoin', 'round');
  chev.innerHTML = '<polyline points="6 9 12 15 18 9"></polyline>';
  trigger.appendChild(chev);

  header.appendChild(trigger);

  const toggleWrap = document.createElement('label');
  toggleWrap.className = 'toggle-compact';
  toggleWrap.title = t('schedule_enable');
  const toggleInput = document.createElement('input');
  toggleInput.type = 'checkbox';
  toggleInput.className = 'schedule-enabled';
  toggleInput.checked = Boolean(sched.enabled);
  toggleInput.setAttribute('aria-label', tf('schedule_enable_for', { name: acc.label }));
  const togglePill = document.createElement('span');
  togglePill.className = 'toggle-pill';
  toggleWrap.appendChild(toggleInput);
  toggleWrap.appendChild(togglePill);
  header.appendChild(toggleWrap);

  card.appendChild(header);

  // Body (collapsed by default via CSS).
  const body = document.createElement('div');
  body.className = 'schedule-card-body';

  // Dashboard variant row (applies to any run, not just scheduled ones):
  // which Microsoft Rewards dashboard this account uses for the Daily Set.
  const DASHBOARD_VARIANTS = ['auto', 'legacy', 'new'];
  const dashDefault = DASHBOARD_VARIANTS.includes(item.dashboard_variant)
    ? item.dashboard_variant : 'auto';
  body.appendChild(make_select_field(t('schedule_dashboard'), 'schedule-dashboard', dashDefault, [
    { value: 'auto', label: t('dashboard_auto') },
    { value: 'legacy', label: t('dashboard_legacy') },
    { value: 'new', label: t('dashboard_new') },
  ]));

  // Advanced scheduling sub-toggle row.
  const advRow = document.createElement('label');
  advRow.className = 'sched-adv-row';
  const advInput = document.createElement('input');
  advInput.type = 'checkbox';
  advInput.className = 'schedule-advanced';
  advInput.checked = Boolean(sched.advancedScheduling);
  const advPill = document.createElement('span');
  advPill.className = 'toggle-pill';
  const advLabel = document.createElement('span');
  advLabel.className = 'sched-adv-label';
  advLabel.textContent = t('advanced_scheduling');
  const advWrap = document.createElement('span');
  advWrap.className = 'toggle-compact';
  advWrap.appendChild(advInput);
  advWrap.appendChild(advPill);
  advRow.appendChild(advWrap);
  advRow.appendChild(advLabel);
  body.appendChild(advRow);

  // PC + Mobile row.
  const rowPcMobile = document.createElement('div');
  rowPcMobile.className = 'form-grid-2';
  const pcDefault = sched.queries_pc != null ? sched.queries_pc : 15;
  const mobileDefault = sched.queries_mobile != null ? sched.queries_mobile : 15;
  rowPcMobile.appendChild(make_form_field(t('pc_searches'), 'number', 'schedule-queries-pc', pcDefault, { min: 0, max: 130 }));
  rowPcMobile.appendChild(make_form_field(t('mobile_searches'), 'number', 'schedule-queries-mobile', mobileDefault, { min: 0, max: 99 }));
  body.appendChild(rowPcMobile);

  // Daily fire time row — when the OS-level scheduled task triggers for
  // this account. Only effective when the global Start-with-Windows
  // toggle is on AND this account's schedule is enabled.
  const timeDefault = (sched.run_time && /^\d{2}:\d{2}$/.test(sched.run_time)) ? sched.run_time : '09:00';
  body.appendChild(make_form_field(t('daily_run_time'), 'time', 'schedule-run-time', timeDefault, {}));

  // Duration + qph row (only meaningful when advancedScheduling is on).
  const rowAdv = document.createElement('div');
  rowAdv.className = 'form-grid-2 sched-adv-fields';
  const durDefault = sched.runDuration != null ? sched.runDuration : 3;
  const qphDefault = sched.queriesPerHour != null ? sched.queriesPerHour : 10;
  rowAdv.appendChild(make_form_field(t('run_duration'), 'number', 'schedule-run-duration', durDefault, { min: 1, max: 24 }));
  rowAdv.appendChild(make_form_field(t('queries_hour'), 'number', 'schedule-queries-per-hour', qphDefault, { min: 1, max: 99 }));
  if (!advInput.checked) rowAdv.classList.add('dim');
  body.appendChild(rowAdv);

  card.appendChild(body);

  // Accordion expand/collapse on trigger click — one open at a time.
  trigger.addEventListener('click', () => {
    const wasExpanded = card.classList.contains('expanded');
    const container = document.getElementById('schedule_accounts_list');
    if (container) {
      container.querySelectorAll('.schedule-card.expanded').forEach(other => {
        other.classList.remove('expanded');
        const otherTrig = other.querySelector('.schedule-card-trigger');
        if (otherTrig) otherTrig.setAttribute('aria-expanded', 'false');
      });
    }
    if (!wasExpanded) {
      card.classList.add('expanded');
      trigger.setAttribute('aria-expanded', 'true');
      // Bring the freshly-expanded card into view inside its scrollable
      // container so its body fields aren't clipped when there are many
      // accounts. Wait for the max-height transition to start so we know
      // the final layout height.
      setTimeout(() => {
        try {
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (_) { /* older webview engines */ }
      }, 240);
    }
  });

  // Live summary refresh whenever a field changes.
  const refreshSummary = () => {
    const liveSched = {
      advancedScheduling: advInput.checked,
      queries_pc: parseInt(card.querySelector('.schedule-queries-pc').value, 10),
      queries_mobile: parseInt(card.querySelector('.schedule-queries-mobile').value, 10),
      runDuration: parseInt(card.querySelector('.schedule-run-duration').value, 10),
      queriesPerHour: parseInt(card.querySelector('.schedule-queries-per-hour').value, 10),
      run_time: card.querySelector('.schedule-run-time').value,
    };
    status.textContent = format_schedule_summary(item, liveSched, toggleInput.checked);
  };

  toggleInput.addEventListener('change', () => {
    card.classList.toggle('disabled', !toggleInput.checked);
    refreshSummary();
  });
  advInput.addEventListener('change', () => {
    rowAdv.classList.toggle('dim', !advInput.checked);
    refreshSummary();
  });
  body.querySelectorAll('input[type="number"], input[type="time"]').forEach(f => {
    f.addEventListener('input', refreshSummary);
  });

  return card;
}

function make_select_field(labelText, className, value, options) {
  const wrap = document.createElement('div');
  wrap.className = 'form-field';

  const label = document.createElement('label');
  label.textContent = labelText;
  wrap.appendChild(label);

  const select = document.createElement('select');
  select.className = className;
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    if (opt.value === value) o.selected = true;
    select.appendChild(o);
  });
  wrap.appendChild(select);

  return wrap;
}

function make_form_field(labelText, inputType, className, value, opts) {
  const wrap = document.createElement('div');
  wrap.className = 'form-field';

  const label = document.createElement('label');
  label.textContent = labelText;
  wrap.appendChild(label);

  const input = document.createElement('input');
  input.type = inputType;
  input.className = className;
  input.value = value;
  if (opts) {
    if (opts.min !== undefined) input.min = opts.min;
    if (opts.max !== undefined) input.max = opts.max;
  }
  wrap.appendChild(input);

  return wrap;
}

async function save_settings() {
  if (!settingsLoaded) return;
  const cards = Array.from(document.querySelectorAll('#schedule_accounts_list .schedule-card'));
  const closeToTrayWanted = document.getElementById('closeToTrayToggle').checked;
  const startupWanted = document.getElementById('startupToggle').checked;
  const openOnLoginWanted = document.getElementById('openOnLoginToggle').checked;

  const minDelayEl = document.getElementById('manualSearchDelayMin');
  const maxDelayEl = document.getElementById('manualSearchDelayMax');
  const minDelay = minDelayEl ? parseFloat(minDelayEl.value) : 4.0;
  const maxDelay = maxDelayEl ? parseFloat(maxDelayEl.value) : 10.0;
  if (
    !Number.isFinite(minDelay) ||
    !Number.isFinite(maxDelay) ||
    minDelay < 0 ||
    maxDelay < 0 ||
    minDelay > maxDelay ||
    maxDelay > 1800
  ) {
    show_toast('Pause between manual searches must be between 0 and 1800s (min ≤ max).', 'warning');
    return;
  }

  // Validate + collect payloads per account.
  const payloads = [];
  for (const card of cards) {
    const id = card.dataset.id;
    const enabled = card.querySelector('.schedule-enabled').checked;
    const advancedScheduling = card.querySelector('.schedule-advanced').checked;
    const pc = parseInt(card.querySelector('.schedule-queries-pc').value, 10);
    const mobile = parseInt(card.querySelector('.schedule-queries-mobile').value, 10);
    const runDuration = parseInt(card.querySelector('.schedule-run-duration').value, 10);
    const queriesPerHour = parseInt(card.querySelector('.schedule-queries-per-hour').value, 10);
    const runTime = card.querySelector('.schedule-run-time').value;
    const dashEl = card.querySelector('.schedule-dashboard');
    const dashboardVariant = dashEl && ['auto', 'legacy', 'new'].includes(dashEl.value)
      ? dashEl.value : 'auto';

    if (enabled) {
      if (isNaN(pc) || pc < 0 || pc > 130) {
        show_toast(t('schedule_pc_range'), 'warning');
        return;
      }
      if (isNaN(mobile) || mobile < 0 || mobile > 99) {
        show_toast(t('schedule_mobile_range'), 'warning');
        return;
      }
      if ((pc || 0) + (mobile || 0) === 0) {
        show_toast(t('schedule_choose_queries'), 'warning');
        return;
      }
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(runTime || '')) {
        show_toast(t('schedule_time_invalid'), 'warning');
        return;
      }
      if (advancedScheduling) {
        if (isNaN(runDuration) || runDuration < 1 || runDuration > 24) {
          show_toast(t('schedule_duration_range'), 'warning');
          return;
        }
        if (isNaN(queriesPerHour) || queriesPerHour < 1 || queriesPerHour > 99) {
          show_toast(t('schedule_qph_range'), 'warning');
          return;
        }
      }
    }

    payloads.push({
      id: id,
      dashboardVariant: dashboardVariant,
      payload: {
        enabled: enabled,
        advancedScheduling: advancedScheduling,
        queries_pc: isNaN(pc) ? 15 : pc,
        queries_mobile: isNaN(mobile) ? 15 : mobile,
        runDuration: isNaN(runDuration) ? 3 : runDuration,
        queriesPerHour: isNaN(queriesPerHour) ? 10 : queriesPerHour,
        run_time: /^([01]\d|2[0-3]):[0-5]\d$/.test(runTime || '') ? runTime : '09:00',
      },
    });
  }

  try {
    // Persist each account's dashboard choice first (independent of the
    // schedule payload; kept out of the results[] slicing below).
    await Promise.all(payloads.map(p =>
      pywebview.api.set_dashboard_variant(p.id, p.dashboardVariant)
    ));

    // Persist the force toggles (independent of the schedule slicing).
    const forceDailyEl = document.getElementById('forceDailyToggle');
    const forceVisualEl = document.getElementById('forceVisualToggle');
    await pywebview.api.set_force_tasks(
      Boolean(forceDailyEl && forceDailyEl.checked),
      Boolean(forceVisualEl && forceVisualEl.checked)
    );

    const hideEl = document.getElementById('hideBrowserToggle');
    if (hideEl) {
      await pywebview.api.set_hide_browser(Boolean(hideEl.checked));
    }
    const langEl = document.getElementById('uiLanguageSelect');
    if (langEl && pywebview.api.set_ui_language) {
      const r = await pywebview.api.set_ui_language(langEl.value);
      if (r && r.ui_locale) set_ui_lang(r.ui_locale);
    }

    // Persist LLM search-term config (independent of the schedule slicing).
    const llmToggleEl = document.getElementById('llmToggle');
    const llmBaseUrlEl = document.getElementById('llmBaseUrl');
    await pywebview.api.set_llm_config(
      Boolean(llmToggleEl && llmToggleEl.checked),
      document.getElementById('llmProvider').value,
      document.getElementById('llmModel').value,
      document.getElementById('llmApiKey').value,
      document.getElementById('llmLocale').value,
      llmBaseUrlEl ? llmBaseUrlEl.value : ''
    );

    if (pywebview.api.set_manual_search_delay) {
      await pywebview.api.set_manual_search_delay(minDelay, maxDelay);
    }

    const scheduleCalls = payloads.map(p =>
      pywebview.api.set_schedule(p.id, p.payload)
    );

    const startupInfo = await pywebview.api.get_launch_on_startup();
    let startupCall = Promise.resolve(true);
    if (startupInfo && startupInfo.supported && startupInfo.enabled !== startupWanted) {
      startupCall = pywebview.api.set_launch_on_startup(startupWanted);
    }

    const openOnLoginInfo = await pywebview.api.get_open_on_login();
    let openOnLoginCall = Promise.resolve(true);
    if (
      openOnLoginInfo && openOnLoginInfo.supported
      && openOnLoginInfo.enabled !== openOnLoginWanted
    ) {
      openOnLoginCall = pywebview.api.set_open_on_login(openOnLoginWanted);
    }

    // Close-to-tray: persist unconditionally. The backend reads it at next
    // app launch, so saving each time is cheap and avoids a stale state.
    const closeToTrayCall = pywebview.api.set_close_to_tray(closeToTrayWanted);

    const results = await Promise.all([
      ...scheduleCalls, startupCall, openOnLoginCall, closeToTrayCall,
    ]);
    const startupOk = results[scheduleCalls.length];
    const openOnLoginOk = results[scheduleCalls.length + 1];
    const scheduleResults = results.slice(0, scheduleCalls.length);
    const failures = scheduleResults.filter(ok => !ok).length;

    if (failures > 0) {
      show_toast(tf('schedules_failed', { count: failures }), 'error');
      return;
    }
    if (
      (!startupOk && startupInfo && startupInfo.supported)
      || (!openOnLoginOk && openOnLoginInfo && openOnLoginInfo.supported)
    ) {
      show_toast(t('settings_saved_startup_failed'), 'warning');
    } else {
      show_toast(t('settings_saved'), 'success');
    }
    close_settings_modal();
  } catch (err) {
    console.error('save_settings failed:', err);
    show_toast(t('save_failed'), 'error');
  }
}

// =========================================================================
// Master UI refresh
// =========================================================================

function refresh_account_ui() {
  if (!window.pywebview || !pywebview.api) return;

  pywebview.api.list_accounts().then(accounts => {
    accountsCache = Array.isArray(accounts) ? accounts : [];
    currentAccountId = null;
    for (const acc of accountsCache) {
      if (acc.is_current) { currentAccountId = acc.id; break; }
    }

    render_account_trigger();
    render_account_menu();

    // Empty state overlay.
    const emptyState = document.getElementById('empty_state');
    if (accountsCache.length === 0) {
      emptyState.hidden = false;
    } else {
      emptyState.hidden = true;
    }

    if (!runInProgress) {
      show_run_block_reason();
      const startBtn = document.getElementById('start_btn');
      const label = startBtn && startBtn.querySelector('.btn-label');
      const busy = driverWarmingUp || balanceFetching;
      const reason = start_block_reason();
      if (label && (label.textContent === t('run.start') || label.textContent === t('run.loading') || label.textContent === 'Start run' || label.textContent === 'Loading…')) {
        startBtn.disabled = Boolean(reason);
        label.textContent = busy ? t('run.loading') : t('run.start');
      }
      const tasksBtn = document.getElementById('tasks_only_btn');
      if (tasksBtn && (!label || label.textContent === t('run.start') || label.textContent === t('run.loading') || label.textContent === 'Start run')) {
        tasksBtn.disabled = Boolean(reason);
      }
    }

    update_status_indicator();

    // Stats are per-account — refresh the compact card for the new selection.
    refresh_stats_ui();
    refresh_rewards_overview();
    refresh_phone_ui();

    // Re-render the accounts management modal list if open.
    if (typeof render_accounts_section === 'function') {
      render_accounts_section(accountsCache);
    }
  }).catch(err => {
    console.error('refresh_account_ui failed:', err);
  });
}

// =========================================================================
// Driver warmup loader
// =========================================================================

let loaderInterval;

function start_loader() {
  clearInterval(loaderInterval);

  driverWarmingUp = true;
  if (!runInProgress) {
    const startBtn = document.getElementById('start_btn');
    if (startBtn) {
      startBtn.disabled = true;
      const label = startBtn.querySelector('.btn-label');
      if (label) label.textContent = t('run.loading');
    }
    const tasksBtn = document.getElementById('tasks_only_btn');
    if (tasksBtn) tasksBtn.disabled = true;
  }

  const tryShowLoader = () => {
    pywebview.api.check_driver_status().then(isLoading => {
      if (isLoading === true && !document.getElementById('inline_loader')) {
        const logDiv = document.getElementById('log_area');
        const loader = document.createElement('div');
        loader.id = 'inline_loader';
        loader.className = 'loader-line';
        loader.innerHTML = `<span class="spinner"></span><span>${t('settings.preparing_driver')}</span>`;
        logDiv.appendChild(loader);
        logDiv.scrollTop = logDiv.scrollHeight;
      }
      if (isLoading === false) stop_loader();
    }).catch(err => {
      console.error('Failed to check driver status:', err);
      stop_loader();
    });
  };

  tryShowLoader();
  loaderInterval = setInterval(tryShowLoader, 500);
}

function stop_loader() {
  clearInterval(loaderInterval);
  driverWarmingUp = false;

  const inline = document.getElementById('inline_loader');
  if (inline) inline.remove();

  if (!runInProgress) enable_start_button();
  update_status_indicator();
}

// =========================================================================
// Boot
// =========================================================================

document.addEventListener('DOMContentLoaded', function() {
  // Hide-browser toggle.
  const toggle = document.getElementById('hideBrowserToggle');
  if (toggle) toggle.addEventListener('change', hideBrowserToggle);

  // Empty-state CTA opens the same account manager used by the person icon.
  const cta = document.getElementById('empty_cta');
  if (cta) cta.addEventListener('click', open_accounts_modal);

  const deleteAccountBtn = document.getElementById('deleteAccountBtn');
  if (deleteAccountBtn) deleteAccountBtn.addEventListener('click', delete_current_account);

  const accountTrigger = document.getElementById('account_trigger');
  if (accountTrigger) {
    accountTrigger.addEventListener('click', (e) => {
      if (e.target.closest('#deleteAccountBtn')) return;
      toggle_account_menu();
    });
    accountTrigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target.closest('#deleteAccountBtn')) return;
        e.preventDefault();
        toggle_account_menu();
      }
    });
  }
  document.addEventListener('click', (e) => {
    const picker = document.getElementById('account_picker');
    if (picker && !picker.contains(e.target)) {
      toggle_account_menu(false);
    }
  });

  // Header "manage accounts" button.
  const manageBtn = document.getElementById('manageBtn');
  if (manageBtn) manageBtn.addEventListener('click', open_accounts_modal);

  // Header settings button.
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) settingsBtn.addEventListener('click', open_settings_modal);

  // Settings modal close + save.
  const settingsClose = document.getElementById('settingsModalClose');
  if (settingsClose) settingsClose.addEventListener('click', close_settings_modal);
  const settingsCancel = document.getElementById('settingsCancel');
  if (settingsCancel) settingsCancel.addEventListener('click', close_settings_modal);
  const settingsSave = document.getElementById('settingsSave');
  if (settingsSave) settingsSave.addEventListener('click', save_settings);

  // LLM feature toggle dims/undims its config fields live.
  const llmToggle = document.getElementById('llmToggle');
  if (llmToggle) llmToggle.addEventListener('change', apply_llm_field_state);
  const llmProvider = document.getElementById('llmProvider');
  if (llmProvider) llmProvider.addEventListener('change', apply_llm_field_state);
  const settingsModal = document.getElementById('settings_modal');
  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) close_settings_modal();
    });
  }
  // Accounts modal close.
  const accountsModalClose = document.getElementById('accountsModalClose');
  if (accountsModalClose) accountsModalClose.addEventListener('click', close_accounts_modal);
  const accountsModal = document.getElementById('accounts_modal');
  if (accountsModal) {
    accountsModal.addEventListener('click', (e) => {
      if (e.target === accountsModal) close_accounts_modal();
    });
  }

  // Generic modal wiring.
  const modalConfirm = document.getElementById('modal_confirm');
  const modalCancel = document.getElementById('modal_cancel');
  const modalInput = document.getElementById('modal_input');
  const modalBackdrop = document.getElementById('app_modal');

  if (modalConfirm) {
    modalConfirm.addEventListener('click', () => {
      const input = document.getElementById('modal_input');
      const value = input.hidden ? true : input.value;
      close_modal(value);
    });
  }
  if (modalCancel) modalCancel.addEventListener('click', () => close_modal(null));
  if (modalInput) {
    modalInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); modalConfirm.click(); }
      else if (e.key === 'Escape') modalCancel.click();
    });
  }
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) close_modal(null);
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalBackdrop && !modalBackdrop.hidden) close_modal(null);
  });
});

window.addEventListener('pywebviewready', function() {
  // Report the OS/browser language so LLM query generation can default to it.
  try {
    if (navigator && navigator.language &&
        typeof pywebview.api.set_detected_locale === 'function') {
      pywebview.api.set_detected_locale(navigator.language);
    }
  } catch (e) {
    console.error('Failed to report locale:', e);
  }

  pywebview.api.get_settings().then(function(settings) {
    window.__arWindowsLocale = settings.windows_locale || '';
    const toggle = document.getElementById('hideBrowserToggle');
    if (toggle) toggle.checked = Boolean(settings.hide_browser);
    const ver = document.getElementById('app_version');
    if (ver && settings.app_version) {
      ver.textContent = 'Microsoft Rewards · ' + settings.app_version;
    }
    const langSel = document.getElementById('uiLanguageSelect');
    if (langSel) {
      langSel.value = settings.ui_language || 'auto';
      langSel.onchange = function () {
        pywebview.api.set_ui_language(langSel.value).then(function (r) {
          const loc = r && r.ui_locale ? r.ui_locale : resolve_lang_from_settings({
            ui_language: langSel.value,
            windows_locale: settings.windows_locale,
            detected_locale: settings.detected_locale,
          });
          set_ui_lang(loc);
          const settingsBackdrop = document.getElementById('settings_modal');
          if (settingsBackdrop && !settingsBackdrop.hidden) {
            open_settings_modal();
          }
        });
      };
    }
    set_ui_lang(resolve_lang_from_settings(settings));
  });

  // Load saved query counts from global settings.
  pywebview.api.get_queries_counts().then(function(counts) {
    const pcField = document.getElementById('count_pc');
    const mobileField = document.getElementById('count_mobile');
    if (pcField) pcField.value = counts.queries_pc;
    if (mobileField) mobileField.value = counts.queries_mobile;
  }).catch(err => {
    console.error('Failed to load query counts:', err);
  });

  refresh_account_ui();
  start_loader();
  setup_activity_context_menu();
  refresh_manual_tasks();
  refresh_phone_ui();
  // This performs a live /earn scrape, so rapid polling would keep opening
  // short-lived Edge processes and make the whole app feel slow.
  setInterval(refresh_manual_tasks, 300000);
  setInterval(function () {
    const modal = document.getElementById('phone_pair_modal');
    if (modal && !modal.hidden) refresh_phone_ui();
  }, 2000);
  setInterval(refresh_phone_ui, 8000);

  try {
    if (typeof pywebview.api.gui_ready === 'function') {
      pywebview.api.gui_ready().then(function (autorun) {
        if (autorun) set_running_ui(true);
      }).catch(function () {});
    }
  } catch (e) {
    console.error('gui_ready failed:', e);
  }
});

function switch_app_tab(name) {
  const isManual = name === 'manual';
  const run = document.getElementById('panel_run');
  const man = document.getElementById('panel_manual');
  const btnRun = document.getElementById('tab_btn_run');
  const btnMan = document.getElementById('tab_btn_manual');
  if (run) run.hidden = isManual;
  if (man) man.hidden = !isManual;
  if (btnRun) {
    btnRun.classList.toggle('is-active', !isManual);
    btnRun.setAttribute('aria-selected', String(!isManual));
  }
  if (btnMan) {
    btnMan.classList.toggle('is-active', isManual);
    btnMan.setAttribute('aria-selected', String(isManual));
  }
  if (isManual) refresh_manual_tasks();
}

function refresh_manual_tasks() {
  if (!window.pywebview || !pywebview.api) return;
  const loader = pywebview.api.refresh_manual_tasks || pywebview.api.get_manual_tasks;
  if (!loader) return;
  loader().then(render_manual_tasks).catch(function () {});
}

function render_manual_tasks(data) {
  const list = document.getElementById('manual_task_list');
  const ignoredList = document.getElementById('manual_ignored_list');
  const badge = document.getElementById('manual_badge');
  if (!list) return;
  const tasks = (data && data.tasks) || [];
  const active = tasks.filter(function (t) { return !t.ignored; });
  const ignored = tasks.filter(function (t) { return t.ignored; });
  if (badge) {
    badge.textContent = String(active.length);
    badge.hidden = active.length === 0;
  }
  list.innerHTML = '';
  if (!active.length) {
    const empty = document.createElement('p');
    empty.className = 'manual-empty';
    empty.textContent = data && data.refreshing
      ? t('tasks.detecting')
      : t('tasks.empty');
    list.appendChild(empty);
  }
  active.forEach(function (t) { list.appendChild(_manual_row(t, false)); });
  if (ignoredList) {
    ignoredList.innerHTML = '';
    ignored.forEach(function (t) { ignoredList.appendChild(_manual_row(t, true)); });
    const wrap = document.getElementById('manual_ignored_wrap');
    if (wrap) wrap.hidden = ignored.length === 0;
  }
}

function _manual_row(task, isIgnored) {
  const row = document.createElement('div');
  row.className = 'manual-row' + (isIgnored ? ' is-ignored' : '');
  const body = document.createElement('div');
  body.className = 'manual-row-text';
  const title = document.createElement('div');
  title.className = 'manual-row-title';
  title.textContent = task.title || task.id;
  const detail = document.createElement('div');
  detail.className = 'manual-row-detail';
  detail.textContent = task.detail || '';
  body.appendChild(title);
  body.appendChild(detail);
  const actions = document.createElement('div');
  actions.className = 'manual-row-actions';
  const openBtn = document.createElement('button');
  openBtn.type = 'button';
  openBtn.className = 'btn-secondary';
  openBtn.textContent = t('tasks.open');
  openBtn.onclick = function () {
    if (window.pywebview && pywebview.api) pywebview.api.open_manual_task(task.id);
  };
  actions.appendChild(openBtn);
  if (isIgnored) {
    const un = document.createElement('button');
    un.type = 'button';
    un.className = 'ghost-link';
    un.textContent = t('tasks.unignore');
    un.onclick = function () {
      pywebview.api.ignore_manual_task(task.id, false).then(render_manual_tasks);
    };
    actions.appendChild(un);
  } else {
    const ign = document.createElement('button');
    ign.type = 'button';
    ign.className = 'ghost-link';
    ign.textContent = t('tasks.ignore');
    ign.onclick = function () {
      pywebview.api.ignore_manual_task(task.id, true).then(render_manual_tasks);
    };
    actions.appendChild(ign);
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'ghost-link danger-link';
    rm.textContent = t('tasks.remove');
    rm.onclick = function () {
      pywebview.api.remove_manual_task(task.id).then(render_manual_tasks);
    };
    actions.appendChild(rm);
  }
  row.appendChild(body);
  row.appendChild(actions);
  return row;
}

function copy_activity_log() {
  const logDiv = document.getElementById('log_area');
  const text = logDiv ? (logDiv.innerText || '').trim() : '';
  if (!text) {
  show_toast(t('activity_log_empty'), 'info');
    return;
  }
  const done = () => show_toast(t('activity_log_copied'), 'success');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(fallbackCopy);
  } else {
    fallbackCopy();
  }
  function fallbackCopy() {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      done();
    } catch (err) {
  show_toast(t('activity_copy_failed'), 'error');
    }
    ta.remove();
  }
}

function setup_activity_context_menu() {
  const logDiv = document.getElementById('log_area');
  if (!logDiv) return;

  let menu = document.getElementById('activity_ctx_menu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'activity_ctx_menu';
    menu.className = 'ctx-menu';
    menu.hidden = true;
    const btn = document.createElement('button');
    btn.type = 'button';
  btn.textContent = t('copy_all');
    btn.addEventListener('click', () => {
      menu.hidden = true;
      copy_activity_log();
    });
    menu.appendChild(btn);
    document.body.appendChild(menu);
  }

  const hide = () => { menu.hidden = true; };
  logDiv.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    menu.hidden = false;
    const x = Math.min(e.clientX, window.innerWidth - 180);
    const y = Math.min(e.clientY, window.innerHeight - 48);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
  });
  document.addEventListener('click', hide);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
  });
}

// =========================================================================
// Linked phone (same Microsoft account, companion APK)
// =========================================================================

let _phoneCache = null;

function refresh_phone_ui() {
  if (!window.pywebview || !pywebview.api || !pywebview.api.get_phone_bridge) return;
  pywebview.api.get_phone_bridge().then(render_phone_device).catch(function () {});
}

function render_phone_device(info) {
  _phoneCache = info || null;
  const wrap = document.getElementById('phone_device_wrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  const phones = (info && info.phones) || [];
  const membership = translate_runtime_text((info && info.membership) || 'Microsoft Rewards');
  const region = translate_runtime_text((info && info.region) || '');
  const ready = info && info.account && info.account.first_setup_done;
  const readyLabel = ready ? t('phone.ready_state') : t('phone.setup_state');
  const suffix = region ? ` · ${membership} · ${region} · ${t('phone.by_phone')}` : ` · ${membership} · ${t('phone.by_phone')}`;

  if (!phones.length) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'phone-row is-empty';
    btn.innerHTML =
      '<span class="avatar" aria-hidden="true">+</span>' +
      '<span class="account-info"><span class="account-name">' + t('link_phone') + '</span>' +
      '<span class="account-meta">' + t('account.same_microsoft') + '</span></span>';
    btn.addEventListener('click', begin_phone_pairing);
    wrap.appendChild(btn);
  } else {
    phones.forEach(function (phone) {
      const row = document.createElement('div');
      row.className = 'phone-row is-linked';
      const top = document.createElement('div');
      top.className = 'phone-row-top';
      const avatar = document.createElement('span');
      avatar.className = 'avatar phone-ico';
      avatar.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"></rect><line x1="11" y1="18" x2="13" y2="18"></line></svg>';
      const infoEl = document.createElement('span');
      infoEl.className = 'account-info';
      const name = document.createElement('span');
      name.className = 'account-name';
      name.textContent = phone.name || t('phone');
      const meta = document.createElement('span');
      meta.className = 'account-meta';
      meta.textContent = readyLabel + suffix;
      infoEl.appendChild(name);
      infoEl.appendChild(meta);
      const dot = document.createElement('span');
      dot.className = 'phone-dot' + (phone.online ? ' on' : '');
      dot.title = phone.online ? t('phone.online') : t('phone.offline');
      const unlink = document.createElement('button');
      unlink.type = 'button';
      unlink.className = 'phone-mini danger-subtle';
      unlink.textContent = t('unlink');
      unlink.addEventListener('click', function () {
        unlink.disabled = true;
        pywebview.api.unlink_phone(phone.id).then(function (info) {
          if (!info || info.phone_unlinked !== true) {
            show_toast(t('phone_already_unlinked'), 'warning');
            unlink.disabled = false;
            refresh_account_ui();
            return;
          }
          show_toast(t('phone_unlinked'), 'info');
          refresh_phone_ui();
          refresh_account_ui();
        }).catch(function (err) {
          console.error('unlink_phone failed:', err);
          show_toast(t('phone_unlink_failed'), 'error');
          unlink.disabled = false;
          refresh_account_ui();
        });
      });
      top.appendChild(avatar);
      top.appendChild(infoEl);
      top.appendChild(dot);
      top.appendChild(unlink);

      const actions = document.createElement('div');
      actions.className = 'phone-row-actions';
      const runAll = document.createElement('button');
      runAll.type = 'button';
      runAll.className = 'phone-mini primary-subtle';
      runAll.textContent = t('phone.run_all_short');
      runAll.title = t('phone.run_all');
      runAll.addEventListener('click', function () {
        pywebview.api.send_phone_job('all').then(function (r) {
          if (!r || !r.ok) show_toast((r && r.error) || t('phone_offline_toast'), 'warning');
          else show_toast(t('phone_all_sent'), 'success');
        });
      });
      const ask = document.createElement('button');
      ask.type = 'button';
      ask.className = 'phone-mini';
      ask.textContent = t('checkin');
      ask.title = t('checkin');
      ask.addEventListener('click', function () {
        pywebview.api.send_phone_job('checkin').then(function (r) {
          if (!r || !r.ok) show_toast((r && r.error) || t('phone_offline_toast'), 'warning');
          else show_toast(t('checkin_sent'), 'success');
        });
      });
      const claimBtn = document.createElement('button');
      claimBtn.type = 'button';
      claimBtn.className = 'phone-mini';
      claimBtn.textContent = t('claim');
      claimBtn.title = t('claim');
      claimBtn.addEventListener('click', function () {
        pywebview.api.send_phone_job('claim').then(function (r) {
          if (!r || !r.ok) show_toast((r && r.error) || t('phone_offline_toast'), 'warning');
          else show_toast(t('claim_sent'), 'success');
        });
      });
      const news = document.createElement('button');
      news.type = 'button';
      news.className = 'phone-mini';
      news.textContent = t('news');
      news.addEventListener('click', function () {
        pywebview.api.send_phone_job('news').then(function (r) {
          if (!r || !r.ok) show_toast((r && r.error) || t('phone_offline_toast'), 'warning');
          else show_toast(t('news_sent'), 'success');
        });
      });
      actions.appendChild(runAll);
      actions.appendChild(ask);
      actions.appendChild(claimBtn);
      actions.appendChild(news);

      row.appendChild(top);
      row.appendChild(actions);
      wrap.appendChild(row);
    });
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'phone-mini';
    add.textContent = t('link_another_phone');
    add.addEventListener('click', begin_phone_pairing);
    wrap.appendChild(add);
  }

  const modal = document.getElementById('phone_pair_modal');
  if (modal && !modal.hidden) {
    const apkQr = document.getElementById('phone_apk_qr');
    if (apkQr) {
      if (info && info.apk_qr) {
        apkQr.src = info.apk_qr;
        apkQr.hidden = false;
      } else {
        apkQr.hidden = true;
      }
    }
    const codeEl = document.getElementById('phone_pair_code');
    const metaEl = document.getElementById('phone_pair_meta');
    if (info && info.pairing && info.code) {
      if (codeEl) {
        codeEl.textContent = info.code;
        codeEl.onclick = copy_pair_code;
      }
      const qr = document.getElementById('phone_pair_qr');
      if (qr) {
        if (info.qr) {
          qr.src = info.qr;
          qr.hidden = false;
        } else {
          qr.hidden = true;
        }
      }
      if (metaEl) {
        metaEl.textContent = info.public_url || info.tunnel === 'error'
          ? t('pair.ready')
          : t('pair.waiting');
      }
    } else if (phones.some(function (p) { return p.online; })) {
      if (metaEl) metaEl.textContent = t('phone_online_close');
    }
  }
}

function set_phone_pair_step(step) {
  const isStep1 = step !== 2;
  const s1 = document.getElementById('phone_pair_step1');
  const s2 = document.getElementById('phone_pair_step2');
  const t1 = document.getElementById('pair_tab_step1');
  const t2 = document.getElementById('pair_tab_step2');
  const nextBtn = document.getElementById('phone_pair_next_btn');
  const backBtn = document.getElementById('phone_pair_back_btn');
  if (s1) s1.hidden = !isStep1;
  if (s2) s2.hidden = isStep1;
  if (t1) {
    t1.classList.toggle('is-active', isStep1);
    t1.setAttribute('aria-selected', String(isStep1));
  }
  if (t2) {
    t2.classList.toggle('is-active', !isStep1);
    t2.setAttribute('aria-selected', String(!isStep1));
  }
  if (nextBtn) nextBtn.hidden = !isStep1;
  if (backBtn) backBtn.hidden = isStep1;
}

function copy_apk_download_link() {
  const url = (_phoneCache && _phoneCache.apk_download_url) || 'https://github.com/iGlitchOn/AutoRewarder-Mobile/releases/latest';
  const done = function () { show_toast(t('pair.apk_link_copied'), 'success'); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(done).catch(function () {
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        done();
      } catch (e) {}
    });
  }
}

function begin_phone_pairing() {
  if (!window.pywebview || !pywebview.api) return;
  pywebview.api.begin_phone_pairing().then(function (info) {
    const modal = document.getElementById('phone_pair_modal');
    if (modal) modal.hidden = false;
    set_phone_pair_step(1);
    render_phone_device(info);
  }).catch(function (err) {
    show_toast(t('pair_failed'), 'error');
    console.error(err);
  });
}

function copy_pair_code() {
  const el = document.getElementById('phone_pair_code');
  const code = el ? String(el.textContent || '').replace(/\D/g, '') : '';
  if (!code || code === '------') return;
  const done = function () { show_toast(t('pair.copied'), 'success'); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(done).catch(function () {
      try {
        const ta = document.createElement('textarea');
        ta.value = code;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        done();
      } catch (e) {}
    });
  }
}

function cancel_phone_pairing(quiet) {
  const modal = document.getElementById('phone_pair_modal');
  if (modal) modal.hidden = true;
  if (quiet) return;
  if (!window.pywebview || !pywebview.api || !pywebview.api.cancel_phone_pairing) return;
  pywebview.api.cancel_phone_pairing().then(refresh_phone_ui).catch(function () {});
}
