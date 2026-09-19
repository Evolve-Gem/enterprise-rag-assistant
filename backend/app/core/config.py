"""Central, environment-driven configuration for the V3 backend.

Design notes
------------
* Nothing in this project should hard-code an API key, model name, base URL or
  top-k.  Every knob that a deployment might want to change lives here and is
  read from the process environment (optionally seeded by a ``.env`` file).
* ``Settings`` is frozen: configuration is resolved once per process, which
  keeps behaviour reproducible and makes the ``/api/settings`` endpoint cheap.
* ``public_view()`` is the *only* thing the API layer is allowed to expose.
  It never returns secrets, and it never returns raw API keys -- only whether a
  key is present and what its last four characters are.
"""

from __future__ import annotations

import os
from dataclasses import asdict, dataclass
from functools import lru_cache
from pathlib import Path

# ---------------------------------------------------------------------------
# Path resolution
# ---------------------------------------------------------------------------
# backend/app/core/config.py  ->  parents[0]=core [1]=app [2]=backend [3]=<repo>
REPO_ROOT = Path(__file__).resolve().parents[3]

DEFAULT_KB_DIR = REPO_ROOT / "knowledge_base"
DEFAULT_PROMPTS_DIR = REPO_ROOT / "prompts"
DEFAULT_DATA_DIR = REPO_ROOT / "backend" / "data"


def _load_dotenv_once() -> None:
    """Load ``<repo>/.env`` if python-dotenv is available. Never fatal."""
    try:
        from dotenv import load_dotenv
    except ImportError:  # pragma: no cover - dotenv is a declared dependency
        return
    load_dotenv(REPO_ROOT / ".env")


def _env(name: str, default: str = "") -> str:
    """Read an environment variable, treating an empty value as unset."""
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    return value.strip()


def _env_int(name: str, default: int) -> int:
    raw = _env(name)
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    raw = _env(name)
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _env_bool(name: str, default: bool) -> bool:
    raw = _env(name)
    if not raw:
        return default
    return raw.lower() in {"1", "true", "yes", "on"}


def _env_path(name: str, default: Path) -> Path:
    raw = _env(name)
    if not raw:
        return default
    candidate = Path(raw)
    if not candidate.is_absolute():
        candidate = REPO_ROOT / candidate
    return candidate.resolve()


