"""The grounded-generation pipeline.

    question
      → analyse
      → retrieve (keyword / vector / hybrid)
      → fuse
      → rerank
      → build numbered context + citations
      → generate (prompt from prompts/<version>/rag_answer.md)
      → grounding check
      → response {answer, citations, sources, retrieved_chunks, trace, latency}

Every stage is timed and recorded, and every stage degrades gracefully: a
missing model key still returns retrieved evidence with an explanatory answer
rather than a 500.
"""

from __future__ import annotations

import time

from ..core.config import Settings, get_settings
from ..core.logging import get_logger
from ..core.tracing import TraceRecorder
from ..schemas.rag import (
    ChatMessage,
    RagQueryResponse,
    RetrievalStats,
    RetrieveOnlyResponse,
    RetrievedChunk,
    UsageInfo,
)
from .citations import (
    analyse_grounding,
    build_citations,
    build_sources,
    format_context,
    strip_invalid_citations,
    used_citations,
)
from .index import KnowledgeIndex, get_index
from .llm import get_llm_client
from .prompts import get_prompt_library
from .reranker import create_reranker  # noqa: F401  (re-exported factory)
from .retriever import Retriever, create_retriever
from .text import extract_query_terms

logger = get_logger("app.rag.pipeline")


class RagPipeline:
    """Retrieval + rerank + grounded generation."""

    def __init__(self, index: KnowledgeIndex | None = None, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.index = index or get_index(self.settings)

    # ------------------------------------------------------------------
    def _retriever(self, mode: str | None = None) -> Retriever:
        self.index.ensure_built()
        return create_retriever(self.index, self.settings, mode)

    # ------------------------------------------------------------------
    def retrieve_only(
        self,
        query: str,
        *,
        k: int | None = None,
        mode: str | None = None,
        rerank_provider: str | None = None,
        rerank: bool = True,
    ) -> RetrieveOnlyResponse:
        """Retrieval without generation -- used by the Explorer and evaluator."""
        started = time.perf_counter()
        top_k = k or self.settings.retrieval_top_k

        retriever = self._retriever(mode)
        outcome = retriever.retrieve(query, k=top_k)
        chunks = outcome.chunks

        if rerank and chunks:
            provider = (rerank_provider or self.settings.rerank_provider or "heuristic").lower()
            if provider != "off":
                reranker = _reranker_for(provider, self.settings, self.index.bm25.term_idf)
                chunks = reranker.rerank(query, chunks, min(self.settings.rerank_top_k, top_k))

        stats = outcome.stats
        stats.candidate_count = len(self.index.chunks)
        stats.after_fusion = len(outcome.chunks)
        stats.after_rerank = len(chunks)
        stats.rerank_provider = rerank_provider or self.settings.rerank_provider

        return RetrieveOnlyResponse(
            query=query,
            stats=stats,
            items=chunks,
            latency_ms=round((time.perf_counter() - started) * 1000, 2),
        )

    # ------------------------------------------------------------------
    def answer(
        self,
        question: str,
        *,
        top_k: int | None = None,
        rerank_top_k: int | None = None,
        mode: str | None = None,
        rerank_provider: str | None = None,
        allow_general_fallback: bool | None = None,
        history: list[ChatMessage] | None = None,
    ) -> RagQueryResponse:
        """Run the full pipeline and return a fully provenance-tracked answer."""
        started = time.perf_counter()
        trace = TraceRecorder()
        question = (question or "").strip()

        retrieval_k = top_k or self.settings.retrieval_top_k
        rerank_k = rerank_top_k or self.settings.rerank_top_k
        allow_fallback = (
            self.settings.agent_allow_general_fallback if allow_general_fallback is None else allow_general_fallback
        )

        # -- 1. understand the question --------------------------------
        with trace.step("understand", "理解问题", inputs={"question": question}) as step:
            terms = extract_query_terms(question, limit=12)
            step.summary = f"提取 {len(terms)} 个查询关键词"
            step.detail = "、".join(terms[:10]) if terms else "（无可用关键词）"
            step.outputs = {"terms": terms}

        if not question:
            trace.add("guard", "空问题守卫", status="warning", summary="问题为空，未执行检索")
            return RagQueryResponse(
                question="",
                answer="请输入需要查询的问题。",
                grounded=False,
                trace=trace.steps,
                latency_ms=trace.elapsed_ms,
                prompt_version=self.settings.prompt_version,
                model=self.settings.llm_model,
            )

        # -- 2. retrieve ------------------------------------------------
        retriever = self._retriever(mode)
        with trace.step(
            "retrieve",
            "检索知识库",
            tool="retrieve",
            inputs={"mode": retriever.mode, "top_k": retrieval_k},
        ) as step:
            outcome = retriever.retrieve(question, k=retrieval_k)
            step.summary = (
                f"{retriever.mode} 检索命中 {len(outcome.chunks)} 段"
                f"（关键词 {outcome.stats.keyword_hits} / 向量 {outcome.stats.vector_hits}）"
            )
            step.outputs = {
                "mode": retriever.mode,
                "keyword_hits": outcome.stats.keyword_hits,
                "vector_hits": outcome.stats.vector_hits,
                "candidates": len(outcome.chunks),
            }

        candidates = outcome.chunks
        stats = outcome.stats
        stats.candidate_count = len(self.index.chunks)

        # -- 3. fuse ----------------------------------------------------
        if retriever.mode == "hybrid" and candidates:
            trace.add(
                "fuse",
                "融合排序",
                summary=f"使用 {stats.fusion_strategy.upper()} 融合两个检索分支",
                detail=(
                    f"关键词候选 {stats.keyword_hits} 段，向量候选 {stats.vector_hits} 段，"
                    f"融合后保留 {len(candidates)} 段。"
                ),
                outputs={"strategy": stats.fusion_strategy, "after_fusion": len(candidates)},
            )
        else:
            trace.mark_skipped("fuse", "融合排序", f"检索模式为 {retriever.mode}，无需融合")

        # -- 4. rerank --------------------------------------------------
        provider = (rerank_provider or self.settings.rerank_provider or "heuristic").lower()
        if candidates and provider != "off":
            with trace.step(
                "rerank",
                "重排序证据",
                tool="rerank",
                inputs={"provider": provider, "top_k": rerank_k},
            ) as step:
                reranker = _reranker_for(provider, self.settings, self.index.bm25.term_idf)
                candidates = reranker.rerank(question, candidates, min(rerank_k, len(candidates)))
                step.summary = f"{provider} 重排后保留 {len(candidates)} 段"
                step.detail = "、".join(
                    f"#{item.rank_final} {item.document_name}" for item in candidates[:5]
                )
                step.outputs = {"provider": provider, "after_rerank": len(candidates)}
        else:
            trace.mark_skipped("rerank", "重排序证据", "重排序已关闭")

        stats.after_fusion = min(len(candidates), retrieval_k)
        stats.after_rerank = len(candidates)
        stats.rerank_provider = provider

        # -- 5. context + generation + grounding -------------------------
        return self.compose(
            question,
            candidates,
            stats,
            trace,
            allow_general_fallback=allow_fallback,
            history=history,
        )

    # ------------------------------------------------------------------
    def compose(
        self,
        question: str,
        candidates: list[RetrievedChunk],
        stats: RetrievalStats,
        trace: TraceRecorder,
        *,
        allow_general_fallback: bool = False,
        history: list[ChatMessage] | None = None,
    ) -> RagQueryResponse:
        """Context → generate → grounding.

        Split out of :meth:`answer` so the agent graph can retrieve evidence in
        its own node (with its own timing and tool record) and then hand the
        exact same evidence to generation -- without retrieving twice and
        without duplicating the citation logic.
        """
        # -- context + citations -----------------------------------------
        with trace.step("context", "构建引用上下文", tool="format_context") as step:
            context = format_context(candidates)
            citations = build_citations(candidates)
            sources = build_sources(citations)
            step.summary = f"组织 {len(citations)} 条引用、{len(sources)} 份来源文档"
            step.outputs = {
                "citations": len(citations),
                "sources": len(sources),
                "context_chars": len(context),
            }

        if not candidates:
            trace.add("generate", "生成回答", status="skipped", summary="无可用证据，未调用模型")
            answer = (
                "根据当前知识库资料无法回答该问题。"
                "建议先确认知识库是否已收录相关资料，或在知识库管理中补充文档后重建索引。"
            )
            if allow_general_fallback:
                fallback = self._general_fallback(question, trace)
                if fallback:
                    answer = fallback
            return RagQueryResponse(
                question=question,
                answer=answer,
                grounded=False,
                fallback_used=allow_general_fallback,
                citations=[],
                sources=[],
                retrieved_chunks=[],
                trace=trace.steps,
                stats=stats,
                latency_ms=trace.elapsed_ms,
                prompt_version=self.settings.prompt_version,
                model=self.settings.llm_model,
            )

        # -- generate ----------------------------------------------------
        with trace.step(
            "generate",
            "生成回答",
            tool="llm",
            inputs={"model": self.settings.llm_model, "context_blocks": len(candidates)},
        ) as step:
            answer, usage = self._generate(question, context, len(candidates), history)
            if usage.total_tokens:
                step.summary = f"模型生成 {len(answer)} 字，消耗 {usage.total_tokens} tokens"
            else:
                step.summary = f"模型生成 {len(answer)} 字"
            step.outputs = {"answer_chars": len(answer), "tokens": usage.total_tokens}

        # -- grounding ---------------------------------------------------
        with trace.step("grounding", "引用校验") as step:
            groundings = analyse_grounding(answer, len(citations))
            cleaned = strip_invalid_citations(answer, len(citations))
            if groundings.invalid_indexes:
                step.status = "warning"
                step.summary = (
                    f"回答中出现 {len(groundings.invalid_indexes)} 个越界引用编号，已移除"
                )
                step.detail = f"越界编号：{groundings.invalid_indexes}"
            elif groundings.has_citation:
                step.summary = f"回答引用 {len(groundings.cited_indexes)} 条证据，引用有效"
            else:
                step.status = "warning"
                step.summary = "回答未包含引用编号，已标记为弱溯源"
            step.outputs = {
                "cited": groundings.cited_indexes,
                "invalid": groundings.invalid_indexes,
                "citation_precision": groundings.citation_precision,
            }

        final_citations = used_citations(citations, groundings) if groundings.has_citation else citations
        final_sources = build_sources(final_citations)
        grounded = groundings.has_citation and not groundings.invalid_indexes

        return RagQueryResponse(
            question=question,
            answer=cleaned,
            grounded=grounded,
            fallback_used=False,
            citations=final_citations,
            sources=final_sources,
            retrieved_chunks=candidates,
            trace=trace.steps,
            stats=stats,
            latency_ms=trace.elapsed_ms,
            prompt_version=self.settings.prompt_version,
            model=self.settings.llm_model,
        )

    # ------------------------------------------------------------------
    def _generate(
        self,
        question: str,
        context: str,
        context_count: int,
        history: list[ChatMessage] | None = None,
    ) -> tuple[str, UsageInfo]:
        try:
            system, user = get_prompt_library(self.settings).render(
                "rag_answer",
                question=question,
                context=context,
                context_count=context_count,
                history=_format_history(history),
            )
        except Exception as exc:
            logger.error("Prompt loading failed: %s", exc)
            return "Prompt 模板加载失败，请检查 prompts 目录。", UsageInfo()

        client = get_llm_client(self.settings)
        completion = client.complete(system=system, user=user)
        if not completion.ok:
            return (
                f"{completion.error}\n\n（本次检索已命中 {context_count} 段知识库资料，"
                "可在右侧来源列表中直接查看原文。）"
            ), UsageInfo()

        return completion.text, UsageInfo(
            prompt_tokens=completion.prompt_tokens,
            completion_tokens=completion.completion_tokens,
            total_tokens=completion.total_tokens,
        )

    def _general_fallback(self, question: str, trace: TraceRecorder) -> str:
        """Answer from general knowledge, explicitly labelled as unverified."""
        client = get_llm_client(self.settings)
        if not client.configured:
            return ""

        with trace.step("fallback", "通用建议降级", tool="llm") as step:
            try:
                system, user = get_prompt_library(self.settings).render(
                    "general_fallback", question=question
                )
            except Exception as exc:
                step.status = "failed"
                step.summary = f"Prompt 加载失败：{exc}"
                return ""
            completion = client.complete(system=system, user=user)
            step.status = "warning" if completion.ok else "failed"
            step.summary = (
                "知识库未命中，已生成未经知识库验证的通用建议"
                if completion.ok
                else completion.error
            )
            return completion.text if completion.ok else ""


def _format_history(history: list[ChatMessage] | None, *, max_turns: int = 6) -> str:
    """Render the last few conversation turns for the prompt.

    History is explicitly labelled as *not* a factual source in the system
    prompt -- it exists only so follow-up questions with pronouns ("它的边界
    是什么？") can be resolved.  Without that guard rail a previous assistant
    answer would be treated as evidence.
    """
    if not history:
        return "（无）"
    turns = [item for item in history if item.content.strip()][-max_turns:]
    if not turns:
        return "（无）"
    labels = {"user": "用户", "assistant": "助手", "system": "系统"}
    return "\n".join(
        f"{labels.get(item.role, item.role)}：{item.content.strip()[:400]}" for item in turns
    )


def _reranker_for(provider: str, settings: Settings, idf_provider=None):
    """Build a reranker for an explicit provider override."""
    from .reranker import HeuristicReranker, LLMReranker, NoopReranker

    provider = (provider or "heuristic").lower()
    if provider == "off":
        return NoopReranker()
    if provider == "llm" and settings.llm_configured:
        return LLMReranker(settings)
    return HeuristicReranker(target_chars=settings.chunk_size, idf_provider=idf_provider)


def get_pipeline(settings: Settings | None = None) -> RagPipeline:
    """Convenience accessor for the shared pipeline."""
    return RagPipeline(settings=settings)
