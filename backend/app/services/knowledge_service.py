"""Knowledge-base application service.

This is the only layer allowed to mutate the knowledge directory.  It owns the
index lifecycle (build / rebuild / invalidate) and translates index records
into the API schemas, so routers stay thin and the security rules
(read-only mode, path containment, upload validation) are enforced in one
place.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from ..core.config import Settings, get_settings
from ..core.errors import InvalidRequestError, NotFoundError
from ..core.logging import get_logger
from ..core.security import assert_writable, resolve_within, unique_target_path, validate_upload
from ..rag.index import KnowledgeIndex, get_index, reset_index
from ..rag.splitter import make_document_id
from ..rag.taxonomy import category_label
from ..schemas.knowledge import (
    ChunkListResponse,
    ChunkSummary,
    DocumentDetail,
    DocumentListResponse,
    DocumentSummary,
    KnowledgeStats,
    ReindexResult,
    UploadResult,
)

logger = get_logger("app.services.knowledge")

_STATUS_LABELS = {
    "uploaded": "已上传",
    "parsing": "解析中",
    "indexed": "已索引",
    "failed": "解析失败",
    "unsupported": "不支持",
}


def human_size(size_bytes: int) -> str:
    """Format a byte count for display."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    if size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    return f"{size_bytes / 1024 / 1024:.1f} MB"


