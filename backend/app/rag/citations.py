"""Citation construction and grounding checks.

The contract with the model is: *the numbered context block you were given is
the citation namespace*.  ``[3]`` in the answer means the third block below --
nothing else.  This module owns both sides of that contract:

* :func:`format_context` renders the numbered block that goes into the prompt
* :func:`build_citations` turns the same ordering into :class:`Citation` rows
* :func:`analyse_grounding` extracts which indexes the answer actually used,
  which is what drives the "未引用" warning and the grounded/ungrounded badge
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from ..schemas.rag import Citation, RetrievedChunk, SourceRef
from .text import snippet

_CITATION_RE = re.compile(r"\[(\d{1,3})\]")
# Model hedges that indicate the answer is not fully supported by the corpus.
_REFUSAL_MARKERS = (
    "无法确定",
    "无法回答",
    "没有相关",
    "未找到",
    "资料不足",
    "知识库中暂无",
    "暂无可引用",
    "暂无相关资料",
    "未命中",
)


def format_context(chunks: list[RetrievedChunk], *, max_chars: int = 1600) -> str:
    """Render the numbered context block used by every grounded prompt."""
    blocks: list[str] = []
    for index, chunk in enumerate(chunks, start=1):
        body = chunk.content.strip()
        if len(body) > max_chars:
            body = body[:max_chars].rstrip() + "…"
        header = f"[{index}] 文档：{chunk.document_name}"
        if chunk.section:
            header += f"｜章节：{chunk.section}"
        blocks.append(f"{header}\n{body}")
    return "\n\n---\n\n".join(blocks)


def build_citations(chunks: list[RetrievedChunk], *, limit: int = 8) -> list[Citation]:
    """Turn the numbered context ordering into citation rows."""
    citations: list[Citation] = []
    for index, chunk in enumerate(chunks[:limit], start=1):
        citations.append(
            Citation(
                index=index,
                chunk_id=chunk.chunk_id,
                document_id=chunk.document_id,
                document_name=chunk.document_name,
                section=chunk.section,
                snippet=snippet(chunk.content, limit=600),
                score=round(chunk.rerank_score if chunk.rerank_score is not None else chunk.fused_score, 6),
            )
        )
    return citations


def build_sources(citations: list[Citation]) -> list[SourceRef]:
    """Roll citations up per document."""
    grouped: dict[str, SourceRef] = {}
    for citation in citations:
        ref = grouped.get(citation.document_id)
        if ref is None:
            grouped[citation.document_id] = SourceRef(
                document_id=citation.document_id,
                document_name=citation.document_name,
                chunk_count=1,
                best_score=citation.score,
                citation_indexes=[citation.index],
            )
        else:
            ref.chunk_count += 1
            ref.best_score = max(ref.best_score, citation.score)
            ref.citation_indexes.append(citation.index)

    return sorted(grouped.values(), key=lambda item: (-item.best_score, item.document_name))


@dataclass
class GroundingReport:
    """What the answer actually used."""

    cited_indexes: list[int]
    uncited_indexes: list[int]
    invalid_indexes: list[int]
    has_citation: bool
    is_refusal: bool

    @property
    def citation_precision(self) -> float:
        """Share of inline citations that resolve to a real context block."""
        total = len(self.cited_indexes) + len(self.invalid_indexes)
        if total == 0:
            return 0.0
        return round(len(self.cited_indexes) / total, 4)


def analyse_grounding(answer: str, citation_count: int) -> GroundingReport:
    """Reconcile the answer text with the numbered context that was supplied."""
    text = answer or ""
    found = {int(match.group(1)) for match in _CITATION_RE.finditer(text)}

    valid = sorted(index for index in found if 1 <= index <= citation_count)
    invalid = sorted(index for index in found if index > citation_count or index < 1)
    uncited = [index for index in range(1, citation_count + 1) if index not in found]
    is_refusal = any(marker in text for marker in _REFUSAL_MARKERS)

    return GroundingReport(
        cited_indexes=valid,
        uncited_indexes=uncited,
        invalid_indexes=invalid,
        has_citation=bool(valid),
        is_refusal=is_refusal,
    )


def strip_invalid_citations(answer: str, citation_count: int) -> str:
    """Remove inline markers that point outside the supplied context.

    A hallucinated ``[7]`` when only four blocks were provided is worse than no
    marker at all, because it looks authoritative.  Dropping it keeps the
    displayed answer honest.
    """
    if citation_count <= 0:
        return _CITATION_RE.sub("", answer or "")

    def replacer(match: re.Match[str]) -> str:
        index = int(match.group(1))
        return match.group(0) if 1 <= index <= citation_count else ""

    return _CITATION_RE.sub(replacer, answer or "")


def used_citations(citations: list[Citation], groundings: GroundingReport) -> list[Citation]:
    """Return only the citations the answer referenced (falls back to all)."""
    if not groundings.cited_indexes:
        return citations
    selected = [item for item in citations if item.index in set(groundings.cited_indexes)]
    return selected or citations
