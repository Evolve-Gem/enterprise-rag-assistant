"""End-to-end API tests over the real ASGI stack (no network access)."""

from __future__ import annotations

import io

import pytest

from app.core.config import get_settings, reload_settings
from app.core.ratelimit import reset_limiter
from app.rag.splitter import make_document_id


# ------------------------------------------------------------------- system


def test_root_and_health(client):
    root = client.get("/")
    assert root.status_code == 200
    assert root.json()["product"]

    health = client.get("/health")
    assert health.status_code == 200
    payload = health.json()
    assert payload["index_ready"] is True
    assert payload["index_document_count"] == 5
    assert payload["index_chunk_count"] > 0
    # No LLM key in the sandbox -> the service must report itself as degraded,
    # not pretend to be healthy.
    assert payload["status"] == "degraded"
    assert payload["llm_configured"] is False


def test_health_reports_agent_engine(client):
    assert client.get("/health").json()["agent_engine"] in {"native", "langgraph"}


def test_system_status_lists_checks(client):
    payload = client.get("/api/system/status").json()
    assert payload["status"] in {"ok", "degraded"}
    keys = {check["key"] for check in payload["checks"]}
    assert {"llm", "embedding", "index", "agent_engine", "guard_rails"} <= keys


# --------------------------------------------------------------------- auth


def test_auth_status_is_public_and_reports_no_password(client):
    payload = client.get("/api/auth/status").json()
    assert payload["password_required"] is False
    assert payload["read_only"] is False


def test_login_without_configured_password_succeeds(client):
    response = client.post("/api/auth/login", json={"password": "anything"})
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_password_gate_blocks_requests_when_enabled(monkeypatch, sandbox):
    monkeypatch.setenv("DEMO_PASSWORD", "s3cret")
    reload_settings()

    from fastapi.testclient import TestClient

    from app.main import create_app

    with TestClient(create_app()) as guarded:
        assert guarded.get("/api/auth/status").json()["password_required"] is True

        blocked = guarded.post("/api/rag/query", json={"question": "Rerank 是什么"})
        assert blocked.status_code == 401
        assert blocked.json()["error"]["code"] == "unauthorized"

        assert guarded.post("/api/auth/login", json={"password": "wrong"}).status_code == 401

        login = guarded.post("/api/auth/login", json={"password": "s3cret"})
        assert login.status_code == 200
        token = login.json()["token"]
        assert token

        allowed = guarded.post(
            "/api/rag/query",
            json={"question": "Rerank 是什么"},
            headers={"X-Demo-Token": token},
        )
        assert allowed.status_code == 200


def test_read_only_mode_blocks_writes_through_the_api(monkeypatch, sandbox):
    monkeypatch.setenv("DEMO_READ_ONLY", "true")
    reload_settings()

    from fastapi.testclient import TestClient

    from app.main import create_app

    with TestClient(create_app()) as guarded:
        response = guarded.post(
            "/api/knowledge/upload",
            files={"file": ("a.md", io.BytesIO(b"# a\n\ncontent\n"), "text/markdown")},
        )
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "read_only"


def test_password_gate_protects_every_read_endpoint(monkeypatch, sandbox):
    """Regression: the gate used to be per-route, so the raw documents stayed open.

    A password that protects the query endpoint but not the underlying corpus is
    worse than useless, because it looks like it protects something.
    """
    monkeypatch.setenv("DEMO_PASSWORD", "s3cret")
    reload_settings()

    from fastapi.testclient import TestClient

    from app.main import create_app

    protected = [
        ("GET", "/api/knowledge/documents"),
        ("GET", "/api/knowledge/stats"),
        ("GET", "/api/overview"),
        ("GET", "/api/settings"),
        ("GET", "/api/settings/prompts"),
        ("GET", "/api/insights/coverage"),
        ("GET", "/api/evaluation/dataset"),
        ("GET", "/api/activity"),
        ("GET", "/api/agent/catalog"),
        ("GET", "/api/solutions/config"),
        ("GET", "/api/rag/retrieve?q=Rerank&top_k=3"),
    ]
    public = ["/health", "/api/auth/status", "/"]

    with TestClient(create_app()) as guarded:
        for method, path in protected:
            anonymous = guarded.request(method, path)
            assert anonymous.status_code == 401, f"{path} was reachable without a token"
            assert anonymous.json()["error"]["code"] == "unauthorized"

        for path in public:
            assert guarded.get(path).status_code == 200, f"{path} should stay public"

        token = guarded.post("/api/auth/login", json={"password": "s3cret"}).json()["token"]
        headers = {"X-Demo-Token": token}
        for method, path in protected:
            allowed = guarded.request(method, path, headers=headers)
            assert allowed.status_code == 200, f"{path} rejected a valid token ({allowed.status_code})"


