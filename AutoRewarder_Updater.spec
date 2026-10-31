# -*- mode: python ; coding: utf-8 -*-
"""Small standalone updater window shipped beside both PC executables."""

a = Analysis(
    ['AutoRewarder_Updater.py'],
    pathex=[],
    binaries=[],
    datas=[('gui', 'gui'), ('assets', 'assets')],
    hiddenimports=['src.utils', 'requests', 'PIL', 'PIL.Image', 'pystray', 'pystray._win32'],
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
    name='AutoRewarder-Updater',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['assets\\icon.ico'],
)
