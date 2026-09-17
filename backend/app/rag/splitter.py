"""Heading-aware chunking.

The previous version of this project split on a fixed character window which
routinely cut sentences in half and lost the heading context.  This splitter:

1. parses Markdown headings and keeps a *section path* on every chunk,
2. packs whole paragraphs into a chunk up to ``chunk_size``,
3. carries a real character overlap into the next chunk,
4. hard-splits any single paragraph that is longer than the window.

The section path is what makes the citations readable ("RAG.md › 召回流程 › …")
and it is also fed into the reranker.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from pathlib import Path

_HEADING = re.compile(r"^(#{1,6})\s+(.*?)\s*$")
_PARAGRAPH_SPLIT = re.compile(r"\n\s*\n+")

# Chunks shorter than this are merged into the neighbour when possible, so the
# index does not fill up with heading-only fragments.
MIN_CHUNK_CHARS = 80


@dataclass
class Chunk:
    """A retrievable slice of a document."""

    chunk_id: str
    document_id: str
    document_name: str
    index: int
    content: str
    section: str = ""
    source_path: str = ""
    char_count: int = 0
    start_offset: int = 0

    def to_dict(self) -> dict:
        return {
            "chunk_id": self.chunk_id,
            "document_id": self.document_id,
            "document_name": self.document_name,
            "index": self.index,
            "content": self.content,
            "section": self.section,
            "source_path": self.source_path,
            "char_count": self.char_count,
            "start_offset": self.start_offset,
        }


@dataclass
class _Section:
    path: str
    body: str
    offset: int
    headings: list[str] = field(default_factory=list)


def make_document_id(relative_path: str | Path) -> str:
    """Stable, URL-safe document id derived from the repository-relative path.

    Stability matters: the evaluation dataset and the activity ledger reference
    documents by this id, so it must not change when the app restarts.
    """
    normalized = str(relative_path).replace("\\", "/")
    digest = hashlib.sha1(normalized.encode("utf-8")).hexdigest()[:10]
    stem = Path(normalized).stem
    slug = re.sub(r"[^0-9A-Za-z\u4e00-\u9fff]+", "-", stem).strip("-").lower()
    slug = slug[:48] or "doc"
    return f"{slug}-{digest}"


def _split_sections(text: str) -> list[_Section]:
    """Split text into sections delimited by Markdown headings."""
    lines = text.splitlines()
    sections: list[_Section] = []
    heading_stack: list[tuple[int, str]] = []
    buffer: list[str] = []
    buffer_start = 0
    current_path = ""
    offset = 0

    def flush(end_offset: int, path: str) -> None:
        body = "\n".join(buffer).strip()
        if body:
            sections.append(
                _Section(
                    path=path,
                    body=body,
                    offset=buffer_start,
                    headings=[h for _, h in heading_stack],
                )
            )

    for line in lines:
        match = _HEADING.match(line)
        line_length = len(line) + 1
        if match:
            flush(offset, current_path)
            buffer = []
            level = len(match.group(1))
            title = match.group(2).strip()
            while heading_stack and heading_stack[-1][0] >= level:
                heading_stack.pop()
            heading_stack.append((level, title))
            current_path = " › ".join(h for _, h in heading_stack)
            buffer_start = offset + line_length
        else:
            if not buffer:
                buffer_start = offset
            buffer.append(line)
        offset += line_length

    flush(offset, current_path)
    return sections


def _split_long_text(text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
    """Hard-split an oversized block on paragraph then sentence boundaries."""
    pieces: list[str] = []
    step = max(chunk_size - chunk_overlap, 1)
    start = 0
    length = len(text)

    while start < length:
        end = min(start + chunk_size, length)

        if end < length:
            window = text[start:end]
            # Prefer to break at a paragraph or sentence boundary near the end.
            for boundary in ("\n\n", "\n", "。", "！", "？", ". ", "；", ";"):
                cut = window.rfind(boundary)
                if cut > chunk_size * 0.5:
                    end = start + cut + len(boundary)
                    break

        piece = text[start:end].strip()
        if piece:
            pieces.append(piece)

        if end >= length:
            break
        start = max(end - chunk_overlap, start + 1)

    return pieces


def _pack_paragraphs(section: _Section, chunk_size: int, chunk_overlap: int) -> list[tuple[str, int]]:
    """Pack a section's paragraphs into windows.  Returns ``(text, offset)``."""
    paragraphs = [p.strip() for p in _PARAGRAPH_SPLIT.split(section.body) if p.strip()]
    if not paragraphs:
        return []

    packed: list[tuple[str, int]] = []
    buffer = ""
    buffer_offset = section.offset
    cursor = section.offset

    for paragraph in paragraphs:
        candidate = f"{buffer}\n\n{paragraph}" if buffer else paragraph

        if len(candidate) <= chunk_size:
            buffer = candidate
            cursor += len(paragraph) + 2
            continue

        # Candidate does not fit.
        if buffer:
            packed.append((buffer, buffer_offset))
            tail = buffer[-chunk_overlap:] if chunk_overlap > 0 else ""
            buffer_offset = max(cursor - len(paragraph) - len(tail), section.offset)
            buffer = ""

        if len(paragraph) > chunk_size:
            for piece in _split_long_text(paragraph, chunk_size, chunk_overlap):
                packed.append((piece, buffer_offset))
                buffer_offset += max(len(piece) - chunk_overlap, 1)
            cursor += len(paragraph) + 2
            continue

        # Re-seed the buffer with the overlap tail of the previous chunk.
        if packed and chunk_overlap > 0:
            previous = packed[-1][0]
            buffer = previous[-chunk_overlap:] + "\n\n" + paragraph
            if len(buffer) > chunk_size:
                buffer = paragraph
            buffer_offset = max(packed[-1][1] + max(len(previous) - chunk_overlap, 0), section.offset)
        else:
            buffer = paragraph
        cursor += len(paragraph) + 2

    if buffer.strip():
        packed.append((buffer.strip(), buffer_offset))

    return packed


