"""Demo password gate.

Only active when ``DEMO_PASSWORD`` is set.  The flow is deliberately tiny:

1. ``GET  /api/auth/status`` → does this deployment need a password?
2. ``POST /api/auth/login``  → validate the password, return a token
3. every other ``/api`` route requires ``X-Demo-Token`` when the gate is on
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ...core.config import get_settings
from ...core.errors import AppError
from ...core.security import verify_demo_password
from ..deps import SettingsDep, derive_demo_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    """Login payload."""

    password: str = Field(min_length=1, max_length=200)


class LoginResponse(BaseModel):
    """Session token for the current browser session."""

    ok: bool = True
    token: str = ""
    message: str = ""


class AuthStatusResponse(BaseModel):
    """Whether the gate is enabled."""

    password_required: bool = False
    read_only: bool = False
    app_name: str = ""
    version: str = ""


class InvalidPasswordError(AppError):
    code = "invalid_password"
    status_code = 401
    message = "访问密码错误。"


@router.get("/status", response_model=AuthStatusResponse, summary="查询是否需要访问密码")
def auth_status(settings: SettingsDep) -> AuthStatusResponse:
    """Public endpoint the frontend calls before rendering the app shell."""
    return AuthStatusResponse(
        password_required=bool(settings.demo_password),
        read_only=settings.demo_read_only,
        app_name=settings.app_name,
        version=settings.app_version,
    )


@router.post("/login", response_model=LoginResponse, summary="校验演示访问密码")
def login(payload: LoginRequest) -> LoginResponse:
    """Validate the password and mint a stateless session token."""
    settings = get_settings()
    if not settings.demo_password:
        return LoginResponse(ok=True, token="", message="该部署未启用访问密码。")

    if not verify_demo_password(payload.password, settings):
        raise InvalidPasswordError()

    return LoginResponse(
        ok=True,
        token=derive_demo_token(settings.demo_password),
        message="验证通过。",
    )
