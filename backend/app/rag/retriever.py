"""Hybrid retrieval: Dense (vector) + Sparse (BM25).

Combines ChromaDB vector similarity with BM25 keyword matching
for better Chinese text retrieval.
"""

import logging
from typing import List, Optional

import jieba
from rank_bm25 import BM25Okapi

from .vector_store import get_vector_store

logger = logging.getLogger(__name__)


def _tokenize(text: str) -> List[str]:
    """Tokenize Chinese text using jieba."""
    # jieba.cut returns generator, convert to list of tokens
    return [w for w in jieba.cut(text) if w.strip()]


class HybridRetriever:
    """Combined dense + sparse retrieval with score fusion."""

    def __init__(self):
        self._store = get_vector_store()
        self._bm25: Optional[BM25Okapi] = None
        self._bm25_chunks: List[str] = []
        self._bm25_tokenized: List[List[str]] = []

    def _build_bm25(self, chunks: List[str]):
        """Build/reindex BM25 from chunk list."""
        self._bm25_chunks = chunks
        self._bm25_tokenized = [_tokenize(c) for c in chunks]
        if self._bm25_tokenized:
            self._bm25 = BM25Okapi(self._bm25_tokenized)

    def search(
        self,
        query: str,
        top_k: int = 5,
        dense_weight: float = 0.6,
    ) -> List[dict]:
        """Hybrid search combining dense and sparse scores.

        Args:
            query: Search query text.
            top_k: Number of results to return.
            dense_weight: Weight for dense scores (0-1), rest goes to BM25.

        Returns:
            List of {id, document, metadata, score, dense_score, bm25_score}.
        """
        # Dense search via ChromaDB
        dense_results = self._store.query(query, top_k=top_k * 2)

        if not dense_results:
            return []

        # Build BM25 index from retrieved candidates + extra context
        chunks_for_bm25 = [r["document"] for r in dense_results]
        self._build_bm25(chunks_for_bm25)

        # BM25 search
        tokenized_query = _tokenize(query)
        bm25_scores = self._bm25.get_scores(tokenized_query) if self._bm25 else []

        # Score fusion: normalize and combine
        # Normalize dense scores (distance → similarity, cosine distance range [0,2])
        max_dense = max((1.0 - r.get("distance", 0) for r in dense_results), default=0.01)

        combined = []
        for i, r in enumerate(dense_results):
            dense_sim = (1.0 - r.get("distance", 0)) / max_dense if max_dense > 0 else 0
            bm25_score = bm25_scores[i] / max(bm25_scores) if i < len(bm25_scores) and max(bm25_scores) > 0 else 0
            fused = dense_weight * dense_sim + (1 - dense_weight) * bm25_score

            combined.append({
                "id": r["id"],
                "document": r["document"],
                "metadata": r["metadata"],
                "score": round(fused, 4),
                "dense_score": round(dense_sim, 4),
                "bm25_score": round(bm25_score, 4),
            })

        # Sort by fused score descending
        combined.sort(key=lambda x: x["score"], reverse=True)

        return combined[:top_k]
