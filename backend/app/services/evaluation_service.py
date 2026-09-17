"""RAG evaluation: a small, honest harness.

What is measured is exactly what can be measured without pretending:

* **Retrieval** — Hit@K, MRR, Recall@K and keyword coverage over a frozen
  dataset of questions with known expected documents.
* **Answer quality** — human labels only (``correct`` / ``partial`` / ``wrong``).
  No LLM-as-judge score is fabricated; ``answer_accuracy`` is ``None`` until a
  human has actually graded something.

The dataset ships pre-seeded with questions derived from the real knowledge
base, with ``expected_document_ids`` resolved by matching document names.  It is
a *starting point* for real curation, not a claim of benchmark quality.
"""

from __future__ import annotations

import json
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from ..core.config import Settings, get_settings
from ..core.errors import InvalidRequestError, NotFoundError
from ..core.logging import get_logger
from ..rag.index import KnowledgeIndex, get_index
from ..rag.pipeline import RagPipeline
from ..rag.text import extract_query_terms
from ..schemas.evaluation import (
    EvalCase,
    EvalCaseResult,
    EvalDatasetResponse,
    EvalRunResponse,
    EvalRunSummary,
)

logger = get_logger("app.services.evaluation")

# (question, answer keywords, document-name keywords)
SEED_QUESTIONS: tuple[tuple[str, tuple[str, ...], tuple[str, ...]], ...] = (
    ("Rerank 在 RAG 检索链路里解决什么问题？", ("召回", "排序", "候选"), ("rerank",)),
    ("Top K 设置过大或过小分别有什么影响？", ("召回", "噪声", "漏"), ("rerank", "top")),
    ("RAG 和微调有什么区别？", ("检索", "参数", "知识"), ("rag",)),
    ("Skill 和 Tool 有什么区别？", ("能力", "函数", "调用"), ("skill",)),
    ("Agent 的意图识别是怎么做的？", ("路由", "意图", "置信度"), ("routing", "intent")),
    ("MCP 解决了什么问题？", ("工具", "协议", "标准化"), ("mcp",)),
    ("Prompt、Context 和 Memory 有什么区别？", ("上下文", "记忆", "提示"), ("prompt",)),
    ("如何评估一个 RAG 系统的效果？", ("检索", "评估", "指标"), ("evaluation",)),
    ("Chunk 切分粒度会怎么影响检索效果？", ("切分", "粒度", "召回", "上下文"), ("rerank", "rag")),
    ("LangGraph 和自定义状态机有什么取舍？", ("状态", "图", "节点"), ("langgraph", "workflow")),
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class EvaluationService:
    """Dataset curation + retrieval evaluation runs."""

    def __init__(self, settings: Settings | None = None, index: KnowledgeIndex | None = None) -> None:
        self.settings = settings or get_settings()
        self._index = index
        self._lock = threading.RLock()

    @property
    def index(self) -> KnowledgeIndex:
        if self._index is None:
            self._index = get_index(self.settings)
        return self._index

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------
    @property
    def dataset_path(self) -> Path:
        return self.settings.evaluation_dataset_path or (
            self.settings.evaluation_dir / "eval_dataset.json"
        )

    @property
    def runs_path(self) -> Path:
        return self.settings.evaluation_dir / "runs.json"

    def _read_json(self, path: Path, default):
        if not path.exists():
            return default
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:  # pragma: no cover
            logger.warning("Could not read %s: %s", path, exc)
            return default

    def _write_json(self, path: Path, payload) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    # ------------------------------------------------------------------
    # Dataset
    # ------------------------------------------------------------------
    def _resolve_document_ids(self, name_keywords: tuple[str, ...]) -> list[str]:
        if not name_keywords:
            return []
        self.index.ensure_built()
        matched: list[str] = []
        for record in self.index.documents.values():
            lowered = record.name.lower()
            if any(keyword in lowered for keyword in name_keywords):
                matched.append(record.id)
        return matched

    def _read_cases(self) -> list[EvalCase]:
        """Read the persisted dataset without triggering auto-seeding.

        ``load_dataset`` auto-seeds when the file is missing; seeding must not
        call back into it, or the two would recurse forever.
        """
        raw = self._read_json(self.dataset_path, [])
        cases: list[EvalCase] = []
        for item in raw or []:
            try:
                cases.append(EvalCase(**item))
            except Exception:
                continue
        return cases

    def seed_dataset(self, *, overwrite: bool = False) -> list[EvalCase]:
        """Create the starter dataset from the real knowledge base."""
        if not overwrite:
            existing = self._read_cases()
            if existing:
                return existing

        cases: list[EvalCase] = []
        for question, keywords, doc_keywords in SEED_QUESTIONS:
            cases.append(
                EvalCase(
                    id=uuid.uuid4().hex[:10],
                    question=question,
                    expected_keywords=list(keywords),
                    expected_document_ids=self._resolve_document_ids(doc_keywords),
                    notes="由知识库内容自动生成，建议人工校准期望文档。",
                    created_at=_now(),
                )
            )
        self._write_json(self.dataset_path, [case.model_dump(mode="json") for case in cases])
        logger.info("Seeded evaluation dataset with %d cases", len(cases))
        return cases

    def load_dataset(self, *, auto_seed: bool = True) -> EvalDatasetResponse:
        if not self.dataset_path.exists() and auto_seed:
            cases = self.seed_dataset()
            return EvalDatasetResponse(cases=cases, total=len(cases), path=str(self.dataset_path))

        cases = self._read_cases()
        if not cases and auto_seed:
            cases = self.seed_dataset(overwrite=True)
        return EvalDatasetResponse(cases=cases, total=len(cases), path=str(self.dataset_path))

    def add_case(self, *, question: str, expected_keywords, expected_document_ids, notes: str = "") -> EvalCase:
        with self._lock:
            dataset = self.load_dataset()
            case = EvalCase(
                id=uuid.uuid4().hex[:10],
                question=question.strip(),
                expected_keywords=list(expected_keywords or []),
                expected_document_ids=list(expected_document_ids or []),
                notes=notes,
                created_at=_now(),
            )
            cases = [*dataset.cases, case]
            self._write_json(self.dataset_path, [item.model_dump(mode="json") for item in cases])
            return case

    def delete_case(self, case_id: str) -> None:
        with self._lock:
            dataset = self.load_dataset()
            remaining = [item for item in dataset.cases if item.id != case_id]
            if len(remaining) == len(dataset.cases):
                raise NotFoundError(f"评测用例不存在：{case_id}")
            self._write_json(self.dataset_path, [item.model_dump(mode="json") for item in remaining])

    # ------------------------------------------------------------------
    # Runs
    # ------------------------------------------------------------------
    def run(
        self,
        *,
        case_ids: list[str] | None = None,
        k: int = 4,
        mode: str | None = None,
        rerank_provider: str | None = None,
        generate_answers: bool = False,
    ) -> EvalRunResponse:
        """Execute a retrieval evaluation."""
        dataset = self.load_dataset()
        cases = dataset.cases
        if case_ids:
            wanted = set(case_ids)
            cases = [item for item in cases if item.id in wanted]
        if not cases:
            raise InvalidRequestError("评测数据集为空，请先添加用例。")

        pipeline = RagPipeline(self.index, self.settings)
        started = time.perf_counter()
        started_at = _now()

        results: list[EvalCaseResult] = []
        for case in cases:
            case_started = time.perf_counter()
            outcome = pipeline.retrieve_only(
                case.question,
                k=k,
                mode=mode,
                rerank_provider=rerank_provider,
            )
            latency = round((time.perf_counter() - case_started) * 1000, 2)

            retrieved_ids = [item.document_id for item in outcome.items]
            unique_ids = list(dict.fromkeys(retrieved_ids))

            expected = set(case.expected_document_ids)
            first_hit_rank: int | None = None
            if expected:
                for rank, document_id in enumerate(unique_ids, start=1):
                    if document_id in expected:
                        first_hit_rank = rank
                        break

            hit = first_hit_rank is not None
            reciprocal = round(1.0 / first_hit_rank, 4) if first_hit_rank else 0.0
            recall = (
                round(len(expected & set(unique_ids)) / len(expected), 4) if expected else 0.0
            )

            joined = " ".join(item.content for item in outcome.items)
            terms = extract_query_terms(case.question, limit=12)
            matched = [term for term in terms if term in joined]
            coverage = round(len(matched) / len(terms), 4) if terms else 0.0

            failure_reason = ""
            if expected and not hit:
                failure_reason = "期望文档未进入 Top-K（召回问题）"
            elif not expected:
                failure_reason = "" if coverage > 0 else "未配置期望文档，且未命中问题关键词"

            results.append(
                EvalCaseResult(
                    case_id=case.id,
                    question=case.question,
                    retrieved_document_ids=unique_ids,
                    retrieved_chunk_ids=[item.chunk_id for item in outcome.items],
                    hit_at_k=hit,
                    first_hit_rank=first_hit_rank,
                    reciprocal_rank=reciprocal,
                    recall_at_k=recall,
                    keyword_coverage=coverage,
                    matched_keywords=matched,
                    missing_keywords=[term for term in terms if term not in matched],
                    latency_ms=latency,
                    failure_reason=failure_reason,
                )
            )

        graded = [item for item in results if item.answer_grade != "ungraded"]
        summary = EvalRunSummary(
            run_id=uuid.uuid4().hex[:10],
            case_count=len(results),
            k=k,
            mode=mode or self.settings.effective_retriever_mode,
            hit_at_k=round(sum(1 for item in results if item.hit_at_k) / len(results), 4),
            mrr=round(sum(item.reciprocal_rank for item in results) / len(results), 4),
            recall_at_k=round(sum(item.recall_at_k for item in results) / len(results), 4),
            keyword_coverage=round(sum(item.keyword_coverage for item in results) / len(results), 4),
            graded_count=len(graded),
            correct_count=sum(1 for item in graded if item.answer_grade == "correct"),
            partial_count=sum(1 for item in graded if item.answer_grade == "partial"),
            wrong_count=sum(1 for item in graded if item.answer_grade == "wrong"),
            answer_accuracy=(
                round(sum(1 for item in graded if item.answer_grade == "correct") / len(graded), 4)
                if graded
                else None
            ),
            average_latency_ms=round(sum(item.latency_ms for item in results) / len(results), 2),
            started_at=started_at,
            duration_ms=round((time.perf_counter() - started) * 1000, 2),
            notes=[
                "检索指标（Hit@K / MRR / Recall）由确定性计算得出。",
                "答案准确率仅统计人工评分过的用例，未评分时为 null，不使用模型自评。",
            ],
        )

        self._append_run(summary)
        return EvalRunResponse(summary=summary, cases=results)

    def _append_run(self, summary: EvalRunSummary) -> None:
        history = self._read_json(self.runs_path, [])
        history.append(summary.model_dump(mode="json"))
        self._write_json(self.runs_path, history[-50:])

    def run_history(self, limit: int = 10) -> list[EvalRunSummary]:
        history = self._read_json(self.runs_path, [])
        summaries: list[EvalRunSummary] = []
        for item in history[-limit:][::-1]:
            try:
                summaries.append(EvalRunSummary(**item))
            except Exception:
                continue
        return summaries

    # ------------------------------------------------------------------
    # Human grading
    # ------------------------------------------------------------------
    @property
    def grades_path(self) -> Path:
        return self.settings.evaluation_dir / "grades.json"

    def set_grade(self, case_id: str, grade: str, note: str = "") -> tuple[int, float | None]:
        """Persist a human grade for one case."""
        with self._lock:
            dataset = self.load_dataset()
            if all(item.id != case_id for item in dataset.cases):
                raise NotFoundError(f"评测用例不存在：{case_id}")
            grades: dict = self._read_json(self.grades_path, {})
            grades[case_id] = {"grade": grade, "note": note, "graded_at": _now().isoformat()}
            self._write_json(self.grades_path, grades)

            graded = [value for value in grades.values() if value.get("grade") in {"correct", "partial", "wrong"}]
            accuracy = (
                round(sum(1 for value in graded if value["grade"] == "correct") / len(graded), 4)
                if graded
                else None
            )
            return len(graded), accuracy

    def load_grades(self) -> dict:
        return self._read_json(self.grades_path, {})


_service: EvaluationService | None = None


def get_evaluation_service(settings: Settings | None = None) -> EvaluationService:
    """Process-wide evaluation service."""
    global _service
    if _service is None:
        _service = EvaluationService(settings or get_settings())
    return _service


def reset_evaluation_service() -> None:
    """Drop the singleton (tests)."""
    global _service
    _service = None
