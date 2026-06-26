"""Citation marker extraction, masking, and restoration.

Handles:
  - Numbered citations: [1], [1,2,3], [1-3], [1，2，3]
  - Author-year: （张三，2023）, (Smith, 2020), （张三等，2023）
"""

import re
from dataclasses import dataclass, field
from typing import List, Tuple


# Match [1], [1,2], [1,2,3], [1-3], [1，2，3], [1, 2]
_CITATION_NUM = re.compile(
    r'\[(\d+(?:[-,，,\s]+\d+)*)\]'
)

# Match author-year: （张三，2023）, (Smith, 2020), （张三等，2023）
_CITATION_AUTHOR_YEAR_CN = re.compile(
    r'（([^）]{2,20}?\d{4}[a-z]?[））]?)'
)

_CITATION_AUTHOR_YEAR_EN = re.compile(
    r'\(([A-Z][a-z]+(?:\s+(?:&|and)\s+[A-Z][a-z]+)?,?\s*\d{4}[a-z]?)\)'
)


@dataclass
class CitationGuard:
    """Manages citation extraction and restoration."""

    citations: List[Tuple[str, str]] = field(default_factory=list)
    # (placeholder, original_citation)
    _counter: int = field(default=0, init=False)

    def extract(self, text: str) -> Tuple[str, List[str]]:
        """Extract all citation markers from text, replace with placeholders.

        Returns:
            (masked_text, list_of_original_citations)
        """
        self.citations = []
        self._counter = 0
        original_citations: List[str] = []

        def _replace(m: re.Match) -> str:
            original = m.group(0)
            self._counter += 1
            placeholder = f'\x00CITE{self._counter:04d}\x00'
            self.citations.append((placeholder, original))
            original_citations.append(original)
            return placeholder

        # Order matters: numbered first (more specific), then author-year
        result = _CITATION_NUM.sub(_replace, text)
        result = _CITATION_AUTHOR_YEAR_CN.sub(_replace, result)
        result = _CITATION_AUTHOR_YEAR_EN.sub(_replace, result)

        return result, original_citations

    def restore(self, text: str) -> str:
        """Restore original citation markers from placeholders."""
        result = text
        for placeholder, original in self.citations:
            result = result.replace(placeholder, original)
        return result

    def count(self) -> int:
        return len(self.citations)
