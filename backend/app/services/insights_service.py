"""Knowledge insights: coverage analysis and the dashboard aggregate.

Coverage is computed **deterministically** from the indexed corpus (document
classification + keyword evidence).  No coverage percentage is invented: the
per-category verdict is ``covered`` / ``partial`` / ``missing``, and the ratio
that is reported is a plain count-based fraction of categories, clearly
labelled as rule-derived.
"""

from __future__ import annotations

from datetime import datetime, timezone

from ..core.config import Settings, get_settings
from ..core.errors import AppError
from ..core.logging import get_logger
from ..rag.index import KnowledgeIndex, get_index
from ..rag.taxonomy import CATEGORY_BY_KEY, EXPECTED_CATEGORIES
from ..schemas.activity import ActivityStats
from ..schemas.insights import (
    ActivityRef,
    CoverageItem,
    GapReport,
    OverviewAgent,
    OverviewKnowledge,
    OverviewRag,
    OverviewResponse,
    OverviewSystem,
    QuickAction,
)
from .activity_service import ActivityService, get_activity_service

logger = get_logger("app.services.insights")


class InsightsService:
    """Read-only analytics over the knowledge base and the activity ledger."""

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
    def analyze_coverage(self) -> GapReport:
        """Rule-based coverage verdict for every expected category."""
        self.index.ensure_built()

        documents = list(self.index.documents.values())
        corpus_lower = "\n".join(
            self.index.load_document_content(record.id) for record in documents
        ).lower()

        items: list[CoverageItem] = []
        for spec in EXPECTED_CATEGORIES:
            classified = [record for record in documents if record.category == spec.key]

            matched_keywords: list[str] = []
            for keyword in spec.content_keywords:
                if keyword.lower() in corpus_lower:
                    matched_keywords.append(keyword)
            for keyword in spec.filename_keywords:
                if keyword.lower() in corpus_lower:
                    matched_keywords.append(keyword)

            evidence = [record.name for record in classified]
            # A category is "covered" only when a document is actually
            # classified into it; keyword hits alone only earn "partial".
            if evidence and matched_keywords:
                status = "covered"
                reason = f"存在 {len(evidence)} 个归类到该类型的文档，且命中 {len(matched_keywords)} 个特征关键词。"
            elif evidence:
                status = "partial"
                reason = f"有 {len(evidence)} 个文档被归类到该类型，但缺少典型内容特征。"
            elif matched_keywords:
                status = "partial"
                reason = f"仅在正文中出现相关关键词（{'、'.join(matched_keywords[:3])}），但没有专门文档。"
            else:
                status = "missing"
                reason = "未发现任何文档或关键词证据。"

            items.append(
                CoverageItem(
                    category=spec.key,
                    label=spec.label,
                    status=status,  # type: ignore[arg-type]
                    description=spec.description,
                    document_count=len(evidence),
                    evidence_documents=evidence[:8],
                    matched_keywords=matched_keywords[:8],
                    reason=reason,
                    suggested_documents=list(spec.suggested_titles),
                )
            )

        covered = [item.label for item in items if item.status == "covered"]
        partial = [item.label for item in items if item.status == "partial"]
        missing = [item.label for item in items if item.status == "missing"]

        recommendations: list[dict[str, str]] = []
        for item in items:
            if item.status == "covered":
                continue
            source = _suggested_owner(item.category)
            for title in item.suggested_documents or [f"《{item.label}》"]:
                recommendations.append(
                    {
                        "category": item.category,
                        "label": item.label,
                        "title": title,
                        "priority": "P0" if item.status == "missing" else "P1",
                        "reason": item.reason,
                        "owner": source,
                    }
                )

        total = len(items) or 1
        return GapReport(
            coverage=items,
            covered=covered,
            partial=partial,
            missing=missing,
            recommended_documents=recommendations,
            coverage_ratio=round(len(covered) / total, 4),
            analyzed_document_count=len(documents),
            analyzed_chunk_count=len(self.index.chunks),
            generated_at=datetime.now(timezone.utc),
        )

    # ------------------------------------------------------------------
    def build_overview(self) -> OverviewResponse:
        """One aggregate call powering the dashboard."""
        self.index.ensure_built()
        documents = list(self.index.documents.values())
        report = self.index.last_build
        activity_stats = self.activity.stats()
        coverage = self.analyze_coverage()

        category_breakdown: dict[str, int] = {}
        for record in documents:
            spec = CATEGORY_BY_KEY.get(record.category)
            label = spec.label if spec else record.category
            category_breakdown[label] = category_breakdown.get(label, 0) + 1

        knowledge = OverviewKnowledge(
            document_count=len(documents),
            indexed_document_count=sum(1 for record in documents if record.searchable),
            chunk_count=len(self.index.chunks),
            total_chars=sum(record.char_count for record in documents),
            last_indexed_at=report.built_at if report else None,
            index_state=report.index_state if report else "empty",
            category_breakdown=category_breakdown,
        )

        rag_records, _ = self.activity.list(kind="rag_query", limit=500)
        agent_records, _ = self.activity.list(kind="agent_run", limit=500)

        grounded = [item for item in rag_records if item.grounded]
        latencies = [item.latency_ms for item in rag_records if item.latency_ms]
        citations = [item.citation_count for item in rag_records]

        rag = OverviewRag(
            question_count=activity_stats.by_kind.get("rag_query", 0),
            answered_count=len(rag_records),
            grounded_rate=round(len(grounded) / len(rag_records), 4) if rag_records else 0.0,
            retrieval_hit_count=sum(item.chunk_count for item in rag_records),
            citation_count=sum(citations),
            average_latency_ms=round(sum(latencies) / len(latencies), 2) if latencies else 0.0,
            average_citations=round(sum(citations) / len(citations), 2) if citations else 0.0,
        )

        from ..agents.skills import get_skill_registry
        from ..agents.tools import get_registry

        skills = get_skill_registry().all()
        tools = get_registry()
        successful = [item for item in agent_records if item.status == "success"]
        agent = OverviewAgent(
            run_count=activity_stats.by_kind.get("agent_run", 0),
            successful_runs=len(successful),
            skill_count=len(skills),
            tool_count=len(tools.names()),
            tool_call_count=sum(len(item.tools) for item in agent_records),
            success_rate=round(len(successful) / len(agent_records), 4) if agent_records else 0.0,
            engine=self.settings.agent_engine,
            top_skills=[
                {"skill": name, "count": count}
                for name, count in list(activity_stats.by_skill.items())[:5]
            ],
        )

        system = OverviewSystem(
            llm_provider=self.settings.llm_provider,
            llm_model=self.settings.llm_model,
            llm_configured=self.settings.llm_configured,
            retriever_mode=self.settings.effective_retriever_mode,
            embedding_provider=self.settings.embedding_provider,
            embedding_model=(
                self.settings.embedding_model
                if self.settings.embedding_provider != "hashing"
                else "hashed-char-ngram-tfidf"
            ),
            index_state=knowledge.index_state,
            read_only=self.settings.demo_read_only,
            password_required=bool(self.settings.demo_password),
            version=self.settings.app_version,
            environment=self.settings.environment,
        )

        recent_activity, _ = self.activity.list(limit=8)
        recent_questions, _ = self.activity.list(kind="rag_query", limit=6)

        recent_documents = [
            {
                "id": record.id,
                "name": record.name,
                "category": CATEGORY_BY_KEY[record.category].label
                if record.category in CATEGORY_BY_KEY
                else record.category,
                "status": record.status,
                "chunks": len(self.index.chunks_of(record.id)),
                "modified_at": record.modified_at.isoformat() if record.modified_at else None,
            }
            for record in sorted(
                documents,
                key=lambda item: item.modified_at or datetime.min,
                reverse=True,
            )[:6]
        ]

        has_data = bool(documents) and (bool(rag_records) or bool(agent_records))
        notes: list[str] = []
        if not documents:
            notes.append("知识库为空，请先上传文档。")
        if not rag_records and not agent_records:
            notes.append("尚未产生问答或 Agent 运行记录，Dashboard 的运行时指标将显示为 0。")

        return OverviewResponse(
            knowledge=knowledge,
            agent=agent,
            rag=rag,
            system=system,
            recent_activity=[_to_ref(item) for item in recent_activity],
            recent_questions=[_to_ref(item) for item in recent_questions],
            recent_documents=recent_documents,
            coverage_summary={
                "covered": len(coverage.covered),
                "partial": len(coverage.partial),
                "missing": len(coverage.missing),
                "coverage_ratio": coverage.coverage_ratio,
                "total_categories": len(coverage.coverage),
            },
            quick_actions=_quick_actions(self.settings, has_documents=bool(documents)),
            generated_at=datetime.now(timezone.utc),
            data_available=has_data,
            notes=notes,
        )


