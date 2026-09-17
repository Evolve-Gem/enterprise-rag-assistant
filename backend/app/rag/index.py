"""The knowledge index: the single in-process source of truth for retrieval.

One build pass does the following, and records exactly what happened:

``scan``      → discover supported files under the knowledge base directory
``extract``   → pull text out of Markdown / text / PDF / DOCX
``classify``  → assign a knowledge category and tags (rule-based, explainable)
``chunk``     → heading-aware splitting with overlap
``keyword``   → fit the BM25 statistics
``vector``    → fit the embedder and upsert every chunk vector

Builds are cached on disk (``backend/data/index``) keyed by file size + mtime,
so a restart does not re-embed an unchanged corpus.  A stale cache is detected
and rebuilt automatically.
"""

from __future__ import annotations

import json
import re
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from ..core.config import Settings, get_settings
from ..core.logging import get_logger
from .bm25 import BM25
from .embedder import Embedder, create_embedder
from .loaders import Extraction, extract_text, type_label
from .splitter import Chunk, make_document_id, split_text
from .taxonomy import build_summary, classify_document, derive_tags, extract_outline
from .text import snippet
from .vector_store import VectorStore, create_vector_store

logger = get_logger("app.rag.index")

SUPPORTED_SUFFIXES = {".md", ".markdown", ".txt", ".pdf", ".docx"}
# Upper bound on the body kept in memory for previewing; extraction still uses
# the whole document for chunking.
MAX_STORED_CONTENT_CHARS = 200_000
INDEX_META_FILE = "index_meta.json"
# Bump whenever the extraction / chunking / scoring pipeline changes shape.
# Without this an old cache silently survives a code change and the metrics
# you measure no longer describe the code you are reading.
INDEX_SCHEMA_VERSION = 3

_FRONTMATTER = re.compile(r"\A---\s*\n(.*?)\n---\s*\n?", re.DOTALL)


def strip_frontmatter(text: str) -> tuple[str, dict[str, object]]:
    """Split a leading YAML front-matter block off a Markdown document.

    Front-matter is metadata (title/tags/date), not prose.  Indexing it as
    content produced a chunk whose highest-signal text was a wall of keys, which
    then won vector search on pure keyword density.  It is parsed into
    structured metadata and removed from the searchable body instead.
    """
    if not text:
        return "", {}
    match = _FRONTMATTER.match(text)
    if not match:
        return text, {}

    metadata: dict[str, object] = {}
    for line in match.group(1).splitlines():
        if ":" not in line:
            continue
        key, _, raw_value = line.partition(":")
        key = key.strip().lower()
        value = raw_value.strip().strip('"').strip("'")
        if not key or not value:
            continue
        if value.startswith("[") and value.endswith("]"):
            metadata[key] = [item.strip().strip('"').strip("'") for item in value[1:-1].split(",") if item.strip()]
        else:
            metadata[key] = value

    return text[match.end() :], metadata


def searchable_text(chunk: "Chunk") -> str:
    """Field-weighted text used for BM25 statistics.

    The file name and section path are prepended once.  Without this a document
    literally named "召回、Top K、Rerank 与 RAG 检索链路.md" got **zero** credit
    for matching the query "Rerank 在 RAG 里解决什么问题" -- its body only
    matched weakly while other documents accumulated more common terms.
    Title matches are one of the strongest relevance signals in real search
    systems and should not be thrown away.
    """
    header = f"{chunk.document_name} {chunk.section}".strip()
    return f"{header}\n{chunk.content}" if header else chunk.content


