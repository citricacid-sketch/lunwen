"""RAG lifecycle manager.

Orchestrates: document loading → chunking → embedding → indexing → retrieval.
"""

import logging
import uuid
from typing import List, Optional

from .chunker import chunk_text
from .vector_store import get_vector_store
from .retriever import HybridRetriever
from .document_loader import load_document_bytes

logger = logging.getLogger(__name__)


class RAGManager:
    """Manages the full RAG lifecycle for reference documents."""

    def __init__(self):
        self._store = get_vector_store()
        self._retriever = HybridRetriever()

    def index_document(self, content: bytes, filename: str) -> dict:
        """Index a document: load → chunk → embed → store.

        Returns:
            {document_id, filename, chunk_count}
        """
        # Load text
        text = load_document_bytes(content, filename)
        if not text.strip():
            raise ValueError("Document contains no extractable text")

        # Chunk
        chunks = chunk_text(text)
        if not chunks:
            raise ValueError("Document chunking produced no chunks")

        # Store
        doc_id = uuid.uuid4().hex[:12]
        self._store.add_chunks(chunks, doc_id, filename)

        logger.info(f"Indexed document {filename} as {doc_id}: {len(chunks)} chunks, {len(text)} chars")
        return {
            "document_id": doc_id,
            "filename": filename,
            "chunk_count": len(chunks),
            "char_count": len(text),
        }

    def search(
        self,
        query: str,
        top_k: int = 5,
    ) -> List[dict]:
        """Search indexed documents for relevant chunks."""
        return self._retriever.search(query, top_k=top_k)

    def list_documents(self) -> List[dict]:
        """List all indexed documents."""
        return self._store.get_documents()

    def remove_document(self, document_id: str):
        """Remove a document and all its chunks."""
        self._store.remove_document(document_id)
        logger.info(f"Removed document {document_id}")

    def chunk_count(self) -> int:
        """Total number of indexed chunks."""
        return self._store.count()


# Singleton
_manager: Optional[RAGManager] = None


def get_rag_manager() -> RAGManager:
    global _manager
    if _manager is None:
        _manager = RAGManager()
    return _manager
