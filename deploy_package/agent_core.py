from dataclasses import dataclass, field
from pathlib import Path

from kb_tools import list_documents, read_document
from rag.chains import (
    analyze_requirement,
    generate_answer,
    generate_general_answer,
    generate_solution,
)
from rag.retriever import keyword_retrieve


INTENT_SKILL_MAP = {
    "rag_answer": "rag_answer_skill",
    "solution_generation": "solution_generation_skill",
    "kb_overview": "kb_overview_skill",
    "kb_gap_analysis": "kb_gap_analysis_skill",
    "agent_optimization": "agent_optimization_skill",
}


@dataclass
class SkillExecution:
    final_answer: str
    tool_calls: list[str] = field(default_factory=list)
    trace_steps: list[str] = field(default_factory=list)
    retrieved_chunks: list[dict] = field(default_factory=list)
    analysis: str = ""
    output_type: str = "report"
    used_general_fallback: bool = False


@dataclass
class AgentResult:
    user_task: str
    intent: str
    selected_skill: str
    tool_calls: list[str] = field(default_factory=list)
    trace_steps: list[dict] = field(default_factory=list)
    final_answer: str = ""
    retrieved_chunks: list[dict] = field(default_factory=list)
    analysis: str = ""
    output_type: str = "report"
    used_general_fallback: bool = False


def simple_intent_router(user_task: str) -> tuple[str, str]:
    """Route a user task to a minimal presales/knowledge-base skill."""
    task = (user_task or "").strip().lower()
    if not task:
        return "rag_answer", "rag_answer_skill"

    gap_keywords = ["缺什么", "缺少", "补充哪些", "是否完整", "资料完整", "还需要补充"]
    agent_optimization_keywords = [
        "agent 优化",
        "agent优化",
        "怎么用 agent",
        "怎么用agent",
        "agent 化",
        "agent化",
        "项目还能怎么优化",
        "还能怎么升级",
        "工作流优化",
        "skill 优化",
        "skill优化",
        "tool 优化",
        "tool优化",
        "trace 优化",
        "trace优化",
        "怎么做成 agent",
        "怎么做成agent",
        "怎么往 agent 方向靠",
        "怎么往agent方向靠",
    ]
    overview_keywords = [
        "知识库里有什么",
        "有哪些文档",
        "查看当前资料",
        "当前资料",
        "有哪些资料",
        "哪些资料",
        "知识库概览",
        "文档列表",
    ]
    solution_keywords = ["生成方案", "解决方案", "客户需求", "售前方案", "方案草稿"]

    if any(keyword in task for keyword in agent_optimization_keywords):
        return "agent_optimization", "agent_optimization_skill"
    if any(keyword in task for keyword in gap_keywords):
        return "kb_gap_analysis", "kb_gap_analysis_skill"
    if any(keyword in task for keyword in overview_keywords):
        return "kb_overview", "kb_overview_skill"
    if any(keyword in task for keyword in solution_keywords):
        return "solution_generation", "solution_generation_skill"
    return "rag_answer", "rag_answer_skill"


def _route_with_preference(
    user_task: str,
    preferred_intent: str | None = None,
) -> tuple[str, str]:
    """Use an explicit intent when provided; otherwise fall back to auto routing."""
    if preferred_intent and preferred_intent in INTENT_SKILL_MAP:
        return preferred_intent, INTENT_SKILL_MAP[preferred_intent]
    return simple_intent_router(user_task)