@dataclass
class DocumentRecord:
    """Everything the API knows about one knowledge document."""

    id: str
    name: str
    title: str
    suffix: str
    type_label: str
    relative_path: str
    absolute_path: str
    size_bytes: int
    modified_at: datetime | None
    created_at: datetime | None
    status: str = "uploaded"
    category: str = "other"
    tags: list[str] = field(default_factory=list)
    searchable: bool = False
    char_count: int = 0
    content: str = ""
    content_truncated: bool = False
    summary: str = ""
    outline: list[str] = field(default_factory=list)
    extraction_note: str = ""
    warnings: list[str] = field(default_factory=list)
    error: str = ""
    matched_keywords: list[str] = field(default_factory=list)
    frontmatter: dict = field(default_factory=dict)

    def fingerprint(self) -> str:
        """Cache key: changes whenever the file changes on disk."""
        stamp = self.modified_at.timestamp() if self.modified_at else 0.0
        return f"{self.size_bytes}:{stamp:.0f}"


@dataclass
class BuildReport:
    """Outcome of one index build."""

    document_count: int = 0
    chunk_count: int = 0
    vectorized_chunk_count: int = 0
    failed_count: int = 0
    keyword_index_ready: bool = False
    vector_index_ready: bool = False
    duration_ms: float = 0.0
    built_at: datetime | None = None
    from_cache: bool = False
    note: str = ""
    warnings: list[str] = field(default_factory=list)

    @property
    def index_state(self) -> str:
        if self.document_count == 0:
            return "empty"
        return "ready"