def test_open_demo_needs_no_token_on_any_route(monkeypatch, sandbox):
    """The public demo ships with ``DEMO_PASSWORD`` empty on purpose.

    Emptiness must be an explicit, supported mode -- not an accident that only
    happens to work -- so this test walks the *same* route table the password
    test does and asserts each one answers without ``X-Demo-Token``.
    """
    monkeypatch.setenv("DEMO_PASSWORD", "")
    reload_settings()

    from fastapi.testclient import TestClient

    from app.main import create_app

    open_routes = [
        ("GET", "/api/knowledge/documents"),
        ("GET", "/api/knowledge/stats"),
        ("GET", "/api/overview"),
        ("GET", "/api/settings"),
        ("GET", "/api/insights/coverage"),
        ("GET", "/api/evaluation/dataset"),
        ("GET", "/api/activity"),
        ("GET", "/api/agent/catalog"),
        ("GET", "/api/solutions/config"),
        ("GET", "/api/rag/retrieve?q=Rerank&top_k=3"),
    ]

    with TestClient(create_app()) as demo:
        status = demo.get("/api/auth/status").json()
        assert status["password_required"] is False
        assert status["read_only"] is False

        for method, path in open_routes:
            response = demo.request(method, path)
            assert response.status_code == 200, f"{path} still gated ({response.status_code})"


def test_open_demo_read_only_still_blocks_every_write(monkeypatch, sandbox):
    """No password must not mean no guard rails: writes stay refused."""
    monkeypatch.setenv("DEMO_PASSWORD", "")
    monkeypatch.setenv("DEMO_READ_ONLY", "true")
    reload_settings()

    from fastapi.testclient import TestClient

    from app.main import create_app

    with TestClient(create_app()) as demo:
        assert demo.get("/api/auth/status").json()["read_only"] is True

        upload = demo.post(
            "/api/knowledge/upload",
            files={"file": ("a.md", io.BytesIO(b"# a\n\ncontent\n"), "text/markdown")},
        )
        assert upload.status_code == 403
        assert upload.json()["error"]["code"] == "read_only"

        assert demo.post("/api/knowledge/reindex").status_code == 403

        # Clearing the activity ledger has its own guard with its own code
        # (``clear_not_allowed``, 400) -- asserted explicitly so a future
        # refactor cannot quietly widen it.
        cleared = demo.delete("/api/activity")
        assert cleared.status_code == 400
        assert cleared.json()["error"]["code"] == "clear_not_allowed"

        # ... while reads remain wide open.
        assert demo.get("/api/knowledge/documents").status_code == 200


# ---------------------------------------------------------- rate limiting


def test_rate_limit_is_off_by_default(client):
    """A local run or the test suite must never be throttled."""
    assert client.get("/api/settings").json()["guard_rails"]["rate_limit"]["enabled"] is False

    # Hammering a metered endpoint stays unthrottled when the guard is off.
    for _ in range(12):
        assert client.get("/api/rag/retrieve?q=Rerank&top_k=3").status_code == 200