def rag_answer_skill(
    user_task: str,
    chunks: list[dict],
    allow_general_fallback: bool = False,
) -> SkillExecution:
    """Answer a user question with existing keyword retrieval and RAG generation."""
    trace_steps = [
        "接收用户问题。",
        "识别为知识库问答任务。",
        "检索相关知识片段。",
    ]
    tool_calls = ["keyword_retrieve"]
    results = keyword_retrieve(user_task, chunks, top_k=3)

    if not results:
        trace_steps.append("知识库未命中。")
        if allow_general_fallback:
            tool_calls.append("generate_general_answer")
            trace_steps.append("用户允许未命中时由模型给出通用建议。")
            answer = generate_general_answer(user_task)
            return SkillExecution(
                final_answer=answer,
                tool_calls=tool_calls,
                trace_steps=trace_steps,
                output_type="answer",
                used_general_fallback=True,
            )
        return SkillExecution(
            final_answer="暂未从知识库中检索到相关资料。",
            tool_calls=tool_calls,
            trace_steps=trace_steps,
            output_type="answer",
        )

    tool_calls.append("generate_answer")
    trace_steps.extend(["调用 DeepSeek 生成回答。", "返回知识库问答结果。"])
    answer = generate_answer(user_task, results)
    return SkillExecution(
        final_answer=answer,
        tool_calls=tool_calls,
        trace_steps=trace_steps,
        retrieved_chunks=results,
        output_type="answer",
    )


def solution_generation_skill(
    user_task: str,
    chunks: list[dict],
) -> SkillExecution:
    """Generate a presales solution with existing retrieval and generation logic."""
    trace_steps = [
        "接收客户需求。",
        "识别为售前方案生成任务。",
        "解析客户需求。",
        "检索产品、案例、FAQ 等参考资料。",
    ]
    tool_calls = ["analyze_requirement", "keyword_retrieve"]
    analysis = analyze_requirement(user_task)
    results = keyword_retrieve(user_task, chunks, top_k=3)

    if not results:
        trace_steps.append("未检索到可用于方案生成的知识库资料。")
        return SkillExecution(
            final_answer="暂未从知识库中检索到相关方案资料。",
            tool_calls=tool_calls,
            trace_steps=trace_steps,
            analysis=analysis,
            output_type="solution",
        )

    tool_calls.append("generate_solution")
    trace_steps.extend(["生成方案草稿。", "返回售前方案。"])
    solution = generate_solution(user_task, results)
    return SkillExecution(
        final_answer=solution,
        tool_calls=tool_calls,
        trace_steps=trace_steps,
        retrieved_chunks=results,
        analysis=analysis,
        output_type="solution",
    )


def kb_overview_skill(kb_dir: str | Path) -> SkillExecution:
    """Summarize the current knowledge base file inventory."""
    trace_steps = [
        "识别为知识库概览任务。",
        "调用 list_documents。",
        "汇总知识库状态。",
        "返回文档概览。",
    ]
    tool_calls = ["list_documents"]
    documents = list_documents(kb_dir)
    if not documents:
        return SkillExecution(
            final_answer="当前知识库暂无可管理文档。",
            tool_calls=tool_calls,
            trace_steps=trace_steps,
        )

    type_counts: dict[str, int] = {}
    total_size = 0
    latest_modified = "-"
    for document in documents:
        doc_type = document.get("type", "unknown")
        type_counts[doc_type] = type_counts.get(doc_type, 0) + 1
        total_size += int(document.get("size_bytes", 0))
        modified_at = document.get("modified_at", "-")
        if latest_modified == "-" or modified_at > latest_modified:
            latest_modified = modified_at

    type_summary = "，".join(
        f"{doc_type}: {count}" for doc_type, count in sorted(type_counts.items())
    )
    file_lines = [
        f"- {document['name']}（{document['type']}，{document['size']}，{document['modified_at']}）"
        for document in documents
    ]
    answer = "\n".join(
        [
            "### 当前知识库概览",
            "",
            f"- 文档数量：{len(documents)}",
            f"- 文件类型分布：{type_summary}",
            f"- 文件总大小：{total_size} B",
            f"- 最近修改时间：{latest_modified}",
            "",
            "### 文档清单",
            *file_lines,
        ]
    )
    return SkillExecution(
        final_answer=answer,
        tool_calls=tool_calls,
        trace_steps=trace_steps,
    )


