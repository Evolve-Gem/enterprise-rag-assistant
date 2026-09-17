"""Tests for the agent layer: router, tools, skills and both graph engines."""

from __future__ import annotations

import pytest

from app.agents.graph import NODE_ORDER, AgentGraph
from app.agents.router import INTENT_SKILLS, route_intent
from app.agents.skills import get_skill_registry
from app.agents.state import AgentState
from app.agents.tools import get_registry
from app.core.config import get_settings, langgraph_available
from app.rag.index import get_index


# -------------------------------------------------------------------- router


@pytest.mark.parametrize(
    "task,expected",
    [
        ("Rerank 在 RAG 里解决什么问题？", "rag_answer"),
        ("当前知识库里有哪些资料？", "kb_overview"),
        ("帮我分析当前知识库还缺少哪些售前资料。", "kb_gap_analysis"),
        ("帮我总结一下 RAG.md 这份文档", "document_intelligence"),
        ("分析一下这个客户的需求", "requirement_analysis"),
        ("这个项目还能怎么用 Agent 优化？", "agent_optimization"),
        ("请生成一份售前解决方案", "solution_generation"),
    ],
)
def test_router_maps_tasks_to_intents(task, expected):
    assert route_intent(task).intent == expected


def test_router_confidence_is_bounded():
    decision = route_intent("帮我分析当前知识库还缺少哪些资料")
    assert 0.0 <= decision.confidence <= 1.0


def test_router_defaults_to_rag_answer_on_unknown_input():
    decision = route_intent("完全无关的一句话")
    assert decision.intent == "rag_answer"
    assert decision.matched_rule == "no_rule_matched"


def test_router_manual_override_wins():
    decision = route_intent("随便什么内容", preferred_intent="solution_generation")
    assert decision.intent == "solution_generation"
    assert decision.matched_rule == "manual_override"
    assert decision.confidence == 1.0


def test_router_ignores_unknown_preferred_intent():
    decision = route_intent("Rerank 是什么", preferred_intent="not_an_intent")
    assert decision.intent == "rag_answer"


def test_router_reports_runner_up_candidates():
    decision = route_intent("帮我分析知识库缺口，看看缺少哪些资料")
    assert decision.candidates
    assert decision.candidates[0]["intent"] == decision.intent
    assert decision.reasoning


def test_every_intent_maps_to_a_registered_skill():
    registry = get_skill_registry()
    skill_ids = {skill.id for skill in registry.all()}
    for skill_id in INTENT_SKILLS.values():
        assert skill_id in skill_ids


# --------------------------------------------------------------------- tools


def test_tool_registry_exposes_expected_tools():
    names = set(get_registry().names())
    assert {
        "retrieve",
        "list_documents",
        "read_document",
        "search_documents",
        "knowledge_stats",
        "analyze_coverage",
        "analyze_requirements",
        "summarize_document",
    } <= names


def test_tool_registry_records_duration_and_status(sandbox):
    from app.agents.tools import ToolContext
    from app.rag.pipeline import RagPipeline

    settings = get_settings()
    index = get_index(settings)
    context = ToolContext(index=index, settings=settings, pipeline=RagPipeline(index, settings))

    result, record = get_registry().invoke("knowledge_stats", context)
    assert record.status == "success"
    assert record.duration_ms >= 0
    assert result["document_count"] == 5
    assert "document_count" in record.outputs or record.summary


def test_tool_failure_is_captured_not_raised(sandbox):
    from app.agents.tools import ToolContext
    from app.rag.pipeline import RagPipeline

    settings = get_settings()
    index = get_index(settings)
    context = ToolContext(index=index, settings=settings, pipeline=RagPipeline(index, settings))

    result, record = get_registry().invoke("read_document", context, document_id="missing-id")
    assert result is None
    assert record.status == "failed"
    assert record.error


def test_unknown_tool_returns_failed_record(sandbox):
    from app.agents.tools import ToolContext
    from app.rag.pipeline import RagPipeline

    settings = get_settings()
    index = get_index(settings)
    context = ToolContext(index=index, settings=settings, pipeline=RagPipeline(index, settings))

    _, record = get_registry().invoke("does_not_exist", context)
    assert record.status == "failed"


# -------------------------------------------------------------------- skills


