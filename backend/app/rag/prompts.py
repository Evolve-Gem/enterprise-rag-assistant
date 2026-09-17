"""Runtime prompt loading with explicit versioning.

Prompts used to be f-strings buried in ``rag/chains.py``.  They now live in
``prompts/<version>/*.md`` and are loaded at runtime, so a prompt change is a
reviewable diff in a Markdown file instead of a silent code edit.

File format
-----------
Each template is a Markdown file with two top-level sections::

    # rag_answer

    > 基于检索片段生成有引用的知识库回答

    ## System Prompt
    ...system text...

    ## User Prompt
    ...user text with {{placeholders}}...

Placeholders use ``{{name}}`` syntax -- deliberately *not* ``str.format`` --
because prompt bodies routinely contain literal JSON braces.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from ..core.config import Settings, get_settings
from ..core.errors import AppError
from ..core.logging import get_logger

logger = get_logger("app.rag.prompts")

_SYSTEM_HEADING = re.compile(r"^##\s+System Prompt\s*$", re.IGNORECASE | re.MULTILINE)
_USER_HEADING = re.compile(r"^##\s+User Prompt\s*$", re.IGNORECASE | re.MULTILINE)
_TITLE = re.compile(r"^#\s+(.*)$", re.MULTILINE)
_BLOCKQUOTE = re.compile(r"^>\s?(.*)$", re.MULTILINE)
_PLACEHOLDER = re.compile(r"\{\{\s*([A-Za-z0-9_]+)\s*\}\}")


class PromptNotFoundError(AppError):
    code = "prompt_not_found"
    status_code = 500
    message = "Prompt 模板缺失，请检查 prompts 目录。"


@dataclass
class PromptTemplate:
    """A parsed, versioned prompt."""

    name: str
    version: str
    path: Path
    system: str
    user: str
    description: str = ""
    placeholders: list[str] = field(default_factory=list)

    def render(self, **values: object) -> tuple[str, str]:
        """Substitute ``{{placeholder}}`` occurrences in both sections."""
        missing = [key for key in self.placeholders if key not in values]
        if missing:
            logger.warning("Prompt %s missing placeholders: %s", self.name, missing)

        def substitute(text: str) -> str:
            def replacer(match: re.Match[str]) -> str:
                key = match.group(1)
                if key not in values:
                    return match.group(0)
                value = values[key]
                return value if isinstance(value, str) else str(value)

            return _PLACEHOLDER.sub(replacer, text)

        return substitute(self.system).strip(), substitute(self.user).strip()


class PromptLibrary:
    """Loads and caches every template for one prompt version."""

    def __init__(self, directory: Path, version: str) -> None:
        self.directory = Path(directory) / version
        self.version = version
        self._cache: dict[str, PromptTemplate] = {}

    # ------------------------------------------------------------------
    def _parse(self, path: Path) -> PromptTemplate:
        raw = path.read_text(encoding="utf-8")
        name = path.stem

        title = _TITLE.search(raw)
        description = ""
        quote = _BLOCKQUOTE.search(raw)
        if quote:
            description = quote.group(1).strip()
        elif title:
            description = title.group(1).strip()

        system_match = _SYSTEM_HEADING.search(raw)
        user_match = _USER_HEADING.search(raw)

        if system_match and user_match:
            system = raw[system_match.end() : user_match.start()]
            user = raw[user_match.end() :]
        elif system_match:
            system = raw[system_match.end() :]
            user = ""
        else:
            # A template without explicit sections is treated as a user prompt.
            system = ""
            user = raw

        template = PromptTemplate(
            name=name,
            version=self.version,
            path=path,
            system=system.strip(),
            user=user.strip(),
            description=description,
        )
        template.placeholders = sorted(
            {
                match.group(1)
                for match in _PLACEHOLDER.finditer(f"{template.system}\n{template.user}")
            }
        )
        return template

    # ------------------------------------------------------------------
    def get(self, name: str) -> PromptTemplate:
        """Return a template, loading it on first use."""
        cached = self._cache.get(name)
        if cached is not None:
            return cached

        path = self.directory / f"{name}.md"
        if not path.exists():
            raise PromptNotFoundError(
                f"未找到 Prompt 模板 {name}（版本 {self.version}）。",
                details={"expected_path": str(path)},
            )
        template = self._parse(path)
        self._cache[name] = template
        return template

    def render(self, name: str, **values: object) -> tuple[str, str]:
        """Shortcut for :meth:`PromptTemplate.render`."""
        return self.get(name).render(**values)

    def names(self) -> list[str]:
        if not self.directory.exists():
            return []
        return sorted(path.stem for path in self.directory.glob("*.md"))

    def describe(self) -> list[dict[str, object]]:
        """Inventory used by the Settings page and by /health."""
        if not self.directory.exists():
            return []
        inventory: list[dict[str, object]] = []
        for path in sorted(self.directory.glob("*.md")):
            template = self._parse(path)
            inventory.append(
                {
                    "name": template.name,
                    "version": template.version,
                    "description": template.description,
                    "placeholders": template.placeholders,
                    "path": str(path.relative_to(self.directory.parent)),
                }
            )
        return inventory


@lru_cache(maxsize=8)
def _cached_library(directory: str, version: str) -> PromptLibrary:
    return PromptLibrary(Path(directory), version)


def get_prompt_library(settings: Settings | None = None) -> PromptLibrary:
    """Return the cached prompt library for the configured version."""
    settings = settings or get_settings()
    return _cached_library(str(settings.prompts_dir), settings.prompt_version)


def render_prompt(name: str, **values: object) -> tuple[str, str]:
    """Render a prompt from the active library."""
    return get_prompt_library().render(name, **values)