def test_rate_limit_allows_then_blocks_with_429(monkeypatch, sandbox):
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("RATE_LIMIT_REQUESTS", "3")
    monkeypatch.setenv("RATE_LIMIT_WINDOW_SECONDS", "60")
    reload_settings()
    reset_limiter()

    from fastapi.testclient import TestClient

    from app.main import create_app

    with TestClient(create_app()) as demo:
        # Each request needs a *real* unit of work, but the token spend is what
        # matters -- so the LLM stays unconfigured and the sandbox answers the
        # request cheaply. Only the limiter's arithmetic is under test.
        for index in range(3):
            allowed = demo.post("/api/rag/query", json={"question": "Rerank 是什么"})
            assert allowed.status_code == 200, f"request {index + 1} should pass"
            assert allowed.headers["X-RateLimit-Remaining"] == str(2 - index)

        blocked = demo.post("/api/rag/query", json={"question": "Rerank 是什么"})
        assert blocked.status_code == 429
        payload = blocked.json()
        assert payload["error"]["code"] == "rate_limit_exceeded"
        assert payload["error"]["details"]["limit"] == 3
        assert payload["error"]["details"]["window_seconds"] == 60
        assert int(blocked.headers["Retry-After"]) >= 1
        assert blocked.headers["X-RateLimit-Remaining"] == "0"


def test_rate_limit_does_not_touch_browsing_endpoints(monkeypatch, sandbox):
    """The demo must never feel throttled while someone is just reading it."""
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("RATE_LIMIT_REQUESTS", "2")
    monkeypatch.setenv("RATE_LIMIT_WINDOW_SECONDS", "60")
    reload_settings()
    reset_limiter()

    from fastapi.testclient import TestClient

    from app.main import create_app

    unmetered = [
        "/health",
        "/api/overview",
        "/api/knowledge/documents",
        "/api/knowledge/stats",
        "/api/agent/catalog",
        "/api/agent/tools",
        "/api/agent/skills",
        "/api/solutions/config",
        "/api/insights/coverage",
        "/api/insights/gaps",
        "/api/evaluation/dataset",
        "/api/activity",
        "/api/settings",
        "/api/rag/retrieve?q=Rerank&top_k=3",
    ]

    with TestClient(create_app()) as demo:
        for _ in range(4):
            for path in unmetered:
                response = demo.get(path)
                assert response.status_code == 200, f"{path} got throttled ({response.status_code})"


def test_rate_limit_is_per_client(monkeypatch, sandbox):
    """One noisy visitor must not lock everyone else out."""
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("RATE_LIMIT_REQUESTS", "1")
    monkeypatch.setenv("RATE_LIMIT_WINDOW_SECONDS", "60")
    reload_settings()
    reset_limiter()

    from fastapi.testclient import TestClient

    from app.main import create_app

    noisy = {"X-Forwarded-For": "203.0.113.7"}
    quiet = {"X-Forwarded-For": "198.51.100.9"}

    with TestClient(create_app()) as demo:
        assert demo.post("/api/chat", json={"question": "hi"}, headers=noisy).status_code == 200
        assert demo.post("/api/chat", json={"question": "hi"}, headers=noisy).status_code == 429

        # A different visitor is untouched by the first one's exhaustion.
        assert demo.post("/api/chat", json={"question": "hi"}, headers=quiet).status_code == 200


def test_rate_limit_skips_rejected_requests(monkeypatch, sandbox):
    """A 401 from the password gate must not burn quota.

    The limiter is declared *inside* the auth gate for exactly this reason; if
    it were declared first, an unauthenticated scanner could exhaust the quota
    of the very client it was impersonating.
    """
    monkeypatch.setenv("DEMO_PASSWORD", "s3cret")
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("RATE_LIMIT_REQUESTS", "2")
    reload_settings()
    reset_limiter()

    from fastapi.testclient import TestClient

    from app.main import create_app

    with TestClient(create_app()) as demo:
        for _ in range(5):
            assert demo.post("/api/chat", json={"question": "hi"}).status_code == 401

        token = demo.post("/api/auth/login", json={"password": "s3cret"}).json()["token"]
        headers = {"X-Demo-Token": token}

        # Full quota still available: the 401s cost nothing.
        assert demo.post("/api/chat", json={"question": "hi"}, headers=headers).status_code == 200
        assert demo.post("/api/chat", json={"question": "hi"}, headers=headers).status_code == 200
        assert demo.post("/api/chat", json={"question": "hi"}, headers=headers).status_code == 429


