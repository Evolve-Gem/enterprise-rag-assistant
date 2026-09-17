"""Vector stores.

The retriever only ever talks to the :class:`VectorStore` interface, so the
storage engine is a deployment decision:

``NumpyVectorStore`` (default)
    Exact cosine search over an in-process float32 matrix.  For the corpus
    sizes this project targets (hundreds to a few thousand chunks) exhaustive
    search is both faster and simpler than an approximate index -- and it has
    zero infrastructure cost, which keeps the demo runnable anywhere.

``PgVectorStore`` (opt-in)
    ``VECTOR_STORE=pgvector`` + ``DATABASE_URL``.  Uses PostgreSQL with the
    ``vector`` extension.  The schema is created on demand.

    .. warning::
       The reference development environment has no PostgreSQL instance, so this
       backend is shipped **unverified** -- it is covered by unit tests only for
       its SQL construction, not by a live integration test.  Everything else in
       the project defaults to the NumPy store, which is what the running demo
       uses.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from ..core.config import Settings, get_settings
from ..core.errors import AppError, ProviderNotConfiguredError
from ..core.logging import get_logger

logger = get_logger("app.rag.vector_store")


@dataclass
class VectorHit:
    """One nearest-neighbour result."""

    chunk_id: str
    score: float
    rank: int


class VectorStore(ABC):
    """Minimal interface: upsert, search, persist."""

    kind: str = "abstract"
    dim: int = 0

    @property
    def size(self) -> int:
        return self.__len__()

    @abstractmethod
    def __len__(self) -> int: ...

    @abstractmethod
    def upsert(self, ids: list[str], vectors: np.ndarray) -> None:
        """Insert or replace vectors for ``ids``."""

    @abstractmethod
    def remove(self, ids: list[str]) -> None:
        """Drop vectors for ``ids`` (missing ids are ignored)."""

    @abstractmethod
    def search(self, vector: np.ndarray, k: int = 8) -> list[VectorHit]:
        """Return the ``k`` closest stored vectors, best first."""

    def clear(self) -> None:
        """Drop everything."""

    def persist(self, directory: Path) -> None:  # pragma: no cover - optional
        """Persist to ``directory`` when the backend supports it."""

    def load(self, directory: Path) -> bool:  # pragma: no cover - optional
        """Restore from ``directory``; return True on success."""
        return False


class NumpyVectorStore(VectorStore):
    """Exact cosine similarity over a normalised float32 matrix."""

    kind = "numpy"

    def __init__(self, dim: int) -> None:
        self.dim = int(dim)
        self._ids: list[str] = []
        self._index: dict[str, int] = {}
        self._matrix: np.ndarray = np.zeros((0, self.dim), dtype=np.float32)

    # -- internals -----------------------------------------------------
    def _normalise(self, vectors: np.ndarray) -> np.ndarray:
        matrix = np.atleast_2d(np.asarray(vectors, dtype=np.float32))
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return matrix / norms

    # -- API -----------------------------------------------------------
    def __len__(self) -> int:
        return len(self._ids)

    def upsert(self, ids: list[str], vectors: np.ndarray) -> None:
        if not ids:
            return
        matrix = self._normalise(vectors)
        if matrix.shape[1] != self.dim:
            self.dim = int(matrix.shape[1])

        appended: list[np.ndarray] = []
        for offset, chunk_id in enumerate(ids):
            row = matrix[offset]
            existing = self._index.get(chunk_id)
            if existing is None:
                self._index[chunk_id] = len(self._ids)
                self._ids.append(chunk_id)
                appended.append(row)
            else:
                self._matrix[existing] = row

        if appended:
            block = np.vstack(appended)
            if self._matrix.size == 0:
                self._matrix = block
            else:
                self._matrix = np.vstack([self._matrix, block])

    def remove(self, ids: list[str]) -> None:
        if not ids:
            return
        drop = {chunk_id for chunk_id in ids if chunk_id in self._index}
        if not drop:
            return
        keep = [chunk_id for chunk_id in self._ids if chunk_id not in drop]
        positions = [self._index[chunk_id] for chunk_id in keep]
        self._matrix = (
            self._matrix[positions] if positions else np.zeros((0, self.dim), dtype=np.float32)
        )
        self._ids = keep
        self._index = {chunk_id: position for position, chunk_id in enumerate(keep)}

    def search(self, vector: np.ndarray, k: int = 8) -> list[VectorHit]:
        if not self._ids or k <= 0:
            return []
        query = self._normalise(vector)[0]
        if query.shape[0] != self.dim:
            return []
        scores = self._matrix @ query
        take = min(k, scores.shape[0])
        order = np.argpartition(-scores, take - 1)[:take]
        order = order[np.argsort(-scores[order])]
        return [
            VectorHit(chunk_id=self._ids[int(position)], score=float(scores[position]), rank=rank)
            for rank, position in enumerate(order, start=1)
        ]

    def clear(self) -> None:
        self._ids = []
        self._index = {}
        self._matrix = np.zeros((0, self.dim), dtype=np.float32)

    # -- persistence ---------------------------------------------------
    def persist(self, directory: Path) -> None:
        directory = Path(directory)
        directory.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(
            directory / "vectors.npz",
            matrix=self._matrix,
            ids=np.asarray(self._ids, dtype=object),
            dim=np.asarray([self.dim]),
        )

    def load(self, directory: Path) -> bool:
        path = Path(directory) / "vectors.npz"
        if not path.exists():
            return False
        try:
            with np.load(path, allow_pickle=True) as data:
                matrix = data["matrix"].astype(np.float32)
                ids = [str(item) for item in data["ids"].tolist()]
                dim = int(data["dim"][0])
        except Exception as exc:  # pragma: no cover - corrupt cache
            logger.warning("Could not load persisted vectors: %s", exc)
            return False

        if matrix.shape[0] != len(ids):
            return False

        self.dim = dim
        self._ids = ids
        self._index = {chunk_id: position for position, chunk_id in enumerate(ids)}
        self._matrix = matrix
        return True


class PgVectorStore(VectorStore):
    """PostgreSQL + pgvector backend.

    See the module docstring: this is opt-in and unverified in the reference
    environment.  It is included because "swap the vector store" should be a
    configuration change, not a rewrite.
    """

    kind = "pgvector"
    TABLE = "kb_chunk_vectors"

    def __init__(self, dsn: str, dim: int, table: str | None = None) -> None:
        try:
            import psycopg  # noqa: F401
        except ImportError as exc:  # pragma: no cover
            raise ProviderNotConfiguredError(
                "VECTOR_STORE=pgvector 需要 psycopg，请先安装 psycopg[binary]。"
            ) from exc
        self.dsn = dsn
        self.dim = int(dim)
        self.table = table or self.TABLE
        self._ensure_schema()

    # -- connection ----------------------------------------------------
    def _connect(self):
        import psycopg

        return psycopg.connect(self.dsn)

    def _ensure_schema(self) -> None:
        ddl = [
            "CREATE EXTENSION IF NOT EXISTS vector",
            f"""CREATE TABLE IF NOT EXISTS {self.table} (
                    chunk_id TEXT PRIMARY KEY,
                    embedding vector({self.dim}) NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )""",
            f"CREATE INDEX IF NOT EXISTS {self.table}_embedding_idx "
            f"ON {self.table} USING hnsw (embedding vector_cosine_ops)",
        ]
        with self._connect() as connection:
            with connection.cursor() as cursor:
                for statement in ddl:
                    cursor.execute(statement)
            connection.commit()

    # -- API -----------------------------------------------------------
    def __len__(self) -> int:
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute(f"SELECT count(*) FROM {self.table}")
            row = cursor.fetchone()
        return int(row[0]) if row else 0

    def upsert(self, ids: list[str], vectors: np.ndarray) -> None:
        if not ids:
            return
        matrix = np.atleast_2d(np.asarray(vectors, dtype=np.float32))
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        matrix = matrix / norms

        statement = (
            f"INSERT INTO {self.table} (chunk_id, embedding) VALUES (%s, %s) "
            f"ON CONFLICT (chunk_id) DO UPDATE SET embedding = EXCLUDED.embedding, "
            f"updated_at = now()"
        )
        with self._connect() as connection:
            with connection.cursor() as cursor:
                cursor.executemany(
                    statement,
                    [
                        (chunk_id, matrix[offset].tolist())
                        for offset, chunk_id in enumerate(ids)
                    ],
                )
            connection.commit()

    def remove(self, ids: list[str]) -> None:
        if not ids:
            return
        with self._connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(f"DELETE FROM {self.table} WHERE chunk_id = ANY(%s)", (list(ids),))
            connection.commit()

    def search(self, vector: np.ndarray, k: int = 8) -> list[VectorHit]:
        query = np.asarray(vector, dtype=np.float32).reshape(-1)
        norm = float(np.linalg.norm(query)) or 1.0
        query = query / norm
        statement = (
            f"SELECT chunk_id, 1 - (embedding <=> %s::vector) AS score "
            f"FROM {self.table} ORDER BY embedding <=> %s::vector LIMIT %s"
        )
        payload = query.tolist()
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute(statement, (payload, payload, k))
            rows = cursor.fetchall()
        return [
            VectorHit(chunk_id=str(row[0]), score=float(row[1]), rank=rank)
            for rank, row in enumerate(rows, start=1)
        ]

    def clear(self) -> None:
        with self._connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(f"TRUNCATE {self.table}")
            connection.commit()


# ---------------------------------------------------------------------------


def create_vector_store(settings: Settings | None = None, dim: int | None = None) -> VectorStore | None:
    """Build the configured vector store, or ``None`` when vectors are disabled."""
    settings = settings or get_settings()
    resolved_dim = dim or settings.embedding_dim

    if settings.embedding_provider in {"none", "off", "disabled"}:
        return None

    backend = (getattr(settings, "vector_store_backend", "") or "numpy").lower()

    if backend == "pgvector":
        dsn = getattr(settings, "database_url", "")
        if not dsn:
            logger.warning("VECTOR_STORE=pgvector but DATABASE_URL is empty -> using numpy store.")
            return NumpyVectorStore(dim=resolved_dim)
        try:
            return PgVectorStore(dsn=dsn, dim=resolved_dim)
        except AppError as exc:
            logger.warning("pgvector unavailable (%s) -> using numpy store.", exc.message)
            return NumpyVectorStore(dim=resolved_dim)

    return NumpyVectorStore(dim=resolved_dim)
