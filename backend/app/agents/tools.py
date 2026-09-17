"""The Tool layer.

Tools are the only place where the agent touches the outside world: the
knowledge index, the retrieval pipeline, the LLM and the coverage analyser.
Every invocation is wrapped so that it returns a :class:`ToolCallRecord` with a
real duration, a summary and structured outputs -- that record is what the
Agent Trace UI renders and what the activity ledger stores.

A tool never raises: failures are captured into the record so one broken tool
cannot take down a run.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Callable

from ..core.config import Settings, get_settings
from ..core.logging import get_logger
from ..schemas.agent import ToolCallRecord, ToolInfo
from ..schemas.rag import RetrievedChunk
from ..rag.citations import build_citations, build_sources
from ..rag.index import KnowledgeIndex, get_index
from ..rag.llm import get_llm_client
from ..rag.pipeline import RagPipeline
from ..rag.prompts import get_prompt_library
from ..rag.taxonomy import classify_document

logger = get_logger("app.agents.tools")


@dataclass
class ToolContext:
    """Ambient dependencies a tool may need."""

    index: KnowledgeIndex
    settings: Settings
    pipeline: RagPipeline
    scratch: dict[str, Any] = field(default_factory=dict)


@dataclass
class ToolSpec:
    """Registered tool metadata + handler."""

    name: str
    description: str
    handler: Callable[..., Any]
    category: str = "knowledge"
    read_only: bool = True
    parameters: list[str] = field(default_factory=list)
    returns: str = ""

    def info(self) -> ToolInfo:
        return ToolInfo(
            name=self.name,
            description=self.description,
            category=self.category,
            read_only=self.read_only,
            parameters=self.parameters,
            returns=self.returns,
        )


class ToolRegistry:
    """A tiny, explicit tool registry.

    Deliberately not a plugin system: the tool set is small, closed and
    reviewed.  What matters is that invocation is *uniform* (timing, error
    capture, structured record) so the trace and the ledger are consistent.
    """

    def __init__(self) -> None:
        self._tools: dict[str, ToolSpec] = {}

    def register(self, spec: ToolSpec) -> None:
        self._tools[spec.name] = spec

    def get(self, name: str) -> ToolSpec | None:
        return self._tools.get(name)

    def names(self) -> list[str]:
        return sorted(self._tools)

    def infos(self) -> list[ToolInfo]:
        return [self._tools[name].info() for name in self.names()]

    def invoke(
        self,
        name: str,
        context: ToolContext,
        **kwargs: Any,
    ) -> tuple[Any, ToolCallRecord]:
        """Run a tool, always returning a record."""
        spec = self._tools.get(name)
        if spec is None:
            record = ToolCallRecord(
                name=name,
                status="failed",
                error=f"未注册的 Tool：{name}",
                summary=f"未找到 Tool {name}",
            )
            return None, record

        started = time.perf_counter()
        try:
            result = spec.handler(context, **kwargs)
        except Exception as exc:  # noqa: BLE001 - tools must never break the run
            duration = round((time.perf_counter() - started) * 1000, 2)
            logger.warning("Tool %s failed: %s", name, exc)
            record = ToolCallRecord(
                name=name,
                status="failed",
                duration_ms=duration,
                summary=f"{name} 执行失败",
                inputs=_trim(kwargs),
                error=str(exc),
            )
            return None, record

        duration = round((time.perf_counter() - started) * 1000, 2)
        summary, outputs = _summarise(name, result)
        record = ToolCallRecord(
            name=name,
            status="success",
            duration_ms=duration,
            summary=summary,
            inputs=_trim(kwargs),
            outputs=outputs,
        )
        return result, record


def _trim(payload: dict[str, Any], limit: int = 120) -> dict[str, Any]:
    """Shorten long string inputs so the trace stays readable."""
    trimmed: dict[str, Any] = {}
    for key, value in payload.items():
        if isinstance(value, str) and len(value) > limit:
            trimmed[key] = value[:limit] + "…"
        elif isinstance(value, list):
            trimmed[key] = f"[{len(value)} items]"
        else:
            trimmed[key] = value
    return trimmed


def _summarise(name: str, result: Any) -> tuple[str, dict[str, Any]]:
    """Build a human summary plus compact structured outputs for the trace."""
    if isinstance(result, list):
        if result and isinstance(result[0], RetrievedChunk):
            return (
                f"命中 {len(result)} 段知识库内容",
                {
                    "count": len(result),
                    "documents": sorted({item.document_name for item in result})[:6],
                },
            )
        if result and isinstance(result[0], dict):
            return (f"返回 {len(result)} 条记录", {"count": len(result)})
        return (f"返回 {len(result)} 项", {"count": len(result)})

    if isinstance(result, dict):
        if "answer" in result:
            return (
                f"生成 {len(str(result.get('answer', '')))} 字输出",
                {
                    "chars": len(str(result.get("answer", ""))),
                    "citations": len(result.get("citations") or []),
                    "grounded": result.get("grounded"),
                },
            )
        if "chunk_count" in result:
            return (
                f"知识库共 {result.get('document_count', 0)} 个文档 / {result.get('chunk_count', 0)} 个知识块",
                dict(result),
            )
        return (f"返回 {len(result)} 个字段", {"keys": sorted(result)[:8]})

    if isinstance(result, str):
        return (f"返回 {len(result)} 字文本", {"chars": len(result)})

    return (f"{name} 执行完成", {})


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------


def _t_retrieve(context: ToolContext, *, query: str = "", k: int | None = None, **_: Any) -> list[RetrievedChunk]:
    """Retrieve evidence chunks from the knowledge base."""
    outcome = context.pipeline.retrieve_only(query, k=k or context.settings.retrieval_top_k)
    context.scratch["last_retrieval"] = outcome
    return outcome.items


def _t_list_documents(context: ToolContext, **_: Any) -> list[dict]:
    """List every knowledge document with its metadata."""
    context.index.ensure_built()
    return [
        {
            "id": record.id,
            "name": record.name,
            "type": record.type_label,
            "category": record.category,
            "status": record.status,
            "chunks": len(context.index.chunks_of(record.id)),
            "chars": record.char_count,
            "modified_at": record.modified_at.isoformat() if record.modified_at else "",
        }
        for record in context.index.documents.values()
    ]


def _t_read_document(context: ToolContext, *, document_id: str = "", **_: Any) -> dict:
    """Read the full text of one document."""
    record = context.index.get_document(document_id)
    if record is None:
        raise ValueError(f"文档不存在：{document_id}")
    content = context.index.load_document_content(document_id)
    return {
        "id": record.id,
        "name": record.name,
        "category": record.category,
        "chars": len(content),
        "content": content[:6000],
    }


def _t_search_documents(context: ToolContext, *, term: str = "", limit: int = 20, **_: Any) -> list[dict]:
    """Search documents by name or content substring."""
    needle = (term or "").strip().lower()
    if not needle:
        return []
    matches: list[dict] = []
    for record in context.index.documents.values():
        in_name = needle in record.name.lower()
        body = context.index.load_document_content(record.id).lower()
        in_body = needle in body
        if in_name or in_body:
            matches.append(
                {
                    "id": record.id,
                    "name": record.name,
                    "match": "filename" if in_name else "content",
                    "occurrences": body.count(needle),
                    "category": record.category,
                }
            )
        if len(matches) >= limit:
            break
    return matches


def _t_knowledge_stats(context: ToolContext, **_: Any) -> dict:
    """Return knowledge base counters."""
    context.index.ensure_built()
    report = context.index.last_build
    return {
        "document_count": len(context.index.documents),
        "chunk_count": len(context.index.chunks),
        "vectorized_chunk_count": len(context.index._vectorised_ids),  # noqa: SLF001
        "failed_count": sum(1 for doc in context.index.documents.values() if doc.status == "failed"),
        "retriever_mode": context.settings.effective_retriever_mode,
        "index_state": report.index_state if report else "empty",
    }


def _t_analyze_requirements(context: ToolContext, *, requirement: str = "", **_: Any) -> dict:
    """Parse a customer requirement into structured fields."""
    from ..services.requirement_service import analyze_requirement  # local import avoids a cycle

    analysis = analyze_requirement(requirement, settings=context.settings)
    return analysis.model_dump()


def _t_generate_answer(context: ToolContext, *, question: str = "", **_: Any) -> dict:
    """Generate a grounded answer for a question."""
    response = context.pipeline.answer(question)
    context.scratch["last_answer"] = response
    return response.model_dump()


def _t_generate_solution(context: ToolContext, *, requirement: str = "", **_: Any) -> dict:
    """Generate a presales solution draft."""
    from ..services.solution_service import generate_solution  # local import avoids a cycle

    response = generate_solution(requirement, settings=context.settings)
    return response.model_dump()


def _t_analyze_coverage(context: ToolContext, **_: Any) -> dict:
    """Compute knowledge coverage over the expected category set.

    Delegates to the insights service so the agent's numbers and the Insights
    page's numbers can never disagree.
    """
    from ..services.insights_service import analyze_coverage  # local import avoids a cycle

    report = analyze_coverage(context.index, context.settings)
    return {
        "coverage": [item.model_dump() for item in report.coverage],
        "document_count": report.analyzed_document_count,
        "chunk_count": report.analyzed_chunk_count,
        "coverage_ratio": report.coverage_ratio,
        "recommended_documents": report.recommended_documents,
    }


def _t_summarize_document(context: ToolContext, *, document_id: str = "", **_: Any) -> dict:
    """Produce a structural summary of a document (headings + key lines)."""
    record = context.index.get_document(document_id)
    if record is None:
        raise ValueError(f"文档不存在：{document_id}")
    content = context.index.load_document_content(document_id)
    category, matched = classify_document(record.name, content)

    client = get_llm_client(context.settings)
    if not client.configured:
        return {
            "id": record.id,
            "name": record.name,
            "category": category,
            "matched_keywords": matched,
            "outline": record.outline,
            "summary": record.summary,
            "generated_by": "rules",
        }

    try:
        system, user = get_prompt_library(context.settings).render(
            "document_summary",
            document_name=record.name,
            outline="\n".join(f"- {item}" for item in record.outline),
            content=content[:4000],
        )
    except Exception as exc:
        logger.warning("document_summary prompt unavailable (%s); using rules.", exc)
        return {
            "id": record.id,
            "name": record.name,
            "category": category,
            "outline": record.outline,
            "summary": record.summary,
            "generated_by": "rules",
        }

    completion = client.complete(system=system, user=user, max_tokens=600)
    return {
        "id": record.id,
        "name": record.name,
        "category": category,
        "outline": record.outline,
        "summary": completion.text if completion.ok else record.summary,
        "generated_by": "llm" if completion.ok else "rules",
    }


def build_registry() -> ToolRegistry:
    """Construct the project's tool registry."""
    registry = ToolRegistry()
    registry.register(
        ToolSpec(
            name="retrieve",
            description="在知识库中检索与查询最相关的知识片段（关键词 + 向量混合检索 + 重排序）",
            handler=_t_retrieve,
            parameters=["query", "k"],
            returns="RetrievedChunk[]",
        )
    )
    registry.register(
        ToolSpec(
            name="list_documents",
            description="列出知识库中的全部文档及其分类、状态与知识块数量",
            handler=_t_list_documents,
            returns="Document[]",
        )
    )
    registry.register(
        ToolSpec(
            name="read_document",
            description="读取指定文档的完整正文",
            handler=_t_read_document,
            parameters=["document_id"],
            returns="DocumentContent",
        )
    )
    registry.register(
        ToolSpec(
            name="search_documents",
            description="按关键词在文档名与正文中检索，返回命中位置与次数",
            handler=_t_search_documents,
            parameters=["term", "limit"],
            returns="Match[]",
        )
    )
    registry.register(
        ToolSpec(
            name="knowledge_stats",
            description="统计知识库文档数、知识块数与索引状态",
            handler=_t_knowledge_stats,
            returns="KnowledgeStats",
        )
    )
    registry.register(
        ToolSpec(
            name="analyze_requirements",
            description="把自然语言客户需求解析为结构化需求画像",
            handler=_t_analyze_requirements,
            category="solution",
            parameters=["requirement"],
            returns="RequirementAnalysis",
        )
    )
    registry.register(
        ToolSpec(
            name="generate_answer",
            description="基于检索证据生成带引用的知识库回答",
            handler=_t_generate_answer,
            category="generation",
            parameters=["question"],
            returns="RagQueryResponse",
        )
    )
    registry.register(
        ToolSpec(
            name="generate_solution",
            description="基于需求与知识库资料生成结构化售前方案",
            handler=_t_generate_solution,
            category="solution",
            parameters=["requirement"],
            returns="SolutionResponse",
        )
    )
    registry.register(
        ToolSpec(
            name="analyze_coverage",
            description="按预设资料类型统计知识库覆盖情况（covered / partial / missing）",
            handler=_t_analyze_coverage,
            category="insight",
            returns="CoverageReport",
        )
    )
    registry.register(
        ToolSpec(
            name="summarize_document",
            description="为文档生成摘要、分类与大纲",
            handler=_t_summarize_document,
            category="insight",
            parameters=["document_id"],
            returns="DocumentSummary",
        )
    )
    return registry


_registry: ToolRegistry | None = None


def get_registry() -> ToolRegistry:
    """Process-wide tool registry."""
    global _registry
    if _registry is None:
        _registry = build_registry()
    return _registry
