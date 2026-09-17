"""RAG application service: query orchestration + activity logging."""

from __future__ import annotations

from ..core.config import Settings, get_settings
from ..core.logging import get_logger
from ..rag.index import KnowledgeIndex, get_index
from ..rag.pipeline import RagPipeline
from ..schemas.rag import RagQueryRequest, RagQueryResponse, RetrieveOnlyResponse
from .activity_service import ActivityService, get_activity_service

logger = get_logger("app.services.rag")


class RagService:
    """Thin orchestration layer over :class:`RagPipeline`."""

    def __init__(
        self,
        settings: Settings | None = None,
        index: KnowledgeIndex | None = None,
        activity: ActivityService | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self._index = index
        self._activity = activity

    @property
    def index(self) -> KnowledgeIndex:
        if self._index is None:
            self._index = get_index(self.settings)
        return self._index

    @property
    def activity(self) -> ActivityService:
        if self._activity is None:
            self._activity = get_activity_service(self.settings)
        return self._activity

    @property
    def pipeline(self) -> RagPipeline:
        return RagPipeline(self.index, self.settings)

    # ------------------------------------------------------------------
    def query(self, request: RagQueryRequest, *, kind: str = "rag_query") -> RagQueryResponse:
        """Answer a question and record the run in the activity ledger."""
        response = self.pipeline.answer(
            request.question,
            top_k=request.top_k,
            rerank_top_k=request.rerank_top_k,
            mode=request.mode,
            rerank_provider=request.rerank_provider,
            allow_general_fallback=request.allow_general_fallback,
            history=request.history,
        )

        self.activity.record(
            kind=kind,
            title=request.question[:200],
            detail=response.answer[:600],
            status="success" if response.answer else "failed",
            latency_ms=response.latency_ms,
            source_ids=[item.document_id for item in response.sources],
            source_names=[item.document_name for item in response.sources],
            citation_count=len(response.citations),
            chunk_count=len(response.retrieved_chunks),
            grounded=response.grounded,
            model=response.model,
            meta={
                "mode": response.stats.mode,
                "keyword_hits": response.stats.keyword_hits,
                "vector_hits": response.stats.vector_hits,
                "after_rerank": response.stats.after_rerank,
                "prompt_version": response.prompt_version,
                "fallback": response.fallback_used,
                "tokens": response.usage.total_tokens,
            },
        )
        return response

    def chat(self, request: RagQueryRequest) -> RagQueryResponse:
        """Conversational variant (kept as a separate activity kind)."""
        return self.query(request, kind="chat")

    def retrieve_only(
        self,
        query: str,
        *,
        k: int | None = None,
        mode: str | None = None,
        rerank_provider: str | None = None,
    ) -> RetrieveOnlyResponse:
        """Retrieval without generation (Explorer / debugging / evaluation)."""
        return self.pipeline.retrieve_only(
            query, k=k, mode=mode, rerank_provider=rerank_provider
        )


_service: RagService | None = None


def get_rag_service(settings: Settings | None = None) -> RagService:
    """Process-wide RAG service."""
    global _service
    if _service is None:
        _service = RagService(settings or get_settings())
    return _service


def reset_rag_service() -> None:
    """Drop the singleton (tests)."""
    global _service
    _service = None