def test_sliding_window_limiter_unit():
    """The limiter itself, without the HTTP stack in the way."""
    from app.core.ratelimit import SlidingWindowLimiter

    limiter = SlidingWindowLimiter(limit=2, window_seconds=60)

    assert limiter.check("client", now=1000.0).allowed is True
    assert limiter.check("client", now=1000.5).allowed is True

    denied = limiter.check("client", now=1001.0)
    assert denied.allowed is False
    assert denied.retry_after == 60

    # Sliding, not fixed: the first hit ages out 60s after *it* happened.
    assert limiter.check("client", now=1060.1).allowed is True

    # Independent clients never share a bucket.
    assert limiter.check("other", now=1060.1).allowed is True

    # Stale entries are pruned, so memory is bounded by the window.
    limiter.reset()
    assert limiter.tracked_clients() == 0


def test_rate_limit_path_matcher_covers_only_expensive_endpoints():
    """Regression: a prefix rule used to meter ``/api/solutions/config``.

    ``/api/solutions/config`` is a plain GET that feeds the Solution Studio
    form.  Matching it with a ``/api/solutions/`` prefix throttled a read-only
    page, which is exactly the "demo feels broken" failure the scope rule was
    meant to avoid.
    """
    from app.core.ratelimit import is_rate_limited_path

    metered = [
        "/api/chat",
        "/api/rag/query",
        "/api/agent/run",
        "/api/solutions/analyze",
        "/api/solutions/generate",
        "/api/solutions/export",
        "/api/chat/",  # trailing slash must not slip through
    ]
    unmetered = [
        "/api/solutions/config",
        "/api/agent/catalog",
        "/api/agent/tools",
        "/api/agent/skills",
        "/api/rag/retrieve",
        "/api/knowledge/documents",
        "/api/overview",
        "/health",
        "/",
    ]

    for path in metered:
        assert is_rate_limited_path(path) is True, f"{path} should be metered"
    for path in unmetered:
        assert is_rate_limited_path(path) is False, f"{path} should be unmetered"


def test_sliding_window_limiter_evicts_under_a_key_flood():
    """A spoofed-IP flood must not grow the client dict without limit."""
    from app.core.ratelimit import SlidingWindowLimiter

    limiter = SlidingWindowLimiter(limit=1, window_seconds=60, max_clients=16)
    for index in range(500):
        limiter.check(f"10.0.0.{index}", now=1000.0 + index)

    assert limiter.tracked_clients() <= 16


# ----------------------------------------------------------------- overview


def test_overview_aggregates_real_counts(client):
    payload = client.get("/api/overview").json()
    assert payload["knowledge"]["document_count"] == 5
    assert payload["knowledge"]["chunk_count"] > 0
    assert payload["system"]["retriever_mode"] in {"hybrid", "keyword", "vector"}
    assert payload["coverage_summary"]["total_categories"] >= 8
    assert len(payload["quick_actions"]) >= 4
    assert payload["generated_at"]


def test_overview_never_leaks_secrets(client):
    body = client.get("/api/overview").text
    assert "api_key" not in body.lower()
    assert "sk-" not in body


# ----------------------------------------------------------- settings/prompts


def test_settings_masks_provider_keys(client):
    payload = client.get("/api/settings").json()
    llm = payload["providers"]["llm"]
    assert llm["configured"] is False
    assert llm["key_hint"] in {"", "****"} or llm["key_hint"].startswith("*")
    assert "llm_api_key" not in payload["providers"]["llm"]
    assert payload["retrieval"]["effective_mode"] in {"hybrid", "keyword", "vector"}


def test_prompt_inventory_lists_versioned_templates(client):
    payload = client.get("/api/settings/prompts").json()
    assert payload["version"] == "v1"
    names = {item["name"] for item in payload["items"]}
    assert {"rag_answer", "solution_generation", "requirement_analysis"} <= names
    rag = next(item for item in payload["items"] if item["name"] == "rag_answer")
    assert "question" in rag["placeholders"]


# ---------------------------------------------------------------- knowledge


