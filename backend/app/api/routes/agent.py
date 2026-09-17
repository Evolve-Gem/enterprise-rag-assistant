"""Agent workspace endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from ...schemas.agent import AgentCatalogResponse, AgentRunRequest, AgentRunResponse
from ...services.agent_service import get_agent_service
from ..deps import AuthDep, SettingsDep

router = APIRouter(prefix="/api/agent", tags=["agent"])


@router.get("/catalog", response_model=AgentCatalogResponse, summary="Skill / Tool / 意图目录")
def catalog(settings: SettingsDep) -> AgentCatalogResponse:
    """Everything the Agent Workspace needs to render its capability panel."""
    return get_agent_service(settings).catalog()


@router.get("/skills", summary="Skill 列表")
def skills(settings: SettingsDep) -> dict:
    """Convenience alias returning only the skill catalog."""
    catalog_response = get_agent_service(settings).catalog()
    return {"items": [item.model_dump() for item in catalog_response.skills]}


@router.get("/tools", summary="Tool 列表")
def tools(settings: SettingsDep) -> dict:
    """Convenience alias returning only the tool catalog."""
    catalog_response = get_agent_service(settings).catalog()
    return {"items": [item.model_dump() for item in catalog_response.tools]}


@router.post(
    "/run",
    response_model=AgentRunResponse,
    summary="运行 Agent 任务",
    dependencies=[AuthDep],
)
def run(payload: AgentRunRequest, settings: SettingsDep) -> AgentRunResponse:
    """Execute the agent graph and return the full trace."""
    return get_agent_service(settings).run(payload)
