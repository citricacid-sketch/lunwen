"""Lightweight vector store using sklearn NearestNeighbors + numpy.

Avoids ChromaDB's C++ build requirement. For small document collections
(dozens of documents, thousands of chunks), brute-force cosine similarity
with sklearn is fast enough and has zero external service dependencies.

Data is persisted as a JSON file alongside a numpy embeddings file.
"""

import json
import logging
import uuid
from pathlib import Path
from typing import List, Optional

import numpy as np
from sklearn.neighbors import NearestNeighbors

from .embedder import BaseEmbedder, get_embedder

logger = logging.getLogger(__name__)

_DB_DIR = Path(__file__).parent.parent.parent / "vector_db"
_CHUNKS_FILE = "chunks.json"
_EMBEDDINGS_FILE = "embeddings.npy"


class VectorStore:
    """sklearn-based vector store for document chunks."""

    def __init__(self, embedder: Optional[BaseEmbedder] = None):
        _DB_DIR.mkdir(parents=True, exist_ok=True)
        self._embedder = embedder or get_embedder()
        self._chunks: List[dict] = []       # [{id, document, metadata}]
        self._embeddings: np.ndarray | None = None  # shape (n_chunks, dim)
        self._index: NearestNeighbors | None = None
        self._load()

    def _load(self):
        """Load persisted chunks and embeddings from disk."""
        chunks_path = _DB_DIR / _CHUNKS_FILE
        emb_path = _DB_DIR / _EMBEDDINGS_FILE

        if chunks_path.exists():
            try:
                self._chunks = json.loads(chunks_path.read_text("utf-8"))
            except Exception:
                self._chunks = []

        if emb_path.exists():
            try:
                self._embeddings = np.load(emb_path)
            except Exception:
                self._embeddings = None

        if self._chunks and self._embeddings is not None and len(self._embeddings) > 0:
            self._rebuild_index()

    def _save(self):
        """Persist chunks and embeddings to disk."""
        chunks_path = _DB_DIR / _CHUNKS_FILE
        emb_path = _DB_DIR / _EMBEDDINGS_FILE

        chunks_path.write_text(json.dumps(self._chunks, ensure_ascii=False), "utf-8")
        if self._embeddings is not None and len(self._embeddings) > 0:
            np.save(emb_path, self._embeddings)

    def _rebuild_index(self):
        """Rebuild sklearn NearestNeighbors index."""
        if self._embeddings is None or len(self._embeddings) == 0:
            self._index = None
            return
        n_neighbors = min(50, len(self._embeddings))
        self._index = NearestNeighbors(
            n_neighbors=n_neighbors, metric="cosine", algorithm="brute",
        )
        self._index.fit(self._embeddings)

    def add_chunks(
        self,
        chunks_text: List[str],
        document_id: str,
        filename: str,
    ) -> List[str]:
        """Index chunks for a document. Replaces existing chunks for same doc."""
        if not chunks_text:
            return []

        # Remove existing chunks for this document
        self.remove_document(document_id)

        # Generate embeddings
        embeddings = self._embedder.embed(chunks_text)
        emb_array = np.array(embeddings, dtype=np.float32)

        # Create chunk records
        ids = []
        new_chunks = []
        for i, text in enumerate(chunks_text):
            chunk_id = f"{document_id}_chunk_{i}"
            ids.append(chunk_id)
            new_chunks.append({
                "id": chunk_id,
                "document": text,
                "metadata": {
                    "document_id": document_id,
                    "filename": filename,
                    "chunk_index": i,
                },
            })

        # Append to existing data
        self._chunks.extend(new_chunks)
        if self._embeddings is not None and len(self._embeddings) > 0:
            self._embeddings = np.vstack([self._embeddings, emb_array])
        else:
            self._embeddings = emb_array

        self._rebuild_index()
        self._save()
        logger.info(f"Indexed {len(chunks_text)} chunks for {filename} (total: {len(self._chunks)})")
        return ids

    def query(
        self,
        query_text: str,
        top_k: int = 5,
        filter_doc_id: Optional[str] = None,
    ) -> List[dict]:
        """Dense vector similarity search using cosine distance.

        Returns list of {id, document, metadata, distance}.
        """
        if self._index is None or not self._chunks:
            return []

        query_emb = np.array([self._embedder.embed_query(query_text)], dtype=np.float32)

        # Search with extra candidates if filtering
        n_results = min(top_k * 3 if filter_doc_id else top_k, len(self._chunks))
        if n_results == 0:
            return []

        distances, indices = self._index.kneighbors(query_emb, n_neighbors=n_results)

        items = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx >= len(self._chunks):
                continue
            chunk = self._chunks[idx]
            if filter_doc_id and chunk["metadata"].get("document_id") != filter_doc_id:
                continue
            items.append({
                "id": chunk["id"],
                "document": chunk["document"],
                "metadata": chunk["metadata"],
                "distance": float(dist),
            })
            if len(items) >= top_k:
                break

        return items

    def remove_document(self, document_id: str):
        """Remove all chunks for a document."""
        before = len(self._chunks)
        indices_to_keep = [
            i for i, c in enumerate(self._chunks)
            if c["metadata"].get("document_id") != document_id
        ]
        if len(indices_to_keep) == before:
            return  # nothing to remove

        self._chunks = [self._chunks[i] for i in indices_to_keep]
        if self._embeddings is not None:
            self._embeddings = self._embeddings[indices_to_keep]
        self._rebuild_index()
        self._save()
        logger.info(f"Removed {before - len(self._chunks)} chunks for {document_id}")

    def get_documents(self) -> List[dict]:
        """List distinct documents in the store."""
        seen: dict[str, dict] = {}
        for chunk in self._chunks:
            doc_id = chunk["metadata"].get("document_id", "")
            if doc_id and doc_id not in seen:
                seen[doc_id] = {
                    "document_id": doc_id,
                    "filename": chunk["metadata"].get("filename", "unknown"),
                }
        return list(seen.values())

    def count(self) -> int:
        return len(self._chunks)


# Singleton
_store: Optional[VectorStore] = None


def get_vector_store() -> VectorStore:
    global _store
    if _store is None:
        _store = VectorStore()
    return _store