def kb_gap_analysis_skill(
    kb_dir: str | Path,
    documents: list[dict],
) -> SkillExecution:
    """Analyze missing presales knowledge types with simple rules."""
    trace_steps = [
        "识别为知识库缺口分析任务。",
        "读取当前知识库文档列表。",
        "基于文件名和文本内容进行规则分析。",
        "返回缺口分析建议。",
    ]
    tool_calls = ["list_documents", "read_document"]
    file_infos = list_documents(kb_dir)

    combined_text_parts = [
        doc.get("title", "") + "\n" + doc.get("content", "") for doc in documents
    ]
    for file_info in file_infos:
        if file_info.get("type") in {".md", ".txt"}:
            try:
                combined_text_parts.append(
                    read_document(file_info["path"], kb_dir, max_chars=2000)
                )
            except Exception:
                continue
    combined_text = "\n".join(combined_text_parts).lower()

    required_types = {
        "产品介绍": ["产品介绍", "产品", "能力"],
        "FAQ / 常见问题": ["faq", "常见问题", "问题"],
        "成功案例": ["成功案例", "案例", "客户"],
        "行业解决方案": ["行业解决方案", "解决方案", "行业"],
        "竞品对比": ["竞品", "对比", "差异"],
        "价格 / 报价说明": ["价格", "报价", "费用", "成本"],
        "实施流程": ["实施", "上线", "交付", "流程"],
        "售后支持": ["售后", "支持", "维护", "服务"],
        "客户需求模板": ["客户需求", "需求模板", "调研表"],
    }

    covered: list[str] = []
    missing: list[str] = []
    for doc_type, keywords in required_types.items():
        if any(keyword.lower() in combined_text for keyword in keywords):
            covered.append(doc_type)
        else:
            missing.append(doc_type)

    answer = "\n".join(
        [
            "### 知识库缺口分析",
            "",
            "#### 已覆盖资料类型",
            *(f"- {item}" for item in covered),
            "",
            "#### 可能缺少的资料类型",
            *(f"- {item}" for item in missing),
            "",
            "#### 建议补充",
            *(
                f"- 建议补充《{item}》相关文档，提升售前问答和方案生成的完整度。"
                for item in missing
            ),
        ]
    )
    return SkillExecution(
        final_answer=answer,
        tool_calls=tool_calls,
        trace_steps=trace_steps,
    )


def summarize_runtime_index(documents: list[dict], chunks: list[dict]) -> dict:
    """Summarize runtime documents and chunks for Agent planning."""
    return {
        "runtime_document_count": len(documents),
        "chunk_count": len(chunks),
    }


def get_agent_upgrade_recommendations() -> dict[str, list[str]]:
    """Return concrete Agent upgrade recommendations for this project."""
    return {
        "gaps": [
            "意图识别仍是关键词规则，缺少置信度、兜底澄清和多意图拆解。",
            "方案生成虽然已有 RAG，但还不是显式的多步骤 Workflow。",
            "Tool 调用结果还没有统一结构化记录，后续复盘和评估会受限。",
            "缺少 Human Check 节点，例如生成方案前确认客户行业、预算、上线周期。",
            "缺少 Eval 机制，无法持续评估答案是否基于资料、引用是否准确。",
        ],
        "next_skills": [
            "售前需求解析 Agent：把客户需求拆成行业、场景、痛点、约束和待确认问题。",
            "知识库缺口分析 Agent：持续检查资料是否覆盖产品、FAQ、案例、报价、实施、售后。",
            "文档摘要与标签生成 Agent：上传文档后自动生成摘要、标签和适用场景。",
            "失败问题归因 Agent：当检索不到结果时，判断是关键词不足、资料缺失还是问题过泛。",
            "方案生成 Workflow Skill：按“需求解析 → 检索 → 草稿 → 风险提示 → 人工确认”生成方案。",
        ],
        "next_tools": [
            "search_documents：按文件名、标签、内容摘要检索知识库。",
            "summarize_document：为新上传文档生成摘要和适用场景。",
            "tag_document：为文档自动打标签，如产品、FAQ、案例、行业方案。",
            "log_trace：保存每次 Agent 执行轨迹，便于 Demo 复盘。",
            "export_solution_doc：将售前方案导出为 Markdown / Word / PDF。",
        ],
        "mechanisms": [
            "Trace：记录意图、Skill、Tool、检索片段、生成结果和耗时。",
            "Eval：检查回答是否引用知识库、是否出现资料外编造、是否覆盖用户问题。",
            "Human Check：在高风险输出前加入人工确认，例如报价、交付周期、客户承诺。",
            "Feedback：让用户标记“有用 / 不准确 / 缺资料”，反向驱动知识库补齐。",
        ],
        "actions": [
            "先把 Agent 工作台的意图识别、Trace 展示和 Skill 清单打磨稳定。",
            "再为知识库管理增加文档摘要、标签和缺口分析。",
            "最后将方案生成升级为可视化 Workflow，加入 Human Check 和 Eval。",
        ],
        "priorities": [
            "P0：意图识别更准确，增加 agent_optimization、kb_gap_analysis 等明确路由。",
            "P1：知识库缺口分析，让项目更贴近售前资料治理。",
            "P2：售前需求解析，把客户输入结构化后再生成方案。",
            "P3：方案生成 Workflow，引入多步骤执行与人工确认。",
            "P4：Eval 与 Trace 复盘，形成可演示、可解释、可迭代的 Agent 平台。",
        ],
    }


