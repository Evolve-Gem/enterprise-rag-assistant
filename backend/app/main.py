"""FastAPI application factory.

Run locally::

    uvicorn app.main:app --reload --port 8000   # from the backend/ directory

or from the repository root::

    uvicorn backend.app.main:app --reload --port 8000

The app:
* installs structured JSON error handlers (no tracebacks ever reach the client),
* configures CORS for the Next.js dev server,
* warms the knowledge index on startup so the first request is not slow,
* mounts every router under ``/api`` except ``/health``, which stays at the root
  so container health checks and load balancers can reach it trivially.
"""

from __future__ import annotations

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.routes import (
    agent,
    auth,
    evaluation,
    health,
    insights,
    knowledge,
    observability,
    rag,
    solutions,
)
from .core.config import ensure_runtime_dirs, get_settings, resolve_agent_engine
from .core.errors import register_exception_handlers
from .core.logging import configure_logging, get_logger

logger = get_logger("app.main")


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Warm the index and report the effective configuration once."""
    settings = get_settings()
    configure_logging(settings.log_level)
    ensure_runtime_dirs(settings)

    logger.info("=" * 74)
    logger.info("%s v%s (%s)", settings.app_name, settings.app_version, settings.environment)
    logger.info("  knowledge base : %s", settings.kb_dir)
    logger.info("  prompt version : %s", settings.prompt_version)
    logger.info(
        "  llm            : %s / %s | configured=%s",
        settings.llm_provider,
        settings.llm_model,
        settings.llm_configured,
    )
    logger.info(
        "  retrieval      : mode=%s embedding=%s rerank=%s",
        settings.effective_retriever_mode,
        settings.embedding_provider,
        settings.rerank_provider,
    )
    logger.info("  agent engine   : %s", resolve_agent_engine(settings.agent_engine))
    logger.info(
        "  guard rails    : password=%s read_only=%s",
        bool(settings.demo_password),
        settings.demo_read_only,
    )

    started = time.perf_counter()
    try:
        from .rag.index import get_index

        index = get_index(settings)
        report = index.last_build
        logger.info(
            "  index          : %d documents / %d chunks / %d vectors (%.0f ms, cached=%s)",
            report.document_count if report else 0,
            report.chunk_count if report else 0,
            report.vectorized_chunk_count if report else 0,
            (time.perf_counter() - started) * 1000,
            report.from_cache if report else False,
        )
    except Exception as exc:  # pragma: no cover - startup must not hard-fail
        logger.error("Index warm-up failed: %s", exc)

    logger.info("=" * 74)
    yield
    logger.info("%s shutting down", settings.app_name)


def create_app() -> FastAPI:
    """Build the ASGI application."""
    settings = get_settings()
    configure_logging(settings.log_level)

    application = FastAPI(
        title="Enterprise RAG Copilot API",
        description=(
            "企业知识智能与售前 Agent 工作台后端：混合检索、可溯源生成、"
            "Agent/Skill/Tool 三层执行、知识缺口分析与 RAG 评估。"
        ),
        version=settings.app_version,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
    )

    register_exception_handlers(application)

    # ---------------------------------------------------------------- auth gate
    # Enforced centrally rather than per-route. Route-level dependencies are easy
    # to forget (the read-only knowledge endpoints were initially left public,
    # which made DEMO_PASSWORD protect the query endpoint but not the raw
    # documents), so the gate lives here with an explicit public allowlist.
    _PUBLIC_PATHS = {
        "/",
        "/health",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/api/auth/status",
        "/api/auth/login",
    }

    @application.middleware("http")
    async def _demo_password_gate(request: Request, call_next):
        settings = get_settings()
        path = request.url.path
        needs_token = bool(settings.demo_password) and (
            path.startswith("/api") or path.startswith("/docs") or path.startswith("/openapi")
        )
        if needs_token and path not in _PUBLIC_PATHS:
            from .api.deps import verify_demo_token

            token = request.headers.get("X-Demo-Token") or request.query_params.get("demo_token") or ""
            if not verify_demo_token(token, settings):
                return JSONResponse(
                    status_code=401,
                    content={
                        "error": {
                            "code": "unauthorized",
                            "message": "需要演示访问密码。",
                            "details": {},
                        }
                    },
                )
        return await call_next(request)

    @application.middleware("http")
    async def _timing_middleware(request: Request, call_next):
        """Log every request with a real duration."""
        started = time.perf_counter()
        response = await call_next(request)
        elapsed = (time.perf_counter() - started) * 1000
        response.headers["X-Process-Time-Ms"] = f"{elapsed:.1f}"
        if not request.url.path.startswith(("/docs", "/openapi", "/redoc")):
            logger.info(
                "%s %s -> %s (%.0f ms)",
                request.method,
                request.url.path,
                response.status_code,
                elapsed,
            )
        return response

    for module in (
        health,
        auth,
        observability,
        insights,
        knowledge,
        rag,
        agent,
        solutions,
        evaluation,
    ):
        application.include_router(module.router)

    @application.get("/", tags=["system"], summary="服务信息")
    def root() -> dict:
        """Root banner with the resolved capability set."""
        settings = get_settings()
        return {
            "product": settings.app_name,
            "tagline": "AI-powered Knowledge Intelligence & Pre-sales Copilot",
            "version": settings.app_version,
            "docs": "/docs",
            "health": "/health",
            "capabilities": {
                "retrieval": settings.effective_retriever_mode,
                "embedding": settings.embedding_provider,
                "rerank": settings.rerank_provider,
                "agent_engine": resolve_agent_engine(settings.agent_engine),
                "vector_store": settings.vector_store_backend,
            },
        }

    return application


app = create_app()
