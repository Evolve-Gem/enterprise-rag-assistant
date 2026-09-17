"""Knowledge base CRUD, upload and reindex endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, Query, UploadFile

from ...core.errors import InvalidRequestError
from ...schemas.common import MessageResponse
from ...schemas.knowledge import (
    ChunkListResponse,
    ChunkSummary,
    DocumentDetail,
    DocumentListResponse,
    DocumentUpdateRequest,
    KnowledgeStats,
    ReindexResult,
    ReindexRequest,
    UploadResult,
)
from ...services.knowledge_service import get_knowledge_service
from ..deps import AuthDep, SettingsDep

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


@router.get("/documents", response_model=DocumentListResponse, summary="文档列表")
def list_documents(
    settings: SettingsDep,
    q: Annotated[str, Query(description="按名称 / 摘要 / 标签模糊搜索")] = "",
    category: Annotated[str, Query(description="按资料分类过滤")] = "",
    status: Annotated[str, Query(description="按解析状态过滤")] = "",
    sort: Annotated[str, Query(description="name | modified | size | chunks")] = "name",
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> DocumentListResponse:
    """Paged document listing with filters, powered by the live index."""
    return get_knowledge_service(settings).list_documents(
        query=q, category=category, status=status, sort=sort, offset=offset, limit=limit
    )


@router.get("/stats", response_model=KnowledgeStats, summary="知识库统计")
def stats(settings: SettingsDep) -> KnowledgeStats:
    """Aggregate counters used by the dashboard and the Documents page."""
    return get_knowledge_service(settings).stats()


@router.post(
    "/upload",
    response_model=UploadResult,
    summary="上传文档（自动解析 + 切分 + 索引）",
    dependencies=[AuthDep],
)
async def upload(
    settings: SettingsDep,
    file: Annotated[UploadFile, File(description="支持 .md / .txt / .pdf / .docx")],
) -> UploadResult:
    """Store an uploaded document and rebuild the index immediately."""
    if file is None or not file.filename:
        raise InvalidRequestError("未选择上传文件。")
    data = await file.read()
    return get_knowledge_service(settings).save_upload(file.filename, data)


@router.post(
    "/reindex",
    response_model=ReindexResult,
    summary="重建知识索引",
    dependencies=[AuthDep],
)
def reindex(settings: SettingsDep, payload: ReindexRequest | None = None) -> ReindexResult:
    """Rebuild documents, chunks, BM25 statistics and vectors."""
    force = bool(payload.force_vectors) if payload else False
    return get_knowledge_service(settings).refresh(force_vectors=force)


@router.get("/chunks/{chunk_id}", response_model=ChunkSummary, summary="单个知识块详情")
def get_chunk(chunk_id: str, settings: SettingsDep) -> ChunkSummary:
    """Fetch one chunk by id (used by the citation drawer)."""
    return get_knowledge_service(settings).get_chunk(chunk_id)


@router.get(
    "/documents/{document_id}",
    response_model=DocumentDetail,
    summary="文档详情（含正文与知识块）",
)
def get_document(document_id: str, settings: SettingsDep) -> DocumentDetail:
    """Document detail for the Knowledge Explorer."""
    return get_knowledge_service(settings).get_document(document_id)


@router.get(
    "/documents/{document_id}/chunks",
    response_model=ChunkListResponse,
    summary="文档知识块列表",
)
def get_document_chunks(document_id: str, settings: SettingsDep) -> ChunkListResponse:
    """Every chunk of one document, in document order."""
    return get_knowledge_service(settings).get_chunks(document_id)


@router.put(
    "/documents/{document_id}",
    response_model=DocumentDetail,
    summary="更新文档内容",
    dependencies=[AuthDep],
)
def update_document(
    document_id: str, payload: DocumentUpdateRequest, settings: SettingsDep
) -> DocumentDetail:
    """Overwrite a Markdown/text document and re-index it."""
    return get_knowledge_service(settings).update_document(document_id, payload.content)


@router.delete(
    "/documents/{document_id}",
    response_model=MessageResponse,
    summary="删除文档",
    dependencies=[AuthDep],
)
def delete_document(document_id: str, settings: SettingsDep) -> MessageResponse:
    """Delete a document from the knowledge base."""
    name, chunks = get_knowledge_service(settings).delete_document(document_id)
    return MessageResponse(ok=True, message=f"已删除 {name}（移除 {chunks} 个知识块）。")
