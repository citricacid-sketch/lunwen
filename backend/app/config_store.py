import json
import os
import sys
import tempfile
import base64
import hashlib
import logging
from pathlib import Path
from pydantic import BaseModel
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)

if getattr(sys, 'frozen', False):
    _EXE_DIR = Path(sys.executable).parent
    CONFIG_FILE = _EXE_DIR / "llm_config.json"
else:
    CONFIG_FILE = Path(__file__).parent.parent / "llm_config.json"

# Fernet key derived from machine-local secret (same as config_service.py)
def _derive_fernet() -> Fernet:
    host = os.environ.get("COMPUTERNAME", os.environ.get("HOSTNAME", "localhost"))
    key = base64.urlsafe_b64encode(hashlib.sha256(f"lunwen-fernet-v2:{host}".encode()).digest())
    return Fernet(key)

def _encrypt(plain: str) -> str:
    if not plain:
        return ""
    return _derive_fernet().encrypt(plain.encode()).decode()

def _decrypt(cipher: str) -> str:
    if not cipher:
        return ""
    try:
        return _derive_fernet().decrypt(cipher.encode()).decode()
    except Exception:
        logger.warning("Failed to decrypt API key (may be from different machine)")
        return ""

PROVIDER_PRESETS = {
    "openai": {"label": "OpenAI", "base_url": "https://api.openai.com/v1", "models": ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "o4-mini"]},
    "deepseek": {"label": "DeepSeek", "base_url": "https://api.deepseek.com/v1", "models": ["deepseek-chat", "deepseek-reasoner"]},
    "qwen": {"label": "通义千问", "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1", "models": ["qwen-turbo", "qwen-plus", "qwen-max", "qwen3-235b-a22b"]},
    "zhipu": {"label": "智谱 GLM", "base_url": "https://open.bigmodel.cn/api/paas/v4", "models": ["glm-4", "glm-4-flash", "glm-4-plus"]},
    "moonshot": {"label": "Moonshot", "base_url": "https://api.moonshot.cn/v1", "models": ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"]},
    "siliconflow": {"label": "SiliconFlow", "base_url": "https://api.siliconflow.cn/v1", "models": ["deepseek-ai/DeepSeek-V3", "Qwen/Qwen3-235B-A22B", "Pro/zai-org/GLM-4.7"]},
    "custom": {"label": "自定义", "base_url": "", "models": []},
}


class LLMProfile(BaseModel):
    id: str = ""
    name: str = "默认配置"
    provider: str = "openai"
    api_key: str = ""
    base_url: str = "https://api.openai.com/v1"
    model: str = "gpt-4o"

    def get_api_key(self) -> str:
        return _decrypt(self.api_key)

    def set_api_key(self, key: str):
        self.api_key = _encrypt(key)


class LLMConfigData(BaseModel):
    profiles: list[LLMProfile] = []
    active: str = ""


class ConfigStore:
    def __init__(self):
        self._data: LLMConfigData | None = None

    def _load(self) -> LLMConfigData:
        if self._data is not None:
            return self._data
        if CONFIG_FILE.exists():
            try:
                raw = json.loads(CONFIG_FILE.read_text("utf-8"))
                if "profiles" not in raw:
                    profile = LLMProfile(
                        id="default", name="默认配置",
                        provider=raw.get("provider", "openai"),
                        base_url=raw.get("base_url", "https://api.openai.com/v1"),
                        model=raw.get("model", "gpt-4o"),
                    )
                    # Migrate old plaintext or XOR-encrypted key
                    stored_key = raw.get("api_key", "")
                    if stored_key:
                        try:
                            if _decrypt(stored_key):
                                profile.api_key = stored_key
                            else:
                                profile.set_api_key(stored_key)
                        except Exception:
                            profile.set_api_key(stored_key)
                    self._data = LLMConfigData(profiles=[profile], active="default")
                    self._save()
                    return self._data
                for p in raw.get("profiles", []):
                    stored_key = p.get("api_key", "")
                    if stored_key and not stored_key.startswith("gAAAA"):
                        try:
                            p["api_key"] = _encrypt(stored_key)
                        except Exception:
                            p["api_key"] = ""
                self._data = LLMConfigData(**raw)
                self._save()
                return self._data
            except (json.JSONDecodeError, ValueError, TypeError) as e:
                logger.warning("Failed to load config file, recreating: %s", e)

        from app.config import settings
        profile = LLMProfile(
            id="default", name="默认配置", provider=settings.llm_provider or "openai",
            base_url=settings.openai_base_url or "https://api.openai.com/v1",
            model=settings.openai_model or "gpt-4o",
        )
        if settings.openai_api_key:
            profile.set_api_key(settings.openai_api_key)
        self._data = LLMConfigData(profiles=[profile], active="default")
        return self._data

    def _save(self):
        if self._data:
            CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
            fd, tmp = tempfile.mkstemp(dir=CONFIG_FILE.parent, suffix='.tmp')
            try:
                os.write(fd, self._data.model_dump_json(indent=2).encode("utf-8"))
            finally:
                os.close(fd)
            os.replace(tmp, str(CONFIG_FILE))

    def get_active(self) -> LLMProfile:
        data = self._load()
        for p in data.profiles:
            if p.id == data.active:
                key = p.get_api_key()
                return LLMProfile(
                    id=p.id, name=p.name, provider=p.provider,
                    api_key=key, base_url=p.base_url, model=p.model,
                )
        if data.profiles:
            p = data.profiles[0]
            key = p.get_api_key()
            return LLMProfile(
                id=p.id, name=p.name, provider=p.provider,
                api_key=key, base_url=p.base_url, model=p.model,
            )
        return LLMProfile()

    def list_profiles(self) -> list[dict]:
        data = self._load()
        return [{
            "id": p.id, "name": p.name, "provider": p.provider,
            "model": p.model, "base_url": p.base_url,
            "api_key": "***" + p.get_api_key()[-4:] if len(p.get_api_key()) > 4 else "***",
            "is_active": p.id == data.active,
        } for p in data.profiles]

    def save_profile(self, profile: LLMProfile) -> dict:
        data = self._load()
        raw_key = profile.api_key
        profile.set_api_key(raw_key)
        if not profile.id:
            profile.id = f"p{len(data.profiles) + 1}"
        existing = next((p for p in data.profiles if p.id == profile.id), None)
        if existing:
            existing.name = profile.name
            existing.provider = profile.provider
            existing.api_key = profile.api_key
            existing.base_url = profile.base_url
            existing.model = profile.model
        else:
            data.profiles.append(profile)
        if not data.active or data.active == profile.id:
            data.active = profile.id
        self._save()
        profile.api_key = raw_key
        logger.info("Saved profile: %s", profile.name)
        return {"ok": True, "id": profile.id}

    def delete_profile(self, profile_id: str) -> dict:
        data = self._load()
        data.profiles = [p for p in data.profiles if p.id != profile_id]
        if data.active == profile_id:
            data.active = data.profiles[0].id if data.profiles else ""
        self._save()
        return {"ok": True}

    def activate(self, profile_id: str) -> dict:
        data = self._load()
        profile = next((p for p in data.profiles if p.id == profile_id), None)
        if not profile:
            raise ValueError(f"Profile not found: {profile_id}")
        data.active = profile_id
        self._save()
        logger.info("Activated: %s", profile.name)
        return {"ok": True, "provider": profile.provider, "model": profile.model}

    def get_presets(self) -> dict:
        return PROVIDER_PRESETS


store = ConfigStore()
