import logging
from typing import AsyncIterator
from openai import AsyncOpenAI
from app.services.llm.base import LLMProvider

logger = logging.getLogger(__name__)


class OpenAIProvider(LLMProvider):
    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4o",
        base_url: str | None = None,
    ):
        kwargs = {"api_key": api_key, "timeout": 120.0, "max_retries": 2}
        if base_url:
            kwargs["base_url"] = base_url
        self.client = AsyncOpenAI(**kwargs)
        self.model = model

    @property
    def provider_name(self) -> str:
        return "openai"

    async def generate(self, system_prompt: str, user_message: str) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
        )
        return response.choices[0].message.content or ""

    async def generate_stream(
        self, system_prompt: str, user_message: str
    ) -> AsyncIterator[str]:
        async for chunk in self._stream(
            [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_message}]
        ):
            yield chunk

    async def chat_stream(
        self, system_prompt: str, messages: list[dict]
    ) -> AsyncIterator[str]:
        async for chunk in self._stream(
            [{"role": "system", "content": system_prompt}] + messages
        ):
            yield chunk

    async def _stream(self, messages: list[dict]) -> AsyncIterator[str]:
        stream = await self.client.chat.completions.create(
            model=self.model, messages=messages, stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                yield delta.content
