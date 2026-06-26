"""Preprocessing pipeline orchestrator.

Runs three rule-based preprocessors in sequence:
  1. Sentence splitting
  2. Citation extraction and masking
  3. Forbidden expression scanning

Returns a PreprocessReport with diagnostics.
"""

from dataclasses import dataclass, field
from typing import List, Optional

from .sentence_splitter import split_sentences
from .citation_guard import CitationGuard
from .forbidden_words import scan, compute_score, ForbiddenMatch


@dataclass
class PreprocessReport:
    """Result of preprocessing a text."""

    # Masked text (citations replaced with placeholders, ready for LLM)
    masked_text: str

    # Original text preserved for final restoration
    original_text: str

    # Sentence analysis
    sentence_count: int

    # Citation analysis
    citations: List[str]
    citation_count: int

    # Forbidden expression analysis
    forbidden_matches: List[dict]
    forbidden_count: int
    quality_score: float  # 0-100, higher is better

    # The citation guard instance (for later restoration)
    _guard: Optional[CitationGuard] = field(default=None, repr=False)

    def restore_citations(self, text: str) -> str:
        """Restore citation markers in the processed text."""
        if self._guard is None:
            return text
        return self._guard.restore(text)


class PreprocessPipeline:
    """Rule-based text preprocessing pipeline."""

    def __init__(self):
        self._guard = CitationGuard()

    def run(self, text: str) -> PreprocessReport:
        """Run full preprocessing pipeline on input text.

        Args:
            text: Raw input text from user.

        Returns:
            PreprocessReport with masked text and diagnostics.
        """
        # Step 1: Sentence splitting (for diagnostics only)
        sentences = split_sentences(text)

        # Step 2: Extract and mask citations
        masked_text, citations = self._guard.extract(text)

        # Step 3: Scan forbidden words on original text
        # (we scan original because masked text might hide some patterns)
        forbidden = scan(text)
        quality_score = compute_score(text)

        # Build forbidden match dicts for serialization
        forbidden_dicts = [
            {
                'word': m.word,
                'category': m.category,
                'suggestion': m.suggestion,
                'position': m.position,
                'context': m.context,
            }
            for m in forbidden
        ]

        return PreprocessReport(
            masked_text=masked_text,
            original_text=text,
            sentence_count=len(sentences),
            citations=citations,
            citation_count=len(citations),
            forbidden_matches=forbidden_dicts,
            forbidden_count=len(forbidden),
            quality_score=quality_score,
            _guard=self._guard,
        )
