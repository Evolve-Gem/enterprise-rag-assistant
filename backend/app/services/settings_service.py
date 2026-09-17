"""Settings / system status service.

Everything the Settings page shows comes from here, and it is all
secrets-free: API keys are reduced to a presence flag plus a masked hint, and
the raw environment is never returned.
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone

from ..core.config import Settings, get_settings, langgraph_available, resolve_agent_engine
from ..core.logging import get_logger
from ..rag.embedder import create_embedder
from ..rag.index import get_index
from ..rag.prompts import get_prompt_library

logger = get_logger("app.services.settings")


class SettingsService:
    """Read-only view of the runtime configuration."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    # ------------------------------------------------------------------
    def public_settings(self) -> dict:
        """Config the frontend may display."""
        settings = self.settings
        return {
            **settings.public_view(),
            "runtime": {
                "python": sys.version.split()[0],
                "langgraph_available": langgraph_available(),
                "prompt_version": settings.prompt_version,
            },
            "observability": {
                "activity_enabled": settings.activity_enabled,
                "activity_backend": settings.activity_backend,
                "max_records": settings.activity_max_records,
            },
            "evaluation": {
                "dataset_path": str(settings.evaluation_dataset_path or ""),
            },
        }

    # ------------------------------------------------------------------
    def prompt_inventory(self) -> list[dict]:
        """List the loaded prompt templates with their placeholders."""
        return get_prompt_library(self.settings).describe()

    # ------------------------------------------------------------------
    def system_status(self) -> dict:
        """Health block: what is configured, what is degraded, what is not ready."""
        settings = self.settings
        index = get_index(settings)
        report = index.last_build
        embedder = create_embedder(settings)

        checks: list[dict] = []

        checks.append(
            {
                "key": "llm",
                "label": "大模型服务",
                "status": "ok" if settings.llm_configured else "missing",
                "detail": (
                    f"{settings.llm_provider} / {settings.llm_model}"
                    if settings.llm_configured
                    else "未配置 LLM_API_KEY 或 DEEPSEEK_API_KEY，问答与方案生成不可用。"
                ),
            }
        )
        checks.append(
            {
                "key": "embedding",
                "label": "向量检索",
                "status": "ok" if settings.embedding_configured else "degraded",
                "detail": (
                    f"{embedder.description}"
                    if embedder
                    else "已禁用向量检索，降级为纯关键词检索。"
                ),
            }
        )
        checks.append(
            {
                "key": "index",
                "label": "知识索引",
                "status": "ok" if report and report.chunk_count else "missing",
                "detail": (
                    f"{report.document_count} 文档 / {report.chunk_count} 知识块"
                    f"（向量化 {report.vectorized_chunk_count}）"
                    if report
                    else "索引尚未构建。"
                ),
            }
        )
        checks.append(
            {
                "key": "agent_engine",
                "label": "Agent 引擎",
                "status": "ok",
                "detail": (
                    f"当前使用 {resolve_agent_engine(settings.agent_engine)}"
                    f"（配置值 {settings.agent_engine}，langgraph 可用 = {langgraph_available()}）"
                ),
            }
        )
        checks.append(
            {
                "key": "guard_rails",
                "label": "演示保护",
                "status": "ok",
                "detail": (
                    f"写操作{'已锁定（只读模式）' if settings.demo_read_only else '开放'}"
                    f"；访问密码{'已启用' if settings.demo_password else '未设置'}"
                ),
            }
        )

        overall = "ok"
        if any(item["status"] == "missing" for item in checks):
            overall = "degraded"
        if not settings.llm_configured:
            overall = "degraded"

        return {
            "status": overall,
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "checks": checks,
            "index": {
                "state": report.index_state if report else "empty",
                "built_at": report.built_at.isoformat() if report and report.built_at else None,
                "from_cache": report.from_cache if report else False,
                "document_count": report.document_count if report else 0,
                "chunk_count": report.chunk_count if report else 0,
                "vectorized_chunk_count": report.vectorized_chunk_count if report else 0,
                "failed_count": report.failed_count if report else 0,
            },
        }


_service: SettingsService | None = None


def get_settings_service(settings: Settings | None = None) -> SettingsService:
    """Process-wide settings service."""
    global _service
    if _service is None:
        _service = SettingsService(settings or get_settings())
    return _service


def reset_settings_service() -> None:
    """Drop the singleton (tests)."""
    global _service
    _service = None
