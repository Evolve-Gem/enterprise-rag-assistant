"""Solution Studio endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Response

from ...core.config import get_settings
from ...schemas.solution import (
    RequirementAnalyzeRequest,
    RequirementAnalyzeResponse,
    SolutionExportRequest,
    SolutionRequest,
    SolutionResponse,
)
from ...services.activity_service import get_activity_service
from ...services.requirement_service import analyze_requirement, build_requirement_text
from ...services.solution_service import generate_solution, markdown_to_docx
from ..deps import AuthDep, SettingsDep

router = APIRouter(prefix="/api/solutions", tags=["solutions"])


@router.post(
    "/analyze",
    response_model=RequirementAnalyzeResponse,
    summary="客户需求解析",
    dependencies=[AuthDep],
)
def analyze(payload: RequirementAnalyzeRequest, settings: SettingsDep) -> RequirementAnalyzeResponse:
    """Structure a customer requirement without generating a proposal."""
    requirement_text = build_requirement_text(payload.requirement, payload.form)
    analysis = analyze_requirement(requirement_text, settings=settings)
    return RequirementAnalyzeResponse(
        requirement_text=requirement_text,
        analysis=analysis,
        latency_ms=0.0,
        model=settings.llm_model,
    )


@router.post(
    "/generate",
    response_model=SolutionResponse,
    summary="生成售前方案（八章节 + 引用）",
    dependencies=[AuthDep],
)
def generate(payload: SolutionRequest, settings: SettingsDep) -> SolutionResponse:
    """Analyse → retrieve → generate the eight mandated sections."""
    response = generate_solution(
        payload.requirement,
        form=payload.form,
        settings=settings,
        top_k=payload.top_k,
    )

    activity = get_activity_service(settings)
    activity.record(
        kind="solution",
        title=(response.requirement_text or "未提供需求")[:200],
        detail=response.markdown[:600],
        status="success" if response.sections else "failed",
        latency_ms=response.latency_ms,
        source_ids=[item.document_id for item in response.sources],
        source_names=[item.document_name for item in response.sources],
        citation_count=len(response.citations),
        chunk_count=len(response.retrieved_chunks),
        grounded=response.grounded,
        model=response.model,
        meta={
            "sections": len(response.sections),
            "warnings": response.warnings[:5],
            "requirement_source": response.analysis.generated_by,
        },
    )
    return response


@router.post(
    "/export",
    summary="导出方案（Markdown / Word）",
    dependencies=[AuthDep],
    response_class=Response,
)
def export(payload: SolutionExportRequest, settings: SettingsDep) -> Response:
    """Export a previously generated proposal."""
    safe_title = payload.title.strip() or "售前解决方案"
    if payload.format == "docx":
        target = settings.data_dir / "exports" / f"{safe_title}.docx"
        path = markdown_to_docx(payload.markdown, safe_title, target)
        content = open(path, "rb").read()  # noqa: SIM115 - short-lived read
        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="solution.docx"'},
        )

    return Response(
        content=payload.markdown.encode("utf-8"),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="solution.md"'},
    )


@router.get("/config", summary="Solution Studio 配置（模型与检索参数）")
def config(settings: SettingsDep) -> dict:
    """Non-secret configuration the Studio displays."""
    return {
        "model": settings.llm_model,
        "provider": settings.llm_provider,
        "configured": settings.llm_configured,
        "retriever_mode": settings.effective_retriever_mode,
        "top_k": settings.retrieval_top_k,
        "rerank_top_k": settings.rerank_top_k,
        "sections": [
            "Executive Summary",
            "Customer Needs",
            "Recommended Architecture",
            "Product Mapping",
            "Implementation Plan",
            "Case References",
            "Risks",
            "Next Steps",
        ],
    }
