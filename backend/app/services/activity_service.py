"""Activity ledger — the observability backbone.

Every user-visible operation (RAG query, agent run, solution generation,
evaluation run, knowledge mutation) writes one row here.  It powers:

* the Overview dashboard counters (runs / questions / latency),
* the Insights → Activity page,
* the Evaluation page's failure cases.

Two backends, chosen by ``ACTIVITY_BACKEND``:

``sqlite`` (default)
    A single file at ``backend/data/activity.sqlite3``.  Aggregations are done
    in SQL, and writes are serialised with a lock so a threaded ASGI server
    cannot corrupt the database.

``jsonl``
    Append-only newline-delimited JSON.  Useful when the filesystem is
    read-mostly or SQLite is unavailable.

**No secrets are ever written.**  The record model has no field for API keys,
and the ``meta`` dict is filtered against a deny-list before insertion.
"""

from __future__ import annotations

import json
import re
import sqlite3
import threading
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from ..core.config import Settings, get_settings
from ..core.logging import get_logger
from ..schemas.activity import ActivityRecord, ActivityStats

logger = get_logger("app.services.activity")

# Names that must never reach the ledger. Matched per underscore-delimited
# segment so that ``api_key``, ``secret_key`` and ``refresh_token`` are all
# caught, while legitimate counters such as ``tokens_used`` are not.
_CREDENTIAL_RE = re.compile(
    r"(^|_)("
    r"key|keys|apikey|api_key|secret|secrets|password|passwd|pwd|"
    r"credential|credentials|token|tokens_auth|bearer|authorization|auth|"
    r"dsn|database_url|connection_string|private|salt"
    r")($|_)",
    re.IGNORECASE,
)

# Exact names that the segment rule would miss or that are simply worth pinning.
_DENY_EXACT = {
    "apikey",
    "accesskey",
    "secretkey",
    "openai_api_key",
    "llm_api_key",
    "embedding_api_key",
    "demo_password",
    "database_url",
    "redis_url",
    "webhook",
    "webhook_url",
}

# Legitimate names that contain a credential-like word but carry no secret.
_ALLOW_EXACT = {
    "tokens_used",
    "token_count",
    "total_tokens",
    "prompt_tokens",
    "completion_tokens",
    "tokenizer",
    "keys_count",
}


def _is_sensitive_key(key: str) -> bool:
    """Whether a field name looks like it carries a credential."""
    normalized = str(key).strip().lower()
    if not normalized:
        return False
    if normalized in _ALLOW_EXACT:
        return False
    if normalized in _DENY_EXACT:
        return True
    return bool(_CREDENTIAL_RE.search(normalized))

_SCHEMA = """
CREATE TABLE IF NOT EXISTS activity (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    detail TEXT DEFAULT '',
    status TEXT NOT NULL,
    intent TEXT,
    skill TEXT,
    tools TEXT DEFAULT '[]',
    latency_ms REAL DEFAULT 0,
    source_ids TEXT DEFAULT '[]',
    source_names TEXT DEFAULT '[]',
    citation_count INTEGER DEFAULT 0,
    chunk_count INTEGER DEFAULT 0,
    grounded INTEGER,
    engine TEXT,
    model TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    meta TEXT DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS activity_created_at ON activity (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_kind ON activity (kind);
"""


def _sanitize_meta(meta: dict | None) -> dict:
    """Drop anything that looks like a credential, recursively at depth 2."""
    if not meta:
        return {}
    clean: dict = {}
    for key, value in meta.items():
        if _is_sensitive_key(key):
            continue
        if isinstance(value, (str, int, float, bool)) or value is None:
            clean[key] = value
        elif isinstance(value, (list, tuple)):
            clean[key] = [
                item for item in value if isinstance(item, (str, int, float, bool))
            ][:20]
        elif isinstance(value, dict):
            clean[key] = {
                nested_key: nested_value
                for nested_key, nested_value in value.items()
                if not _is_sensitive_key(nested_key)
                and isinstance(nested_value, (str, int, float, bool, type(None)))
            }
    return clean


