"""Health and readiness endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from ...core.config import resolve_agent_engine
from ...rag.index import get_index
from ...schemas.common import HealthResponse
from ...services.settings_service import get_settings_service
from ..deps import SettingsDep

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse, summary="服务健康检查")
def health(settings: SettingsDep) -> HealthResponse:
    """Liveness + a compact readiness summary.

    Returns ``degraded`` (not an error) when the model key or the index is
    missing, because the service is still usable for browsing and retrieval.
    """
    index = get_index(settings)
    report = index.last_build

    degraded = not settings.llm_configured or not (report and report.chunk_count)
    return HealthResponse(
        status="degraded" if degraded else "ok",
        version=settings.app_version,
        environment=settings.environment,
        agent_engine=resolve_agent_engine(settings.agent_engine),
        index_ready=bool(report and report.chunk_count),
        index_document_count=report.document_count if report else 0,
        index_chunk_count=report.chunk_count if report else 0,
        llm_configured=settings.llm_configured,
    )


@router.get("/api/system/status", summary="系统配置自检")
def system_status(settings: SettingsDep) -> dict:
    """Detailed configuration checks for the Settings page."""
    return get_settings_service(settings).system_status()
