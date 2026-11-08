"""
Main entry point for the AutoRewarder application.

By default this script launches the desktop GUI (pywebview). When invoked
with the `--headless` flag — typically by the OS-level autostart entry
that the "Start with Windows/Linux" toggle installs — it delegates to
`AutoRewarder_CLI.main()`, which drives scheduled runs for every enabled
account without bringing up a window.

Usage:
    # GUI:
    python AutoRewarder.py

    # Headless / scheduled:
    python AutoRewarder.py --headless [--account <id-or-label>]
"""

import argparse
import os
import sys
import threading
import traceback
from datetime import datetime

_SINGLE_INSTANCE_HANDLE = None
_SINGLE_INSTANCE_MUTEX = "Local\\AutoRewarder.GUI.SingleInstance"
_WINDOW_TITLE = "AutoRewarder"


def _boot_log(message):
    try:
        folder = os.path.join(os.environ.get("LOCALAPPDATA", "."), "AutoRewarder")
        os.makedirs(folder, exist_ok=True)
        with open(os.path.join(folder, "boot.log"), "a", encoding="utf-8") as fh:
            fh.write(f"{datetime.now().isoformat(timespec='seconds')} {message}\n")
    except Exception:
        pass


def _install_crash_log():
    def hook(exc_type, exc, tb):
        _boot_log("crash " + "".join(traceback.format_exception(exc_type, exc, tb)))

    sys.excepthook = hook

    def thread_hook(args):
        hook(args.exc_type, args.exc_value, args.exc_traceback)

    threading.excepthook = thread_hook


def _show_existing_window():
    """Restore and focus the already-running desktop window on Windows."""
    if sys.platform != "win32":
        return False
    try:
        import ctypes
        from ctypes import wintypes

        user32 = ctypes.WinDLL("user32", use_last_error=True)
        user32.FindWindowW.restype = wintypes.HWND
        hwnd = user32.FindWindowW(None, _WINDOW_TITLE)
        if not hwnd:
            return False
        user32.ShowWindow(hwnd, 9)  # SW_RESTORE, including windows hidden to tray.
        user32.BringWindowToTop(hwnd)
        user32.SetForegroundWindow(hwnd)
        return True
    except Exception as exc:
        _boot_log(f"single-instance focus failed: {exc}")
        return False


def _acquire_gui_instance():
    """Return False when another GUI instance owns the named Windows mutex."""
    global _SINGLE_INSTANCE_HANDLE
    if sys.platform != "win32":
        return True
    try:
        import ctypes
        from ctypes import wintypes

        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.CreateMutexW.argtypes = [
            wintypes.LPVOID,
            wintypes.BOOL,
            wintypes.LPCWSTR,
        ]
        kernel32.CreateMutexW.restype = wintypes.HANDLE
        kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
        handle = kernel32.CreateMutexW(None, False, _SINGLE_INSTANCE_MUTEX)
        if not handle:
            _boot_log(f"single-instance mutex failed: {ctypes.get_last_error()}")
            return True
        if ctypes.get_last_error() == 183:  # ERROR_ALREADY_EXISTS
            kernel32.CloseHandle(handle)
            _show_existing_window()
            return False
        _SINGLE_INSTANCE_HANDLE = handle
        return True
    except Exception as exc:
        _boot_log(f"single-instance guard failed: {exc}")
        return True


