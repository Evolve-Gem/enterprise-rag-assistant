"""Knowledge insights (coverage & gap analysis) and dashboard overview."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

CoverageStatus = Literal["covered", "partial", "missing"]


class CoverageItem(BaseModel):
    """Coverage verdict for one knowledge category.

    ``status`` is derived deterministically from the indexed corpus; no score is
    invented when it cannot be computed.
    """

    category: str
    label: str
    status: CoverageStatus
    description: str = ""
    document_count: int = 0
    evidence_documents: list[str] = Field(default_factory=list)
    matched_keywords: list[str] = Field(default_factory=list)
    reason: str = ""
    suggested_documents: list[str] = Field(default_factory=list)


class GapReport(BaseModel):
    """Coverage roll-up plus an actionable shopping list."""

    coverage: list[CoverageItem] = Field(default_factory=list)
    covered: list[str] = Field(default_factory=list)
    partial: list[str] = Field(default_factory=list)
    missing: list[str] = Field(default_factory=list)
    recommended_documents: list[dict[str, str]] = Field(default_factory=list)
    coverage_ratio: float = Field(
        default=0.0,
        description="covered / total，基于规则的确定性比例，不是模型评分",
    )
    analyzed_document_count: int = 0
    analyzed_chunk_count: int = 0
    generated_at: datetime | None = None


class OverviewKnowledge(BaseModel):
    document_count: int = 0
    indexed_document_count: int = 0
    chunk_count: int = 0
    total_chars: int = 0
    last_indexed_at: datetime | None = None
    index_state: str = "empty"
    category_breakdown: dict[str, int] = Field(default_factory=dict)


class OverviewAgent(BaseModel):
    run_count: int = 0
    successful_runs: int = 0
    skill_count: int = 0
    tool_count: int = 0
    tool_call_count: int = 0
    success_rate: float = 0.0
    engine: str = "native"
    top_skills: list[dict[str, object]] = Field(default_factory=list)


class OverviewRag(BaseModel):
    question_count: int = 0
    answered_count: int = 0
    grounded_rate: float = 0.0
    retrieval_hit_count: int = 0
    citation_count: int = 0
    average_latency_ms: float = 0.0
    average_citations: float = 0.0


class OverviewSystem(BaseModel):
    llm_provider: str = ""
    llm_model: str = ""
    llm_configured: bool = False
    retriever_mode: str = ""
    embedding_provider: str = ""
    embedding_model: str = ""
    index_state: str = "empty"
    read_only: bool = False
    password_required: bool = False
    version: str = ""
    environment: str = ""


class ActivityRef(BaseModel):
    """Compact activity row reused by the dashboard lists."""

    id: str
    kind: str
    title: str
    detail: str = ""
    status: str = "success"
    latency_ms: float = 0.0
    created_at: datetime | None = None
    skill: str | None = None
    intent: str | None = None
    citations: int = 0


class QuickAction(BaseModel):
    id: str
    label: str
    description: str = ""
    href: str = ""
    icon: str = ""
    enabled: bool = True


class OverviewResponse(BaseModel):
    """Single aggregate call that powers the dashboard."""

    knowledge: OverviewKnowledge = Field(default_factory=OverviewKnowledge)
    agent: OverviewAgent = Field(default_factory=OverviewAgent)
    rag: OverviewRag = Field(default_factory=OverviewRag)
    system: OverviewSystem = Field(default_factory=OverviewSystem)
    recent_activity: list[ActivityRef] = Field(default_factory=list)
    recent_questions: list[ActivityRef] = Field(default_factory=list)
    recent_documents: list[dict[str, object]] = Field(default_factory=list)
    coverage_summary: dict[str, object] = Field(default_factory=dict)
    quick_actions: list[QuickAction] = Field(default_factory=list)
    generated_at: datetime | None = None
    data_available: bool = Field(
        default=True,
        description="False 表示系统尚未产生真实数据，前端应展示 empty state",
    )
    notes: list[str] = Field(default_factory=list)