def test_skill_registry_contains_all_business_skills():
    ids = {skill.id for skill in get_skill_registry().all()}
    assert ids == {
        "rag_qa_skill",
        "knowledge_overview_skill",
        "gap_analysis_skill",
        "requirement_analysis_skill",
        "solution_generation_skill",
        "document_intelligence_skill",
        "agent_optimization_skill",
    }


def test_skill_requires_retrieval_flags_are_explicit():
    registry = get_skill_registry()
    assert registry.get("rag_qa_skill").requires_retrieval is True
    assert registry.get("solution_generation_skill").requires_retrieval is True
    assert registry.get("knowledge_overview_skill").requires_retrieval is False


# --------------------------------------------------------------------- graph


def _run(task: str, engine: str = "native", **kwargs) -> AgentState:
    graph = AgentGraph(get_settings(), engine=engine)
    state = AgentState(task=task, engine=engine, **kwargs)
    graph.run(state)
    return state


def test_graph_node_order_is_stable():
    assert NODE_ORDER == (
        "understand",
        "route_intent",
        "plan",
        "execute_tools",
        "retrieve",
        "generate",
        "human_check",
        "finalize",
    )


@pytest.mark.parametrize("engine", ["native", "langgraph"])
def test_graph_runs_end_to_end(engine):
    if engine == "langgraph" and not langgraph_available():
        pytest.skip("langgraph is not installed")

    state = _run("Rerank 在检索链路里解决什么问题？", engine=engine)
    assert state.engine == engine
    assert state.intent is not None
    assert state.skill_id == "rag_qa_skill"
    assert state.plan
    assert state.retrieved_chunks
    assert state.answer
    assert len(state.trace.steps) >= 6
    assert state.latency_ms > 0


@pytest.mark.parametrize("engine", ["native", "langgraph"])
def test_both_engines_agree_on_core_outcome(engine):
    if engine == "langgraph" and not langgraph_available():
        pytest.skip("langgraph is not installed")

    task = "帮我分析当前知识库还缺少哪些售前资料。"
    state = _run(task, engine=engine)
    assert state.intent.intent == "kb_gap_analysis"
    assert state.skill_id == "gap_analysis_skill"
    assert [step.node for step in state.trace.steps][:4] == [
        "understand",
        "route_intent",
        "plan",
        "execute_tools",
    ]
    assert state.answer


def test_trace_records_real_durations_and_tools():
    state = _run("当前知识库里有哪些资料？")
    tool_steps = [step for step in state.trace.steps if step.node == "execute_tools"]
    assert tool_steps
    assert tool_steps[0].tool
    assert all(step.duration_ms >= 0 for step in state.trace.steps)
    assert state.tool_calls
    assert all(record.duration_ms >= 0 for record in state.tool_calls)


def test_skipped_nodes_are_recorded_when_skill_needs_no_retrieval():
    state = _run("当前知识库里有哪些资料？")
    assert "retrieve" in state.skipped_nodes
    nodes = [step.node for step in state.trace.steps if step.status == "skipped"]
    assert "retrieve" in nodes


def test_human_check_node_marks_solution_for_review():
    state = _run(
        "某院校希望建设统一知识库，用于招生咨询与政策问答，请生成售前解决方案。",
        require_human_check=True,
    )
    assert state.intent.intent == "solution_generation"
    assert state.human_check_required is True
    assert state.human_check_reason


def test_human_check_is_skipped_by_default():
    state = _run("Rerank 在检索链路里解决什么问题？")
    assert state.human_check_required is False
    assert "human_check" in state.skipped_nodes


def test_preferred_intent_overrides_routing():
    state = _run("随便说点什么", preferred_intent="kb_overview")
    assert state.intent.intent == "kb_overview"
    assert state.skill_id == "knowledge_overview_skill"


def test_empty_task_produces_a_guard_not_a_crash():
    state = _run("   ")
    assert state.answer


def test_overview_skill_does_not_call_the_model():
    """The overview report is deterministic; it must not depend on an LLM key."""
    state = _run("当前知识库里有哪些资料？")
    assert "知识库概览" in state.answer
    assert "文档数量" in state.answer
    assert state.usage.total_tokens == 0


def test_no_documents_skill_handles_empty_database(sandbox):
    from app.services.knowledge_service import get_knowledge_service

    service = get_knowledge_service(get_settings())
    for item in service.list_documents(limit=50).items:
        service.delete_document(item.id)

    state = _run("当前知识库里有哪些资料？")
    assert state.answer
    assert "暂无" in state.answer or "没有" in state.answer
