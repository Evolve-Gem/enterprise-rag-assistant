"""Retrievers: keyword, vector and the hybrid that fuses them.

The interface is deliberately narrow (``retrieve(query, k) -> RetrievalOutcome``)
so that the agent layer never needs to know which branch ran.  Three concrete
implementations:

``KeywordRetriever``
    BM25 over the heading-aware chunks.  Strong on exact product names, error
    codes and rare tokens; blind to paraphrase.

``VectorRetriever``
    Cosine search over the configured embedding space.  Handles paraphrase and
    cross-lingual-ish wording; weak on rare proper nouns.

``HybridRetriever``
    Runs both and fuses the rankings.  Two fusion strategies are implemented:

    * ``rrf`` (default) -- Reciprocal Rank Fusion, ``Σ 1/(k + rank)``.  Rank
      based, so it needs no score calibration between the two branches.
    * ``weighted`` -- min-max normalised score blending with ``FUSION_ALPHA``
      controlling the vector weight.

    RRF is the default precisely because it is scale-free: BM25 scores and
    cosine similarities are not comparable, and pretending otherwise is the
    classic hybrid-retrieval bug.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from ..core.config import Settings, get_settings
from ..core.logging import get_logger
from ..schemas.rag import RetrievalStats, RetrievedChunk
from .index import KnowledgeIndex
from .splitter import Chunk
from .text import snippet

logger = get_logger("app.rag.retriever")


@dataclass
class RetrievalOutcome:
    """Candidates plus the statistics shown in the UI."""

    chunks: list[RetrievedChunk] = field(default_factory=list)
    stats: RetrievalStats = field(default_factory=RetrievalStats)
    latency_ms: float = 0.0


class Retriever(ABC):
    """Common interface for every retrieval strategy."""

    mode: str = "abstract"

    def __init__(self, index: KnowledgeIndex, settings: Settings | None = None) -> None:
        self.index = index
        self.settings = settings or get_settings()

    @abstractmethod
    def retrieve(self, query: str, k: int | None = None) -> RetrievalOutcome:
        """Return up to ``k`` candidates for ``query``."""

    # ------------------------------------------------------------------
    @staticmethod
    def _build(
        chunk: Chunk,
        *,
        keyword_score: float = 0.0,
        vector_score: float = 0.0,
        matched_terms: list[str] | None = None,
        found_by: list[str] | None = None,
        query: str = "",
    ) -> RetrievedChunk:
        return RetrievedChunk(
            chunk_id=chunk.chunk_id,
            document_id=chunk.document_id,
            document_name=chunk.document_name,
            index=chunk.index,
            section=chunk.section,
            content=chunk.content,
            preview=snippet(chunk.content, query, limit=220),
            char_count=chunk.char_count,
            keyword_score=round(keyword_score, 6),
            vector_score=round(vector_score, 6),
            found_by=found_by or [],
            matched_terms=sorted(set(matched_terms or [])),
        )


class KeywordRetriever(Retriever):
    """BM25-only retrieval."""

    mode = "keyword"

    def retrieve(self, query: str, k: int | None = None) -> RetrievalOutcome:
        top_k = k or self.settings.retrieval_top_k
        hits = self.index.keyword_search(query, k=top_k)
        chunks = [
            self._build(
                chunk,
                keyword_score=score,
                matched_terms=terms,
                found_by=["keyword"],
                query=query,
            )
            for chunk, score, terms in hits
        ]

        max_score = max((item.keyword_score for item in chunks), default=0.0) or 1.0
        for rank, item in enumerate(chunks, start=1):
            item.fused_score = round(item.keyword_score / max_score, 6)
            item.score = item.fused_score
            item.rank_keyword = rank
            item.rank_fused = rank

        stats = RetrievalStats(
            mode="keyword",
            candidate_count=len(self.index.chunks),
            keyword_hits=len(chunks),
            after_fusion=len(chunks),
            fusion_strategy="none",
            rerank_provider=self.settings.rerank_provider,
        )
        return RetrievalOutcome(chunks=chunks, stats=stats)


class VectorRetriever(Retriever):
    """Dense-only retrieval (degrades to an empty result when unconfigured)."""

    mode = "vector"

    def retrieve(self, query: str, k: int | None = None) -> RetrievalOutcome:
        top_k = k or self.settings.retrieval_top_k
        hits = self.index.vector_search(query, k=top_k)
        chunks = [
            self._build(
                chunk,
                vector_score=score,
                found_by=["vector"],
                query=query,
            )
            for chunk, score in hits
        ]

        max_score = max((item.vector_score for item in chunks), default=0.0) or 1.0
        for rank, item in enumerate(chunks, start=1):
            item.fused_score = round(max(item.vector_score, 0.0) / max_score, 6)
            item.score = item.fused_score
            item.rank_vector = rank
            item.rank_fused = rank

        stats = RetrievalStats(
            mode="vector",
            candidate_count=len(self.index.chunks),
            vector_hits=len(chunks),
            after_fusion=len(chunks),
            fusion_strategy="none",
            rerank_provider=self.settings.rerank_provider,
        )
        return RetrievalOutcome(chunks=chunks, stats=stats)


class HybridRetriever(Retriever):
    """Keyword + vector with rank fusion."""

    mode = "hybrid"

    def __init__(
        self,
        index: KnowledgeIndex,
        settings: Settings | None = None,
        *,
        keyword: Retriever | None = None,
        vector: Retriever | None = None,
    ) -> None:
        super().__init__(index, settings)
        self.keyword = keyword or KeywordRetriever(index, self.settings)
        self.vector = vector or VectorRetriever(index, self.settings)

    # ------------------------------------------------------------------
    def _fuse_rrf(self, keyword_items: list[RetrievedChunk], vector_items: list[RetrievedChunk]) -> dict[str, float]:
        """Reciprocal Rank Fusion -- scale free, no score calibration needed."""
        rrf_k = max(self.settings.rrf_k, 1)
        scores: dict[str, float] = {}
        for rank, item in enumerate(keyword_items, start=1):
            scores[item.chunk_id] = scores.get(item.chunk_id, 0.0) + 1.0 / (rrf_k + rank)
        for rank, item in enumerate(vector_items, start=1):
            scores[item.chunk_id] = scores.get(item.chunk_id, 0.0) + 1.0 / (rrf_k + rank)
        return scores

    def _fuse_weighted(
        self, keyword_items: list[RetrievedChunk], vector_items: list[RetrievedChunk]
    ) -> dict[str, float]:
        """Min-max normalised score blending."""
        alpha = min(max(self.settings.fusion_alpha, 0.0), 1.0)

        def normalise(items: list[RetrievedChunk], attribute: str) -> dict[str, float]:
            values = [getattr(item, attribute) for item in items]
            if not values:
                return {}
            low, high = min(values), max(values)
            span = (high - low) or 1.0
            return {item.chunk_id: (getattr(item, attribute) - low) / span for item in items}

        keyword_scores = normalise(keyword_items, "keyword_score")
        vector_scores = normalise(vector_items, "vector_score")

        scores: dict[str, float] = {}
        for chunk_id in set(keyword_scores) | set(vector_scores):
            scores[chunk_id] = (1.0 - alpha) * keyword_scores.get(chunk_id, 0.0) + alpha * vector_scores.get(
                chunk_id, 0.0
            )
        return scores

    # ------------------------------------------------------------------
    def retrieve(self, query: str, k: int | None = None) -> RetrievalOutcome:
        top_k = k or self.settings.retrieval_top_k
        # Each branch retrieves a wider candidate pool than the final top-k;
        # fusion quality depends on the branch rankings overlapping.
        branch_k = max(top_k * 2, top_k + 4)

        keyword_outcome = self.keyword.retrieve(query, k=branch_k)
        vector_outcome = self.vector.retrieve(query, k=branch_k)

        by_id: dict[str, RetrievedChunk] = {}
        for item in keyword_outcome.chunks:
            by_id[item.chunk_id] = item
        for item in vector_outcome.chunks:
            existing = by_id.get(item.chunk_id)
            if existing is None:
                by_id[item.chunk_id] = item
            else:
                existing.vector_score = item.vector_score
                existing.rank_vector = item.rank_vector
                existing.found_by = sorted(set(existing.found_by) | {"vector"})

        if not by_id:
            return RetrievalOutcome(
                chunks=[],
                stats=RetrievalStats(
                    mode="hybrid",
                    candidate_count=len(self.index.chunks),
                    keyword_hits=0,
                    vector_hits=0,
                    after_fusion=0,
                    after_rerank=0,
                    rerank_provider=self.settings.rerank_provider,
                    fusion_strategy=self.settings.fusion_strategy,
                ),
            )

        strategy = (self.settings.fusion_strategy or "rrf").lower()
        fused = (
            self._fuse_weighted(keyword_outcome.chunks, vector_outcome.chunks)
            if strategy == "weighted"
            else self._fuse_rrf(keyword_outcome.chunks, vector_outcome.chunks)
        )

        ordered = sorted(
            by_id.values(),
            key=lambda item: (-fused.get(item.chunk_id, 0.0), -item.keyword_score, -item.vector_score),
        )[:top_k]

        max_fused = max((fused.get(item.chunk_id, 0.0) for item in ordered), default=0.0) or 1.0
        for rank, item in enumerate(ordered, start=1):
            raw = fused.get(item.chunk_id, 0.0)
            item.fused_score = round(raw / max_fused, 6)
            item.score = item.fused_score
            item.rank_fused = rank
            if "keyword" in item.found_by and item.rank_keyword is None:
                for position, candidate in enumerate(keyword_outcome.chunks, start=1):
                    if candidate.chunk_id == item.chunk_id:
                        item.rank_keyword = position
                        break

        stats = RetrievalStats(
            mode="hybrid",
            candidate_count=len(self.index.chunks),
            keyword_hits=len(keyword_outcome.chunks),
            vector_hits=len(vector_outcome.chunks),
            after_fusion=len(ordered),
            rerank_provider=self.settings.rerank_provider,
            fusion_strategy=strategy,
        )
        return RetrievalOutcome(chunks=ordered, stats=stats)


def create_retriever(
    index: KnowledgeIndex,
    settings: Settings | None = None,
    mode: str | None = None,
) -> Retriever:
    """Build the retriever for the requested (or configured) mode.

    Falls back to keyword retrieval whenever the vector branch cannot run, so
    the API never fails just because embeddings are unavailable.
    """
    settings = settings or get_settings()
    resolved = (mode or settings.effective_retriever_mode or "hybrid").lower()

    if resolved == "keyword":
        return KeywordRetriever(index, settings)

    if resolved == "vector":
        if index.embedder is None or not index._vectorised_ids:  # noqa: SLF001 - internal probe
            logger.info("Vector retrieval unavailable; using keyword retriever.")
            return KeywordRetriever(index, settings)
        return VectorRetriever(index, settings)

    if index.embedder is None or not index._vectorised_ids:  # noqa: SLF001
        logger.info("Hybrid unavailable (no vectors); using keyword retriever.")
        return KeywordRetriever(index, settings)

    return HybridRetriever(index, settings)
