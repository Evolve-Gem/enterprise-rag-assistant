"""The Skill layer.

A *Tool* is a single function.  A *Skill* is a business capability: it decides
which tools to run for its intent, what to retrieve, how to turn evidence into
an answer, and what shape the output takes.

Splitting ``prepare`` from ``generate`` is what makes the Agent Trace legible:

    route_intent → execute_tools (prepare) → retrieve → generate

``prepare`` runs the skill's deterministic tools and may publish a better
retrieval query (the solution skill derives it from the parsed requirement).
``generate`` turns retrieved evidence into the final artefact.  Neither step
knows about the graph engine, so the same skills run under LangGraph and under
the native state machine.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Callable

from ..core.logging import get_logger
from ..rag.citations import build_citations, build_sources
from ..rag.prompts import get_prompt_library
from .router import INTENT_RULES
from .state import AgentState
from .tools import ToolContext, ToolRegistry

logger = get_logger("app.agents.skills")

PrepareFn = Callable[[AgentState, ToolContext, ToolRegistry], None]
GenerateFn = Callable[[AgentState, ToolContext], None]


@dataclass
class SkillSpec:
    """Registered skill metadata + its two execution phases."""

    id: str
    name: str
    description: str
    intents: tuple[str, ...]
    tools: tuple[str, ...]
    generate: GenerateFn
    prepare: PrepareFn | None = None
    requires_retrieval: bool = False
    output_type: str = "report"

    def info(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "intents": list(self.intents),
            "tools": list(self.tools),
            "output_type": self.output_type,
            "requires_retrieval": self.requires_retrieval,
            "enabled": True,
        }


# ---------------------------------------------------------------------------
# Skill implementations
# ---------------------------------------------------------------------------


def _rag_qa_generate(state: AgentState, context: ToolContext) -> None:
    """Answer the question from the evidence the retrieve node collected."""
    from ..schemas.rag import RetrievalStats

    stats = context.scratch.get("retrieval_stats") or RetrievalStats()
    response = context.pipeline.compose(
        state.task,
        state.retrieved_chunks,
        stats,
        state.trace,
        allow_general_fallback=state.allow_general_fallback,
    )
    state.answer = response.answer
    state.citations = response.citations
    state.sources = response.sources
    state.output_type = "answer"
    state.used_general_fallback = response.fallback_used
    state.usage = response.usage


def _knowledge_overview_generate(state: AgentState, context: ToolContext) -> None:
    """Deterministic knowledge-base inventory report (no model call)."""
    documents: list[dict] = context.scratch.get("documents") or []
    stats: dict = context.scratch.get("stats") or {}

    if not documents:
        state.answer = "当前知识库暂无可管理文档，请先在「文档管理」中上传资料。"
        state.output_type = "report"
        return

    type_counts: dict[str, int] = {}
    category_counts: dict[str, int] = {}
    for item in documents:
        type_counts[item["type"]] = type_counts.get(item["type"], 0) + 1
        category_counts[item["category"]] = category_counts.get(item["category"], 0) + 1

    lines = [
        "## 知识库概览",
        "",
        f"- 文档数量：**{stats.get('document_count', len(documents))}**",
        f"- 知识块数量：**{stats.get('chunk_count', 0)}**",
        f"- 已向量化知识块：**{stats.get('vectorized_chunk_count', 0)}**",
        f"- 解析失败文档：**{stats.get('failed_count', 0)}**",
        f"- 检索模式：`{stats.get('retriever_mode', '-')}`",
        f"- 索引状态：`{stats.get('index_state', '-')}`",
        "",
        "### 文件类型分布",
        *(f"- {key or '未知'}：{value}" for key, value in sorted(type_counts.items())),
        "",
        "### 资料分类分布",
        *(f"- {key}：{value}" for key, value in sorted(category_counts.items())),
        "",
        "### 文档清单",
        "| 文档 | 类型 | 分类 | 知识块 | 字符数 |",
        "| --- | --- | --- | --- | --- |",
    ]
    for item in documents[:40]:
        lines.append(
            f"| {item['name']} | {item['type']} | {item['category']} | {item['chunks']} | {item['chars']} |"
        )
    if len(documents) > 40:
        lines.append(f"| … | | | | 其余 {len(documents) - 40} 个文档 |")

    state.answer = "\n".join(lines)
    state.output_type = "report"


def _gap_prepare(state: AgentState, context: ToolContext, registry: ToolRegistry) -> None:
    coverage, record = registry.invoke("analyze_coverage", context)
    state.record_tool(record)
    context.scratch["coverage"] = coverage or {"coverage": [], "document_count": 0}


def _gap_generate(state: AgentState, context: ToolContext) -> None:
    """Explain the rule-engine coverage verdict; never invent a score."""
    coverage = context.scratch.get("coverage") or {}
    items: list[dict] = coverage.get("coverage") or []

    missing = [item for item in items if item["status"] == "missing"]
    partial = [item for item in items if item["status"] == "partial"]
    covered = [item for item in items if item["status"] == "covered"]

    recommendations = [
        {
            "category": spec,
            "title": f"《{spec}》相关资料",
            "reason": "该类型当前没有任何命中证据，属于完全缺口。",
        }
        for spec in [item["label"] for item in missing]
    ]

    client_ready = context.settings.llm_configured
    if client_ready:
        try:
            from ..rag.llm import get_llm_client

            system, user = get_prompt_library(context.settings).render(
                "kb_gap_analysis",
                document_count=coverage.get("document_count", 0),
                chunk_count=len(context.index.chunks),
                coverage_json=json.dumps(items, ensure_ascii=False, indent=2),
                recommendations="\n".join(f"- {item['title']}：{item['reason']}" for item in recommendations)
                or "（无）",
            )
            completion = get_llm_client(context.settings).complete(system=system, user=user)
            if completion.ok:
                state.answer = completion.text
                state.used_general_fallback = False
                state.output_type = "analysis"
                state.analysis = json.dumps(items, ensure_ascii=False)
                return
            state.add_warning(f"缺口分析模型调用失败：{completion.error}")
        except Exception as exc:
            logger.warning("Gap analysis LLM step failed: %s", exc)
            state.add_warning(f"缺口分析模型调用异常：{exc}")

    # Deterministic fallback -- always available, always consistent with the data.
    lines = [
        "## 知识库缺口分析",
        "",
        f"分析范围：{coverage.get('document_count', 0)} 个文档 / {len(context.index.chunks)} 个知识块。"
        "以下结论由确定性规则引擎产出，未使用模型打分。",
        "",
        f"### 已覆盖（{len(covered)}）",
        *(f"- **{item['label']}**：命中 {item['document_count']} 个文档" for item in covered),
        "",
        f"### 部分覆盖（{len(partial)}）",
        *(
            f"- **{item['label']}**：有相关线索但缺少完整资料（命中关键词：{'、'.join(item['matched_keywords'][:4]) or '无'}）"
            for item in partial
        ),
        "",
        f"### 缺失（{len(missing)}）",
        *(f"- **{item['label']}**" for item in missing),
        "",
        "### 建议补充的资料",
        *(f"- {item['title']}（{item['reason']}）" for item in recommendations),
    ]
    state.answer = "\n".join(lines)
    state.analysis = json.dumps(items, ensure_ascii=False)
    state.output_type = "analysis"


def _requirement_prepare(state: AgentState, context: ToolContext, registry: ToolRegistry) -> None:
    analysis, record = registry.invoke("analyze_requirements", context, requirement=state.task)
    state.record_tool(record)
    context.scratch["requirement_analysis"] = analysis or {}
    query = (analysis or {}).get("search_query") or state.task
    context.scratch["retrieval_query"] = query


def _requirement_generate(state: AgentState, context: ToolContext) -> None:
    analysis = context.scratch.get("requirement_analysis") or {}
    chunks = state.retrieved_chunks

    lines = [
        "## 客户需求解析",
        "",
        f"- **客户类型**：{analysis.get('customer_type') or '未提及'}",
        f"- **所属行业**：{analysis.get('industry') or '未提及'}",
        f"- **业务场景**：{analysis.get('scenario') or '未提及'}",
        "",
        "### 核心需求",
        *([f"- {item}" for item in analysis.get("core_needs") or []] or ["- 待补充"]),
        "",
        "### 主要痛点",
        *([f"- {item}" for item in analysis.get("pain_points") or []] or ["- 待补充"]),
        "",
        "### 关键约束",
        *([f"- {item}" for item in analysis.get("constraints") or []] or ["- 暂无明确约束"]),
        "",
        "### 推荐解决方向",
        analysis.get("recommended_direction") or "待补充",
        "",
        "### 需要向客户确认的问题",
        *([f"- {item}" for item in analysis.get("missing_info") or []] or ["- 待补充"]),
    ]

    if chunks:
        lines.extend(
            [
                "",
                "### 已检索到的可引用资料",
                *(f"- {item.document_name}｜{item.section or '全文'}" for item in chunks[:6]),
            ]
        )

    state.analysis = "\n".join(lines)
    state.answer = state.analysis
    state.output_type = "analysis"
    state.citations = build_citations(chunks)
    state.sources = build_sources(state.citations)


def _solution_prepare(state: AgentState, context: ToolContext, registry: ToolRegistry) -> None:
    analysis, record = registry.invoke("analyze_requirements", context, requirement=state.task)
    state.record_tool(record)
    context.scratch["requirement_analysis"] = analysis or {}
    query = " ".join(
        filter(
            None,
            [
                (analysis or {}).get("search_query", ""),
                (analysis or {}).get("industry", ""),
                (analysis or {}).get("scenario", ""),
            ],
        )
    ) or state.task
    context.scratch["retrieval_query"] = query


def _solution_generate(state: AgentState, context: ToolContext) -> None:
    from ..schemas.solution import RequirementAnalysis
    from ..services.solution_service import compose_solution

    raw_analysis = context.scratch.get("requirement_analysis") or {}
    try:
        analysis = RequirementAnalysis(**raw_analysis)
    except Exception:
        analysis = RequirementAnalysis(raw_text=state.task)

    response = compose_solution(
        requirement=state.task,
        analysis=analysis,
        chunks=state.retrieved_chunks,
        settings=context.settings,
        trace=state.trace,
    )
    state.analysis = response.analysis.model_dump_json(indent=2)
    state.answer = response.markdown
    state.output_type = "solution"
    state.citations = response.citations
    state.sources = response.sources
    state.usage = response.usage
    for warning in response.warnings:
        state.add_warning(warning)


def _document_prepare(state: AgentState, context: ToolContext, registry: ToolRegistry) -> None:
    """Pick the document the task is about, or let retrieval decide."""
    documents, record = registry.invoke("list_documents", context)
    state.record_tool(record)
    context.scratch["documents"] = documents or []

    # Try to match a document by name first -- cheaper and more precise than
    # semantic retrieval for "总结一下 RAG.md" style requests.
    lowered = state.task.lower()
    matched = None
    for item in documents or []:
        stem = str(item["name"]).rsplit(".", 1)[0]
        if stem.lower() in lowered or str(item["name"]).lower() in lowered:
            matched = item
            break
    context.scratch["target_document"] = matched


def _document_generate(state: AgentState, context: ToolContext) -> None:
    from .tools import get_registry

    target = context.scratch.get("target_document")
    if not target and state.retrieved_chunks:
        top = state.retrieved_chunks[0]
        target = {"id": top.document_id, "name": top.document_name}

    if not target:
        state.answer = "未能在知识库中定位到要分析的文档，请补充文档名称后重试。"
        state.output_type = "report"
        return

    summary, record = get_registry().invoke("summarize_document", context, document_id=target["id"])
    state.record_tool(record)

    if not summary:
        state.answer = f"文档《{target['name']}》解析失败，无法生成摘要。"
        state.output_type = "report"
        return

    lines = [
        f"## 文档智能分析：{summary.get('name')}",
        "",
        f"- 资料分类：**{summary.get('category')}**",
        f"- 摘要来源：**{'模型生成' if summary.get('generated_by') == 'llm' else '规则提取'}**",
        "",
        "### 摘要",
        summary.get("summary") or "（无）",
        "",
        "### 文档大纲",
        *([f"- {item}" for item in summary.get("outline") or []] or ["- 该文档没有 Markdown 标题"]),
    ]
    if summary.get("matched_keywords"):
        lines.extend(["", "### 分类命中关键词", f"- {'、'.join(summary['matched_keywords'][:10])}"])

    state.answer = "\n".join(lines)
    state.output_type = "report"

    if state.retrieved_chunks:
        state.citations = build_citations(state.retrieved_chunks)
        state.sources = build_sources(state.citations)


def _agent_opt_prepare(state: AgentState, context: ToolContext, registry: ToolRegistry) -> None:
    documents, doc_record = registry.invoke("list_documents", context)
    state.record_tool(doc_record)
    stats, stats_record = registry.invoke("knowledge_stats", context)
    state.record_tool(stats_record)
    coverage, coverage_record = registry.invoke("analyze_coverage", context)
    state.record_tool(coverage_record)

    context.scratch["documents"] = documents or []
    context.scratch["stats"] = stats or {}
    context.scratch["coverage"] = coverage or {}


def _agent_opt_generate(state: AgentState, context: ToolContext) -> None:
    documents: list[dict] = context.scratch.get("documents") or []
    stats: dict = context.scratch.get("stats") or {}
    coverage: dict = context.scratch.get("coverage") or {}
    items: list[dict] = coverage.get("coverage") or []

    missing = [item["label"] for item in items if item["status"] == "missing"]
    partial = [item["label"] for item in items if item["status"] == "partial"]

    lines = [
        "## Agent 化升级分析",
        "",
        "### 当前平台能力（真实已实现）",
        "- 三层架构：Agent（意图 → 计划 → 执行）／Skill（7 项业务能力）／Tool（10 个可观测工具）",
        "- 混合检索：BM25 关键词 + 向量语义 + RRF 融合 + 重排序",
        "- 引用可溯源：回答内 `[n]` 角标 → 引用抽屉 → 原文片段",
        "- 执行可观测：每个节点记录耗时、输入摘要、输出摘要与 Tool 调用",
        "- 质量可评估：Hit@K / MRR / Recall 检索指标 + 人工答案评分",
        "",
        "### 当前数据快照",
        f"- 知识库文档：{stats.get('document_count', len(documents))}",
        f"- 知识块：{stats.get('chunk_count', 0)}",
        f"- 已向量化：{stats.get('vectorized_chunk_count', 0)}",
        f"- 检索模式：`{stats.get('retriever_mode', '-')}`",
        "",
        "### 知识资产缺口（影响 Agent 回答质量）",
        f"- 完全缺失：{'、'.join(missing) if missing else '无'}",
        f"- 部分覆盖：{'、'.join(partial) if partial else '无'}",
        "",
        "### 下一步升级优先级",
        "1. **P0 知识资产**：补齐上表中的完全缺失类型，Agent 的答案上限由知识库决定。",
        "2. **P1 意图路由模型化**：当前为加权关键词规则（可解释、可测试），下一步可改为小模型分类 + 规则兜底，并引入置信度阈值触发澄清。",
        "3. **P1 多轮会话记忆**：把 `history` 真正用于查询改写，解决「它/这个」等指代。",
        "4. **P2 Human Check**：报价、交付周期等高风险输出前强制人工确认（当前已留出 `require_human_check` 开关）。",
        "5. **P2 评估闭环**：用 Evaluation Center 的失败案例反向驱动 Prompt 与切分参数调优。",
    ]
    state.answer = "\n".join(lines)
    state.output_type = "report"


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------


class SkillRegistry:
    """Holds every skill and maps intents to skills."""

    def __init__(self) -> None:
        self._skills: dict[str, SkillSpec] = {}

    def register(self, spec: SkillSpec) -> None:
        self._skills[spec.id] = spec

    def get(self, skill_id: str) -> SkillSpec | None:
        return self._skills.get(skill_id)

    def by_intent(self, intent: str) -> SkillSpec | None:
        for spec in self._skills.values():
            if intent in spec.intents:
                return spec
        return None

    def all(self) -> list[SkillSpec]:
        return list(self._skills.values())

    def infos(self) -> list[dict]:
        return [spec.info() for spec in self._skills.values()]

    def intents(self) -> list[dict[str, str]]:
        return [
            {"intent": rule.intent, "label": rule.label, "skill": rule.skill}
            for rule in INTENT_RULES
        ]


def build_registry() -> SkillRegistry:
    """Construct the project's skill registry."""
    registry = SkillRegistry()
    registry.register(
        SkillSpec(
            id="rag_qa_skill",
            name="知识库问答",
            description="基于混合检索与重排序的证据回答问题，并在正文中标注引用编号",
            intents=("rag_answer",),
            tools=("retrieve",),
            requires_retrieval=True,
            output_type="answer",
            generate=_rag_qa_generate,
        )
    )
    registry.register(
        SkillSpec(
            id="knowledge_overview_skill",
            name="知识库概览",
            description="统计知识库文档、知识块、分类分布并输出清单（确定性计算，不调用模型）",
            intents=("kb_overview",),
            tools=("list_documents", "knowledge_stats"),
            output_type="report",
            prepare=lambda state, ctx, reg: _overview_prepare(state, ctx, reg),
            generate=_knowledge_overview_generate,
        )
    )
    registry.register(
        SkillSpec(
            id="gap_analysis_skill",
            name="知识库缺口分析",
            description="按预设资料类型统计覆盖情况（covered/partial/missing）并给出补录建议",
            intents=("kb_gap_analysis",),
            tools=("analyze_coverage", "list_documents"),
            output_type="analysis",
            prepare=_gap_prepare,
            generate=_gap_generate,
        )
    )
    registry.register(
        SkillSpec(
            id="requirement_analysis_skill",
            name="客户需求解析",
            description="把自然语言客户需求解析为结构化需求画像并检索可引用资料",
            intents=("requirement_analysis",),
            tools=("analyze_requirements", "retrieve"),
            requires_retrieval=True,
            output_type="analysis",
            prepare=_requirement_prepare,
            generate=_requirement_generate,
        )
    )
    registry.register(
        SkillSpec(
            id="solution_generation_skill",
            name="售前方案生成",
            description="需求解析 → 方案资料检索 → 生成带引用的结构化售前方案",
            intents=("solution_generation",),
            tools=("analyze_requirements", "retrieve", "generate_solution"),
            requires_retrieval=True,
            output_type="solution",
            prepare=_solution_prepare,
            generate=_solution_generate,
        )
    )
    registry.register(
        SkillSpec(
            id="document_intelligence_skill",
            name="文档智能分析",
            description="定位文档并生成摘要、分类与大纲",
            intents=("document_intelligence",),
            tools=("list_documents", "summarize_document", "retrieve"),
            requires_retrieval=True,
            output_type="report",
            prepare=_document_prepare,
            generate=_document_generate,
        )
    )
    registry.register(
        SkillSpec(
            id="agent_optimization_skill",
            name="Agent 化升级建议",
            description="基于知识库真实数据给出平台下一步升级优先级",
            intents=("agent_optimization",),
            tools=("list_documents", "knowledge_stats", "analyze_coverage"),
            output_type="report",
            prepare=_agent_opt_prepare,
            generate=_agent_opt_generate,
        )
    )
    return registry


def _overview_prepare(state: AgentState, context: ToolContext, reg: ToolRegistry) -> None:
    documents, doc_record = reg.invoke("list_documents", context)
    state.record_tool(doc_record)
    stats, stats_record = reg.invoke("knowledge_stats", context)
    state.record_tool(stats_record)
    context.scratch["documents"] = documents or []
    context.scratch["stats"] = stats or {}


_skill_registry: SkillRegistry | None = None


def get_skill_registry() -> SkillRegistry:
    """Process-wide skill registry."""
    global _skill_registry
    if _skill_registry is None:
        _skill_registry = build_registry()
    return _skill_registry