def _mask(secret: str) -> str:
    """Return a non-reversible hint about a secret for the settings endpoint."""
    if not secret:
        return ""
    if len(secret) <= 4:
        return "*" * len(secret)
    return f"****{secret[-4:]}"


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Settings:
    """Immutable, process-wide configuration snapshot."""

    # -- runtime ------------------------------------------------------------
    app_name: str = "Enterprise RAG Copilot"
    app_version: str = "3.0.0"
    environment: str = "development"
    log_level: str = "INFO"
    api_prefix: str = "/api"

    # -- demo guard rails ---------------------------------------------------
    demo_password: str = ""
    demo_read_only: bool = False

    # -- public demo quota guard --------------------------------------------
    # The AI endpoints spend a real token budget, so the password-free demo
    # throttles them per client.  Left off by default: a local run or the test
    # suite must never be rate limited, and an operator opting into the public
    # demo turns it on explicitly.
    rate_limit_enabled: bool = False
    rate_limit_requests: int = 10
    rate_limit_window_seconds: int = 60

    # -- storage ------------------------------------------------------------
    kb_dir: Path = DEFAULT_KB_DIR
    prompts_dir: Path = DEFAULT_PROMPTS_DIR
    prompt_version: str = "v1"
    data_dir: Path = DEFAULT_DATA_DIR

    # -- uploads ------------------------------------------------------------
    max_upload_bytes: int = 8 * 1024 * 1024
    allowed_upload_suffixes: tuple[str, ...] = (".md", ".txt", ".pdf", ".docx")

    # -- LLM ----------------------------------------------------------------
    llm_provider: str = "deepseek"
    llm_api_key: str = ""
    llm_base_url: str = "https://api.deepseek.com"
    llm_model: str = "deepseek-v4-flash"
    llm_timeout_seconds: float = 60.0
    llm_temperature: float = 0.2

    # -- embeddings ---------------------------------------------------------
    # ``hashing`` needs no network and no key: a deterministic hashed
    # character-n-gram TF-IDF projection.  ``openai`` uses any
    # OpenAI-compatible /embeddings endpoint.  ``none`` disables the vector
    # branch entirely (keyword-only retrieval).
    embedding_provider: str = "hashing"
    embedding_api_key: str = ""
    embedding_base_url: str = ""
    embedding_model: str = "text-embedding-3-small"
    embedding_dim: int = 512
    embedding_timeout_seconds: float = 30.0

    # -- vector store -------------------------------------------------------
    # ``numpy``    exact in-process cosine search (default, zero infra)
    # ``pgvector`` PostgreSQL + pgvector (needs DATABASE_URL and psycopg)
    vector_store_backend: str = "numpy"
    database_url: str = ""

    # -- retrieval ----------------------------------------------------------
    retriever_mode: str = "hybrid"  # keyword | vector | hybrid
    retrieval_top_k: int = 8
    rerank_top_k: int = 4
    fusion_strategy: str = "rrf"  # rrf | weighted
    fusion_alpha: float = 0.5  # weight of the vector branch for ``weighted``
    rrf_k: int = 60

    # -- rerank -------------------------------------------------------------
    rerank_provider: str = "heuristic"  # off | heuristic | llm

    # -- chunking -----------------------------------------------------------
    chunk_size: int = 500
    chunk_overlap: int = 100

    # -- agent --------------------------------------------------------------
    agent_engine: str = "auto"  # auto | native | langgraph
    agent_max_steps: int = 12
    agent_allow_general_fallback: bool = True
    agent_require_human_check: bool = False

    # -- observability ------------------------------------------------------
    activity_enabled: bool = True
    activity_backend: str = "sqlite"  # sqlite | jsonl
    activity_max_records: int = 2000

    # -- evaluation ---------------------------------------------------------
    evaluation_dataset_path: Path | None = None

    # -- cors ---------------------------------------------------------------
    cors_origins: tuple[str, ...] = (
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    )

    # ------------------------------------------------------------------
    # Derived helpers
    # ------------------------------------------------------------------
    @property
    def llm_configured(self) -> bool:
        return bool(self.llm_api_key)

    @property
    def embedding_configured(self) -> bool:
        if self.embedding_provider == "hashing":
            return True
        return bool(self.embedding_api_key and self.embedding_base_url)

    @property
    def effective_retriever_mode(self) -> str:
        """Downgrade gracefully when the configured mode cannot be served."""
        mode = self.retriever_mode
        if mode == "vector" and not self.embedding_configured:
            return "keyword"
        if mode == "hybrid" and not self.embedding_configured:
            return "keyword"
        return mode

    @property
    def index_dir(self) -> Path:
        return self.data_dir / "index"

    @property
    def activity_db_path(self) -> Path:
        return self.data_dir / "activity.sqlite3"

    @property
    def activity_jsonl_path(self) -> Path:
        return self.data_dir / "activity.jsonl"

    @property
    def evaluation_dir(self) -> Path:
        return self.data_dir / "evaluation"

    def provider_status(self) -> dict[str, dict[str, object]]:
        """Non-secret status block used by ``/api/settings`` and ``/health``."""
        return {
            "llm": {
                "provider": self.llm_provider,
                "model": self.llm_model,
                "configured": self.llm_configured,
                "key_hint": _mask(self.llm_api_key),
                "base_url": self.llm_base_url,
            },
            "embedding": {
                "provider": self.embedding_provider,
                "model": self.embedding_model
                if self.embedding_provider != "hashing"
                else "hashed-char-ngram-tfidf",
                "configured": self.embedding_configured,
                "key_hint": _mask(self.embedding_api_key),
                "dim": self.embedding_dim,
            },
        }

    def public_view(self) -> dict[str, object]:
        """Everything the frontend may see. Secrets are masked or omitted."""
        return {
            "app": {
                "name": self.app_name,
                "version": self.app_version,
                "environment": self.environment,
            },
            "guard_rails": {
                "password_required": bool(self.demo_password),
                "read_only": self.demo_read_only,
                "rate_limit": {
                    "enabled": self.rate_limit_enabled,
                    "requests": self.rate_limit_requests,
                    "window_seconds": self.rate_limit_window_seconds,
                    "scope": "ai_endpoints",
                },
            },
            "storage": {
                "knowledge_base": str(self.kb_dir),
                "prompts": str(self.prompts_dir),
                "prompt_version": self.prompt_version,
                "data": str(self.data_dir),
            },
            "providers": self.provider_status(),
            "retrieval": {
                "configured_mode": self.retriever_mode,
                "effective_mode": self.effective_retriever_mode,
                "vector_store": self.vector_store_backend,
                "top_k": self.retrieval_top_k,
                "rerank_top_k": self.rerank_top_k,
                "fusion": self.fusion_strategy,
                "rerank_provider": self.rerank_provider,
            },
            "chunking": {
                "chunk_size": self.chunk_size,
                "chunk_overlap": self.chunk_overlap,
            },
            "agent": {
                "engine": resolve_agent_engine(self.agent_engine),
                "requested_engine": self.agent_engine,
                "max_steps": self.agent_max_steps,
                "human_check_required": self.agent_require_human_check,
            },
            "uploads": {
                "max_bytes": self.max_upload_bytes,
                "allowed_suffixes": list(self.allowed_upload_suffixes),
            },
        }

    def as_dict(self) -> dict[str, object]:
        """Full config dump (still secrets-free thanks to ``_mask``)."""
        data = asdict(self)
        data["llm_api_key"] = _mask(self.llm_api_key)
        data["embedding_api_key"] = _mask(self.embedding_api_key)
        data["demo_password"] = "***" if self.demo_password else ""
        for key in ("kb_dir", "prompts_dir", "data_dir"):
            data[key] = str(data[key])
        return data


