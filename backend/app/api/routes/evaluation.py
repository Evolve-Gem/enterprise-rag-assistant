"""Evaluation Center endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from ...schemas.common import MessageResponse
from ...schemas.evaluation import (
    EvalCase,
    EvalCaseCreate,
    EvalDatasetResponse,
    EvalFeedbackRequest,
    EvalFeedbackResponse,
    EvalRunRequest,
    EvalRunResponse,
    EvalRunSummary,
)
from ...services.activity_service import get_activity_service
from ...services.evaluation_service import get_evaluation_service
from ..deps import AuthDep, SettingsDep

router = APIRouter(prefix="/api/evaluation", tags=["evaluation"])


@router.get("/dataset", response_model=EvalDatasetResponse, summary="评测数据集")
def dataset(settings: SettingsDep) -> EvalDatasetResponse:
    """The frozen evaluation questions (auto-seeded from the knowledge base)."""
    return get_evaluation_service(settings).load_dataset()


@router.post(
    "/dataset",
    response_model=EvalCase,
    summary="新增评测用例",
    dependencies=[AuthDep],
)
def add_case(payload: EvalCaseCreate, settings: SettingsDep) -> EvalCase:
    """Add one evaluation question."""
    return get_evaluation_service(settings).add_case(
        question=payload.question,
        expected_keywords=payload.expected_keywords,
        expected_document_ids=payload.expected_document_ids,
        notes=payload.notes,
    )


@router.post(
    "/dataset/seed",
    response_model=EvalDatasetResponse,
    summary="重置为内置种子数据集",
    dependencies=[AuthDep],
)
def seed(settings: SettingsDep) -> EvalDatasetResponse:
    """Rebuild the starter dataset from the current knowledge base."""
    service = get_evaluation_service(settings)
    service.seed_dataset(overwrite=True)
    return service.load_dataset()


@router.delete(
    "/dataset/{case_id}",
    response_model=MessageResponse,
    summary="删除评测用例",
    dependencies=[AuthDep],
)
def delete_case(case_id: str, settings: SettingsDep) -> MessageResponse:
    """Remove one case."""
    get_evaluation_service(settings).delete_case(case_id)
    return MessageResponse(ok=True, message=f"已删除用例 {case_id}。")


@router.post(
    "/run",
    response_model=EvalRunResponse,
    summary="运行检索评测（Hit@K / MRR / Recall）",
    dependencies=[AuthDep],
)
def run(payload: EvalRunRequest, settings: SettingsDep) -> EvalRunResponse:
    """Execute the retrieval evaluation and record it in the activity ledger."""
    response = get_evaluation_service(settings).run(
        case_ids=payload.case_ids,
        k=payload.k,
        mode=payload.mode,
        rerank_provider=payload.rerank_provider,
        generate_answers=payload.generate_answers,
    )

    summary = response.summary
    activity = get_activity_service(settings)
    activity.record(
        kind="evaluation",
        title=f"检索评测 k={summary.k}｜{summary.case_count} 个用例",
        detail=(
            f"Hit@{summary.k}={summary.hit_at_k:.0%}｜MRR={summary.mrr:.3f}｜"
            f"Recall={summary.recall_at_k:.0%}｜关键词覆盖={summary.keyword_coverage:.0%}"
        ),
        status="success",
        latency_ms=summary.duration_ms,
        model=settings.llm_model,
        meta={
            "hit_at_k": summary.hit_at_k,
            "mrr": summary.mrr,
            "recall_at_k": summary.recall_at_k,
            "keyword_coverage": summary.keyword_coverage,
            "mode": summary.mode,
            "rigorous_note": "answer_accuracy 仅来自人工评分",
        },
    )
    return response


@router.get("/runs", response_model=list[EvalRunSummary], summary="历史评测记录")
def runs(settings: SettingsDep, limit: int = 10) -> list[EvalRunSummary]:
    """Newest evaluation runs first."""
    return get_evaluation_service(settings).run_history(limit=limit)


@router.post(
    "/feedback",
    response_model=EvalFeedbackResponse,
    summary="人工评分（Correct / Partial / Wrong）",
    dependencies=[AuthDep],
)
def feedback(payload: EvalFeedbackRequest, settings: SettingsDep) -> EvalFeedbackResponse:
    """Record a human judgement of one answer."""
    graded, accuracy = get_evaluation_service(settings).set_grade(
        payload.case_id, payload.grade, payload.note
    )
    return EvalFeedbackResponse(
        case_id=payload.case_id,
        grade=payload.grade,
        total_graded=graded,
        answer_accuracy=accuracy,
    )
