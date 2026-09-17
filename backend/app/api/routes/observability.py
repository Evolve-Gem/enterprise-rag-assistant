"""Activity ledger and Settings endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from ...core.errors import AppError
from ...schemas.activity import ActivityListResponse, ActivityStats
from ...schemas.common import MessageResponse
from ...services.activity_service import get_activity_service
from ...services.settings_service import get_settings_service
from ..deps import AuthDep, SettingsDep

router = APIRouter(prefix="/api", tags=["observability"])


class ClearNotAllowedError(AppError):
    code = "clear_not_allowed"
    status_code = 400
    message = "只读模式下不允许清空活动记录。"


@router.get("/activity", response_model=ActivityListResponse, summary="活动记录")
def activity(
    settings: SettingsDep,
    kind: Annotated[str, Query(description="rag_query | agent_run | solution | evaluation | chat")] = "",
    status: Annotated[str, Query(description="success | failed | blocked")] = "",
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> ActivityListResponse:
    """Newest-first activity records with optional filters."""
    items, total = get_activity_service(settings).list(
        kind=kind or None, status=status or None, offset=offset, limit=limit
    )
    return ActivityListResponse(items=items, total=total, offset=offset, limit=limit)


@router.get("/activity/stats", response_model=ActivityStats, summary="活动统计")
def activity_stats(
    settings: SettingsDep,
    days: Annotated[int, Query(ge=1, le=365)] = 30,
) -> ActivityStats:
    """Counters, success rate and latency percentiles."""
    return get_activity_service(settings).stats(days=days)


@router.delete(
    "/activity",
    response_model=MessageResponse,
    summary="清空活动记录",
    dependencies=[AuthDep],
)
def clear_activity(settings: SettingsDep) -> MessageResponse:
    """Clear the ledger (blocked in read-only demo mode)."""
    if settings.demo_read_only:
        raise ClearNotAllowedError()
    removed = get_activity_service(settings).clear()
    return MessageResponse(ok=True, message=f"已清空 {removed} 条活动记录。")


@router.get("/settings", summary="运行时配置（不含任何密钥）")
def settings_view(settings: SettingsDep) -> dict:
    """Everything the Settings page displays. Secrets are masked or omitted."""
    return get_settings_service(settings).public_settings()


@router.get("/settings/prompts", summary="Prompt 模板清单与版本")
def prompts(settings: SettingsDep) -> dict:
    """Prompt inventory: file, version, description and placeholders."""
    return {
        "version": settings.prompt_version,
        "directory": str(settings.prompts_dir / settings.prompt_version),
        "items": get_settings_service(settings).prompt_inventory(),
    }
