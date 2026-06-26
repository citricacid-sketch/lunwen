"""DB-backed configuration service — replaces config_store.py for multi-user.

Uses AES (Fernet) for API key encryption at rest in the database.
Also syncs to the file-based store for backward compatibility with non-auth endpoints.
"""

import logging
from typing import Optional

from cryptography.fernet import Fernet
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import LLMProfile
from app.config import settings

logger = logging.getLogger(__name__)

# Derive a Fernet key from JWT secret (so no extra config needed)
import base64, hashlib
_fernet_key = base64.urlsafe_b64encode(
    hashlib.sha256(settings.jwt_secret.encode()).digest()
)
_fernet = Fernet(_fernet_key)


def encrypt_api_key(plain: str) -> str:
    if not plain:
        return ""
    return _fernet.encrypt(plain.encode()).decode()


def decrypt_api_key(cipher: str) -> str:
    if not cipher:
        return ""
    try:
        return _fernet.decrypt(cipher.encode()).decode()
    except Exception:
        logger.warning("Failed to decrypt API key")
        return cipher


async def get_active_profile(db: AsyncSession, user_id: int) -> Optional[dict]:
    """Get the active LLM profile for a user.

    Returns dict with api_key, base_url, model, provider — or None.
    """
    result = await db.execute(
        select(LLMProfile).where(
            LLMProfile.user_id == user_id,
            LLMProfile.is_active == True,  # noqa: E712
        )
    )
    profile = result.scalar_one_or_none()

    # Fallback to first profile
    if profile is None:
        result = await db.execute(
            select(LLMProfile).where(LLMProfile.user_id == user_id).limit(1)
        )
        profile = result.scalar_one_or_none()

    if profile is None:
        return None

    return {
        "id": profile.id,
        "provider": profile.provider,
        "api_key": decrypt_api_key(profile.encrypted_api_key),
        "base_url": profile.base_url,
        "model": profile.model,
        "name": profile.name,
    }


async def list_profiles(db: AsyncSession, user_id: int) -> list[dict]:
    result = await db.execute(
        select(LLMProfile).where(LLMProfile.user_id == user_id)
    )
    profiles = result.scalars().all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "provider": p.provider,
            "model": p.model,
            "base_url": p.base_url,
            "api_key": "***" + decrypt_api_key(p.encrypted_api_key)[-4:]
            if len(decrypt_api_key(p.encrypted_api_key)) > 4 else "***",
            "is_active": p.is_active,
        }
        for p in profiles
    ]


def _sync_to_file_store(api_key: str, base_url: str, model: str, provider: str) -> None:
    """Mirror the active config to the legacy file-based store so non-auth endpoints work."""
    from app.config_store import store, LLMProfile as FileProfile
    try:
        profile = FileProfile(
            id="default", name="默认配置",
            provider=provider, base_url=base_url, model=model,
            api_key=api_key,  # raw key — save_profile will handle encryption
        )
        store.save_profile(profile)
        store.activate("default")
    except Exception as e:
        logger.warning(f"Failed to sync to file store: {e}")


async def save_profile(
    db: AsyncSession, user_id: int,
    profile_id: Optional[int], name: str, provider: str,
    api_key: str, base_url: str, model: str,
) -> dict:
    """Create or update a profile."""
    if profile_id:
        result = await db.execute(
            select(LLMProfile).where(
                LLMProfile.id == profile_id,
                LLMProfile.user_id == user_id,
            )
        )
        profile = result.scalar_one_or_none()
        if profile is None:
            raise ValueError("Profile not found")
        profile.name = name
        profile.provider = provider
        profile.encrypted_api_key = encrypt_api_key(api_key)
        profile.base_url = base_url
        profile.model = model
    else:
        profile = LLMProfile(
            user_id=user_id,
            name=name,
            provider=provider,
            encrypted_api_key=encrypt_api_key(api_key),
            base_url=base_url,
            model=model,
            is_active=False,
        )
        db.add(profile)
        profile_id = profile.id if profile.id else 0

    await db.commit()
    _sync_to_file_store(api_key, base_url, model, provider)
    return {"ok": True, "id": profile.id}


async def activate_profile(db: AsyncSession, user_id: int, profile_id: int) -> dict:
    """Set a profile as active (deactivates others)."""
    # Deactivate all user's profiles
    await db.execute(
        update(LLMProfile).where(LLMProfile.user_id == user_id).values(is_active=False)
    )
    # Activate the target
    result = await db.execute(
        select(LLMProfile).where(
            LLMProfile.id == profile_id,
            LLMProfile.user_id == user_id,
        )
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        raise ValueError("Profile not found")
    profile.is_active = True
    await db.commit()

    # Sync to file store
    _sync_to_file_store(
        decrypt_api_key(profile.encrypted_api_key),
        profile.base_url,
        profile.model,
        profile.provider,
    )

    return {"ok": True, "provider": profile.provider, "model": profile.model}


async def delete_profile(db: AsyncSession, user_id: int, profile_id: int) -> dict:
    result = await db.execute(
        select(LLMProfile).where(
            LLMProfile.id == profile_id,
            LLMProfile.user_id == user_id,
        )
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        raise ValueError("Profile not found")
    await db.delete(profile)
    await db.commit()
    return {"ok": True}


PROVIDER_PRESETS = {
    "openai": {"label": "OpenAI", "base_url": "https://api.openai.com/v1", "models": ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "o4-mini"]},
    "deepseek": {"label": "DeepSeek", "base_url": "https://api.deepseek.com/v1", "models": ["deepseek-chat", "deepseek-reasoner"]},
    "qwen": {"label": "通义千问", "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1", "models": ["qwen-turbo", "qwen-plus", "qwen-max", "qwen3-235b-a22b"]},
    "zhipu": {"label": "智谱 GLM", "base_url": "https://open.bigmodel.cn/api/paas/v4", "models": ["glm-4", "glm-4-flash", "glm-4-plus"]},
    "moonshot": {"label": "Moonshot", "base_url": "https://api.moonshot.cn/v1", "models": ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"]},
    "siliconflow": {"label": "SiliconFlow", "base_url": "https://api.siliconflow.cn/v1", "models": ["deepseek-ai/DeepSeek-V3", "Qwen/Qwen3-235B-A22B", "Pro/zai-org/GLM-4.7"]},
    "custom": {"label": "自定义", "base_url": "", "models": []},
}
