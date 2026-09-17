"""Reranking layer.

Retrieval maximises recall; reranking maximises the precision of what actually
reaches the prompt.  The pipeline is therefore always:

``retrieve → fuse → rerank → top-k context``

Two rerankers ship:

``HeuristicReranker`` (default)
    A deterministic lexical cross-scorer.  It combines query-term coverage,
    phrase occurrence, section/title match and a length prior, then blends the
    result with the fused retrieval score.  Fast, free, and -- importantly for a
    portfolio project -- *explainable*: every component is reported back.

``LLMReranker`` (opt-in, ``RERANK_PROVIDER=llm``)
    Asks the configured chat model to score each candidate 0-10 for relevance.
    Slower and costs tokens, but it is a real cross-encoder-style signal and it
    reuses the same provider already configured for generation.
"""

from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod

from ..core.config import Settings, get_settings
from ..core.logging import get_logger
from ..schemas.rag import RetrievedChunk
from .text import extract_query_terms, normalize

logger = get_logger("app.rag.reranker")

# Blend weight between the reranker's own judgement and the fused retrieval
# score.  Kept below 1.0 so reranking can reorder but not completely override
# strong first-stage evidence.
RERANK_BLEND = 0.6

_JSON_ARRAY = re.compile(r"\[.*\]", re.DOTALL)


class Reranker(ABC):
    """Interface for candidate rescoring."""

    provider: str = "abstract"

    @abstractmethod
    def rerank(
        self,
        query: str,
        candidates: list[RetrievedChunk],
        top_k: int,
    ) -> list[RetrievedChunk]:
        """Return at most ``top_k`` candidates, best first."""


class NoopReranker(Reranker):
    """Keeps the fused ordering (``RERANK_PROVIDER=off``)."""

    provider = "off"

    def rerank(
        self,
        query: str,
        candidates: list[RetrievedChunk],
        top_k: int,
    ) -> list[RetrievedChunk]:
        selected = candidates[: max(top_k, 1)]
        for rank, item in enumerate(selected, start=1):
            item.rerank_score = item.fused_score
            item.rank_final = rank
        return selected


class HeuristicReranker(Reranker):
    """Deterministic lexical cross-scorer.

    Components (all in ``[0, 1]`` before weighting):

    ``coverage``
        fraction of the query's salient terms that appear in the chunk
    ``phrase``
        1.0 when the query's leading phrase appears verbatim, scaled down for
        partial phrases
    ``heading``
        whether the query terms appear in the chunk's section path or the
        document name -- a cheap proxy for topical relevance
    ``density``
        matched-character density, which favours focused chunks over long
        documents that merely mention a term once
    ``length_prior``
        prefers chunks close to the target chunk size; very short fragments are
        usually headings or table stubs
    """

    provider = "heuristic"

    def __init__(self, *, target_chars: int = 500, idf_provider=None) -> None:
        self.target_chars = target_chars
        # ``idf_provider(token) -> float`` gives the coverage component its
        # weighting.  Without it, every query term counts equally, which lets a
        # document that incidentally repeats generic words (RAG, 问题, 解决)
        # outrank the document that actually defines the rare term being asked
        # about.  IDF weighting is the standard fix.
        self.idf_provider = idf_provider

    # ------------------------------------------------------------------
    def _term_weights(self, terms: list[str]) -> list[float]:
        """Min-max normalised IDF weight per query term.

        The least informative query term is weighted 0, the most informative 1.
        When no IDF source is available the weights are uniform, which degrades
        this reranker to plain term coverage.
        """
        if not terms:
            return []
        if self.idf_provider is None:
            return [1.0] * len(terms)

        raw = [max(float(self.idf_provider(term)), 0.0) for term in terms]
        low, high = min(raw), max(raw)
        span = high - low
        if span <= 1e-9:
            return [1.0] * len(terms)
        return [(value - low) / span for value in raw]

    def _score(self, query: str, terms: list[str], item: RetrievedChunk) -> tuple[float, dict[str, float]]:
        haystack = normalize(item.content)
        heading = normalize(f"{item.document_name} {item.section}")

        weights = self._term_weights(terms)
        total_weight = sum(weights)
        if terms and total_weight > 0:
            matched_weight = sum(w for term, w in zip(terms, weights) if term in haystack)
            coverage = matched_weight / total_weight
        else:
            coverage = 0.0
        hits = [term for term in terms if term in haystack]

        phrase = 0.0
        core = " ".join(normalize(query).split())
        if core:
            if core in haystack:
                phrase = 1.0
            else:
                # Longest prefix of the query that appears verbatim.
                words = core.split()
                for size in range(len(words), 0, -1):
                    if " ".join(words[:size]) in haystack:
                        phrase = 0.35 * (size / len(words))
                        break

        heading_hit = (len([t for t in terms if t in heading]) / len(terms)) if terms else 0.0

        matched_chars = sum(len(term) for term in hits)
        density = min(matched_chars / max(len(item.content), 1) * 8.0, 1.0)

        length = item.char_count or len(item.content)
        if length <= 0:
            length_prior = 0.0
        elif length < self.target_chars * 0.4:
            length_prior = 0.6 * (length / (self.target_chars * 0.4))
        elif length > self.target_chars * 3:
            length_prior = 0.75
        else:
            length_prior = 1.0

        raw = (
            0.50 * coverage
            + 0.20 * phrase
            + 0.15 * heading_hit
            + 0.10 * density
            + 0.05 * length_prior
        )
        components = {
            "coverage": round(coverage, 4),
            "phrase": round(phrase, 4),
            "heading": round(heading_hit, 4),
            "density": round(density, 4),
            "length_prior": round(length_prior, 4),
        }
        return raw, components

    # ------------------------------------------------------------------
    def rerank(
        self,
        query: str,
        candidates: list[RetrievedChunk],
        top_k: int,
    ) -> list[RetrievedChunk]:
        if not candidates:
            return []

        terms = extract_query_terms(query, limit=20)
        fused_scores = [item.fused_score for item in candidates] or [0.0]
        low, high = min(fused_scores), max(fused_scores)
        span = (high - low) or 1.0

        scored: list[tuple[float, RetrievedChunk]] = []
        for item in candidates:
            lexical, components = self._score(query, terms, item)
            normalized_fused = (item.fused_score - low) / span
            combined = RERANK_BLEND * lexical + (1.0 - RERANK_BLEND) * normalized_fused
            item.rerank_score = round(combined, 6)
            item.matched_terms = sorted(set(item.matched_terms) | {t for t in terms if t in normalize(item.content)})
            scored.append((combined, item))

        scored.sort(key=lambda pair: (-pair[0], -(pair[1].fused_score)))
        selected = [item for _, item in scored[: max(top_k, 1)]]
        for rank, item in enumerate(selected, start=1):
            item.rank_final = rank
        return selected


