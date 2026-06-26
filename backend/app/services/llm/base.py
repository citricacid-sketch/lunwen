from abc import ABC, abstractmethod
from typing import AsyncIterator


class LLMProvider(ABC):
    @abstractmethod
    async def generate(self, system_prompt: str, user_message: str) -> str:
        ...

    @abstractmethod
    async def generate_stream(
        self, system_prompt: str, user_message: str
    ) -> AsyncIterator[str]:
        ...

    async def chat_stream(
        self, system_prompt: str, messages: list[dict]
    ) -> AsyncIterator[str]:
        # Default: concatenate all messages into a single user message
        text = "\n".join(f"{m['role']}: {m['content']}" for m in messages)
        async for chunk in self.generate_stream(system_prompt, text):
            yield chunk

    @property
    @abstractmethod
    def provider_name(self) -> str:
        ...
