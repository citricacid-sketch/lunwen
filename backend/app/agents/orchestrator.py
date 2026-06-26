"""Multi-agent pipeline orchestrator.

Coordinates the full workflow:
  Preprocess → RAG → [Rewrite → Review] × N → Postprocess → Report

Streams SSE-friendly event dicts at each stage.
"""

import logging
from typing import AsyncIterator, List, Optional

from app.config import get_llm_provider
from app.preprocessing.pipeline import PreprocessPipeline, PreprocessReport
from app.agents.rewrite_agent import RewriteAgent
from app.agents.review_agent import ReviewAgent, ReviewResult

logger = logging.getLogger(__name__)

MAX_ROUNDS = 2
REVIEW_PASS_THRESHOLD = 70


def _sse(event: str, data: dict) -> dict:
    return {"event": event, "data": data}


class AgentOrchestrator:
    """Orchestrates the multi-agent rewrite pipeline."""

    def __init__(self):
        self._preprocess = PreprocessPipeline()

    async def run_stream(
        self,
        text: str,
        mode: str = "rewrite",
        style: str = "formal",
        use_rag: bool = False,
        enable_review: bool = True,
    ) -> AsyncIterator[dict]:
        """Run the full agent pipeline, yielding SSE events.

        Args:
            text: Input text to process.
            mode: Processing mode (rewrite/deweight/grammar/etc.).
            style: Style variant (formal/concise/expanded).
            use_rag: Whether to use RAG retrieval.
            enable_review: Whether to enable review agent (disable for fast mode).

        Yields:
            Dicts with 'event' and 'data' keys for SSE streaming.
        """
        provider = get_llm_provider()
        rewrite_agent = RewriteAgent(provider, "rewrite")
        review_agent = ReviewAgent(provider, "review") if enable_review else None

        # ── Stage 1: Preprocessing ──
        yield _sse("status", {"stage": "preprocessing", "message": "正在分析文本结构，提取引用标记..."})
        report = self._preprocess.run(text)
        yield _sse("preprocess", {
            "sentence_count": report.sentence_count,
            "citations": report.citations,
            "citation_count": report.citation_count,
            "forbidden_words": report.forbidden_matches,
            "forbidden_count": report.forbidden_count,
            "quality_score": report.quality_score,
        })

        # ── Stage 2: RAG Retrieval (optional) ──
        rag_chunks: Optional[List[dict]] = None
        if use_rag:
            yield _sse("status", {"stage": "retrieving", "message": "正在检索相关参考文献..."})
            try:
                from app.rag.manager import get_rag_manager
                mgr = get_rag_manager()
                if mgr.chunk_count() > 0:
                    rag_chunks = mgr.search(text, top_k=3)
                    yield _sse("rag", {
                        "chunks_found": len(rag_chunks),
                        "sources": [
                            {
                                "filename": c.get("metadata", {}).get("filename", "unknown"),
                                "chunk_index": c.get("metadata", {}).get("chunk_index", 0),
                                "similarity": c.get("score", 0),
                            }
                            for c in rag_chunks
                        ],
                    })
                else:
                    yield _sse("rag", {"chunks_found": 0, "sources": []})
            except Exception as e:
                logger.warning(f"RAG retrieval failed: {e}")
                yield _sse("rag", {"chunks_found": 0, "sources": []})

        # ── Stage 3: Multi-Agent Loop ──
        current_text = ""
        review_feedback: Optional[str] = None
        all_reviews: List[dict] = []

        for round_num in range(1, MAX_ROUNDS + 1):
            # ── Rewrite ──
            yield _sse("status", {
                "stage": "rewriting",
                "message": f"正在改写...（第 {round_num}/{MAX_ROUNDS} 轮）",
                "round": round_num,
            })

            current_text = ""
            async for chunk in rewrite_agent.rewrite_stream(
                text=text,
                report=report,
                mode=mode,
                style=style,
                rag_chunks=rag_chunks,
                review_feedback=review_feedback,
            ):
                current_text += chunk
                yield _sse("delta", {"content": chunk})

            if not enable_review or review_agent is None:
                break

            # ── Review ──
            yield _sse("status", {
                "stage": "reviewing",
                "message": f"正在审查结果...（第 {round_num}/{MAX_ROUNDS} 轮）",
                "round": round_num,
            })

            review_result = await review_agent.review(
                original_text=text,
                rewritten_text=current_text,
                original_citations=report.citations,
            )
            all_reviews.append(review_result.to_dict())
            yield _sse("review", {
                "round": round_num,
                **review_result.to_dict(),
            })

            if review_result.passed:
                break

            # Build feedback for next round
            review_feedback = review_agent.build_feedback(review_result)
            if round_num >= MAX_ROUNDS:
                logger.info(f"Max rounds ({MAX_ROUNDS}) reached, stopping agent loop")

        # ── Stage 4: Post-processing ──
        yield _sse("status", {"stage": "postprocessing", "message": "正在还原引用标记..."})
        final_text = report.restore_citations(current_text)

        # Final forbidden word scan
        from app.preprocessing.forbidden_words import scan as fw_scan, compute_score as fw_score
        final_forbidden = fw_scan(final_text)
        final_quality = fw_score(final_text)

        # ── Stage 5: Done ──
        quality_report = {
            "preprocess_score": report.quality_score,
            "final_score": final_quality,
            "rounds": len(all_reviews),
            "reviews": all_reviews,
            "original_length": len(text),
            "rewritten_length": len(final_text),
            "mode": mode,
            "style": style,
            "rag_used": use_rag and rag_chunks is not None and len(rag_chunks) > 0 if rag_chunks else False,
            "agent_review_enabled": enable_review,
        }

        yield _sse("done", quality_report)
