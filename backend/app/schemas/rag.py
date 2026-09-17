"""Retrieval / grounded-generation contract models."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from .common import TraceStep

RetrieverKind = Literal["keyword", "vector", "hybrid"]


class RetrievedChunk(BaseModel):
    """A candidate passage with every score that produced its final rank.

    Keeping the intermediate scores (keyword / vector / fused / rerank) is what
    makes the retrieval explainable in the UI -- the Knowledge Explorer and the
    eval harness both read this model.
    """

    chunk_id: str
    document_id: str
    document_name: str
    index: int = 0
    section: str = ""
    content: str
    preview: str = ""
    char_count: int = 0

    score: float = Field(default=0.0, description="最终用于排序的分数")
    keyword_score: float = 0.0
    vector_score: float = 0.0
    fused_score: float = 0.0
    rerank_score: float | None = None

    rank_keyword: int | None = None
    rank_vector: int | None = None
    rank_fused: int | None = None
    rank_final: int | None = None

    found_by: list[str] = Field(default_factory=list, description="命中该片段的检索分支")
    matched_terms: list[str] = Field(default_factory=list)


class Citation(BaseModel):
    """Inline ``[n]`` reference resolved back to a chunk."""

    index: int = Field(description="正文中的角标编号，从 1 开始")
    chunk_id: str
    document_id: str
    document_name: str
    section: str = ""
    snippet: str = Field(description="被引用的原文片段，用于抽屉展示")
    score: float = 0.0


class SourceRef(BaseModel):
    """Per-document roll-up of the citations."""

    document_id: str
    document_name: str
    chunk_count: int = 0
    best_score: float = 0.0
    citation_indexes: list[int] = Field(default_factory=list)


class RetrievalStats(BaseModel):
    """Numbers shown next to the retrieval step in the UI."""

    mode: RetrieverKind = "hybrid"
    candidate_count: int = 0
    keyword_hits: int = 0
    vector_hits: int = 0
    after_fusion: int = 0
    after_rerank: int = 0
    rerank_provider: str = "heuristic"
    fusion_strategy: str = "rrf"


class UsageInfo(BaseModel):
    """Token accounting when the provider reports it."""

    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class ChatMessage(BaseModel):
    """Conversation turn."""

    role: Literal["user", "assistant", "system"]
    content: str


class RagQueryRequest(BaseModel):
    """Body for /rag/query and /chat."""

    question: str = Field(min_length=1, max_length=4000)
    top_k: int | None = Field(default=None, ge=1, le=50)
    rerank_top_k: int | None = Field(default=None, ge=1, le=20)
    mode: RetrieverKind | None = None
    rerank_provider: Literal["off", "heuristic", "llm"] | None = None
    allow_general_fallback: bool | None = None
    history: list[ChatMessage] = Field(default_factory=list)


class RagQueryResponse(BaseModel):
    """Grounded answer with full provenance."""

    question: str
    answer: str
    grounded: bool = Field(description="回答是否完全基于检索到的知识库片段")
    fallback_used: bool = False
    citations: list[Citation] = Field(default_factory=list)
    sources: list[SourceRef] = Field(default_factory=list)
    retrieved_chunks: list[RetrievedChunk] = Field(default_factory=list)
    trace: list[TraceStep] = Field(default_factory=list)
    stats: RetrievalStats = Field(default_factory=RetrievalStats)
    latency_ms: float = 0.0
    usage: UsageInfo = Field(default_factory=UsageInfo)
    prompt_version: str = ""
    model: str = ""


class RetrieveOnlyResponse(BaseModel):
    """Retrieval without generation -- powers the Explorer and the evaluator."""

    query: str
    stats: RetrievalStats = Field(default_factory=RetrievalStats)
    items: list[RetrievedChunk] = Field(default_factory=list)
    latency_ms: float = 0.0