class KnowledgeIndex:
    """Mutable, thread-safe index over the knowledge base directory."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self._lock = threading.RLock()

        self.documents: dict[str, DocumentRecord] = {}
        self.chunks: list[Chunk] = []
        self.chunk_map: dict[str, Chunk] = {}
        self._chunk_positions: dict[str, int] = {}

        self.bm25 = BM25()
        self.embedder: Embedder | None = create_embedder(self.settings)
        self.vector_store: VectorStore | None = create_vector_store(
            self.settings,
            dim=self.embedder.dim if self.embedder else self.settings.embedding_dim,
        )
        self._vectorised_ids: set[str] = set()

        self.last_build: BuildReport | None = None
        self._stale = True

    # ------------------------------------------------------------------
    # Scalar accessors
    # ------------------------------------------------------------------
    @property
    def is_stale(self) -> bool:
        return self._stale

    def mark_stale(self) -> None:
        """Flag the index as needing a rebuild (after a write operation)."""
        with self._lock:
            self._stale = True

    def __len__(self) -> int:
        return len(self.chunks)

    # ------------------------------------------------------------------
    # Discovery
    # ------------------------------------------------------------------
    def _iter_source_files(self) -> list[Path]:
        base = Path(self.settings.kb_dir)
        if not base.exists():
            return []
        files: list[Path] = []
        for path in sorted(base.rglob("*")):
            if not path.is_file():
                continue
            if path.suffix.lower() not in SUPPORTED_SUFFIXES:
                continue
            if any(part.startswith(".") for part in path.relative_to(base).parts):
                continue
            files.append(path)
        return files

    def _record_for(self, path: Path) -> DocumentRecord:
        base = Path(self.settings.kb_dir)
        relative = str(path.relative_to(base)).replace("\\", "/")
        stat = path.stat()
        extraction: Extraction = extract_text(path)

        # Front-matter is metadata; keep it out of the searchable body.
        body, frontmatter = strip_frontmatter(extraction.text)
        if not body.strip() and frontmatter:
            body = extraction.text

        category, matched = classify_document(relative, body)
        content = body
        truncated = len(content) > MAX_STORED_CONTENT_CHARS

        frontmatter_tags = frontmatter.get("tags")
        tags = derive_tags(relative, content, category)
        if isinstance(frontmatter_tags, list):
            for tag in frontmatter_tags:
                text_tag = str(tag).strip()
                if text_tag and text_tag not in tags:
                    tags.append(text_tag)

        if not extraction.ok and not content.strip():
            status = "failed"
        elif content.strip():
            status = "indexed"
        else:
            status = "uploaded"

        return DocumentRecord(
            id=make_document_id(relative),
            name=path.name,
            title=path.stem,
            suffix=path.suffix.lower(),
            type_label=type_label(path.suffix),
            relative_path=relative,
            absolute_path=str(path),
            size_bytes=stat.st_size,
            modified_at=datetime.fromtimestamp(stat.st_mtime),
            created_at=datetime.fromtimestamp(getattr(stat, "st_ctime", stat.st_mtime)),
            status=status,
            category=category,
            tags=derive_tags(relative, content, category),
            searchable=status == "indexed",
            char_count=len(content),
            content=content[:MAX_STORED_CONTENT_CHARS],
            content_truncated=truncated,
            summary=build_summary(content),
            outline=extract_outline(content),
            extraction_note=extraction.note,
            warnings=list(extraction.warnings),
            error=extraction.error,
            matched_keywords=matched,
            frontmatter=frontmatter,
        )

    # ------------------------------------------------------------------
    # Build
    # ------------------------------------------------------------------
    def build(self, *, force_vectors: bool = False, use_cache: bool = True) -> BuildReport:
        """(Re)build documents, chunks, BM25 statistics and vectors."""
        with self._lock:
            started = time.perf_counter()
            report = BuildReport(built_at=datetime.now())

            if use_cache and not force_vectors and self.try_load_from_cache():
                report.document_count = len(self.documents)
                report.chunk_count = len(self.chunks)
                report.vectorized_chunk_count = len(self._vectorised_ids)
                report.keyword_index_ready = len(self.chunks) > 0
                report.vector_index_ready = bool(self._vectorised_ids)
                report.failed_count = sum(
                    1 for doc in self.documents.values() if doc.status == "failed"
                )
                report.from_cache = True
                report.duration_ms = round((time.perf_counter() - started) * 1000, 2)
                report.note = "索引未变化，复用本地缓存。"
                self.last_build = report
                self._stale = False
                logger.info(
                    "Index loaded from cache: %d documents, %d chunks",
                    report.document_count,
                    report.chunk_count,
                )
                return report

            # -- scan + extract -----------------------------------------
            documents: dict[str, DocumentRecord] = {}
            for path in self._iter_source_files():
                try:
                    record = self._record_for(path)
                except Exception as exc:  # pragma: no cover - defensive
                    logger.warning("Failed to index %s: %s", path, exc)
                    report.warnings.append(f"{path.name} 索引失败：{exc}")
                    continue
                documents[record.id] = record
                if record.status == "failed":
                    report.failed_count += 1
                    report.warnings.append(f"{record.name}：{record.error}")

            # -- chunk ---------------------------------------------------
            chunks: list[Chunk] = []
            for record in documents.values():
                if not record.searchable:
                    continue
                chunks.extend(
                    split_text(
                        record.content,
                        document_id=record.id,
                        document_name=record.name,
                        source_path=record.relative_path,
                        chunk_size=self.settings.chunk_size,
                        chunk_overlap=self.settings.chunk_overlap,
                    )
                )

            self.documents = documents
            self.chunks = chunks
            self.chunk_map = {chunk.chunk_id: chunk for chunk in chunks}
            self._chunk_positions = {chunk.chunk_id: position for position, chunk in enumerate(chunks)}

            # -- keyword statistics --------------------------------------
            # Field-weighted: file name + section path + body.
            self.bm25 = BM25().fit([searchable_text(chunk) for chunk in chunks])
            report.keyword_index_ready = bool(chunks)

            # -- vectors -------------------------------------------------
            self._build_vectors(force=force_vectors or True)
            report.vectorized_chunk_count = len(self._vectorised_ids)
            report.vector_index_ready = bool(self._vectorised_ids)

            report.document_count = len(documents)
            report.chunk_count = len(chunks)
            report.duration_ms = round((time.perf_counter() - started) * 1000, 2)
            report.note = (
                f"已索引 {report.document_count} 个文档 / {report.chunk_count} 个知识块"
                f"（向量化 {report.vectorized_chunk_count} 块）。"
            )

            self.last_build = report
            self._stale = False
            self._persist_cache()
            logger.info(
                "Index rebuilt in %.0fms: %d documents, %d chunks, %d vectors",
                report.duration_ms,
                report.document_count,
                report.chunk_count,
                report.vectorized_chunk_count,
            )
            return report

    def _build_vectors(self, *, force: bool = False) -> None:
        """Fit the embedder and upsert all chunk vectors."""
        if self.embedder is None or self.vector_store is None or not self.chunks:
            self._vectorised_ids = set()
            return

        texts = [searchable_text(chunk) for chunk in self.chunks]
        ids = [chunk.chunk_id for chunk in self.chunks]

        if force:
            self.vector_store.clear()
            self._vectorised_ids = set()

        if self.embedder.requires_fit:
            # Corpus statistics must come from the full corpus, not one batch.
            self.embedder.fit(texts)

        try:
            vectors = self.embedder.embed_documents(texts)
        except Exception as exc:
            logger.warning("Vector build failed (%s); keyword retrieval remains available.", exc)
            self._vectorised_ids = set()
            return

        if vectors.shape[0] != len(ids):
            logger.warning("Embedder returned %d vectors for %d chunks", vectors.shape[0], len(ids))
            return

        self.vector_store.upsert(ids, vectors)
        self._vectorised_ids = set(ids)

    def ensure_built(self) -> BuildReport:
        """Build on first use; returns the cached report afterwards."""
        with self._lock:
            if self.last_build is None or self._stale:
                return self.build()
            return self.last_build

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------
    def _persist_cache(self) -> None:
        directory = Path(self.settings.index_dir)
        try:
            directory.mkdir(parents=True, exist_ok=True)
            payload = {
                "schema_version": INDEX_SCHEMA_VERSION,
                "built_at": datetime.now().isoformat(),
                "chunk_size": self.settings.chunk_size,
                "chunk_overlap": self.settings.chunk_overlap,
                "embedding_provider": self.settings.embedding_provider,
                "embedding_dim": self.settings.embedding_dim,
                "documents": [
                    {
                        "id": doc.id,
                        "name": doc.name,
                        "title": doc.title,
                        "suffix": doc.suffix,
                        "type_label": doc.type_label,
                        "relative_path": doc.relative_path,
                        "absolute_path": doc.absolute_path,
                        "size_bytes": doc.size_bytes,
                        "modified_at": doc.modified_at.isoformat() if doc.modified_at else None,
                        "created_at": doc.created_at.isoformat() if doc.created_at else None,
                        "status": doc.status,
                        "category": doc.category,
                        "tags": doc.tags,
                        "searchable": doc.searchable,
                        "char_count": doc.char_count,
                        "summary": doc.summary,
                        "outline": doc.outline,
                        "extraction_note": doc.extraction_note,
                        "warnings": doc.warnings,
                        "error": doc.error,
                        "matched_keywords": doc.matched_keywords,
                        "content_truncated": doc.content_truncated,
                        "fingerprint": doc.fingerprint(),
                    }
                    for doc in self.documents.values()
                ],
                "chunks": [
                    {
                        "chunk_id": chunk.chunk_id,
                        "document_id": chunk.document_id,
                        "document_name": chunk.document_name,
                        "index": chunk.index,
                        "content": chunk.content,
                        "section": chunk.section,
                        "source_path": chunk.source_path,
                        "char_count": chunk.char_count,
                        "start_offset": chunk.start_offset,
                    }
                    for chunk in self.chunks
                ],
            }
            (directory / INDEX_META_FILE).write_text(
                json.dumps(payload, ensure_ascii=False), encoding="utf-8"
            )
            if self.vector_store is not None:
                self.vector_store.persist(directory)
        except Exception as exc:  # pragma: no cover - cache is best-effort
            logger.warning("Could not persist index cache: %s", exc)

    def try_load_from_cache(self) -> bool:
        """Restore the index when nothing on disk has changed."""
        directory = Path(self.settings.index_dir)
        meta_path = directory / INDEX_META_FILE
        if not meta_path.exists():
            return False

        try:
            payload = json.loads(meta_path.read_text(encoding="utf-8"))
        except Exception as exc:  # pragma: no cover - corrupt cache
            logger.warning("Index cache unreadable: %s", exc)
            return False

        if payload.get("schema_version") != INDEX_SCHEMA_VERSION:
            return False
        if payload.get("chunk_size") != self.settings.chunk_size:
            return False
        if payload.get("chunk_overlap") != self.settings.chunk_overlap:
            return False
        if payload.get("embedding_provider") != self.settings.embedding_provider:
            return False
        if payload.get("embedding_dim") != self.settings.embedding_dim:
            return False

        cached_docs = payload.get("documents") or []
        source_files = self._iter_source_files()
        if len(cached_docs) != len(source_files):
            return False

        by_relative = {doc.get("relative_path"): doc for doc in cached_docs}
        for path in source_files:
            base = Path(self.settings.kb_dir)
            relative = str(path.relative_to(base)).replace("\\", "/")
            cached = by_relative.get(relative)
            if not cached:
                return False
            stat = path.stat()
            stamp = datetime.fromtimestamp(stat.st_mtime)
            fingerprint = f"{stat.st_size}:{stamp.timestamp():.0f}"
            if cached.get("fingerprint") != fingerprint:
                return False

        # -- restore -------------------------------------------------
        documents: dict[str, DocumentRecord] = {}
        for item in cached_docs:
            record = DocumentRecord(
                id=str(item["id"]),
                name=str(item["name"]),
                title=str(item.get("title") or ""),
                suffix=str(item.get("suffix") or ""),
                type_label=str(item.get("type_label") or ""),
                relative_path=str(item["relative_path"]),
                absolute_path=str(item.get("absolute_path") or ""),
                size_bytes=int(item.get("size_bytes") or 0),
                modified_at=_parse_dt(item.get("modified_at")),
                created_at=_parse_dt(item.get("created_at")),
                status=str(item.get("status") or "uploaded"),
                category=str(item.get("category") or "other"),
                tags=list(item.get("tags") or []),
                searchable=bool(item.get("searchable")),
                char_count=int(item.get("char_count") or 0),
                content="",
                content_truncated=bool(item.get("content_truncated")),
                summary=str(item.get("summary") or ""),
                outline=list(item.get("outline") or []),
                extraction_note=str(item.get("extraction_note") or ""),
                warnings=list(item.get("warnings") or []),
                error=str(item.get("error") or ""),
                matched_keywords=list(item.get("matched_keywords") or []),
            )
            # Chunk content still lives in the cache, so documents can be
            # previewed without re-reading every file.
            documents[record.id] = record

        chunks = [
            Chunk(
                chunk_id=str(item["chunk_id"]),
                document_id=str(item["document_id"]),
                document_name=str(item["document_name"]),
                index=int(item["index"]),
                content=str(item["content"]),
                section=str(item.get("section") or ""),
                source_path=str(item.get("source_path") or ""),
                char_count=int(item.get("char_count") or 0),
                start_offset=int(item.get("start_offset") or 0),
            )
            for item in (payload.get("chunks") or [])
        ]

        if not chunks and source_files:
            return False

        # Documents are lazily re-read for full text on demand.
        for chunk in chunks:
            record = documents.get(chunk.document_id)
            if record is not None and not record.content:
                record.content = ""

        self.documents = documents
        self.chunks = chunks
        self.chunk_map = {chunk.chunk_id: chunk for chunk in chunks}
        self._chunk_positions = {chunk.chunk_id: position for position, chunk in enumerate(chunks)}

        self.bm25 = BM25().fit([searchable_text(chunk) for chunk in chunks])

        if self.embedder is not None and self.vector_store is not None:
            if self.embedder.requires_fit:
                self.embedder.fit([searchable_text(chunk) for chunk in chunks])
            restored = self.vector_store.load(directory)
            self._vectorised_ids = {chunk.chunk_id for chunk in chunks} if restored else set()
            if not restored:
                try:
                    vectors = self.embedder.embed_documents([searchable_text(chunk) for chunk in chunks])
                    self.vector_store.upsert([chunk.chunk_id for chunk in chunks], vectors)
                    self._vectorised_ids = {chunk.chunk_id for chunk in chunks}
                except Exception as exc:  # pragma: no cover
                    logger.warning("Vector rebuild after cache load failed: %s", exc)
        return True

    # ------------------------------------------------------------------
    # Read access
    # ------------------------------------------------------------------
    def document_ids(self) -> list[str]:
        return list(self.documents.keys())

    def get_document(self, document_id: str) -> DocumentRecord | None:
        return self.documents.get(document_id)

    def get_document_by_path(self, relative_path: str) -> DocumentRecord | None:
        normalized = str(relative_path).replace("\\", "/")
        for record in self.documents.values():
            if record.relative_path == normalized:
                return record
        return None

    def chunks_of(self, document_id: str) -> list[Chunk]:
        return [chunk for chunk in self.chunks if chunk.document_id == document_id]

    def get_chunk(self, chunk_id: str) -> Chunk | None:
        return self.chunk_map.get(chunk_id)

    def keyword_search(self, query: str, k: int = 8) -> list[tuple[Chunk, float, list[str]]]:
        """BM25 retrieval returning ``(chunk, score, matched_terms)``."""
        if not query.strip() or not self.chunks:
            return []
        hits = self.bm25.search(query, top_k=k)
        results: list[tuple[Chunk, float, list[str]]] = []
        for hit in hits:
            if 0 <= hit.index < len(self.chunks):
                results.append((self.chunks[hit.index], hit.score, hit.matched_terms))
        return results

    def vector_search(self, query: str, k: int = 8) -> list[tuple[Chunk, float]]:
        """Dense retrieval returning ``(chunk, cosine)``."""
        if (
            not query.strip()
            or self.embedder is None
            or self.vector_store is None
            or not self._vectorised_ids
        ):
            return []
        try:
            vector = self.embedder.embed_query(query)
        except Exception as exc:
            logger.warning("Query embedding failed (%s); skipping vector branch.", exc)
            return []

        results: list[tuple[Chunk, float]] = []
        for hit in self.vector_store.search(vector, k=k):
            chunk = self.chunk_map.get(hit.chunk_id)
            if chunk is not None:
                results.append((chunk, hit.score))
        return results

    def previews_for(self, document_id: str, *, limit: int = 5) -> list[dict]:
        """Lightweight chunk previews used by the Explorer."""
        return [
            {
                "chunk_id": chunk.chunk_id,
                "index": chunk.index,
                "section": chunk.section,
                "char_count": chunk.char_count,
                "preview": snippet(chunk.content, limit=180),
            }
            for chunk in self.chunks_of(document_id)[:limit]
        ]

    def load_document_content(self, document_id: str) -> str:
        """Read a document's full body, lazily and safely.

        Chunk content is authoritative for indexing, but the preview needs the
        original file so that PDF/DOCX are represented by their extracted text.
        """
        record = self.documents.get(document_id)
        if record is None:
            return ""
        if record.content:
            return record.content
        extraction = extract_text(record.absolute_path)
        record.content = extraction.text[:MAX_STORED_CONTENT_CHARS]
        record.content_truncated = len(extraction.text) > MAX_STORED_CONTENT_CHARS
        return record.content


def _parse_dt(value: object) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Process-wide singleton
# ---------------------------------------------------------------------------

_index_lock = threading.Lock()
_index_instance: KnowledgeIndex | None = None


def get_index(settings: Settings | None = None) -> KnowledgeIndex:
    """Return the shared index, building it on first access."""
    global _index_instance
    with _index_lock:
        if _index_instance is None:
            _index_instance = KnowledgeIndex(settings or get_settings())
            _index_instance.build()
        return _index_instance


def reset_index() -> None:
    """Drop the singleton (used after writes and by the test suite)."""
    global _index_instance
    with _index_lock:
        _index_instance = None
