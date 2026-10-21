"""Edge WebDriver setup for per-account profiles."""

import os
import platform
import socket
import subprocess
import time

from selenium import webdriver
from selenium.webdriver.edge.options import Options
from selenium.webdriver.edge.service import Service

from ..config import APP_DIR


_CLOSED_BROWSER_NEEDLES = (
    "no such window",
    "target frame detached",
    "web view not found",
    "chrome not reachable",
    "disconnected",
    "invalid session id",
    "session deleted",
    "not connected to devtools",
    "unable to connect",
    "connection refused",
    "maxretryerror",
    "forcibly closed",
)

_CLOSED_BROWSER_EXC_NAMES = (
    "nosuchwindowexception",
    "invalidsessionidexception",
    "maxretryerror",
    "newconnectionerror",
    "connectionrefusederror",
    "connectionreseterror",
    "protocolerror",
)


def is_browser_closed_error(exc: Exception) -> bool:
    """Return True if *exc* indicates the browser window or WebDriver session was closed."""
    if exc is None:
        return False
    cls_name = exc.__class__.__name__.lower()
    if any(name in cls_name for name in _CLOSED_BROWSER_EXC_NAMES):
        return True
    msg = str(exc).lower()
    return any(needle in msg for needle in _CLOSED_BROWSER_NEEDLES)