class ActivityService:
    """SQLite/JSONL activity ledger."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.backend = (self.settings.activity_backend or "sqlite").lower()
        self.enabled = self.settings.activity_enabled
        self._lock = threading.RLock()
        self._initialised = False

    # ------------------------------------------------------------------
    def _ensure(self) -> None:
        if self._initialised:
            return
        with self._lock:
            if self._initialised:
                return
            self.settings.data_dir.mkdir(parents=True, exist_ok=True)
            if self.backend == "sqlite":
                with self._connect() as connection:
                    connection.executescript(_SCHEMA)
            self._initialised = True

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(str(self.settings.activity_db_path), timeout=10.0)
        connection.row_factory = sqlite3.Row
        return connection

    # ------------------------------------------------------------------
    def record(
        self,
        *,
        kind: str,
        title: str,
        detail: str = "",
        status: str = "success",
        intent: str | None = None,
        skill: str | None = None,
        tools: list[str] | None = None,
        latency_ms: float = 0.0,
        source_ids: list[str] | None = None,
        source_names: list[str] | None = None,
        citation_count: int = 0,
        chunk_count: int = 0,
        grounded: bool | None = None,
        engine: str | None = None,
        model: str | None = None,
        error: str | None = None,
        meta: dict | None = None,
    ) -> ActivityRecord:
        """Persist one record.  Never raises into the request path."""
        record = ActivityRecord(
            id=uuid.uuid4().hex[:16],
            kind=kind,  # type: ignore[arg-type]
            title=title[:300],
            detail=(detail or "")[:4000],
            status=status,  # type: ignore[arg-type]
            intent=intent,
            skill=skill,
            tools=tools or [],
            latency_ms=round(latency_ms, 2),
            source_ids=source_ids or [],
            source_names=source_names or [],
            citation_count=citation_count,
            chunk_count=chunk_count,
            grounded=grounded,
            engine=engine,
            model=model,
            error=(error or "")[:1000] or None,
            created_at=datetime.now(timezone.utc),
            meta=_sanitize_meta(meta),
        )

        if not self.enabled:
            return record

        try:
            self._ensure()
            if self.backend == "jsonl":
                self._append_jsonl(record)
            else:
                self._insert_sqlite(record)
        except Exception as exc:  # pragma: no cover - ledger must never break a request
            logger.warning("Activity write failed: %s", exc)
        return record

    def _insert_sqlite(self, record: ActivityRecord) -> None:
        with self._lock, self._connect() as connection:
            connection.execute(
                """
                INSERT INTO activity (
                    id, kind, title, detail, status, intent, skill, tools, latency_ms,
                    source_ids, source_names, citation_count, chunk_count, grounded,
                    engine, model, error, created_at, meta
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    record.id, record.kind, record.title, record.detail, record.status,
                    record.intent, record.skill, json.dumps(record.tools, ensure_ascii=False),
                    record.latency_ms,
                    json.dumps(record.source_ids, ensure_ascii=False),
                    json.dumps(record.source_names, ensure_ascii=False),
                    record.citation_count, record.chunk_count,
                    None if record.grounded is None else int(record.grounded),
                    record.engine, record.model, record.error,
                    record.created_at.isoformat(),
                    json.dumps(record.meta, ensure_ascii=False, default=str),
                ),
            )
            connection.commit()
            self._prune(connection)

    def _prune(self, connection: sqlite3.Connection) -> None:
        """Keep the ledger bounded (``ACTIVITY_MAX_RECORDS``)."""
        limit = max(int(self.settings.activity_max_records), 100)
        connection.execute(
            "DELETE FROM activity WHERE id NOT IN ("
            "  SELECT id FROM activity ORDER BY created_at DESC LIMIT ?"
            ")",
            (limit,),
        )
        connection.commit()

    def _append_jsonl(self, record: ActivityRecord) -> None:
        path = self.settings.activity_jsonl_path
        path.parent.mkdir(parents=True, exist_ok=True)
        with self._lock, path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record.model_dump(mode="json"), ensure_ascii=False) + "\n")
        self._prune_jsonl(path)

    def _prune_jsonl(self, path: Path) -> None:
        limit = max(int(self.settings.activity_max_records), 100)
        try:
            with self._lock:
                lines = path.read_text(encoding="utf-8").splitlines()
                if len(lines) > limit:
                    path.write_text("\n".join(lines[-limit:]) + "\n", encoding="utf-8")
        except Exception:  # pragma: no cover
            pass

    # ------------------------------------------------------------------
    # Reads
    # ------------------------------------------------------------------
    def _rows_jsonl(self) -> list[ActivityRecord]:
        path = self.settings.activity_jsonl_path
        if not path.exists():
            return []
        records: list[ActivityRecord] = []
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                records.append(ActivityRecord(**json.loads(line)))
            except Exception:
                continue
        return records

    def list(
        self,
        *,
        kind: str | None = None,
        status: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[ActivityRecord], int]:
        """Return ``(records, total)`` newest first."""
        if not self.enabled:
            return [], 0

        try:
            self._ensure()
        except Exception:  # pragma: no cover
            return [], 0

        if self.backend == "jsonl":
            records = self._rows_jsonl()
            if kind:
                records = [item for item in records if item.kind == kind]
            if status:
                records = [item for item in records if item.status == status]
            records.sort(key=lambda item: item.created_at, reverse=True)
            return records[offset : offset + limit], len(records)

        clauses: list[str] = []
        params: list[object] = []
        if kind:
            clauses.append("kind = ?")
            params.append(kind)
        if status:
            clauses.append("status = ?")
            params.append(status)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

        with self._connect() as connection:
            total = connection.execute(
                f"SELECT count(*) FROM activity {where}", params
            ).fetchone()[0]
            rows = connection.execute(
                f"SELECT * FROM activity {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
                [*params, limit, offset],
            ).fetchall()

        return [self._row_to_record(row) for row in rows], int(total)

    @staticmethod
    def _row_to_record(row: sqlite3.Row) -> ActivityRecord:
        return ActivityRecord(
            id=row["id"],
            kind=row["kind"],
            title=row["title"],
            detail=row["detail"] or "",
            status=row["status"],
            intent=row["intent"],
            skill=row["skill"],
            tools=json.loads(row["tools"] or "[]"),
            latency_ms=row["latency_ms"] or 0.0,
            source_ids=json.loads(row["source_ids"] or "[]"),
            source_names=json.loads(row["source_names"] or "[]"),
            citation_count=row["citation_count"] or 0,
            chunk_count=row["chunk_count"] or 0,
            grounded=None if row["grounded"] is None else bool(row["grounded"]),
            engine=row["engine"],
            model=row["model"],
            error=row["error"],
            created_at=datetime.fromisoformat(row["created_at"]),
            meta=json.loads(row["meta"] or "{}"),
        )

    def stats(self, *, days: int = 30) -> ActivityStats:
        """Aggregate counters for the Insights page."""
        records, total = self.list(limit=10_000)
        if not records:
            return ActivityStats(backend=self.backend)

        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        scoped = [item for item in records if item.created_at >= cutoff] or records

        by_kind: dict[str, int] = {}
        by_status: dict[str, int] = {}
        by_skill: dict[str, int] = {}
        latencies: list[float] = []

        for item in scoped:
            by_kind[item.kind] = by_kind.get(item.kind, 0) + 1
            by_status[item.status] = by_status.get(item.status, 0) + 1
            if item.skill:
                by_skill[item.skill] = by_skill.get(item.skill, 0) + 1
            if item.latency_ms:
                latencies.append(item.latency_ms)

        failures = by_status.get("failed", 0) + by_status.get("blocked", 0)
        latencies.sort()

        def percentile(values: list[float], ratio: float) -> float:
            if not values:
                return 0.0
            index = min(int(len(values) * ratio), len(values) - 1)
            return round(values[index], 2)

        return ActivityStats(
            total=total,
            by_kind=by_kind,
            by_status=by_status,
            by_skill=dict(sorted(by_skill.items(), key=lambda pair: -pair[1])[:10]),
            failure_count=failures,
            success_rate=round((len(scoped) - failures) / len(scoped), 4) if scoped else 0.0,
            average_latency_ms=round(sum(latencies) / len(latencies), 2) if latencies else 0.0,
            p95_latency_ms=percentile(latencies, 0.95),
            last_activity_at=scoped[0].created_at if scoped else None,
            backend=self.backend,
        )

    def recent_titles(self, kind: str, limit: int = 5) -> list[ActivityRecord]:
        """Newest records of one kind."""
        records, _ = self.list(kind=kind, limit=limit)
        return records

    def clear(self) -> int:
        """Drop every record (used by the Settings page)."""
        try:
            self._ensure()
            if self.backend == "jsonl":
                path = self.settings.activity_jsonl_path
                if path.exists():
                    path.write_text("", encoding="utf-8")
                return 0
            with self._lock, self._connect() as connection:
                removed = connection.execute("SELECT count(*) FROM activity").fetchone()[0]
                connection.execute("DELETE FROM activity")
                connection.commit()
                return int(removed)
        except Exception as exc:  # pragma: no cover
            logger.warning("Activity clear failed: %s", exc)
            return 0


_service: ActivityService | None = None
_service_lock = threading.Lock()


def get_activity_service(settings: Settings | None = None) -> ActivityService:
    """Process-wide activity ledger."""
    global _service
    with _service_lock:
        if _service is None:
            _service = ActivityService(settings or get_settings())
        return _service


def reset_activity_service() -> None:
    """Drop the singleton (tests, and after a settings change)."""
    global _service
    with _service_lock:
        _service = None
