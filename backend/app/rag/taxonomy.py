"""Knowledge taxonomy: one definition used by classification *and* gap analysis.

Keeping a single source of truth matters -- the Insight page claim "Pricing is
missing" must be provable from the same keyword set that classifies documents,
otherwise the two views can disagree and neither can be trusted.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .text import normalize


@dataclass(frozen=True)
class CategorySpec:
    """Definition of one knowledge category."""

    key: str
    label: str
    description: str
    # Keywords matched against the file *name* (a strong signal).
    filename_keywords: tuple[str, ...] = ()
    # Keywords matched against the document *body* (a weaker signal).
    content_keywords: tuple[str, ...] = ()
    # Whether a presales knowledge base is expected to cover this category.
    expected: bool = True
    suggested_titles: tuple[str, ...] = field(default_factory=tuple)


CATEGORIES: tuple[CategorySpec, ...] = (
    CategorySpec(
        key="product",
        label="产品介绍",
        description="产品定位、能力清单、模块划分等技术资料",
        filename_keywords=("产品介绍", "产品", "能力清单", "功能清单", "product"),
        content_keywords=("产品定位", "产品能力", "核心功能", "功能模块", "产品架构"),
        suggested_titles=("《产品能力总览》", "《产品模块与功能清单》"),
    ),
    CategorySpec(
        key="faq",
        label="FAQ / 常见问题",
        description="高频问答、异议处理话术",
        filename_keywords=("faq", "常见问题", "问答", "疑问"),
        content_keywords=("常见问题", "faq", "如何解决", "为什么要用"),
        suggested_titles=("《售前高频问答 FAQ》", "《客户异议处理话术》"),
    ),
    CategorySpec(
        key="case",
        label="成功案例",
        description="已交付客户案例、成果数据",
        filename_keywords=("成功案例", "案例", "客户故事", "case"),
        content_keywords=("客户案例", "成功案例", "已上线", "落地效果", "客户名称"),
        suggested_titles=("《行业标杆案例集》", "《客户成功故事与量化收益》"),
    ),
    CategorySpec(
        key="industry_solution",
        label="行业解决方案",
        description="面向具体行业的方案模板与最佳实践",
        filename_keywords=("行业解决方案", "解决方案", "行业方案", "solution"),
        content_keywords=("行业解决方案", "行业场景", "最佳实践", "标杆方案"),
        suggested_titles=("《行业解决方案模板库》", "《行业场景与方案匹配矩阵》"),
    ),
    CategorySpec(
        key="pricing",
        label="价格 / 报价说明",
        description="报价口径、计费方式、折扣政策",
        filename_keywords=("价格", "报价", "计费", "商务", "pricing", "cost"),
        content_keywords=("报价", "计费方式", "价格区间", "商务条款", "license"),
        suggested_titles=("《产品报价与计费口径》", "《商务条款与折扣政策》"),
    ),
    CategorySpec(
        key="implementation",
        label="实施流程",
        description="交付方法论、实施步骤、里程碑",
        filename_keywords=("实施", "交付", "上线", "部署", "implementation"),
        content_keywords=("实施步骤", "实施周期", "交付流程", "上线计划", "验收标准"),
        suggested_titles=("《标准实施方法论与里程碑》", "《交付验收checklist》"),
    ),
    CategorySpec(
        key="support",
        label="售后支持",
        description="SLA、运维支持、培训体系",
        filename_keywords=("售后", "支持", "运维", "培训", "sla"),
        content_keywords=("售后支持", "运维服务", "sla", "培训体系", "服务等级"),
        suggested_titles=("《售后服务与 SLA 说明》", "《客户培训与赋能体系》"),
    ),
    CategorySpec(
        key="competitor",
        label="竞品对比",
        description="竞品分析、差异化优势、对比表",
        filename_keywords=("竞品", "对比", "差异化", "competitor"),
        content_keywords=("竞品", "对比分析", "差异化优势", "市场份额"),
        suggested_titles=("《竞品对比矩阵》", "《差异化优势说明》"),
    ),
    CategorySpec(
        key="customer_requirements",
        label="客户需求模板",
        description="需求调研表、需求拆解模板",
        filename_keywords=("需求模板", "调研表", "需求清单", "requirement"),
        content_keywords=("需求调研", "需求模板", "需求拆解", "调研问卷"),
        suggested_titles=("《客户需求调研表》", "《需求拆解与优先级模板》"),
    ),
    CategorySpec(
        key="agent_knowledge",
        label="AI / Agent 方法论",
        description="RAG、Agent、Prompt、MCP 等技术与方法论沉淀",
        filename_keywords=("agent", "rag", "mcp", "prompt", "yaml", "harness", "workflow", "skill", "tool", "evaluation", "llm"),
        content_keywords=("检索增强", "rerank", "tool calling", "智能体", "提示词", "向量检索"),
        suggested_titles=("《RAG 工程实践手册》", "《Agent 与 Skill 设计规范》"),
    ),
    CategorySpec(
        key="glossary",
        label="术语表",
        description="统一术语与口径，降低沟通成本",
        filename_keywords=("术语", "词汇表", "glossary", "口径"),
        content_keywords=("术语表", "名词解释", "统一口径"),
        suggested_titles=("《产品与行业术语表》",),
    ),
)

OTHER_CATEGORY = CategorySpec(
    key="other",
    label="其他资料",
    description="不属于上述分类的补充资料",
    expected=False,
)

CATEGORY_BY_KEY: dict[str, CategorySpec] = {spec.key: spec for spec in CATEGORIES}
CATEGORY_BY_KEY[OTHER_CATEGORY.key] = OTHER_CATEGORY
EXPECTED_CATEGORIES: tuple[CategorySpec, ...] = tuple(spec for spec in CATEGORIES if spec.expected)


def category_label(key: str) -> str:
    """Human label for a category key."""
    spec = CATEGORY_BY_KEY.get(key)
    return spec.label if spec else OTHER_CATEGORY.label


def classify_document(name: str, content: str = "") -> tuple[str, list[str]]:
    """Classify a document into one category using filename then body evidence.

    Returns the category key and the keywords that matched, so the UI can show
    *why* a document was classified that way.
    """
    file_name = normalize(name)
    body = normalize(content[:4000]) if content else ""

    best_key = OTHER_CATEGORY.key
    best_matches: list[str] = []
    best_weight = 0.0

    for spec in CATEGORIES:
        matches: list[str] = []
        weight = 0.0

        for keyword in spec.filename_keywords:
            needle = normalize(keyword)
            if needle and needle in file_name:
                matches.append(keyword)
                weight += 3.0  # filename hits are decisive

        for keyword in spec.content_keywords:
            needle = normalize(keyword)
            if needle and needle in body:
                matches.append(keyword)
                weight += 1.0

        if weight > best_weight:
            best_weight = weight
            best_key = spec.key
            best_matches = matches

    return best_key, best_matches


def derive_tags(name: str, content: str, category: str, *, limit: int = 6) -> list[str]:
    """Derive a few display tags from the filename and matched category."""
    _, matched = classify_document(name, content)
    tags: list[str] = []
    spec = CATEGORY_BY_KEY.get(category)
    if spec:
        tags.append(spec.label)
    for keyword in matched:
        if keyword not in tags:
            tags.append(keyword)
        if len(tags) >= limit:
            break
    return tags


def build_summary(content: str, *, max_chars: int = 220) -> str:
    """Build a deterministic summary: the first substantive lines of a document.

    Deliberately *not* model-generated -- the UI labels this as 「摘要」 derived
    from the opening paragraphs, so it can never contradict the source.
    """
    if not content:
        return ""

    lines: list[str] = []
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith(("#", ">", "---", "```", "|")):
            continue
        if line.startswith(("-", "*", "+")):
            line = line.lstrip("-*+ ").strip()
        if len(line) < 8:
            continue
        lines.append(line)
        if sum(len(item) for item in lines) >= max_chars:
            break

    summary = " ".join(lines)
    if len(summary) > max_chars:
        summary = summary[:max_chars].rstrip() + "…"
    return summary


def extract_outline(content: str, *, limit: int = 40) -> list[str]:
    """Return the Markdown heading outline of a document."""
    outline: list[str] = []
    for line in (content or "").splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            hashes = len(stripped) - len(stripped.lstrip("#"))
            if 1 <= hashes <= 6:
                title = stripped[hashes:].strip()
                if title:
                    outline.append(title)
        if len(outline) >= limit:
            break
    return outline
