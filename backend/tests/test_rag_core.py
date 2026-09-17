"""Unit tests for the RAG core: tokenisation, chunking, retrieval, rerank, citations."""

from __future__ import annotations

import numpy as np
import pytest

from app.rag.bm25 import BM25
from app.rag.citations import (
    analyse_grounding,
    build_citations,
    build_sources,
    format_context,
    strip_invalid_citations,
)
from app.rag.embedder import HashingTfidfEmbedder, create_embedder
from app.rag.prompts import get_prompt_library
from app.rag.reranker import HeuristicReranker, NoopReranker
from app.rag.retriever import create_retriever
from app.rag.splitter import make_document_id, split_text
from app.rag.taxonomy import build_summary, classify_document, extract_outline
from app.rag.text import extract_query_terms, tokenize
from app.rag.vector_store import NumpyVectorStore
from app.schemas.rag import RetrievedChunk


# --------------------------------------------------------------- tokenisation


def test_tokenizer_keeps_latin_words_and_cjk_bigrams():
    tokens = tokenize("RAG 的召回 Top K 与 Rerank 有什么关系？")
    assert "rerank" in tokens
    assert "召回" in tokens
    assert "rag" in tokens


@pytest.mark.parametrize("noise", ["的", "在", "是", "与", "什么", "怎么", "如何"])
def test_tokenizer_drops_function_words(noise):
    """Function words must not survive: they were dominating BM25 scores."""
    tokens = tokenize(f"Rerank {noise} 召回")
    assert noise not in tokens


def test_tokenizer_single_character_query_survives():
    assert tokenize("熵") == ["熵"]


def test_extract_query_terms_has_no_synthetic_ngrams():
    terms = extract_query_terms("Rerank 在 RAG 里解决什么问题？")
    assert "rerank" in terms
    assert "rag" in terms
    # Synthetic 4-grams such as 里解决什 are what broke the reranker's coverage
    # component. CJK terms must be real bigrams (<= 2 chars); Latin words are
    # unrestricted.
    cjk_terms = [term for term in terms if all("\u4e00" <= char <= "\u9fff" for char in term)]
    assert cjk_terms
    assert all(len(term) <= 2 for term in cjk_terms), cjk_terms
    assert "里解决什" not in terms


# -------------------------------------------------------------------- splitter


def test_split_text_respects_size_and_overlap():
    body = "\n\n".join(f"第{i}段内容。" * 6 for i in range(20))
    chunks = split_text(body, document_id="d1", document_name="a.md", chunk_size=300, chunk_overlap=60)
    assert len(chunks) > 3
    assert all(chunk.char_count <= 320 for chunk in chunks)
    assert [chunk.index for chunk in chunks] == list(range(1, len(chunks) + 1))


def test_split_text_keeps_section_path():
    body = "# 标题\n\n引言内容足够长以便形成一个知识块。" * 1 + "\n\n## 二级标题\n\n" + "正文内容。" * 40
    chunks = split_text(body, document_id="d1", document_name="a.md", chunk_size=200, chunk_overlap=40)
    assert any("标题" in chunk.section for chunk in chunks)


def test_split_text_hard_splits_long_paragraph():
    body = "甲" * 1500  # one paragraph, no boundaries at all
    chunks = split_text(body, document_id="d1", document_name="a.md", chunk_size=300, chunk_overlap=50)
    assert len(chunks) >= 5
    assert all(chunk.char_count <= 300 for chunk in chunks)


def test_split_text_rejects_invalid_overlap():
    with pytest.raises(ValueError):
        split_text("abc", document_id="d", document_name="n", chunk_size=100, chunk_overlap=100)


def test_make_document_id_is_stable_and_url_safe():
    first = make_document_id("知识库/检索链路.md")
    second = make_document_id("知识库/检索链路.md")
    assert first == second
    assert all(char.isalnum() or char in "-_" for char in first)
    assert make_document_id("a.md") != make_document_id("b.md")


def test_chunk_ids_are_prefixed_with_the_document_id():
    chunks = split_text("内容" * 200, document_id="doc-1", document_name="a.md", chunk_size=200)
    assert chunks
    assert all(chunk.chunk_id.startswith("doc-1::") for chunk in chunks)
    assert chunks[0].chunk_id == "doc-1::c001"


# ----------------------------------------------------------------------- BM25


def test_bm25_ranks_the_relevant_document_first():
    corpus = [
        "Rerank 是对候选结果重新评分的步骤",
        "今天天气不错",
        "Top K 决定返回多少候选",
    ]
    hits = BM25().fit(corpus).search("Rerank 是什么", top_k=3)
    assert hits
    assert hits[0].index == 0
    assert hits[0].score > 0


