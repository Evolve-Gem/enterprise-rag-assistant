"""A small, dependency-light BM25 (Okapi) implementation.

Why not ``rank_bm25``?  The corpus here is a few hundred chunks, so the whole
scoring matrix is cheap to compute in NumPy, and keeping the implementation
local lets us return *which query terms matched*, which the UI uses for
highlighting and which the evaluator uses for keyword coverage.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .text import tokenize


@dataclass
class BM25Result:
    """One scored document."""

    index: int
    score: float
    matched_terms: list[str] = field(default_factory=list)


class BM25:
    """Okapi BM25 over a fixed corpus.

    Parameters
    ----------
    k1:
        Term-frequency saturation.  1.5 is the usual default.
    b:
        Length-normalisation strength.  0.75 is the usual default.
    """

    def __init__(self, k1: float = 1.5, b: float = 0.75) -> None:
        self.k1 = k1
        self.b = b
        self.corpus_size = 0
        self.avgdl = 0.0
        self.doc_freqs: list[dict[str, int]] = []
        self.doc_len: np.ndarray = np.zeros(0, dtype=np.float64)
        self.idf: dict[str, float] = {}
        self._token_sets: list[set[str]] = []

    # ------------------------------------------------------------------
    def fit(self, corpus: list[str] | list[list[str]]) -> "BM25":
        """Index the corpus.  Accepts raw strings or pre-tokenised documents."""
        tokenised: list[list[str]] = []
        for item in corpus:
            tokenised.append(
                tokenize(item) if isinstance(item, str) else list(item)
            )

        self.corpus_size = len(tokenised)
        self.doc_freqs = []
        self._token_sets = []
        lengths = np.zeros(self.corpus_size, dtype=np.float64)
        document_frequency: dict[str, int] = {}

        for position, tokens in enumerate(tokenised):
            frequencies: dict[str, int] = {}
            for token in tokens:
                frequencies[token] = frequencies.get(token, 0) + 1
            self.doc_freqs.append(frequencies)
            self._token_sets.append(set(frequencies))
            lengths[position] = len(tokens)
            for token in frequencies:
                document_frequency[token] = document_frequency.get(token, 0) + 1

        self.doc_len = lengths
        self.avgdl = float(lengths.mean()) if self.corpus_size else 0.0

        # BM25 idf with the +1 stabiliser so that very common terms do not go
        # negative (a known issue with the textbook formula on small corpora).
        n = max(self.corpus_size, 1)
        self.idf = {
            token: float(np.log(1.0 + (n - df + 0.5) / (df + 0.5)))
            for token, df in document_frequency.items()
        }
        return self

    # ------------------------------------------------------------------
    def scores(self, query_tokens: list[str]) -> np.ndarray:
        """Return a BM25 score for every document in the corpus."""
        result = np.zeros(self.corpus_size, dtype=np.float64)
        if self.corpus_size == 0 or not query_tokens:
            return result

        avgdl = self.avgdl or 1.0
        for token in set(query_tokens):
            idf = self.idf.get(token)
            if not idf:
                continue
            for position, frequencies in enumerate(self.doc_freqs):
                tf = frequencies.get(token)
                if not tf:
                    continue
                denominator = tf + self.k1 * (1.0 - self.b + self.b * self.doc_len[position] / avgdl)
                result[position] += idf * (tf * (self.k1 + 1.0)) / denominator
        return result

    # ------------------------------------------------------------------
    def search(
        self,
        query: str,
        top_k: int = 8,
        *,
        min_score: float = 0.0,
    ) -> list[BM25Result]:
        """Score and rank the corpus for ``query``."""
        if self.corpus_size == 0:
            return []

        query_tokens = tokenize(query)
        if not query_tokens:
            return []

        raw = self.scores(query_tokens)
        if raw.max(initial=0.0) <= min_score:
            return []

        order = np.argsort(-raw)[: max(top_k, 1)]
        unique_query_tokens = set(query_tokens)
        results: list[BM25Result] = []

        for position in order:
            score = float(raw[position])
            if score <= min_score:
                continue
            matched = sorted(unique_query_tokens & self._token_sets[position])
            results.append(BM25Result(index=int(position), score=score, matched_terms=matched))

        return results

    # ------------------------------------------------------------------
    def term_idf(self, token: str) -> float:
        """IDF of a token, or the maximum IDF when the token is unseen.

        An unseen query token is highly informative *by definition* (it cannot
        be common, or it would be in the corpus), so it must not be silently
        down-weighted to zero.
        """
        known = self.idf.get(token)
        if known is not None:
            return known
        return self.max_idf

    @property
    def max_idf(self) -> float:
        """IDF a token would have if it appeared in exactly one document."""
        n = max(self.corpus_size, 1)
        return float(np.log(1.0 + (n - 1 + 0.5) / 1.5))

    def term_idfs(self, tokens: list[str]) -> list[float]:
        """IDF for each token, preserving order."""
        return [self.term_idf(token) for token in tokens]

    # ------------------------------------------------------------------
    def matched_terms(self, doc_index: int, query: str) -> list[str]:
        """Query terms present in a specific document."""
        if doc_index < 0 or doc_index >= len(self._token_sets):
            return []
        return sorted(set(tokenize(query)) & self._token_sets[doc_index])
