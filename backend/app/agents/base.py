"""Base agent class for multi-agent collaboration."""

import logging
from typing import AsyncIterator

from app.services.llm.base import LLMProvider

logger = logging.getLogger(__name__)


class BaseAgent:
    """Minimal base for LLM-powered agents."""

    def __init__(self, provider: LLMProvider, name: str = "base"):
        self._provider = provider
        self.name = name

    async def generate(self, system_prompt: str, user_message: str) -> str:
        return await self._provider.generate(system_prompt, user_message)

    async def generate_stream(
        self, system_prompt: str, user_message: str,
    ) -> AsyncIterator[str]:
        async for chunk in self._provider.generate_stream(system_prompt, user_message):
            yield chunk
