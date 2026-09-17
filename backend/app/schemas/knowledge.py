"""Knowledge-base request/response models."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

DocumentStatus = Literal["uploaded", "parsing", "indexed", "failed", "unsupported"]
KnowledgeCategory = Literal[
    "product",
    "faq",
    "case",
    "industry_solution",
    "pricing",
    "implementation",
    "support",
    "competitor",
    "agent_knowledge",
    "glossary",
    "other",
]


class ChunkSummary(BaseModel):
    """A retrievable slice of a document."""

    chunk_id: str
    document_id: str
    document_name: str
    index: int = Field(description="文档内序号，从 1 开始")
    char_count: int
    content: str
    preview: str = ""
    section: str = Field(default="", description="最近的 Markdown 标题")
    has_vector: bool = Field(default=False, description="是否已生成向量")


class DocumentSummary(BaseModel):
    """Row model for the document table."""

    id: str = Field(description="稳定 id，由相对路径派生")
    name: str
    title: str
    suffix: str
    type_label: str = Field(description="展示用类型，例如 Markdown / PDF")
    size_bytes: int
    size_human: str
    char_count: int | None = None
    chunk_count: int = 0
    status: DocumentStatus = "uploaded"
    status_label: str = ""
    category: KnowledgeCategory = "other"
    category_label: str = ""
    tags: list[str] = Field(default_factory=list)
    searchable: bool = False
    modified_at: datetime | None = None
    created_at: datetime | None = None


class DocumentDetail(DocumentSummary):
    """Document summary plus the body needed by the Explorer."""

    content: str = ""
    content_truncated: bool = False
    summary: str = Field(default="", description="规则生成的摘要，非模型编造")
    outline: list[str] = Field(default_factory=list, description="Markdown 标题大纲")
    chunks: list[ChunkSummary] = Field(default_factory=list)
    extraction_note: str = ""


class DocumentUpdateRequest(BaseModel):
    """Body for PUT /knowledge/documents/{id}."""

    content: str = Field(description="新的完整正文")


class KnowledgeStats(BaseModel):
    """Aggregate knowledge-base counters."""

    document_count: int = 0
    indexed_document_count: int = 0
    chunk_count: int = 0
    total_chars: int = 0
    total_bytes: int = 0
    searchable_count: int = 0
    failed_count: int = 0
    type_breakdown: dict[str, int] = Field(default_factory=dict)
    category_breakdown: dict[str, int] = Field(default_factory=dict)
    index_state: Literal["ready", "stale", "empty", "building"] = "empty"
    index_note: str = ""
    last_indexed_at: datetime | None = None
    retriever_mode: str = ""
    embedding_provider: str = ""
    vectorized_chunk_count: int = 0


class ReindexRequest(BaseModel):
    """Optional overrides for a manual reindex."""

    force_vectors: bool = Field(default=False, description="忽略缓存并重建向量")


class ReindexResult(BaseModel):
    """Outcome of a reindex run."""

    document_count: int
    chunk_count: int
    vectorized_chunk_count: int
    duration_ms: float
    index_state: str
    note: str = ""


class UploadResult(BaseModel):
    """Outcome of a single file upload."""

    document: DocumentSummary
    chunks_created: int = 0
    warnings: list[str] = Field(default_factory=list)


class DocumentListResponse(BaseModel):
    """Paged document listing."""

    items: list[DocumentSummary]
    total: int
    offset: int
    limit: int


class ChunkListResponse(BaseModel):
    """Chunks of a single document."""

    document_id: str
    items: list[ChunkSummary]
    total: int
