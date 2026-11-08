"""Shared utility helpers for AutoRewarder."""

import re
import time
import random
import requests
import os
import tempfile
import sys
import zipfile

from .config import GITHUB_VERSION, REPO


def _github_is_newer(latest, current):
    """
    True when the GitHub release tag is a newer *release* than this build.

    Local builds use 4.2.<time> (e.g. 4.2.9:58PM) while GitHub tags are v4.2.
    Compare only major.minor so a custom 4.2.x build does not nag about v4.2.
    """

    def _pair(value):
        text = str(value or "").strip().lstrip("vV")
        match = re.match(r"(\d+)\.(\d+)", text)
        if not match:
            return (0, 0)
        return (int(match.group(1)), int(match.group(2)))

    return _pair(latest) > _pair(current)


def release_is_newer(latest, current):
    """Compare major, minor, and patch numbers from release tags."""

    def _version(value):
        numbers = re.findall(r"\d+", str(value or ""))
        return tuple(int(item) for item in numbers[:3]) + (0,) * (3 - len(numbers[:3]))

    return _version(latest) > _version(current)


def github_latest_release(repo, logger=None):
    """Return the latest public GitHub release metadata for ``repo``."""
    try:
        response = requests.get(
            f"https://api.github.com/repos/{repo}/releases/latest",
            headers={
                "User-Agent": "AutoRewarder-App",
                "Accept": "application/vnd.github+json",
            },
            timeout=8,
        )
        if response.status_code != 200:
            if logger:
                logger(
                    f"[WARNING] GitHub update check failed for {repo}: {response.status_code}"
                )
            return None
        data = response.json()
        tag = str(data.get("tag_name") or "").strip()
        if not tag:
            return None
        assets = data.get("assets") or []
        downloadable = [
            item
            for item in assets
            if str(item.get("name") or "")
            .lower()
            .endswith((".exe", ".msi", ".zip", ".apk"))
            and "updater" not in str(item.get("name") or "").lower()
        ]
        portable = is_portable_install()
        if str(repo).casefold() == REPO.casefold():
            # Use archives for the app's Windows releases so the updater copies
            # straight over the folder that is currently running.
            if portable:
                portable_assets = [
                    item
                    for item in downloadable
                    if "portable" in str(item.get("name") or "").lower()
                ]
                asset = next(
                    (
                        item
                        for item in portable_assets
                        if str(item.get("name") or "").lower().endswith(".exe")
                    ),
                    next(
                        (
                            item
                            for item in portable_assets
                            if str(item.get("name") or "").lower().endswith(".zip")
                        ),
                        None,
                    ),
                )
            else:
                asset = next(
                    (
                        item
                        for item in downloadable
                        if "windows" in str(item.get("name") or "").lower()
                        and "portable" not in str(item.get("name") or "").lower()
                        and str(item.get("name") or "").lower().endswith(".zip")
                    ),
                    None,
                )
                if asset is None:
                    asset = next(
                        (
                            item
                            for item in downloadable
                            if "portable" not in str(item.get("name") or "").lower()
                            and any(
                                token in str(item.get("name") or "").lower()
                                for token in ("setup", "installer")
                            )
                        ),
                        downloadable[0] if downloadable else None,
                    )
        elif portable:
            asset = next(
                (
                    item
                    for item in downloadable
                    if "portable" in str(item.get("name") or "").lower()
                ),
                downloadable[0] if downloadable else None,
            )
        else:
            asset = next(
                (
                    item
                    for item in downloadable
                    if any(
                        tok in str(item.get("name") or "").lower()
                        for tok in ("setup", "installer", "windows")
                    )
                    and "portable" not in str(item.get("name") or "").lower()
                ),
                next(
                    (
                        item
                        for item in downloadable
                        if "portable" not in str(item.get("name") or "").lower()
                    ),
                    downloadable[0] if downloadable else None,
                ),
            )
        return {
            "repo": repo,
            "tag": tag,
            "name": data.get("name") or tag,
            "url": data.get("html_url") or f"https://github.com/{repo}/releases/latest",
            "download_url": (asset or {}).get("browser_download_url")
            or data.get("html_url"),
            "asset_name": (asset or {}).get("name") or "",
        }
    except Exception as exc:
        if logger:
            logger(f"[WARNING] Could not check GitHub release {repo}: {exc}")
        return None


def download_release_asset(url, asset_name, logger=None, progress=None):
    """Download a GitHub release package into a private temporary folder."""
    safe_name = os.path.basename(str(asset_name or "")).strip()
    if not safe_name or not safe_name.lower().endswith((".exe", ".zip")):
        raise ValueError("La release no contiene un paquete .exe o .zip compatible.")
    if not str(url or "").startswith("https://github.com/"):
        raise ValueError("La URL de actualización no pertenece a GitHub.")

    folder = tempfile.mkdtemp(prefix="AutoRewarder-update-")
    target = os.path.join(folder, safe_name)
    try:
        response = requests.get(
            url,
            headers={
                "User-Agent": "AutoRewarder-App",
                "Accept": "application/octet-stream",
            },
            stream=True,
            timeout=(15, 120),
        )
        response.raise_for_status()
        total = int(response.headers.get("content-length") or 0)
        downloaded = 0
        with open(target, "wb") as output:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    output.write(chunk)
                    downloaded += len(chunk)
                    if progress:
                        progress(downloaded, total)
        if os.path.getsize(target) < 1024 * 1024:
            raise ValueError("El instalador descargado parece incompleto.")
        return target
    except Exception:
        try:
            if os.path.exists(target):
                os.remove(target)
            os.rmdir(folder)
        except OSError:
            pass
        raise


