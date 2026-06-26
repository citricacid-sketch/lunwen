"""RAG module — retrieval-augmented generation for academic writing."""

from .manager import RAGManager, get_rag_manager
from .chunker import chunk_text
from .retriever import HybridRetriever
from .embedder import get_embedder, LocalEmbedder, APIEmbedder
from .vector_store import VectorStore, get_vector_store
from .document_loader import load_document_bytes, load_pdf_bytes, load_docx_bytes

__all__ = [
    "RAGManager",
    "get_rag_manager",
    "chunk_text",
    "HybridRetriever",
    "get_embedder",
    "LocalEmbedder",
    "APIEmbedder",
    "VectorStore",
    "get_vector_store",
    "load_document_bytes",
    "load_pdf_bytes",
    "load_docx_bytes",
]
