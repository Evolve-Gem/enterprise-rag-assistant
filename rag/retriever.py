def _contains_cjk(text: str) -> bool:
    """Return True when text contains common Chinese characters."""
    return any("\u4e00" <= char <= "\u9fff" for char in text)


def _extract_keywords(query: str) -> list[str]:
    """Extract simple keywords from a user query."""
    query = query.strip()
    if not query:
        return []

    if any(char.isspace() for char in query):
        keywords = [word for word in query.split() if word]
    else:
        # For Chinese questions without spaces, keep the full query and add
        # short character n-grams so phrases like "教育行业" and "场景" can match.
        keywords = [query]
        if _contains_cjk(query):
            cleaned = "".join(
                char for char in query if char.isalnum() or "\u4e00" <= char <= "\u9fff"
            )
            for stop_word in ["哪些", "什么", "如何", "怎么", "是否", "可以", "适合"]:
                cleaned = cleaned.replace(stop_word, "")

            for size in range(2, min(4, len(cleaned)) + 1):
                for start in range(0, len(cleaned) - size + 1):
                    keywords.append(cleaned[start : start + size])

    unique_keywords: list[str] = []
    for keyword in keywords:
        if keyword and keyword not in unique_keywords:
            unique_keywords.append(keyword)

    return unique_keywords


def keyword_retrieve(query: str, chunks: list[dict], top_k: int = 3) -> list[dict]:
    """Retrieve relevant chunks with simple keyword scoring."""
    query = query.strip()
    if not query or not chunks:
        return []

    keywords = _extract_keywords(query)
    results: list[dict] = []

    for chunk in chunks:
        content = str(chunk.get("content") or "")
        source_title = str(chunk.get("source_title") or "")
        score = 0

        if query in content:
            score += 3

        for keyword in keywords:
            if keyword in content:
                score += 1
            if keyword in source_title:
                score += 1

        if score > 0:
            result = chunk.copy()
            result["score"] = score
            result["matched_query"] = query
            results.append(result)

    results.sort(key=lambda item: item["score"], reverse=True)
    return results[:top_k]


def retrieve_relevant_chunks(query: str, top_k: int = 5) -> list[dict]:
    """Retrieve the most relevant knowledge chunks for a user query.

    The real retrieval logic will be implemented in a later stage.
    """
    # TODO: Query vector store and return ranked chunks with metadata.
    return []