def test_bm25_idf_uses_max_for_unseen_terms():
    bm25 = BM25().fit(["a b c", "d e f"])
    assert bm25.term_idf("zzz-unseen") == pytest.approx(bm25.max_idf)
    assert bm25.term_idf("a") > 0


def test_bm25_empty_query_returns_nothing():
    assert BM25().fit(["a", "b"]).search("", top_k=3) == []


# ------------------------------------------------------------------ embedder


def test_hashing_embedder_is_deterministic_and_normalised():
    embedder = HashingTfidfEmbedder(dim=128)
    corpus = ["Rerank 是重排序", "Top K 是召回数量", "关键词检索与向量检索"]
    embedder.fit(corpus)
    first = embedder.embed_documents(corpus)
    second = embedder.embed_documents(corpus)
    np.testing.assert_allclose(first, second, rtol=0, atol=1e-6)
    norms = np.linalg.norm(first, axis=1)
    np.testing.assert_allclose(norms, np.ones(len(corpus)), atol=1e-5)
    assert first.dtype == np.float32


def test_hashing_embedder_empty_input():
    embedder = HashingTfidfEmbedder(dim=64)
    embedder.fit(["a"])
    assert embedder.embed_documents([]).shape == (0, 64)


def test_embedder_factory_falls_back_without_key(settings):
    embedder = create_embedder(settings)
    assert embedder is not None
    assert embedder.provider == "hashing"


# -------------------------------------------------------------- vector store


def test_numpy_vector_store_upsert_search_remove():
    store = NumpyVectorStore(dim=4)
    vectors = np.asarray([[1, 0, 0, 0], [0, 1, 0, 0], [0.9, 0.1, 0, 0]], dtype=np.float32)
    store.upsert(["a", "b", "c"], vectors)
    assert len(store) == 3

    hits = store.search(np.asarray([1, 0, 0, 0], dtype=np.float32), k=2)
    assert [hit.chunk_id for hit in hits] == ["a", "c"]

    store.remove(["a"])
    assert len(store) == 2
    assert [hit.chunk_id for hit in store.search(np.asarray([1, 0, 0, 0], dtype=np.float32), k=2)][0] == "c"


def test_numpy_vector_store_upsert_replaces_in_place():
    store = NumpyVectorStore(dim=2)
    store.upsert(["a"], np.asarray([[1, 0]], dtype=np.float32))
    store.upsert(["a"], np.asarray([[0, 1]], dtype=np.float32))
    assert len(store) == 1
    hits = store.search(np.asarray([0, 1], dtype=np.float32), k=1)
    assert hits[0].score == pytest.approx(1.0)


# ---------------------------------------------------------------- retrievers


@pytest.mark.parametrize("mode", ["keyword", "vector", "hybrid"])
def test_retriever_finds_rerank_document(index, settings, mode):
    retriever = create_retriever(index, settings, mode)
    outcome = retriever.retrieve("Rerank 在检索链路里解决什么问题？", k=5)
    assert outcome.chunks, f"{mode} returned no candidates"
    assert outcome.chunks[0].document_name == "检索链路.md"


def test_hybrid_fuses_both_branches(index, settings):
    retriever = create_retriever(index, settings, "hybrid")
    outcome = retriever.retrieve("Rerank 与向量检索的关系", k=6)
    assert outcome.stats.mode == "hybrid"
    assert outcome.stats.fusion_strategy == "rrf"
    assert outcome.stats.keyword_hits > 0
    assert outcome.stats.vector_hits > 0


def test_keyword_retriever_scores_are_normalised(index, settings):
    outcome = create_retriever(index, settings, "keyword").retrieve("Rerank", k=5)
    assert outcome.chunks
    assert all(0 < chunk.fused_score <= 1.0 for chunk in outcome.chunks)


def test_retriever_handles_empty_query(index, settings):
    outcome = create_retriever(index, settings, "hybrid").retrieve("   ", k=5)
    assert outcome.chunks == []


# ------------------------------------------------------------------ reranker


def _chunk(chunk_id: str, content: str, *, fused: float = 0.5) -> RetrievedChunk:
    return RetrievedChunk(
        chunk_id=chunk_id,
        document_id="doc",
        document_name="doc.md",
        content=content,
        char_count=len(content),
        fused_score=fused,
    )


