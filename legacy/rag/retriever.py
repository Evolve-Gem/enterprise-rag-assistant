from rag.vector_store import load_vector_store


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
    """Retrieve the most relevant knowledge chunks for a user query."""
    query = query.strip()
    if not query or top_k <= 0:
        return []

    vector_store = load_vector_store()
    if vector_store is None:
        return []

    if hasattr(vector_store, "similarity_search_with_score"):
        raw_results = vector_store.similarity_search_with_score(query, k=top_k)
    elif hasattr(vector_store, "similarity_search"):
        raw_results = vector_store.similarity_search(query, k=top_k)
    elif hasattr(vector_store, "query"):
        try:
            raw_results = vector_store.query(query, top_k=top_k)
        except TypeError:
            try:
                raw_results = vector_store.query(query, k=top_k)
            except TypeError:
                raw_results = vector_store.query(query_texts=[query], n_results=top_k)
    else:
        return []

    if isinstance(raw_results, dict):
        if "matches" in raw_results:
            raw_results = raw_results["matches"]
        else:
            documents = raw_results.get("documents") or []
            metadatas = raw_results.get("metadatas") or []
            scores = raw_results.get("scores") or raw_results.get("distances") or []
            ids = raw_results.get("ids") or []

            if documents and isinstance(documents[0], list):
                documents = documents[0]
            if metadatas and isinstance(metadatas[0], list):
                metadatas = metadatas[0]
            if scores and isinstance(scores[0], list):
                scores = scores[0]
            if ids and isinstance(ids[0], list):
                ids = ids[0]

            results: list[dict] = []
            for index, content in enumerate(documents[:top_k]):
                metadata = metadatas[index] if index < len(metadatas) else {}
                result = metadata.copy() if isinstance(metadata, dict) else {}
                result["content"] = content
                if index < len(ids):
                    result.setdefault("chunk_id", ids[index])
                if index < len(scores):
                    result["score"] = scores[index]
                result["matched_query"] = query
                results.append(result)
            return results

    results: list[dict] = []
    for index, raw_result in enumerate(raw_results[:top_k], start=1):
        score = None
        item = raw_result
        if isinstance(raw_result, tuple):
            item = raw_result[0]
            if len(raw_result) > 1:
                score = raw_result[1]

        if isinstance(item, dict):
            metadata = item.get("metadata")
            result = metadata.copy() if isinstance(metadata, dict) else {}
            for key, value in item.items():
                if key != "metadata":
                    result[key] = value
            content = (
                result.get("content")
                or result.get("page_content")
                or result.get("document")
                or result.get("text")
            )
            if content is not None:
                result["content"] = content
            if score is None:
                score = result.get("score")
        else:
            metadata = getattr(item, "metadata", None)
            result = metadata.copy() if isinstance(metadata, dict) else {}
            content = getattr(item, "page_content", None) or getattr(item, "content", None)
            if content is not None:
                result["content"] = content

        if score is not None:
            result["score"] = score
        result.setdefault("chunk_id", result.get("id") or f"result_{index}")
        result["matched_query"] = query
        results.append(result)

    return results