def split_text(
    text: str,
    *,
    document_id: str,
    document_name: str,
    source_path: str = "",
    chunk_size: int = 500,
    chunk_overlap: int = 100,
) -> list[Chunk]:
    """Split one document body into :class:`Chunk` objects."""
    if chunk_overlap >= chunk_size:
        raise ValueError("chunk_overlap 必须小于 chunk_size。")
    if chunk_size <= 0:
        raise ValueError("chunk_size 必须大于 0。")
    if chunk_overlap < 0:
        raise ValueError("chunk_overlap 不能为负数。")

    body = (text or "").strip()
    if not body:
        return []

    sections = _split_sections(body) or [_Section(path="", body=body, offset=0)]

    # Merge tiny sections forward so we do not index heading-only fragments.
    merged: list[_Section] = []
    for section in sections:
        if merged and len(merged[-1].body) < MIN_CHUNK_CHARS and len(merged[-1].body) + len(section.body) <= chunk_size:
            previous = merged[-1]
            previous.body = f"{previous.body}\n\n{section.body}"
            previous.path = previous.path or section.path
        else:
            merged.append(_Section(path=section.path, body=section.body, offset=section.offset))

    chunks: list[Chunk] = []
    for section in merged:
        for content, offset in _pack_paragraphs(section, chunk_size, chunk_overlap):
            if not content.strip():
                continue
            index = len(chunks) + 1
            chunks.append(
                Chunk(
                    chunk_id=f"{document_id}::c{index:03d}",
                    document_id=document_id,
                    document_name=document_name,
                    index=index,
                    content=content,
                    section=section.path,
                    source_path=source_path,
                    char_count=len(content),
                    start_offset=offset,
                )
            )

    return chunks


def split_document(
    *,
    text: str,
    relative_path: str | Path,
    document_name: str,
    chunk_size: int = 500,
    chunk_overlap: int = 100,
) -> list[Chunk]:
    """Convenience wrapper that derives the document id from the path."""
    return split_text(
        text,
        document_id=make_document_id(relative_path),
        document_name=document_name,
        source_path=str(relative_path).replace("\\", "/"),
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
