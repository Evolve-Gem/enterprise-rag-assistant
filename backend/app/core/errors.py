"""Typed application errors and the handlers that turn them into JSON.

The frontend must never see a Python traceback.  Every failure path in this
backend either raises an :class:`AppError` (turned into a structured, localized
payload) or is caught by the catch-all handler, which logs the real traceback
server-side and returns an opaque reference id to the client.
"""

from __future__ import annotations

import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .logging import get_logger

logger = get_logger("app.errors")


class AppError(Exception):
    """Base class for expected, client-safe failures."""

    code = "internal_error"
    status_code = 500
    message = "服务内部错误，请稍后重试。"

    def __init__(
        self,
        message: str | None = None,
        *,
        details: dict | None = None,
        status_code: int | None = None,
    ) -> None:
        self.message = message or self.message
        self.details = details or {}
        if status_code is not None:
            self.status_code = status_code
        super().__init__(self.message)

    def to_payload(self) -> dict:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details,
            }
        }


class NotFoundError(AppError):
    code = "not_found"
    status_code = 404
    message = "请求的资源不存在。"


class InvalidRequestError(AppError):
    code = "invalid_request"
    status_code = 400
    message = "请求参数不合法。"


class ConflictError(AppError):
    code = "conflict"
    status_code = 409
    message = "资源状态冲突。"


class ReadOnlyError(AppError):
    code = "read_only"
    status_code = 403
    message = "当前为只读演示模式，写操作已被禁用。"


class UnsupportedFileError(AppError):
    code = "unsupported_file"
    status_code = 415
    message = "不支持的文件类型。"


class FileTooLargeError(AppError):
    code = "file_too_large"
    status_code = 413
    message = "文件超过允许的大小上限。"


class ProviderNotConfiguredError(AppError):
    code = "provider_not_configured"
    status_code = 503
    message = "模型服务未配置，请检查环境变量。"


class UpstreamError(AppError):
    code = "upstream_error"
    status_code = 502
    message = "上游模型服务调用失败，请稍后重试。"


class IndexNotReadyError(AppError):
    code = "index_not_ready"
    status_code = 409
    message = "知识索引尚未就绪，请先重建索引。"


class HumanCheckRequiredError(AppError):
    code = "human_check_required"
    status_code = 409
    message = "该操作需要人工确认后才能继续。"


def register_exception_handlers(app: FastAPI) -> None:
    """Attach the structured handlers to a FastAPI application."""

    @app.exception_handler(AppError)
    async def _app_error_handler(_: Request, exc: AppError) -> JSONResponse:
        if exc.status_code >= 500:
            logger.error("AppError %s: %s | %s", exc.code, exc.message, exc.details)
        else:
            logger.info("AppError %s: %s", exc.code, exc.message)
        return JSONResponse(status_code=exc.status_code, content=exc.to_payload())

    @app.exception_handler(RequestValidationError)
    async def _validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields = []
        for error in exc.errors():
            location = ".".join(str(part) for part in error.get("loc", ()) if part != "body")
            fields.append({"field": location or "body", "reason": error.get("msg", "")})
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "validation_error",
                    "message": "请求参数校验失败。",
                    "details": {"fields": fields},
                }
            },
        )

    @app.exception_handler(Exception)
    async def _unhandled_handler(_: Request, exc: Exception) -> JSONResponse:
        reference = uuid.uuid4().hex[:12]
        logger.exception("Unhandled error [ref=%s]: %s", reference, exc)
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "internal_error",
                    "message": "服务内部错误，请稍后重试。",
                    "details": {"reference": reference},
                }
            },
        )
