"""Tests for the knowledge service and its security guard rails."""

from __future__ import annotations

import io
from pathlib import Path

import pytest

from app.core.config import get_settings, reload_settings
from app.core.errors import (
    FileTooLargeError,
    InvalidRequestError,
    NotFoundError,
    ReadOnlyError,
    UnsupportedFileError,
)
from app.core.security import resolve_within, sanitize_filename, validate_upload
from app.rag.splitter import make_document_id
from app.services.knowledge_service import KnowledgeService, get_knowledge_service


@pytest.fixture()
def service(sandbox) -> KnowledgeService:
    return KnowledgeService(get_settings())


# ------------------------------------------------------------------ reading


def test_list_documents_returns_every_sample(service):
    listing = service.list_documents(limit=50)
    assert listing.total == 5
    assert {item.name for item in listing.items} >= {"检索链路.md", "FAQ.md"}


def test_list_documents_filters_by_query_and_category(service):
    by_query = service.list_documents(query="FAQ", limit=10)
    assert by_query.total == 1
    assert by_query.items[0].name == "FAQ.md"

    by_category = service.list_documents(category="faq", limit=10)
    assert by_category.total >= 1


def test_list_documents_sorts(service):
    by_name = service.list_documents(sort="name", limit=10)
    names = [item.name.lower() for item in by_name.items]
    assert names == sorted(names)


def test_get_document_returns_content_outline_and_chunks(service):
    doc_id = make_document_id("检索链路.md")
    detail = service.get_document(doc_id)
    assert "Rerank" in detail.content
    assert detail.outline
    assert detail.chunks
    assert detail.searchable is True
    assert detail.chunk_count == len(detail.chunks)


def test_get_document_missing_raises_not_found(service):
    with pytest.raises(NotFoundError):
        service.get_document("nope")


def test_get_chunks_and_single_chunk(service):
    doc_id = make_document_id("检索链路.md")
    chunks = service.get_chunks(doc_id)
    assert chunks.total > 0
    single = service.get_chunk(chunks.items[0].chunk_id)
    assert single.chunk_id == chunks.items[0].chunk_id


def test_stats_reports_counts_and_categories(service):
    stats = service.stats()
    assert stats.document_count == 5
    assert stats.chunk_count > 0
    assert stats.vectorized_chunk_count > 0
    assert stats.total_chars > 0
    assert "faq" in stats.category_breakdown.values() or stats.category_breakdown


def test_stats_reports_failed_documents_for_unparsable_pdf(service, sandbox):
    """A PDF without a text layer must be reported as failed, not silently indexed."""
    broken = sandbox["kb_dir"] / "扫描件.pdf"
    broken.write_bytes(b"%PDF-1.4\n%not a real pdf\n")
    service.invalidate()
    service.refresh()

    stats = service.stats()
    assert stats.failed_count >= 1
    listing = service.list_documents(status="failed", limit=10)
    assert any(item.name == "扫描件.pdf" for item in listing.items)


def test_stats_reports_document_missing_but_listed(service, sandbox):
    (sandbox["kb_dir"] / "empty.md").write_text("   \n", encoding="utf-8")
    service.invalidate()
    service.refresh()
    doc = next(item for item in service.list_documents(limit=20).items if item.name == "empty.md")
    assert doc.status == "uploaded"
    assert doc.searchable is False


# ------------------------------------------------------------------ writing


def test_save_upload_creates_document_and_chunks(service):
    payload = "# 新文档\n\n这是一个新上传的测试文档，内容足够长以便被切成知识块。\n".encode()
    result = service.save_upload("新文档.md", payload)
    assert result.document.name == "新文档.md"
    assert result.chunks_created >= 1
    assert result.document.status == "indexed"


def test_save_upload_rejects_unsupported_suffix(service):
    with pytest.raises(UnsupportedFileError):
        service.save_upload("payload.exe", b"binary")


def test_save_upload_rejects_empty_file(service):
    with pytest.raises(InvalidRequestError):
        service.save_upload("empty.md", b"")


def test_save_upload_rejects_oversized_file(service, monkeypatch):
    monkeypatch.setenv("MAX_UPLOAD_BYTES", "128")
    reload_settings()
    oversized = KnowledgeService(get_settings())
    with pytest.raises(FileTooLargeError):
        oversized.save_upload("big.txt", b"x" * 1024)


def test_save_upload_deduplicates_filenames(service):
    body = "# 同名\n\n内容内容内容内容内容内容内容内容\n".encode()
    first = service.save_upload("同名.md", body)
    second = service.save_upload("同名.md", body)
    assert first.document.name != second.document.name


