"""Customer requirement analysis.

Two paths, both honest about which one ran:

``llm``
    The configured chat model is asked for a strict JSON requirement profile
    (see ``prompts/v1/requirement_analysis.md``).

``rules``
    A deterministic extractor used when no model is configured or the model
    call fails.  It only ever quotes/derives from the customer's own words --
    it never invents an industry, budget or timeline.  ``generated_by`` is
    reported to the UI so the user always knows which path produced the output.
"""

from __future__ import annotations

import json
import re

from ..core.config import Settings, get_settings
from ..core.logging import get_logger
from ..rag.llm import get_llm_client
from ..rag.prompts import get_prompt_library
from ..rag.text import normalize
from ..schemas.solution import RequirementAnalysis

logger = get_logger("app.services.requirement")

_JSON_BLOCK = re.compile(r"\{.*\}", re.DOTALL)
_CLAUSE_SPLIT = re.compile(r"[。！？；\n\r]+|(?<=[，,])")

# Keyword tables are intentionally small and explicit -- they are matched
# against the customer's own text, never used to guess.
_INDUSTRY_KEYWORDS: tuple[tuple[str, str], ...] = (
    ("教育", "教育"), ("院校", "教育"), ("学校", "教育"), ("高校", "教育"), ("大学", "教育"),
    ("职教", "教育"), ("培训", "教育 / 培训"),
    ("制造", "制造业"), ("工厂", "制造业"), ("产线", "制造业"), ("供应链", "供应链 / 制造"),
    ("零售", "零售"), ("连锁", "零售 / 连锁"), ("门店", "零售 / 连锁"), ("商超", "零售"),
    ("金融", "金融"), ("银行", "金融"), ("保险", "金融"), ("证券", "金融"),
    ("医疗", "医疗健康"), ("医院", "医疗健康"), ("药", "医疗健康"),
    ("政务", "政务"), ("政府", "政务"),
    ("互联网", "互联网"), ("软件", "软件 / IT 服务"), ("科技", "科技"),
    ("快消", "快消品"), ("饮料", "快消品"), ("食品", "快消品"),
    ("能源", "能源"), ("物流", "物流"),
)

_CUSTOMER_TYPE_KEYWORDS: tuple[tuple[str, str], ...] = (
    ("职业院校", "职业院校"), ("院校", "院校"), ("学校", "学校"), ("大学", "高校"),
    ("集团", "集团型企业"), ("连锁", "连锁企业"), ("中小企业", "中小企业"),
    ("我们公司", "企业客户"), ("公司", "企业客户"), ("部门", "企业内部部门"),
    ("政府", "政府机构"), ("医院", "医疗机构"), ("银行", "金融机构"),
)

_NEED_MARKERS = ("需要", "希望", "要求", "想要", "期望", "应该", "必须", "计划", "打算", "目标是", "想要")
_PAIN_MARKERS = (
    "问题", "痛点", "难", "慢", "分散", "不一致", "找不到", "重复", "成本高", "效率低",
    "负担", "繁琐", "混乱", "靠人", "人工", "口径不一", "查不到", "遗漏",
)
_CONSTRAINT_MARKERS = (
    "预算", "工期", "上线时间", "合规", "安全", "私有化", "内网", "限制", "必须",
    "不能", "不允许", "周期", "资源", "人力",
)
_SCENARIO_MARKERS = ("场景", "用于", "用来", "面向", "业务", "流程", "咨询", "问答", "检索")


def _clauses(text: str) -> list[str]:
    parts = [part.strip(" ，,、;；") for part in _CLAUSE_SPLIT.split(text or "")]
    return [part for part in parts if len(part) >= 4]


def _pick(markers: tuple[str, ...], clauses: list[str], limit: int) -> list[str]:
    picked: list[str] = []
    for clause in clauses:
        if any(marker in clause for marker in markers) and clause not in picked:
            picked.append(clause)
        if len(picked) >= limit:
            break
    return picked


def _match_industry(text: str) -> str:
    for keyword, label in _INDUSTRY_KEYWORDS:
        if keyword in text:
            return label
    return ""


def _match_customer_type(text: str) -> str:
    for keyword, label in _CUSTOMER_TYPE_KEYWORDS:
        if keyword in text:
            return label
    return ""


