"""Core API for bridging the GUI and automation routines."""

import os
import re
import sys
import time
import json
import math
import random
import ctypes
import platform
import shutil
import subprocess
import threading
import webbrowser
from datetime import datetime

# `webview` (pywebview) is imported lazily inside `open_history_window` — the
# only method that needs it — so AutoRewarder_CLI.py can import
# AutoRewarderAPI and run headless without dragging in pywebview or its
# display-layer requirements.

from .config import (
    APP_DIR,
    GUI_DIR,
    REPO,
    CURRENT_VERSION,
    GITHUB_VERSION,
    JSON_FILE_PATH,
    LOG_FILE_PATH,
    BASE_DIR,
    edge_profile_path,
    history_path,
    status_path,
    stats_path,
)
from .utils import (
    download_release_asset,
    extract_release_package,
    find_release_file,
    github_latest_release,
    is_portable_install,
    release_is_newer,
    wait_or_stop,
)
from .accounts import (
    AccountManager,
    AccountMetaManager,
    GlobalSettingsManager,
)
from .emulator import DriverManager, HumanBehavior, edge_policy
from .search import HistoryManager, SearchEngine, llm, resolve_search_locale
from .dailytasks import DailySet
from .stats import (
    StatsManager,
    scrape_points_balance,
    scrape_points_balance_debug,
    POINTS_PER_SEARCH,
    POINTS_PER_CARD,
)

# Default wall-clock fire time (24h "HH:MM") if an account schedule does
# not yet have a `run_time` value. Each account stores its own time in
# meta.json; this constant is only the fallback default for fresh accounts.
AUTOSTART_TIME = "09:00"

# Keep the displayed Rewards balance reasonably fresh without repeatedly
# opening WebDriver against the same Edge profile. Launch, account changes,
# and run completion still refresh immediately; this is only the idle poll.
POINTS_REFRESH_INTERVAL = 300.0

# Naming prefix for the OS-level scheduled task / systemd unit. Each
# account gets its own task: AutoRewarder.<account_id> on Windows,
# autorewarder-<account_id>.{service,timer} on Linux. The unsuffixed
# names (without account_id) are reserved as legacy markers from the
# previous single-task design and only cleaned up, never created.
_AUTOSTART_TASK_NAME = "AutoRewarder"
_SYSTEMD_UNIT_NAME = "autorewarder"
_LOGIN_RUN_VALUE = "AutoRewarderGUI"

# Default min/max delay for normal manual searches, in seconds.
DEFAULT_SEARCH_DELAY = (4.0, 10.0)

# HH:MM validator — accepts 00:00..23:59.
_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def _normalize_run_time(value):
    """Return a valid HH:MM string, falling back to AUTOSTART_TIME."""
    if isinstance(value, str) and _TIME_RE.match(value.strip()):
        return value.strip()
    return AUTOSTART_TIME


SUPPORTED_UI_LANGUAGES = ("en", "es", "pt", "zh")


def _windows_ui_locale():
    try:
        import ctypes

        langid = ctypes.windll.kernel32.GetUserDefaultUILanguage()
        primary = langid & 0xFF
        if primary == 0x0A:
            return "es"
        if primary == 0x09:
            return "en"
        if primary == 0x16:
            return "pt"
        if primary == 0x04:
            return "zh"
    except Exception:
        pass
    try:
        import locale as locmod

        name = (locmod.getdefaultlocale() or ("", ""))[0] or ""
        return name
    except Exception:
        return ""


