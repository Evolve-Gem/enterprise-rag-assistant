"""Observability contracts: the activity ledger."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

ActivityKind = Literal["rag_query", "chat", "agent_run", "solution", "evaluation", "knowledge", "system"]
ActivityStatus = Literal["success", "failed", "blocked", "skipped"]


class ActivityRecord(BaseModel):
    """One executed operation, safe to persist (no secrets)."""

    id: str
    kind: ActivityKind
    title: str
    detail: str = ""
    status: ActivityStatus = "success"
    intent: str | None = None
    skill: str | None = None
    tools: list[str] = Field(default_factory=list)
    latency_ms: float = 0.0
    source_ids: list[str] = Field(default_factory=list)
    source_names: list[str] = Field(default_factory=list)
    citation_count: int = 0
    chunk_count: int = 0
    grounded: bool | None = None
    engine: str | None = None
    model: str | None = None
    error: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    meta: dict[str, Any] = Field(default_factory=dict)


class ActivityListResponse(BaseModel):
    """Filtered activity page."""

    items: list[ActivityRecord] = Field(default_factory=list)
    total: int = 0
    offset: int = 0
    limit: int = 0


class ActivityStats(BaseModel):
    """Roll-up used by the Insights → Activity page."""

    total: int = 0
    by_kind: dict[str, int] = Field(default_factory=dict)
    by_status: dict[str, int] = Field(default_factory=dict)
    by_skill: dict[str, int] = Field(default_factory=dict)
    failure_count: int = 0
    success_rate: float = 0.0
    average_latency_ms: float = 0.0
    p95_latency_ms: float = 0.0
    last_activity_at: datetime | None = None
    backend: str = "sqlite"