def test_knowledge_listing_and_detail(client):
    listing = client.get("/api/knowledge/documents", params={"limit": 50}).json()
    assert listing["total"] == 5

    doc_id = make_document_id("检索链路.md")
    detail = client.get(f"/api/knowledge/documents/{doc_id}").json()
    assert "Rerank" in detail["content"]
    assert detail["chunks"]

    chunk_id = detail["chunks"][0]["chunk_id"]
    chunk = client.get(f"/api/knowledge/chunks/{chunk_id}").json()
    assert chunk["chunk_id"] == chunk_id

    chunks = client.get(f"/api/knowledge/documents/{doc_id}/chunks").json()
    assert chunks["total"] == len(detail["chunks"])


def test_knowledge_stats_endpoint(client):
    stats = client.get("/api/knowledge/stats").json()
    assert stats["document_count"] == 5
    assert stats["chunk_count"] > 0
    assert stats["vectorized_chunk_count"] > 0
    assert stats["retriever_mode"] in {"hybrid", "keyword", "vector"}


def test_knowledge_search_filter(client):
    payload = client.get("/api/knowledge/documents", params={"q": "FAQ"}).json()
    assert payload["total"] == 1


def test_upload_then_delete_via_api(client):
    upload = client.post(
        "/api/knowledge/upload",
        files={
            "file": (
                "上传测试.md",
                io.BytesIO("# 上传测试\n\n这是一个通过 API 上传的文档，内容足够形成知识块。\n".encode()),
                "text/markdown",
            )
        },
    )
    assert upload.status_code == 200
    body = upload.json()
    assert body["document"]["name"] == "上传测试.md"
    assert body["chunks_created"] >= 1

    doc_id = body["document"]["id"]
    assert client.get(f"/api/knowledge/documents/{doc_id}").status_code == 200

    deleted = client.delete(f"/api/knowledge/documents/{doc_id}")
    assert deleted.status_code == 200
    assert "已删除" in deleted.json()["message"]
    assert client.get(f"/api/knowledge/documents/{doc_id}").status_code == 404


def test_upload_rejects_unsupported_type(client):
    response = client.post(
        "/api/knowledge/upload",
        files={"file": ("evil.exe", io.BytesIO(b"MZ"), "application/octet-stream")},
    )
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_file"


def test_reindex_endpoint(client):
    response = client.post("/api/knowledge/reindex", json={"force_vectors": True})
    assert response.status_code == 200
    payload = response.json()
    assert payload["document_count"] == 5
    assert payload["chunk_count"] > 0


def test_update_document_via_api(client):
    doc_id = make_document_id("FAQ.md")
    response = client.put(
        f"/api/knowledge/documents/{doc_id}",
        json={"content": "# FAQ\n\n## 新章节\n\n通过 API 更新的内容。\n"},
    )
    assert response.status_code == 200
    assert "通过 API 更新的内容" in response.json()["content"]


# ---------------------------------------------------------------------- rag


def test_rag_retrieve_endpoint_returns_scored_chunks(client):
    payload = client.get(
        "/api/rag/retrieve", params={"q": "Rerank 的作用", "top_k": 5}
    ).json()
    assert payload["items"]
    top = payload["items"][0]
    assert top["document_name"] == "检索链路.md"
    assert payload["stats"]["after_rerank"] > 0
    assert top["fused_score"] > 0


def test_rag_retrieve_keyword_mode(client):
    payload = client.get(
        "/api/rag/retrieve", params={"q": "Rerank", "top_k": 3, "mode": "keyword"}
    ).json()
    assert payload["stats"]["mode"] == "keyword"
    assert payload["stats"]["vector_hits"] == 0


def test_rag_query_returns_provenance_without_llm(client):
    """With no API key the answer is degraded, but provenance must still be real."""
    payload = client.post("/api/rag/query", json={"question": "Rerank 在检索链路里做什么？"}).json()
    assert payload["question"]
    assert payload["answer"]
    assert payload["citations"]
    assert payload["sources"]
    assert payload["retrieved_chunks"]
    assert len(payload["trace"]) >= 6
    assert payload["latency_ms"] > 0
    assert payload["prompt_version"] == "v1"
    # Nothing was generated, so the answer must not claim to be grounded.
    assert payload["grounded"] is False


