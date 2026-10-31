"""Publish the phone APK onto the PC so the companion can self-update.

Flow:
  GitHub release (optional) → this PC → phone bridge /update → phone installer
  or a local APK we just built → same server → phone
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import urllib.request

from .config import APP_DIR, BASE_DIR

PHONE_VERSION_CODE = 54
PHONE_VERSION_NAME = "4.4.1"
MOBILE_REPO = "iGlitchOn/AutoRewarder-Mobile"


def updates_dir():
    path = os.path.join(APP_DIR, "updates")
    os.makedirs(path, exist_ok=True)
    return path


def apk_path():
    return os.path.join(updates_dir(), "AutoRewarder.apk")


def manifest_path():
    return os.path.join(updates_dir(), "manifest.json")


def read_manifest():
    path = manifest_path()
    if not os.path.isfile(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def write_manifest(extra=None):
    data = {
        "versionCode": PHONE_VERSION_CODE,
        "versionName": PHONE_VERSION_NAME,
        "size": os.path.getsize(apk_path()) if os.path.isfile(apk_path()) else 0,
    }
    if extra:
        data.update(extra)
    with open(manifest_path(), "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)
    return data


def _candidates():
    exe_dir = ""
    if getattr(sys, "frozen", False):
        exe_dir = os.path.dirname(sys.executable)
    desktop = os.path.join(os.path.expanduser("~"), "Desktop", "AutoRewarder.apk")
    return [
        os.path.join(updates_dir(), "AutoRewarder.apk"),
        os.path.join(exe_dir, "AutoRewarder.apk") if exe_dir else "",
        desktop,
        os.path.join(
            BASE_DIR,
            "android",
            "app",
            "build",
            "outputs",
            "apk",
            "release",
            "app-release.apk",
        ),
    ]


def publish_local():
    """Copy the newest local APK into APP_DIR/updates for the phone to download."""
    dest = apk_path()
    best = None
    best_mtime = -1.0
    for path in _candidates():
        if not path or not os.path.isfile(path):
            continue
        try:
            mtime = os.path.getmtime(path)
        except OSError:
            continue
        if mtime > best_mtime:
            best = path
            best_mtime = mtime
    if not best:
        return read_manifest()
    try:
        if os.path.abspath(best) != os.path.abspath(dest):
            shutil.copy2(best, dest)
            print(f"Phone APK published from {best}")
    except OSError as e:
        print(f"[WARNING] Could not publish phone APK: {e}")
        return read_manifest()
    return write_manifest({"source": best})


def fetch_github():
    """If a GitHub release has an .apk, pull it onto this PC (then the phone gets it from us)."""
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN") or ""
    repo = os.environ.get("AR_MOBILE_GITHUB_REPO") or MOBILE_REPO
    url = f"https://api.github.com/repos/{repo}/releases/latest"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "AutoRewarder", "Accept": "application/vnd.github+json"},
    )
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[INFO] GitHub phone APK skip: {e}")
        return None
    assets = data.get("assets") if isinstance(data, dict) else None
    if not isinstance(assets, list):
        return None
    apk = None
    for asset in assets:
        name = str(asset.get("name") or "").lower()
        if name.endswith(".apk"):
            apk = asset
            break
    if not apk or not apk.get("browser_download_url"):
        return None
    dest = apk_path()
    try:
        req2 = urllib.request.Request(
            apk["browser_download_url"],
            headers={
                "User-Agent": "AutoRewarder",
                "Accept": "application/octet-stream",
            },
        )
        if token:
            req2.add_header("Authorization", "Bearer " + token)
        with urllib.request.urlopen(req2, timeout=60) as resp, open(dest, "wb") as out:
            shutil.copyfileobj(resp, out)
        print(f"Phone APK downloaded from GitHub {repo} ({apk.get('name')})")
        return write_manifest({"source": "github:" + repo, "tag": data.get("tag_name")})
    except Exception as e:
        print(f"[WARNING] GitHub APK download failed: {e}")
        return None


def publish():
    info = publish_local()
    threading_fetch = True
    if threading_fetch:
        import threading

        threading.Thread(target=fetch_github, daemon=True, name="github-apk").start()
    return info


def update_payload():
    info = read_manifest()
    if not os.path.isfile(apk_path()):
        info = publish_local()
    return {
        "ok": True,
        "versionCode": int(info.get("versionCode") or PHONE_VERSION_CODE),
        "versionName": str(info.get("versionName") or PHONE_VERSION_NAME),
        "size": int(info.get("size") or 0),
        "apk": "/update/apk",
    }
