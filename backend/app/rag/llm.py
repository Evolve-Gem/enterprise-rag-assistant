"""Thin, provider-agnostic wrapper around the chat completion API.

Everything that talks to a model goes through :class:`LLMClient`, so the
provider, model, timeout, temperature and token budget are all configuration.
Nothing here raises on a provider failure: callers get an ``ok=False``
completion carrying a user-safe message, which keeps the API layer free of
vendor-specific error handling.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from functools import lru_cache

from ..core.config import Settings, get_settings
from ..core.logging import get_logger

logger = get_logger("app.rag.llm")

# Providers that accept an explicit "do not think out loud" switch.  Sending it
# to other vendors would be a 400, so it is gated on the provider name.
_THINKING_SWITCH_PROVIDERS = {"deepseek"}


@dataclass
class LLMCompletion:
    """Normalised completion result."""

    text: str = ""
    model: str = ""
    ok: bool = False
    error: str = ""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    latency_ms: float = 0.0
    finish_reason: str = ""

    @property
    def usage(self) -> dict[str, int]:
        return {
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.total_tokens,
        }


class LLMClient:
    """Synchronous chat-completion client for one configured provider."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client = None

    # ------------------------------------------------------------------
    @property
    def configured(self) -> bool:
        return bool(self.settings.llm_api_key)

    def _ensure_client(self):
        if self._client is not None:
            return self._client
        if not self.configured:
            return None
        try:
            from openai import OpenAI
        except ImportError:  # pragma: no cover - declared dependency
            logger.error("openai package is not installed")
            return None
        self._client = OpenAI(
            api_key=self.settings.llm_api_key,
            base_url=self.settings.llm_base_url,
            timeout=self.settings.llm_timeout_seconds,
        )
        return self._client

    # ------------------------------------------------------------------
    def complete(
        self,
        *,
        system: str,
        user: str,
        temperature: float | None = None,
        max_tokens: int | None = None,
        json_mode: bool = False,
    ) -> LLMCompletion:
        """Run one chat completion.  Never raises."""
        if not self.configured:
            return LLMCompletion(
                ok=False,
                model=self.settings.llm_model,
                error="未配置模型 API Key，请在 .env 中设置 LLM_API_KEY 或 DEEPSEEK_API_KEY。",
            )

        client = self._ensure_client()
        if client is None:
            return LLMCompletion(ok=False, model=self.settings.llm_model, error="模型客户端初始化失败。")

        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
        payload: dict = {
            "model": self.settings.llm_model,
            "messages": messages,
            "temperature": self.settings.llm_temperature if temperature is None else temperature,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens
        if self.settings.llm_provider in _THINKING_SWITCH_PROVIDERS:
            payload["extra_body"] = {"thinking": {"type": "disabled"}}
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        started = time.perf_counter()
        try:
            response = client.chat.completions.create(**payload)
        except Exception as exc:
            elapsed = (time.perf_counter() - started) * 1000
            logger.warning("LLM call failed after %.0fms: %s", elapsed, exc)
            return LLMCompletion(
                ok=False,
                model=self.settings.llm_model,
                error="上游模型服务调用失败，请稍后重试。",
                latency_ms=round(elapsed, 2),
            )

        elapsed = (time.perf_counter() - started) * 1000
        choice = response.choices[0] if response.choices else None
        text = (choice.message.content if choice and choice.message else "") or ""
        usage = getattr(response, "usage", None)

        completion = LLMCompletion(
            text=text.strip(),
            model=getattr(response, "model", self.settings.llm_model),
            ok=bool(text.strip()),
            error="" if text.strip() else "模型返回了空内容。",
            prompt_tokens=int(getattr(usage, "prompt_tokens", 0) or 0),
            completion_tokens=int(getattr(usage, "completion_tokens", 0) or 0),
            total_tokens=int(getattr(usage, "total_tokens", 0) or 0),
            latency_ms=round(elapsed, 2),
            finish_reason=getattr(choice, "finish_reason", "") or "",
        )
        logger.info(
            "LLM ok model=%s tokens=%s latency=%.0fms",
            completion.model,
            completion.total_tokens,
            completion.latency_ms,
        )
        return completion


@lru_cache(maxsize=1)
def _cached_client(settings: Settings) -> LLMClient:
    return LLMClient(settings)


def get_llm_client(settings: Settings | None = None) -> LLMClient:
    """Return the process-wide LLM client (safe to share across requests)."""
    return _cached_client(settings or get_settings())
