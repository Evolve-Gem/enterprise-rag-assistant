from pathlib import Path


def load_markdown_documents(knowledge_base_dir: str | Path) -> list[dict]:
    """Load Markdown and text documents from the knowledge base directory."""
    base_dir = Path(knowledge_base_dir)
    if not base_dir.exists() or not base_dir.is_dir():
        return []

    documents: list[dict] = []
    supported_extensions = {".md", ".txt"}
    for file_path in sorted(base_dir.iterdir(), key=lambda item: item.name.lower()):
        if not file_path.is_file():
            continue
        if file_path.suffix.lower() not in supported_extensions:
            continue

        try:
            content = file_path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            # Skip unreadable files so one bad document does not break the app.
            continue

        documents.append(
            {
                "title": file_path.stem,
                "path": str(file_path),
                "content": content,
                "char_count": len(content),
            }
        )

    return documents
