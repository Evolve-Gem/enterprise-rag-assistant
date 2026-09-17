"""Shared FastAPI dependencies.

The demo password gate is stateless on purpose: a successful login returns an
HMAC-derived token, and every protected request just re-derives and compares
it.  Nothing is stored server-side, so a restart does not log everyone out and
there is no session store to leak.
"""

from __future__ import annotations

import hmac
import hashlib
from typing import Annotated

from fastapi import Depends, Header, Request

from ..core.config import Settings, get_settings
from ..core.errors import AppError
from ..core.logging import get_logger

logger = get_logger("app.api.deps")

_TOKEN_SALT = "enterprise-rag-copilot::demo-session::v1"


class UnauthorizedError(AppError):
    """Raised when the demo password gate rejects a request."""

    code = "unauthorized"
    status_code = 401
    message = "需要演示访问密码。"


def get_settings_dep() -> Settings:
    """Inject the process-wide settings."""
    return get_settings()


SettingsDep = Annotated[Settings, Depends(get_settings_dep)]


def derive_demo_token(password: str) -> str:
    """Derive the session token from the configured demo password."""
    return hmac.new(
        password.encode("utf-8"),
        _TOKEN_SALT.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_demo_token(candidate: str, settings: Settings) -> bool:
    """Constant-time token comparison."""
    if not settings.demo_password:
        return True
    expected = derive_demo_token(settings.demo_password)
    return hmac.compare_digest(candidate or "", expected)


def require_auth(
    settings: SettingsDep,
    x_demo_token: Annotated[str | None, Header(alias="X-Demo-Token")] = None,
) -> None:
    """Guard every protected route when ``DEMO_PASSWORD`` is configured."""
    if not settings.demo_password:
        return
    if not verify_demo_token(x_demo_token or "", settings):
        raise UnauthorizedError()


AuthDep = Depends(require_auth)


def client_hint(request: Request) -> str:
    """A non-identifying client hint for logs (no IP storage)."""
    return request.headers.get("user-agent", "")[:120]
