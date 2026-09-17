"""Intent routing.

The previous implementation was a chain of ``if keyword in task`` checks with
no confidence, no explanation and no visibility into runner-up intents.  This
router keeps the rule-based approach -- it is deterministic, free, testable and
auditable, which matters far more than sophistication for a closed
seven-intent domain -- but makes it *explicable*:

* every intent carries weighted keywords rather than a flat list,
* the winning score is normalised into a confidence in ``[0, 1]``,
* the runner-up candidates are returned so the Agent Trace can show why a
  different intent lost,
* an explicit ``preferred_intent`` (the "执行模式" selector in the UI) always
  wins and is marked as manually overridden.

A model-based router would be the next step, but a model that cannot explain
itself is worse than a rule that can.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from ..schemas.agent import IntentDecision


@dataclass(frozen=True)
class IntentRule:
    """Weighted keyword rule for one intent."""

    intent: str
    skill: str
    label: str
    # (keyword, weight).  Weight 3 = decisive phrase, 2 = strong, 1 = weak hint.
    keywords: tuple[tuple[str, int], ...] = field(default_factory=tuple)


INTENT_RULES: tuple[IntentRule, ...] = (
    IntentRule(
        intent="agent_optimization",
        skill="agent_optimization_skill",
        label="Agent 化优化建议",
        keywords=(
            ("agent 优化", 3), ("agent优化", 3), ("怎么用 agent", 3), ("怎么用agent", 3),
            ("agent 化", 3), ("agent化", 3), ("怎么做成 agent", 3), ("怎么做成agent", 3),
            ("往 agent 方向", 3), ("往agent方向", 3), ("还能怎么升级", 2), ("还能怎么优化", 2),
            ("工作流优化", 2), ("skill 优化", 2), ("skill优化", 2), ("tool 优化", 2),
            ("tool优化", 2), ("trace 优化", 2), ("trace优化", 2), ("项目改进", 2),
            ("升级建议", 2), ("下一步优化", 2),
        ),
    ),
    IntentRule(
        intent="kb_gap_analysis",
        skill="gap_analysis_skill",
        label="知识库缺口分析",
        keywords=(
            ("缺什么", 3), ("缺少", 3), ("缺口", 3), ("补充哪些", 3), ("覆盖", 2),
            ("是否完整", 2), ("资料完整", 2), ("还需要补充", 3), ("补齐", 2), ("盲区", 2),
            ("缺少哪些", 3), ("知识库还差", 3),
        ),
    ),
    IntentRule(
        intent="kb_overview",
        skill="knowledge_overview_skill",
        label="知识库概览",
        keywords=(
            ("知识库里有什么", 3), ("有哪些文档", 3), ("有哪些资料", 3), ("查看当前资料", 3),
            ("当前资料", 2), ("知识库概览", 3), ("文档列表", 3), ("知识库有哪些", 3),
            ("收录了哪些", 3), ("都有什么资料", 3),
        ),
    ),
    IntentRule(
        intent="solution_generation",
        skill="solution_generation_skill",
        label="售前方案生成",
        keywords=(
            ("生成方案", 3), ("售前方案", 3), ("解决方案", 3), ("方案草稿", 3),
            ("写一份方案", 3), ("出一份方案", 3), ("根据客户需求", 2), ("给客户做方案", 3),
            ("投标", 2), ("方案初稿", 3),
        ),
    ),
    IntentRule(
        intent="requirement_analysis",
        skill="requirement_analysis_skill",
        label="客户需求解析",
        keywords=(
            ("分析需求", 3), ("需求解析", 3), ("拆解需求", 3), ("需求分析", 3),
            ("客户要什么", 2), ("需求画像", 3), ("客户的需求", 3), ("梳理需求", 3),
            ("需求是什么", 3), ("分析一下需求", 3), ("需求梳理", 3), ("客户想要什么", 3),
        ),
    ),
    IntentRule(
        intent="document_intelligence",
        skill="document_intelligence_skill",
        label="文档智能分析",
        keywords=(
            ("摘要", 3), ("总结这份", 3), ("总结文档", 3), ("分析文档", 3),
            ("文档讲了什么", 3), ("文档内容", 2), ("提炼要点", 3),
            ("总结一下", 3), ("总结下", 3), ("帮我总结", 3), ("概括一下", 3),
            ("提炼一下", 3), ("这份文档", 2), ("这篇文档", 2), ("文档主要讲", 3),
        ),
    ),
    IntentRule(
        intent="rag_answer",
        skill="rag_qa_skill",
        label="知识库问答",
        keywords=(),  # the default when nothing else fires
    ),
)

INTENT_LABELS = {rule.intent: rule.label for rule in INTENT_RULES}
INTENT_SKILLS = {rule.intent: rule.skill for rule in INTENT_RULES}
DEFAULT_INTENT = "rag_answer"


def route_intent(task: str, preferred_intent: str | None = None) -> IntentDecision:
    """Classify a task into one intent with a confidence and an explanation."""
    text = (task or "").strip().lower()

    if preferred_intent and preferred_intent in INTENT_SKILLS:
        return IntentDecision(
            intent=preferred_intent,
            skill=INTENT_SKILLS[preferred_intent],
            confidence=1.0,
            matched_rule="manual_override",
            reasoning=f"用户在「执行模式」中手动指定为「{INTENT_LABELS[preferred_intent]}」，跳过自动路由。",
            candidates=[],
        )

    if not text:
        return IntentDecision(
            intent=DEFAULT_INTENT,
            skill=INTENT_SKILLS[DEFAULT_INTENT],
            confidence=0.0,
            matched_rule="empty_task",
            reasoning="任务为空，回落到默认的知识库问答。",
        )

    scored: list[tuple[float, IntentRule, list[str]]] = []
    for rule in INTENT_RULES:
        if not rule.keywords:
            continue
        score = 0.0
        matched: list[str] = []
        for keyword, weight in rule.keywords:
            if keyword in text:
                score += weight
                matched.append(keyword)
        if score > 0:
            scored.append((score, rule, matched))

    if not scored:
        return IntentDecision(
            intent=DEFAULT_INTENT,
            skill=INTENT_SKILLS[DEFAULT_INTENT],
            confidence=0.45,
            matched_rule="no_rule_matched",
            reasoning="没有命中任何专用意图规则，按知识库问答处理。",
            candidates=[],
        )

    scored.sort(key=lambda item: -item[0])
    top_score, top_rule, top_matches = scored[0]

    # Confidence blends absolute evidence strength with the margin over the
    # runner-up: a strong match that nobody contests is more trustworthy than a
    # strong match that a near-equal rival also claims.
    strength = min(top_score / 6.0, 1.0)
    if len(scored) > 1:
        margin = (top_score - scored[1][0]) / top_score
    else:
        margin = 1.0
    confidence = round(0.35 + 0.4 * strength + 0.25 * margin, 4)
    confidence = max(0.35, min(confidence, 0.99))

    candidates = [
        {
            "intent": rule.intent,
            "label": rule.label,
            "score": score,
            "matched": matched[:6],
        }
        for score, rule, matched in scored[:3]
    ]

    reasoning = (
        f"命中「{INTENT_LABELS[top_rule.intent]}」规则，"
        f"关键词：{'、'.join(top_matches[:5])}"
    )
    if len(scored) > 1:
        runner_up = scored[1][1]
        reasoning += (
            f"；次优意图为「{INTENT_LABELS[runner_up.intent]}」"
            f"（得分 {scored[1][0]:.0f} vs {top_score:.0f}）"
        )

    return IntentDecision(
        intent=top_rule.intent,
        skill=top_rule.skill,
        confidence=confidence,
        matched_rule=top_rule.intent,
        reasoning=reasoning,
        candidates=candidates,
    )