def _build_settings() -> Settings:
    _load_dotenv_once()

    embedding_provider = _env("EMBEDDING_PROVIDER", "hashing").lower()
    embedding_api_key = _env("EMBEDDING_API_KEY") or _env("OPENAI_API_KEY")
    embedding_base_url = _env("EMBEDDING_BASE_URL")

    # A deployment that supplies an embeddings key but forgets the base URL
    # clearly intends to use a hosted provider -- infer the common default
    # instead of silently falling back to the offline hashing embedder.
    if embedding_provider == "auto":
        embedding_provider = "openai" if (embedding_api_key and embedding_base_url) else "hashing"
    if embedding_provider == "openai" and not embedding_base_url:
        embedding_provider = "hashing"

    origins = _env("CORS_ORIGINS")
    cors = tuple(o.strip() for o in origins.split(",") if o.strip()) if origins else Settings.cors_origins

    suffixes = _env("ALLOWED_UPLOAD_SUFFIXES")

    return Settings(
        app_name=_env("APP_NAME", "Enterprise RAG Copilot"),
        app_version=_env("APP_VERSION", "3.0.0"),
        environment=_env("ENVIRONMENT", "development").lower(),
        log_level=_env("LOG_LEVEL", "INFO").upper(),
        api_prefix=_env("API_PREFIX", "/api"),
        demo_password=_env("DEMO_PASSWORD"),
        demo_read_only=_env_bool("DEMO_READ_ONLY", False),
        rate_limit_enabled=_env_bool("RATE_LIMIT_ENABLED", False),
        rate_limit_requests=_env_int("RATE_LIMIT_REQUESTS", 10),
        rate_limit_window_seconds=_env_int("RATE_LIMIT_WINDOW_SECONDS", 60),
        kb_dir=_env_path("KB_DIR", DEFAULT_KB_DIR),
        prompts_dir=_env_path("PROMPTS_DIR", DEFAULT_PROMPTS_DIR),
        prompt_version=_env("PROMPT_VERSION", "v1"),
        data_dir=_env_path("DATA_DIR", DEFAULT_DATA_DIR),
        max_upload_bytes=_env_int("MAX_UPLOAD_BYTES", 8 * 1024 * 1024),
        allowed_upload_suffixes=tuple(
            s.strip().lower() for s in suffixes.split(",") if s.strip()
        )
        if suffixes
        else Settings.allowed_upload_suffixes,
        llm_provider=_env("LLM_PROVIDER", "deepseek").lower(),
        llm_api_key=_env("LLM_API_KEY") or _env("DEEPSEEK_API_KEY"),
        llm_base_url=_env("LLM_BASE_URL", "https://api.deepseek.com"),
        llm_model=_env("LLM_MODEL", "deepseek-v4-flash"),
        llm_timeout_seconds=_env_float("LLM_TIMEOUT_SECONDS", 60.0),
        llm_temperature=_env_float("LLM_TEMPERATURE", 0.2),
        embedding_provider=embedding_provider,
        embedding_api_key=embedding_api_key,
        embedding_base_url=embedding_base_url,
        embedding_model=_env("EMBEDDING_MODEL", "text-embedding-3-small"),
        embedding_dim=_env_int("EMBEDDING_DIM", 512),
        embedding_timeout_seconds=_env_float("EMBEDDING_TIMEOUT_SECONDS", 30.0),
        vector_store_backend=_env("VECTOR_STORE", "numpy").lower(),
        database_url=_env("DATABASE_URL"),
        retriever_mode=_env("RETRIEVER_MODE", "hybrid").lower(),
        retrieval_top_k=_env_int("RETRIEVAL_TOP_K", 8),
        rerank_top_k=_env_int("RERANK_TOP_K", 4),
        fusion_strategy=_env("FUSION_STRATEGY", "rrf").lower(),
        fusion_alpha=_env_float("FUSION_ALPHA", 0.5),
        rrf_k=_env_int("RRF_K", 60),
        rerank_provider=_env("RERANK_PROVIDER", "heuristic").lower(),
        chunk_size=_env_int("CHUNK_SIZE", 500),
        chunk_overlap=_env_int("CHUNK_OVERLAP", 100),
        agent_engine=_env("AGENT_ENGINE", "auto").lower(),
        agent_max_steps=_env_int("AGENT_MAX_STEPS", 12),
        agent_allow_general_fallback=_env_bool("AGENT_ALLOW_GENERAL_FALLBACK", True),
        agent_require_human_check=_env_bool("AGENT_REQUIRE_HUMAN_CHECK", False),
        activity_enabled=_env_bool("ACTIVITY_ENABLED", True),
        activity_backend=_env("ACTIVITY_BACKEND", "sqlite").lower(),
        activity_max_records=_env_int("ACTIVITY_MAX_RECORDS", 2000),
        evaluation_dataset_path=_env_path("EVAL_DATASET", DEFAULT_DATA_DIR / "evaluation" / "eval_dataset.json"),
        cors_origins=cors,
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the process-wide settings singleton."""
    return _build_settings()


def reload_settings() -> Settings:
    """Drop the cache (used by tests)."""
    get_settings.cache_clear()
    return get_settings()


def resolve_agent_engine(requested: str | None = None) -> str:
    """Return the agent engine that is actually usable in this process.

    ``auto`` prefers LangGraph when the package is importable and falls back to
    the built-in native state machine otherwise.  The frontend surfaces this so
    the Settings page never claims a capability the process cannot serve.
    """
    requested = (requested or get_settings().agent_engine or "auto").lower()
    if requested == "native":
        return "native"
    if requested == "langgraph":
        return "langgraph" if langgraph_available() else "native"
    return "langgraph" if langgraph_available() else "native"


@lru_cache(maxsize=1)
def langgraph_available() -> bool:
    """Whether ``langgraph`` can be imported in this interpreter."""
    try:  # pragma: no cover - depends on the deployment environment
        import langgraph  # noqa: F401
    except Exception:
        return False
    return True


def ensure_runtime_dirs(settings: Settings | None = None) -> None:
    """Create the writable runtime directories the backend needs."""
    settings = settings or get_settings()
    for path in (
        settings.data_dir,
        settings.index_dir,
        settings.evaluation_dir,
        settings.kb_dir,
    ):
        path.mkdir(parents=True, exist_ok=True)
