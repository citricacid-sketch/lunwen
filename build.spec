# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for 论文整改工具"""

import sys
from pathlib import Path

_PROJECT = Path(SPECPATH)
_FRONTEND_DIST = _PROJECT / "frontend" / "dist"
_BACKEND = _PROJECT / "backend"

# Verify frontend is built
if not (_FRONTEND_DIST / "index.html").exists():
    print("ERROR: frontend/dist not found. Run: cd frontend && npm run build")
    sys.exit(1)

a = Analysis(
    [str(_BACKEND / "run.py")],
    pathex=[str(_BACKEND)],
    binaries=[],
    datas=[
        (str(_FRONTEND_DIST / "index.html"), "."),
        (str(_FRONTEND_DIST / "assets"), "assets"),
    ],
    hiddenimports=[
        "app",
        "app.main",
        "app.config",
        "app.config_store",
        "app.api",
        "app.api.rewrite",
        "app.api.er_diagram",
        "app.api.config",
        "app.api.utils",
        "app.api.auth",
        "app.models",
        "app.models.rewrite",
        "app.models.er_diagram",
        "app.prompts",
        "app.prompts.rewrite",
        "app.prompts.diagram",
        "app.services",
        "app.services.rewrite_service",
        "app.services.er_diagram_service",
        "app.services.config_service",
        "app.services.llm",
        "app.services.llm.base",
        "app.services.llm.openai_impl",
        "app.agents",
        "app.agents.base",
        "app.agents.orchestrator",
        "app.agents.rewrite_agent",
        "app.agents.review_agent",
        "app.auth",
        "app.auth.dependencies",
        "app.auth.jwt",
        "app.auth.password",
        "app.db",
        "app.db.models",
        "app.db.session",
        "app.preprocessing",
        "app.preprocessing.citation_guard",
        "app.preprocessing.forbidden_words",
        "app.preprocessing.pipeline",
        "app.preprocessing.sentence_splitter",
        "app.rag",
        "app.rag.chunker",
        "app.rag.document_loader",
        "app.rag.embedder",
        "app.rag.manager",
        "app.rag.retriever",
        "app.rag.vector_store",
        "app.middleware",
        "app.middleware.rate_limit",
        "fitz",
        "lxml",
        "openai",
        "slowapi",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "tkinter",
        "matplotlib",
        "numpy",
        "pandas",
        "PIL",
        "cv2",
        "scipy",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="论文整改工具",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