class DriverManager:
    """
    Manages the Selenium WebDriver for MS Edge.

    Each DriverManager instance is bound to a specific Edge --user-data-dir
    (i.e. one account). Switching account = rebuilding this manager with a
    different profile_path.
    """

    is_browser_closed_error = staticmethod(is_browser_closed_error)

    def __init__(self, profile_path=None, hide_browser=False):
        """
        Args:
            profile_path (str | None): Absolute path to the Selenium --user-data-dir
                directory. None when no account is selected (empty state). In that
                case setup_driver will raise, since there is nothing to launch.
            hide_browser (bool): Whether to run the browser in headless mode.
        """
        self.profile_path = profile_path
        self.hide_browser = hide_browser
        self._active_driver = None
        self._driver_pids = set()
        self._native_pids = []
        self._killing = False

    @property
    def user_data_dir(self):
        return self.profile_path

    @user_data_dir.setter
    def user_data_dir(self, value):
        self.profile_path = value

    def _register_driver(self, driver):
        """Record the active WebDriver instance and its service process PID."""
        self._active_driver = driver
        if driver is None:
            return
        try:
            service = getattr(driver, "service", None)
            process = getattr(service, "process", None)
            pid = getattr(process, "pid", None)
            if pid:
                self._driver_pids.add(int(pid))
        except Exception:
            pass

    @staticmethod
    def _edge_version():
        """Installed Edge version folder, e.g. 152.0.4191.66."""
        binary = DriverManager.edge_binary()
        parent = os.path.dirname(binary) if binary else ""
        if not parent or not os.path.isdir(parent):
            return ""
        versions = []
        try:
            for name in os.listdir(parent):
                if (
                    name
                    and name[0].isdigit()
                    and os.path.isdir(os.path.join(parent, name))
                ):
                    versions.append(name)
        except OSError:
            return ""
        versions.sort()
        return versions[-1] if versions else ""

    def _msedgedriver_path(self):
        """Prefer the cached msedgedriver that matches this Edge build."""
        cache = os.path.join(
            os.path.expanduser("~"), ".cache", "selenium", "msedgedriver", "win64"
        )
        ver = self._edge_version()
        if ver:
            exact = os.path.join(cache, ver, "msedgedriver.exe")
            if os.path.isfile(exact):
                return exact
            prefix = ".".join(ver.split(".")[:3])
            try:
                names = sorted(n for n in os.listdir(cache) if n.startswith(prefix))
            except OSError:
                names = []
            for name in reversed(names):
                path = os.path.join(cache, name, "msedgedriver.exe")
                if os.path.isfile(path):
                    return path
        return None

    def _edge_service(self, verbose=False):
        kwargs = {}
        path = self._msedgedriver_path()
        if path:
            kwargs["executable_path"] = path
        if verbose:
            try:
                kwargs["log_output"] = os.path.join(APP_DIR, "msedgedriver.log")
                kwargs["service_args"] = ["--verbose"]
            except Exception:
                pass
        service = Service(**kwargs)
        if platform.system() == "Windows":
            no_window = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
            try:
                service.creation_flags = no_window
            except Exception:
                pass
        return service

    @staticmethod
    def _session_died(err):
        msg = str(err).lower()
        return any(
            needle in msg
            for needle in (
                "chrome instance exited",
                "devtoolsactiveport",
                "user data directory is already in use",
                "microsoft edge failed to start",
                "msedge failed to start",
                "exited normally",
                "chrome not reachable",
            )
        )

    @staticmethod
    def _wait_debug_port(port, timeout=10, stop_event=None):
        deadline = time.time() + timeout
        while time.time() < deadline:
            if stop_event is not None and stop_event.is_set():
                return False
            sock = socket.socket()
            sock.settimeout(0.3)
            try:
                sock.connect(("127.0.0.1", int(port)))
                return True
            except OSError:
                time.sleep(0.2)
            finally:
                try:
                    sock.close()
                except OSError:
                    pass
        return False

    @staticmethod
    def _foreground_window():
        """Return the current foreground HWND on Windows, if available."""
        if platform.system() != "Windows":
            return 0
        try:
            import ctypes

            return int(ctypes.windll.user32.GetForegroundWindow())
        except Exception:
            return 0

    @staticmethod
    def _restore_foreground_if_edge(previous_hwnd):
        """Return focus when a newly-created Edge window activated itself."""
        if platform.system() != "Windows" or not previous_hwnd:
            return
        try:
            import ctypes

            user32 = ctypes.windll.user32
            kernel32 = ctypes.windll.kernel32
            current_hwnd = int(user32.GetForegroundWindow())
            if not current_hwnd or current_hwnd == int(previous_hwnd):
                return

            owner_pid = ctypes.c_ulong()
            user32.GetWindowThreadProcessId(
                ctypes.c_void_p(current_hwnd), ctypes.byref(owner_pid)
            )
            process = kernel32.OpenProcess(0x1000, False, owner_pid.value)
            if not process:
                return
            try:
                size = ctypes.c_ulong(1024)
                buffer = ctypes.create_unicode_buffer(size.value)
                if not kernel32.QueryFullProcessImageNameW(
                    process, 0, buffer, ctypes.byref(size)
                ):
                    return
                if os.path.basename(buffer.value).lower() != "msedge.exe":
                    return
            finally:
                kernel32.CloseHandle(process)

            # The app launched Edge, so Windows permits returning to the exact
            # window that was active before the automation started. Attach the
            # caller briefly to the foreground thread because Windows may
            # otherwise reject SetForegroundWindow after Edge activates.
            current_thread = int(kernel32.GetCurrentThreadId())
            foreground_thread = int(
                user32.GetWindowThreadProcessId(ctypes.c_void_p(current_hwnd), None)
            )
            attached = bool(
                foreground_thread
                and foreground_thread != current_thread
                and user32.AttachThreadInput(foreground_thread, current_thread, True)
            )
            try:
                user32.SetForegroundWindow(ctypes.c_void_p(int(previous_hwnd)))
                user32.BringWindowToTop(ctypes.c_void_p(int(previous_hwnd)))
                # SetForegroundWindow can report success while Edge keeps the
                # foreground lock. SwitchToThisWindow is the reliable fallback
                # for returning focus after a child browser process starts.
                try:
                    user32.SwitchToThisWindow(ctypes.c_void_p(int(previous_hwnd)), True)
                except Exception:
                    pass
            finally:
                if attached:
                    user32.AttachThreadInput(foreground_thread, current_thread, False)
        except Exception:
            pass

    def _attach_fallback(self, hide=False, stop_event=None):
        """Launch a real Edge with a debug port and attach Selenium to it."""
        if stop_event is not None and stop_event.is_set():
            raise RuntimeError("Run stopped before browser launch")
        port = self.debug_port()
        _proc, port = self.start_native_edge(
            "about:blank", port=port, stop_event=stop_event, hide=hide
        )
        if not self._wait_debug_port(port, timeout=12, stop_event=stop_event):
            if stop_event is not None and stop_event.is_set():
                raise RuntimeError("Run stopped before browser launch")
            raise RuntimeError(
                f"Edge opened but debug port {port} never accepted connections"
            )
        return self.attach_to_edge(port)

    # Realistic iPhone UA so Microsoft Rewards credits the searches as mobile.
    MOBILE_USER_AGENT = (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 "
        "Mobile/15E148 Safari/604.1"
    )
    # Bing iOS app UA. Check-in and read-to-earn news only credit when the
    # request looks like the BingSapphire client, not Safari.
    BING_APP_USER_AGENT = (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 "
        "BingSapphire/1.0.410309301"
    )
    MOBILE_WINDOW_SIZE = "412,915"
    DESKTOP_WINDOW_SIZE = "1920,1080"

    def setup_driver(
        self,
        headless=None,
        disable_identity=False,
        mobile=False,
        bing_app=False,
        stop_event=None,
        is_mobile=False,
        background=False,
    ):
        """
        Set up the Selenium WebDriver for MS Edge using this manager's profile.

        Args:
            headless: Headless override. Falls back to self.hide_browser.
            disable_identity: When True, add Edge/Chromium flags that disable
                the Windows-account-based auto sign-in. Used during First
                Setup so a second MSA can actually log in.
            mobile: When True, launch Edge with an iPhone user agent and a
                mobile-sized viewport so Rewards credits the searches as
                mobile. When False, use the desktop viewport.
            bing_app: When True, use the Bing iOS app (BingSapphire) user
                agent instead of Safari. Required for mobile check-in and
                read-to-earn news. Implies mobile=True.
            stop_event: Optional threading.Event to abort browser launch
                immediately when a run is stopped.
            is_mobile: Alias for mobile.
            background: When True, use true Chromium headless mode (--headless=new)
                for silent background scrapes so no window or taskbar icon appears.

        Returns:
            webdriver.Edge: The configured WebDriver instance.

        Raises:
            RuntimeError: If profile_path is None (no account selected) or if
                stop_event is set before/during launch.
        """
        if stop_event is not None and stop_event.is_set():
            raise RuntimeError("Run stopped before browser launch")

        if not self.profile_path:
            raise RuntimeError(
                "No account selected: cannot start the browser. "
                "Create or select an account first."
            )

        if headless is None:
            headless = self.hide_browser
        if background:
            headless = True
        mobile = bool(mobile or is_mobile)

        previous_foreground = self._foreground_window()

        os.makedirs(self.profile_path, exist_ok=True)
        # A forced app close can leave msedge.exe alive with this account's
        # profile. Chromium rejects a second process using the same profile,
        # then Selenium reports the misleading DevToolsActivePort error.
        # Edge 133+ also relaunches itself (compat layer): the first process
        # exits, a second window stays open, and Selenium reports
        # "session not created: Chrome instance exited".
        self.close_running_edge()
        self._clear_profile_locks()
        if stop_event is not None and stop_event.is_set():
            raise RuntimeError("Run stopped before browser launch")
        time.sleep(0.4)

        def build_options(recovery_mode=False):
            options = Options()
            binary = self.edge_binary()
            if binary and os.path.isfile(binary):
                options.binary_location = binary
            options.add_argument(f"--user-data-dir={self.profile_path}")
            options.add_argument("--profile-directory=Default")
            options.add_argument("--disable-blink-features=AutomationControlled")
            options.add_argument("--no-default-browser-check")
            options.add_argument("--no-first-run")
            options.add_argument("--disable-extensions")
            options.add_argument("--remote-allow-origins=*")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            # Stop Edge from spawning a second process and exiting the first.
            options.add_argument("--edge-skip-compat-layer-relaunch")
            options.add_argument("--autorewarder-session")
            options.add_argument(
                "--disable-features=msEdgeStartupBoost,msEdgeSleepingTabs"
            )
            options.add_experimental_option("excludeSwitches", ["enable-automation"])

            use_mobile = bool(mobile or bing_app)
            mobile_ua = self.BING_APP_USER_AGENT if bing_app else self.MOBILE_USER_AGENT
            if use_mobile:
                options.add_argument(f"--user-agent={mobile_ua}")
                window_size = self.MOBILE_WINDOW_SIZE
            else:
                window_size = self.DESKTOP_WINDOW_SIZE
            options.add_argument(f"--window-size={window_size}")

            if disable_identity:
                options.add_argument(
                    "--disable-features=msImplicitSignin,AadSsoUrlInterceptionEnabled,"
                    "WebOtpBackendAuto,IdentityConsistency,msIdentityWebSignIn,"
                    "msEdgeIdentitySyncInterception"
                )
                options.add_argument("--disable-sync")

            if background:
                options.add_argument("--headless=new")
                options.add_argument("--disable-gpu")
                options.add_argument("--window-position=-32000,-32000")
            elif headless:
                # Off-screen window, not --headless=new. Chromium headless
                # often skips painting the Next.js /earn cards, so quizzes
                # and puzzles never appear. An off-screen GPU window still
                # hydrates and can credit Rewards.
                options.add_argument("--window-position=-32000,-32000")

            if recovery_mode:
                options.add_argument("--disable-gpu")
                options.add_argument("--disable-software-rasterizer")
            return options

        last_err = None
        _driver = None
        max_attempts = 1 if background else 3
        for attempt in range(max_attempts):
            if stop_event is not None and stop_event.is_set():
                raise RuntimeError("Run stopped before browser launch")
            service = None
            try:
                service = self._edge_service(verbose=attempt == 2)
                _driver = webdriver.Edge(
                    service=service,
                    options=build_options(recovery_mode=attempt > 0),
                )
                self._register_driver(_driver)
                last_err = None
                break
            except Exception as err:
                last_err = err
                try:
                    proc = getattr(service, "process", None)
                    if proc and getattr(proc, "pid", None):
                        self._driver_pids.add(int(proc.pid))
                except Exception:
                    pass
                if stop_event is not None and stop_event.is_set():
                    self.kill_now(wait=True)
                    raise
                self.close_running_edge(settle=False)
                self._clear_profile_locks()
                if not background and self._session_died(err):
                    if stop_event is not None and stop_event.is_set():
                        self.kill_now(wait=True)
                        raise
                    try:
                        _driver = self._attach_fallback(
                            hide=headless, stop_event=stop_event
                        )
                        self._register_driver(_driver)
                        last_err = None
                        break
                    except Exception as attach_err:
                        last_err = attach_err
                        if stop_event is not None and stop_event.is_set():
                            self.kill_now(wait=True)
                            raise
                        self.close_running_edge(settle=False)
                        self._clear_profile_locks()
                if attempt + 1 >= max_attempts:
                    break
                delay = 1.2 + attempt
                if stop_event is not None:
                    if stop_event.wait(delay):
                        self.kill_now(wait=True)
                        raise RuntimeError("Run stopped before browser launch")
                else:
                    time.sleep(delay)
        if _driver is None:
            raise last_err

        if headless:
            self._restore_foreground_if_edge(previous_foreground)

        use_mobile = bool(mobile or bing_app)
        mobile_ua = self.BING_APP_USER_AGENT if bing_app else self.MOBILE_USER_AGENT
        if use_mobile:
            # Turn the session into a genuine mobile one at the engine level.
            # Beyond the UA string, this makes `navigator.maxTouchPoints > 0`,
            # `window.matchMedia("(pointer: coarse)")` true, the viewport match
            # iPhone metrics, and touch events fire for real — so sites that
            # fingerprint using the DOM/CSS touch surface see a real mobile.
            try:
                _driver.execute_cdp_cmd(
                    "Emulation.setTouchEmulationEnabled",
                    {"enabled": True, "maxTouchPoints": 5},
                )
                _driver.execute_cdp_cmd(
                    "Emulation.setEmitTouchEventsForMouse",
                    {"enabled": True, "configuration": "mobile"},
                )
                _driver.execute_cdp_cmd(
                    "Emulation.setDeviceMetricsOverride",
                    {
                        "width": 412,
                        "height": 915,
                        "deviceScaleFactor": 3,
                        "mobile": True,
                    },
                )
                _driver.execute_cdp_cmd(
                    "Emulation.setUserAgentOverride",
                    {
                        "userAgent": mobile_ua,
                        "platform": "iPhone",
                        "userAgentMetadata": {
                            "platform": "iOS",
                            "platformVersion": "17.2.1",
                            "architecture": "",
                            "model": "iPhone",
                            "mobile": True,
                        },
                    },
                )
            except Exception:
                # CDP is best-effort; fall back to the UA+window-size flags.
                pass
            if bing_app:
                # Phone Bing app in Colombia: news / check-in / read-to-earn
                # are served for es-CO, not the US desktop dashboard.
                try:
                    _driver.execute_cdp_cmd(
                        "Emulation.setLocaleOverride", {"locale": "es-CO"}
                    )
                    _driver.execute_cdp_cmd(
                        "Emulation.setTimezoneOverride",
                        {"timezoneId": "America/Bogota"},
                    )
                    _driver.execute_cdp_cmd(
                        "Emulation.setGeolocationOverride",
                        {
                            "latitude": 4.711,
                            "longitude": -74.0721,
                            "accuracy": 100,
                        },
                    )
                except Exception:
                    pass

        try:
            _driver.set_page_load_timeout(20)
            _driver.set_script_timeout(20)
        except Exception:
            pass
        return _driver

    def _clear_profile_locks(self):
        """Drop Chromium singleton lock files left by a killed Edge process."""
        if not self.profile_path:
            return
        for name in (
            "SingletonLock",
            "SingletonSocket",
            "SingletonCookie",
            "DevToolsActivePort",
        ):
            path = os.path.join(self.profile_path, name)
            try:
                os.remove(path)
            except OSError:
                pass

    # CREATE_NO_WINDOW | CREATE_BREAKAWAY_FROM_JOB | CREATE_NEW_PROCESS_GROUP
    # Breakaway matters: if AutoRewarder exits, the killer must outlive it.
    _KILL_FLAGS = 0x08000000 | 0x01000000 | 0x00000200

    @staticmethod
    def _edge_kill_powershell(profile=None, all_accounts=False):
        needles = [
            "--autorewarder-session",
        ]
        if profile:
            needles.insert(0, profile)
        if all_accounts:
            needles.append("EdgeProfile")
        lines = [
            "$needles = @("
            + ", ".join("'" + n.replace("'", "''") + "'" for n in needles)
            + ")",
            "Get-Process msedgedriver -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue",
            "Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" -ErrorAction SilentlyContinue |",
            "  Where-Object {",
            "    $cl = $_.CommandLine; if (-not $cl) { return $false }",
            "    foreach ($n in $needles) { if ($cl -like ('*' + $n + '*')) { return $true } }",
            "    return $false",
            "  } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
        ]
        return "\n".join(lines)

    def _run_kill(self, args, wait=True, timeout=8):
        flags = self._KILL_FLAGS
        try:
            if wait:
                subprocess.run(
                    args,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=timeout,
                    creationflags=flags,
                )
            else:
                subprocess.Popen(
                    args,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    creationflags=flags,
                )
        except Exception:
            pass

    def _collect_and_clear_tracked_pids(self):
        """Return all tracked driver and native Edge PIDs and reset tracking state."""
        pids = set()
        active = getattr(self, "_active_driver", None)
        self._active_driver = None
        if active is not None:
            try:
                service = getattr(active, "service", None)
                proc = getattr(service, "process", None)
                pid = getattr(proc, "pid", None)
                if pid:
                    pids.add(int(pid))
            except Exception:
                pass
        for pid in list(getattr(self, "_driver_pids", ()) or ()):
            try:
                pids.add(int(pid))
            except Exception:
                pass
        try:
            self._driver_pids.clear()
        except Exception:
            self._driver_pids = set()
        for pid in list(getattr(self, "_native_pids", ()) or ()):
            try:
                pids.add(int(pid))
            except Exception:
                pass
        self._native_pids = []
        return pids

    def kill_now(self, wait=True):
        """
        Kill WebDriver and this profile's Edge, including the real foreground
        Edge used for the 30-minute streak.

        Defaults to wait=True so kills complete synchronously and never race
        with a subsequent setup_driver() call for the next phase.
        """
        self._killing = True
        try:
            pids = self._collect_and_clear_tracked_pids()
            if platform.system() == "Windows":
                for pid in pids:
                    self._run_kill(
                        ["taskkill", "/F", "/PID", str(pid), "/T"],
                        wait=wait,
                        timeout=3,
                    )
                self._run_kill(
                    ["taskkill", "/F", "/IM", "msedgedriver.exe", "/T"],
                    wait=wait,
                    timeout=3,
                )
                profile = ""
                if self.profile_path:
                    profile = os.path.abspath(self.profile_path)
                command = self._edge_kill_powershell(profile=profile)
                self._run_kill(
                    [
                        "powershell.exe",
                        "-NoProfile",
                        "-NonInteractive",
                        "-Command",
                        command,
                    ],
                    wait=wait,
                    timeout=8,
                )
            self._clear_profile_locks()
        finally:
            self._killing = False

    @classmethod
    def kill_all_autorewarder_edge(cls, wait=True):
        """Kill every Edge bound to AutoRewarder account profiles."""
        if platform.system() != "Windows":
            return
        flags = cls._KILL_FLAGS
        args_list = [
            ["taskkill", "/F", "/IM", "msedgedriver.exe", "/T"],
            [
                "powershell.exe",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                cls._edge_kill_powershell(all_accounts=True),
            ],
        ]
        for args in args_list:
            try:
                if wait:
                    subprocess.run(
                        args,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        timeout=8,
                        creationflags=flags,
                    )
                else:
                    subprocess.Popen(
                        args,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        creationflags=flags,
                    )
            except Exception:
                pass

    def close_running_edge(self, settle=True):
        """Close orphaned Edge / WebDriver processes for this account."""
        pids = self._collect_and_clear_tracked_pids()
        if platform.system() != "Windows":
            return 0

        flags = 0x08000000
        for pid in pids:
            try:
                subprocess.run(
                    ["taskkill", "/F", "/PID", str(pid), "/T"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=3,
                    creationflags=flags,
                )
            except Exception:
                pass

        try:
            subprocess.run(
                ["taskkill", "/F", "/IM", "msedgedriver.exe", "/T"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=3,
                creationflags=flags,
            )
        except Exception:
            pass

        if self.profile_path:
            profile = os.path.abspath(self.profile_path)
            command = self._edge_kill_powershell(profile=profile)
            try:
                subprocess.run(
                    [
                        "powershell.exe",
                        "-NoProfile",
                        "-NonInteractive",
                        "-Command",
                        command,
                    ],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=8,
                    creationflags=flags,
                )
            except Exception:
                pass
        self._clear_profile_locks()
        if settle:
            time.sleep(0.35)
        return 0

    @staticmethod
    def edge_binary():
        for path in (
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"),
        ):
            if os.path.isfile(path):
                return path
        return "msedge"

    def debug_port(self):
        seed = os.path.abspath(self.profile_path or "edge")
        return 19222 + (abs(hash(seed)) % 700)

    def start_native_edge(self, url, port=None, stop_event=None, hide=False):
        """
        Launch a real (non-WebDriver) Edge on this account profile with a
        debug port so we can attach. When ``hide`` is enabled, keep its
        window off-screen and request a non-activating show state so the
        streak cannot take focus.
        """
        from ..utils import wait_or_stop

        if not self.profile_path:
            raise RuntimeError("No account selected: cannot start Edge.")
        previous_foreground = self._foreground_window()
        port = int(port or self.debug_port())
        self.close_running_edge()
        self._clear_profile_locks()
        if wait_or_stop(0.4, stop_event):
            raise RuntimeError("stopped")
        os.makedirs(self.profile_path, exist_ok=True)
        args = [
            self.edge_binary(),
            f"--user-data-dir={self.profile_path}",
            "--profile-directory=Default",
            "--no-first-run",
            "--no-default-browser-check",
            "--edge-skip-compat-layer-relaunch",
            "--autorewarder-session",
            "--disable-features=msEdgeStartupBoost,msEdgeSleepingTabs",
            "--disable-background-mode",
            f"--remote-debugging-port={port}",
            "--remote-allow-origins=*",
        ]
        if hide:
            args.append("--window-position=-32000,-32000")
            args.append("--window-size=1280,800")
        else:
            args.append("--start-maximized")
        args.append(url or "https://www.bing.com/?form=EDGNTC")
        creationflags = 0
        startupinfo = None
        if platform.system() == "Windows":
            # CREATE_NEW_PROCESS_GROUP keeps the browser independent from the
            # GUI process. SW_SHOWNOACTIVATE prevents Windows from activating
            # the new Edge window while it is being created.
            creationflags = 0x00000200
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            startupinfo.wShowWindow = 4
        proc = subprocess.Popen(
            args,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=creationflags,
            startupinfo=startupinfo,
        )
        try:
            self._native_pids.append(proc.pid)
        except Exception:
            pass
        if wait_or_stop(1.5, stop_event):
            try:
                proc.kill()
            except Exception:
                pass
            raise RuntimeError("stopped")
        # Edge may create its real top-level window slightly after the debug
        # port becomes available. Retry briefly so a late activation cannot
        # leave the user's desktop focused on the automation window.
        for _ in range(8):
            self._restore_foreground_if_edge(previous_foreground)
            if self._foreground_window() == previous_foreground:
                break
            time.sleep(0.25)
        return proc, port

    def attach_to_edge(self, port):
        """Attach Selenium to an already-running native Edge debug port."""
        options = Options()
        binary = self.edge_binary()
        if binary and os.path.isfile(binary):
            options.binary_location = binary
        options.add_experimental_option("debuggerAddress", f"127.0.0.1:{int(port)}")
        options.add_argument("--edge-skip-compat-layer-relaunch")
        driver = webdriver.Edge(service=self._edge_service(), options=options)
        self._register_driver(driver)
        return driver
