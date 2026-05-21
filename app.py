import streamlit as st

from rag.chains import analyze_requirement, generate_answer, generate_solution
from rag.loader import load_markdown_documents
from rag.retriever import keyword_retrieve
from rag.splitter import split_documents


def build_preview(content, limit: int = 300) -> str:
    """Build a short text preview."""
    text = str(content or "")
    preview = text[:limit]
    if len(text) > limit:
        preview += "..."
    return preview


def get_unique_sources(results: list[dict]) -> list[str]:
    """Return source titles from retrieval results without duplicates."""
    sources: list[str] = []
    for result in results:
        source_title = str(result.get("source_title") or "").strip()
        if source_title and source_title not in sources:
            sources.append(source_title)
    return sources


def build_answer_markdown(question, results, answer) -> str:
    """Build a Markdown export for a knowledge-base QA result."""
    question_text = str(question or "").strip() or "未提供问题"
    answer_text = str(answer or "").strip() or "暂无 AI 生成回答。"
    sources = get_unique_sources(results or [])

    lines = [
        "# 知识库问答结果",
        "",
        "## 用户问题",
        "",
        question_text,
        "",
        "## 检索到的资料片段",
        "",
    ]

    if results:
        for index, result in enumerate(results, start=1):
            lines.extend(
                [
                    f"{index}. chunk_id：`{result.get('chunk_id', '未知')}`",
                    f"   - source_title：{result.get('source_title', '未知来源')}",
                    f"   - score：{result.get('score', 0)}",
                ]
            )
    else:
        lines.append("暂无检索结果。")

    lines.extend(
        [
            "",
            "## AI 生成回答",
            "",
            answer_text,
            "",
            "## 参考资料来源",
            "",
        ]
    )
    if sources:
        lines.extend([f"- {source}" for source in sources])
    else:
        lines.append("暂无参考资料来源。")
    lines.append("")
    return "\n".join(lines)


def build_solution_markdown(requirement, analysis, results, solution) -> str:
    """Build a Markdown export for a presales solution result."""
    requirement_text = str(requirement or "").strip() or "未提供客户需求"
    analysis_text = str(analysis or "").strip() or "暂无 AI 客户需求解析。"
    solution_text = str(solution or "").strip() or "暂无 AI 生成售前方案。"
    sources = get_unique_sources(results or [])

    lines = [
        "# 售前方案生成结果",
        "",
        "## 客户原始需求",
        "",
        requirement_text,
        "",
        "## AI 客户需求解析",
        "",
        analysis_text,
        "",
        "## 匹配到的方案参考资料",
        "",
    ]

    if results:
        for index, result in enumerate(results, start=1):
            lines.extend(
                [
                    f"{index}. chunk_id：`{result.get('chunk_id', '未知')}`",
                    f"   - source_title：{result.get('source_title', '未知来源')}",
                    f"   - score：{result.get('score', 0)}",
                ]
            )
    else:
        lines.append("暂无匹配资料。")

    lines.extend(
        [
            "",
            "## AI 生成售前方案",
            "",
            solution_text,
            "",
            "## 参考资料来源",
            "",
        ]
    )
    if sources:
        lines.extend([f"- {source}" for source in sources])
    else:
        lines.append("暂无参考资料来源。")
    lines.append("")
    return "\n".join(lines)


st.set_page_config(
    page_title="企业知识库 RAG 智能助手",
    page_icon="📚",
    layout="wide",
)

st.title("企业知识库 RAG 智能助手")
st.caption("企业资料问答、客户需求分析与售前方案生成的最小可运行入口。")

documents = load_markdown_documents("knowledge_base")
chunks = split_documents(documents)

with st.sidebar:
    st.title("知识库状态")
    st.caption("当前 Demo 已接入知识库读取、文本切分、关键词检索和 DeepSeek 生成链路。")
    st.info("项目状态：MVP 核心链路已完成，可用于知识库问答和售前方案生成演示。")
    st.metric("知识库文档数量", len(documents))
    st.metric("chunk 数量", len(chunks))

    if documents:
        st.markdown("#### 文档列表")
        for document in documents:
            with st.sidebar.expander(
                f"文档：{document['title']}｜{document['char_count']} 字"
            ):
                st.markdown(f"**文件路径：** `{document['path']}`")
                st.markdown(f"**字符数：** {document['char_count']}")
                st.text(build_preview(document.get("content"), limit=200))
    else:
        st.warning("未读取到知识库文档。")

    if chunks:
        with st.expander("查看 chunk 预览"):
            for chunk in chunks[:3]:
                st.markdown(f"**{chunk['chunk_id']}**")
                st.caption(f"{chunk['source_title']} · {chunk['char_count']} 字")
                st.text(build_preview(chunk.get("content"), limit=200))
    else:
        st.warning("未生成文本切分结果。")

