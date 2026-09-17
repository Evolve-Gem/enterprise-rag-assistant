"""Knowledge insights: coverage, gaps and the dashboard aggregate."""

from __future__ import annotations

from fastapi import APIRouter

from ...schemas.insights import GapReport, OverviewResponse
from ...services.insights_service import get_insights_service
from ..deps import SettingsDep

router = APIRouter(prefix="/api", tags=["insights"])


@router.get("/overview", response_model=OverviewResponse, summary="Dashboard 汇总数据")
def overview(settings: SettingsDep) -> OverviewResponse:
    """One aggregate call powering the Overview page."""
    return get_insights_service(settings).build_overview()


@router.get("/insights/coverage", response_model=GapReport, summary="知识覆盖分析")
def coverage(settings: SettingsDep) -> GapReport:
    """Rule-based covered / partial / missing verdict per knowledge category."""
    return get_insights_service(settings).analyze_coverage()


@router.get("/insights/gaps", response_model=GapReport, summary="知识缺口与补录建议")
def gaps(settings: SettingsDep) -> GapReport:
    """Coverage plus the prioritised list of documents to add."""
    return get_insights_service(settings).analyze_coverage()
