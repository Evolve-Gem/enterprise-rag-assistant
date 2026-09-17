from datetime import datetime
import os
from pathlib import Path


SUPPORTED_EXTENSIONS = {".md", ".txt", ".pdf"}
EDITABLE_EXTENSIONS = {".md", ".txt"}


def is_demo_read_only() -> bool:
    """Return whether public-demo write operations must be disabled."""
    return os.getenv("DEMO_READ_ONLY", "false").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def _ensure_demo_writable() -> None:
    """Reject knowledge-base mutations while public-demo read-only mode is active."""
    if is_demo_read_only():
        raise PermissionError("当前为只读演示模式，知识库修改功能已关闭。")


def _resolve_kb_dir(kb_dir: str | Path) -> Path:
    """Resolve and create the knowledge base directory when needed."""
    base_dir = Path(kb_dir).resolve()
    if not base_dir.exists():
        if is_demo_read_only():
            raise FileNotFoundError("只读演示模式下未找到知识库目录。")
        base_dir.mkdir(parents=True, exist_ok=True)
    return base_dir


def _resolve_inside_kb(file_path: str | Path, kb_dir: str | Path) -> Path:
    """Resolve a file path and ensure it stays inside the knowledge base."""
    base_dir = _resolve_kb_dir(kb_dir)
    candidate = Path(file_path)
    if not candidate.is_absolute():
        candidate = base_dir / candidate
    resolved = candidate.resolve()

    if not resolved.is_relative_to(base_dir):
        raise ValueError("文件路径不在知识库目录内，已拒绝操作。")
    return resolved


def _human_size(size_bytes: int) -> str:
    """Format file size for display."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    if size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    return f"{size_bytes / 1024 / 1024:.1f} MB"


def get_file_info(file_path: str | Path) -> dict:
    """Return basic metadata for a knowledge base file."""
    path = Path(file_path).resolve()
    stat = path.stat()
    return {
        "name": path.name,
        "type": path.suffix.lower(),
        "path": str(path),
        "size": _human_size(stat.st_size),
        "size_bytes": stat.st_size,
        "modified_at": datetime.fromtimestamp(stat.st_mtime).strftime(
            "%Y-%m-%d %H:%M:%S"
        ),
    }


def list_documents(kb_dir: str | Path) -> list[dict]:
    """List supported documents in the knowledge base directory."""
    base_dir = _resolve_kb_dir(kb_dir)
    documents: list[dict] = []

    for file_path in sorted(base_dir.iterdir(), key=lambda item: item.name.lower()):
        if not file_path.is_file():
            continue
        if file_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        documents.append(get_file_info(file_path))

    return documents


def save_uploaded_file(uploaded_file, kb_dir: str | Path) -> dict:
    """Save an uploaded file into the knowledge base without overwriting files."""
    _ensure_demo_writable()
    if uploaded_file is None:
        raise ValueError("未选择上传文件。")

    original_name = Path(uploaded_file.name).name
    if not original_name:
        raise ValueError("上传文件名无效。")

    suffix = Path(original_name).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise ValueError("仅支持上传 .md、.txt、.pdf 文件。")

    base_dir = _resolve_kb_dir(kb_dir)
    target_path = _resolve_inside_kb(original_name, base_dir)
    if target_path.exists():
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        target_path = _resolve_inside_kb(
            f"{target_path.stem}_{timestamp}{target_path.suffix}",
            base_dir,
        )

    data = uploaded_file.getvalue()
    if not data:
        raise ValueError("上传文件为空，未保存。")

    target_path.write_bytes(data)
    return get_file_info(target_path)


def read_document(
    file_path: str | Path,
    kb_dir: str | Path = "knowledge_base",
    max_chars: int | None = None,
) -> str:
    """Read text documents; PDFs are acknowledged but not parsed in v1.1."""
    path = _resolve_inside_kb(file_path, kb_dir)
    if not path.exists():
        raise FileNotFoundError("文件不存在。")

    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return "PDF 已上传，当前版本暂不支持全文预览。"
    if suffix not in EDITABLE_EXTENSIONS:
        raise ValueError("当前文件类型暂不支持预览。")

    for encoding in ("utf-8", "utf-8-sig", "gb18030"):
        try:
            content = path.read_text(encoding=encoding)
            if max_chars is not None and max_chars >= 0:
                return content[:max_chars]
            return content
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError(
        "utf-8",
        b"",
        0,
        1,
        "文件编码无法识别，请转换为 UTF-8 后重试。",
    )


def update_document(
    file_path: str | Path,
    new_content: str,
    kb_dir: str | Path = "knowledge_base",
) -> dict:
    """Update an editable knowledge base document."""
    _ensure_demo_writable()
    path = _resolve_inside_kb(file_path, kb_dir)
    if not path.exists():
        raise FileNotFoundError("文件不存在。")
    if path.suffix.lower() not in EDITABLE_EXTENSIONS:
        raise ValueError("仅支持编辑 .md 和 .txt 文件。")

    path.write_text(new_content or "", encoding="utf-8")
    return get_file_info(path)


def delete_document(
    file_path: str | Path,
    kb_dir: str | Path = "knowledge_base",
) -> dict:
    """Delete a document inside the knowledge base directory."""
    _ensure_demo_writable()
    path = _resolve_inside_kb(file_path, kb_dir)
    if not path.exists():
        raise FileNotFoundError("文件不存在。")
    if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        raise ValueError("当前文件类型不允许删除。")

    info = get_file_info(path)
    path.unlink()
    return info


def rebuild_knowledge_base(kb_dir: str | Path) -> dict:
    """Re-read knowledge documents and rebuild runtime chunks."""
    from rag.loader import load_markdown_documents
    from rag.splitter import split_documents

    documents = load_markdown_documents(kb_dir)
    chunks = split_documents(documents)
    return {
        "documents": documents,
        "chunks": chunks,
        "document_count": len(documents),
        "chunk_count": len(chunks),
        "indexed_extensions": [".md", ".txt"],
        "note": "当前版本使用运行时关键词检索，重建索引会重新读取 .md/.txt 并切分 chunks。",
    }
