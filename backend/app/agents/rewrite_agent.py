"""Rewrite agent — the primary text generation agent.

Builds a context-rich prompt incorporating:
  - Preprocessing diagnostics (citation masks, forbidden word flags)
  - RAG-retrieved reference chunks
  - Review feedback from previous round (if any)
"""

import logging
from typing import AsyncIterator, List, Optional

from app.agents.base import BaseAgent
from app.prompts.rewrite import build_mode_prompt
from app.preprocessing.pipeline import PreprocessReport

logger = logging.getLogger(__name__)


class RewriteAgent(BaseAgent):
    """Generates rewritten academic text with context augmentation."""

    def __init__(self, provider, name: str = "rewrite"):
        super().__init__(provider, name)

    def build_user_message(
        self,
        text: str,
        report: PreprocessReport,
        rag_chunks: Optional[List[dict]] = None,
        review_feedback: Optional[str] = None,
    ) -> str:
        """Build the user message with all available context.

        Uses masked_text (citations protected) so the LLM doesn't
        accidentally modify citation markers.
        """
        parts: List[str] = []

        # RAG context
        if rag_chunks:
            parts.append("## 相关参考文献片段")
            parts.append("以下是从你的参考文献库中检索到的相关内容，请在改写时参考这些文献的术语和表达方式：")
            for i, chunk in enumerate(rag_chunks, 1):
                src = chunk.get("metadata", {}).get("filename", "unknown")
                parts.append(f"[参考{i} — 来源: {src}]\n{chunk['document']}")
            parts.append("")

        # Preprocessing annotations
        parts.append("## 文本预处理标注")
        if report.citations:
            parts.append(f"检测到 {report.citation_count} 个引用标记（已在文本中用占位符保护），请保留占位符不要修改。")
        if report.forbidden_matches:
            parts.append("检测到以下需改进的表达：")
            for m in report.forbidden_matches[:10]:
                parts.append(f"  - 「{m['word']}」({m['category']}) → 建议: {m['suggestion']}")
        parts.append(f"文本质量预评分: {report.quality_score}/100")
        parts.append("")

        # Review feedback from previous round
        if review_feedback:
            parts.append("## 上一轮审查反馈")
            parts.append("请针对以下问题修复你的输出：")
            parts.append(review_feedback)
            parts.append("")

        # Main text to process (masked version)
        parts.append("## 待处理文本")
        parts.append(report.masked_text)

        return "\n".join(parts)

    async def rewrite_stream(
        self,
        text: str,
        report: PreprocessReport,
        mode: str = "rewrite",
        style: str = "formal",
        rag_chunks: Optional[List[dict]] = None,
        review_feedback: Optional[str] = None,
    ) -> AsyncIterator[str]:
        """Stream the rewrite generation."""
        system_prompt = build_mode_prompt(mode, style)
        user_message = self.build_user_message(text, report, rag_chunks, review_feedback)

        async for chunk in self.generate_stream(system_prompt, user_message):
            yield chunk

    async def rewrite(
        self,
        text: str,
        report: PreprocessReport,
        mode: str = "rewrite",
        style: str = "formal",
        rag_chunks: Optional[List[dict]] = None,
        review_feedback: Optional[str] = None,
    ) -> str:
        """Non-streaming rewrite generation."""
        system_prompt = build_mode_prompt(mode, style)
        user_message = self.build_user_message(text, report, rag_chunks, review_feedback)
        return await self.generate(system_prompt, user_message)
