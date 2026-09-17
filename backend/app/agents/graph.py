"""The agent graph: two engines, one node implementation.

    understand → route_intent → plan → execute_tools → retrieve
               → generate → human_check → finalize

Two execution engines are supported, selectable with ``AGENT_ENGINE``:

``langgraph``
    The real thing: a compiled ``StateGraph`` with conditional edges.  Verified
    working in this environment (see ``docs/ARCHITECTURE.md``).

``native``
    A ~40-line state machine with the same node functions.  It exists so the
    project never becomes un-runnable because of one optional dependency, and
    so that ``AGENT_ENGINE=native`` gives a dependency-free deployment.

Both engines call **the same node functions**, so behaviour cannot drift
between them -- only the scheduler differs.  The engine that actually ran is
reported back in every response.

Node order note: ``execute_tools`` intentionally runs *before* ``retrieve``.
The solution skill parses the customer requirement first and derives a much
better retrieval query from it; retrieving before analysis would search on the
raw prose and produce worse evidence.
"""

from __future__ import annotations

import time
from typing import Any, Callable, TypedDict

from ..core.config import Settings, get_settings, resolve_agent_engine
from ..core.logging import get_logger
from ..rag.index import KnowledgeIndex
from ..rag.pipeline import RagPipeline
from ..rag.retriever import create_retriever
from ..schemas.agent import PlanStep
from .router import route_intent
from .skills import SkillRegistry, get_skill_registry
from .state import AgentState
from .tools import ToolContext, ToolRegistry, get_registry

logger = get_logger("app.agents.graph")

NODE_ORDER = (
    "understand",
    "route_intent",
    "plan",
    "execute_tools",
    "retrieve",
    "generate",
    "human_check",
    "finalize",
)


class _GraphState(TypedDict):
    """LangGraph channel schema: one key holding the mutable run state."""

    agent: AgentState


