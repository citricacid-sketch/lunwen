"""Embedding abstraction layer.

Supports:
  - API: OpenAI-compatible embeddings API (primary, uses existing key)
  - Local: sentence-transformers (optional, install separately)
  - Fallback: sklearn TfidfVectorizer (pure Python, always available)

Lazy-loads models on first use to avoid slowing startup.
"""

import logging
from abc import ABC, abstractmethod
from typing import List

logger = logging.getLogger(__name__)

DEFAULT_LOCAL_MODEL = "BAAI/bge-small-zh-v1.5"


class BaseEmbedder(ABC):
    @abstractmethod
    def embed(self, texts: List[str]) -> List[List[float]]:
        ...

    @abstractmethod
    def embed_query(self, query: str) -> List[float]:
        ...


class APIEmbedder(BaseEmbedder):
    """OpenAI-compatible embeddings API."""

    def __init__(self, api_key: str, base_url: str | None = None, model: str = "text-embedding-3-small"):
        from openai import OpenAI
        kwargs = {"api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url
        self._client = OpenAI(**kwargs)
        self._model = model

    def embed(self, texts: List[str]) -> List[List[float]]:
        resp = self._client.embeddings.create(model=self._model, input=texts)
        return [d.embedding for d in resp.data]

    def embed_query(self, query: str) -> List[float]:
        return self.embed([query])[0]


class LocalEmbedder(BaseEmbedder):
    """sentence-transformers based local embedder (optional dependency)."""

    def __init__(self, model_name: str = DEFAULT_LOCAL_MODEL):
        self._model_name = model_name
        self._model = None

    def _load(self):
        if self._model is None:
            logger.info(f"Loading embedding model: {self._model_name}")
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self._model_name)
            logger.info("Embedding model loaded")

    def embed(self, texts: List[str]) -> List[List[float]]:
        self._load()
        embeddings = self._model.encode(
            texts, normalize_embeddings=True, show_progress_bar=False,
        )
        return embeddings.tolist()

    def embed_query(self, query: str) -> List[float]:
        self._load()
        embedding = self._model.encode(
            f"为这个句子生成表示以用于检索相关文章：{query}",
            normalize_embeddings=True, show_progress_bar=False,
        )
        return embedding.tolist()


class TfidfEmbedder(BaseEmbedder):
    """sklearn HashingVectorizer fallback — always available, no API needed.

    Uses character n-grams with the hashing trick for fixed-size output,
    then L2-normalizes. Stateless: same input always produces same output,
    which is required for persistent vector store consistency.
    """

    def __init__(self, n_features: int = 384):
        from sklearn.feature_extraction.text import HashingVectorizer
        from sklearn.preprocessing import normalize
        self._vectorizer = HashingVectorizer(
            analyzer="char_wb",
            ngram_range=(2, 4),
            n_features=n_features,
            norm=None,
            alternate_sign=False,
        )

    def embed(self, texts: List[str]) -> List[List[float]]:
        from sklearn.preprocessing import normalize
        X = self._vectorizer.transform(texts)
        X = normalize(X, norm="l2")
        return X.toarray().tolist()

    def embed_query(self, query: str) -> List[float]:
        return self.embed([query])[0]


class _ResilientEmbedder(BaseEmbedder):
    """Wraps multiple embedders, falling back on failure."""

    def __init__(self):
        self._inner: BaseEmbedder | None = None
        self._fallback = TfidfEmbedder()

    def _resolve(self):
        if self._inner is not None:
            return
        # Try API only for OpenAI provider (known to support embeddings)
        try:
            from app.config_store import store
            config = store.get_active()
            if config.api_key and config.provider == "openai":
                self._inner = APIEmbedder(
                    api_key=config.api_key,
                    base_url=config.base_url or None,
                )
                logger.info("Using OpenAI API embedder")
                return
        except Exception:
            logger.debug("API embedder not available, trying next option")

        # Try local sentence-transformers
        try:
            import sentence_transformers  # noqa: F401
            self._inner = LocalEmbedder()
            logger.info("Using local sentence-transformers embedder")
            return
        except ImportError:
            logger.debug("sentence-transformers not installed, using TF-IDF fallback")

        # TF-IDF fallback
        self._inner = self._fallback
        logger.info("Using TF-IDF embedder (offline)")

    def embed(self, texts: List[str]) -> List[List[float]]:
        self._resolve()
        try:
            if self._inner is not self._fallback:
                return self._inner.embed(texts)
        except Exception as e:
            logger.warning(f"Primary embedder failed: {e}, falling back to TF-IDF")
            self._inner = self._fallback
        return self._fallback.embed(texts)

    def embed_query(self, query: str) -> List[float]:
        self._resolve()
        try:
            if self._inner is not self._fallback:
                return self._inner.embed_query(query)
        except Exception as e:
            logger.warning(f"Primary embedder failed: {e}, falling back to TF-IDF")
            self._inner = self._fallback
        return self._fallback.embed_query(query)


def get_embedder() -> BaseEmbedder:
    """Get a resilient embedder with automatic fallback.

    Priority: OpenAI API > sentence-transformers > TF-IDF
    Failures at any level cascade to the next.
    """
    return _ResilientEmbedder()
