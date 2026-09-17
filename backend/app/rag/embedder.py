"""Embedding providers.

Three implementations, all behind one interface so the retriever never cares
which one is active:

``HashingTfidfEmbedder``
    Default, offline, deterministic, no API key.  It projects hashed
    character-n-gram / token TF-IDF features into a fixed-dimension dense vector
    and L2-normalises it.  **This is a lexical vector space, not a neural
    embedding** -- cosine similarity in this space approximates term overlap
    with sub-word smoothing.  It is the honest fallback when no embedding
    provider is configured, and it is what makes hybrid retrieval demonstrable
    without a paid key.

``OpenAICompatibleEmbedder``
    Any endpoint that speaks ``POST /embeddings`` (OpenAI, DashScope, Jina,
    Voyage, a local TEI/vLLM server, ...).  Selected purely via environment
    variables so no vendor is hard-coded.

``provider="none"``
    No vectors at all; the retriever degrades to keyword-only BM25.
"""

from __future__ import annotations

import hashlib
from abc import ABC, abstractmethod
from dataclasses import dataclass

import numpy as np

from ..core.config import Settings, get_settings
from ..core.errors import UpstreamError, ProviderNotConfiguredError
from ..core.logging import get_logger
from .text import char_ngrams, tokenize

logger = get_logger("app.rag.embedder")


class Embedder(ABC):
    """Interface every embedding backend implements."""

    provider: str = "abstract"
    model_name: str = "abstract"
    dim: int = 0
    requires_fit: bool = False

    @abstractmethod
    def embed_documents(self, texts: list[str]) -> np.ndarray:
        """Return an ``(n, dim)`` float32 matrix of L2-normalised vectors."""

    def embed_query(self, text: str) -> np.ndarray:
        """Return a single ``(dim,)`` vector."""
        return self.embed_documents([text])[0]

    def fit(self, corpus: list[str]) -> None:  # noqa: D401 - optional hook
        """Optional corpus statistics (no-op by default)."""

    @property
    def description(self) -> str:
        return f"{self.provider}:{self.model_name}(dim={self.dim})"


# ---------------------------------------------------------------------------
# Offline, deterministic hashing embedder
# ---------------------------------------------------------------------------


@dataclass
class _HashingState:
    dim: int
    idf: dict[str, float]


class HashingTfidfEmbedder(Embedder):
    """Hashed TF-IDF projection over tokens + character n-grams.

    Signed feature hashing keeps the projection unbiased: two features that
    collide into the same bucket cancel as often as they reinforce, which keeps
    the cosine ranking stable without needing a persisted vocabulary.
    """

    provider = "hashing"
    model_name = "hashed-char-ngram-tfidf"
    requires_fit = True

    def __init__(self, dim: int = 512, *, ngram_size: int = 3) -> None:
        self.dim = max(int(dim), 32)
        self.ngram_size = ngram_size
        self._state = _HashingState(dim=self.dim, idf={})

    # -- feature extraction -------------------------------------------
    def _features(self, text: str) -> list[str]:
        tokens = tokenize(text)
        grams = char_ngrams(text, n=self.ngram_size)
        return tokens + grams

    def _bucket(self, feature: str) -> tuple[int, float]:
        digest = hashlib.blake2b(feature.encode("utf-8"), digest_size=8).digest()
        value = int.from_bytes(digest, "big")
        bucket = value % self.dim
        sign = 1.0 if (value >> 63) & 1 == 0 else -1.0
        return bucket, sign

    # -- API -----------------------------------------------------------
    def fit(self, corpus: list[str]) -> None:
        """Compute smoothed IDF weights from the indexed corpus."""
        document_frequency: dict[str, int] = {}
        for text in corpus:
            for feature in set(self._features(text)):
                document_frequency[feature] = document_frequency.get(feature, 0) + 1

        n = max(len(corpus), 1)
        # Smoothed IDF, clamped to stay positive for very frequent features.
        idf = {
            feature: float(np.log((1.0 + n) / (1.0 + df)) + 1.0)
            for feature, df in document_frequency.items()
        }
        self._state = _HashingState(dim=self.dim, idf=idf)
        logger.debug("Hashing embedder fitted: %d features, dim=%d", len(idf), self.dim)

    def _transform_one(self, text: str) -> np.ndarray:
        vector = np.zeros(self.dim, dtype=np.float32)
        features = self._features(text)
        if not features:
            return vector

        counts: dict[str, int] = {}
        for feature in features:
            counts[feature] = counts.get(feature, 0) + 1

        idf = self._state.idf
        default_idf = 1.0
        length = float(len(features))
        for feature, count in counts.items():
            weight = (count / length) * idf.get(feature, default_idf)
            bucket, sign = self._bucket(feature)
            vector[bucket] += sign * weight

        norm = float(np.linalg.norm(vector))
        if norm > 0:
            vector /= norm
        return vector

    def embed_documents(self, texts: list[str]) -> np.ndarray:
        if not texts:
            return np.zeros((0, self.dim), dtype=np.float32)
        return np.vstack([self._transform_one(text) for text in texts]).astype(np.float32)