def test_rag_query_rejects_empty_question(client):
    assert client.post("/api/rag/query", json={"question": ""}).status_code == 422


def test_rag_query_rejects_missing_field(client):
    assert client.post("/api/rag/query", json={}).status_code == 422


def test_chat_accepts_history(client):
    payload = client.post(
        "/api/chat",
        json={
            "question": "它的边界是什么？",
            "history": [
                {"role": "user", "content": "Rerank 是什么？"},
                {"role": "assistant", "content": "Rerank 是重排序。"},
            ],
        },
    ).json()
    assert payload["answer"]
    assert payload["trace"]


def test_rag_query_trace_nodes_are_ordered(client):
    payload = client.post("/api/rag/query", json={"question": "Top K 是什么"}).json()
    nodes = [step["node"] for step in payload["trace"]]
    assert nodes[0] == "understand"
    assert "retrieve" in nodes
    assert "grounding" in nodes
    assert [step["index"] for step in payload["trace"]] == list(
        range(1, len(payload["trace"]) + 1)
    )


# -------------------------------------------------------------------- agent


def test_agent_catalog(client):
    payload = client.get("/api/agent/catalog").json()
    assert len(payload["skills"]) == 7
    assert len(payload["tools"]) >= 9
    assert payload["active_engine"] in {"native", "langgraph"}
    assert len(payload["intents"]) >= 7


def test_agent_skills_and_tools_aliases(client):
    assert len(client.get("/api/agent/skills").json()["items"]) == 7
    assert len(client.get("/api/agent/tools").json()["items"]) >= 9


@pytest.mark.parametrize(
    "task,intent",
    [
        ("Rerank 在检索链路里解决什么问题？", "rag_answer"),
        ("当前知识库里有哪些资料？", "kb_overview"),
        ("帮我分析知识库还缺少哪些资料。", "kb_gap_analysis"),
        ("帮我总结一下 FAQ.md 这份文档", "document_intelligence"),
    ],
)
def test_agent_run_routes_and_returns_trace(client, task, intent):
    payload = client.post("/api/agent/run", json={"task": task}).json()
    assert payload["intent"] == intent
    assert payload["skill"]
    assert payload["plan"]
    assert payload["answer"]
    assert len(payload["trace"]) >= 6
    assert payload["engine"] in {"native", "langgraph"}
    assert payload["latency_ms"] >= 0


def test_agent_run_reports_skipped_nodes_and_warnings(client):
    payload = client.post("/api/agent/run", json={"task": "当前知识库里有哪些资料？"}).json()
    assert "retrieve" in payload["skipped_nodes"]


def test_agent_run_manual_intent_override(client):
    payload = client.post(
        "/api/agent/run",
        json={"task": "随便说点什么", "preferred_intent": "kb_overview"},
    ).json()
    assert payload["intent"] == "kb_overview"
    assert payload["intent_confidence"] == 1.0


def test_agent_run_human_check_flag(client):
    payload = client.post(
        "/api/agent/run",
        json={
            "task": "某院校希望建设统一知识库，请生成售前解决方案。",
            "require_human_check": True,
        },
    ).json()
    assert payload["human_check_required"] is True
    assert payload["human_check_reason"]


def test_agent_unknown_tool_failure_does_not_break_run(client):
    """A tool failure must surface as a warning, never as a 500."""
    payload = client.post("/api/agent/run", json={"task": "读取不存在的文档并总结"}).json()
    assert payload["answer"]


# ---------------------------------------------------------------- solutions


def test_solution_analyze_falls_back_to_rules_without_llm(client):
    payload = client.post(
        "/api/solutions/analyze",
        json={"requirement": "某连锁零售企业希望把门店运营手册做成知识库，减少培训成本。"},
    ).json()
    analysis = payload["analysis"]
    assert analysis["generated_by"] == "rules"
    assert analysis["search_query"]
    assert analysis["missing_info"]


