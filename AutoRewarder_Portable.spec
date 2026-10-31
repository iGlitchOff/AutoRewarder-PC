# -*- mode: python ; coding: utf-8 -*-
"""One-file portable build; keeps the local mobile/QR imports from the main spec."""

import os
import sys
from PyInstaller.utils.hooks import collect_data_files, copy_metadata

is_windows = sys.platform == 'win32'
app_icon = os.path.join('assets', 'icon.ico') if is_windows else os.path.join('assets', 'icon.png')

hidden_imports = [
    'selenium.webdriver.edge.webdriver',
    'pystray',
    'PIL',
    'PIL.Image',
    'src.phone_bridge',
    'src.tunnel',
    'src.qr_png',
    'src.apk_update',
    'qrcode',
]
if is_windows:
    hidden_imports.append('pystray._win32')
else:
    hidden_imports += ['PySide6', 'gi']

extra_metadata = []
for pkg in ('gdown', 'nlpaug'):
    try:
        extra_metadata += copy_metadata(pkg)
    except Exception:
        pass

a = Analysis(
    ['AutoRewarder.py'],
    pathex=[],
    binaries=[],
    datas=[('gui', 'gui'), ('assets', 'assets'), ('LICENSE', '.'), ('NOTICE', '.')]
        + collect_data_files('nlpaug')
        + extra_metadata,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

a.datas = [x for x in a.datas if not (x[0].startswith('assets/screenshots') or x[0].startswith('assets\\screenshots'))]

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='AutoRewarder-Portable',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=[app_icon],
)
