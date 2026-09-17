"""Agent layer contracts: skills, tools, runs and traces."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from .common import TraceStep
from .rag import Citation, RetrievedChunk, SourceRef, UsageInfo

OutputType = Literal["answer", "solution", "report", "analysis"]
ToolStatus = Literal["success", "failed", "skipped"]


class SkillInfo(BaseModel):
    """A business capability the agent can select."""

    id: str
    name: str
    description: str
    intents: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)
    output_type: OutputType = "report"
    requires_retrieval: bool = False
    enabled: bool = True


class ToolInfo(BaseModel):
    """A concrete function an agent step can execute."""

    name: str
    description: str
    category: str = "knowledge"
    read_only: bool = True
    parameters: list[str] = Field(default_factory=list)
    returns: str = ""


class ToolCallRecord(BaseModel):
    """Structured record of one tool invocation."""

    name: str
    status: ToolStatus = "success"
    duration_ms: float = 0.0
    summary: str = ""
    inputs: dict[str, Any] = Field(default_factory=dict)
    outputs: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None


class PlanStep(BaseModel):
    """One planned step produced by the planner node."""

    index: int
    node: str
    title: str
    rationale: str = ""
    tool: str | None = None


class IntentDecision(BaseModel):
    """Result of the intent router."""

    intent: str
    skill: str
    confidence: float = Field(ge=0.0, le=1.0, default=0.5)
    matched_rule: str = ""
    reasoning: str = ""
    candidates: list[dict[str, Any]] = Field(default_factory=list)


class AgentRunRequest(BaseModel):
    """Body for /agent/run."""

    task: str = Field(min_length=1, max_length=6000)
    preferred_intent: str | None = None
    allow_general_fallback: bool | None = None
    engine: Literal["auto", "native", "langgraph"] | None = None
    max_steps: int | None = Field(default=None, ge=1, le=30)
    require_human_check: bool = False


class AgentRunResponse(BaseModel):
    """Full, observable result of one agent run."""

    run_id: str
    task: str
    engine: str
    intent: str
    intent_confidence: float = 0.0
    skill: str
    skill_name: str = ""
    plan: list[PlanStep] = Field(default_factory=list)
    tool_calls: list[ToolCallRecord] = Field(default_factory=list)
    trace: list[TraceStep] = Field(default_factory=list)
    output_type: OutputType = "report"
    answer: str = ""
    analysis: str = ""
    citations: list[Citation] = Field(default_factory=list)
    sources: list[SourceRef] = Field(default_factory=list)
    retrieved_chunks: list[RetrievedChunk] = Field(default_factory=list)
    used_general_fallback: bool = False
    human_check_required: bool = False
    human_check_reason: str = ""
    warnings: list[str] = Field(
        default_factory=list,
        description="执行过程中的非致命问题，例如知识库未命中、Tool 失败、引用越界。",
    )
    skipped_nodes: list[str] = Field(
        default_factory=list, description="被显式跳过的图节点"
    )
    latency_ms: float = 0.0
    usage: UsageInfo = Field(default_factory=UsageInfo)
    model: str = ""


class AgentCatalogResponse(BaseModel):
    """Skills + tools + engines exposed to the workspace UI."""

    skills: list[SkillInfo] = Field(default_factory=list)
    tools: list[ToolInfo] = Field(default_factory=list)
    engines: list[str] = Field(default_factory=list)
    active_engine: str = "native"
    intents: list[dict[str, str]] = Field(default_factory=list)
