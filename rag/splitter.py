def split_documents(
    documents: list[dict],
    chunk_size: int = 500,
    chunk_overlap: int = 100,
) -> list[dict]:
    """Split loaded Markdown documents into fixed-size text chunks."""
    if chunk_overlap >= chunk_size:
        raise ValueError("chunk_overlap must be smaller than chunk_size.")
    if chunk_size <= 0:
        raise ValueError("chunk_size must be greater than 0.")
    if chunk_overlap < 0:
        raise ValueError("chunk_overlap must be greater than or equal to 0.")

    chunks: list[dict] = []
    step = chunk_size - chunk_overlap

    for document in documents:
        content = document.get("content") or ""
        if not content.strip():
            continue

        source_title = str(document.get("title") or "untitled")
        source_path = str(document.get("path") or "")
        chunk_index = 1

        for start in range(0, len(content), step):
            chunk_content = content[start : start + chunk_size]
            if not chunk_content.strip():
                continue

            chunks.append(
                {
                    "chunk_id": f"{source_title}_{chunk_index}",
                    "source_title": source_title,
                    "source_path": source_path,
                    "content": chunk_content,
                    "char_count": len(chunk_content),
                    "chunk_index": chunk_index,
                }
            )
            chunk_index += 1

            # Stop after the final partial chunk has been created.
            if start + chunk_size >= len(content):
                break

    return chunks
