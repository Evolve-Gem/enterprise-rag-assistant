"""A tiny in-process rate limiter for the public demo.

Why this exists
---------------
The public demo is password-free and read-only, but the AI endpoints are not
free: every ``/api/chat``, ``/api/rag/query``, ``/api/agent/run`` and
``/api/solutions/*`` call spends a DeepSeek token budget.  A single visitor
holding down F5 can drain the quota for everyone else.

Scope of the protection
-----------------------
* Only the **expensive** endpoints are limited.  Static pages, ``/health``, the
  overview, the knowledge explorer and plain read endpoints stay unlimited so
  the demo never feels throttled while browsing.
* The throttle is **coarse on purpose**: per-IP, fixed window, in-process.  The
  deployment is a single ``uvicorn`` worker behind one Nginx, so a Redis-backed
  distributed limiter would be architecture theatre -- but the code is written
  so that swapping the store later only means replacing :class:`_WindowStore`.

Design notes
------------
* Sliding-window log rather than a fixed counter: a fixed window lets a client
  fire ``2 * limit`` requests around the boundary, which is exactly the pattern
  a quota-drainer would find.
* Memory is bounded: stale timestamps are pruned on every touch, and the number
  of tracked clients is capped so a spoofed-IP flood cannot grow the dict
  without limit.
* The client key comes from ``X-Forwarded-For`` **only** because the app sits
  behind Nginx that sets it.  The header is never trusted for authorization --
  it is a throttling hint, and a forged value at worst lets someone rate-limit
  a stranger, which is a nuisance, not a vulnerability.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

from .logging import get_logger

logger = get_logger("app.core.ratelimit")


@dataclass
class RateLimitDecision:
    """Outcome of a single limiter check."""

    allowed: bool
    limit: int
    remaining: int
    retry_after: int = 0
    window_seconds: int = 60

    def headers(self) -> dict[str, str]:
        """Standard-ish rate limit headers for the response."""
        headers = {
            "X-RateLimit-Limit": str(self.limit),
            "X-RateLimit-Remaining": str(max(self.remaining, 0)),
            "X-RateLimit-Window": str(self.window_seconds),
        }
        if not self.allowed:
            headers["Retry-After"] = str(max(self.retry_after, 1))
        return headers


@dataclass
class _ClientWindow:
    """Timestamps of recent requests for one client."""

    hits: list[float] = field(default_factory=list)


class SlidingWindowLimiter:
    """Per-client sliding-window request limiter.

    Parameters
    ----------
    limit:
        Maximum number of requests allowed inside ``window_seconds``.
    window_seconds:
        Length of the sliding window.
    max_clients:
        Upper bound on tracked clients.  When exceeded, the least recently seen
        entries are evicted so a flood of distinct keys cannot exhaust memory.
    """

    def __init__(
        self,
        limit: int = 10,
        window_seconds: int = 60,
        max_clients: int = 4096,
    ) -> None:
        self.limit = max(int(limit), 1)
        self.window_seconds = max(int(window_seconds), 1)
        self.max_clients = max(int(max_clients), 1)
        self._clients: dict[str, _ClientWindow] = {}

    # ------------------------------------------------------------------ api
    def check(self, key: str, *, now: float | None = None) -> RateLimitDecision:
        """Register a request for ``key`` and report whether it is allowed."""
        now = time.monotonic() if now is None else now
        cutoff = now - self.window_seconds

        window = self._clients.get(key)
        if window is None:
            if len(self._clients) >= self.max_clients:
                self._evict_oldest()
            window = _ClientWindow()
            self._clients[key] = window

        # Prune everything that fell out of the window. Bounded work: the list
        # never grows past ``limit`` entries for an allowed client.
        window.hits = [t for t in window.hits if t > cutoff]

        if len(window.hits) >= self.limit:
            oldest = window.hits[0]
            retry_after = int(oldest + self.window_seconds - now) + 1
            return RateLimitDecision(
                allowed=False,
                limit=self.limit,
                remaining=0,
                retry_after=max(retry_after, 1),
                window_seconds=self.window_seconds,
            )

        window.hits.append(now)
        return RateLimitDecision(
            allowed=True,
            limit=self.limit,
            remaining=self.limit - len(window.hits),
            window_seconds=self.window_seconds,
        )

    def reset(self) -> None:
        """Forget every client (used by tests and by a manual quota reset)."""
        self._clients.clear()

    def tracked_clients(self) -> int:
        """Number of clients currently tracked (observability helper)."""
        return len(self._clients)

    # -------------------------------------------------------------- internal
    def _evict_oldest(self) -> None:
        """Drop the client whose most recent request is the oldest.

        ``dict`` preserves insertion order, but a returning client keeps its
        original position, so the first key is *not* necessarily the stalest.
        Scanning is fine at this scale (a few thousand keys, once per eviction).
        """
        if not self._clients:
            return
        stalest = min(
            self._clients.items(),
            key=lambda item: item[1].hits[-1] if item[1].hits else float("-inf"),
        )
        self._clients.pop(stalest[0], None)


# ---------------------------------------------------------------------------
# Client identity
# ---------------------------------------------------------------------------

def client_key(request) -> str:
    """Derive a coarse client key for throttling.

    ``X-Forwarded-For`` may carry a chain (``client, proxy1, proxy2``); the
    left-most entry is the original client.  Falls back to the socket peer when
    the header is absent (direct access, tests).
    """
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    real_ip = request.headers.get("x-real-ip", "").strip()
    if real_ip:
        return real_ip
    return getattr(request.client, "host", None) or "unknown"


# ---------------------------------------------------------------------------
# Path matching
# ---------------------------------------------------------------------------

#: Endpoints that actually cost money or CPU.  Everything else is unmetered.
#:
#: The list is deliberately *exhaustive and explicit* rather than
#: prefix-based.  A prefix such as ``/api/solutions/`` also swallows
#: ``/api/solutions/config``, which is a plain read endpoint -- metering it
#: would throttle someone who is only browsing the Solution Studio form.
#: Adding a new expensive endpoint must be a conscious edit here.
_PROTECTED_EXACT = frozenset(
    {
        "/api/chat",
        "/api/rag/query",
        "/api/agent/run",
        "/api/solutions/analyze",
        "/api/solutions/generate",
        "/api/solutions/export",
    }
)


def is_rate_limited_path(path: str) -> bool:
    """Whether ``path`` belongs to the expensive, metered surface."""
    # Trailing slashes are normalised away so ``/api/chat/`` cannot slip past.
    return path.rstrip("/") in _PROTECTED_EXACT


# ---------------------------------------------------------------------------
# Process-wide singleton
# ---------------------------------------------------------------------------

_limiter: SlidingWindowLimiter | None = None


def get_limiter(settings=None) -> SlidingWindowLimiter:
    """Return the process-wide limiter, building it from ``settings`` once."""
    global _limiter
    if _limiter is None:
        from .config import get_settings

        settings = settings or get_settings()
        _limiter = SlidingWindowLimiter(
            limit=settings.rate_limit_requests,
            window_seconds=settings.rate_limit_window_seconds,
        )
        logger.info(
            "Rate limiter armed: %d requests / %ds per client",
            _limiter.limit,
            _limiter.window_seconds,
        )
    return _limiter


def reset_limiter() -> None:
    """Drop the singleton (tests)."""
    global _limiter
    _limiter = None
