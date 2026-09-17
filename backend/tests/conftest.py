"""Shared pytest fixtures.

Every test runs against a **temporary knowledge base and data directory**, so
the suite never touches the real ``knowledge_base/`` and never writes into the
developer's activity ledger.  Configuration is injected through environment
variables + ``reload_settings()`` because the service modules import
``get_settings`` directly (patching the module attribute would not affect them).
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

SAMPLE_DOCS: dict[str, str] = {
    "检索链路.md": (
        "# 检索链路\n\n"
        "> 一句话总结：检索负责找到候选资料，Rerank 负责重新排序。\n\n"
        "## 1. Retrieval｜检索\n\n"
        "检索是根据用户查询，从外部知识源中寻找并返回相关候选内容的过程。\n\n"
        "## 2. Rerank｜重排序\n\n"
        "Rerank 是对初次检索得到的候选结果进行再次相关性评分和排序，"
        "以提升最相关内容排名的技术步骤。\n\n"
        "Rerank 只能重新排列已经检索出来的候选内容，如果正确资料没有进入第一次候选集合，"
        "Rerank 无法凭空把它找回来。\n\n"
        "## 3. Top K\n\n"
        "Top K 是检索系统按照相关性分数排序后，返回排名最靠前的 K 个候选结果。\n"
    ),
    "产品介绍.md": (
        "# 产品介绍\n\n"
        "## 产品定位\n\n"
        "本产品面向企业知识管理场景，提供统一知识库与智能问答能力。\n\n"
        "## 核心功能\n\n"
        "- 文档解析与切分\n- 混合检索\n- 结构化回答与引用溯源\n"
    ),
    "FAQ.md": (
        "# FAQ\n\n"
        "## 常见问题\n\n"
        "### 支持哪些文件格式？\n\n"
        "支持 Markdown、纯文本、PDF 与 Word 文档。\n\n"
        "### 回答是否可追溯？\n\n"
        "是，回答中的每个事实都会标注引用编号。\n"
    ),
    "成功案例.md": (
        "# 成功案例\n\n"
        "## 某职业院校知识库建设\n\n"
        "客户需求是统一招生政策与教务规定，上线后人工答疑量下降。\n"
    ),
    "教育行业解决方案.md": (
        "# 教育行业解决方案\n\n"
        "## 行业场景\n\n"
        "面向院校的招生咨询、教务政策问答与学生事务答疑场景。\n"
    ),
}


def _reset_singletons() -> None:
    """Drop every process-wide cache so each test starts clean."""
    from app.core import config

    config.reload_settings()

    modules = [
        "app.rag.index",
        "app.services.activity_service",
        "app.services.knowledge_service",
        "app.services.insights_service",
        "app.services.evaluation_service",
        "app.services.rag_service",
        "app.services.agent_service",
        "app.services.settings_service",
    ]
    for name in modules:
        module = sys.modules.get(name)
        if module is None:
            continue
        for attr in ("reset_index", "reset_activity_service", "reset_knowledge_service",
                     "reset_insights_service", "reset_evaluation_service", "reset_rag_service",
                     "reset_agent_service", "reset_settings_service"):
            resetter = getattr(module, attr, None)
            if callable(resetter):
                resetter()


@pytest.fixture()
def sandbox(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Isolated knowledge base + data dir, with the LLM disabled."""
    kb_dir = tmp_path / "knowledge_base"
    kb_dir.mkdir()
    for name, body in SAMPLE_DOCS.items():
        (kb_dir / name).write_text(body, encoding="utf-8")

    data_dir = tmp_path / "data"

    monkeypatch.setenv("KB_DIR", str(kb_dir))
    monkeypatch.setenv("DATA_DIR", str(data_dir))
    monkeypatch.setenv("PROMPTS_DIR", str(REPO_ROOT / "prompts"))
    monkeypatch.setenv("PROMPT_VERSION", "v1")
    monkeypatch.setenv("EMBEDDING_PROVIDER", "hashing")
    monkeypatch.setenv("EMBEDDING_DIM", "256")
    monkeypatch.setenv("RETRIEVER_MODE", "hybrid")
    monkeypatch.setenv("CHUNK_SIZE", "300")
    monkeypatch.setenv("CHUNK_OVERLAP", "60")
    monkeypatch.setenv("RERANK_PROVIDER", "heuristic")
    monkeypatch.setenv("AGENT_ENGINE", "native")
    monkeypatch.setenv("ACTIVITY_BACKEND", "sqlite")
    monkeypatch.setenv("DEMO_READ_ONLY", "false")
    monkeypatch.setenv("DEMO_PASSWORD", "")
    # Empty values win over .env (python-dotenv does not override existing vars),
    # which keeps every test off the network.
    monkeypatch.setenv("DEEPSEEK_API_KEY", "")
    monkeypatch.setenv("LLM_API_KEY", "")

    _reset_singletons()
    yield {"kb_dir": kb_dir, "data_dir": data_dir}
    _reset_singletons()


@pytest.fixture()
def settings(sandbox):
    """Settings bound to the sandbox directories."""
    from app.core.config import get_settings

    return get_settings()


@pytest.fixture()
def index(sandbox):
    """A freshly built knowledge index over the sandbox corpus."""
    from app.rag.index import get_index

    return get_index()


@pytest.fixture()
def client(sandbox):
    """FastAPI TestClient backed by the sandbox (real ASGI stack, no network)."""
    from fastapi.testclient import TestClient

    from app.main import create_app

    with TestClient(create_app()) as test_client:
        yield test_client