def _rule_based_analysis(requirement: str) -> RequirementAnalysis:
    """Deterministic extraction from the customer's own wording."""
    text = requirement or ""
    clauses = _clauses(text)

    industry = _match_industry(text)
    customer_type = _match_customer_type(text)

    core_needs = _pick(_NEED_MARKERS, clauses, 5)
    if not core_needs:
        core_needs = clauses[:3]

    pain_points = _pick(_PAIN_MARKERS, clauses, 4)
    constraints = _pick(_CONSTRAINT_MARKERS, clauses, 4)
    scenario_clauses = _pick(_SCENARIO_MARKERS, clauses, 1)
    scenario = scenario_clauses[0] if scenario_clauses else ""

    missing: list[str] = []
    if not industry:
        missing.append("客户所属行业与业务规模？")
    if not _pick(("预算", "费用", "投入"), clauses, 1):
        missing.append("项目预算区间与采购方式？")
    if not _pick(("上线", "工期", "周期", "时间"), clauses, 1):
        missing.append("期望上线时间与验收节点？")
    if not _pick(("用户", "人用", "并发", "规模", "部门"), clauses, 1):
        missing.append("系统使用人数与并发规模？")
    if not _pick(("对接", "集成", "接口", "系统"), clauses, 1):
        missing.append("需要对接的现有系统与数据来源？")

    direction_parts = []
    if industry:
        direction_parts.append(f"面向{industry}场景")
    if core_needs:
        direction_parts.append(f"优先解决「{core_needs[0][:30]}」")
    if pain_points:
        direction_parts.append(f"缓解「{pain_points[0][:30]}」")
    recommended = "；".join(direction_parts) + "。" if direction_parts else "需要补充更多信息后才能给出方向建议。"

    keyword_pool = " ".join([industry, customer_type, scenario, *core_needs[:2], *pain_points[:2]])
    search_query = " ".join(dict.fromkeys(keyword_pool.split()))[:120] or text[:80]

    return RequirementAnalysis(
        customer_type=customer_type,
        industry=industry,
        scenario=scenario,
        core_needs=core_needs,
        pain_points=pain_points,
        constraints=constraints,
        missing_info=missing,
        recommended_direction=recommended,
        search_query=search_query,
        raw_text=text,
        generated_by="rules",
    )


def _coerce_list(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [part.strip() for part in re.split(r"[；;\n]", value) if part.strip()]
    return []


def _parse_llm_analysis(raw: str, requirement: str) -> RequirementAnalysis | None:
    match = _JSON_BLOCK.search(raw or "")
    if not match:
        return None
    try:
        payload = json.loads(match.group(0))
    except json.JSONDecodeError:
        # Models occasionally emit single quotes or trailing commas.
        cleaned = re.sub(r",\s*([}\]])", r"\1", match.group(0).replace("'", '"'))
        try:
            payload = json.loads(cleaned)
        except json.JSONDecodeError:
            return None
    if not isinstance(payload, dict):
        return None

    return RequirementAnalysis(
        customer_type=str(payload.get("customer_type") or ""),
        industry=str(payload.get("industry") or ""),
        scenario=str(payload.get("scenario") or ""),
        core_needs=_coerce_list(payload.get("core_needs")),
        pain_points=_coerce_list(payload.get("pain_points")),
        constraints=_coerce_list(payload.get("constraints")),
        missing_info=_coerce_list(payload.get("missing_info")),
        recommended_direction=str(payload.get("recommended_direction") or ""),
        search_query=str(payload.get("search_query") or ""),
        raw_text=requirement,
        generated_by="llm",
    )


def analyze_requirement(
    requirement: str,
    *,
    settings: Settings | None = None,
    prefer_llm: bool = True,
) -> RequirementAnalysis:
    """Analyse a customer requirement, preferring the model when available."""
    settings = settings or get_settings()
    requirement = (requirement or "").strip()

    if not requirement:
        return RequirementAnalysis(raw_text="", generated_by="rules")

    fallback = _rule_based_analysis(requirement)
    if not prefer_llm:
        return fallback

    client = get_llm_client(settings)
    if not client.configured:
        logger.info("No LLM configured; using rule-based requirement analysis.")
        return fallback

    try:
        system, user = get_prompt_library(settings).render(
            "requirement_analysis", requirement=requirement
        )
    except Exception as exc:
        logger.warning("requirement_analysis prompt unavailable: %s", exc)
        return fallback

    completion = client.complete(system=system, user=user, temperature=0.1, json_mode=True)
    if not completion.ok:
        logger.warning("Requirement analysis LLM call failed: %s", completion.error)
        return fallback

    parsed = _parse_llm_analysis(completion.text, requirement)
    if parsed is None:
        logger.warning("Requirement analysis returned unparsable JSON; using rules.")
        return fallback

    # Fill gaps the model left empty with rule-based evidence rather than
    # leaving the field blank -- but never overwrite what the model produced.
    if not parsed.search_query:
        parsed.search_query = fallback.search_query
    if not parsed.industry:
        parsed.industry = fallback.industry
    if not parsed.customer_type:
        parsed.customer_type = fallback.customer_type
    return parsed


def form_to_text(form) -> str:
    """Serialise the structured intake form into the requirement prose."""
    parts: list[str] = []
    if form.customer:
        parts.append(f"客户：{form.customer}")
    if form.industry:
        parts.append(f"行业：{form.industry}")
    if form.scenario:
        parts.append(f"业务场景：{form.scenario}")
    if form.pain_points:
        parts.append(f"主要痛点：{form.pain_points}")
    if form.requirements:
        parts.append(f"核心需求：{form.requirements}")
    if form.constraints:
        parts.append(f"约束条件：{form.constraints}")
    return "\n".join(parts)


def build_requirement_text(requirement: str, form=None) -> str:
    """Combine the free-text box and the structured form."""
    pieces = [(requirement or "").strip()]
    if form is not None:
        form_text = form_to_text(form).strip()
        if form_text:
            pieces.append(form_text)
    return "\n\n".join(piece for piece in pieces if piece)


def keyword_terms(text: str, limit: int = 12) -> list[str]:
    """Display-only keywords extracted from a requirement."""
    tokens = [token for token in normalize(text).split(" ") if len(token) >= 2]
    return tokens[:limit]
