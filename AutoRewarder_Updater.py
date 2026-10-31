"""External updater process for AutoRewarder.

This executable is intentionally separate from the main application. It keeps
the update screen alive while the old process exits, replaces files in the
existing installation, and starts the same executable again when finished.
"""

import argparse
import ctypes
import os
import shutil
import subprocess
import threading
import time

import webview

from src.config import GUI_DIR, ASSETS_DIR
from src.utils import (
    download_release_asset,
    extract_release_package,
    find_release_file,
)


def _process_is_running(pid):
    if pid <= 0:
        return False
    if os.name != "nt":
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False
    handle = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)
    if not handle:
        return False
    try:
        exit_code = ctypes.c_ulong()
        if not ctypes.windll.kernel32.GetExitCodeProcess(
            handle, ctypes.byref(exit_code)
        ):
            return False
        return exit_code.value == 259  # STILL_ACTIVE
    finally:
        ctypes.windll.kernel32.CloseHandle(handle)


class UpdaterAPI:
    def __init__(self, args):
        self.args = args
        self.window = None
        self.started = False
        self.can_close = False
        self.icon = None

    def abort(self):
        self.can_close = True
        if self.icon:
            try:
                self.icon.stop()
            except Exception:
                pass
        if self.window:
            try:
                self.window.destroy()
            except Exception:
                pass
        os._exit(0)

    def get_settings(self):
        return {"ui_locale": self.args.language or "en"}

    def start_update(self):
        if self.started or getattr(self, "_started", False):
            return {"ok": True}
        self.started = True
        self._started = True
        threading.Thread(target=self._run, daemon=True, name="update-worker").start()
        return {"ok": True}

    def retry(self):
        self.started = False
        self._started = False
        return self.start_update()

    def _on_download_progress(self, downloaded, total):
        if total and total > 0:
            fraction = downloaded / total
            detail = f"{downloaded / 1048576:.1f} MB / {total / 1048576:.1f} MB ({int(fraction * 100)}%)"
            self._progress("downloading", fraction, detail)
        else:
            self._progress("downloading", None)

    def _progress(self, stage, value=None, detail=None):
        if not self.window:
            return
        try:
            self.window.evaluate_js(
                "update_progress(%r, %r, %r)" % (stage, value, detail)
            )
        except Exception:
            pass

    def _run(self):
        package = ""
        root = ""
        try:
            self._progress("closing", 0.02)
            deadline = time.time() + 30
            while _process_is_running(self.args.parent_pid) and time.time() < deadline:
                time.sleep(0.15)

            self._progress("downloading", 0.0)
            package = download_release_asset(
                self.args.url,
                self.args.asset,
                progress=self._on_download_progress,
            )

            target = os.path.abspath(self.args.target)
            target_dir = os.path.dirname(target)

            # If the downloaded asset is an executable, use it directly.
            if package.lower().endswith(".exe"):
                source = package
            else:
                root = extract_release_package(package)
                self._progress("installing", 0.2)
                target_name = os.path.basename(target)
                if target_name.lower() == "autorewarder-portable.exe":
                    source = find_release_file(root, "AutoRewarder-Portable.exe")
                    if not source:
                        source = find_release_file(root, "AutoRewarder_v*Portable.exe")
                    if not source:
                        raise ValueError(
                            "The portable package does not contain AutoRewarder-Portable.exe."
                        )
                else:
                    source = find_release_file(root, "AutoRewarder.exe")
                    if not source:
                        raise ValueError(
                            "The package does not contain AutoRewarder.exe."
                        )

            self._progress("replacing", 0.55)
            source_base = os.path.basename(source).lower()
            for attempt in range(6):
                try:
                    if (
                        source_base.endswith(".exe")
                        and os.path.isfile(source)
                        and any(tok in source_base for tok in ("setup", "installer"))
                    ):
                        self._progress("installing", 0.6)
                        subprocess.run(
                            [
                                source,
                                "/VERYSILENT",
                                "/SUPPRESSMSGBOXES",
                                "/NORESTART",
                                "/CLOSEAPPLICATIONS",
                                f"/DIR={target_dir}",
                            ],
                            check=True,
                        )
                    elif source.lower().endswith(".exe") and os.path.isfile(source):
                        shutil.copy2(source, target)
                    else:
                        source_dir = os.path.dirname(source)
                        shutil.copytree(
                            source_dir,
                            target_dir,
                            dirs_exist_ok=True,
                            ignore=lambda current, names: (
                                {"AutoRewarder-Updater.exe"}
                                if os.path.abspath(current)
                                == os.path.abspath(source_dir)
                                else set()
                            ),
                        )
                    break
                except (PermissionError, OSError):
                    if attempt == 5:
                        raise
                    try:
                        subprocess.run(
                            ["taskkill", "/F", "/IM", "AutoRewarder.exe", "/T"],
                            stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL,
                            timeout=3,
                            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                        )
                    except Exception:
                        pass
                    time.sleep(0.7)

            self._progress("cleaning", 0.86)
            time.sleep(0.35)
            self._progress("finished", 1.0)
            time.sleep(0.65)
            subprocess.Popen([target], cwd=target_dir, close_fds=True)
            self.can_close = True
            if self.icon:
                self.icon.stop()
            self.window.destroy()
        except Exception as exc:
            self._progress("error", 0, str(exc))
            return
        finally:
            for path in (package, root):
                if not path:
                    continue
                try:
                    if os.path.isdir(path):
                        shutil.rmtree(path, ignore_errors=True)
                    elif os.path.isfile(path):
                        os.remove(path)
                except OSError:
                    pass


def _install_updater_tray(api):
    try:
        import pystray  # type: ignore[import-untyped]
        from PIL import Image

        def on_exit(icon, item):
            api.abort()

        try:
            with Image.open(os.path.join(ASSETS_DIR, "icon.ico")) as img:
                image = img.copy()
        except Exception:
            image = Image.new("RGB", (64, 64), (0, 0, 0))

        menu = pystray.Menu(pystray.MenuItem("Exit Updater", on_exit))
        icon = pystray.Icon("AutoRewarderUpdater", image, "AutoRewarder Updater", menu)
        api.icon = icon
        icon.run_detached()
    except Exception as e:
        print(f"[WARNING] Updater tray disabled: {e}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--asset", required=True)
    parser.add_argument("--parent-pid", type=int, required=True)
    parser.add_argument("--language", default="en")
    parser.add_argument("--target", required=True)
    args = parser.parse_args()
    api = UpdaterAPI(args)
    window = webview.create_window(
        "",
        os.path.join(GUI_DIR, "updater.html"),
        js_api=api,
        width=440,
        height=380,
        resizable=False,
        frameless=True,
        easy_drag=False,
        on_top=True,
        shadow=False,
        transparent=False,
        background_color="#0b0d12",
    )
    api.window = window
    _install_updater_tray(api)
    window.events.closing += lambda *_args: not api.can_close
    webview.start()


if __name__ == "__main__":
    main()