def is_portable_install():
    """Return whether the running frozen app stores data beside its executable."""
    if not getattr(sys, "frozen", False):
        return False
    return os.path.isdir(os.path.join(os.path.dirname(sys.executable), "config"))


def extract_release_package(package_path):
    """Extract a ZIP release and return its temporary root directory."""
    if not package_path.lower().endswith(".zip"):
        return os.path.dirname(package_path)
    root = tempfile.mkdtemp(prefix="AutoRewarder-release-")
    with zipfile.ZipFile(package_path) as archive:
        archive.extractall(root)
    return root


def find_release_file(root, suffix):
    """Find the first release file with the requested suffix."""
    for current, _dirs, files in os.walk(root):
        for name in files:
            if name.lower().endswith(suffix.lower()):
                return os.path.join(current, name)
    return ""


def wait_or_stop(seconds, stop_event=None):
    """
    Sleep up to `seconds`. Return True immediately if Stop was requested.

    threading.Event.wait is used so a Stop click never sits behind a coffee
    break, news dwell, or Edge-streak interval.
    """
    try:
        seconds = float(seconds)
    except (TypeError, ValueError):
        seconds = 0.0
    if seconds < 0:
        seconds = 0.0
    if stop_event is None:
        if seconds:
            time.sleep(seconds)
        return False
    try:
        if stop_event.is_set():
            return True
        if seconds <= 0:
            return False
        return bool(stop_event.wait(timeout=seconds))
    except Exception:
        if seconds:
            time.sleep(seconds)
        return bool(stop_event.is_set())


def human_typing(element, text, stop_event=None):
    """
    Simulate human-like typing by sending keys to a web element with random delays.

    Args:
        element: The web element to send keys to.
        text: The text to type into the element.
        stop_event: Optional Event; typing aborts as soon as Stop is set.
    """

    for char in text:
        if stop_event is not None and stop_event.is_set():
            return
        element.send_keys(char)
        if wait_or_stop(random.uniform(0.05, 0.18), stop_event):
            return


def humanize_queries(queries):
    """
    Substitute character by keyboard distance to simulate human typing errors.

    Args:
        queries (list): A list of query strings.
    Returns:
        humanized_queries (list): Modified query strings with simulated typing errors.
    """
    import nlpaug.augmenter.char as nac  # type: ignore

    mod = nac.KeyboardAug(
        # 100% probability because the 20% overall chance
        # handled outside by the `random` module
        aug_char_p=1.0,
        aug_word_p=1.0,
        # Only one typo per query
        aug_char_max=1,
        aug_word_max=1,
        # Ignore short words
        min_char=4,
        include_upper_case=False,
        include_special_char=False,
        include_numeric=True,
    )

    humanized_queries = []

    for query in queries:
        if random.random() < 0.2:
            modified_query = mod.augment(query)
            typo_query = (
                modified_query[0]
                if isinstance(modified_query, list)
                else modified_query
            )
            humanized_queries.append(typo_query)
        else:
            humanized_queries.append(query)

    return humanized_queries


def check_for_updates(logger=None):
    """
    Check GitHub API for the latest release and compare it to the current version.

    Args:
        logger (callable, optional): A function to log messages. Defaults to None.

    Returns:
        tuple: (is_update_available (bool), latest_version (str or None))
    """
    try:
        headers = {"User-Agent": "AutoRewarder-App"}

        response = requests.get(
            f"https://api.github.com/repos/{REPO}/releases/latest",
            headers=headers,
            timeout=5,
        )
        if response.status_code == 200:
            latest = response.json().get("tag_name")
            if latest:
                return _github_is_newer(latest, GITHUB_VERSION), latest
        elif response.status_code == 429:
            if logger:
                logger("[WARNING] GitHub API rate limit reached (429).")
                logger("Try again later or check manually for updates.")
        elif response.status_code == 403:

            is_rate_limit = response.headers.get("X-Ratelimit-Remaining") == "0"

            if logger:
                if is_rate_limit:
                    logger(
                        "[WARNING] GitHub API rate limit exceeded (403). Try again later."
                    )
                else:
                    logger(
                        "[WARNING] GitHub access forbidden (403). Check your VPN or connection."
                    )
        else:
            if logger:
                logger(
                    f"[WARNING] GitHub update check failed. Status: {response.status_code}"
                )

    except requests.exceptions.RequestException as e:
        if logger:
            logger(f"[WARNING] Network error while checking for updates: {e}")
    except Exception as e:
        if logger:
            logger(f"[ERROR] Unexpected error while checking for updates: {e}")

    return False, None
