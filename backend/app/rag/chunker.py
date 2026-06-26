"""Chinese text semantic chunking.

Strategy:
  1. Split by paragraph boundaries first (natural semantic units)
  2. Overlong paragraphs are split by sentence boundaries
  3. Adjacent short paragraphs are merged
  4. Overlap between chunks for retrieval continuity
"""

import re
from typing import List
from app.preprocessing.sentence_splitter import split_sentences, split_paragraphs


# Target chunk size in characters (Chinese chars ≈ 2x English tokens)
TARGET_CHUNK_SIZE = 500
MIN_CHUNK_SIZE = 100
MAX_CHUNK_SIZE = 1000
OVERLAP_SIZE = 80


def chunk_text(text: str, target_size: int = TARGET_CHUNK_SIZE) -> List[str]:
    """Split text into overlapping semantic chunks.

    Args:
        text: Input document text.
        target_size: Target characters per chunk.

    Returns:
        List of text chunks with overlap.
    """
    if not text.strip():
        return []

    # Step 1: Split into paragraphs
    paragraphs = split_paragraphs(text)
    if not paragraphs:
        return []

    # Step 2: Split overlong paragraphs into sentences
    segments: List[str] = []
    for para in paragraphs:
        if len(para) <= MAX_CHUNK_SIZE:
            segments.append(para)
        else:
            # Split long paragraph by sentences
            sents = split_sentences(para)
            current = ''
            for sent in sents:
                if len(current) + len(sent) <= target_size:
                    current += sent
                else:
                    if current.strip():
                        segments.append(current.strip())
                    current = sent
            if current.strip():
                segments.append(current.strip())

    # Step 3: Merge short adjacent segments
    merged: List[str] = []
    buf = ''
    for seg in segments:
        if len(buf) + len(seg) <= target_size:
            buf += '\n\n' + seg if buf else seg
        else:
            if buf.strip():
                merged.append(buf.strip())
            buf = seg
    if buf.strip():
        merged.append(buf.strip())

    # Step 4: Create overlapping chunks
    chunks: List[str] = []
    for i, seg in enumerate(merged):
        if len(seg) <= target_size + OVERLAP_SIZE:
            chunks.append(seg)
        else:
            # Slide a window over long segments
            start = 0
            while start < len(seg):
                end = min(start + target_size, len(seg))
                chunk = seg[start:end]
                # Try to break at sentence boundary
                if end < len(seg):
                    # Find last sentence-ending punctuation within last 20% of chunk
                    tail_start = max(start, end - target_size // 5)
                    tail = chunk[tail_start - start:]
                    last_end = max(
                        tail.rfind('。'), tail.rfind('！'),
                        tail.rfind('？'), tail.rfind('\n'),
                    )
                    if last_end > 0:
                        end = tail_start + last_end + 1
                        chunk = seg[start:end]

                if len(chunk.strip()) >= MIN_CHUNK_SIZE:
                    chunks.append(chunk.strip())
                start = end - OVERLAP_SIZE if end < len(seg) else len(seg)

    return chunks if chunks else [text]