# ---------------------------------------------------------------------------
# Hosted / self-hosted OpenAI-compatible embeddings
# ---------------------------------------------------------------------------


class OpenAICompatibleEmbedder(Embedder):
    """Embeddings via any OpenAI-compatible ``/embeddings`` endpoint."""

    provider = "openai"
    requires_fit = False

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str,
        model: str,
        dim: int,
        timeout: float = 30.0,
        batch_size: int = 64,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url
        self.model_name = model
        self.dim = dim
        self.timeout = timeout
        self.batch_size = batch_size
        self._resolved_dim: int | None = None

    def _client(self):
        try:
            from openai import OpenAI
        except ImportError as exc:  # pragma: no cover
            raise ProviderNotConfiguredError(
                "缺少 openai 依赖，无法调用 Embedding 服务。"
            ) from exc
        return OpenAI(api_key=self.api_key, base_url=self.base_url, timeout=self.timeout)

    def embed_documents(self, texts: list[str]) -> np.ndarray:
        if not texts:
            return np.zeros((0, self.dim), dtype=np.float32)

        client = self._client()
        vectors: list[list[float]] = []
        for start in range(0, len(texts), self.batch_size):
            batch = texts[start : start + self.batch_size]
            try:
                response = client.embeddings.create(model=self.model_name, input=batch)
            except Exception as exc:
                logger.warning("Embedding call failed: %s", exc)
                raise UpstreamError("Embedding 服务调用失败，请稍后重试。") from exc
            vectors.extend(item.embedding for item in response.data)

        matrix = np.asarray(vectors, dtype=np.float32)
        if matrix.ndim != 2 or matrix.shape[0] != len(texts):
            raise UpstreamError("Embedding 服务返回了非预期的数据结构。")

        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        matrix = matrix / norms
        self._resolved_dim = int(matrix.shape[1])
        self.dim = self._resolved_dim
        return matrix


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------


def create_embedder(settings: Settings | None = None) -> Embedder | None:
    """Build the embedder described by the environment.  ``None`` = no vectors."""
    settings = settings or get_settings()
    provider = settings.embedding_provider

    if provider in {"none", "off", "disabled"}:
        return None

    if provider == "openai":
        if not (settings.embedding_api_key and settings.embedding_base_url):
            logger.warning(
                "EMBEDDING_PROVIDER=openai but key/base_url missing -> falling back to hashing."
            )
            return HashingTfidfEmbedder(dim=settings.embedding_dim)
        return OpenAICompatibleEmbedder(
            api_key=settings.embedding_api_key,
            base_url=settings.embedding_base_url,
            model=settings.embedding_model,
            dim=settings.embedding_dim,
            timeout=settings.embedding_timeout_seconds,
        )

    if provider != "hashing":
        logger.warning("Unknown EMBEDDING_PROVIDER=%r -> using hashing.", provider)

    return HashingTfidfEmbedder(dim=settings.embedding_dim)