def _to_ref(record) -> ActivityRef:
    return ActivityRef(
        id=record.id,
        kind=record.kind,
        title=record.title,
        detail=record.detail,
        status=record.status,
        latency_ms=record.latency_ms,
        created_at=record.created_at,
        skill=record.skill,
        intent=record.intent,
        citations=record.citation_count,
    )


def _quick_actions(settings: Settings, *, has_documents: bool) -> list[QuickAction]:
    readable = settings.demo_read_only is False
    return [
        QuickAction(
            id="ask",
            label="知识库问答",
            description="基于企业资料提问，回答带引用编号与来源抽屉",
            href="/ask",
            icon="message-circle",
            enabled=has_documents,
        ),
        QuickAction(
            id="upload",
            label="上传知识文档",
            description="支持 Markdown / 文本 / PDF / Word，上传后自动解析与索引",
            href="/knowledge/documents",
            icon="upload",
            enabled=readable,
        ),
        QuickAction(
            id="solution",
            label="生成售前方案",
            description="从客户需求出发，生成带引用的八章节方案初稿",
            href="/solution-studio",
            icon="file-text",
            enabled=has_documents,
        ),
        QuickAction(
            id="agent",
            label="运行 Agent",
            description="自动识别意图、选择 Skill、调用 Tool 并展示完整执行轨迹",
            href="/agent",
            icon="workflow",
            enabled=True,
        ),
        QuickAction(
            id="gaps",
            label="分析知识缺口",
            description="按资料类型统计 covered / partial / missing",
            href="/insights/gaps",
            icon="search",
            enabled=has_documents,
        ),
    ]


_OWNER_BY_CATEGORY = {
    "pricing": "商务 / 销售运营团队",
    "case": "客户成功团队",
    "implementation": "交付团队",
    "support": "客户成功 / 支持团队",
    "competitor": "市场 / 竞品分析团队",
    "customer_requirements": "解决方案团队",
}


def _suggested_owner(category: str) -> str:
    return _OWNER_BY_CATEGORY.get(category, "产品 / 解决方案团队")


_service: InsightsService | None = None


def get_insights_service(settings: Settings | None = None) -> InsightsService:
    """Process-wide insights service."""
    global _service
    if _service is None:
        _service = InsightsService(settings or get_settings())
    return _service


def reset_insights_service() -> None:
    """Drop the singleton (tests)."""
    global _service
    _service = None


def analyze_coverage(index: KnowledgeIndex | None = None, settings: Settings | None = None) -> GapReport:
    """Convenience wrapper used by the agent tools."""
    return InsightsService(settings=settings, index=index).analyze_coverage()
