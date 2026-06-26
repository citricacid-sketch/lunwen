"""Chinese sentence splitter using punctuation rules + jieba tokenization."""

import re
from typing import List


# Sentence-ending punctuation for Chinese and English
_SENTENCE_END = re.compile(r'[。！？!?\n]')
# Ellipsis that should NOT be split on
_ELLIPSIS = re.compile(r'\.{3,}')
# Decimal numbers and abbreviations with dots (e.g., 3.14, U.S.)
_DOT_PATTERN = re.compile(r'\d+\.\d+|[A-Z]\.[A-Z]')


def split_sentences(text: str) -> List[str]:
    """Split Chinese text into sentences, handling mixed CN/EN punctuation.

    Returns a list of sentence strings with trailing punctuation preserved.
    """
    if not text.strip():
        return []

    # Normalize: replace various newlines with \n
    text = text.replace('\r\n', '\n').replace('\r', '\n')

    # Protect ellipsis from being split
    placeholder = '\x00ELLIPSIS\x00'
    text = _ELLIPSIS.sub(placeholder, text)

    sentences: List[str] = []
    buf = ''

    for ch in text:
        buf += ch
        if _SENTENCE_END.match(ch):
            candidate = buf.strip()
            if candidate:
                sentences.append(candidate)
            buf = ''

    # Remaining text without sentence-ending punctuation
    remaining = buf.strip()
    if remaining:
        sentences.append(remaining)

    # Restore ellipsis
    sentences = [s.replace(placeholder, '...') for s in sentences]

    return sentences


def split_paragraphs(text: str) -> List[str]:
    """Split text into paragraphs by blank lines."""
    # Normalize line endings
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    paragraphs = re.split(r'\n\s*\n', text)
    return [p.strip() for p in paragraphs if p.strip()]
