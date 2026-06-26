import logging
from pydantic_settings import BaseSettings
from typing import Literal
from app.services.llm.base import LLMProvider

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    # LLM defaults
    llm_provider: Literal["openai"] = "openai"
    openai_api_key: str | None = None
    openai_base_url: str | None = None
    openai_model: str = "gpt-4o"

    # Rate limiting
    rate_limit_requests: int = 20
    max_input_length: int = 50000
    cors_origins: str = "http://localhost:5173"

    # MySQL
    database_url: str = "mysql+aiomysql://root:root@localhost:3306/lunwen"

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 72


settings = Settings()


def get_llm_provider() -> LLMProvider:
    from app.config_store import store
    from app.services.llm.openai_impl import OpenAIProvider

    config = store.get_active()
    if not config.api_key:
        raise ValueError("API Key 未配置，请在设置页面配置模型")

    logger.info(f"Using provider: {config.provider}, model: {config.model}, base_url: {config.base_url}")
    return OpenAIProvider(
        api_key=config.api_key,
        model=config.model,
        base_url=config.base_url or None,
    )


async def get_llm_provider_for_user(user_id: int, db) -> LLMProvider:
    """Get LLM provider using DB-backed user config."""
    from app.services.config_service import get_active_profile
    from app.services.llm.openai_impl import OpenAIProvider

    profile = await get_active_profile(db, user_id)
    if not profile or not profile.get("api_key"):
        raise ValueError("API Key 未配置，请在设置页面配置模型")

    logger.info(f"Using provider for user {user_id}: {profile['provider']}, model: {profile['model']}")
    return OpenAIProvider(
        api_key=profile["api_key"],
        model=profile["model"],
        base_url=profile.get("base_url") or None,
    )