class LLMReranker(Reranker):
    """Model-based reranking through the configured chat provider."""

    provider = "llm"

    def __init__(self, settings: Settings | None = None, *, max_candidates: int = 12) -> None:
        self.settings = settings or get_settings()
        self.max_candidates = max_candidates

    def _prompt(self, query: str, candidates: list[RetrievedChunk]) -> str:
        blocks = []
        for position, item in enumerate(candidates, start=1):
            body = item.content[:600].replace("\n", " ")
            blocks.append(f"[{position}] 文档：{item.document_name}｜章节：{item.section or '-'}\n{body}")
        joined = "\n\n".join(blocks)
        return (
            "你是检索重排序器。请判断每个候选片段与用户问题的相关性。\n"
            "只输出一个 JSON 数组，元素形如 {\"index\": 1, \"score\": 8}，"
            "score 为 0-10 的整数，10 表示直接回答了问题。不要输出任何其他文字。\n\n"
            f"用户问题：{query}\n\n候选片段：\n{joined}"
        )

    def rerank(
        self,
        query: str,
        candidates: list[RetrievedChunk],
        top_k: int,
    ) -> list[RetrievedChunk]:
        if not candidates:
            return []

        shortlist = candidates[: self.max_candidates]
        try:
            from .llm import get_llm_client

            client = get_llm_client(self.settings)
            completion = client.complete(
                system="你是严谨的检索重排序器，只输出 JSON。",
                user=self._prompt(query, shortlist),
                temperature=0.0,
                max_tokens=600,
            )
            scores = self._parse(completion.text, len(shortlist))
        except Exception as exc:
            logger.warning("LLM rerank failed (%s) -> falling back to heuristic.", exc)
            return HeuristicReranker().rerank(query, candidates, top_k)

        if not scores:
            logger.warning("LLM rerank returned no usable scores -> heuristic fallback.")
            return HeuristicReranker().rerank(query, candidates, top_k)

        fused_scores = [item.fused_score for item in candidates] or [0.0]
        low, high = min(fused_scores), max(fused_scores)
        span = (high - low) or 1.0

        scored: list[tuple[float, RetrievedChunk]] = []
        for position, item in enumerate(shortlist):
            model_score = scores.get(position + 1, 0.0) / 10.0
            normalized_fused = (item.fused_score - low) / span
            combined = RERANK_BLEND * model_score + (1.0 - RERANK_BLEND) * normalized_fused
            item.rerank_score = round(combined, 6)
            scored.append((combined, item))

        # Candidates beyond ``max_candidates`` keep their fused order behind the
        # rescored shortlist rather than being dropped outright.
        for item in candidates[self.max_candidates :]:
            item.rerank_score = item.fused_score * (1.0 - RERANK_BLEND)
            scored.append((item.rerank_score, item))

        scored.sort(key=lambda pair: -pair[0])
        selected = [item for _, item in scored[: max(top_k, 1)]]
        for rank, item in enumerate(selected, start=1):
            item.rank_final = rank
        return selected

    @staticmethod
    def _parse(raw: str, expected: int) -> dict[int, float]:
        match = _JSON_ARRAY.search(raw or "")
        if not match:
            return {}
        try:
            payload = json.loads(match.group(0))
        except json.JSONDecodeError:
            return {}
        scores: dict[int, float] = {}
        for item in payload if isinstance(payload, list) else []:
            if not isinstance(item, dict):
                continue
            try:
                index = int(item.get("index"))
                score = float(item.get("score"))
            except (TypeError, ValueError):
                continue
            if 1 <= index <= expected:
                scores[index] = max(0.0, min(score, 10.0))
        return scores


def create_reranker(settings: Settings | None = None, *, idf_provider=None) -> Reranker:
    """Build the configured reranker."""
    settings = settings or get_settings()
    provider = (settings.rerank_provider or "heuristic").lower()
    if provider == "off":
        return NoopReranker()
    if provider == "llm":
        if not settings.llm_configured:
            logger.warning("RERANK_PROVIDER=llm but no LLM key -> heuristic reranker.")
            return HeuristicReranker(target_chars=settings.chunk_size, idf_provider=idf_provider)
        return LLMReranker(settings)
    return HeuristicReranker(target_chars=settings.chunk_size, idf_provider=idf_provider)