def agent_optimization_skill(
    user_task: str,
    kb_dir: str | Path,
    documents: list[dict],
    chunks: list[dict],
) -> SkillExecution:
    """Suggest concrete next steps to make this RAG project more agentic."""
    trace_steps = [
        "识别为 Agent 化升级分析任务。",
        "调用 list_documents 与 summarize_runtime_index。",
        "结合已有工作模式、Skill 和 Tool 设计升级路线。",
        "返回面向项目下一步迭代的建议。",
    ]
    tool_calls = [
        "list_documents",
        "summarize_runtime_index",
        "get_agent_upgrade_recommendations",
    ]
    file_infos = list_documents(kb_dir)
    runtime_summary = summarize_runtime_index(documents, chunks)
    recommendations = get_agent_upgrade_recommendations()

    current_capabilities = [
        "RAG 问答",
        "方案生成",
        "知识库概览",
        "知识库管理",
        "Agent 工作台",
        "kb_tools 工具层",
        "Trace 展示",
    ]
    document_count = len(file_infos)
    runtime_document_count = runtime_summary["runtime_document_count"]
    chunk_count = runtime_summary["chunk_count"]
    searchable_count = len(
        [item for item in file_infos if item.get("type") in {".md", ".txt"}]
    )

    answer = "\n".join(
        [
            "## Agent 化升级分析报告",
            "",
            "### 任务理解",
            f"用户希望分析：{user_task}",
            "这个问题不是单纯解释 Agent 概念，而是要判断当前项目下一步如何更像可演示的售前 Agent 工作流平台。",
            "",
            "### 执行路径",
            "- 读取当前项目能力清单。",
            "- 检查知识库文档与知识块规模。",
            "- 按 Agent / Skill / Tool / Trace / Human Check / Eval 六个维度给出升级建议。",
            "",
            "### 分析结果",
            "",
            "#### 1. 当前项目已经具备的 Agent 化基础",
            *(f"- {capability}" for capability in current_capabilities),
            f"- 当前知识库文件数：{document_count}",
            f"- 当前运行时索引文档数：{runtime_document_count}",
            f"- 可检索文本文件数：{searchable_count}",
            f"- 当前知识块数量：{chunk_count}",
            "",
            "#### 2. 目前还不够像 Agent 的地方",
            *(f"- {item}" for item in recommendations["gaps"]),
            "",
            "#### 3. 下一步最值得增加的 Skill",
            *(f"- {item}" for item in recommendations["next_skills"]),
            "",
            "#### 4. 下一步最值得增加的 Tool",
            *(f"- {item}" for item in recommendations["next_tools"]),
            "",
            "#### 5. 可以加入的 Trace / Eval / Human Check 机制",
            *(f"- {item}" for item in recommendations["mechanisms"]),
            "",
            "### 建议行动",
            *(f"- {item}" for item in recommendations["actions"]),
            "",
            "### 下一步优先级",
            *(f"- {item}" for item in recommendations["priorities"]),
            "",
            "### 一句话总结",
            "这个项目下一步最值得做的不是堆更多模型能力，而是把“任务识别 → Skill 选择 → Tool 调用 → Trace 复盘 → 人工确认”做扎实，让它从 RAG Demo 升级成可讲清楚的售前 Agent 工作流平台。",
        ]
    )
    return SkillExecution(
        final_answer=answer,
        tool_calls=tool_calls,
        trace_steps=trace_steps,
    )


