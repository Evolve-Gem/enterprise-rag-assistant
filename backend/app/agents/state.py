"""The mutable state that flows through the agent graph.

Design choice: one explicit state object rather than passing loose arguments
between nodes.  It makes the execution observable (each node reads and writes
named fields), resumable (the state is serialisable) and testable (a unit test
can construct a state and call a single node).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime

from ..core.tracing import TraceRecorder
from ..schemas.agent import IntentDecision, PlanStep, ToolCallRecord
from ..schemas.rag import Citation, RetrievedChunk, SourceRef, UsageInfo


@dataclass
class AgentState:
    """Everything the graph knows about one run."""

    # -- request ----------------------------------------------------
    task: str
    run_id: str = field(default_factory=lambda: uuid.uuid4().hex[:16])
    engine: str = "native"
    started_at: datetime = field(default_factory=datetime.now)

    preferred_intent: str | None = None
    allow_general_fallback: bool = True
    require_human_check: bool = False
    max_steps: int = 12

    # -- reasoning --------------------------------------------------
    intent: IntentDecision | None = None
    plan: list[PlanStep] = field(default_factory=list)

    # -- skill ------------------------------------------------------
    skill_id: str = ""
    skill_name: str = ""

    # -- execution --------------------------------------------------
    tool_calls: list[ToolCallRecord] = field(default_factory=list)
    retrieved_chunks: list[RetrievedChunk] = field(default_factory=list)
    citations: list[Citation] = field(default_factory=list)
    sources: list[SourceRef] = field(default_factory=list)

    # -- output -----------------------------------------------------
    output_type: str = "report"
    analysis: str = ""
    answer: str = ""
    used_general_fallback: bool = False

    # -- control ----------------------------------------------------
    human_check_required: bool = False
    human_check_reason: str = ""
    skipped_nodes: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    error: str = ""

    usage: UsageInfo = field(default_factory=UsageInfo)
    trace: TraceRecorder = field(default_factory=TraceRecorder)

    # ------------------------------------------------------------------
    @property
    def latency_ms(self) -> float:
        return self.trace.elapsed_ms

    @property
    def tool_names(self) -> list[str]:
        return [record.name for record in self.tool_calls]

    def record_tool(self, record: ToolCallRecord) -> None:
        self.tool_calls.append(record)

    def skip(self, node: str, reason: str) -> None:
        self.skipped_nodes.append(node)
        self.trace.mark_skipped(node, _NODE_TITLES.get(node, node), reason)

    def add_warning(self, message: str) -> None:
        if message and message not in self.warnings:
            self.warnings.append(message)


_NODE_TITLES = {
    "understand": "理解任务",
    "route_intent": "识别意图",
    "plan": "制定计划",
    "retrieve": "检索知识库",
    "execute_tools": "执行 Tool",
    "generate": "生成输出",
    "human_check": "人工确认检查",
    "finalize": "整理结果",
}