def test_heuristic_reranker_prefers_idf_weighted_terms():
    """The rare term must beat generic words that merely appear often.

    The fused scores are deliberately close together, which is what a real
    candidate list looks like: min-max normalisation only amplifies differences
    when the spread is small, so a two-item list with a huge gap would be an
    unfair test of the lexical component.
    """
    idf = {"rerank": 3.0, "rag": 0.2, "问题": 0.3, "解决": 0.4}
    reranker = HeuristicReranker(target_chars=200, idf_provider=lambda term: idf.get(term, 0.5))

    candidates = [
        _chunk("generic", "RAG 解决了什么问题？问题很多，问题很多。" * 2, fused=0.90),
        _chunk("specific", "Rerank 是对候选结果重新评分的步骤。", fused=0.88),
        _chunk("unrelated", "今天天气不错，适合出门散步。", fused=0.50),
    ]
    ranked = reranker.rerank("Rerank 在 RAG 里解决什么问题", candidates, top_k=3)
    assert ranked[0].chunk_id == "specific"
    assert ranked[0].rerank_score is not None
    assert ranked[-1].chunk_id == "unrelated"


def test_noop_reranker_keeps_order():
    candidates = [_chunk("a", "x", fused=0.9), _chunk("b", "y", fused=0.1)]
    ranked = NoopReranker().rerank("q", candidates, top_k=2)
    assert [item.chunk_id for item in ranked] == ["a", "b"]


def test_reranker_sets_final_rank():
    reranker = HeuristicReranker(target_chars=100)
    ranked = reranker.rerank("检索", [_chunk("a", "检索内容" * 5), _chunk("b", "无关")], top_k=2)
    assert [item.rank_final for item in ranked] == [1, 2]


# ---------------------------------------------------------------- citations


def test_format_context_numbers_blocks():
    context = format_context([_chunk("a", "甲"), _chunk("b", "乙")])
    assert "[1] 文档：doc.md" in context
    assert "[2] 文档：doc.md" in context


def test_build_citations_and_sources():
    chunks = [_chunk("a", "甲"), _chunk("b", "乙"), _chunk("c", "丙")]
    citations = build_citations(chunks)
    assert [item.index for item in citations] == [1, 2, 3]
    sources = build_sources(citations)
    assert len(sources) == 1
    assert sources[0].chunk_count == 3
    assert sources[0].citation_indexes == [1, 2, 3]


def test_grounding_detects_valid_invalid_and_uncited():
    report = analyse_grounding("依据 [1] 与 [3] 以及 [9]", citation_count=3)
    assert report.cited_indexes == [1, 3]
    assert report.invalid_indexes == [9]
    assert report.uncited_indexes == [2]
    assert report.has_citation is True
    assert 0 < report.citation_precision < 1


def test_grounding_detects_refusal():
    report = analyse_grounding("根据当前知识库资料无法确定。", citation_count=2)
    assert report.is_refusal is True
    assert report.has_citation is False


def test_strip_invalid_citations_removes_out_of_range_markers():
    assert strip_invalid_citations("结论 [1] 与 [7]", citation_count=2) == "结论 [1] 与 "
    assert strip_invalid_citations("无编号", citation_count=0) == "无编号"


# ------------------------------------------------------------------- prompts


def test_prompt_library_loads_versioned_templates():
    library = get_prompt_library()
    names = library.names()
    for expected in ("rag_answer", "solution_generation", "requirement_analysis", "kb_gap_analysis"):
        assert expected in names

    template = library.get("rag_answer")
    assert template.version == "v1"
    assert "{{question}}" in template.user
    assert "{{context}}" in template.user


def test_prompt_render_substitutes_placeholders():
    system, user = get_prompt_library().render(
        "rag_answer",
        question="测试问题",
        context="[1] 资料",
        context_count=1,
        history="（无）",
    )
    assert "测试问题" in user
    assert "{{question}}" not in user
    assert system  # system prompt is non-empty


def test_prompt_missing_template_raises():
    from app.rag.prompts import PromptNotFoundError

    with pytest.raises(PromptNotFoundError):
        get_prompt_library().get("does_not_exist")


# ------------------------------------------------------------------ taxonomy


def test_classify_document_by_filename():
    category, matched = classify_document("FAQ.md", "# 常见问题\n\n内容")
    assert category == "faq"
    assert matched


def test_classify_document_by_body_when_name_is_neutral():
    category, _ = classify_document("notes.md", "## 行业解决方案\n\n面向院校的最佳实践")
    assert category == "industry_solution"


def test_classify_unknown_document_is_other():
    category, matched = classify_document("x.md", "随便写点东西")
    assert category == "other"
    assert matched == []


def test_build_summary_skips_headings_and_code():
    summary = build_summary("# 标题\n\n> 引用\n\n```\ncode\n```\n\n这是正文第一段，足够长可以入选。")
    assert "这是正文第一段" in summary
    assert "# 标题" not in summary


def test_extract_outline_reads_headings():
    outline = extract_outline("# 一\n\n正文\n\n## 二\n\n### 三\n")
    assert outline == ["一", "二", "三"]