if __name__ == "__main__":
    try:
        if sys.stdout and hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if sys.stderr and hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    _install_crash_log()
    _boot_log("launch " + " ".join(sys.argv))
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument(
        "--headless", action="store_true", help="Run in headless/background mode"
    )
    parser.add_argument(
        "--from-login",
        action="store_true",
        help="Launched by Windows sign-in: run leftover tasks, then quit",
    )
    args, _ = parser.parse_known_args()

    # Scheduled and sign-in launches must never create a GUI window. The old
    # --from-login path opened pywebview first and only then started the run,
    # which stole focus from whatever the user was doing. Both background
    # entry points use the same headless runner now; the remaining arguments
    # (e.g. --account, --pc, --mobile) stay available to its parser.
    if args.headless or args.from_login:
        for flag in ("--headless", "--from-login"):
            if flag in sys.argv:
                sys.argv.remove(flag)

        from AutoRewarder_CLI import main as headless_main

        headless_main()
        sys.exit(0)

    if not _acquire_gui_instance():
        sys.exit(0)

    try:
        from src.gui_assets import repair_bundled_gui

        repaired = repair_bundled_gui()
        if repaired:
            _boot_log(f"repaired {repaired} bundled GUI files")
    except Exception as exc:
        _boot_log(f"GUI resource repair failed: {exc}")

    # GUI path — import webview + the API lazily so the headless path doesn't
    # pay for the pywebview import cost.
    import webview

    from src.api import AutoRewarderAPI
    from src.config import GUI_DIR, ASSETS_DIR

    api = AutoRewarderAPI()
    if args.from_login:
        api.enable_login_autorun()
    window = webview.create_window(
        title=_WINDOW_TITLE,
        url=os.path.join(GUI_DIR, "index.html"),
        js_api=api,
        width=680,
        height=840,
        resizable=False,
        background_color="#0b0d12",
        text_select=True,
    )
    api.set_window(window)  # pass window reference to AutoRewarderAPI for logging

    # Secondary windows (History, Statistics) are independent pywebview windows.
    # pywebview keeps the process alive as long as ANY window is open, so once
    # the main window is genuinely closed — the X with close-to-tray off, or
    # "Exit" from the tray — we must tear the others down too, otherwise they
    # stay on screen and the app never actually quits. The `closed` event only
    # fires on a real close (the tray "hide" path returns from `closing`
    # without closing), so this is the right hook.
    def _destroy_secondary_windows(*_args):
        try:
            api.close_secondary_windows()
        except Exception as e:
            print(f"[WARNING] Could not close child windows: {e}")
        for other in list(webview.windows):
            if other is not window:
                try:
                    other.destroy()
                except Exception as e:
                    print(f"[WARNING] Could not close secondary window: {e}")
        try:
            api.shutdown()
        except Exception as e:
            print(f"[WARNING] Shutdown: {e}")

    if window is not None:
        window.events.closed += _destroy_secondary_windows

    # User-controlled: when False, the X button quits the app normally and
    # we don't install the tray at all. Read once at startup — flipping the
    # toggle in Settings takes effect on next launch (consistent with how
    # hide_browser and autostart are persisted).
    close_to_tray = api.get_close_to_tray()

    allow_exit = {"value": False}

    def _install_tray(app_window):
        try:
            import pystray  # type: ignore
            from PIL import Image
        except Exception as e:
            print(f"[WARNING] Tray disabled: {e}")
            return None

        def on_closing():
            if allow_exit["value"]:
                return True
            # X means stop: don't leave Edge browsing after the window is gone.
            try:
                api.stop()
            except Exception:
                pass
            try:
                if getattr(api, "driver_manager", None) is not None:
                    api.driver_manager.kill_now(wait=False)
            except Exception:
                pass
            try:
                from src.emulator.driver import DriverManager

                DriverManager.kill_all_autorewarder_edge(wait=False)
            except Exception:
                pass
            try:
                app_window.hide()
            except Exception:
                pass
            return False

        def on_show(icon, item):
            try:
                app_window.show()
            except Exception:
                pass

        def on_exit(icon, item):
            allow_exit["value"] = True
            try:
                api.shutdown()
            except Exception:
                pass
            try:
                icon.stop()
            except Exception:
                pass
            try:
                app_window.destroy()
            except Exception:
                pass

        try:
            with Image.open(os.path.join(ASSETS_DIR, "icon.ico")) as img:
                image = img.copy()
        except Exception:
            image = Image.new("RGB", (64, 64), (0, 0, 0))

        menu = pystray.Menu(
            pystray.MenuItem("Open", on_show, default=True),
            pystray.MenuItem("Exit", on_exit),
        )
        icon = pystray.Icon("AutoRewarder", image, "AutoRewarder", menu)
        app_window.events.closing += on_closing
        icon.run_detached()
        return icon

    # Install the tray for its side effects (closing handler + detached icon
    # thread). The returned icon keeps itself alive via run_detached(), so we
    # don't need to hold a reference here.
    if close_to_tray and not args.from_login:
        _install_tray(window)
    webview.start(icon=os.path.join(ASSETS_DIR, "icon.ico"))

    # Ensure all Edge processes are killed when the application exits normally
    try:
        api.shutdown()
    except Exception as e:
        _boot_log(f"shutdown error: {e}")