mode = st.radio(
    "请选择工作模式",
    ["知识库问答", "方案生成"],
    horizontal=True,
)

if mode == "知识库问答":
    st.subheader("知识库问答")
    if "question_input" not in st.session_state:
        st.session_state.question_input = ""

    if st.button("填入示例问题"):
        st.session_state.question_input = "教育行业适合哪些场景？"

    question = st.text_area(
        "请输入你的问题",
        placeholder="例如：产品适合哪些企业场景？",
        key="question_input",
    )
    if st.button("提交问题"):
        if question.strip():
            retrieval_chunks = split_documents(documents)
            results = keyword_retrieve(question, retrieval_chunks, top_k=3)

            st.write(f"当前问题：{question}")

            if results:
                st.markdown("### 检索到的相关资料片段")
                for result in results:
                    with st.expander(
                        f"资料片段：{result['chunk_id']}｜评分：{result['score']}"
                    ):
                        st.markdown(f"**来源文档：** {result['source_title']}")
                        st.markdown(f"**匹配分数：** {result['score']}")
                        st.markdown("**内容预览：**")
                        st.text(build_preview(result.get("content"), limit=300))

                st.markdown("### AI 生成回答")
                with st.spinner("正在基于检索片段生成回答..."):
                    answer = generate_answer(question, results)
                st.markdown(answer)
                sources = get_unique_sources(results)
                if sources:
                    st.markdown("### 参考资料来源")
                    for source in sources:
                        st.markdown(f"- {source}")
                st.download_button(
                    "下载问答结果 Markdown",
                    data=build_answer_markdown(question, results, answer),
                    file_name="rag_answer.md",
                    mime="text/markdown",
                )
            else:
                st.warning("暂未从知识库中检索到相关资料。")
        else:
            st.warning("请先输入问题。")
else:
    st.subheader("方案生成")
    if "requirement_input" not in st.session_state:
        st.session_state.requirement_input = ""

    if st.button("填入示例客户需求"):
        st.session_state.requirement_input = (
            "某职业院校希望建设统一知识库，用于招生咨询、教务政策问答和学生事务答疑，"
            "希望上线快、成本低、方便维护。"
        )

    requirement = st.text_area(
        "请输入客户需求",
        placeholder="例如：某教育集团希望建设统一知识库并提升招生咨询效率。",
        key="requirement_input",
    )
    if st.button("生成方案"):
        if requirement.strip():
            st.write(f"当前需求：{requirement}")

            st.markdown("### AI 客户需求解析")
            with st.spinner("正在解析客户需求..."):
                requirement_analysis = analyze_requirement(requirement)
            st.markdown(requirement_analysis)

            solution_chunks = split_documents(documents)
            results = keyword_retrieve(requirement, solution_chunks, top_k=3)

            if results:
                st.markdown("### 匹配到的方案参考资料")
                for result in results:
                    with st.expander(
                        f"资料片段：{result['chunk_id']}｜评分：{result['score']}"
                    ):
                        st.markdown(f"**来源文档：** {result['source_title']}")
                        st.markdown(f"**匹配分数：** {result['score']}")
                        st.markdown("**内容预览：**")
                        st.text(build_preview(result.get("content"), limit=300))

                st.markdown("### AI 生成售前方案")
                with st.spinner("正在基于客户需求和参考资料生成方案..."):
                    solution = generate_solution(requirement, results)
                st.markdown(solution)
                sources = get_unique_sources(results)
                if sources:
                    st.markdown("### 参考资料来源")
                    for source in sources:
                        st.markdown(f"- {source}")
                st.download_button(
                    "下载售前方案 Markdown",
                    data=build_solution_markdown(
                        requirement,
                        requirement_analysis,
                        results,
                        solution,
                    ),
                    file_name="presales_solution.md",
                    mime="text/markdown",
                )
            else:
                st.warning("暂未从知识库中检索到相关方案资料。")
        else:
            st.warning("请先输入客户需求。")
