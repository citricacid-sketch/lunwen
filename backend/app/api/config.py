"""Config API — DB-backed multi-user LLM profile management."""

import logging
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db, User
from app.auth import get_current_user
from app.services.config_service import (
    list_profiles, save_profile, activate_profile, delete_profile, PROVIDER_PRESETS,
)
from app.services.llm.openai_impl import OpenAIProvider

logger = logging.getLogger(__name__)
router = APIRouter(tags=["config"])

BLOCKED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254.169.254"}
BLOCKED_PREFIXES = ("10.", "172.16.", "172.17.", "172.18.", "172.19.",
                    "172.20.", "172.21.", "172.22.", "172.23.", "172.24.",
                    "172.25.", "172.26.", "172.27.", "172.28.", "172.29.",
                    "172.30.", "172.31.", "192.168.", "127.", "0.")


def _validate_base_url(url: str) -> str:
    if not url:
        return url
    if not (url.startswith("https://") or url.startswith("http://localhost") or url.startswith("http://127.0.0.1")):
        raise HTTPException(status_code=400, detail="API 地址必须使用 HTTPS 协议")
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if host in BLOCKED_HOSTS:
        raise HTTPException(status_code=400, detail="不允许使用该地址")
    for prefix in BLOCKED_PREFIXES:
        if host.startswith(prefix):
            raise HTTPException(status_code=400, detail="不允许使用内网地址")
    return url


@router.get("/config")
async def get_config(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return {
        "profiles": await list_profiles(db, user.id),
        "presets": PROVIDER_PRESETS,
    }


@router.post("/config/profile")
async def create_or_update_profile(
    body: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await save_profile(
            db, user.id,
            profile_id=body.get("id"),
            name=body.get("name", "未命名"),
            provider=body.get("provider", "openai"),
            api_key=body.get("api_key", ""),
            base_url=_validate_base_url(body.get("base_url", "")),
            model=body.get("model", ""),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/config/profile/{profile_id}")
async def remove_profile(
    profile_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await delete_profile(db, user.id, profile_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/config/activate/{profile_id}")
async def set_active_profile(
    profile_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await activate_profile(db, user.id, profile_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/config/test")
async def test_config(
    body: dict,
    user: User = Depends(get_current_user),
):
    api_key = body.get("api_key", "")
    base_url = _validate_base_url(body.get("base_url", ""))
    model = body.get("model", "")
    if not api_key:
        raise HTTPException(status_code=400, detail="API Key 不能为空")
    provider = OpenAIProvider(api_key=api_key, model=model or "gpt-4o", base_url=base_url or None)
    try:
        response = await provider.generate("重复'连接成功'两个字，不要输出其他内容。", "测试连接")
        return {"ok": True, "response": response.strip()}
    except Exception:
        raise HTTPException(status_code=400, detail="连接测试失败，请检查 API Key 和地址是否正确")