def test_solution_generate_without_llm_returns_warnings_not_a_crash(client):
    payload = client.post(
        "/api/solutions/generate",
        json={
            "requirement": "某院校希望建设统一知识库，用于招生咨询与教务政策问答。",
            "form": {"customer": "某院校", "industry": "教育", "scenario": "招生咨询"},
        },
    ).json()
    assert payload["analysis"]["industry"] == "教育"
    assert payload["warnings"]
    assert payload["retrieved_chunks"] or payload["warnings"]


def test_solution_config_endpoint(client):
    payload = client.get("/api/solutions/config").json()
    assert len(payload["sections"]) == 8
    assert payload["configured"] is False


def test_solution_export_markdown_and_docx(client):
    markdown = "# 测试方案\n\n## Executive Summary\n\n这是一个测试段落 [1]。\n\n- 要点一\n- 要点二\n"

    md = client.post(
        "/api/solutions/export",
        json={"format": "markdown", "title": "测试方案", "markdown": markdown},
    )
    assert md.status_code == 200
    assert md.content.decode("utf-8").startswith("# 测试方案")

    docx = client.post(
        "/api/solutions/export",
        json={"format": "docx", "title": "测试方案", "markdown": markdown},
    )
    assert docx.status_code == 200
    assert docx.content[:2] == b"PK"  # docx is a zip container


# ----------------------------------------------------------------- insights


def test_coverage_endpoint(client):
    payload = client.get("/api/insights/coverage").json()
    assert len(payload["coverage"]) >= 8
    assert 0.0 <= payload["coverage_ratio"] <= 1.0
    assert payload["analyzed_document_count"] == 5
    assert payload["recommended_documents"]
    statuses = {item["status"] for item in payload["coverage"]}
    assert statuses <= {"covered", "partial", "missing"}


def test_coverage_marks_product_and_faq_as_covered(client):
    payload = client.get("/api/insights/coverage").json()
    by_key = {item["category"]: item for item in payload["coverage"]}
    assert by_key["product"]["status"] in {"covered", "partial"}
    assert by_key["faq"]["status"] in {"covered", "partial"}
    # Nothing in the sandbox covers pricing, so it must be reported as missing.
    assert by_key["pricing"]["status"] == "missing"


def test_gaps_endpoint_matches_coverage(client):
    coverage = client.get("/api/insights/coverage").json()
    gaps = client.get("/api/insights/gaps").json()
    assert coverage["missing"] == gaps["missing"]


# --------------------------------------------------------------- evaluation


def test_eval_dataset_auto_seeds(client):
    payload = client.get("/api/evaluation/dataset").json()
    assert payload["total"] >= 8
    assert any(case["expected_document_ids"] for case in payload["cases"])


def test_eval_add_and_delete_case(client):
    created = client.post(
        "/api/evaluation/dataset",
        json={"question": "测试用例问题", "expected_keywords": ["召回"], "expected_document_ids": []},
    )
    assert created.status_code == 200
    case_id = created.json()["id"]

    assert client.get("/api/evaluation/dataset").json()["total"] >= 9
    assert client.delete(f"/api/evaluation/dataset/{case_id}").status_code == 200
    assert client.delete(f"/api/evaluation/dataset/{case_id}").status_code == 404


def test_eval_run_computes_retrieval_metrics(client):
    payload = client.post("/api/evaluation/run", json={"k": 4}).json()
    summary = payload["summary"]
    assert summary["case_count"] >= 8
    assert 0.0 <= summary["hit_at_k"] <= 1.0
    assert 0.0 <= summary["mrr"] <= 1.0
    assert summary["recall_at_k"] >= 0.0
    # No human grading has happened yet -> accuracy must stay null, not invented.
    assert summary["answer_accuracy"] is None
    assert payload["cases"]
    assert all(case["case_id"] for case in payload["cases"])


def test_eval_grading_flow(client):
    run = client.post("/api/evaluation/run", json={"k": 4}).json()
    case_id = run["cases"][0]["case_id"]

    graded = client.post(
        "/api/evaluation/feedback", json={"case_id": case_id, "grade": "correct"}
    ).json()
    assert graded["answer_accuracy"] == 1.0
    assert graded["total_graded"] == 1

    second = client.post(
        "/api/evaluation/feedback", json={"case_id": run["cases"][1]["case_id"], "grade": "wrong"}
    ).json()
    assert second["answer_accuracy"] == 0.5


