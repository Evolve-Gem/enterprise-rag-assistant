"""Shared response primitives used across every router."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field

TraceStatus = Literal["pending", "running", "success", "skipped", "failed", "warning"]


def utc_now() -> datetime:
    """Timezone-aware UTC timestamp."""
    return datetime.now(timezone.utc)


class ErrorDetail(BaseModel):
    """Single field-level error."""

    field: str = Field(description="出错的请求字段")
    reason: str = Field(description="失败原因")


class ErrorBody(BaseModel):
    """Machine-readable error payload."""

    code: str = Field(description="稳定的错误码，供前端分支处理")
    message: str = Field(description="面向用户的中文提示")
    details: dict[str, Any] = Field(default_factory=dict, description="补充上下文")


class ErrorEnvelope(BaseModel):
    """Envelope returned for every non-2xx response."""

    error: ErrorBody


class TraceStep(BaseModel):
    """One node of an agent/retrieval execution trace."""

    index: int = Field(description="步骤序号，从 1 开始")
    node: str = Field(description="节点标识，例如 intent_router")
    title: str = Field(description="人类可读的步骤标题")
    status: TraceStatus = Field(default="success")
    duration_ms: float = Field(default=0.0, description="该步骤耗时（毫秒）")
    summary: str = Field(default="", description="一句话结论")
    detail: str = Field(default="", description="展开后的详细信息")
    tool: str | None = Field(default=None, description="该步骤调用的工具")
    inputs: dict[str, Any] = Field(default_factory=dict)
    outputs: dict[str, Any] = Field(default_factory=dict)


class ProviderStatus(BaseModel):
    """Non-secret view of a configured external provider."""

    provider: str
    model: str
    configured: bool
    key_hint: str = ""
    base_url: str = ""


class HealthResponse(BaseModel):
    """Liveness/readiness payload."""

    status: Literal["ok", "degraded"]
    version: str
    environment: str
    agent_engine: str
    index_ready: bool
    index_document_count: int = 0
    index_chunk_count: int = 0
    llm_configured: bool = False
    checked_at: datetime = Field(default_factory=utc_now)


class MessageResponse(BaseModel):
    """Generic acknowledgement."""

    ok: bool = True
    message: str = ""
