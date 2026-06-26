import sys
import os
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.middleware.rate_limit import limiter
from app.api.auth import router as auth_router
from app.api.rewrite import router as rewrite_router
from app.api.er_diagram import router as er_diagram_router
from app.api.config import router as config_router
from app.api.utils import router as utils_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if getattr(sys, 'frozen', False):
    _BASE = Path(sys._MEIPASS)
else:
    _BASE = Path(__file__).parent.parent.parent / "frontend" / "dist"

STATIC_DIR = _BASE / "assets"
INDEX_HTML = _BASE / "index.html"


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up, initializing database...")
    try:
        from app.db import init_db
        await init_db()
        logger.info("Database tables ready")
    except Exception as e:
        logger.warning(f"DB init skipped (will retry on first request): {e}")
    yield


app = FastAPI(title="智能学术写作平台", version="1.0.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

# Auth routes (no version prefix)
app.include_router(auth_router, prefix="/api")

# Core API routes
app.include_router(config_router, prefix="/api")
app.include_router(rewrite_router, prefix="/api")
app.include_router(er_diagram_router, prefix="/api")
app.include_router(utils_router, prefix="/api")


# Serve frontend static assets
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR)), name="assets")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"message": "服务器内部错误，请稍后重试", "code": "INTERNAL_ERROR"},
    )


@app.get("/api/health")
async def health_check():
    provider_info = {"provider": "未配置", "model": "", "llm_available": False}
    try:
        from app.config_store import store
        active = store.get_active()
        if active and active.api_key:
            provider_info = {
                "provider": active.provider,
                "model": active.model,
                "llm_available": True,
            }
    except Exception:
        pass
    return {"status": "ok", "version": "1.0.0", **provider_info}


# SPA fallback
@app.get("/{path:path}")
async def spa_fallback(request: Request, path: str):
    if path.startswith("api/") or path.startswith("assets/"):
        raise HTTPException(status_code=404)
    if INDEX_HTML.exists():
        return FileResponse(str(INDEX_HTML))
    return JSONResponse(status_code=404, content={"message": "Frontend not built. Run: cd frontend && npm run build"})