def test_update_document_persists_and_reindexes(service):
    doc_id = make_document_id("FAQ.md")
    updated = service.update_document(doc_id, "# FAQ\n\n## 新内容\n\n更新后的正文。\n")
    assert "更新后的正文" in updated.content
    stats = service.stats()
    assert stats.chunk_count > 0


def test_update_document_rejects_non_text_format(service, sandbox):
    (sandbox["kb_dir"] / "binary.pdf").write_bytes(b"%PDF-1.4\n")
    service.invalidate()
    service.refresh()
    doc_id = make_document_id("binary.pdf")
    with pytest.raises(InvalidRequestError):
        service.update_document(doc_id, "nope")


def test_delete_document_removes_file_and_chunks(service, sandbox):
    doc_id = make_document_id("成功案例.md")
    name, chunks = service.delete_document(doc_id)
    assert name == "成功案例.md"
    assert chunks > 0
    assert not (sandbox["kb_dir"] / "成功案例.md").exists()
    with pytest.raises(NotFoundError):
        service.get_document(doc_id)


def test_reindex_reports_counts(service):
    result = service.refresh()
    assert result.document_count == 5
    assert result.chunk_count > 0
    assert result.vectorized_chunk_count > 0
    assert result.duration_ms >= 0


# ------------------------------------------------------------- guard rails


def test_read_only_mode_blocks_every_write(sandbox, monkeypatch):
    monkeypatch.setenv("DEMO_READ_ONLY", "true")
    reload_settings()
    service = KnowledgeService(get_settings())

    with pytest.raises(ReadOnlyError):
        service.save_upload("a.md", b"# a\n\ncontent\n")
    with pytest.raises(ReadOnlyError):
        service.update_document(make_document_id("FAQ.md"), "x")
    with pytest.raises(ReadOnlyError):
        service.delete_document(make_document_id("FAQ.md"))
    # Rebuilding the index writes the cache; the README documents read-only as
    # closing every write path, so this must be guarded too.
    with pytest.raises(ReadOnlyError):
        service.refresh()


def test_read_only_mode_still_allows_reads(sandbox, monkeypatch):
    monkeypatch.setenv("DEMO_READ_ONLY", "true")
    reload_settings()
    service = KnowledgeService(get_settings())

    assert service.list_documents(limit=10).total == 5
    assert service.stats().chunk_count > 0
    assert service.get_chunks(make_document_id("检索链路.md")).total > 0


def test_sanitize_filename_strips_traversal_and_reserved_names():
    assert sanitize_filename("../../etc/passwd") == "passwd"
    assert sanitize_filename("..\\..\\windows\\system32\\cmd.txt") == "cmd.txt"
    assert sanitize_filename("CON.md").startswith("_")
    assert "/" not in sanitize_filename("a/b/c.md")
    assert sanitize_filename("正常文档.md") == "正常文档.md"


def test_sanitize_filename_rejects_empty():
    with pytest.raises(InvalidRequestError):
        sanitize_filename("")
    with pytest.raises(InvalidRequestError):
        sanitize_filename("..")


def test_resolve_within_blocks_escape(tmp_path):
    base = tmp_path / "kb"
    base.mkdir()
    (base / "ok.md").write_text("x")

    assert resolve_within(base, "ok.md").name == "ok.md"
    with pytest.raises(InvalidRequestError):
        resolve_within(base, "../outside.md")
    with pytest.raises(InvalidRequestError):
        resolve_within(base, str(tmp_path / "elsewhere.md"))


def test_validate_upload_checks_suffix_and_size():
    from app.core.config import get_settings as current_settings

    settings = current_settings()
    assert validate_upload("a.md", 100, settings) == "a.md"
    with pytest.raises(UnsupportedFileError):
        validate_upload("a.exe", 100, settings)
    with pytest.raises(FileTooLargeError):
        validate_upload("a.md", settings.max_upload_bytes + 1, settings)
    with pytest.raises(InvalidRequestError):
        validate_upload("a.md", 0, settings)


def test_upload_does_not_escape_the_knowledge_base(service, sandbox):
    """A crafted filename must land inside the KB directory."""
    result = service.save_upload("../../../escaped.md", b"# escaped\n\ncontent here\n")
    saved = sandbox["kb_dir"] / result.document.name
    assert saved.exists()
    assert saved.resolve().parent == sandbox["kb_dir"].resolve()
    assert not (sandbox["kb_dir"].parent / "escaped.md").exists()