def build_agent_trace(
    user_task: str,
    intent: str,
    selected_skill: str,
    tool_calls: list[str],
) -> list[dict]:
    """Build demo-friendly trace steps with action and reason."""
    return [
        {
            "step": "Step 1：接收任务",
            "action": f"读取用户输入：{user_task}",
            "reason": "Agent 需要先明确用户希望完成的是问答、方案、概览、缺口分析还是项目优化。",
        },
        {
            "step": "Step 2：识别意图",
            "action": f"将任务识别为：{intent}",
            "reason": "意图决定后续选择哪个 Skill，避免所有问题都走普通聊天式回答。",
        },
        {
            "step": "Step 3：选择 Skill",
            "action": f"选择：{selected_skill}",
            "reason": "Skill 负责组织一类业务能力，例如知识库问答、方案生成或 Agent 化分析。",
        },
        {
            "step": "Step 4：调用 Tool",
            "action": f"调用工具：{', '.join(tool_calls) if tool_calls else '无'}",
            "reason": "Tool 执行具体函数，例如读取文档、检索知识块或调用生成函数。",
        },
        {
            "step": "Step 5：生成最终结果",
            "action": "整理结构化输出并返回给用户。",
            "reason": "最终结果需要能直接用于 Demo 展示、售前沟通或下一步项目规划。",
        },
    ]


def run_agent_task(
    user_task: str,
    kb_dir: str | Path,
    documents: list[dict],
    chunks: list[dict],
    preferred_intent: str | None = None,
    allow_general_fallback: bool = False,
) -> AgentResult:
    """Run a minimal Agent workflow: route intent, select skill, call tools."""
    intent, selected_skill = _route_with_preference(user_task, preferred_intent)

    if selected_skill == "kb_overview_skill":
        execution = kb_overview_skill(kb_dir)
    elif selected_skill == "kb_gap_analysis_skill":
        execution = kb_gap_analysis_skill(kb_dir, documents)
    elif selected_skill == "agent_optimization_skill":
        execution = agent_optimization_skill(user_task, kb_dir, documents, chunks)
    elif selected_skill == "solution_generation_skill":
        execution = solution_generation_skill(user_task, chunks)
    else:
        execution = rag_answer_skill(user_task, chunks, allow_general_fallback)

    trace_steps = build_agent_trace(
        user_task,
        intent,
        selected_skill,
        execution.tool_calls,
    )
    if execution.trace_steps:
        trace_steps.append(
            {
                "step": "Skill 内部执行说明",
                "action": " → ".join(execution.trace_steps),
                "reason": "展示 Skill 内部如何组织业务能力，便于 Demo 复盘。",
            }
        )

    return AgentResult(
        user_task=user_task,
        intent=intent,
        selected_skill=selected_skill,
        tool_calls=execution.tool_calls,
        trace_steps=trace_steps,
        final_answer=execution.final_answer,
        retrieved_chunks=execution.retrieved_chunks,
        analysis=execution.analysis,
        output_type=execution.output_type,
        used_general_fallback=execution.used_general_fallback,
    )
