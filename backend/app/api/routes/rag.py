"""RAG query, chat and retrieval-only endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from ...schemas.rag import RagQueryRequest, RagQueryResponse, RetrieveOnlyResponse
from ...services.rag_service import get_rag_service
from ..deps import AuthDep, SettingsDep

router = APIRouter(prefix="/api", tags=["rag"])


@router.post(
    "/rag/query",
    response_model=RagQueryResponse,
    summary="知识库问答（带引用与完整轨迹）",
    dependencies=[AuthDep],
)
def rag_query(payload: RagQueryRequest, settings: SettingsDep) -> RagQueryResponse:
    """Grounded answer with citations, sources and a per-stage trace."""
    return get_rag_service(settings).query(payload)


@router.post(
    "/chat",
    response_model=RagQueryResponse,
    summary="多轮对话问答",
    dependencies=[AuthDep],
)
def chat(payload: RagQueryRequest, settings: SettingsDep) -> RagQueryResponse:
    """Same pipeline as ``/rag/query`` but history-aware.

    History is passed to the model only to resolve pronouns; the system prompt
    explicitly forbids treating prior turns as evidence.
    """
    return get_rag_service(settings).chat(payload)


@router.get(
    "/rag/retrieve",
    response_model=RetrieveOnlyResponse,
    summary="仅检索（不调用模型）",
)
def retrieve(
    settings: SettingsDep,
    q: Annotated[str, Query(min_length=1, description="查询语句")],
    top_k: Annotated[int, Query(ge=1, le=50)] = 8,
    mode: Annotated[str, Query(description="keyword | vector | hybrid")] = "",
    rerank: Annotated[bool, Query(description="是否启用重排序")] = True,
) -> RetrieveOnlyResponse:
    """Retrieval debugging endpoint: shows every score without generating text."""
    service = get_rag_service(settings)
    if rerank:
        return service.retrieve_only(q, k=top_k, mode=mode or None)
    return service.pipeline.retrieve_only(q, k=top_k, mode=mode or None, rerank=False)