class KnowledgeService:
    """Read/write operations over the knowledge base."""

    def __init__(self, settings: Settings | None = None, index: KnowledgeIndex | None = None) -> None:
        self.settings = settings or get_settings()
        self._index = index

    # ------------------------------------------------------------------
    @property
    def index(self) -> KnowledgeIndex:
        if self._index is None:
            self._index = get_index(self.settings)
        return self._index

    def refresh(self, *, force_vectors: bool = False) -> ReindexResult:
        """Rebuild the whole index from disk.

        Guarded by the read-only lock: rebuilding writes the index cache, and the
        demo lock is documented as closing every write path. Leaving it open made
        the code contradict the README.
        """
        assert_writable(self.settings)
        self.index.build(force_vectors=force_vectors, use_cache=False)
        report = self.index.last_build
        return ReindexResult(
            document_count=report.document_count if report else 0,
            chunk_count=report.chunk_count if report else 0,
            vectorized_chunk_count=report.vectorized_chunk_count if report else 0,
            duration_ms=report.duration_ms if report else 0.0,
            index_state=report.index_state if report else "empty",
            note=report.note if report else "",
        )

    def invalidate(self) -> None:
        """Drop the cached index so the next read rebuilds it."""
        reset_index()
        self._index = None

    # ------------------------------------------------------------------
    # Serialisation
    # ------------------------------------------------------------------
    def _to_summary(self, record) -> DocumentSummary:
        return DocumentSummary(
            id=record.id,
            name=record.name,
            title=record.title,
            suffix=record.suffix,
            type_label=record.type_label,
            size_bytes=record.size_bytes,
            size_human=human_size(record.size_bytes),
            char_count=record.char_count,
            chunk_count=len(self.index.chunks_of(record.id)),
            status=record.status,  # type: ignore[arg-type]
            status_label=_STATUS_LABELS.get(record.status, record.status),
            category=record.category,  # type: ignore[arg-type]
            category_label=category_label(record.category),
            tags=record.tags,
            searchable=record.searchable,
            modified_at=record.modified_at,
            created_at=record.created_at,
        )

    def _to_chunk_summary(self, chunk) -> ChunkSummary:
        from ..rag.text import snippet

        return ChunkSummary(
            chunk_id=chunk.chunk_id,
            document_id=chunk.document_id,
            document_name=chunk.document_name,
            index=chunk.index,
            char_count=chunk.char_count,
            content=chunk.content,
            preview=snippet(chunk.content, limit=200),
            section=chunk.section,
            has_vector=chunk.chunk_id in getattr(self.index, "_vectorised_ids", set()),
        )

    # ------------------------------------------------------------------
    # Reads
    # ------------------------------------------------------------------
    def list_documents(
        self,
        *,
        query: str = "",
        category: str = "",
        status: str = "",
        sort: str = "name",
        offset: int = 0,
        limit: int = 100,
    ) -> DocumentListResponse:
        self.index.ensure_built()
        records = list(self.index.documents.values())

        needle = (query or "").strip().lower()
        if needle:
            records = [
                record
                for record in records
                if needle in record.name.lower()
                or needle in record.summary.lower()
                or any(needle in tag.lower() for tag in record.tags)
            ]
        if category:
            records = [record for record in records if record.category == category]
        if status:
            records = [record for record in records if record.status == status]

        if sort == "modified":
            records.sort(key=lambda item: item.modified_at or datetime.min, reverse=True)
        elif sort == "size":
            records.sort(key=lambda item: item.size_bytes, reverse=True)
        elif sort == "chunks":
            records.sort(key=lambda item: len(self.index.chunks_of(item.id)), reverse=True)
        else:
            records.sort(key=lambda item: item.name.lower())

        total = len(records)
        window = records[offset : offset + limit]
        return DocumentListResponse(
            items=[self._to_summary(record) for record in window],
            total=total,
            offset=offset,
            limit=limit,
        )

    def get_document(self, document_id: str) -> DocumentDetail:
        self.index.ensure_built()
        record = self.index.get_document(document_id)
        if record is None:
            raise NotFoundError(f"文档不存在：{document_id}")

        content = self.index.load_document_content(document_id)
        summary = self._to_summary(record)
        return DocumentDetail(
            **summary.model_dump(),
            content=content,
            content_truncated=record.content_truncated,
            summary=record.summary,
            outline=record.outline,
            chunks=[self._to_chunk_summary(chunk) for chunk in self.index.chunks_of(document_id)],
            extraction_note=record.extraction_note or record.error,
        )

    def get_chunks(self, document_id: str, *, limit: int = 500) -> ChunkListResponse:
        self.index.ensure_built()
        if self.index.get_document(document_id) is None:
            raise NotFoundError(f"文档不存在：{document_id}")
        chunks = self.index.chunks_of(document_id)
        return ChunkListResponse(
            document_id=document_id,
            items=[self._to_chunk_summary(chunk) for chunk in chunks[:limit]],
            total=len(chunks),
        )

    def get_chunk(self, chunk_id: str) -> ChunkSummary:
        self.index.ensure_built()
        chunk = self.index.get_chunk(chunk_id)
        if chunk is None:
            raise NotFoundError(f"知识块不存在：{chunk_id}")
        return self._to_chunk_summary(chunk)

    def stats(self) -> KnowledgeStats:
        self.index.ensure_built()
        records = list(self.index.documents.values())
        report = self.index.last_build

        type_breakdown: dict[str, int] = {}
        category_breakdown: dict[str, int] = {}
        for record in records:
            type_breakdown[record.type_label] = type_breakdown.get(record.type_label, 0) + 1
            label = category_label(record.category)
            category_breakdown[label] = category_breakdown.get(label, 0) + 1

        searchable = [record for record in records if record.searchable]
        return KnowledgeStats(
            document_count=len(records),
            indexed_document_count=len(searchable),
            chunk_count=len(self.index.chunks),
            total_chars=sum(record.char_count for record in records),
            total_bytes=sum(record.size_bytes for record in records),
            searchable_count=len(searchable),
            failed_count=sum(1 for record in records if record.status == "failed"),
            type_breakdown=type_breakdown,
            category_breakdown=category_breakdown,
            index_state=report.index_state if report else "empty",
            index_note=report.note if report else "",
            last_indexed_at=report.built_at if report else None,
            retriever_mode=self.settings.effective_retriever_mode,
            embedding_provider=self.settings.embedding_provider,
            vectorized_chunk_count=len(getattr(self.index, "_vectorised_ids", set())),
        )

    # ------------------------------------------------------------------
    # Writes
    # ------------------------------------------------------------------
    def save_upload(self, filename: str, data: bytes) -> UploadResult:
        """Validate and store an uploaded file, then reindex it."""
        assert_writable(self.settings)
        safe_name = validate_upload(filename, len(data), self.settings)
        target = unique_target_path(self.settings.kb_dir, safe_name)

        target.write_bytes(data)
        logger.info("Saved upload %s (%d bytes)", target.name, len(data))

        self.invalidate()
        result = self.refresh()

        document_id = make_document_id(_relative(target, self.settings.kb_dir))
        record = self.index.get_document(document_id)
        warnings: list[str] = []
        if record is None:
            raise InvalidRequestError("文件已保存，但未能加入索引，请重试重建索引。")
        if record.status == "failed":
            warnings.append(f"文件已保存但解析失败：{record.error}")
        if record.warnings:
            warnings.extend(record.warnings)

        return UploadResult(
            document=self._to_summary(record),
            chunks_created=len(self.index.chunks_of(document_id)),
            warnings=warnings + ([result.note] if result.note else []),
        )

    def update_document(self, document_id: str, content: str) -> DocumentDetail:
        assert_writable(self.settings)
        self.index.ensure_built()
        record = self.index.get_document(document_id)
        if record is None:
            raise NotFoundError(f"文档不存在：{document_id}")
        if record.suffix not in {".md", ".markdown", ".txt"}:
            raise InvalidRequestError("仅支持编辑 Markdown / 文本文件。")

        path = resolve_within(self.settings.kb_dir, record.absolute_path)
        path.write_text(content or "", encoding="utf-8")

        self.invalidate()
        self.refresh()
        return self.get_document(document_id)

    def delete_document(self, document_id: str) -> tuple[str, int]:
        """Delete a document; returns ``(name, chunks_removed)``."""
        assert_writable(self.settings)
        self.index.ensure_built()
        record = self.index.get_document(document_id)
        if record is None:
            raise NotFoundError(f"文档不存在：{document_id}")

        path = resolve_within(self.settings.kb_dir, record.absolute_path)
        chunks = len(self.index.chunks_of(document_id))
        path.unlink()
        logger.info("Deleted document %s", path.name)

        self.invalidate()
        self.refresh()
        return record.name, chunks


def _relative(path: Path, base: Path) -> str:
    try:
        return str(path.relative_to(base)).replace("\\", "/")
    except ValueError:
        return path.name


_service: KnowledgeService | None = None


def get_knowledge_service(settings: Settings | None = None) -> KnowledgeService:
    """Process-wide knowledge service."""
    global _service
    if _service is None:
        _service = KnowledgeService(settings or get_settings())
    return _service


def reset_knowledge_service() -> None:
    """Drop the singleton (tests)."""
    global _service
    _service = None
