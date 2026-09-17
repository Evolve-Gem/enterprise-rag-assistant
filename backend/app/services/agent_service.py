"""Agent application service: run orchestration, catalog and activity logging."""

from __future__ import annotations

from ..agents.graph import AgentGraph
from ..agents.skills import get_skill_registry
from ..agents.state import AgentState
from ..agents.tools import get_registry
from ..core.config import Settings, get_settings, resolve_agent_engine
from ..core.logging import get_logger
from ..rag.index import KnowledgeIndex, get_index
from ..schemas.agent import (
    AgentCatalogResponse,
    AgentRunRequest,
    AgentRunResponse,
    PlanStep,
    SkillInfo,
    ToolInfo,
)
from .activity_service import ActivityService, get_activity_service

logger = get_logger("app.services.agent")


class AgentService:
    """Runs the agent graph and exposes its catalog."""

    def __init__(
        self,
        settings: Settings | None = None,
        index: KnowledgeIndex | None = None,
        activity: ActivityService | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self._index = index
        self._activity = activity

    @property
    def index(self) -> KnowledgeIndex:
        if self._index is None:
            self._index = get_index(self.settings)
        return self._index

    @property
    def activity(self) -> ActivityService:
        if self._activity is None:
            self._activity = get_activity_service(self.settings)
        return self._activity

    # ------------------------------------------------------------------
    def catalog(self) -> AgentCatalogResponse:
        """Skills, tools, intents and the engine that is actually active."""
        skills = get_skill_registry()
        tools = get_registry()
        active = resolve_agent_engine(self.settings.agent_engine)

        return AgentCatalogResponse(
            skills=[SkillInfo(**info) for info in skills.infos()],
            tools=[ToolInfo(**info.model_dump()) for info in tools.infos()],
            engines=["langgraph", "native"],
            active_engine=active,
            intents=skills.intents(),
        )

    # ------------------------------------------------------------------
    def run(self, request: AgentRunRequest) -> AgentRunResponse:
        """Execute one agent run end to end."""
        state = AgentState(
            task=request.task.strip(),
            preferred_intent=request.preferred_intent,
            allow_general_fallback=(
                self.settings.agent_allow_general_fallback
                if request.allow_general_fallback is None
                else request.allow_general_fallback
            ),
            require_human_check=request.require_human_check,
            max_steps=request.max_steps or self.settings.agent_max_steps,
        )

        graph = AgentGraph(
            settings=self.settings,
            index=self.index,
            engine=request.engine or self.settings.agent_engine,
        )
        graph.run(state)

        response = AgentRunResponse(
            run_id=state.run_id,
            task=state.task,
            engine=state.engine,
            intent=state.intent.intent if state.intent else "unknown",
            intent_confidence=state.intent.confidence if state.intent else 0.0,
            skill=state.skill_id,
            skill_name=state.skill_name,
            plan=[
                PlanStep(**item.model_dump()) if isinstance(item, PlanStep) else item
                for item in state.plan
            ],
            tool_calls=state.tool_calls,
            trace=state.trace.steps,
            output_type=state.output_type,  # type: ignore[arg-type]
            answer=state.answer,
            analysis=state.analysis,
            citations=state.citations,
            sources=state.sources,
            retrieved_chunks=state.retrieved_chunks,
            used_general_fallback=state.used_general_fallback,
            human_check_required=state.human_check_required,
            human_check_reason=state.human_check_reason,
            warnings=state.warnings,
            skipped_nodes=state.skipped_nodes,
            latency_ms=state.latency_ms,
            usage=state.usage,
            model=self.settings.llm_model,
        )

        failed_tools = [record.name for record in state.tool_calls if record.status == "failed"]
        self.activity.record(
            kind="agent_run",
            title=state.task[:200],
            detail=state.answer[:600],
            status="failed" if failed_tools and not state.answer else "success",
            intent=response.intent,
            skill=response.skill,
            tools=[record.name for record in state.tool_calls],
            latency_ms=state.latency_ms,
            source_ids=[item.document_id for item in state.sources],
            source_names=[item.document_name for item in state.sources],
            citation_count=len(state.citations),
            chunk_count=len(state.retrieved_chunks),
            grounded=None,
            engine=state.engine,
            model=self.settings.llm_model,
            error=", ".join(failed_tools) if failed_tools else None,
            meta={
                "intent_confidence": response.intent_confidence,
                "tool_calls": len(state.tool_calls),
                "steps": len(state.trace.steps),
                "warnings": state.warnings[:5],
                "human_check": state.human_check_required,
                "tokens": state.usage.total_tokens,
            },
        )
        return response


_service: AgentService | None = None


def get_agent_service(settings: Settings | None = None) -> AgentService:
    """Process-wide agent service."""
    global _service
    if _service is None:
        _service = AgentService(settings or get_settings())
    return _service


def reset_agent_service() -> None:
    """Drop the singleton (tests)."""
    global _service
    _service = None
