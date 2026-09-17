"""Security helpers: upload hygiene, path containment and demo guard rails."""

from __future__ import annotations

import hmac
import re
import unicodedata
from pathlib import Path

from .config import Settings, get_settings
from .errors import (
    FileTooLargeError,
    InvalidRequestError,
    ReadOnlyError,
    UnsupportedFileError,
)

# Characters that are safe in a stored filename. Everything else is collapsed
# into an underscore so that no shell/OS metacharacter can survive an upload.
_UNSAFE_CHARS = re.compile(r"[^0-9A-Za-z\u4e00-\u9fff\u3040-\u30ff._-]+")
_WINDOWS_RESERVED = {
    "CON", "PRN", "AUX", "NUL",
    *(f"COM{i}" for i in range(1, 10)),
    *(f"LPT{i}" for i in range(1, 10)),
}


def is_read_only(settings: Settings | None = None) -> bool:
    """Whether knowledge-base mutations must be refused."""
    return (settings or get_settings()).demo_read_only


def assert_writable(settings: Settings | None = None) -> None:
    """Raise :class:`ReadOnlyError` when the demo is in read-only mode."""
    if is_read_only(settings):
        raise ReadOnlyError()


def verify_demo_password(candidate: str, settings: Settings | None = None) -> bool:
    """Constant-time comparison against ``DEMO_PASSWORD``."""
    settings = settings or get_settings()
    expected = settings.demo_password
    if not expected:
        return True  # no password configured -> open (local) demo
    return hmac.compare_digest(candidate or "", expected)


def password_required(settings: Settings | None = None) -> bool:
    return bool((settings or get_settings()).demo_password)


def sanitize_filename(raw_name: str) -> str:
    """Return a filesystem-safe basename derived from a user-supplied name.

    The function is deliberately conservative: unicode is normalised, directory
    separators and traversal sequences are stripped, reserved device names are
    neutralised and the result is bounded in length.
    """
    if not raw_name:
        raise InvalidRequestError("上传文件名无效。")

    # Strip any directory component, including Windows-style separators.
    basename = raw_name.replace("\\", "/").split("/")[-1]
    basename = unicodedata.normalize("NFKC", basename).strip().strip(".")

    if not basename or basename in {".", ".."}:
        raise InvalidRequestError("上传文件名无效。")

    suffix = Path(basename).suffix.lower()
    stem = Path(basename).stem

    stem = _UNSAFE_CHARS.sub("_", stem).strip("_.")
    if not stem:
        stem = "document"
    if stem.upper() in _WINDOWS_RESERVED:
        stem = f"_{stem}"

    if len(stem) > 80:
        stem = stem[:80]

    return f"{stem}{suffix}"


def validate_upload(filename: str, size_bytes: int, settings: Settings | None = None) -> str:
    """Validate suffix and size, returning the sanitized filename."""
    settings = settings or get_settings()

    suffix = Path(filename).suffix.lower()
    allowed = settings.allowed_upload_suffixes
    if suffix not in allowed:
        raise UnsupportedFileError(
            f"仅支持上传 {'、'.join(allowed)} 文件。",
            details={"suffix": suffix, "allowed": list(allowed)},
        )

    if size_bytes <= 0:
        raise InvalidRequestError("上传文件为空。")
    if size_bytes > settings.max_upload_bytes:
        raise FileTooLargeError(
            f"文件超过 {settings.max_upload_bytes // (1024 * 1024)} MB 上限。",
            details={"size_bytes": size_bytes, "max_bytes": settings.max_upload_bytes},
        )

    return sanitize_filename(filename)


def resolve_within(base_dir: Path, candidate: str | Path) -> Path:
    """Resolve ``candidate`` and guarantee it stays inside ``base_dir``.

    Blocks ``..`` traversal, absolute escapes and symlink escapes.  Raises
    :class:`InvalidRequestError` when containment fails.
    """
    base = Path(base_dir).resolve()
    raw = Path(candidate)
    if not raw.is_absolute():
        raw = base / raw

    try:
        resolved = raw.resolve()
    except OSError as exc:  # pragma: no cover - defensive
        raise InvalidRequestError("文件路径无法解析。") from exc

    if resolved != base and base not in resolved.parents:
        raise InvalidRequestError(
            "文件路径不在知识库目录内，已拒绝操作。",
            details={"candidate": str(candidate)},
        )
    return resolved


def unique_target_path(directory: Path, filename: str) -> Path:
    """Return a non-colliding path inside ``directory`` for ``filename``."""
    from datetime import datetime

    directory = Path(directory)
    target = directory / filename
    if not target.exists():
        return target

    stem = Path(filename).stem
    suffix = Path(filename).suffix
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    candidate = directory / f"{stem}_{stamp}{suffix}"
    index = 2
    while candidate.exists():
        candidate = directory / f"{stem}_{stamp}_{index}{suffix}"
        index += 1
    return candidate
