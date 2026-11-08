"""Repair GUI files after legacy updaters that replace only the main exe."""

import base64
import hashlib
import os
import sys
import tempfile
from io import BytesIO
from pathlib import PurePosixPath
from zipfile import ZipFile

from .config import GUI_DIR

try:
    from .gui_bundle_data import GUI_BUNDLE_B64  # type: ignore[import-not-found]
except ImportError:
    GUI_BUNDLE_B64 = ""


def repair_bundled_gui():
    """Restore bundled GUI files if an older updater left stale assets behind."""
    if not getattr(sys, "frozen", False) or not GUI_BUNDLE_B64:
        return 0

    target_root = os.path.abspath(GUI_DIR)
    updated = 0
    archive_bytes = base64.b64decode(GUI_BUNDLE_B64)
    with ZipFile(BytesIO(archive_bytes)) as archive:
        for entry in archive.infolist():
            if entry.is_dir():
                continue
            relative = PurePosixPath(entry.filename)
            if relative.is_absolute() or ".." in relative.parts:
                raise ValueError(f"Unsafe bundled GUI path: {entry.filename}")

            target = os.path.abspath(os.path.join(target_root, *relative.parts))
            if os.path.normcase(
                os.path.commonpath([target_root, target])
            ) != os.path.normcase(target_root):
                raise ValueError(f"Unsafe bundled GUI path: {entry.filename}")

            content = archive.read(entry)
            try:
                with open(target, "rb") as current_file:
                    current_hash = hashlib.sha256(current_file.read()).digest()
                if current_hash == hashlib.sha256(content).digest():
                    continue
            except OSError:
                pass

            os.makedirs(os.path.dirname(target), exist_ok=True)
            handle, temporary_path = tempfile.mkstemp(
                prefix=".gui-update-", dir=os.path.dirname(target)
            )
            try:
                with os.fdopen(handle, "wb") as output:
                    output.write(content)
                os.replace(temporary_path, target)
                updated += 1
            finally:
                if os.path.exists(temporary_path):
                    os.remove(temporary_path)

    return updated