class AgentGraph:
    """Runs the node pipeline with the configured engine."""

    def __init__(
        self,
        settings: Settings | None = None,
        index: KnowledgeIndex | None = None,
        skills: SkillRegistry | None = None,
        tools: ToolRegistry | None = None,
        engine: str | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        from ..rag.index import get_index

        self.index = index or get_index(self.settings)
        self.skills = skills or get_skill_registry()
        self.tools = tools or get_registry()
        self.pipeline = RagPipeline(self.index, self.settings)
        self.requested_engine = (engine or self.settings.agent_engine or "auto").lower()
        self.engine = resolve_agent_engine(self.requested_engine)
        self._compiled = None
        self._context: ToolContext | None = None

    # ------------------------------------------------------------------
    # Node implementations (shared by both engines)
    # ------------------------------------------------------------------
    def _node_understand(self, state: AgentState, context: ToolContext) -> None:
        with state.trace.step("understand", "理解任务", inputs={"task": state.task[:200]}) as step:
            stripped = state.task.strip()
            step.summary = f"任务长度 {len(stripped)} 字" + ("（空任务）" if not stripped else "")
            step.outputs = {"chars": len(stripped), "has_question_mark": "？" in stripped or "?" in stripped}

    def _node_route_intent(self, state: AgentState, context: ToolContext) -> None:
        with state.trace.step("route_intent", "识别意图", tool="intent_router") as step:
            decision = route_intent(state.task, state.preferred_intent)
            state.intent = decision
            skill = self.skills.by_intent(decision.intent)
            state.skill_id = skill.id if skill else ""
            state.skill_name = skill.name if skill else ""
            step.summary = (
                f"{decision.intent} → {state.skill_name or '未匹配 Skill'} "
                f"（置信度 {decision.confidence:.0%}）"
            )
            step.detail = decision.reasoning
            step.status = "success" if decision.confidence >= 0.45 else "warning"
            step.outputs = {
                "intent": decision.intent,
                "confidence": decision.confidence,
                "skill": state.skill_id,
                "matched_rule": decision.matched_rule,
                "candidates": decision.candidates,
            }

    def _node_plan(self, state: AgentState, context: ToolContext) -> None:
        skill = self.skills.get(state.skill_id)
        with state.trace.step("plan", "制定执行计划") as step:
            plan: list[PlanStep] = []
            index = 1

            plan.append(
                PlanStep(
                    index=index,
                    node="execute_tools",
                    title="准备阶段数据",
                    rationale="先运行该 Skill 的确定性 Tool，必要时产出更精确的检索查询。",
                    tool=(skill.tools[0] if skill and skill.tools else None),
                )
            )
            index += 1

            if skill and skill.requires_retrieval:
                plan.append(
                    PlanStep(
                        index=index,
                        node="retrieve",
                        title="检索知识库证据",
                        rationale="该 Skill 的输出必须基于知识库资料，需要先获取可引用证据。",
                        tool="retrieve",
                    )
                )
                index += 1

            plan.append(
                PlanStep(
                    index=index,
                    node="generate",
                    title="生成结构化输出",
                    rationale=f"按「{skill.name if skill else '默认'}」的输出契约生成结果。",
                    tool="generate_answer" if skill and skill.output_type == "answer" else None,
                )
            )

            state.plan = plan
            step.summary = f"计划 {len(plan)} 个执行步骤"
            step.detail = " → ".join(item.title for item in plan)
            step.outputs = {"steps": [item.model_dump() for item in plan]}

    def _node_execute_tools(self, state: AgentState, context: ToolContext) -> None:
        skill = self.skills.get(state.skill_id)
        if skill is None or skill.prepare is None:
            state.skip("execute_tools", "该 Skill 无准备阶段 Tool，直接进入检索")
            return

        with state.trace.step(
            "execute_tools",
            "执行 Tool",
            inputs={"skill": state.skill_id},
        ) as step:
            before = len(state.tool_calls)
            skill.prepare(state, context, self.tools)
            executed = state.tool_calls[before:]
            step.tool = ", ".join(record.name for record in executed) or None
            step.summary = (
                f"调用 {len(executed)} 个 Tool：" + "、".join(record.name for record in executed)
                if executed
                else "未产生 Tool 调用"
            )
            step.outputs = {
                "tools": [
                    {"name": record.name, "status": record.status, "ms": record.duration_ms}
                    for record in executed
                ]
            }
            if any(record.status == "failed" for record in executed):
                step.status = "warning"

    def _node_retrieve(self, state: AgentState, context: ToolContext) -> None:
        skill = self.skills.get(state.skill_id)
        if skill is None or not skill.requires_retrieval:
            state.skip("retrieve", "该 Skill 不需要知识库检索")
            return

        query = str(context.scratch.get("retrieval_query") or state.task)
        retriever = create_retriever(self.index, self.settings)

        with state.trace.step(
            "retrieve",
            "检索知识库",
            tool="retrieve",
            inputs={"mode": retriever.mode, "top_k": self.settings.retrieval_top_k},
        ) as step:
            outcome = self.pipeline.retrieve_only(query, k=self.settings.retrieval_top_k)
            state.retrieved_chunks = outcome.items
            context.scratch["retrieval_stats"] = outcome.stats
            step.summary = (
                f"{outcome.stats.mode} 检索命中 {len(outcome.items)} 段"
                f"（关键词 {outcome.stats.keyword_hits} / 向量 {outcome.stats.vector_hits} → "
                f"重排保留 {outcome.stats.after_rerank}）"
            )
            step.detail = "、".join(
                f"{item.document_name}#{item.index}" for item in outcome.items[:6]
            ) or "无命中"
            step.status = "success" if outcome.items else "warning"
            step.outputs = {
                "query": query[:200],
                "mode": outcome.stats.mode,
                "keyword_hits": outcome.stats.keyword_hits,
                "vector_hits": outcome.stats.vector_hits,
                "after_rerank": outcome.stats.after_rerank,
                "documents": sorted({item.document_name for item in outcome.items})[:8],
            }
            if not outcome.items:
                state.add_warning("知识库未检索到相关资料，输出可能不完整。")

    def _node_generate(self, state: AgentState, context: ToolContext) -> None:
        skill = self.skills.get(state.skill_id)
        if skill is None:
            state.trace.add("generate", "生成输出", status="failed", summary="未匹配到 Skill，无法生成")
            state.answer = "未能为该任务匹配到可执行的 Skill，请换一种表述或指定执行模式。"
            return

        with state.trace.step(
            "generate",
            "生成输出",
            tool="llm" if skill.output_type in {"answer", "solution", "analysis"} else None,
            inputs={"skill": skill.id, "evidence": len(state.retrieved_chunks)},
        ) as step:
            started = time.perf_counter()
            skill.generate(state, context)
            elapsed = round((time.perf_counter() - started) * 1000, 2)
            step.duration_ms = elapsed
            step.summary = f"生成 {len(state.answer)} 字 {state.output_type} 输出"
            step.outputs = {
                "chars": len(state.answer),
                "citations": len(state.citations),
                "sources": len(state.sources),
                "output_type": state.output_type,
            }
            if state.warnings:
                step.status = "warning"

    def _node_human_check(self, state: AgentState, context: ToolContext) -> None:
        if not state.require_human_check:
            state.skip("human_check", "本次运行未开启 Human Check")
            return

        if state.output_type != "solution":
            state.skip("human_check", "仅售前方案输出需要人工确认")
            return

        state.human_check_required = True
        state.human_check_reason = (
            "方案中包含面向客户的能力承诺与实施描述，按流程需由解决方案工程师确认后再对外发送。"
        )
        state.trace.add(
            "human_check",
            "人工确认检查",
            status="warning",
            summary="已标记需人工确认",
            detail=state.human_check_reason,
        )

    def _node_finalize(self, state: AgentState, context: ToolContext) -> None:
        with state.trace.step("finalize", "整理结果") as step:
            if not state.answer:
                state.answer = "本次执行未产生可展示的结果。"
            if not state.citations and state.retrieved_chunks:
                from ..rag.citations import build_citations, build_sources

                state.citations = build_citations(state.retrieved_chunks)
                state.sources = build_sources(state.citations)

            step.summary = (
                f"意图 {state.intent.intent if state.intent else '-'}｜"
                f"Skill {state.skill_id or '-'}｜"
                f"Tool {len(state.tool_calls)} 次｜"
                f"引用 {len(state.citations)} 条｜"
                f"总耗时 {state.latency_ms:.0f} ms"
            )
            step.outputs = {
                "tool_calls": len(state.tool_calls),
                "citations": len(state.citations),
                "sources": len(state.sources),
                "latency_ms": state.latency_ms,
                "warnings": state.warnings,
            }

    def node_functions(self) -> dict[str, Callable[[AgentState, ToolContext], None]]:
        return {
            "understand": self._node_understand,
            "route_intent": self._node_route_intent,
            "plan": self._node_plan,
            "execute_tools": self._node_execute_tools,
            "retrieve": self._node_retrieve,
            "generate": self._node_generate,
            "human_check": self._node_human_check,
            "finalize": self._node_finalize,
        }

    # ------------------------------------------------------------------
    # Engines
    # ------------------------------------------------------------------
    def _run_native(self, state: AgentState, context: ToolContext) -> str:
        for name, function in self.node_functions().items():
            function(state, context)
            if len(state.trace.steps) > state.max_steps:
                state.add_warning(f"执行步数超过上限 {state.max_steps}，已提前结束。")
                break
        return "native"

    def _build_langgraph(self):
        """Compile the LangGraph StateGraph (cached per AgentGraph instance)."""
        from langgraph.graph import END, START, StateGraph

        functions = self.node_functions()

        def wrap(function):
            def node(payload: _GraphState) -> _GraphState:
                function(payload["agent"], self._context)
                return {"agent": payload["agent"]}

            node.__name__ = function.__name__
            return node

        graph = StateGraph(_GraphState)
        for name in NODE_ORDER:
            graph.add_node(name, wrap(functions[name]))
        graph.add_edge(START, NODE_ORDER[0])
        for previous, following in zip(NODE_ORDER, NODE_ORDER[1:]):
            graph.add_edge(previous, following)
        graph.add_edge(NODE_ORDER[-1], END)
        return graph.compile()

    def _run_langgraph(self, state: AgentState, context: ToolContext) -> str:
        if self._compiled is None:
            self._compiled = self._build_langgraph()
        self._compiled.invoke({"agent": state})
        return "langgraph"

    # ------------------------------------------------------------------
    def run(self, state: AgentState) -> AgentState:
        """Execute the graph, honouring the requested engine with a fallback."""
        context = ToolContext(
            index=self.index,
            settings=self.settings,
            pipeline=self.pipeline,
        )
        self._context = context

        engine = self.engine
        if engine == "langgraph":
            try:
                state.engine = self._run_langgraph(state, context)
            except Exception as exc:  # pragma: no cover - depends on env
                logger.warning("LangGraph engine failed (%s); falling back to native.", exc)
                state.add_warning(f"LangGraph 执行失败，已回退到内置状态机：{exc}")
                state.trace.steps = []
                state.engine = self._run_native(state, context)
        else:
            state.engine = self._run_native(state, context)

        if not state.intent:
            state.intent = route_intent(state.task, state.preferred_intent)
        return state
