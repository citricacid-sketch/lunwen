"""Preprocessing module — rule-based text analysis."""

from .pipeline import PreprocessPipeline, PreprocessReport
from .sentence_splitter import split_sentences, split_paragraphs
from .citation_guard import CitationGuard
from .forbidden_words import scan, compute_score, ForbiddenMatch

__all__ = [
    "PreprocessPipeline",
    "PreprocessReport",
    "split_sentences",
    "split_paragraphs",
    "CitationGuard",
    "scan",
    "compute_score",
    "ForbiddenMatch",
]
