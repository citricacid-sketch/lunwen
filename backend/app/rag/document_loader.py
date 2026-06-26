"""Document loader: extract text from PDF and DOCX files.

Reuses existing extraction logic from app.api.utils where possible.
"""

import io
import logging
from pathlib import Path
from typing import Tuple

logger = logging.getLogger(__name__)


def load_pdf(filepath: str | Path) -> str:
    """Extract text from a PDF file."""
    import fitz
    doc = fitz.open(str(filepath))
    try:
        pages = []
        for page in doc:
            text = page.get_text()
            if text.strip():
                pages.append(text.strip())
        return "\n\n".join(pages)
    finally:
        doc.close()


def load_pdf_bytes(content: bytes) -> str:
    """Extract text from PDF bytes."""
    import fitz
    doc = fitz.open(stream=content, filetype="pdf")
    try:
        pages = []
        for page in doc:
            text = page.get_text()
            if text.strip():
                pages.append(text.strip())
        return "\n\n".join(pages)
    finally:
        doc.close()


def load_docx_bytes(content: bytes) -> str:
    """Extract text from DOCX bytes."""
    from docx import Document
    doc = Document(io.BytesIO(content))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs)


def load_txt_bytes(content: bytes) -> str:
    """Extract text from TXT bytes, trying common Chinese encodings."""
    for encoding in ("utf-8", "gbk", "gb2312", "gb18030", "latin-1"):
        try:
            return content.decode(encoding)
        except (UnicodeDecodeError, LookupError):
            continue
    return content.decode("utf-8", errors="replace")


def load_document_bytes(content: bytes, filename: str) -> str:
    """Load text from document bytes, auto-detecting format by extension."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "pdf":
        return load_pdf_bytes(content)
    elif ext == "docx":
        return load_docx_bytes(content)
    elif ext == "txt":
        return load_txt_bytes(content)
    else:
        raise ValueError(f"Unsupported file type: .{ext}")
