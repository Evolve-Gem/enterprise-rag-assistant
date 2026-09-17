"""A tiny trace recorder shared by the RAG pipeline and the agent graph.

Every user-visible operation produces an ordered list of :class:`TraceStep`
objects with a real wall-clock duration per node.  The frontend renders this as
the Agent Timeline, and the activity ledger stores a compact form of it, so the
trace has to be produced *by the code that actually runs* rather than
reconstructed afterwards.
"""

from __future__ import annotations

import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any, Iterator

from ..schemas.common import TraceStep


@dataclass
class TraceRecorder:
    """Collects trace steps in execution order."""

    steps: list[TraceStep] = field(default_factory=list)
    _started: float = field(default_factory=time.perf_counter)

    # ------------------------------------------------------------------
    @property
    def elapsed_ms(self) -> float:
        return round((time.perf_counter() - self._started) * 1000, 2)

    def add(
        self,
        node: str,
        title: str,
        *,
        status: str = "success",
        summary: str = "",
        detail: str = "",
        tool: str | None = None,
        duration_ms: float = 0.0,
        inputs: dict[str, Any] | None = None,
        outputs: dict[str, Any] | None = None,
    ) -> TraceStep:
        """Append one step."""
        step = TraceStep(
            index=len(self.steps) + 1,
            node=node,
            title=title,
            status=status,  # type: ignore[arg-type]
            duration_ms=round(duration_ms, 2),
            summary=summary,
            detail=detail,
            tool=tool,
            inputs=inputs or {},
            outputs=outputs or {},
        )
        self.steps.append(step)
        return step

    # ------------------------------------------------------------------
    @contextmanager
    def step(
        self,
        node: str,
        title: str,
        *,
        tool: str | None = None,
        inputs: dict[str, Any] | None = None,
    ) -> Iterator[TraceStep]:
        """Time a block of work and record it.

        The yielded step can be mutated inside the ``with`` block to attach the
        summary/detail once the outputs are known::

            with trace.step("retrieve", "检索知识库") as step:
                outcome = retriever.retrieve(query)
                step.summary = f"命中 {len(outcome.chunks)} 段"
                step.outputs = {"hits": len(outcome.chunks)}
        """
        started = time.perf_counter()
        step = self.add(node, title, status="running", tool=tool, inputs=inputs)
        try:
            yield step
        except Exception as exc:
            step.status = "failed"
            step.duration_ms = round((time.perf_counter() - started) * 1000, 2)
            step.summary = f"失败：{exc}"
            raise
        else:
            step.duration_ms = round((time.perf_counter() - started) * 1000, 2)
            if step.status == "running":
                step.status = "success"

    # ------------------------------------------------------------------
    def mark_skipped(self, node: str, title: str, reason: str = "") -> TraceStep:
        """Record a node that was deliberately not executed."""
        return self.add(node, title, status="skipped", summary=reason or "已跳过")

    def to_dicts(self) -> list[dict]:
        """Serialise for the activity ledger."""
        return [step.model_dump() for step in self.steps]
