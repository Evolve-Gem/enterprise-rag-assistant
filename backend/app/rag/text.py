"""CJK-aware tokenisation helpers shared by BM25 and the hashing embedder.

Chinese text has no whitespace boundaries, so whitespace tokenisation is
useless here.  This module implements the segmenter-free approach that works
well for retrieval:

* CJK runs are indexed as **character bigrams**.  Bigrams approximate word
  boundaries closely enough for scoring, and -- unlike unigrams -- they do not
  let function characters such as 在 / 的 / 了 dominate the ranking.  A document
  that merely *mentions* 问题 ten times must not outrank one that actually
  defines Rerank.
* Latin runs are indexed as lowercase words.
* A curated stop-word list is applied to **both** the corpus and the query, so
  the vocabulary stays consistent (a BM25 requirement).

The stop lists are intentionally conservative: they remove grammatical
particles and generic interrogatives, never domain nouns.  上下文, 召回 and
问题 all survive on purpose.
"""

from __future__ import annotations

import re
import unicodedata

# Full-width forms, punctuation variants and whitespace are normalised so that
# "ＡＩ" and "AI", or "RAG，" and "RAG", compare equal.
_PUNCT = re.compile(r"[\s\u3000]+")
_LATIN_WORD = re.compile(r"[a-z0-9]+(?:[._+-][a-z0-9]+)*")
_CJK_RUN = re.compile(r"[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+")
_LATIN_RUN = re.compile(r"[a-z0-9._+-]+")

CJK_MIN = 0x3400
CJK_MAX = 0x9FFF

# Characters that carry little retrieval signal on their own.  A bigram is
# dropped when either of its characters appears here, which also removes
# meaningless fragments such as 里解 (from "里解决") and 么问 (from "什么问题").
CJK_STOP_CHARS: frozenset[str] = frozenset(
    "的了在是有与及或也都就而但则于之其此该这那你我他她它们些里吗呢吧啊呀哦嗯"
    "很最更太再又还只把被让使从向给着得地什么哪谁怎请吗"
)

# Multi-character function words / generic interrogatives.
CJK_STOPWORDS: frozenset[str] = frozenset(
    {
        "什么", "怎么", "怎样", "如何", "哪些", "哪个", "哪里", "为何", "是否",
        "可以", "能否", "一个", "这个", "那个", "这些", "那些", "我们", "你们",
        "他们", "以及", "因为", "所以", "但是", "如果", "那么", "就是", "还是",
        "或者", "并且", "而且", "不过", "只是", "主要", "一般", "通常", "进行",
        "通过", "关于", "对于", "基于", "用来", "用于", "容易", "可能", "需要",
        "hello", "please",
    }
)

LATIN_STOPWORDS: frozenset[str] = frozenset(
    {
        "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
        "of", "to", "in", "on", "at", "for", "and", "or", "but", "not", "no",
        "what", "which", "who", "whom", "how", "why", "when", "where",
        "do", "does", "did", "can", "could", "should", "would", "will",
        "i", "you", "he", "she", "it", "we", "they", "me", "my", "your",
        "this", "that", "these", "those", "with", "as", "by", "from", "its",
        "their", "our", "if", "then", "than", "so", "yes", "please", "tell",
        "about", "into", "out", "up", "down", "over", "under", "any", "some",
    }
)


def is_cjk(char: str) -> bool:
    """Whether a character belongs to a CJK block we want n-grammed."""
    code = ord(char)
    return (
        CJK_MIN <= code <= CJK_MAX
        or 0xF900 <= code <= 0xFAFF
        or 0x3040 <= code <= 0x30FF
    )


def normalize(text: str) -> str:
    """NFKC-normalise, lowercase and collapse whitespace."""
    if not text:
        return ""
    folded = unicodedata.normalize("NFKC", text).lower()
    return _PUNCT.sub(" ", folded).strip()


def _cjk_tokens(run: str) -> list[str]:
    """Tokenise one CJK run into stop-word-filtered bigrams."""
    length = len(run)
    if length == 0:
        return []
    if length == 1:
        # A single character is the only signal available; keep it unless it is
        # a pure function character.
        return [] if run in CJK_STOP_CHARS else [run]

    tokens: list[str] = []
    for start in range(length - 1):
        bigram = run[start : start + 2]
        if bigram in CJK_STOPWORDS:
            continue
        if any(char in CJK_STOP_CHARS for char in bigram):
            continue
        tokens.append(bigram)
    return tokens


def tokenize(text: str, *, keep_stopwords: bool = False) -> list[str]:
    """Tokenise mixed Chinese/English text into a flat token list.

    ``keep_stopwords=True`` is used by highlighting code that wants the raw
    surface form; retrieval always uses the filtered default.
    """
    normalized = normalize(text)
    if not normalized:
        return []

    tokens: list[str] = []
    for run in _CJK_RUN.findall(normalized):
        tokens.extend(_cjk_tokens(run))

    for word in _LATIN_WORD.findall(normalized):
        if len(word) < 2:
            continue
        if not keep_stopwords and word in LATIN_STOPWORDS:
            continue
        tokens.append(word)

    if keep_stopwords:
        for run in _CJK_RUN.findall(normalized):
            if len(run) == 1:
                tokens.append(run)

    return tokens


def char_ngrams(text: str, n: int = 3) -> list[str]:
    """Character n-grams over the normalised text (used by the hashing embedder)."""
    normalized = normalize(text).replace(" ", "")
    if len(normalized) < n:
        return [normalized] if normalized else []
    return [normalized[i : i + n] for i in range(len(normalized) - n + 1)]


def extract_query_terms(query: str, limit: int = 24) -> list[str]:
    """Return salient display terms for a query.

    These are the same tokens BM25 scores on, ordered so that longer / rarer
    signals (Latin words, then CJK bigrams) come first.  They drive both the
    reranker's coverage component and the UI highlighting, so they must be real
    matchable substrings -- never synthetic 4-grams like ``里解决什``.
    """
    normalized = normalize(query)
    latin = [
        word
        for word in _LATIN_WORD.findall(normalized)
        if len(word) >= 2 and word not in LATIN_STOPWORDS
    ]

    cjk: list[str] = []
    for run in _CJK_RUN.findall(normalized):
        cjk.extend(_cjk_tokens(run))

    terms: list[str] = []
    seen: set[str] = set()
    for term in [*latin, *cjk]:
        if term and term not in seen:
            seen.add(term)
            terms.append(term)
        if len(terms) >= limit:
            break
    return terms


def snippet(text: str, query: str = "", limit: int = 240) -> str:
    """Build a short snippet, centred on the first query term when possible."""
    clean = re.sub(r"\s+", " ", text or "").strip()
    if not clean:
        return ""
    if len(clean) <= limit:
        return clean

    focus = -1
    for term in extract_query_terms(query, limit=8) if query else []:
        position = clean.find(term)
        if position >= 0:
            focus = position
            break

    if focus < 0:
        return clean[:limit].rstrip() + "…"

    half = limit // 2
    start = max(0, focus - half)
    end = min(len(clean), start + limit)
    start = max(0, end - limit)
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(clean) else ""
    return f"{prefix}{clean[start:end].strip()}{suffix}"
