"""RAG evaluation contracts (retrieval metrics + human answer grading)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

AnswerGrade = Literal["correct", "partial", "wrong", "ungraded"]


class EvalCase(BaseModel):
    """One frozen evaluation question."""

    id: str
    question: str
    expected_keywords: list[str] = Field(
        default_factory=list,
        description="回答应覆盖的关键词；用于量化关键词召回",
    )
    expected_document_ids: list[str] = Field(
        default_factory=list,
        description="预期命中的文档 id；用于 Hit@K / MRR / Recall",
    )
    notes: str = ""
    created_at: datetime | None = None


class EvalCaseCreate(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    expected_keywords: list[str] = Field(default_factory=list)
    expected_document_ids: list[str] = Field(default_factory=list)
    notes: str = Field(default="", max_length=500)


class EvalCaseResult(BaseModel):
    """Per-case outcome of a retrieval evaluation run."""

    case_id: str
    question: str
    retrieved_document_ids: list[str] = Field(default_factory=list)
    retrieved_chunk_ids: list[str] = Field(default_factory=list)
    hit_at_k: bool = False
    first_hit_rank: int | None = Field(default=None, description="1-based，未命中为 None")
    reciprocal_rank: float = 0.0
    recall_at_k: float = 0.0
    keyword_coverage: float = 0.0
    matched_keywords: list[str] = Field(default_factory=list)
    missing_keywords: list[str] = Field(default_factory=list)
    answer_grade: AnswerGrade = "ungraded"
    latency_ms: float = 0.0
    failure_reason: str = ""


class EvalRunSummary(BaseModel):
    """Aggregate metrics for one evaluation run."""

    run_id: str
    case_count: int = 0
    k: int = 0
    mode: str = ""
    hit_at_k: float = 0.0
    mrr: float = 0.0
    recall_at_k: float = 0.0
    keyword_coverage: float = 0.0
    graded_count: int = 0
    correct_count: int = 0
    partial_count: int = 0
    wrong_count: int = 0
    answer_accuracy: float | None = Field(
        default=None,
        description="人工评分准确率；无人工评分时为 None，绝不伪造模型评分",
    )
    average_latency_ms: float = 0.0
    started_at: datetime | None = None
    duration_ms: float = 0.0
    notes: list[str] = Field(default_factory=list)


class EvalRunRequest(BaseModel):
    """Body for /evaluation/run."""

    case_ids: list[str] = Field(default_factory=list, description="留空表示全部用例")
    k: int = Field(default=4, ge=1, le=20)
    mode: Literal["keyword", "vector", "hybrid"] | None = None
    rerank_provider: Literal["off", "heuristic", "llm"] | None = None
    generate_answers: bool = Field(
        default=False,
        description="是否同时生成答案（会增加 LLM 调用与耗时）",
    )


class EvalRunResponse(BaseModel):
    """Full result of an evaluation run."""

    summary: EvalRunSummary
    cases: list[EvalCaseResult] = Field(default_factory=list)


class EvalFeedbackRequest(BaseModel):
    """Human grading of a previously answered case."""

    case_id: str
    grade: AnswerGrade
    note: str = Field(default="", max_length=500)


class EvalFeedbackResponse(BaseModel):
    """Acknowledgement of a grading action."""

    case_id: str
    grade: AnswerGrade
    total_graded: int = 0
    answer_accuracy: float | None = None


class EvalDatasetResponse(BaseModel):
    """The persisted evaluation dataset."""

    cases: list[EvalCase] = Field(default_factory=list)
    total: int = 0
    path: str = ""
