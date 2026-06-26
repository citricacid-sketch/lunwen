import logging
from app.config import get_llm_provider
from app.prompts.rewrite import build_mode_prompt, build_iterate_prompt
from typing import AsyncIterator

logger = logging.getLogger(__name__)


class RewriteService:
    async def process(
        self,
        text: str,
        mode: str = "rewrite",
        style: str = "formal",
        language: str = "zh",
        intro_or_conclusion: str = "intro",
    ) -> str:
        provider = get_llm_provider()
        system_prompt = build_mode_prompt(mode, style)
        user_message = self._build_user_message(text, mode, language, intro_or_conclusion)
        return await provider.generate(system_prompt, user_message)

    async def process_stream(
        self,
        text: str,
        mode: str = "rewrite",
        style: str = "formal",
        language: str = "zh",
        intro_or_conclusion: str = "intro",
    ) -> AsyncIterator[str]:
        provider = get_llm_provider()
        system_prompt = build_mode_prompt(mode, style)
        user_message = self._build_user_message(text, mode, language, intro_or_conclusion)
        async for chunk in provider.generate_stream(system_prompt, user_message):
            yield chunk

    async def iterate_stream(
        self,
        original_text: str,
        current_text: str,
        instruction: str,
        mode: str = "rewrite",
        style: str = "formal",
    ) -> AsyncIterator[str]:
        provider = get_llm_provider()
        system_prompt = build_iterate_prompt(style)
        user_message = (
            f"原始文本：\n{original_text}\n\n"
            f"当前处理结果：\n{current_text}\n\n"
            f"追加的修改指令：\n{instruction}"
        )
        async for chunk in provider.generate_stream(system_prompt, user_message):
            yield chunk

    def _build_user_message(
        self,
        text: str,
        mode: str,
        language: str = "zh",
        intro_or_conclusion: str = "intro",
    ) -> str:
        if mode == "abstract":
            lang_label = "英文" if language == "en" else "中文"
            return f"请为以下论文内容生成{lang_label}摘要：\n\n{text}"
        if mode == "intro_conclusion":
            section = "引言" if intro_or_conclusion == "intro" else "结论"
            return f"请为以下论文内容生成{section}：\n\n{text}"
        return text

    # Backward-compatible aliases
    async def chat_stream(
        self, messages: list[dict]
    ) -> AsyncIterator[str]:
        from app.prompts.rewrite import TUTOR_SYSTEM_PROMPT
        provider = get_llm_provider()
        async for chunk in provider.chat_stream(TUTOR_SYSTEM_PROMPT, messages):
            yield chunk

    async def rewrite(self, text: str, style: str = "formal") -> str:
        return await self.process(text, "rewrite", style)

    async def rewrite_stream(self, text: str, style: str = "formal") -> AsyncIterator[str]:
        async for chunk in self.process_stream(text, "rewrite", style):
            yield chunk

    async def rewrite_iterate_stream(
        self, original_text: str, current_text: str, instruction: str, style: str = "formal"
    ) -> AsyncIterator[str]:
        async for chunk in self.iterate_stream(original_text, current_text, instruction, "rewrite", style):
            yield chunk