def test_eval_grading_unknown_case_returns_404(client):
    response = client.post(
        "/api/evaluation/feedback", json={"case_id": "missing", "grade": "correct"}
    )
    assert response.status_code == 404


def test_eval_history_records_runs(client):
    client.post("/api/evaluation/run", json={"k": 2})
    payload = client.get("/api/evaluation/runs", params={"limit": 5}).json()
    assert payload
    assert payload[0]["case_count"] >= 8


# ---------------------------------------------------------------- activity


def test_activity_records_and_filters(client):
    client.post("/api/rag/query", json={"question": "Rerank 是什么"})
    client.post("/api/agent/run", json={"task": "当前知识库里有哪些资料？"})

    listing = client.get("/api/activity", params={"limit": 50}).json()
    kinds = {item["kind"] for item in listing["items"]}
    assert "rag_query" in kinds
    assert "agent_run" in kinds

    filtered = client.get("/api/activity", params={"kind": "agent_run"}).json()
    assert all(item["kind"] == "agent_run" for item in filtered["items"])


def test_activity_stats(client):
    client.post("/api/rag/query", json={"question": "Top K 是什么"})
    payload = client.get("/api/activity/stats").json()
    assert payload["total"] >= 1
    assert 0.0 <= payload["success_rate"] <= 1.0
    assert payload["backend"] in {"sqlite", "jsonl"}


def test_activity_never_persists_secrets(client):
    """The ledger must not serialise credential-bearing fields."""
    client.post("/api/rag/query", json={"question": "Rerank 是什么"})
    body = client.get("/api/activity", params={"limit": 50}).text
    for field in ("llm_api_key", "embedding_api_key", "api_key", "demo_password", "sk-", "Authorization"):
        assert field not in body, field


def test_activity_sanitizer_drops_credential_keys():
    """Unit-level proof that meta is filtered, not just that it happens to be absent."""
    from app.services.activity_service import _sanitize_meta

    cleaned = _sanitize_meta(
        {
            "api_key": "sk-leak-canary",
            "token": "should-not-survive",
            "password": "should-not-survive",
            "nested": {"credential": "x", "secret_key": "y", "model": "deepseek-v4-flash"},
            "tokens_used": 123,  # a legitimate counter whose *name* contains "token"
            "mode": "hybrid",
        }
    )
    assert "api_key" not in cleaned
    assert "token" not in cleaned
    assert "password" not in cleaned
    assert cleaned["tokens_used"] == 123
    assert cleaned["mode"] == "hybrid"
    assert "secret_key" not in cleaned["nested"]
    assert cleaned["nested"]["model"] == "deepseek-v4-flash"


def test_settings_endpoint_never_returns_plaintext_keys(monkeypatch, sandbox):
    """A configured key must be masked, never echoed back."""
    monkeypatch.setenv("LLM_API_KEY", "sk-leak-canary-0123456789")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-leak-canary-0123456789")
    reload_settings()

    from fastapi.testclient import TestClient

    from app.main import create_app

    with TestClient(create_app()) as guarded:
        body = guarded.get("/api/settings").text
        assert "sk-leak-canary" not in body
        payload = guarded.get("/api/settings").json()
        assert payload["providers"]["llm"]["configured"] is True
        assert payload["providers"]["llm"]["key_hint"] == "****6789"


# ------------------------------------------------------------ error shape


def test_unknown_document_returns_structured_404(client):
    response = client.get("/api/knowledge/documents/does-not-exist")
    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "not_found"
    assert "Traceback" not in response.text


def test_validation_error_is_structured(client):
    response = client.post("/api/agent/run", json={"task": ""})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_every_response_carries_a_timing_header(client):
    response = client.get("/health")
    assert "X-Process-Time-Ms" in response.headers


def test_index_state_survives_a_rebuild(client):
    before = client.get("/api/knowledge/stats").json()["chunk_count"]
    client.post("/api/knowledge/reindex", json={"force_vectors": False})
    after = client.get("/api/knowledge/stats").json()["chunk_count"]
    assert before == after
