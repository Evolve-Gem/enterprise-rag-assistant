"""Solution Studio contracts: requirement capture, analysis and proposal."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from .common import TraceStep
from .rag import Citation, RetrievedChunk, SourceRef, UsageInfo

SectionKey = Literal[
    "executive_summary",
    "customer_needs",
    "recommended_architecture",
    "product_mapping",
    "implementation_plan",
    "case_references",
    "risks",
    "next_steps",
]


class RequirementForm(BaseModel):
    """Structured customer intake form."""

    customer: str = Field(default="", max_length=200)
    industry: str = Field(default="", max_length=120)
    scenario: str = Field(default="", max_length=2000)
    pain_points: str = Field(default="", max_length=2000)
    requirements: str = Field(default="", max_length=4000)
    constraints: str = Field(default="", max_length=2000)


class RequirementAnalysis(BaseModel):
    """Structured reading of the customer requirement."""

    customer_type: str = ""
    industry: str = ""
    scenario: str = ""
    core_needs: list[str] = Field(default_factory=list)
    pain_points: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    missing_info: list[str] = Field(default_factory=list)
    recommended_direction: str = ""
    search_query: str = Field(default="", description="用于检索的方案查询词")
    raw_text: str = ""
    generated_by: Literal["llm", "rules"] = "rules"


class SolutionRequest(BaseModel):
    """Body for /solutions/generate."""

    requirement: str = Field(default="", max_length=8000)
    form: RequirementForm | None = None
    top_k: int | None = Field(default=None, ge=1, le=50)
    export_language: Literal["zh", "en"] = "zh"


class SolutionSection(BaseModel):
    """One chapter of the generated proposal."""

    key: SectionKey
    title: str
    content: str
    grounded: bool = Field(default=True, description="该章节是否有知识库来源支撑")


class SolutionResponse(BaseModel):
    """Everything the Studio needs to render one proposal."""

    requirement_text: str
    analysis: RequirementAnalysis
    sections: list[SolutionSection] = Field(default_factory=list)
    citations: list[Citation] = Field(default_factory=list)
    sources: list[SourceRef] = Field(default_factory=list)
    retrieved_chunks: list[RetrievedChunk] = Field(default_factory=list)
    trace: list[TraceStep] = Field(default_factory=list)
    markdown: str = ""
    grounded: bool = False
    warnings: list[str] = Field(default_factory=list)
    latency_ms: float = 0.0
    usage: UsageInfo = Field(default_factory=UsageInfo)
    model: str = ""


class RequirementAnalyzeRequest(BaseModel):
    """Body for /solutions/analyze."""

    requirement: str = Field(default="", max_length=8000)
    form: RequirementForm | None = None


class RequirementAnalyzeResponse(BaseModel):
    """Standalone requirement analysis result."""

    requirement_text: str
    analysis: RequirementAnalysis
    latency_ms: float = 0.0
    model: str = ""


class SolutionExportRequest(BaseModel):
    """Body for /solutions/export."""

    format: Literal["markdown", "docx"] = "markdown"
    title: str = Field(default="售前解决方案", max_length=200)
    markdown: str = Field(min_length=1, max_length=200000)