class AutoRewarderAPI:
    """
    Core API class for AutoRewarder.

    Bridges the pywebview GUI and the Selenium automation. Multi-account aware:
    the driver, history, daily-set, and meta managers are rebuilt whenever the
    currently-selected account changes.
    """

    def __init__(self):
        self._webview_window = None
        self._update_window = None
        self._update_window_close_allowed = False
        self._pending_update = None
        self._driver_loader_thread_started = False
        self._update_check_started = False
        # Single-instance secondary windows: reused (and reloaded) instead of
        # stacking a new window on every open, which can leave the webview
        # backend rendering a blank window after a few opens.
        self._stats_window = None
        self._history_window = None
        self._background_logs_window = None
        self._driver = None
        self.is_driver_loading = False
        self._run_lock = threading.Lock()
        # Serializes ad-hoc balance scrapes so concurrent refreshes can't open
        # two drivers on the same Edge profile at once.
        self._balance_lock = threading.Lock()
        # Serializes stats.json updates from the periodic balance reader and
        # the run-finalization path, so one writer cannot overwrite the other.
        self._stats_lock = threading.Lock()
        self._points_refresh_thread_started = False
        self._points_refresh_stop = threading.Event()
        # Automatic quest discovery must be single-flight because it uses the
        # same Edge profile as balance refreshes and scheduled runs.
        self._manual_refresh_lock = threading.Lock()
        self._manual_refreshing = False
        # Prevent UI polling from starting a new Edge for every For you check.
        self._manual_last_refresh_at = {}
        # Set when the user clicks Stop. Long loops in search_engine and
        # daily_set poll this between iterations and bail out cleanly.
        self._stop_event = threading.Event()
        self._run_seq = 0
        self._from_login = False
        # A login-triggered run closes the GUI only when it finishes normally.
        # A user pressing Stop must be able to keep editing and run again.
        self._manual_stop_requested = False
        self._login_thread_started = False

        # Global (app-wide) settings. Per-account data is handled below.
        self.global_settings = GlobalSettingsManager()
        self.hide_browser = bool(
            self.global_settings.get_settings().get("hide_browser", False)
        )

        # Account layer: migration runs here. `account_manager` is the source of
        # truth for the dropdown.
        self.account_manager = AccountManager(
            self.global_settings, logger=self._safe_log
        )
        self.account_manager.migrate_legacy()

        # Per-account managers: rebuilt each time the active account changes.
        self.driver_manager = None
        self.history = None
        self.daily_set = None
        self.account_meta = None
        self.search_engine = None
        self.stats = None

        # Per-run stats accumulators, reset at the start of every main() call.
        self._session_counts = {
            "pc": 0,
            "mobile": 0,
            "cards": 0,
            "earn": 0,
            "quests": 0,
            "visual": 0,
            "checkins": 0,
            "news": 0,
            "edge_minutes": 0,
        }
        self._last_scraped_balance = None
        # Whether the Daily Set / visual search already ran in this main() call.
        # A "Force …" setting is persistent, so without these the PC batches of
        # an advanced schedule would each redo the task (and re-upload an image).
        self._daily_set_attempted = False
        self._visual_search_attempted = False
        # Last balance-scrape diagnostic ({value, via, candidates, url, title}),
        # surfaced to the dashboard so a failed read can be debugged in place.
        self._last_balance_debug = {}

        self._rebuild_account_context()
        try:
            from .phone_bridge import start_bridge

            start_bridge(self)
        except Exception as e:
            self._safe_log(f"[WARNING] Phone bridge failed to start: {e}")

        # One-shot migration: lift any pre-existing global schedule (v1 feature)
        # into the per-account meta.json it referenced.
        self._migrate_legacy_global_schedule()

        # One-shot migration: lift any pre-existing fire-on-login autostart
        # (HKCU Run / .desktop) into the new daily scheduled task / systemd
        # timer. Otherwise a previously-enabled autostart would keep opening
        # a visible GUI at every login until the user manually toggles.
        self._migrate_legacy_autostart()

        # After an update the exe is still in Program Files, but rewrite the
        # Windows login Run key and scheduled tasks so they keep the current
        # path and the user's saved defaults (queries, hide browser, etc.).
        self._resync_os_hooks()

        # Scheduled runs are driven by the OS autostart entry which launches
        # `AutoRewarder.py --headless` → `AutoRewarder_CLI.main()`. No in-app
        # daemon thread.

    # ------------------------------------------------------------------
    # Context lifecycle
    # ------------------------------------------------------------------

    def _rebuild_account_context(self):
        """(Re)build the per-account managers based on the currently-selected account."""
        current_id = self.account_manager.current_id()

        if current_id:
            profile = edge_profile_path(current_id)
            self.account_meta = AccountMetaManager(current_id)
            self.history = HistoryManager(history_path(current_id), logger=self.log)
            self.daily_set = DailySet(
                status_path(current_id),
                logger=self.log,
                dashboard_variant=self.account_meta.get_dashboard_variant(),
            )
            self.stats = StatsManager(stats_path(current_id), logger=self.log)
            self.driver_manager = DriverManager(
                profile_path=profile, hide_browser=self.hide_browser
            )
            self.search_engine = SearchEngine(logger=self.log, history=self.history)
        else:
            self.account_meta = None
            self.history = None
            self.daily_set = None
            self.stats = None
            self.driver_manager = DriverManager(
                profile_path=None, hide_browser=self.hide_browser
            )
            self.search_engine = SearchEngine(logger=self.log, history=None)

    # ------------------------------------------------------------------
    # Webview plumbing
    # ------------------------------------------------------------------

    def enable_login_autorun(self):
        """Mark this process as launched by Windows sign-in."""
        self._from_login = True
        self._manual_stop_requested = False

    def gui_ready(self):
        """Called from JS when the window is live. Starts login auto-run if needed."""
        if not self._from_login or self._login_thread_started:
            return False
        self._login_thread_started = True
        threading.Thread(target=self._login_autorun, daemon=True).start()
        return True

    def start_block_reason(self):
        """Why Start / Tasks only cannot run right now, or None if they can."""
        if self._run_lock.locked():
            return {
                "ok": False,
                "error": "already_running",
                "kind": "run",
                "message": "A run is already in progress.",
            }
        if self.account_manager.current_id() is None:
            return {
                "ok": False,
                "error": "no_microsoft_account",
                "kind": "microsoft",
                "message": "No Microsoft account selected.",
            }
        if self.account_meta is None or not self.account_meta.is_first_setup_done():
            return {
                "ok": False,
                "error": "microsoft_setup_pending",
                "kind": "microsoft",
                "message": "Microsoft account setup is not finished.",
            }
        if self.is_driver_loading:
            return {
                "ok": False,
                "error": "browser_loading",
                "kind": "browser",
                "message": "Wait for the browser to finish loading.",
            }
        return None

    def _login_command(self):
        exe = sys.executable
        if getattr(sys, "frozen", False):
            return f'"{exe}" --from-login'
        entry = os.path.join(BASE_DIR, "AutoRewarder.py")
        return f'"{exe}" "{entry}" --from-login'

    def _resync_os_hooks(self):
        """Re-write login + scheduled-task commands to this build's exe."""
        try:
            if bool(self.global_settings.get_settings().get("launch_on_login", False)):
                self._write_login_run_key(True)
        except Exception as e:
            self._safe_log(f"[WARNING] Could not refresh sign-in shortcut: {e}")
        try:
            if self.is_autostart_enabled():
                self._sync_all_autostart()
        except Exception as e:
            self._safe_log(f"[WARNING] Could not refresh scheduled tasks: {e}")

    def _write_login_run_key(self, enabled):
        if platform.system() != "Windows":
            return False
        import winreg

        run_key = r"Software\Microsoft\Windows\CurrentVersion\Run"
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, run_key) as key:
            if enabled:
                winreg.SetValueEx(
                    key, _LOGIN_RUN_VALUE, 0, winreg.REG_SZ, self._login_command()
                )
            else:
                try:
                    winreg.DeleteValue(key, _LOGIN_RUN_VALUE)
                except FileNotFoundError:
                    pass
        return True

    def _remaining_work(self):
        """How much of today's configured work is still open."""
        settings = self.global_settings.get_settings()
        pc_target = max(0, int(settings.get("queries_pc") or 0))
        mobile_target = max(0, int(settings.get("queries_mobile") or 0))
        today = datetime.now().date().isoformat()
        bucket = {}
        if self.stats is not None:
            try:
                bucket = (self.stats.get_stats().get("daily") or {}).get(today) or {}
            except Exception:
                bucket = {}
        pc_left = max(0, pc_target - int(bucket.get("pc") or 0))
        mobile_left = max(0, mobile_target - int(bucket.get("mobile") or 0))
        reasons = []
        if pc_left:
            reasons.append(f"PC {pc_left}")
        if mobile_left:
            reasons.append(f"Mobile {mobile_left}")
        tasks_pending = False
        if self.daily_set is not None:
            try:
                st = self.daily_set.get_task_status() or {}
            except Exception:
                st = {}
            live = st.get("live") if isinstance(st.get("live"), dict) else {}
            if st.get("daily") != "done":
                tasks_pending = True
                reasons.append("daily tasks")
            if st.get("checkin") != "done":
                tasks_pending = True
                reasons.append("check-in")
            news = st.get("news")
            news_pair = live.get("news")
            news_open = news != "done"
            if isinstance(news_pair, (list, tuple)) and len(news_pair) == 2:
                try:
                    news_open = int(news_pair[0]) < int(news_pair[1])
                except (TypeError, ValueError):
                    pass
            if news_open:
                tasks_pending = True
                reasons.append("news")
            if isinstance(live.get("claim"), int) and live.get("claim") > 0:
                tasks_pending = True
                reasons.append("claim")
            edge = live.get("edge")
            if isinstance(edge, (list, tuple)) and len(edge) == 2:
                try:
                    if int(edge[0]) < int(edge[1]):
                        tasks_pending = True
                        reasons.append("edge")
                except (TypeError, ValueError):
                    pass
            if live.get("hasVisual") and st.get("visual") != "done":
                tasks_pending = True
                reasons.append("visual search")
        return {
            "pc": pc_left,
            "mobile": mobile_left,
            "tasks": tasks_pending,
            "pending": bool(pc_left or mobile_left or tasks_pending),
            "reasons": reasons,
        }

    def _login_autorun(self):
        """Windows sign-in: run leftover work, or quit if today is already done."""
        try:
            waited = 0.0
            while self.is_driver_loading and waited < 90:
                time.sleep(0.4)
                waited += 0.4
            current = self.account_manager.get_current()
            if not current or not current.get("first_setup_done"):
                self.log("Sign-in run: no ready account. Closing.")
                self._quit_after_login()
                return
            work = self._remaining_work()
            if not work["pending"]:
                self.log("Sign-in run: nothing left today. Closing.")
                self._quit_after_login()
                return
            self.log(
                "Sign-in run: starting leftover work ("
                + ", ".join(work["reasons"])
                + ")."
            )
            try:
                if self._webview_window:
                    self._webview_window.evaluate_js("set_running_ui(true)")
            except Exception:
                pass
            daily_only = work["pc"] == 0 and work["mobile"] == 0
            self.main(work["pc"], work["mobile"], daily_only)
        except Exception as e:
            self.log(f"[ERROR] Sign-in run failed: {e}")
        if not self._manual_stop_requested:
            self._quit_after_login()

    def _quit_after_login(self):
        """Close the GUI after a Windows-login auto-run."""
        window = self._webview_window
        if window is None:
            return

        def _close():
            time.sleep(1.2)
            try:
                window.destroy()
            except Exception:
                pass

        threading.Thread(target=_close, daemon=True).start()

    def set_window(self, window):
        """
        Attach the webview window and start background tasks.

        Args:
            window: The webview window to attach.
        """
        self._webview_window = window
        self.start_update_check()
        self.start_points_refresh()
        try:
            from .phone_bridge import start_bridge

            start_bridge(self)
        except Exception as e:
            self._safe_log(f"[WARNING] Phone bridge failed to start: {e}")

        if not self._driver_loader_thread_started:
            self._driver_loader_thread_started = True
            threading.Thread(target=self.load_driver_in_background, daemon=True).start()

    def start_points_refresh(self):
        """Keep points refresh explicit instead of launching idle Edge copies."""
        if self._points_refresh_thread_started:
            return
        self._points_refresh_thread_started = True

    def _points_refresh_loop(self):
        """Keep the real points balance fresh both inside and outside runs."""
        while not self._points_refresh_stop.wait(POINTS_REFRESH_INTERVAL):
            try:
                self._refresh_points_once()
            except Exception as e:
                self._safe_log(f"[WARNING] Continuous points refresh failed: {e}")

    def _refresh_points_once(self):
        """Refresh from the active driver during a run, or a short-lived one otherwise."""
        account_id = self.account_manager.current_id()
        if (
            account_id is None
            or self.account_meta is None
            or not self.account_meta.is_first_setup_done()
        ):
            return

        # Never open a second Edge profile during a run.  The active driver is
        # safe to inspect without navigation; if its current page exposes the
        # Rewards counter, update the card immediately.
        if self._run_lock.locked():
            driver = self._driver
            if driver is None:
                return
            try:
                balance = scrape_points_balance(driver)
            except Exception:
                balance = None
            if balance is not None:
                self._persist_live_balance(account_id, balance)
            return

        # Outside a run, use the existing guarded refresh path. It skips while
        # startup warmup or another balance read owns the profile.
        self.refresh_balance(silent=True)

    def _persist_live_balance(self, account_id, balance):
        """Persist a live balance and notify both dashboard views."""
        if self.account_manager.current_id() != account_id or self.stats is None:
            return
        with self._stats_lock:
            before = self.stats.get_stats().get("balance", {}).get("current")
            self.stats.update_balance(balance)
        self._notify_stats_refresh()
        if before != int(balance):
            self._safe_log(f"Points balance updated: {int(balance):,}")

    def _safe_log(self, message):
        """
        Log wrapper usable before the webview window is attached.

        Args:
            message (str): The message to log.
        """
        if self._webview_window:
            self.log(message)
        else:
            print(message)

    def _reuse_window(self, window, url):
        """
        If `window` is still open, reload it (so it re-fetches fresh data) and
        bring it forward, returning True. Otherwise return False so the caller
        creates a new one. Guards against stacking duplicate / blank windows.
        """
        import webview

        if window is None or window not in webview.windows:
            return False
        try:
            window.load_url(url)
        except Exception:
            return False
        try:
            window.show()
        except Exception:
            pass
        return True

    def open_history_window(self):
        """Open (or refocus + reload) the history viewer window."""
        # Local import: pywebview is a GUI-only dependency, kept out of the
        # headless CLI import chain (see comment at top of this module).
        import webview

        url = os.path.join(GUI_DIR, "history.html")
        if self._reuse_window(self._history_window, url):
            return

        self._history_window = webview.create_window(
            title="Query History",
            url=url,
            js_api=self,
            width=700,
            height=500,
            resizable=True,
            background_color="#0d1117",
            text_select=True,
        )

    def open_background_logs_window(self):
        """Open (or refocus + reload) the background logs viewer window."""
        import webview

        url = os.path.join(GUI_DIR, "background_logs.html")
        if self._reuse_window(self._background_logs_window, url):
            return

        self._background_logs_window = webview.create_window(
            title="Background Logs",
            url=url,
            js_api=self,
            width=700,
            height=500,
            resizable=True,
            background_color="#0d1117",
            text_select=True,
        )

    def open_stats_window(self):
        """
        Open (or refocus + reload) the statistics dashboard window, docked to
        the right edge of the main window so it sits beside it instead of
        covering it. Falls back to the OS default position if the main window's
        geometry can't be read.
        """
        # Local import: pywebview is a GUI-only dependency, kept out of the
        # headless CLI import chain (see comment at top of this module).
        import webview

        url = os.path.join(GUI_DIR, "dashboard.html")
        if self._reuse_window(self._stats_window, url):
            return

        kwargs = {
            "title": "Statistics",
            "url": url,
            "js_api": self,
            "width": 760,
            "height": 620,
            "resizable": True,
            "background_color": "#0b0d12",
            "text_select": True,
        }

        pos = self._dock_position(kwargs["width"], kwargs["height"])
        if pos is not None:
            kwargs["x"], kwargs["y"] = pos

        self._stats_window = webview.create_window(**kwargs)

    def _dock_position(self, win_w, win_h):
        """
        Compute on-screen (x, y) to dock a secondary window beside the main one:
        to its right if there's room, otherwise to its left, otherwise clamped
        so the window stays fully within the screen work area (never off-screen).
        Returns None if the main window isn't attached or its geometry can't be
        read, so the caller falls back to the OS default position.
        """
        if self._webview_window is None:
            return None
        try:
            raw = self._webview_window.evaluate_js(
                "JSON.stringify({"
                "x: window.screenX, y: window.screenY, w: window.outerWidth,"
                "sx: (screen.availLeft || 0), sy: (screen.availTop || 0),"
                "sw: screen.availWidth, sh: screen.availHeight"
                "})"
            )
            data = json.loads(raw) if raw else {}
            main_x = int(data["x"])
            main_y = int(data["y"])
            main_w = int(data["w"])
            sx = int(data["sx"])
            sy = int(data["sy"])
            sw = int(data["sw"])
            sh = int(data["sh"])
        except Exception:
            return None

        gap = 6
        right = main_x + main_w + gap
        left = main_x - gap - win_w

        if right + win_w <= sx + sw:
            x = right  # fits to the right of the main window
        elif left >= sx:
            x = left  # otherwise dock to the left
        else:
            # Neither side fits cleanly — clamp so it stays fully on screen.
            x = max(sx, min(right, sx + sw - win_w))

        # Align with the main window's top, clamped to the work area.
        y = max(sy, min(main_y, sy + sh - win_h))
        return x, y

    def start_update_check(self):
        """Start a one-time background update check."""
        if self._update_check_started:
            return
        self._update_check_started = True
        threading.Thread(target=self.run_update_check, daemon=True).start()

    def run_update_check(self):
        """Check both upstream and custom releases and notify the UI."""
        try:
            result = self.check_updates()
        except Exception as e:
            self.log(f"[ERROR] Error checking for updates: {e}")
            return
        if not self._webview_window:
            return
        try:
            self._webview_window.evaluate_js(
                f"show_update_notice({json.dumps(result)})"
            )
        except Exception as e:
            self.log(f"[ERROR] Error displaying update link: {e}")

    def check_updates(self):
        """Check upstream and custom PC releases without downloading anything."""
        releases = []
        for kind, repo, baseline in (
            ("original", "safarsin/AutoRewarder", GITHUB_VERSION),
            ("custom", REPO, CURRENT_VERSION),
        ):
            release = github_latest_release(repo, logger=self.log)
            if release:
                release["kind"] = kind
                release["newer"] = bool(release_is_newer(release["tag"], baseline))
                releases.append(release)
        return {"ok": True, "current": CURRENT_VERSION, "releases": releases}

    def open_link(self, url):
        """Open a URL in the system default browser (PyInstaller-safe)."""
        try:
            if sys.platform == "linux":
                command = shutil.which("xdg-open")
                if command is None:
                    self.log(f"[ERROR] Could not find xdg-open to open {url}")
                    print(f"[ERROR] Could not find xdg-open to open {url}")
                    return False

                env = os.environ.copy()
                if getattr(sys, "frozen", False):
                    lp_orig = env.get("LD_LIBRARY_PATH_ORIG")
                    if lp_orig is not None:
                        env["LD_LIBRARY_PATH"] = lp_orig
                    else:
                        env.pop("LD_LIBRARY_PATH", None)

                    if "XDG_DATA_DIRS" in env:
                        meipass = getattr(sys, "_MEIPASS", None)
                        if meipass:
                            clean_paths = [
                                p
                                for p in env["XDG_DATA_DIRS"].split(":")
                                if not p.startswith(meipass)
                            ]
                            if not clean_paths:
                                clean_paths = ["/usr/local/share", "/usr/share"]
                            env["XDG_DATA_DIRS"] = ":".join(clean_paths)

                subprocess.Popen(
                    [command, url],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    start_new_session=True,
                    env=env,
                )
                return True
            return webbrowser.open(url)
        except OSError as e:
            self.log(f"[ERROR] Failed to open {url}: {e}")
            print(f"[ERROR] Failed to open {url}: {e}")
            return False

    def get_app_info(self):
        """Return version and storage details for the About panel."""
        return {
            "version": CURRENT_VERSION,
            "app_dir": APP_DIR,
            "repo_url": f"https://github.com/{REPO}",
            "platform": platform.system(),
        }

    def open_data_folder(self):
        """Open the app data folder in the OS file manager."""
        try:
            if sys.platform == "win32":
                os.startfile(APP_DIR)
            else:
                subprocess.Popen(
                    ["xdg-open", APP_DIR],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            return True
        except Exception as e:
            self.log(f"[ERROR] Could not open the data folder: {e}")
            return False

    def download_and_install_update(self, url, asset_name):
        """Download and apply the matching normal or portable PC package."""
        if platform.system() != "Windows":
            return {
                "ok": False,
                "error": "La actualización integrada solo está disponible en Windows.",
            }
        try:
            self._report_update_progress("downloading", 0)
            package = download_release_asset(
                url,
                asset_name,
                logger=self.log,
                progress=lambda done, total: self._report_update_progress(
                    "downloading", (done / total) if total else None
                ),
            )
            self._report_update_progress("installing", 0.15)
            root = extract_release_package(package)
            self._report_update_progress("installing", 0.35)
            target_dir = os.path.dirname(sys.executable)
            target_name = os.path.basename(sys.executable)
            if is_portable_install():
                source = find_release_file(root, "AutoRewarder-Portable.exe")
                if not source:
                    raise ValueError(
                        "El paquete portable no contiene AutoRewarder-Portable.exe."
                    )
                script = os.path.join(root, "apply-portable-update.cmd")
                with open(script, "w", encoding="utf-8") as output:
                    output.write(
                        "@echo off\n"
                        "timeout /t 2 /nobreak >nul\n"
                        f'robocopy "{os.path.dirname(source)}" "{target_dir}" /E /PURGE /NFL /NDL /NJH /NJS /NC /NS /XD config >nul\n'
                        f'start "" "{os.path.join(target_dir, target_name)}"\n'
                        f'rmdir /s /q "{root}"\n'
                        'del "%~f0"\n'
                    )
                self._report_update_progress("replacing", 0.65)
                self._launch_hidden_helper(script, root)
            else:
                installer = find_release_file(root, "AutoRewarder-Setup.exe")
                if installer:
                    subprocess.Popen(
                        [
                            installer,
                            "/VERYSILENT",
                            "/SUPPRESSMSGBOXES",
                            "/NORESTART",
                            "/CLOSEAPPLICATIONS",
                            "/RESTARTAPPLICATIONS",
                        ],
                        cwd=os.path.dirname(installer),
                        close_fds=True,
                    )
                else:
                    source = find_release_file(root, "AutoRewarder.exe")
                    if not source:
                        raise ValueError(
                            "El paquete normal no contiene un instalador válido."
                        )
                    script = os.path.join(root, "apply-normal-update.cmd")
                    with open(script, "w", encoding="utf-8") as output:
                        output.write(
                            "@echo off\n"
                            "timeout /t 2 /nobreak >nul\n"
                            f'robocopy "{os.path.dirname(source)}" "{target_dir}" /E /PURGE /NFL /NDL /NJH /NJS /NC /NS >nul\n'
                            f'start "" "{os.path.join(target_dir, target_name)}"\n'
                            f'rmdir /s /q "{root}"\n'
                            'del "%~f0"\n'
                        )
                    self._report_update_progress("replacing", 0.65)
                    self._launch_elevated_helper(script, root)
            self._report_update_progress("cleaning", 0.85)
        except Exception as exc:
            self.log(f"[ERROR] Could not download the update: {exc}")
            return {"ok": False, "error": str(exc)}

        def _exit_for_update():
            try:
                self.shutdown()
            except Exception:
                pass
            self._update_window_close_allowed = True
            try:
                if self._webview_window:
                    self._webview_window.destroy()
            except Exception:
                pass
            try:
                if self._update_window:
                    self._update_window.destroy()
            except Exception:
                pass
            self._report_update_progress("finished", 1.0)
            time.sleep(0.8)
            os._exit(0)

        threading.Thread(target=_exit_for_update, daemon=True).start()
        return {"ok": True, "restarting": True}

    def open_update_window(self, url, asset_name):
        """Launch the external updater, then close this process cleanly.

        The updater is a separate executable so it can replace this program's
        files after the main process has exited. Older installations may not
        contain that helper yet; they keep the previous in-process fallback
        until the first external update installs it.
        """
        helper = os.path.join(
            os.path.dirname(sys.executable), "AutoRewarder-Updater.exe"
        )
        if os.path.isfile(helper):
            language = self.ui_locale()
            args = [
                "--url",
                str(url or ""),
                "--asset",
                str(asset_name or ""),
                "--parent-pid",
                str(os.getpid()),
                "--language",
                language,
                "--target",
                sys.executable,
            ]
            target_dir = os.path.dirname(sys.executable)
            needs_elevation = False
            try:
                test_file = os.path.join(target_dir, ".write_test")
                with open(test_file, "w") as f:
                    f.write("test")
                os.remove(test_file)
            except PermissionError:
                needs_elevation = True
            except Exception:
                pass

            if needs_elevation:
                import ctypes

                params = " ".join(f'"{a}"' for a in args)
                ctypes.windll.shell32.ShellExecuteW(
                    None, "runas", helper, params, target_dir, 1
                )
            else:
                subprocess.Popen(
                    [helper] + args,
                    cwd=target_dir,
                    close_fds=True,
                )
            threading.Thread(
                target=self._close_for_external_update,
                daemon=True,
                name="external-update-exit",
            ).start()
            return {"ok": True, "external": True}

        # Compatibility path for v4.3.60 and older installations.
        import webview

        self._pending_update = {
            "url": str(url or ""),
            "asset_name": str(asset_name or ""),
        }
        if self._update_window is not None and self._update_window in webview.windows:
            self._update_window.show()
            return {"ok": True}
        if self._webview_window is not None:
            self._webview_window.hide()
        self._update_window_close_allowed = False
        self._update_window = webview.create_window(
            title="",
            url=os.path.join(GUI_DIR, "updater.html"),
            js_api=self,
            width=440,
            height=365,
            resizable=False,
            frameless=True,
            easy_drag=False,
            on_top=True,
            shadow=False,
            transparent=False,
            background_color="#0b0d12",
        )
        try:
            self._update_window.events.closing += self._block_update_window_close
        except Exception:
            pass
        return {"ok": True}

    def _close_for_external_update(self):
        time.sleep(0.25)
        try:
            self.shutdown()
        except Exception:
            pass
        try:
            if self._webview_window:
                self._webview_window.destroy()
        except Exception:
            pass
        os._exit(0)

    def get_pending_update(self):
        return dict(self._pending_update or {})

    def start_pending_update(self):
        pending = self._pending_update or {}
        if not pending.get("url") or not pending.get("asset_name"):
            return {"ok": False, "error": "No update package selected."}
        return self.download_and_install_update(pending["url"], pending["asset_name"])

    def restore_after_update_error(self):
        """Return to the main UI if the update cannot be applied."""
        self._update_window_close_allowed = True
        window = self._update_window
        self._update_window = None
        self._pending_update = None
        if window is not None:
            try:
                window.destroy()
            except Exception:
                pass
        if self._webview_window is not None:
            try:
                self._webview_window.show()
            except Exception:
                pass
        return {"ok": True}

    def _block_update_window_close(self, *_args):
        return bool(self._update_window_close_allowed)

    def _report_update_progress(self, stage, progress=None):
        """Push progress into the dedicated borderless updater window."""
        window = self._update_window or self._webview_window
        if not window:
            return
        try:
            window.evaluate_js(
                "update_progress(%s, %s)" % (json.dumps(stage), json.dumps(progress))
            )
        except Exception:
            pass

    @staticmethod
    def _hidden_startupinfo():
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startupinfo.wShowWindow = 0
        return startupinfo

    def _launch_hidden_helper(self, script, cwd):
        subprocess.Popen(
            ["cmd.exe", "/d", "/c", script],
            cwd=cwd,
            startupinfo=self._hidden_startupinfo(),
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            close_fds=True,
        )

    def _launch_elevated_helper(self, script, cwd):
        params = f'/d /c "{script}"'
        result = ctypes.windll.shell32.ShellExecuteW(
            None, "runas", "cmd.exe", params, cwd, 0
        )
        if result <= 32:
            raise OSError(
                "Windows no pudo iniciar el proceso de actualización elevado."
            )

    def load_driver_in_background(self):
        """Warmup the WebDriver download, only if an account is selected."""
        if self.account_manager.current_id() is None:
            # Nothing to warm up; empty state.
            if self._webview_window:
                self._webview_window.evaluate_js("stop_loader()")
            return

        self.is_driver_loading = True
        try:
            account_id = self.account_manager.current_id()
            if account_id:
                self._manual_last_refresh_at[account_id] = time.time()
            warmup_driver = self.driver_manager.setup_driver(
                headless=True, background=True
            )
            try:
                # Reuse the warmup driver — already open and bound to this
                # account's logged-in profile — to refresh the real points
                # balance on every launch, so the GUI always opens on an
                # up-to-date total (no extra browser, no UI blocking).
                self._refresh_balance_on_launch(warmup_driver)
                if (
                    account_id
                    and self.daily_set is not None
                    and self.account_manager.current_id() == account_id
                ):
                    try:
                        live = self.daily_set.collect_for_you(warmup_driver)
                        self.daily_set.for_you_tasks = list(live or [])
                        if self.account_meta is not None:
                            self.account_meta.set_live_manual_tasks(
                                self.daily_set.for_you_tasks
                            )
                        self._manual_last_refresh_at[account_id] = time.time()
                    except Exception:
                        pass
            finally:
                try:
                    warmup_driver.quit()
                except Exception:
                    pass
                self.driver_manager.close_running_edge()
                time.sleep(0.5)
        except Exception as e:
            self.log(f"[ERROR] Error loading WebDriver ({CURRENT_VERSION}): {e}")
            try:
                self.driver_manager.close_running_edge()
            except Exception:
                pass
        finally:
            self.is_driver_loading = False
            if self._webview_window:
                self._webview_window.evaluate_js("stop_loader()")

    def check_driver_status(self):
        """Return True while the driver warmup thread is active."""
        return self.is_driver_loading

    # ------------------------------------------------------------------
    # Exposed to JS: global settings
    # ------------------------------------------------------------------

    def get_settings(self):
        """Return global settings (hide_browser, current_account_id, schema_version)."""
        data = self.global_settings.get_settings()
        data["app_version"] = CURRENT_VERSION
        data["windows_locale"] = _windows_ui_locale()
        data["ui_locale"] = self.ui_locale()
        return data

    def ui_locale(self):
        """Resolve the complete UI language from the explicit or system locale."""
        settings = self.global_settings.get_settings()
        pref = str(settings.get("ui_language") or "auto").strip().lower()
        if pref in SUPPORTED_UI_LANGUAGES:
            return pref
        for candidate in (
            _windows_ui_locale(),
            str(settings.get("detected_locale") or ""),
        ):
            raw = str(candidate or "").strip().lower()
            if not raw:
                continue
            primary = re.split(r"[-_.\s]", raw)[0]
            if primary in SUPPORTED_UI_LANGUAGES:
                return primary
        return "en"

    def set_ui_language(self, lang):
        lang = str(lang or "auto").strip().lower()
        if lang not in ("auto", *SUPPORTED_UI_LANGUAGES):
            lang = "auto"
        settings = self.global_settings.settings_for_update()
        settings["ui_language"] = lang
        self.global_settings.save_settings(settings)
        resolved = self.ui_locale()
        for win in (
            self._webview_window,
            self._stats_window,
            self._history_window,
            self._background_logs_window,
        ):
            if win is not None:
                try:
                    win.evaluate_js(
                        f"typeof set_ui_lang === 'function' && set_ui_lang({json.dumps(resolved)})"
                    )
                except Exception:
                    pass
        return {"ok": True, "ui_language": lang, "ui_locale": resolved}

    def get_version(self):
        """Return the local build version string (4.2.<time>)."""
        return CURRENT_VERSION

    def set_hide_browser(self, is_hide):
        """
        Persist and apply the hide-browser setting.

        Args:
            is_hide (bool): True to hide the browser, False to show it.

        Returns:
            bool: True if the setting was successfully updated, False otherwise.
        """
        self.hide_browser = bool(is_hide)
        if self.driver_manager is not None:
            self.driver_manager.hide_browser = bool(is_hide)
        self.global_settings.set_hide_browser(is_hide)
        self.log(f"Browser hidden mode: {'ON' if is_hide else 'OFF'}")
        return True

    def get_close_to_tray(self):
        """Return whether the window X-close should minimize to tray."""
        return bool(self.global_settings.get_settings().get("close_to_tray", True))

    def set_close_to_tray(self, value):
        """
        Persist the close-to-tray setting. Reads at app startup, so a
        change only takes effect on the next launch.

        Args:
            value (bool): True to hide the window on X (close-to-tray),
                False to quit the app entirely on X.
        """
        self.global_settings.set_close_to_tray(value)
        state = "ON (X → tray)" if value else "OFF (X → quit)"
        self.log(f"Close-to-tray: {state}. Restart to apply.")

    def get_force_tasks(self):
        """Return the force flags for the daily tasks and the visual search."""
        return self.global_settings.get_force_tasks()

    def set_force_tasks(self, force_daily_tasks, force_visual_search):
        """
        Persist the "run even if already done today" toggles.

        Args:
            force_daily_tasks (bool): Run the Daily Set even when status.json
                says it is already done today.
            force_visual_search (bool): Run the visual search even when
                status.json says it is already done today.

        Returns:
            bool: True once the flags are saved.
        """
        self.global_settings.set_force_tasks(force_daily_tasks, force_visual_search)
        self.log(
            f"Force daily tasks: {'ON' if force_daily_tasks else 'OFF'} — "
            f"Force visual search: {'ON' if force_visual_search else 'OFF'}"
        )
        return True

    def get_queries_counts(self):
        """
        Return the saved PC and Mobile query counts from global settings.

        Returns:
            dict: {"queries_pc": int, "queries_mobile": int}
        """
        return {
            "queries_pc": self.global_settings.get_queries_pc(),
            "queries_mobile": self.global_settings.get_queries_mobile(),
        }

    def set_queries_counts(self, queries_pc, queries_mobile):
        """
        Save PC and Mobile query counts to global settings.

        Args:
            queries_pc (int): Number of PC searches.
            queries_mobile (int): Number of mobile searches.

        Returns:
            bool: True if successfully saved, False otherwise.
        """
        try:
            before = (
                self.global_settings.get_queries_pc(),
                self.global_settings.get_queries_mobile(),
            )

            self.global_settings.set_queries_pc(queries_pc)
            self.global_settings.set_queries_mobile(queries_mobile)

            after = (
                self.global_settings.get_queries_pc(),
                self.global_settings.get_queries_mobile(),
            )

            if after != before:
                self.log(f"Search counts saved: PC={after[0]}, Mobile={after[1]}")
            return True
        except Exception as e:
            self.log(f"[WARNING] Failed to save search counts: {e}")
            return False

    def get_manual_search_delay(self):
        """
        Return the min/max delay for normal manual searches, in seconds.

        Returns:
            dict: {"minimum": min_delay, "maximum": max_delay}
        """
        minimum, maximum = self.global_settings.get_manual_search_delay()
        return {"minimum": minimum, "maximum": maximum}

    def set_manual_search_delay(self, minimum, maximum):
        """
        Persist the min/max delay for normal manual searches, in seconds.

        Returns:
            bool: True if successfully saved, False otherwise.
        """
        try:
            return self.global_settings.set_manual_search_delay(minimum, maximum)
        except Exception as e:
            self.log(f"[WARNING] Failed to save manual search delay: {e}")
            return False

    def get_star_prompt_state(self):
        return self.global_settings.get_star_prompt_state()

    def postpone_star_prompt(self):
        return self.global_settings.postpone_star_prompt()

    def disable_star_prompt(self):
        return self.global_settings.disable_star_prompt()

    # ------------------------------------------------------------------
    # Exposed to JS: LLM-generated search terms + locale
    # ------------------------------------------------------------------

    def get_llm_config(self):
        """
        Return the LLM query-generation config plus the effective locale.

        Returns:
            dict: use_llm_queries, llm_provider, llm_model, llm_api_key,
            llm_base_url,
            search_locale, detected_locale, effective_locale.
        """
        cfg = self.global_settings.get_llm_config()
        cfg["effective_locale"] = self.global_settings.get_effective_locale()
        cfg["default_models"] = dict(llm.DEFAULT_MODELS)
        return cfg

    def set_llm_config(
        self,
        use_llm_queries,
        provider,
        model,
        api_key,
        search_locale="auto",
        base_url="",
    ):
        """
        Persist the LLM query-generation config from the Settings modal.

        Returns:
            bool: True on success, False otherwise.
        """
        try:
            self.global_settings.set_llm_config(
                use_llm_queries, provider, model, api_key, search_locale, base_url
            )
            state = "ON" if use_llm_queries else "OFF"
            self.log(f"LLM query generation: {state} ({provider}).")
            return True
        except Exception as e:
            self.log(f"[WARNING] Failed to save LLM config: {e}")
            return False

    def list_llm_models(self, provider, api_key, base_url=""):
        """
        Fetch the chat models `api_key` can use at `provider`, for the model
        picker in Settings > Search terms. Never raises.
        """
        return llm.list_models(provider, api_key, base_url, logger=self.log)

    def set_detected_locale(self, locale):
        """
        Store the locale the GUI read from navigator.language.

        Returns:
            bool: True on success, False otherwise.
        """
        try:
            self.global_settings.set_detected_locale(locale)
            return True
        except Exception as e:
            self.log(f"[WARNING] Failed to save detected locale: {e}")
            return False

    # ------------------------------------------------------------------
    # Exposed to JS: per-account schedule + startup
    # ------------------------------------------------------------------

    def is_running(self):
        """True when the bot is mid-run. Used by the headless runner to avoid overlap."""
        return self._run_lock.locked()

    def _check_driver_alive(self, drv=None):
        """Return True if *drv* still has at least one open browser window."""
        target = drv if drv is not None else self._driver
        if target is None:
            return False
        try:
            handles = target.window_handles
            if not handles:
                self._stop_event.set()
                return False
            return True
        except Exception:
            self._stop_event.set()
            return False

    def _quit_driver(self):
        """
        Drop the active Selenium session and guarantee no orphan Edge/msedgedriver
        processes survive after a phase finishes or is stopped.
        """
        driver = self._driver
        self._driver = None
        if driver is not None and not self._stop_event.is_set():
            try:
                driver.quit()
            except Exception as e:
                self.log(f"[WARNING] Error closing driver: {e}")
        mgr = self.driver_manager
        if mgr is not None:
            try:
                mgr.close_running_edge(settle=False)
            except Exception:
                pass

    def stop(self, manual=False):
        """
        Instant user stop.

        Sets the stop flag and force-kills Edge/msedgedriver on a daemon
        thread so this call returns immediately. Selenium quit() is never
        awaited here — that is what made Stop look frozen.
        """
        if manual:
            self._manual_stop_requested = True
        self._run_seq += 1
        self._stop_event.set()
        driver = self._driver
        self._driver = None
        mgr = self.driver_manager

        def _kill():
            try:
                if mgr is not None:
                    mgr.kill_now()
            except Exception:
                pass
            try:
                service = getattr(driver, "service", None)
                proc = (
                    getattr(service, "process", None) if service is not None else None
                )
                if proc is not None:
                    proc.kill()
            except Exception:
                pass

        threading.Thread(target=_kill, daemon=True, name="instant-stop").start()

        def _notify():
            try:
                self._safe_log("Stop requested.")
            except Exception:
                pass
            try:
                window = self._webview_window
                if window is not None:
                    window.evaluate_js("enable_start_button()")
            except Exception:
                pass

        threading.Thread(target=_notify, daemon=True, name="stop-notify").start()
        return True

    def shutdown(self):
        """Close child windows, stop a run, and tear down Edge / tunnel."""
        self.close_secondary_windows()
        try:
            self.stop()
        except Exception:
            pass
        try:
            if self.driver_manager is not None:
                self.driver_manager.kill_now(wait=True)
        except Exception:
            pass
        try:
            from .emulator.driver import DriverManager

            DriverManager.kill_all_autorewarder_edge(wait=True)
        except Exception:
            pass
        try:
            from .phone_bridge import get_bridge

            bridge = get_bridge()
            if bridge is not None:
                if getattr(bridge, "tunnel", None) is not None:
                    bridge.tunnel.stop()
                bridge.stop()
        except Exception:
            pass
        return True

    def close_secondary_windows(self):
        """Close Statistics, History, and Background Logs so no pywebview child survives us."""
        windows = (
            self._stats_window,
            self._history_window,
            self._background_logs_window,
        )
        self._stats_window = None
        self._history_window = None
        self._background_logs_window = None
        for window in windows:
            if window is None:
                continue
            try:
                window.destroy()
            except Exception:
                pass

    def get_schedule(self, account_id):
        """Return a specific account's schedule (defaults merged in)."""
        if not account_id or not self.account_manager.exists(account_id):
            return None
        return AccountMetaManager(account_id).get_schedule()

    def get_all_schedules(self):
        """Return [{id, label, first_setup_done, schedule, dashboard_variant}] for the settings modal."""
        result = []
        for acc in self.account_manager.list():
            meta = AccountMetaManager(acc["id"])
            result.append(
                {
                    "id": acc["id"],
                    "label": acc["label"],
                    "first_setup_done": acc["first_setup_done"],
                    "schedule": meta.get_schedule(),
                    "dashboard_variant": meta.get_dashboard_variant(),
                }
            )
        return result

    def get_dashboard_variant(self, account_id):
        """Return a specific account's Rewards dashboard variant, or None if unknown."""
        if not account_id or not self.account_manager.exists(account_id):
            return None
        return AccountMetaManager(account_id).get_dashboard_variant()

    def set_dashboard_variant(self, account_id, variant):
        """
        Persist a specific account's Rewards dashboard variant.

        Args:
            account_id (str): The account to update.
            variant (str): One of "auto", "legacy", "new".

        Returns:
            bool: True if persisted, False if the account or value is invalid.
        """
        if not account_id or not self.account_manager.exists(account_id):
            return False
        ok = AccountMetaManager(account_id).set_dashboard_variant(variant)
        if not ok:
            return False
        # Keep the live DailySet in sync if we changed the current account, so a
        # run started right after the toggle uses the new variant.
        if account_id == self.account_manager.current_id() and self.daily_set:
            self.daily_set.dashboard_variant = variant
        return True

    def set_schedule(self, account_id, payload):
        """
        Persist the schedule for a specific account.
        `payload` accepts: enabled, advancedScheduling, runDuration (1..24),
        queriesPerHour (1..99), queries_pc (0..130), queries_mobile (0..99),
        run_time (HH:MM 24h). Unknown keys are ignored.

        After persisting, if the global "Start with Windows/Linux" toggle
        is on, the account's OS-level scheduled task is (re)created or
        removed to match the new state.

        Args:
            account_id (str): The ID of the account to set the schedule for.
            payload (dict): The schedule settings to persist.

        Returns:
            bool: True if the schedule was successfully updated, False otherwise.
        """
        if not account_id or not self.account_manager.exists(account_id):
            return False
        if not isinstance(payload, dict):
            return False

        meta = AccountMetaManager(account_id)
        current = meta.get_schedule()

        def _pick(key, default):
            return payload[key] if key in payload else default

        new = {
            "enabled": bool(_pick("enabled", current["enabled"])),
            "advancedScheduling": bool(
                _pick("advancedScheduling", current["advancedScheduling"])
            ),
            "runDuration": max(
                1, min(24, int(_pick("runDuration", current["runDuration"])))
            ),
            "queriesPerHour": max(
                1, min(99, int(_pick("queriesPerHour", current["queriesPerHour"])))
            ),
            "queries_pc": max(
                0, min(130, int(_pick("queries_pc", current["queries_pc"])))
            ),
            "queries_mobile": max(
                0, min(99, int(_pick("queries_mobile", current["queries_mobile"])))
            ),
            "run_time": _normalize_run_time(_pick("run_time", current.get("run_time"))),
            # Reset the daily-dedup marker so the edited schedule can still fire today.
            "last_triggered_date": None,
        }
        meta.set_schedule(new)

        label = self.account_manager.get(account_id)
        label = label["label"] if label else account_id
        if new["enabled"]:
            mode = "advanced" if new["advancedScheduling"] else "simple"
            self.log(
                f"Schedule '{label}' ({mode}) @ {new['run_time']}: "
                f"PC={new['queries_pc']}, Mobile={new['queries_mobile']}, "
                f"{new['runDuration']}h @ {new['queriesPerHour']}/h"
            )
        else:
            self.log(f"Schedule '{label}' disabled.")

        # Re-sync the OS-level scheduled task. _sync_account_autostart
        # itself respects the global Start-with-Windows toggle and the
        # new schedule.enabled value, so it correctly creates / updates
        # / removes the task in any state.
        try:
            self._sync_account_autostart(account_id)
        except Exception as e:
            self.log(f"[WARNING] Failed to sync autostart for '{label}': {e}")

        return True

    def _migrate_legacy_global_schedule(self):
        """
        Clean up any pre-existing global `schedule` key left over from an
        earlier version of this branch. The schedule now lives in each
        account's meta.json, so we just drop the global one. Anything
        valuable was already migrated during a previous upgrade cycle.
        """
        try:
            settings = self.global_settings.settings_for_update()
        except OSError as e:
            self._safe_log(f"[WARNING] Could not read settings.json: {e}")
            return
        if "schedule" in settings:
            settings.pop("schedule", None)
            self.global_settings.save_settings(settings)

    def _detect_legacy_autostart(self):
        """
        Return True if any pre-per-account autostart artifact exists on
        this system. Used both by the migration path and by every
        startup so stale legacy entries get cleaned up even when the
        user has already moved to the per-account model.

        Recognised sources:
          * Fire-on-login: HKCU Run (Windows) / .desktop (Linux)
          * Single-task daily scheduler: schtasks `AutoRewarder` /
            systemd `autorewarder.timer` (v3.3 single-task design)
        """
        system = platform.system()
        if system == "Windows":
            try:
                import winreg

                run_key = r"Software\Microsoft\Windows\CurrentVersion\Run"
                with winreg.OpenKey(
                    winreg.HKEY_CURRENT_USER, run_key, 0, winreg.KEY_READ
                ) as key:
                    winreg.QueryValueEx(key, _AUTOSTART_TASK_NAME)
                    return True
            except Exception:
                pass
            # Older releases could leave a Startup-folder shortcut behind.
            # It launches the GUI in addition to our explicit sign-in option.
            try:
                startup_link = os.path.join(
                    os.environ.get("APPDATA", ""),
                    "Microsoft",
                    "Windows",
                    "Start Menu",
                    "Programs",
                    "Startup",
                    "AutoRewarder.lnk",
                )
                if startup_link and os.path.exists(startup_link):
                    return True
            except Exception:
                pass
            try:
                result = subprocess.run(
                    ["schtasks", "/Query", "/TN", _AUTOSTART_TASK_NAME],
                    capture_output=True,
                    creationflags=0x08000000,
                )
                if result.returncode == 0:
                    return True
            except Exception:
                pass
        elif system == "Linux":
            try:
                if os.path.exists(self._legacy_linux_autostart_path()):
                    return True
            except Exception:
                pass
            try:
                timer_path = os.path.join(
                    self._systemd_user_dir(),
                    f"{_SYSTEMD_UNIT_NAME}.timer",
                )
                if os.path.exists(timer_path):
                    return True
            except Exception:
                pass
        return False

    # Bumped whenever the format of registered scheduled tasks changes in
    # a way that requires re-creating existing tasks on disk:
    #   * v1 switched dev-mode commands from python.exe to pythonw.exe
    #     to avoid the console-window flash.
    #   * v2 switched Windows registration from `schtasks /Create /SC DAILY
    #     /ST HH:MM` (flag form) to `schtasks /Create /XML <file>` so the
    #     resulting task carries StartWhenAvailable=true — without it,
    #     Windows silently skips daily triggers that fired while the
    #     machine was off, unlike systemd's Persistent=true on Linux.
    # Stored in global_settings as `autostart_schema_version`. Users on
    # autoStartUp=True with a lower version get all their tasks re-
    # registered on next launch.
    # v3 prevents a missed daily task from starting together with the GUI
    # when Windows signs in.
    _AUTOSTART_SCHEMA_VERSION = 3

    def _migrate_legacy_autostart(self):
        """
        Two cleanup paths on every app launch:

        1. Legacy artifact exists → idempotent cleanup. Never auto-
           enables autostart, even if the user previously had it on
           under the old model: their explicit intent is whatever
           `autoStartUp` says today. If they want per-account
           autostart back, they re-toggle Start-with-Windows in
           Settings.
        2. User is on per-account model (autoStartUp=True) AND
           `autostart_schema_version` is below current → re-register
           every task so format changes (e.g. python.exe → pythonw.exe)
           take effect without the user having to toggle anything.

        Failures are logged but swallowed — a stale legacy entry is
        not worth crashing app startup.
        """
        legacy = self._detect_legacy_autostart()
        try:
            settings = self.global_settings.get_settings()
            autostartup = bool(settings.get("autoStartUp", False))
            schema_v = int(settings.get("autostart_schema_version", 0))
        except Exception:
            return

        needs_resync = autostartup and schema_v < self._AUTOSTART_SCHEMA_VERSION

        if not legacy and not needs_resync:
            return

        if legacy:
            self._safe_log("Cleaning up stale legacy autostart entries...")
            try:
                self._cleanup_legacy_autostart()
            except Exception as e:
                self._safe_log(f"[WARNING] Legacy cleanup failed: {e}")

        if needs_resync:
            self._safe_log(
                f"Refreshing per-account scheduled tasks "
                f"(schema v{self._AUTOSTART_SCHEMA_VERSION})..."
            )
            try:
                self._sync_all_autostart()
            except Exception as e:
                self._safe_log(f"[WARNING] Autostart refresh failed: {e}")

        # Mark current schema applied so we don't re-run unnecessarily.
        try:
            settings = self.global_settings.settings_for_update()
            settings["autostart_schema_version"] = self._AUTOSTART_SCHEMA_VERSION
            self.global_settings.save_settings(settings)
        except Exception:
            pass

    # ---- Autostart (OS-level) — ported from v3.1 main -----------------

    def _autostart_command(self, account_id):
        """
        Command string registered for an account's daily scheduled run.

        Args:
            account_id (str): the account this scheduled task targets.
                Passed to the CLI as `--account <id>` so the headless run
                only processes that account, regardless of which other
                accounts are enabled.

        Returns:
            str: The command to execute for autostart, which varies based on
                whether the app is frozen (packaged) or running in development mode.
        """
        # Frozen build: call the bundled exe with --headless --account <id>.
        # PyInstaller's `console=False` in AutoRewarder.spec means the exe
        # itself has no console, so this fires silently.
        if getattr(sys, "frozen", False):
            return f'"{sys.executable}" --headless --account {account_id}'

        # Dev mode: prefer pythonw.exe on Windows. python.exe is the console
        # variant, so when Task Scheduler fires it Windows allocates a
        # console window — visible flash at every trigger. pythonw.exe is
        # the same interpreter without that console. Falls back to whatever
        # sys.executable is if pythonw isn't there (custom layout).
        python_exe = sys.executable
        if platform.system() == "Windows":
            candidate = os.path.join(os.path.dirname(sys.executable), "pythonw.exe")
            if os.path.exists(candidate):
                python_exe = candidate
        entry = os.path.join(BASE_DIR, "AutoRewarder.py")
        return f'"{python_exe}" "{entry}" --headless --account {account_id}'

    # ---- Per-account OS-task naming -----------------------------------

    def _windows_task_name(self, account_id):
        """schtasks task name for a specific account."""
        return f"{_AUTOSTART_TASK_NAME}.{account_id}"

    def _systemd_unit_base(self, account_id):
        """Base name for the systemd service + timer of a specific account."""
        return f"{_SYSTEMD_UNIT_NAME}-{account_id}"

    # ------------------------------------------------------------------
    # Autostart — daily scheduled task (Windows Task Scheduler / systemd
    # user timer). Replaces the previous "fire on login" model so a daily
    # run still happens even when the machine stays logged in for days.
    # ------------------------------------------------------------------

    def _systemd_user_dir(self):
        return os.path.join(os.path.expanduser("~"), ".config", "systemd", "user")

    def _legacy_linux_autostart_path(self):
        """Old .desktop autostart path — kept only for migration cleanup."""
        return os.path.join(
            os.path.expanduser("~"), ".config", "autostart", "AutoRewarder.desktop"
        )

    def _cleanup_legacy_autostart(self):
        """
        Remove pre-per-account autostart entries:
          * HKCU Run / .desktop (the original fire-on-login mechanism)
          * Single-task `AutoRewarder` schtasks / `autorewarder.timer`
            systemd unit (the v3.3 single-task daily scheduler)

        Idempotent — safe to call on every startup. Outcomes are logged
        so that a silent failure can be diagnosed instead of leaving a
        stale task to fire alongside the new per-account ones.
        """
        system = platform.system()
        if system == "Windows":
            # HKCU Run value.
            try:
                import winreg

                run_key = r"Software\Microsoft\Windows\CurrentVersion\Run"
                with winreg.OpenKey(
                    winreg.HKEY_CURRENT_USER, run_key, 0, winreg.KEY_SET_VALUE
                ) as key:
                    try:
                        winreg.DeleteValue(key, _AUTOSTART_TASK_NAME)
                        self.log("Removed legacy HKCU Run autostart entry")
                    except FileNotFoundError:
                        pass
            except Exception:
                pass
            # Legacy Startup-folder shortcut. Keep the explicit
            # `AutoRewarderGUI` registry entry as the sole GUI sign-in route.
            try:
                startup_link = os.path.join(
                    os.environ.get("APPDATA", ""),
                    "Microsoft",
                    "Windows",
                    "Start Menu",
                    "Programs",
                    "Startup",
                    "AutoRewarder.lnk",
                )
                if startup_link and os.path.exists(startup_link):
                    os.remove(startup_link)
                    self.log("Removed legacy Startup-folder shortcut")
            except OSError as e:
                self.log(f"[WARNING] Could not remove legacy shortcut: {e}")
            except Exception:
                pass
            # Single-task daily scheduler from the v3.3 design.
            # Only attempt delete if it actually exists, so failures are
            # always meaningful (don't log "delete failed" for tasks
            # that were never there).
            try:
                q = subprocess.run(
                    ["schtasks", "/Query", "/TN", _AUTOSTART_TASK_NAME],
                    capture_output=True,
                    text=True,
                    creationflags=0x08000000,
                )
                if q.returncode == 0:
                    d = subprocess.run(
                        [
                            "schtasks",
                            "/Delete",
                            "/TN",
                            _AUTOSTART_TASK_NAME,
                            "/F",
                        ],
                        capture_output=True,
                        text=True,
                        creationflags=0x08000000,
                    )
                    if d.returncode == 0:
                        self.log("Removed legacy single-task scheduler")
                    else:
                        msg = (d.stderr or d.stdout or "").strip()
                        self.log(
                            f"[WARNING] Could not delete legacy task "
                            f"'{_AUTOSTART_TASK_NAME}': {msg}"
                        )
            except FileNotFoundError:
                # schtasks not on PATH — nothing we can do.
                pass
            except Exception as e:
                self.log(f"[WARNING] Legacy schtasks cleanup error: {e}")
        elif system == "Linux":
            old_desktop = self._legacy_linux_autostart_path()
            if os.path.exists(old_desktop):
                try:
                    os.remove(old_desktop)
                    self.log("Removed legacy .desktop autostart entry")
                except OSError as e:
                    self.log(f"[WARNING] Could not remove .desktop: {e}")
            # Single-task systemd timer from the v3.3 design.
            base = self._systemd_user_dir()
            old_service = os.path.join(base, f"{_SYSTEMD_UNIT_NAME}.service")
            old_timer = os.path.join(base, f"{_SYSTEMD_UNIT_NAME}.timer")
            if os.path.exists(old_timer) or os.path.exists(old_service):
                try:
                    subprocess.run(
                        [
                            "systemctl",
                            "--user",
                            "disable",
                            "--now",
                            f"{_SYSTEMD_UNIT_NAME}.timer",
                        ],
                        capture_output=True,
                    )
                except Exception:
                    pass
                removed = False
                for path in (old_service, old_timer):
                    if os.path.exists(path):
                        try:
                            os.remove(path)
                            removed = True
                        except OSError as e:
                            self.log(f"[WARNING] Could not remove {path}: {e}")
                if removed:
                    self.log("Removed legacy single-task systemd timer")
                try:
                    subprocess.run(
                        ["systemctl", "--user", "daemon-reload"],
                        capture_output=True,
                    )
                except Exception:
                    pass

    # ---- Per-account OS-task management -------------------------------

    def _autostart_exec_and_args(self, account_id):
        """
        Split the autostart command into (executable, arguments) for the
        Task Scheduler XML Action element, which expects them separately.
        Mirrors the same dev-vs-frozen logic as _autostart_command.
        """
        if getattr(sys, "frozen", False):
            return sys.executable, f"--headless --account {account_id}"

        python_exe = sys.executable
        candidate = os.path.join(os.path.dirname(sys.executable), "pythonw.exe")
        if os.path.exists(candidate):
            python_exe = candidate
        entry = os.path.join(BASE_DIR, "AutoRewarder.py")
        return python_exe, f'"{entry}" --headless --account {account_id}'

    def _build_windows_task_xml(self, account_id, run_time, label):
        """
        Build a Task Scheduler 1.2 XML for a daily run.

        Key setting: <StartWhenAvailable>true</StartWhenAvailable>. Without
        it, Windows silently skips a trigger that fired while the machine
        was off (unlike systemd's Persistent=true). With it, the task
        runs as soon as possible after the missed time at the next boot —
        matching the Linux behavior.

        Also: <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
        so laptop users on battery still get their run.
        """
        executable, arguments = self._autostart_exec_and_args(account_id)

        def esc(s):
            return (
                s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace('"', "&quot;")
                .replace("'", "&apos;")
            )

        description = f"AutoRewarder daily run ({label})"
        # Past anchor date — only the HH:MM portion of StartBoundary
        # matters for DaysInterval=1 recurrence.
        start_boundary = f"2025-01-01T{run_time}:00"

        return (
            '<?xml version="1.0" encoding="UTF-16"?>\n'
            '<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">\n'
            "  <RegistrationInfo>\n"
            f"    <Description>{esc(description)}</Description>\n"
            "  </RegistrationInfo>\n"
            "  <Triggers>\n"
            "    <CalendarTrigger>\n"
            f"      <StartBoundary>{start_boundary}</StartBoundary>\n"
            "      <Enabled>true</Enabled>\n"
            "      <ScheduleByDay>\n"
            "        <DaysInterval>1</DaysInterval>\n"
            "      </ScheduleByDay>\n"
            "    </CalendarTrigger>\n"
            "  </Triggers>\n"
            "  <Principals>\n"
            '    <Principal id="Author">\n'
            "      <LogonType>InteractiveToken</LogonType>\n"
            "      <RunLevel>LeastPrivilege</RunLevel>\n"
            "    </Principal>\n"
            "  </Principals>\n"
            "  <Settings>\n"
            "    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>\n"
            "    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>\n"
            "    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>\n"
            "    <AllowHardTerminate>true</AllowHardTerminate>\n"
            "    <StartWhenAvailable>false</StartWhenAvailable>\n"
            "    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>\n"
            "    <AllowStartOnDemand>true</AllowStartOnDemand>\n"
            "    <Enabled>true</Enabled>\n"
            "    <Hidden>false</Hidden>\n"
            "    <RunOnlyIfIdle>false</RunOnlyIfIdle>\n"
            "    <WakeToRun>false</WakeToRun>\n"
            "    <ExecutionTimeLimit>PT72H</ExecutionTimeLimit>\n"
            "    <Priority>7</Priority>\n"
            "  </Settings>\n"
            '  <Actions Context="Author">\n'
            "    <Exec>\n"
            f"      <Command>{esc(executable)}</Command>\n"
            f"      <Arguments>{esc(arguments)}</Arguments>\n"
            "    </Exec>\n"
            "  </Actions>\n"
            "</Task>\n"
        )

    def _register_windows_task(self, account_id, run_time, label=None):
        """
        Register a daily scheduled task via XML import.

        Why XML instead of `schtasks /SC DAILY /ST HH:MM` flags: the
        flag form doesn't expose StartWhenAvailable, so a trigger that
        fires while the machine is off is silently skipped forever.
        The XML form lets us flip StartWhenAvailable=true so a missed
        trigger catches up at next boot — same behavior as systemd's
        Persistent=true on the Linux side.
        """
        import tempfile

        xml_body = self._build_windows_task_xml(
            account_id, run_time, label or account_id
        )

        # schtasks /XML reads the task definition from disk; UTF-16 is
        # the encoding Task Scheduler expects (the XML decl says so and
        # schtasks refuses UTF-8 without a BOM on some Windows builds).
        fd, xml_path = tempfile.mkstemp(suffix=".xml", prefix="autorewarder-task-")
        try:
            with os.fdopen(fd, "wb") as fh:
                fh.write(xml_body.encode("utf-16"))

            result = subprocess.run(
                [
                    "schtasks",
                    "/Create",
                    "/TN",
                    self._windows_task_name(account_id),
                    "/XML",
                    xml_path,
                    "/F",
                ],
                capture_output=True,
                text=True,
                creationflags=0x08000000,
            )
            if result.returncode != 0:
                self.log(
                    f"[ERROR] schtasks create failed for {label or account_id}: "
                    f"{(result.stderr or result.stdout).strip()}"
                )
                return False
            self.log(
                f"Scheduled task registered: '{label or account_id}' at {run_time}"
            )
            return True
        except FileNotFoundError:
            self.log("[ERROR] schtasks not found — Task Scheduler unavailable.")
            return False
        except Exception as e:
            self.log(f"[ERROR] Failed to register Windows task: {e}")
            return False
        finally:
            try:
                os.remove(xml_path)
            except OSError:
                pass

    def _remove_windows_task(self, account_id):
        """schtasks /Delete an account's daily task (idempotent)."""
        try:
            subprocess.run(
                [
                    "schtasks",
                    "/Delete",
                    "/TN",
                    self._windows_task_name(account_id),
                    "/F",
                ],
                capture_output=True,
                creationflags=0x08000000,
            )
            return True
        except Exception:
            return False

    def _register_systemd_unit(self, account_id, run_time, label=None):
        """Write + enable a per-account systemd .service + .timer."""
        try:
            base = self._systemd_user_dir()
            unit_base = self._systemd_unit_base(account_id)
            service_path = os.path.join(base, f"{unit_base}.service")
            timer_path = os.path.join(base, f"{unit_base}.timer")
            timer_unit = f"{unit_base}.timer"

            os.makedirs(base, exist_ok=True)
            cmd = self._autostart_command(account_id)
            desc_label = label or account_id
            service_file = (
                "[Unit]\n"
                f"Description=AutoRewarder daily run ({desc_label})\n\n"
                "[Service]\n"
                "Type=oneshot\n"
                f"ExecStart={cmd}\n"
            )
            timer_file = (
                "[Unit]\n"
                f"Description=Run AutoRewarder daily ({desc_label})\n\n"
                "[Timer]\n"
                f"OnCalendar=*-*-* {run_time}:00\n"
                "Persistent=true\n"
                f"Unit={unit_base}.service\n\n"
                "[Install]\n"
                "WantedBy=timers.target\n"
            )
            with open(service_path, "w", encoding="utf-8") as fh:
                fh.write(service_file)
            with open(timer_path, "w", encoding="utf-8") as fh:
                fh.write(timer_file)

            subprocess.run(
                ["systemctl", "--user", "daemon-reload"], capture_output=True
            )
            result = subprocess.run(
                ["systemctl", "--user", "enable", "--now", timer_unit],
                capture_output=True,
                text=True,
            )
            if result.returncode != 0:
                self.log(
                    f"[ERROR] systemctl enable failed for {desc_label}: "
                    f"{(result.stderr or result.stdout).strip()}"
                )
                return False
            self.log(f"Scheduled timer registered: '{desc_label}' at {run_time}")
            return True
        except FileNotFoundError:
            self.log("[ERROR] systemctl not found — systemd unavailable.")
            return False
        except Exception as e:
            self.log(f"[ERROR] Failed to register systemd timer: {e}")
            return False

    def _remove_systemd_unit(self, account_id):
        """Disable + delete an account's systemd service + timer."""
        try:
            base = self._systemd_user_dir()
            unit_base = self._systemd_unit_base(account_id)
            service_path = os.path.join(base, f"{unit_base}.service")
            timer_path = os.path.join(base, f"{unit_base}.timer")
            timer_unit = f"{unit_base}.timer"

            subprocess.run(
                ["systemctl", "--user", "disable", "--now", timer_unit],
                capture_output=True,
            )
            for path in (service_path, timer_path):
                if os.path.exists(path):
                    try:
                        os.remove(path)
                    except OSError:
                        pass
            subprocess.run(
                ["systemctl", "--user", "daemon-reload"], capture_output=True
            )
            return True
        except Exception:
            return False

    def _remove_account_autostart(self, account_id):
        """Remove an account's OS-level scheduled task (platform-aware)."""
        system = platform.system()
        if system == "Windows":
            return self._remove_windows_task(account_id)
        if system == "Linux":
            return self._remove_systemd_unit(account_id)
        return False

    def _sync_account_autostart(self, account_id):
        """
        Bring one account's OS-level scheduled task in sync with its
        meta.json schedule. Called whenever set_schedule mutates an
        account, or the global Start-with-Windows toggle is flipped on.

        Semantics:
          * Global toggle OFF → always remove (regardless of schedule.enabled)
          * Account doesn't exist anymore → remove
          * schedule.enabled = False → remove
          * Otherwise → register at schedule.run_time
        """
        if not self.is_autostart_enabled():
            self._remove_account_autostart(account_id)
            return False

        if not self.account_manager.exists(account_id):
            self._remove_account_autostart(account_id)
            return False

        meta = AccountMetaManager(account_id)
        sched = meta.get_schedule()
        if not sched.get("enabled"):
            self._remove_account_autostart(account_id)
            return True

        run_time = _normalize_run_time(sched.get("run_time"))
        acc = self.account_manager.get(account_id)
        label = acc["label"] if acc else account_id

        system = platform.system()
        if system == "Windows":
            return self._register_windows_task(account_id, run_time, label)
        if system == "Linux":
            return self._register_systemd_unit(account_id, run_time, label)
        self.log("Autostart is only supported on Windows and Linux.")
        return False

    def _sync_all_autostart(self):
        """Iterate every account and re-sync its scheduled task."""
        for acc in self.account_manager.list():
            try:
                self._sync_account_autostart(acc["id"])
            except Exception as e:
                self.log(f"[WARNING] Sync failed for {acc.get('label')}: {e}")

    def _set_autostart_registry(self, enable):
        """
        Global autostart master toggle. Persists the user's intent in
        global settings (`autoStartUp`) and syncs every account's OS-level
        scheduled task to match.

          * enable=True  → autoStartUp=True; create a task for each
                           account whose schedule.enabled=True at its
                           own schedule.run_time.
          * enable=False → autoStartUp=False; remove every per-account
                           task that we might have registered.

        Legacy entries (HKCU Run, .desktop, single-task daily scheduler)
        are always cleaned up on either path.
        """
        system_name = platform.system()
        if system_name not in ("Windows", "Linux"):
            self.log("Autostart is only supported on Windows and Linux.")
            return False

        # Persist user intent FIRST so _sync_account_autostart reads the
        # new value when it queries is_autostart_enabled().
        try:
            settings = self.global_settings.settings_for_update()
        except OSError as e:
            self.log(f"[ERROR] Could not save the autostart setting: {e}")
            return False
        settings["autoStartUp"] = bool(enable)
        self.global_settings.save_settings(settings)

        # Always clean up legacy single-task / fire-on-login entries.
        self._cleanup_legacy_autostart()

        if not enable:
            # Remove every per-account task that might have been registered.
            for acc in self.account_manager.list():
                self._remove_account_autostart(acc["id"])
            self.log("Autostart disabled (all per-account tasks removed)")
            return True

        # Enable path: register tasks for every account with schedule.enabled.
        self._sync_all_autostart()
        self.log("Autostart enabled (per-account scheduled tasks registered)")
        return True

    def is_autostart_enabled(self):
        """Return True if the global 'Start with Windows/Linux' toggle is on.

        Per-account OS tasks are derived from this AND each account's
        schedule.enabled — the toggle here is the master switch.
        """
        try:
            return bool(self.global_settings.get_settings().get("autoStartUp", False))
        except Exception:
            return False

    def get_launch_on_startup(self):
        """Return OS support flag + current autostart state for the Settings UI."""
        system_name = platform.system()
        return {
            "supported": system_name in ("Windows", "Linux"),
            "enabled": self.is_autostart_enabled(),
        }

    def set_launch_on_startup(self, enabled):
        """
        Register or unregister the OS autostart entry. Called from JS.

        Args:
            enabled (bool): True to enable autostart, False to disable.

        Returns:
            bool: True if the operation succeeded, False otherwise.
        """
        ok = self._set_autostart_registry(bool(enabled))
        if ok:
            # Mirror the state into global settings.json for the UI.
            try:
                settings = self.global_settings.settings_for_update()
                settings["autoStartUp"] = bool(enabled)
                self.global_settings.save_settings(settings)
            except OSError as e:
                self._safe_log(f"[WARNING] Could not mirror autostart state: {e}")
        return ok

    def get_open_on_login(self):
        """Return whether the GUI is configured to open at Windows sign-in."""
        return {
            "supported": platform.system() == "Windows",
            "enabled": bool(
                self.global_settings.get_settings().get("launch_on_login", False)
            ),
        }

    def set_open_on_login(self, enabled):
        """Persist and register the GUI launch-at-sign-in preference on Windows."""
        if platform.system() != "Windows":
            return False

        enabled = bool(enabled)
        try:
            self._write_login_run_key(enabled)
            settings = self.global_settings.settings_for_update()
            settings["launch_on_login"] = enabled
            self.global_settings.save_settings(settings)
            self.log("Open on sign-in: " + ("enabled." if enabled else "disabled."))
            return True
        except Exception as e:
            self.log(f"[WARNING] Failed to update open-on-sign-in: {e}")
            return False

    # ------------------------------------------------------------------
    # Exposed to JS: accounts
    # ------------------------------------------------------------------

    def list_accounts(self):
        """Return accounts for UI display."""
        return self.account_manager.list()

    def get_current_account(self):
        """Return the currently selected account, or None."""
        return self.account_manager.get_current()

    # ------------------------------------------------------------------
    # Phone companion (LAN APK under this Microsoft account)
    # ------------------------------------------------------------------

    def _phone_bridge(self):
        from .phone_bridge import get_bridge, start_bridge

        return get_bridge() or start_bridge(self)

    def get_phone_bridge(self):
        """Account-scoped pairing info for the GUI device row."""
        try:
            info = self._phone_bridge().info()
        except Exception as e:
            return {"ok": False, "error": str(e), "phones": []}
        account = self.account_manager.get_current() or {}
        profile = (
            self.account_meta.get_rewards_profile() if self.account_meta else {}
        ) or {}
        info["ok"] = True
        info["account"] = {
            "id": account.get("id"),
            "label": account.get("label") or "Account",
            "first_setup_done": bool(account.get("first_setup_done")),
        }
        info["membership"] = profile.get("membership") or "Microsoft Rewards"
        info["region"] = profile.get("country") or profile.get("locale") or ""
        return info

    def begin_phone_pairing(self):
        """Show a 6-digit code the APK can enter on the same Wi-Fi."""
        if self.account_meta is None:
            return {"ok": False, "error": "no_account"}
        info = self._phone_bridge().begin_pairing()
        info["ok"] = True
        self.log(
            f"Phone pairing code {info.get('code')} — LAN {info.get('lan_url')}"
            + (
                f" — remote {info.get('public_url')}"
                if info.get("public_url")
                else " — remote tunnel starting"
            )
        )
        return info

    def cancel_phone_pairing(self):
        info = self._phone_bridge().cancel_pairing()
        info["ok"] = True
        return info

    def unlink_phone(self, phone_id):
        ok = self._phone_bridge().unlink(phone_id)
        if ok:
            self.log("Phone unlinked from this Microsoft account.")
            try:
                self._phone_bridge()._notify_ui("unlinked", True, str(phone_id or ""))
            except Exception:
                pass
            # Unlinking changes only the phone association.  Immediately
            # refresh the account UI as well so the Microsoft account and its
            # Start eligibility cannot be replaced by a stale empty state.
            self._broadcast_account_ui()
        info = self.get_phone_bridge()
        info["phone_unlinked"] = bool(ok)
        return info

    def send_phone_job(self, kind):
        """Queue checkin/news for the linked phone. Returns immediately."""
        job_id = self._phone_bridge().enqueue(str(kind or "checkin"))
        if not job_id:
            return {"ok": False, "error": "no phone linked or phone offline"}
        self.log(f"Queued '{kind}' for the linked phone.")
        return {"ok": True, "id": job_id}

    def _phone_try(self, kind, timeout=180):
        """Wait for a linked online phone to finish a job. None if no phone."""
        from .phone_bridge import get_bridge

        bridge = get_bridge()
        if bridge is None or not bridge._online_phones():
            return None
        return bridge.request_and_wait(kind, timeout=timeout)

    def create_account(self, label):
        """
        Create a new account, select it, and run First Setup against it.
        On setup failure (user closes browser without logging in), rolls back
        and restores the previously-selected account.

        Args:
            label (str): The user-friendly label for the new account.

        Returns:
            dict: {ok (bool), id (str), label (str)} on success, or {ok: False, error: str} on failure.
        """
        if not self._run_lock.acquire(blocking=False):
            self.log("[WARNING] Cannot add an account while the bot is running.")
            return {"ok": False, "error": "bot_running"}

        try:
            previous_id = self.account_manager.current_id()
            new_account = self.account_manager.create(label)
            new_id = new_account["id"]

            self.account_manager.select(new_id)
            self._rebuild_account_context()

            success = self._run_first_setup_for_current()

            if not success:
                # Rollback: drop the new account and restore previous.
                self.account_manager.delete(new_id)
                self.account_manager.select(previous_id)
                self._rebuild_account_context()
                self._broadcast_account_ui()
                return {"ok": False, "error": "setup_failed", "id": new_id}

            self._broadcast_account_ui()
            return {"ok": True, "id": new_id, "label": new_account["label"]}
        finally:
            try:
                self._run_lock.release()
            except Exception:
                pass

    def switch_account(self, account_id):
        """
        Switch to the specified account if possible.

        Args:
            account_id (str): The ID of the account to switch to.

        Returns:
            bool: True if switching succeeded, False otherwise.
        """
        if self._run_lock.locked():
            self.log("[WARNING] Cannot switch account while the bot is running.")
            return False
        if not self.account_manager.exists(account_id):
            self.log(f"[ERROR] Unknown account: {account_id}")
            return False

        self.account_manager.select(account_id)
        self._rebuild_account_context()
        current = self.account_manager.get_current()
        if current:
            self.log(f"Switched to account '{current['label']}'.")
        self._broadcast_account_ui()

        # Refresh the new account's real balance in the background so the card
        # shows an up-to-date total, not just the last stored one.
        if self.account_meta is not None and self.account_meta.is_first_setup_done():
            threading.Thread(
                target=self._refresh_balance_async,
                args=(account_id,),
                daemon=True,
            ).start()
        return True

    def _refresh_balance_async(self, account_id):
        """
        Background balance refresh for a specific account. Only runs while that
        account is still selected, and retries with exponential backoff if the
        driver is momentarily busy (warmup / another refresh). A "busy" result
        means no scrape happened, so retrying doesn't add extra hits to
        Microsoft. Stops on success, account change, or a non-busy result.
        """
        retries = 3
        delay = 0.5
        for attempt in range(retries):
            if self.account_manager.current_id() != account_id:
                return  # switched away; that switch triggers its own refresh
            try:
                result = self.refresh_balance()
            except Exception as e:
                self.log(f"[WARNING] Background balance refresh failed: {e}")
                return
            if not isinstance(result, dict) or result.get("error") != "busy":
                return  # succeeded, or a non-retryable outcome
            if attempt < retries - 1:
                time.sleep(delay)
                delay *= 2

    def rename_account(self, account_id, new_label):
        """
        Rename an account label.

        Args:
            account_id (str): The ID of the account to rename.
            new_label (str): The new label for the account.

        Returns:
            bool: True if renaming succeeded, False otherwise.
        """
        try:
            self.account_manager.rename(account_id, new_label)
        except ValueError as e:
            self.log(f"[ERROR] {e}")
            return False
        self._broadcast_account_ui()
        return True

    def delete_account(self, account_id):
        """
        Delete an account and refresh the UI.

        Args:
            account_id (str): The ID of the account to delete.

        Returns:
            bool: True if deletion succeeded, False if the account is active or on error.
        """
        if self._run_lock.locked() and account_id == self.account_manager.current_id():
            self.log(
                "[WARNING] Cannot delete the active account while the bot is running."
            )
            return False

        # Tear down the account's OS-level scheduled task BEFORE deletion
        # so the task name (which embeds the account_id) is still
        # resolvable. Idempotent — no-op if no task was registered.
        try:
            self._remove_account_autostart(account_id)
        except Exception as e:
            self.log(f"[WARNING] Failed to remove scheduled task: {e}")

        try:
            self.account_manager.delete(account_id)
        except ValueError as e:
            self.log(f"[ERROR] {e}")
            return False

        self._rebuild_account_context()
        self._broadcast_account_ui()
        return True

    def rerun_setup(self, account_id):
        """
        Re-run First Setup for an existing account (e.g. profile got corrupted).
        Temporarily switches to it if not current, then restores previous.

        Args:
            account_id (str): The ID of the account to run setup for.

        Returns:
            bool: True if setup succeeded, False on failure or if the bot is running.
        """
        if not self._run_lock.acquire(blocking=False):
            self.log("[WARNING] Cannot re-run setup while the bot is running.")
            return False
        try:
            if not self.account_manager.exists(account_id):
                return False

            previous_id = self.account_manager.current_id()
            if account_id != previous_id:
                self.account_manager.select(account_id)
                self._rebuild_account_context()

            ok = self._run_first_setup_for_current()

            if account_id != previous_id:
                self.account_manager.select(previous_id)
                self._rebuild_account_context()
            self._broadcast_account_ui()

            return ok
        finally:
            try:
                self._run_lock.release()
            except Exception:
                pass

    # ------------------------------------------------------------------
    # First setup flow (scoped to the currently-active account)
    # ------------------------------------------------------------------

    def _run_first_setup_for_current(self):
        """
        Open Bing in a visible Edge window for the user to log in manually.
        Returns True on success (browser closed after login attempt), False on error.

        On Windows, temporarily disables the browser-level Microsoft sign-in
        policy (BrowserSignin=0) so Edge does not silently authenticate using
        the Windows account identity. The previous policy value is restored
        when setup ends, regardless of outcome.
        """
        if self.driver_manager is None or self.account_meta is None:
            self.log("[ERROR] No account selected for setup.")
            return False

        current = self.account_manager.get_current()
        label = current["label"] if current else "account"
        self.log(
            f"Starting First Setup for '{label}'... Please log in to your Microsoft account."
        )

        # Capture current policy state so we can restore it afterwards.
        previous_policy = edge_policy.get_current_value()
        policy_applied = False
        if edge_policy.is_supported():
            policy_applied = edge_policy.set_browser_signin_disabled(True)
            if policy_applied:
                self.log("Edge: browser sign-in temporarily disabled for this setup.")

        setup_succeeded = False
        reached_login_page = False
        setup_driver = None

        try:
            setup_driver = self.driver_manager.setup_driver(
                headless=False, disable_identity=True
            )
        except Exception as e:
            self.log(f"[ERROR] Could not start the browser: {e}")
            if policy_applied:
                edge_policy.restore_value(previous_policy)
            return False

        try:
            self.log("Clearing any cached Microsoft identity...")
            try:
                setup_driver.execute_cdp_cmd("Network.clearBrowserCookies", {})
            except Exception:
                pass

            self.log("Opening the Microsoft sign-in page...")
            login_url = (
                "https://login.live.com/login.srf?"
                "wa=wsignin1.0&wp=MBI_SSL&"
                "wreply=https%3A%2F%2Frewards.bing.com%2F&"
                "prompt=select_account"
            )
            try:
                setup_driver.get(login_url)
            except Exception:
                setup_driver.get(
                    "https://login.live.com/login.srf?prompt=select_account"
                )
            reached_login_page = True

            self.log("""Sign in with the Microsoft account for THIS profile.
- Enter the email and password yourself; don't pick a suggested account.
- If Microsoft still auto-connects another account, click the avatar
  (top-right on Bing) and choose 'Sign in with a different account'.
- Close the browser when you're done.""")

            while len(setup_driver.window_handles) > 0:
                time.sleep(1)

            setup_succeeded = True

        except Exception as e:
            error_msg = str(e).lower()
            if reached_login_page and (
                "target window already closed" in error_msg
                or "disconnected" in error_msg
                or "not reachable" in error_msg
                or "invalid session id" in error_msg
                or "no such window" in error_msg
            ):
                setup_succeeded = True
            else:
                self.log(f"[ERROR] Error during setup: {e}")
                if self.history is not None:
                    self.history.add_to_history(
                        "First Setup Failed", "[ERROR] " + str(e)[:50]
                    )

        finally:
            try:
                setup_driver.quit()
            except Exception:
                pass
            try:
                self.driver_manager.close_running_edge(settle=False)
            except Exception:
                pass

            # Always restore the Edge policy to its previous state.
            if policy_applied:
                edge_policy.restore_value(previous_policy)

            if setup_succeeded:
                self.log(
                    f"First Setup completed for '{label}'! You can now start the bot."
                )
                self.account_meta.mark_up_as_done()
                if self.history is not None:
                    self.history.add_to_history("First Setup Completed", "Success")

        return setup_succeeded

    # ------------------------------------------------------------------
    # History (scoped to current account)
    # ------------------------------------------------------------------

    def get_history(self):
        """Return the current account query history."""
        if self.history is None:
            return []
        return self.history.get_history()

    # ------------------------------------------------------------------
    # Background logs
    # ------------------------------------------------------------------

    def get_background_logs(self):
        """
        Return the last 1000 lines of the background log file.

        Returns:
            dict: {"ok": True, "content": str} on success,
                or {"ok": False, "error": str} on failure.
        """
        if not os.path.exists(LOG_FILE_PATH):
            return {"ok": True, "content": ""}

        try:
            with open(LOG_FILE_PATH, "r", encoding="utf-8") as f:
                lines = f.readlines()
                return {
                    "ok": True,
                    "content": "".join(lines[-1000:]),
                }
        except Exception as e:
            print(f"[ERROR] Error reading background logs: {e}")
            return {
                "ok": False,
                "error": f"[ERROR] Error reading background logs: {e}",
            }

    # ------------------------------------------------------------------
    # Statistics (scoped to current account)
    # ------------------------------------------------------------------

    def get_stats(self):
        """
        Return the current account's statistics for the dashboard, augmented
        with a couple of derived convenience fields the UI displays directly:

          * total_points — only the real scraped Rewards balance. It is None
            until Microsoft confirms the balance; activity estimates are not
            presented as points earned.
          * session_points — only a real balance delta. It is None when the
            run could not be verified against Rewards.

        Returns None when no account is selected.
        """
        if self.stats is None:
            return None
        data = self._with_inflight_stats(self.stats.get_stats())

        balance = data["balance"]["current"]
        last = data["last_session"]
        is_estimate = balance is None
        total_points = balance

        ended_at = last.get("ended_at")
        today = datetime.now().date().isoformat()
        bucket = (data.get("daily") or {}).get(today) or {}
        start_bal = bucket.get("start_balance")
        end_bal = balance if isinstance(balance, int) else bucket.get("end_balance")
        if isinstance(start_bal, int) and isinstance(end_bal, int):
            if start_bal == 0 and end_bal > 500:
                today_points = max(0, int(bucket.get("points_delta") or 0))
            else:
                today_points = max(0, int(end_bal) - int(start_bal))
            today_is_estimate = False
        elif bucket.get("points_delta") is not None:
            today_points = max(0, int(bucket.get("points_delta") or 0))
            today_is_estimate = False
        elif isinstance(balance, int):
            today_points = 0
            today_is_estimate = False
        else:
            today_points = None
            today_is_estimate = True
        data["derived"] = {
            "total_points": total_points,
            "is_estimate": is_estimate,
            "session_points": today_points,
            "session_is_estimate": today_is_estimate,
            "last_run_at": ended_at,
            "last_run_date": today,
            "today_points": today_points,
            "today_is_estimate": today_is_estimate,
        }

        # Per-item point values, so the dashboard can split a day's bar into
        # searches vs daily without hard-coding the constants.
        data["constants"] = {
            "points_per_search": POINTS_PER_SEARCH,
            "points_per_card": POINTS_PER_CARD,
        }

        current = self.account_manager.get_current()
        if current:
            data["account"] = {"id": current["id"], "label": current["label"]}
        return data

    def reset_stats(self, scope="chart"):
        """Reset statistics/chart for the current account according to scope."""
        if self.stats is None:
            return None
        scope = str(scope or "chart").strip().lower()
        with self._stats_lock:
            self.stats.reset_stats(scope=scope)
        self._session_counts = {
            "pc": 0,
            "mobile": 0,
            "cards": 0,
            "earn": 0,
            "quests": 0,
            "visual": 0,
            "checkins": 0,
            "news": 0,
            "edge_minutes": 0,
        }
        self._notify_stats_refresh()
        self.log(f"Statistics reset ({scope}).")
        return self.get_stats()

    def get_all_stats(self):
        """
        Return a compact per-account summary for the dashboard's multi-account
        recap: [{id, label, total_points, is_estimate, lifetime_runs}].
        """
        result = []
        for acc in self.account_manager.list():
            stats = StatsManager(stats_path(acc["id"])).get_stats()
            balance = stats["balance"]["current"]
            result.append(
                {
                    "id": acc["id"],
                    "label": acc["label"],
                    "total_points": (balance if balance is not None else None),
                    "is_estimate": balance is None,
                    "lifetime_runs": stats["lifetime"]["runs"],
                    "pc_searches": stats["lifetime"]["pc_searches"],
                    "mobile_searches": stats["lifetime"]["mobile_searches"],
                    "daily_cards": stats["lifetime"]["daily_cards"],
                    "earn_cards": stats["lifetime"].get("earn_cards", 0),
                    "quest_tasks": stats["lifetime"].get("quest_tasks", 0),
                }
            )
        return result

    @staticmethod
    def _country_from_locale(locale, timezone="", stored=None):
        """Country for the Rewards profile.

        Windows/Edge often report en-US even in Colombia. Timezone America/Bogota
        and es-CO market win over that, so the UI does not show United States.
        """
        tz = str(timezone or "")
        loc = str(locale or "").replace("_", "-")
        if "Bogota" in tz or loc.upper().endswith("-CO"):
            return "Colombia"
        if stored in ("Colombia", "CO"):
            return "Colombia"
        code = loc.split("-")[-1].upper()
        names = {
            "US": "United States",
            "CO": "Colombia",
            "MX": "Mexico",
            "ES": "Spain",
            "GB": "United Kingdom",
            "CA": "Canada",
            "BR": "Brazil",
            "AR": "Argentina",
            "CL": "Chile",
            "PE": "Peru",
        }
        return names.get(code, code if len(code) == 2 else (stored or "Unknown"))

    def _scrape_dashboard_counters(self, driver):
        """Read PC/mobile/news progress from the Rewards getuserinfo API."""
        out = {}
        try:
            driver.set_script_timeout(15)
            data = driver.execute_async_script("""
                const done = arguments[0];
                fetch('https://rewards.bing.com/api/getuserinfo?type=1', {
                  credentials: 'include',
                  headers: {Accept: 'application/json'}
                }).then(r => r.json()).then(done).catch(() => done(null));
                """)
        except Exception:
            return out
        counters = (((data or {}).get("dashboard") or {}).get("userStatus") or {}).get(
            "counters"
        ) or {}

        def _frac(value, as_searches=False):
            if isinstance(value, list) and value:
                value = value[0]
            if not isinstance(value, dict):
                return None
            done = value.get("pointProgress")
            total = value.get("pointProgressMax")
            if not (isinstance(done, int) and isinstance(total, int) and total > 0):
                return None
            # Rewards stores POINTS here (3 pts per search / article).
            # Convert to the count the dashboard shows (15 or 30 searches).
            if as_searches and total % POINTS_PER_SEARCH == 0:
                done = done // POINTS_PER_SEARCH
                total = total // POINTS_PER_SEARCH
            return f"{done}/{total}"

        mapping = {
            "pc": (("pcSearch", "pcsearch"), True),
            "mobile": (("mobileSearch", "mobilesearch"), True),
            "news": (("readArticle", "readarticle", "newsSearch"), True),
        }
        for dest, (keys, as_searches) in mapping.items():
            for key in keys:
                for cand in (key, key.lower(), key[:1].lower() + key[1:]):
                    frac = _frac(
                        counters.get(cand) or counters.get(key),
                        as_searches=as_searches,
                    )
                    if frac:
                        out[dest] = frac
                        break
                if dest in out:
                    break
            if dest not in out:
                for k, v in counters.items():
                    if str(k).lower() in [x.lower() for x in keys]:
                        frac = _frac(v, as_searches=as_searches)
                        if frac:
                            out[dest] = frac
                            break
        return out

    def _capture_rewards_profile(self, driver):
        """Save locale, membership level and access state visible on Rewards."""
        if self.account_meta is None:
            return
        try:
            raw = (
                driver.execute_script(
                    "return {locale:navigator.language||'', "
                    "timezone:(Intl.DateTimeFormat().resolvedOptions().timeZone||''), "
                    "text:(document.body.innerText||'').slice(0,30000)};"
                )
                or {}
            )
            locale = str(
                raw.get("locale")
                or self.global_settings.get_settings().get("detected_locale")
                or ""
            )
            text = str(raw.get("text") or "")
            match = re.search(r"\b(?:level|nivel)\s*(\d+)\b", text, re.IGNORECASE)
            member_match = re.search(
                r"\b(gold|silver|bronze)\s+member\b", text, re.IGNORECASE
            )
            checkin_match = re.search(
                r"Check-in\s*:\s*(\d+)\s*/\s*(\d+)",
                text,
                re.IGNORECASE,
            )
            news_match = re.search(
                r"(?:read(?:\s+to\s+earn)?|news(?:paper)?(?:\s+articles)?)\s*:?\s*(\d+)\s*/\s*(\d+)",
                text,
                re.IGNORECASE,
            )
            profile = self.account_meta.get_rewards_profile()
            counters = self._scrape_dashboard_counters(driver)
            tz = str(raw.get("timezone") or profile.get("timezone") or "")
            profile.update(
                {
                    "locale": locale,
                    "country": self._country_from_locale(
                        locale, tz, profile.get("country")
                    ),
                    "timezone": tz or "America/Bogota",
                    "level": int(match.group(1)) if match else profile.get("level"),
                    "membership": (
                        f"{member_match.group(1).title()} Member"
                        if member_match
                        else profile.get("membership")
                    ),
                    "checkin": (
                        f"{checkin_match.group(1)}/{checkin_match.group(2)}"
                        if checkin_match
                        else None
                    ),
                    "news": (
                        counters.get("news")
                        or (
                            f"{news_match.group(1)}/{news_match.group(2)}"
                            if news_match
                            else profile.get("news")
                        )
                    ),
                    "pc_search": counters.get("pc") or profile.get("pc_search"),
                    "mobile_search": counters.get("mobile")
                    or profile.get("mobile_search"),
                    "limited_access": "limited access" in text.lower(),
                    "updated_at": datetime.now().isoformat(timespec="seconds"),
                }
            )
            self.account_meta.set_rewards_profile(profile)
        except Exception:
            # The profile is convenience metadata; never interrupt a balance refresh.
            pass

    @staticmethod
    def _frac_label(pair, fallback=None, empty="pending"):
        """Prefer a live [done, total] pair over a stale stored string."""
        if isinstance(pair, (list, tuple)) and len(pair) == 2:
            try:
                return f"{int(pair[0])}/{int(pair[1])}"
            except (TypeError, ValueError):
                pass
        if fallback:
            return fallback
        return empty

    @staticmethod
    def _progress_from_frac(frac, done_fallback, target_fallback):
        """Build {done, target, left} from a '12/45' string or local counters."""
        if isinstance(frac, str) and "/" in frac:
            try:
                done_s, target_s = frac.split("/", 1)
                done, target = int(done_s), int(target_s)
                return {
                    "done": done,
                    "target": target,
                    "left": max(0, target - done),
                    "label": f"{done}/{target}",
                }
            except ValueError:
                pass
        return {
            "done": done_fallback,
            "target": target_fallback,
            "left": max(0, target_fallback - done_fallback),
            "label": f"{done_fallback}/{target_fallback}",
        }

    def get_rewards_overview(self):
        """Return a read-only daily progress and Rewards-profile summary for the UI."""
        account_id = self.account_manager.current_id()
        if account_id is None or self.stats is None or self.account_meta is None:
            return None
        stats = self.stats.get_stats()
        today = datetime.now().date().isoformat()
        bucket = stats.get("daily", {}).get(today, {})
        settings = self.global_settings.get_settings()
        pc_target = max(0, int(settings.get("queries_pc", 0) or 0))
        mobile_target = max(0, int(settings.get("queries_mobile", 0) or 0))
        profile = self.account_meta.get_rewards_profile()
        locale = profile.get("locale") or settings.get("detected_locale") or ""
        profile.setdefault("locale", locale)
        profile["country"] = self._country_from_locale(
            locale,
            profile.get("timezone") or "America/Bogota",
            profile.get("country"),
        )
        tasks = self.daily_set.get_task_status() if self.daily_set else {}
        live = tasks.get("live") if isinstance(tasks.get("live"), dict) else {}
        daily_state = tasks.get("daily") or "pending"
        if daily_state == "done":
            daily_label = "done"
        elif daily_state == "partial":
            bits = tasks.get("pending_bits") or []
            daily_label = (
                ", ".join(bits)
                if bits
                else (
                    f"{tasks.get('daily_remaining')} remaining"
                    if tasks.get("daily_remaining")
                    else "partial"
                )
            )
        else:
            daily_label = "pending — will verify live"
        edge_pair = (getattr(self.daily_set, "live_progress", {}) or {}).get("edge")
        if isinstance(edge_pair, (list, tuple)) and len(edge_pair) == 2:
            edge_label = f"{edge_pair[0]}/{edge_pair[1]}"
        else:
            edge_label = profile.get("edge") or "pending"
        reset_h = live.get("resetHours")
        try:
            reset_h = int(reset_h)
        except (TypeError, ValueError):
            from .dailytasks.rewards_api import hours_until_daily_reset

            reset_h = hours_until_daily_reset(
                profile.get("timezone") or "America/Bogota"
            )
        return {
            "account": {"id": account_id},
            "profile": profile,
            "estimate": {
                "search_points": None,
                "verified": False,
                "note": "Points are shown only after the Rewards balance is verified.",
            },
            "progress": {
                "pc": self._progress_from_frac(
                    None,
                    int(bucket.get("pc", 0) or 0)
                    + (
                        int(self._session_counts.get("pc") or 0)
                        if self._run_lock.locked()
                        else 0
                    ),
                    pc_target,
                ),
                "mobile": self._progress_from_frac(
                    None,
                    int(bucket.get("mobile", 0) or 0)
                    + (
                        int(self._session_counts.get("mobile") or 0)
                        if self._run_lock.locked()
                        else 0
                    ),
                    mobile_target,
                ),
                "daily": daily_label,
                "daily_state": daily_state,
                "visual": tasks.get("visual") or "pending",
                "checkin": self._frac_label(
                    live.get("checkin"),
                    tasks.get("checkin") if tasks.get("checkin") != "done" else None,
                    "pending",
                ),
                "news": self._frac_label(
                    live.get("news"),
                    (
                        profile.get("news")
                        if tasks.get("news") != "done"
                        else tasks.get("news")
                    ),
                    tasks.get("news") or "pending",
                ),
                "edge": self._frac_label(live.get("edge"), edge_label, "pending"),
                "reset": f"resets in {reset_h}h (midnight)",
            },
        }

    def get_manual_tasks(self):
        """Open quests scraped from this account's /earn page (For you tab)."""
        if self.account_meta is None:
            return {"tasks": [], "ignored": [], "removed": [], "refreshing": False}
        from .dailytasks.manual import list_tasks

        prefs = self.account_meta.get_manual_prefs()
        live = list(getattr(self.daily_set, "for_you_tasks", None) or [])
        if not live:
            live = self.account_meta.get_live_manual_tasks()
        return {
            "tasks": list_tasks(prefs["ignored"], prefs["removed"], live),
            "ignored": prefs["ignored"],
            "removed": prefs["removed"],
            "refreshing": bool(self._manual_refreshing),
        }

    def refresh_manual_tasks(self):
        """Start a non-blocking hidden /earn scrape and return cached tasks."""
        data = self.get_manual_tasks()
        account_id = self.account_manager.current_id()
        if (
            account_id is None
            or self.account_meta is None
            or not self.account_meta.is_first_setup_done()
            or self._run_lock.locked()
            or self.is_driver_loading
        ):
            return data
        now = time.time()
        if now - float(self._manual_last_refresh_at.get(account_id) or 0) < 300.0:
            return data
        if not self._manual_refresh_lock.acquire(blocking=False):
            data["refreshing"] = True
            return data
        self._manual_refreshing = True
        self._manual_last_refresh_at[account_id] = now
        data["refreshing"] = True
        threading.Thread(
            target=self._refresh_manual_tasks_worker,
            args=(account_id,),
            daemon=True,
        ).start()
        return data

    def _refresh_manual_tasks_worker(self, account_id):
        driver = None
        balance_claimed = False
        try:
            if self._run_lock.locked() or self.is_driver_loading:
                return
            if self.account_meta is None or not self.account_meta.is_first_setup_done():
                return
            if not self._balance_lock.acquire(blocking=False):
                return
            balance_claimed = True
            driver = self.driver_manager.setup_driver(headless=True, background=True)
            live = self.daily_set.collect_for_you(driver)
            if self.account_manager.current_id() != account_id:
                return
            self.daily_set.for_you_tasks = list(live or [])
            if self.account_meta is not None:
                self.account_meta.set_live_manual_tasks(self.daily_set.for_you_tasks)
            self._safe_log(
                f"For you: {len(self.daily_set.for_you_tasks)} quest(s) detected automatically."
            )
        except Exception as e:
            self._safe_log(f"[WARNING] Automatic quest detection failed: {e}")
        finally:
            if driver is not None:
                try:
                    driver.quit()
                except Exception:
                    pass
                try:
                    self.driver_manager.close_running_edge(settle=False)
                except Exception:
                    pass
            if balance_claimed:
                self._balance_lock.release()
            self._manual_refreshing = False
            self._manual_refresh_lock.release()

    def ignore_manual_task(self, task_id, ignored=True):
        if self.account_meta is None:
            return self.get_manual_tasks()
        self.account_meta.set_manual_pref(task_id, "ignore" if ignored else "unignore")
        return self.get_manual_tasks()

    def remove_manual_task(self, task_id):
        if self.account_meta is None:
            return self.get_manual_tasks()
        self.account_meta.set_manual_pref(task_id, "remove")
        return self.get_manual_tasks()

    def restore_manual_task(self, task_id):
        if self.account_meta is None:
            return self.get_manual_tasks()
        self.account_meta.set_manual_pref(task_id, "restore")
        return self.get_manual_tasks()

    def open_manual_task(self, task_id):
        from .dailytasks.manual import catalog_by_id

        task_id = str(task_id or "")
        item = catalog_by_id().get(task_id)
        if not item:
            for row in self.get_manual_tasks().get("tasks") or []:
                if str(row.get("id")) == task_id:
                    item = row
                    break
        if not item:
            return {"ok": False, "error": "unknown"}
        url = item.get("url") or ""
        try:
            if url.startswith("ms-settings:"):
                os.startfile(url)
            else:
                webbrowser.open(url)
            return {"ok": True, "url": url}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def _fetch_balance_with_driver(self, driver, attempts=8):
        """
        Navigate the given driver to the rewards dashboard and poll for the
        points balance. Polls because the rewards counter is an Angular SPA
        that hydrates / animates a moment after the page loads.

        Args:
            driver: an open Selenium WebDriver bound to a logged-in profile.
            attempts (int): how many times to re-check before giving up.

        Returns:
            int | None: the scraped balance, or None if it never appeared.
        """
        # Cap the page load so a stuck/headless navigation can't hang forever
        # (which would leave the browser open with nothing to read). On timeout
        # we still try to scrape whatever rendered.
        from selenium.common.exceptions import TimeoutException

        try:
            driver.set_page_load_timeout(30)
        except Exception:
            pass

        # Try the dashboard root first (legacy dashboard + the new dashboard when
        # migrated accounts are redirected there), then the explicit /dashboard
        # path used by the new Next.js app in case the root doesn't render it.
        urls = ["https://rewards.bing.com", "https://rewards.bing.com/dashboard"]

        attempts = max(1, attempts)
        self._last_balance_debug = {}

        for url in urls:
            try:
                driver.get(url)
            except TimeoutException:
                pass  # scrape whatever managed to render
            except Exception as e:
                self._last_balance_debug = {"error": str(e)[:120], "url": url}
                continue

            # Give the SPA a beat to mount before the first read.
            time.sleep(2.5)

            for _ in range(attempts):
                info = scrape_points_balance_debug(driver)
                self._last_balance_debug = info
                value = info.get("value")
                if isinstance(value, int) and value >= 0:
                    # No log here — the caller emits a single user-facing line, so
                    # a scrape+update pair doesn't read as a duplicate.
                    return value
                time.sleep(1.5)

        # Not found on any URL. Surface the diagnostic to the activity feed so a
        # failure can be debugged from the logs (which page did we land on, what
        # did the selectors match), then also keep it in _last_balance_debug for
        # the dashboard's on-demand refresh diagnostic.
        info = self._last_balance_debug or {}
        self.log(
            "[WARNING] Balance not found — "
            f"url={info.get('url')!r} title={info.get('title')!r} "
            f"via={info.get('via')!r} candidates={info.get('candidates') or []}"
        )
        return None

    def _refresh_balance_on_launch(self, driver):
        """
        On-launch balance refresh: if this account is set up, scrape the real
        balance now using the already-open warmup driver so the GUI opens on an
        up-to-date total. Runs every launch (not just the first); a failed read
        silently keeps the previously stored balance.
        """
        # Pin to the account that owns this warmup driver. The scrape runs on a
        # background thread, so a mid-scrape account switch could otherwise save
        # this profile's balance into another account's stats.json.
        stats = self.stats
        meta = self.account_meta
        account_id = self.account_manager.current_id()
        if stats is None or meta is None or account_id is None:
            return
        if not meta.is_first_setup_done():
            return

        # Only animate the card on the first launch, when there's nothing to
        # show yet. On later launches a value is already displayed, so refresh
        # it silently in the background — no distracting shimmer on a number
        # that's already there.
        animate = stats.get_stats()["balance"]["current"] is None

        self.log("Refreshing your Rewards points balance…")
        if animate:
            self._set_stats_loading(True)
        try:
            balance = self._fetch_balance_with_driver(driver)
        finally:
            if animate:
                self._set_stats_loading(False)
        # Region and membership level are independent of whether the balance
        # selector happened to be available during this page load.
        self._capture_rewards_profile(driver)
        if balance is None:
            self.log(
                "[INFO] Couldn't read the points balance right now "
                "(keeping the last known total)."
            )
            return
        # Skip if the user switched accounts while we were scraping.
        if self.account_manager.current_id() != account_id:
            return
        with self._stats_lock:
            stats.update_balance(balance)
        self._notify_stats_refresh()
        self.log(f"Points balance updated: {balance:,}")

    def refresh_balance(self, silent=False):
        """
        Exposed to JS (dashboard 'Refresh balance' button). Open a short-lived
        headless driver, scrape the real balance, persist it, and refresh the
        UI without recording a run.

        Returns:
            dict: {"ok": True, "balance": int} on success, else
                  {"ok": False, "error": <reason>}.
        """
        account_id = self.account_manager.current_id()
        if account_id is None:
            return {"ok": False, "error": "no_account"}
        if self.account_meta is None or not self.account_meta.is_first_setup_done():
            return {"ok": False, "error": "setup_needed"}
        # A run or the startup warmup is already driving this profile; a second
        # driver on the same EdgeProfile would clash, so refuse and let the
        # caller retry once things settle.
        if self._run_lock.locked() or self.is_driver_loading:
            return {"ok": False, "error": "busy"}

        # Atomically claim the profile: the checks above are advisory, so a
        # dedicated lock is what actually prevents two refreshes from opening a
        # driver on the same Edge profile at once.
        if not self._balance_lock.acquire(blocking=False):
            return {"ok": False, "error": "busy"}

        # Pin to the account that opened the driver so a concurrent account
        # switch can't redirect this profile's balance to another account.
        stats = self.stats
        driver_manager = self.driver_manager

        self.log("Refreshing points balance…")
        self._set_stats_loading(True)
        driver = None
        try:
            driver = driver_manager.setup_driver(headless=True, background=True)
            balance = self._fetch_balance_with_driver(driver)
        except Exception as e:
            self.log(f"[WARNING] Balance refresh failed: {e}")
            return {"ok": False, "error": "driver"}
        finally:
            if driver is not None:
                try:
                    driver.quit()
                except Exception:
                    pass
                try:
                    driver_manager.close_running_edge(settle=False)
                except Exception:
                    pass
            self._set_stats_loading(False)
            self._balance_lock.release()

        if balance is None:
            self.log("[INFO] Could not read the points balance from the rewards page.")
            info = self._last_balance_debug or {}
            return {
                "ok": False,
                "error": "not_found",
                "url": info.get("url"),
                "title": info.get("title"),
                "candidates": info.get("candidates") or [],
                "diag_error": info.get("error"),
            }

        # Only persist + refresh the UI if we're still on the same account.
        if stats is None or self.account_manager.current_id() != account_id:
            return {"ok": False, "error": "account_changed"}
        with self._stats_lock:
            stats.update_balance(balance)
        self._notify_stats_refresh()
        if not silent:
            self.log(f"Points balance updated: {balance:,}")
        return {"ok": True, "balance": balance}

    # ------------------------------------------------------------------
    # Logging
    # ------------------------------------------------------------------

    def log(self, message):
        """
        Log to the GUI when attached; otherwise to stdout.

        Args:
            message (str): The message to log.
        """
        if self._webview_window:
            try:
                safe_message = json.dumps(message)
                self._webview_window.evaluate_js(f"update_log({safe_message})")
            except Exception as e:
                print(f"Log error: {e}")
        else:
            print(message)

    def _broadcast_account_ui(self):
        """Ask the GUI to refresh the account dropdown and setup state."""
        if self._webview_window:
            try:
                self._webview_window.evaluate_js("refresh_account_ui()")
            except Exception:
                pass

    # ------------------------------------------------------------------
    # Main run
    # ------------------------------------------------------------------

    def _sleep_with_stop(self, seconds):
        """
        Sleep up to `seconds`, but return early if Stop was requested.

        Args:
            seconds (float): The number of seconds to sleep.

        Returns:
            bool: True if stop was requested during the wait, else False.
        """
        return wait_or_stop(seconds, self._stop_event)

    def _run_advanced_schedule(
        self,
        pc_count,
        mobile_count,
        duration_hours,
        queries_per_hour,
        search_delay_range=DEFAULT_SEARCH_DELAY,
    ):
        """
        Drip-feed queries across a duration using the GUI run pipeline.

        Args:
            pc_count (int): total PC queries to run
            mobile_count (int): total Mobile queries to run
            duration_hours (float|int): how many hours to spread the queries across
            queries_per_hour (int): target queries per hour (overrides duration_hours if > 0)
            search_delay_range (tuple): the range of delays to use for each search
        """
        try:
            pc = max(0, int(pc_count or 0))
        except (TypeError, ValueError):
            pc = 0
        try:
            mobile = max(0, int(mobile_count or 0))
        except (TypeError, ValueError):
            mobile = 0

        try:
            duration_hours = float(duration_hours)
        except (TypeError, ValueError):
            duration_hours = 3.0

        duration_hours = max(1.0, duration_hours)

        try:
            qph = int(queries_per_hour or 0)
        except (TypeError, ValueError):
            qph = 0

        if qph < 0:
            qph = 0

        total = pc + mobile
        self.log(
            f"Advanced scheduling: PC={pc}, Mobile={mobile} over {duration_hours}h (qph={qph})"
        )

        if total <= 0:
            self.log("[WARNING] Nothing to do (PC and Mobile counts are both 0).")
            return

        if qph > 0:
            raw_batch = qph // 6  # ~10-minute batches
        else:
            raw_batch = total // max(1, int(duration_hours * 2))
        per_batch = max(1, min(10, raw_batch))

        num_batches = math.ceil(total / per_batch)
        total_seconds = duration_hours * 3600
        interval = total_seconds / max(num_batches, 1)

        self.log(
            f"Planning {num_batches} batches of ~{per_batch} queries, interval ~{interval:.1f}s"
        )

        pc_left = pc
        mobile_left = mobile

        for i in range(num_batches):
            if self._stop_event.is_set():
                break

            if pc_left > 0:
                batch_pc = min(per_batch, pc_left)
                batch_mobile = 0
            else:
                batch_pc = 0
                batch_mobile = min(per_batch, mobile_left)

            if batch_pc == 0 and batch_mobile == 0:
                break

            self.log(
                f"Batch {i+1}/{num_batches}: PC={batch_pc}, Mobile={batch_mobile} "
                f"(PC left {pc_left}, Mobile left {mobile_left})"
            )

            if batch_pc > 0 and not self._stop_event.is_set():
                self._run_phase(
                    mobile=False,
                    count=batch_pc,
                    do_daily_set=True,
                    search_delay_range=search_delay_range,
                )

            if batch_mobile > 0 and not self._stop_event.is_set():
                self._run_phase(
                    mobile=True,
                    count=batch_mobile,
                    do_daily_set=False,
                    search_delay_range=search_delay_range,
                )

            pc_left -= batch_pc
            mobile_left -= batch_mobile

            if pc_left <= 0 and mobile_left <= 0:
                break
            if self._stop_event.is_set():
                break

            sleep_time = max(5.0, interval * random.uniform(0.75, 1.25))
            self.log(f"Sleeping {sleep_time:.1f}s until next batch")
            if self._sleep_with_stop(sleep_time):
                break

        if not self._stop_event.is_set() and pc_left <= 0 and mobile_left <= 0:
            self.log("Advanced schedule completed!")

    def main(self, pc_count, mobile_count=0, daily_only=False, run_context="manual"):
        """
        Run the bot against the currently-selected account.

        Default mode (daily_only=False): runs sequentially
          1. PC phase     — desktop UA, `pc_count` Bing searches, then Daily Set.
          2. Mobile phase — iPhone UA, `mobile_count` Bing searches only.
        Either count may be 0 to skip that phase.

        Daily-only mode (daily_only=True): skips searches entirely and only
        opens a desktop driver to run the Daily Set + More Activities. Both
        count arguments are ignored. Useful when the user just wants to
        collect today's daily-task points without churning searches.

        Args:
            pc_count (int): how many searches to do in the PC phase (ignored if daily_only)
            mobile_count (int): how many searches to do in the Mobile phase (ignored if daily_only)
            daily_only (bool): whether to skip searches and just run the Daily Set
            run_context (str): The context in which the bot is running ("manual" or "scheduled")
        """
        if run_context not in ("manual", "scheduled"):
            self.log(
                f"[WARNING] Unknown run context '{run_context}'. Using scheduled mode."
            )
            run_context = "scheduled"
        if self.account_manager.current_id() is None:
            self.log("[ERROR] No account selected. Add one via the dropdown.")
            if self._webview_window:
                self._webview_window.evaluate_js("enable_start_button()")
            return

        if self.account_meta is None or not self.account_meta.is_first_setup_done():
            self.log("[ERROR] First Setup has not been completed for this account.")
            if self._webview_window:
                self._webview_window.evaluate_js("enable_start_button()")
            return

        daily_only = bool(daily_only)

        try:
            pc_count = max(0, int(pc_count or 0))
            mobile_count = max(0, int(mobile_count or 0))
        except (TypeError, ValueError):
            pc_count, mobile_count = 0, 0

        if not daily_only and pc_count == 0 and mobile_count == 0:
            daily_only = True

        schedule = {}
        if not daily_only and self.account_meta is not None:
            try:
                schedule = self.account_meta.get_schedule() or {}
            except Exception:
                schedule = {}

        schedule_enabled = isinstance(schedule, dict) and bool(schedule.get("enabled"))
        use_advanced = (
            not daily_only
            and schedule_enabled
            and bool(schedule.get("advancedScheduling"))
        )

        if run_context == "manual" and not use_advanced:
            search_delay_range = self.global_settings.get_manual_search_delay()
        else:
            search_delay_range = DEFAULT_SEARCH_DELAY

        if (
            not daily_only
            and isinstance(schedule, dict)
            and bool(schedule.get("advancedScheduling"))
            and not schedule_enabled
        ):
            self.log(
                "[WARNING] Advanced scheduling is enabled, but Schedule is off. Running normal pace."
            )

        if not self._run_lock.acquire(blocking=False):
            self.log("[WARNING] A run is already in progress.")
            return

        seq = self._run_seq
        self._stop_event.clear()
        if seq != self._run_seq:
            try:
                self._run_lock.release()
            except Exception:
                pass
            self._safe_log("Stopped before start.")
            return

        # Reset per-run stats accumulators. _run_phase / _run_daily_only feed
        # these; _record_session_stats() folds them into stats.json at the end.
        self._session_counts = {
            "pc": 0,
            "mobile": 0,
            "cards": 0,
            "earn": 0,
            "quests": 0,
        }
        self._last_scraped_balance = None
        self._daily_set_attempted = False
        self._visual_search_attempted = False

        try:
            if daily_only:
                self.log(f"=== Tasks only ({CURRENT_VERSION}) ===")
                self.log(
                    "Flow: 1 Daily Set → 2 Ready to claim → 3 More activities → "
                    "4 Punchcards → 5 Visual Search → 6 Check-in (Bing phone) → "
                    "7 News (Bing phone, Colombia) → 8 Edge browsing minutes"
                )
                self._report("Run", True, "Tasks only")
            else:
                self.log(f"=== Start run ({CURRENT_VERSION}) ===")
                self.log(
                    f"Flow: 1 PC searches ({pc_count}) → 2 Mobile searches "
                    f"(Bing phone client, {mobile_count}) → 3 Daily Set → "
                    "4 Ready to claim → 5 More activities → 6 Punchcards → "
                    "7 Visual Search → 8 Check-in (Bing phone) → "
                    "9 News (Bing phone) → 10 Edge browsing minutes"
                )
                self._report(
                    "Run",
                    True,
                    f"Start run · PC {pc_count} · Mobile {mobile_count}",
                )
            if self._webview_window:
                try:
                    self._webview_window.evaluate_js(
                        "update_status_indicator && update_status_indicator('executing')"
                    )
                except Exception:
                    pass

            if daily_only:
                self._run_daily_only()
                if not self._stop_event.is_set():
                    self._run_bing_app_tasks()
                if not self._stop_event.is_set():
                    self._run_edge_browse_if_needed()
            else:
                if use_advanced:
                    duration = schedule.get("runDuration", 3)
                    qph = schedule.get("queriesPerHour", 10)
                    self.log("Advanced scheduling enabled. Using scheduled pacing.")
                    self._run_advanced_schedule(
                        pc_count,
                        mobile_count,
                        duration,
                        qph,
                        search_delay_range=search_delay_range,
                    )
                else:
                    if pc_count > 0 and not self._stop_event.is_set():
                        self._run_phase(
                            mobile=False,
                            count=pc_count,
                            do_daily_set=False,
                            search_delay_range=search_delay_range,
                        )

                    if mobile_count > 0 and not self._stop_event.is_set():
                        self._run_phase(
                            mobile=True,
                            count=mobile_count,
                            do_daily_set=False,
                            search_delay_range=search_delay_range,
                        )

                    # Always verify dashboard items after searches. Each function
                    # logs skip vs run from the live page (not status.json alone).
                    if not self._stop_event.is_set() and self.daily_set is not None:
                        self._run_daily_only()
                        if not self._stop_event.is_set():
                            self._run_bing_app_tasks()
                        if not self._stop_event.is_set():
                            self._run_edge_browse_if_needed()

            if self._stop_event.is_set():
                self.log("Stopped.")
            else:
                self.log("Done!")
                try:
                    self.global_settings.register_successful_run()
                    if self._webview_window:
                        self._webview_window.evaluate_js(
                            "typeof check_star_prompt === 'function' && check_star_prompt()"
                        )
                except Exception:
                    pass

                if self.account_meta is not None:
                    try:
                        from datetime import date

                        current_schedule = self.account_meta.get_schedule()
                        if isinstance(current_schedule, dict):
                            current_schedule["last_triggered_date"] = (
                                date.today().isoformat()
                            )
                            self.account_meta.set_schedule(current_schedule)
                    except Exception as e:
                        self.log(f"[WARNING] Failed to update deduplication date: {e}")
        finally:
            # Persist this run's activity + balance before unlocking, so a
            # GUI refresh triggered by enable_start_button() reads fresh stats.
            self._record_session_stats()
            try:
                if self._webview_window:
                    self._webview_window.evaluate_js("enable_start_button()")
            except Exception:
                pass
            self._run_lock.release()

    def _try_scrape_balance(self):
        """
        Best-effort read of the real points balance from the page the active
        driver is currently on. Only updates `_last_scraped_balance` on a
        successful read, so a later SERP miss never clobbers a good value
        scraped earlier from the rewards dashboard.
        """
        if self._driver is None:
            return
        try:
            value = scrape_points_balance(self._driver, self.log)
        except Exception:
            value = None
        if value is not None:
            self._last_scraped_balance = value

    def _record_session_stats(self):
        """
        Fold this run's accumulated counters + scraped balance into stats.json
        and ask the GUI (if attached) to refresh the stats card.
        """
        if self.stats is None:
            return
        try:
            with self._stats_lock:
                self.stats.record_session(
                    pc_searches=self._session_counts.get("pc", 0),
                    mobile_searches=self._session_counts.get("mobile", 0),
                    daily_cards=self._session_counts.get("cards", 0),
                    earn_cards=self._session_counts.get("earn", 0),
                    quest_tasks=self._session_counts.get("quests", 0),
                    visual_searches=self._session_counts.get("visual", 0),
                    checkins=self._session_counts.get("checkins", 0),
                    news_reads=self._session_counts.get("news", 0),
                    edge_minutes=self._session_counts.get("edge_minutes", 0),
                    balance=self._last_scraped_balance,
                )
        except Exception as e:
            self.log(f"[WARNING] Failed to record stats: {e}")
            return

        # Counts are now on disk. Clear in-flight so the GUI refresh (still
        # inside the run lock) cannot overlay them a second time.
        self._session_counts = {
            "pc": 0,
            "mobile": 0,
            "cards": 0,
            "earn": 0,
            "quests": 0,
            "visual": 0,
            "checkins": 0,
            "news": 0,
            "edge_minutes": 0,
        }
        self._notify_stats_refresh()

    def _report_dashboard_steps(self, live, totals):
        live = live or {}
        totals = totals or {}
        daily = live.get("daily")
        if isinstance(daily, (list, tuple)) and len(daily) == 2:
            ok = int(daily[0]) >= int(daily[1]) and int(daily[1]) > 0
            self._report("Daily Set", ok, f"{daily[0]}/{daily[1]}")
        else:
            newly = int(totals.get("newly") or 0)
            self._report(
                "Daily Set",
                True if newly else "skip",
                f"{newly} new card(s)",
            )
        claim = live.get("claim")
        if isinstance(claim, int) and claim > 0:
            self._report("Ready to claim", False, f"{claim} still pending")
        else:
            self._report("Ready to claim", True, "nothing pending")
        earn = int(totals.get("earn") or 0)
        self._report(
            "More activities",
            True if earn else "skip",
            f"{earn} opened",
        )
        quests = int(totals.get("quests") or 0)
        self._report(
            "Punchcards",
            True if quests else "skip",
            f"{quests} task(s) opened",
        )

    def _report(self, name, ok, detail=""):
        """Log a step and append it to Execution history (OK / Skipped / ERROR)."""
        if ok is True:
            status = f"OK — {detail}" if detail else "OK"
        elif ok is False:
            status = f"[ERROR] {detail}" if detail else "[ERROR] Failed"
        else:
            status = f"Skipped — {detail}" if detail else "Skipped"
        self.log(f"{name}: {status}")
        if self.history is not None:
            try:
                self.history.add_activity(name, status)
            except Exception:
                pass

    def _with_inflight_stats(self, data):
        """Add the current run's counts so Lifetime / PC 3/15 update live."""
        if not data or not self._run_lock.locked():
            return data
        pc = int(self._session_counts.get("pc") or 0)
        mobile = int(self._session_counts.get("mobile") or 0)
        cards = int(self._session_counts.get("cards") or 0)
        earn = int(self._session_counts.get("earn") or 0)
        quests = int(self._session_counts.get("quests") or 0)
        visual = int(self._session_counts.get("visual") or 0)
        checkins = int(self._session_counts.get("checkins") or 0)
        news = int(self._session_counts.get("news") or 0)
        edge_minutes = int(self._session_counts.get("edge_minutes") or 0)
        if (
            pc
            + mobile
            + cards
            + earn
            + quests
            + visual
            + checkins
            + news
            + edge_minutes
            == 0
        ):
            return data
        import copy

        data = copy.deepcopy(data)
        estimate = (pc + mobile) * POINTS_PER_SEARCH + (
            cards + earn + quests
        ) * POINTS_PER_CARD
        life = data["lifetime"]
        life["pc_searches"] = int(life.get("pc_searches") or 0) + pc
        life["mobile_searches"] = int(life.get("mobile_searches") or 0) + mobile
        life["daily_cards"] = int(life.get("daily_cards") or 0) + cards
        life["earn_cards"] = int(life.get("earn_cards") or 0) + earn
        life["quest_tasks"] = int(life.get("quest_tasks") or 0) + quests
        life["visual_searches"] = int(life.get("visual_searches") or 0) + visual
        life["checkins"] = int(life.get("checkins") or 0) + checkins
        life["news_reads"] = int(life.get("news_reads") or 0) + news
        life["edge_minutes"] = int(life.get("edge_minutes") or 0) + edge_minutes
        life["points_estimate"] = int(life.get("points_estimate") or 0) + estimate
        today = datetime.now().date().isoformat()
        bucket = data.setdefault("daily", {}).setdefault(
            today,
            {"pc": 0, "mobile": 0, "cards": 0, "earn": 0, "quests": 0, "runs": 0},
        )
        bucket["pc"] = int(bucket.get("pc") or 0) + pc
        bucket["mobile"] = int(bucket.get("mobile") or 0) + mobile
        bucket["cards"] = int(bucket.get("cards") or 0) + cards
        bucket["earn"] = int(bucket.get("earn") or 0) + earn
        bucket["quests"] = int(bucket.get("quests") or 0) + quests
        data["last_session"] = {
            "ended_at": datetime.now().isoformat(timespec="seconds"),
            "pc_searches": pc,
            "mobile_searches": mobile,
            "daily_cards": cards,
            "earn_cards": earn,
            "quest_tasks": quests,
            "visual_searches": visual,
            "checkins": checkins,
            "news_reads": news,
            "edge_minutes": edge_minutes,
            "points_estimate": estimate,
            "points_delta": None,
        }
        return data

    def _notify_progress(self):
        """Refresh main-window overview + stats (and the stats window if open)."""
        self._notify_stats_refresh()
        if self._webview_window:
            try:
                self._webview_window.evaluate_js(
                    "typeof refresh_rewards_overview === 'function' && "
                    "refresh_rewards_overview()"
                )
            except Exception:
                pass
        if self._stats_window:
            try:
                self._stats_window.evaluate_js(
                    "pywebview.api.get_stats().then(function(s){"
                    "if (typeof render_current_stats==='function') render_current_stats(s);"
                    "})"
                )
            except Exception:
                pass

    def _notify_stats_refresh(self):
        """Ask the GUI (if attached) to refresh the compact stats card."""
        if self._webview_window:
            try:
                self._webview_window.evaluate_js(
                    "typeof refresh_stats_ui === 'function' && refresh_stats_ui()"
                )
            except Exception:
                pass

    def _set_stats_loading(self, flag):
        """Toggle the compact stats card's loading animation in the GUI."""
        if self._webview_window:
            try:
                state = "true" if flag else "false"
                self._webview_window.evaluate_js(
                    f"typeof set_stats_loading === 'function' && "
                    f"set_stats_loading({state})"
                )
            except Exception:
                pass

    def _run_daily_only(self):
        """
        Open a PC driver, run only the Daily Set + More Activities, scrape
        the points balance, then quit. No Bing searches are performed.

        A task already marked as done today is skipped, unless the matching
        "Force daily tasks" / "Force visual search" setting is on. When forced,
        the card-level detection inside perform_daily_set still skips cards that
        are genuinely complete, and the visual search picks an image it has not
        used recently, so re-running on a real already-done day just confirms
        state without wasting clicks.
        """
        if self.daily_set is None:
            self.log("[ERROR] Daily tasks unavailable for this account.")
            if self.history is not None:
                self.history.add_activity(
                    "Daily tasks", "[ERROR] Unavailable for this account"
                )
            return

        force = self.global_settings.get_force_tasks()
        daily_done = not self.daily_set.should_perform_daily_set()
        run_daily_set = True

        self.log(f"=== Tasks — verify each Rewards item ({CURRENT_VERSION}) ===")
        waited = 0.0
        while self.is_driver_loading and waited < 60 and not self._stop_event.is_set():
            time.sleep(0.5)
            waited += 0.5
        self.log("Opening Edge (waiting for leftover browsers to close)...")

        if daily_done and not force["force_daily_tasks"]:
            self.log(
                "Daily Set cards already marked done; still checking "
                "earn-page, punchcard quests and Edge streak."
            )
        elif daily_done:
            self.log(
                "Daily tasks already marked as done today, but running anyway "
                "(Force daily tasks is ON)."
            )

        try:
            self.driver_manager.close_running_edge()
        except Exception:
            pass
        try:
            self._driver = self.driver_manager.setup_driver(
                mobile=False, stop_event=self._stop_event
            )
        except Exception:
            if self._stop_event.is_set():
                self.log("Stopped.")
                return
            raise
        self.log("Edge is ready.")
        try:
            if self._stop_event.is_set():
                return
            if run_daily_set:
                self._daily_set_attempted = True
                human = HumanBehavior(
                    self._driver,
                    show_cursor=True,
                    mobile=False,
                    stop_event=self._stop_event,
                )
                success = self.daily_set.perform_daily_set(
                    self._driver, human, stop_event=self._stop_event
                )
                if not self._check_driver_alive():
                    self.log("Browser window closed — stopping tasks.")
                    return
                # Record cards completed + scrape the balance while we're still
                # on the rewards dashboard, before any Stop check returns early.
                totals = self.daily_set.last_totals
                self._session_counts["cards"] += totals.get("newly", 0)
                self._session_counts["earn"] += totals.get("earn", 0)
                self._session_counts["quests"] += totals.get("quests", 0)
                self._notify_progress()
                remaining = self.daily_set.save_daily_progress(totals)
                try:
                    live = getattr(self.daily_set, "live_progress", {}) or {}
                    self.daily_set.save_live_snapshot(live)
                    self._report_dashboard_steps(live, totals)
                except Exception:
                    pass
                self._try_scrape_balance()
                if self._stop_event.is_set():
                    self.log("Daily tasks aborted by Stop.")
                    if self.history is not None:
                        self.history.add_activity("Daily tasks: set", "Stopped by user")
                    return
                if success and remaining == 0:
                    self.daily_set.mark_as_completed()
                    self.log("Daily tasks completed and marked as done for today.")
                    if self.history is not None:
                        completed = int(totals.get("newly", 0) or 0)
                        self.history.add_activity(
                            "Daily tasks: set",
                            f"Success ({completed} new task{'s' if completed != 1 else ''})",
                        )
                elif remaining:
                    self.log(
                        f"Daily tasks partial: {remaining} card(s) still incomplete. "
                        "They will be retried automatically."
                    )
                    if self.history is not None:
                        self.history.add_activity(
                            "Daily tasks: set", f"Partial ({remaining} remaining)"
                        )
                else:
                    self.log("Daily tasks failed. Not marked as done for today.")
                    if self.history is not None:
                        self.history.add_activity("Daily tasks: set", "[ERROR] Failed")

            # Run the visual search even if the Daily Set failed or was skipped.
            if not self._stop_event.is_set():
                self._run_visual_search_if_needed()
            try:
                live = getattr(self.daily_set, "for_you_tasks", None)
                if live is not None and self.account_meta is not None:
                    self.account_meta.set_live_manual_tasks(live)
            except Exception:
                pass

        finally:
            self._quit_driver()

    def _run_bing_app_tasks(self):
        """
        Verify check-in / news / Bing-app streak against the live dashboard,
        then run only what is still open. Simulated Bing phone client only.
        """
        if self.daily_set is None or self.driver_manager is None:
            return

        from .dailytasks.bing_app import BingAppTasks

        self.log("=== [7/8] + [8/8] Mobile app — verifying live counters ===")
        tasks = BingAppTasks(logger=self.log)
        phone_claim = self._phone_try("claim", timeout=75)
        if phone_claim is not None and phone_claim.get("ok"):
            self.log(
                f"[7/8] Mobile claim — completed on linked phone ({phone_claim.get('detail') or 'ok'})."
            )
            self._report("Mobile claim", True, phone_claim.get("detail") or "by phone")
        phone_checkin = self._phone_try("checkin", timeout=90)
        if phone_checkin is not None:
            if phone_checkin.get("ok"):
                self.log("[7/8] Mobile check-in — completed on the linked phone.")
                self._session_counts["checkins"] += 1
                self.daily_set.mark_checkin_as_completed()
                self._report(
                    "Check-in", True, phone_checkin.get("detail") or "by phone"
                )
                try:
                    self.daily_set.save_live_snapshot({"checkin": [1, 1]})
                except Exception:
                    pass
            else:
                self.log(
                    "[7/8] Mobile check-in — phone did not finish: "
                    f"{phone_checkin.get('detail')}"
                )
                self._report(
                    "Check-in",
                    "skip",
                    phone_checkin.get("detail") or "phone job failed",
                )
            self._notify_progress()
        phone_news = self._phone_try("news", timeout=120)
        if phone_news is not None:
            if phone_news.get("ok"):
                self.log("[8/8] News — credited on the linked phone.")
                self._session_counts["news"] += 1
                self.daily_set.mark_news_as_completed()
                self._report("News", True, phone_news.get("detail") or "by phone")
            else:
                self.log(
                    f"[8/8] News — phone did not finish: {phone_news.get('detail')}"
                )
                self._report(
                    "News", "skip", phone_news.get("detail") or "phone job failed"
                )
            self._notify_progress()
        if phone_checkin is not None and phone_news is not None:
            return

        if phone_checkin is None or phone_news is None:
            self.log(
                "[INFO] No linked phone available for check-in/news; "
                "continuing with the simulated mobile client."
            )

        try:
            self._driver = self.driver_manager.setup_driver(
                mobile=True, bing_app=True, stop_event=self._stop_event
            )
        except Exception:
            if self._stop_event.is_set():
                self.log("Stopped.")
                return
            raise
        if self._stop_event.is_set():
            self._quit_driver()
            return
        try:
            live = tasks.read_live_app_progress(
                self._driver, stop_event=self._stop_event
            )
            checkin = live.get("checkin")
            news_frac = live.get("news")
            checkin_done = (
                isinstance(checkin, (list, tuple))
                and len(checkin) == 2
                and int(checkin[0]) >= int(checkin[1])
                and int(checkin[1]) > 0
            )
            if isinstance(checkin, (list, tuple)) and len(checkin) == 2:
                self.log(f"[7/8] Mobile check-in — live {checkin[0]}/{checkin[1]}.")
            else:
                self.log("[7/8] Mobile check-in — counter not readable, will try.")

            if checkin_done:
                self.log("[7/8] Mobile check-in — already complete, skipping.")
                self._session_counts["checkins"] += 1
                self.daily_set.mark_checkin_as_completed()
                self._report(
                    "Check-in",
                    True,
                    f"{checkin[0]}/{checkin[1]} already complete",
                )
            elif not self._stop_event.is_set():
                ok = tasks.daily_checkin(self._driver, stop_event=self._stop_event)
                live_after = tasks.read_live_app_progress(
                    self._driver, stop_event=self._stop_event
                )
                after = live_after.get("checkin") or checkin
                done_now = (
                    isinstance(after, (list, tuple))
                    and len(after) == 2
                    and int(after[0]) >= int(after[1])
                    and int(after[1]) > 0
                )
                if done_now:
                    self._session_counts["checkins"] += 1
                    self.daily_set.mark_checkin_as_completed()
                    self.log("[7/8] Mobile check-in — complete on dashboard.")
                    self._report("Check-in", True, f"{after[0]}/{after[1]}")
                else:
                    self.log(
                        "[7/8] Mobile check-in — still incomplete on dashboard "
                        f"(live {after}). Not marking done."
                    )
                    self._report(
                        "Check-in",
                        "skip",
                        "Bing mobile app only — web tile does not open a page",
                    )
                try:
                    self.daily_set.save_live_snapshot(
                        {
                            "checkin": (
                                after if isinstance(after, (list, tuple)) else [0, 1]
                            )
                        }
                    )
                except Exception:
                    pass
                self._notify_progress()

            news_done = (
                isinstance(news_frac, (list, tuple))
                and len(news_frac) == 2
                and int(news_frac[1]) > 0
                and int(news_frac[0]) >= int(news_frac[1])
            )
            news_offered = (
                isinstance(news_frac, (list, tuple))
                and len(news_frac) == 2
                and int(news_frac[1]) > 0
            )
            if not news_offered:
                self.log(
                    "[8/8] News — no read-to-earn counter on this account. "
                    "The news quiz lives under More activities. Skipping."
                )
                self._report("News", "skip", "not offered (quiz is a More activity)")
            elif news_done:
                self.log(
                    f"[8/8] News — already complete on phone client "
                    f"({news_frac[0]}/{news_frac[1]}), skipping."
                )
                self._session_counts["news"] += 1
                self.daily_set.mark_news_as_completed()
                self._report(
                    "News", True, f"{news_frac[0]}/{news_frac[1]} already complete"
                )
            elif not self._stop_event.is_set():
                self.log(
                    "[8/8] News — Bing phone client (Colombia). "
                    "PC dashboard does not show this; the app does."
                )
                ok = tasks.read_news(self._driver, stop_event=self._stop_event)
                news_after = tasks.news_progress(self._driver)
                try:
                    self.daily_set.save_live_snapshot(
                        {"news": [news_after[0], news_after[1] or 30]}
                    )
                except Exception:
                    pass
                if ok:
                    self._session_counts["news"] += 1
                    self.daily_set.mark_news_as_completed()
                    self.log(
                        f"[8/8] News — credited on phone client "
                        f"({news_after[0]}/{news_after[1] or 30})."
                    )
                    self._report(
                        "News",
                        True,
                        f"{news_after[0]}/{news_after[1] or 30}",
                    )
                else:
                    self.log("[8/8] News — did not credit. Not marking done.")
                    self._report(
                        "News",
                        False,
                        f"no credit ({news_after[0]}/{news_after[1] or 30})",
                    )
                self._notify_progress()

            if not self._stop_event.is_set() and not checkin_done:
                ok = tasks.bing_app_streak(self._driver, stop_event=self._stop_event)
                if ok:
                    self.log("Bing app streak session finished.")
                    self._report("Bing app streak", True, "phone session finished")
                else:
                    self.log("[WARNING] Bing app streak session did not finish.")
                    self._report("Bing app streak", False, "did not finish")

            try:
                self._capture_rewards_profile(self._driver)
            except Exception:
                pass
        finally:
            self._quit_driver()

    def _run_edge_browse_if_needed(self):
        """Finish leftover Edge-browsing minutes in a real foreground Edge."""
        if self.daily_set is None or self.driver_manager is None:
            return
        minutes = int(getattr(self.daily_set, "edge_minutes_remaining", 0) or 0)
        if minutes <= 0:
            live = getattr(self.daily_set, "live_progress", {}) or {}
            edge = live.get("edge")
            if isinstance(edge, (list, tuple)) and len(edge) == 2:
                minutes = max(0, int(edge[1]) - int(edge[0]))
        if minutes <= 0:
            self._report("Edge browsing", "skip", "already 30/30 or not listed")
            return
        self.log(
            f"[6/8] Edge browsing — real Edge window for leftover {minutes} min "
            "(foreground; relaunch if stuck at 5/30)."
        )
        self._driver = None
        try:
            self.driver_manager.close_running_edge(settle=False)
        except Exception:
            pass
        from .dailytasks.new_dashboard import run_native_edge_streak

        try:
            run_native_edge_streak(
                self.log, self._stop_event, minutes, self.driver_manager
            )
            self._session_counts["edge_minutes"] += minutes
            self._report("Edge browsing", True, f"ran leftover {minutes} min")
        except Exception as e:
            self.log(f"[WARNING] Edge browsing streak failed: {e}")
            self._report("Edge browsing", False, str(e)[:120])
        finally:
            try:
                self.driver_manager.close_running_edge(settle=False)
            except Exception:
                pass

    def _build_queries(self, count):
        """
        Build the list of queries for a phase.

        When LLM generation is enabled and an API key is set, ask the chosen
        provider for `count` fresh queries in the user's language. Any failure
        (no key, invalid key, quota, offline, malformed answer) or a shortfall
        is transparently topped up / replaced with a random sample from the
        static assets/queries.json, so the daily search target is still met and
        the run never depends on the network.

        Args:
            count (int): how many queries to produce.

        Returns:
            list: up to `count` query strings (empty only if the static file is
            missing).
        """
        if count <= 0:
            return []

        queries = []
        cfg = self.global_settings.get_llm_config()
        if cfg["use_llm_queries"]:
            provider = cfg.get("llm_provider", "openai")
            base_url = cfg.get("llm_base_url", "")
            has_creds = bool(cfg.get("llm_api_key")) or (
                provider == "openai-compatible" and bool(base_url)
            )
            if has_creds:
                locale = resolve_search_locale(
                    self.global_settings.get_settings(), self.log
                )
                self.log(
                    f"Generating {count} queries via LLM " f"({provider}, {locale})…"
                )
                queries = llm.generate_queries(
                    count,
                    locale,
                    provider=provider,
                    model=cfg["llm_model"],
                    api_key=cfg["llm_api_key"],
                    base_url=base_url,
                    logger=self.log,
                )
                if not queries:
                    self.log(
                        "[WARNING] LLM generation failed — "
                        "falling back to static queries."
                    )
            else:
                self.log(
                    "[WARNING] LLM enabled but no API key/base URL set — "
                    "using static queries."
                )

        if len(queries) >= count:
            return queries[:count]

        # Top up from the static file, skipping any query the LLM already
        # produced. Request extra headroom so de-dup can't leave us short.
        static = self.search_engine.load_queries_from_json(
            JSON_FILE_PATH, num_needed=count + len(queries)
        )

        if not queries:
            from .utils import humanize_queries

            return humanize_queries(static)

        seen = set(queries)
        extra = [q for q in static if q not in seen][: count - len(queries)]
        self.log(
            f"LLM returned {len(queries)}/{count} queries — "
            f"topped up with {len(extra)} static queries."
        )
        return queries + extra

    def _run_visual_search_if_needed(self):
        """
        Controls the visual search process.

        Checks if the task is needed today, generates a unique image,
        performs the search, and updates the status after successful completion.

        A day already marked as done is skipped, unless the "Force visual
        search" setting is on — the saved status can be stale (a search that
        was credited but is worth redoing, or a status file the user doesn't
        trust), and that toggle is how the user says so.

        Returns:
            bool: True if visual search was performed, False otherwise.
        """
        if self.daily_set is None or self.search_engine is None:
            return False

        force = (
            not self._visual_search_attempted
            and self.global_settings.get_force_tasks()["force_visual_search"]
        )
        already_done = not self.daily_set.should_perform_visual_search()
        listed = bool(
            getattr(self.daily_set, "visual_search_url", None)
            or (getattr(self.daily_set, "live_progress", None) or {}).get("hasVisual")
        )

        if already_done and not force:
            self.log("[5/8] Visual Search — already complete today, skipping.")
            self._report("Visual Search", "skip", "already complete today")
            return False
        if not listed and not force:
            self.log("[5/8] Visual Search — not listed on today's dashboard, skipping.")
            self._report("Visual Search", "skip", "not listed today")
            return False

        if already_done:
            self.log(
                "[5/8] Visual Search — marked done, running anyway "
                "(Force visual search is ON)."
            )
        else:
            self.log("[5/8] Visual Search — not complete, running.")

        self._visual_search_attempted = True

        used_images = self.daily_set.get_used_visual_search_images()

        image_id, updated_images = self.search_engine.get_next_image_id(used_images)

        image_path = self.search_engine.prepare_unique_image(image_id)

        if image_path is None:
            return False

        try:
            if not getattr(self.daily_set, "visual_search_url", None):
                try:
                    self.daily_set.prepare_visual_search(self._driver)
                except Exception as e:
                    self.log(
                        f"[WARNING] Could not load the visual search mission link: {e}"
                    )

            success = self.search_engine.perform_visual_search(
                self._driver,
                image_path,
                stop_event=self._stop_event,
                entry_url=getattr(self.daily_set, "visual_search_url", None),
            )

            if not success:
                self._report("Visual Search", False, "upload/search failed")
                return False

            self.daily_set.save_used_visual_search_images(updated_images)

            # A results page is not proof of credit: Rewards only counts the
            # search for its "visual search streak" mission. Re-read that
            # mission's progress and, when it says the search didn't count,
            # leave today unmarked so the next run tries again.
            credited = self._check_visual_search_credited()
            if credited is False:
                other = self.search_engine.other_surface_url()
                if other and not self._stop_event.is_set():
                    self.log(
                        f"Rewards did not count the visual search; "
                        f"trying {other} instead."
                    )
                    retry_ok = self.search_engine.perform_visual_search(
                        self._driver,
                        image_path,
                        stop_event=self._stop_event,
                        entry_url=getattr(self.daily_set, "visual_search_url", None),
                        search_url=other,
                    )
                    if retry_ok:
                        credited = self._check_visual_search_credited()

            if credited is False:
                self.log(
                    "[WARNING] Rewards did not count the visual search. "
                    "Not marked as done for today."
                )
                return False

            self.daily_set.mark_visual_search_as_completed()
            self._session_counts["visual"] += 1
            self.log("Visual search marked as done for today.")
            self._report("Visual Search", True, "credited")

            return True

        except Exception as e:
            self.log(f"[WARNING] Visual search failed: {e}")
            if self.history is not None:
                self.history.add_activity("Visual search: image", "[ERROR] Failed")
            return False

        finally:
            if os.path.exists(image_path):
                try:
                    os.remove(image_path)
                except Exception as e:
                    self.log(f"[WARNING] Failed to remove temporary image file: {e}")

    def _check_visual_search_credited(self):
        """
        Check the Rewards "visual search streak" mission after a search.

        Returns:
            bool: True when the mission counted the search, False when it
                explicitly still shows no activity today, or None when there
                is nothing to compare against (legacy dashboard, mission not
                offered, or the progress couldn't be read).
        """
        try:
            progress = self.daily_set.read_visual_search_progress(self._driver)
        except Exception as e:
            self.log(f"[WARNING] Could not read the visual search mission: {e}")
            return None

        if progress is None:
            return None

        done, total = progress
        before = getattr(self.daily_set, "visual_search_progress", None)
        was = f" (was {before[0]}/{before[1]})" if before else ""
        self.log(f"Rewards visual search streak: {done}/{total}{was}")

        return done > 0

    def _run_phase(
        self, mobile, count, do_daily_set, search_delay_range=DEFAULT_SEARCH_DELAY
    ):
        """
        Open a driver for a single phase (PC or Mobile), do `count` searches,
        optionally run the Daily Set, then quit.

        Args:
            mobile (bool): whether this is the Mobile phase (True) or PC phase (False)
            count (int): how many searches to perform in this phase
            do_daily_set (bool): whether to run the Daily Set after searches (PC phase only)
            search_delay_range (tuple): min/max delay range in seconds for each search
        """
        label = "Mobile" if mobile else "PC"
        if mobile:
            self.log(
                f"=== {label} phase — Bing phone client, {count} "
                f"{'queries' if count != 1 else 'query'} (not desktop) ==="
            )
        else:
            self.log(
                f"=== {label} phase — {count} "
                f"{'queries' if count != 1 else 'query'} ==="
            )

        queries_to_search = self._build_queries(count)
        if not queries_to_search:
            self.log(f"[WARNING] {label}: no queries available. Skipping phase.")
            if self.history is not None:
                self.history.add_to_history(
                    "N/A", f"[ERROR] {label}: no queries available"
                )
            return

        try:
            self._driver = self.driver_manager.setup_driver(
                mobile=mobile, bing_app=bool(mobile), stop_event=self._stop_event
            )
        except Exception:
            if self._stop_event.is_set():
                self.log("Stopped.")
                return
            raise
        if self._stop_event.is_set():
            self._quit_driver()
            return
        try:
            bucket = "mobile" if mobile else "pc"

            def _on_search(_n):
                self._session_counts[bucket] += 1
                self._notify_progress()

            done = self.search_engine.perform_searches(
                self._driver,
                queries_to_search,
                mobile=mobile,
                stop_event=self._stop_event,
                on_success=_on_search,
                search_delay_range=search_delay_range,
            )
            self._report(
                f"Search: {'Mobile' if mobile else 'PC'}",
                True if int(done or 0) > 0 else False,
                f"{int(done or 0)}/{count}"
                + (" · Bing phone client" if mobile else ""),
            )
            if not self._check_driver_alive():
                return

            ran_daily_set = False

            # Only the PC phase runs the Daily Set, and a day already marked as
            # done is skipped unless "Force daily tasks" is on.
            daily_done = False
            force_daily = False
            if do_daily_set and self.daily_set is not None:
                daily_done = not self.daily_set.should_perform_daily_set()
                force_daily = (
                    not self._daily_set_attempted
                    and self.global_settings.get_force_tasks()["force_daily_tasks"]
                )

            if (
                do_daily_set
                and self.daily_set is not None
                and not self._stop_event.is_set()
                and (not daily_done or force_daily)
            ):
                if daily_done:
                    self.log(
                        "Daily Set already marked as done today, but running "
                        "anyway (Force daily tasks is ON)."
                    )
                else:
                    self.log(
                        "Daily Set not completed today. Starting Daily Set tasks..."
                    )
                human = HumanBehavior(
                    self._driver,
                    show_cursor=True,
                    mobile=mobile,
                    stop_event=self._stop_event,
                )
                success = self.daily_set.perform_daily_set(
                    self._driver, human, stop_event=self._stop_event
                )
                ran_daily_set = True
                self._daily_set_attempted = True
                # Record cards + scrape the balance while still on the rewards
                # dashboard, before the Stop check can short-circuit.
                totals = self.daily_set.last_totals
                self._session_counts["cards"] += totals.get("newly", 0)
                self._session_counts["earn"] += totals.get("earn", 0)
                self._session_counts["quests"] += totals.get("quests", 0)
                self._notify_progress()
                try:
                    live = getattr(self.daily_set, "live_progress", {}) or {}
                    self.daily_set.save_live_snapshot(live)
                except Exception:
                    pass
                self._try_scrape_balance()
                if not self._stop_event.is_set():
                    if success:
                        self.daily_set.mark_as_completed()
                        self.log(
                            "Daily Set tasks completed and marked as done for today."
                        )
                    else:
                        self.log("Daily Set failed. Not marked as done for today.")

            elif daily_done and not self._stop_event.is_set():
                self.log(
                    "Daily Set already completed today. Skipping. "
                    "(Enable 'Force daily tasks' in Settings to run it anyway.)"
                )

            # Visual search runs only in PC phase,
            # do_daily_set=False in Mobile phase.
            if do_daily_set and not self._stop_event.is_set():
                self._run_visual_search_if_needed()

            # When the Daily Set didn't run (mobile phase, or already done
            # today) the rewards counter on the current Bing SERP is still a
            # usable fallback source for the balance.
            if not ran_daily_set and not self._stop_event.is_set():
                self._try_scrape_balance()

        finally:
            self._quit_driver()
