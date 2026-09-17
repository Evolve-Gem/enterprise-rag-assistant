"""Logging setup for the V3 backend.

A single :func:`configure_logging` call installs a compact, human-readable
formatter and makes sure uvicorn's loggers share the same format so that a
request can be followed across the ASGI server and the service layer.
"""

from __future__ import annotations

import logging
import sys

_CONFIGURED = False

_FORMAT = "%(asctime)s | %(levelname)-7s | %(name)-34s | %(message)s"
_DATEFMT = "%H:%M:%S"


def configure_logging(level: str = "INFO") -> None:
    """Install the project log format on the root logger (idempotent)."""
    global _CONFIGURED
    root = logging.getLogger()
    if not _CONFIGURED:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter(_FORMAT, datefmt=_DATEFMT))
        root.handlers = [handler]
        _CONFIGURED = True

    root.setLevel(_resolve_level(level))
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logger = logging.getLogger(name)
        logger.handlers = []
        logger.propagate = True
    # Third-party HTTP clients are extremely chatty at INFO.
    for noisy in ("httpx", "httpcore", "openai", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def _resolve_level(level: str) -> int:
    return getattr(logging, str(level).upper(), logging.INFO)


def get_logger(name: str) -> logging.Logger:
    """Return a namespaced logger."""
    return logging.getLogger(name)
