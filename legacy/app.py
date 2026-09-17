"""Legacy Streamlit demo (frozen V2 entry point).

Run from the repository root::

    streamlit run legacy/app.py

This file is intentionally kept working but frozen: it is the original
single-file Streamlit demo that the V3 Next.js + FastAPI product replaced.
New work belongs in ``backend/`` and ``apps/web/``.
"""

# The demo lives one level down now, so the repository root and this directory
# must both be importable before the local modules are imported.
import sys
from pathlib import Path as _Path

_HERE = _Path(__file__).resolve().parent
_ROOT = _HERE.parent
for _candidate in (_HERE, _ROOT):
    if str(_candidate) not in sys.path:
        sys.path.insert(0, str(_candidate))

import hmac
import os
from datetime import datetime
from pathlib import Path

import streamlit as st

from agent_core import AgentResult, run_agent_task
from kb_tools import (
    delete_document,
    is_demo_read_only,
    list_documents,
    read_document,
    rebuild_knowledge_base,
    save_uploaded_file,
    update_document,
)


KB_DIR = _ROOT / "knowledge_base"
MAX_TEXT_PREVIEW_CHARS = 5000
ROUTE_MODE_MAP = {
    "自动判断": None,
    "知识库问答": "rag_answer",
    "售前方案": "solution_generation",
    "知识库缺口": "kb_gap_analysis",
    "Agent 优化": "agent_optimization",
}


def require_demo_password() -> None:
    """Require a shared password before exposing the public demo."""
    expected_password = os.getenv("DEMO_PASSWORD", "").strip()
    if not expected_password:
        st.error("Demo 未配置访问密码，请联系管理员。", icon=":material/lock:")
        st.stop()

    if st.session_state.get("demo_authenticated"):
        return

    st.title("企业知识库 RAG 智能助手")
    st.caption("请输入访谈 Demo 访问密码。")
    entered_password = st.text_input(
        "访问密码",
        type="password",
        key="demo_password_input",
    )
    if st.button("进入 Demo", type="primary", key="demo_password_submit"):
        if hmac.compare_digest(entered_password, expected_password):
            st.session_state["demo_authenticated"] = True
            st.rerun()
        else:
            st.error("密码错误，请重试。", icon=":material/error:")
    st.stop()


def refresh_knowledge_base_index() -> dict:
    """Refresh runtime documents/chunks used by the RAG workflow."""
    index_info = rebuild_knowledge_base(KB_DIR)
    st.session_state["kb_documents"] = index_info["documents"]
    st.session_state["kb_chunks"] = index_info["chunks"]
    st.session_state["kb_index_note"] = index_info["note"]
    # index_dirty means files changed after the latest runtime index rebuild.
    st.session_state["index_dirty"] = False
    # last_rebuild_time records when documents/chunks were last refreshed.
    st.session_state["last_rebuild_time"] = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )
    return index_info


def mark_index_dirty() -> None:
    """Mark the runtime index as stale after file changes."""
    st.session_state["index_dirty"] = True
    st.session_state["kb_version"] = st.session_state.get("kb_version", 0) + 1


def get_latest_modified_time(document_infos: list[dict]) -> str:
    """Return the latest modified time from file metadata."""
    if not document_infos:
        return "-"
    return max(item["modified_at"] for item in document_infos)


def get_document_char_count(file_info: dict) -> int | str:
    """Return text char count for searchable documents."""
    if file_info.get("type") not in {".md", ".txt"}:
        return "-"
    try:
        return len(read_document(file_info["path"], KB_DIR))
    except Exception:
        return "读取失败"


def build_document_inventory_rows(document_infos: list[dict]) -> list[dict]:
    """Build table rows for knowledge management."""
    rows: list[dict] = []
    for item in document_infos:
        is_searchable = item["type"] in {".md", ".txt"}
        rows.append(
            {
                "文件名": item["name"],
                "文件类型": item["type"],
                "文件大小": item["size"],
                "字数": get_document_char_count(item),
                "最后修改时间": item["modified_at"],
                "是否参与检索": "是" if is_searchable else "否",
                "文件路径": item["path"],
            }
        )
    return rows


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


def build_agent_report_markdown(result: AgentResult) -> str:
    """Build a Markdown export for generic Agent reports."""
    lines = [
        "# Agent 工作台执行报告",
        "",
        "## 用户任务",
        "",
        result.user_task or "未提供任务",
        "",
        "## 执行摘要",
        "",
        f"- 识别意图：`{result.intent}`",
        f"- 选择 Skill：`{result.selected_skill}`",
        f"- Tool 调用数：{len(result.tool_calls)}",
        f"- Tool 列表：{', '.join(result.tool_calls) if result.tool_calls else '无'}",
        "",
        "## 执行轨迹",
        "",
    ]
    for step in result.trace_steps:
        if isinstance(step, dict):
            lines.extend(
                [
                    f"### {step.get('step', '执行步骤')}",
                    f"- 动作：{step.get('action', '-')}",
                    f"- 原因：{step.get('reason', '-')}",
                    "",
                ]
            )
        else:
            lines.append(f"- {step}")

    lines.extend(["## 最终结果", "", result.final_answer or "暂无最终结果。", ""])
    return "\n".join(lines)


def render_metric_row(
    document_infos: list[dict],
    chunks: list[dict],
    latest_modified_time: str,
    index_status: str,
) -> None:
    """Render top-level product metrics."""
    metric_cols = st.columns(4)
    with metric_cols[0].container(border=True):
        st.metric("当前文档数量", len(document_infos))
    with metric_cols[1].container(border=True):
        st.metric("知识块数量", len(chunks))
    with metric_cols[2].container(border=True):
        st.metric("索引状态", index_status)
    with metric_cols[3].container(border=True):
        st.metric("最近修改时间", latest_modified_time)


def render_retrieved_sources(results: list[dict]) -> None:
    """Render retrieved chunks in a compact, traceable format."""
    if not results:
        st.warning("暂未检索到可引用的知识库资料。", icon=":material/warning:")
        return

    for index, result in enumerate(results, start=1):
        with st.container(border=True):
            st.markdown(
                f"**资料片段：{result.get('chunk_id', '未知片段')}｜评分：{result.get('score', 0)}**"
            )
            st.caption(
                f"来源文档：{result.get('source_title', '未知来源')} · "
                f"匹配分数：{result.get('score', 0)}"
            )
            st.text(build_preview(result.get("content"), limit=300))
            if index == 1:
                st.caption("内容仅展示前 300 字，完整内容仍用于生成。")


def render_reference_sources(results: list[dict]) -> None:
    """Render unique source document names."""
    sources = get_unique_sources(results)
    if not sources:
        return
    st.markdown("#### 参考资料来源")
    for source in sources:
        st.markdown(f"- {source}")


def render_agent_trace(result: AgentResult) -> None:
    """Render the Agent trace as a demo-friendly execution path."""
    with st.expander("完整执行轨迹 Trace", expanded=False, icon=":material/route:"):
        for index, step in enumerate(result.trace_steps, start=1):
            with st.container(border=True):
                if isinstance(step, dict):
                    st.markdown(f"**{step.get('step', '执行步骤')}**")
                    st.markdown(f"- **动作：** {step.get('action', '-')}")
                    st.markdown(f"- **原因：** {step.get('reason', '-')}")
                else:
                    st.markdown(f"**Step {index}**")
                    st.markdown(f"- **动作：** {step}")
                    st.markdown("- **原因：** Skill 内部记录。")


def render_agent_result(result: AgentResult) -> None:
    """Render the final Agent result according to its output type."""
    st.markdown("### 执行结果")
    result_cols = st.columns(4)
    result_cols[0].metric("识别意图", result.intent)
    result_cols[1].metric("选择 Skill", result.selected_skill)
    result_cols[2].metric("Tool 调用数", len(result.tool_calls))
    result_cols[3].metric("命中片段", len(result.retrieved_chunks))

    if result.used_general_fallback:
        st.warning(
            "当前知识库未命中，本次回答使用模型通用建议，未经过知识库资料验证。",
            icon=":material/warning:",
        )

    render_agent_trace(result)

    if result.output_type == "solution":
        st.success("已完成客户需求解析、资料检索与售前方案生成。", icon=":material/check_circle:")
        with st.expander("1. 客户需求解析", expanded=True, icon=":material/manage_search:"):
            st.markdown(result.analysis or "暂无客户需求解析。")
        with st.expander("2. 匹配到的方案参考资料", expanded=False, icon=":material/source:"):
            render_retrieved_sources(result.retrieved_chunks)
        with st.expander("3. AI 生成售前方案", expanded=True, icon=":material/description:"):
            st.markdown(result.final_answer)
            render_reference_sources(result.retrieved_chunks)
        st.download_button(
            "下载售前方案 Markdown",
            data=build_solution_markdown(
                result.user_task,
                result.analysis,
                result.retrieved_chunks,
                result.final_answer,
            ),
            file_name="presales_solution.md",
            mime="text/markdown",
            icon=":material/download:",
        )
        return

    if result.output_type == "answer":
        if result.retrieved_chunks:
            st.success("已完成知识库检索与回答生成。", icon=":material/check_circle:")
        with st.expander("1. 检索到的相关资料片段", expanded=False, icon=":material/source:"):
            render_retrieved_sources(result.retrieved_chunks)
        with st.expander("2. AI 生成回答", expanded=True, icon=":material/chat:"):
            st.markdown(result.final_answer)
            render_reference_sources(result.retrieved_chunks)
        st.download_button(
            "下载问答结果 Markdown",
            data=build_answer_markdown(
                result.user_task,
                result.retrieved_chunks,
                result.final_answer,
            ),
            file_name="rag_answer.md",
            mime="text/markdown",
            icon=":material/download:",
        )
        return

    with st.expander("Agent 最终报告", expanded=True, icon=":material/article:"):
        st.markdown(result.final_answer)
    st.download_button(
        "下载 Agent 报告 Markdown",
        data=build_agent_report_markdown(result),
        file_name="agent_report.md",
        mime="text/markdown",
        icon=":material/download:",
    )


def render_smart_workbench(documents: list[dict], chunks: list[dict]) -> None:
    """Render the unified question, solution, and Agent workbench."""
    st.subheader("智能工作台")
    st.caption(
        "输入问题、客户需求或售前任务，系统会自动识别意图，选择对应 Skill，并在 Trace 中展示执行路径。"
    )

    st.session_state.setdefault("smart_task_input", "")
    st.session_state.setdefault("last_agent_result", None)

    with st.container(border=True):
        st.markdown("#### 示例任务")
        examples = [
            "当前知识库里有哪些资料？",
            "帮我分析当前知识库还缺少哪些售前资料。",
            "根据知识库介绍一下这个产品适合哪些企业场景。",
            "根据客户需求生成一份售前解决方案。",
            "帮我分析这个项目还能怎么用 Agent 优化。",
        ]
        example_cols = st.columns(2)
        for index, example in enumerate(examples):
            if example_cols[index % 2].button(
                example,
                key=f"smart_example_{index}",
                width="stretch",
            ):
                st.session_state["smart_task_input"] = example

        task = st.text_area(
            "请输入任务",
            placeholder="例如：某职业院校希望建设统一知识库，用于招生咨询、教务政策问答和学生事务答疑。",
            key="smart_task_input",
            height=140,
        )

        control_cols = st.columns([2, 1])
        with control_cols[0]:
            route_mode = st.segmented_control(
                "执行模式",
                options=list(ROUTE_MODE_MAP.keys()),
                default="自动判断",
                key="smart_route_mode",
            )
        with control_cols[1]:
            allow_fallback = st.toggle(
                "未命中时允许模型通用建议",
                value=True,
                key="smart_allow_general_fallback",
            )

        run_clicked = st.button(
            "运行智能任务",
            type="primary",
            key="smart_run_button",
            icon=":material/play_arrow:",
        )

    if run_clicked:
        if not task.strip():
            st.warning("请先输入任务。", icon=":material/warning:")
        else:
            with st.status("正在接收任务...", expanded=True) as status:
                status.write("正在识别意图")
                status.write("正在选择 Skill")
                status.write("正在调用 Tool 与模型")
                result = run_agent_task(
                    user_task=task,
                    kb_dir=KB_DIR,
                    documents=documents,
                    chunks=chunks,
                    preferred_intent=ROUTE_MODE_MAP.get(route_mode),
                    allow_general_fallback=allow_fallback,
                )
                status.write("正在整理 Trace 与最终结果")
                status.update(label="执行完成", state="complete", expanded=False)
            st.session_state["last_agent_result"] = result

    result = st.session_state.get("last_agent_result")
    if result:
        st.caption(f"上次执行任务：{result.user_task}")
        render_agent_result(result)


def render_read_only_knowledge_management(
    document_infos: list[dict],
    chunks: list[dict],
    latest_modified_time: str,
) -> None:
    """Render knowledge-base browsing without exposing mutation controls."""
    st.subheader("知识库管理")
    st.info(
        "当前为只读演示模式：可浏览知识库，但上传、编辑、删除和其他写操作已关闭。",
        icon=":material/lock:",
    )

    overview_tab, preview_tab, index_tab = st.tabs(
        ["知识库概览", "文档浏览", "索引状态"]
    )
    with overview_tab:
        overview_cols = st.columns(4)
        overview_cols[0].metric("当前文档数量", len(document_infos))
        overview_cols[1].metric("知识块数量", len(chunks))
        overview_cols[2].markdown("**支持格式**\n\n`.md` / `.txt` / `.pdf`")
        overview_cols[3].metric("最近修改时间", latest_modified_time)
        if document_infos:
            st.dataframe(
                build_document_inventory_rows(document_infos),
                hide_index=True,
                width="stretch",
            )
        else:
            st.warning("当前知识库暂无可展示文档。", icon=":material/warning:")

    with preview_tab:
        if not document_infos:
            st.warning("当前知识库暂无可浏览文档。", icon=":material/warning:")
        else:
            option_map = {item["path"]: item for item in document_infos}
            selected_path = st.selectbox(
                "选择一个知识库文档",
                list(option_map),
                format_func=lambda value: option_map[value]["name"],
                key="kb_read_only_selected_file",
            )
            selected_document = option_map[selected_path]
            st.caption(
                f"{selected_document['type']} · {selected_document['size']} · "
                f"{selected_document['modified_at']}"
            )
            try:
                preview = read_document(
                    selected_path,
                    KB_DIR,
                    max_chars=MAX_TEXT_PREVIEW_CHARS,
                )
                st.text_area(
                    f"文档预览（最多 {MAX_TEXT_PREVIEW_CHARS} 字）",
                    value=preview,
                    height=360,
                    disabled=True,
                )
            except Exception as exc:
                st.error(f"读取失败：{exc}", icon=":material/error:")

    with index_tab:
        index_cols = st.columns(2)
        index_cols[0].metric("当前知识块数量", len(chunks))
        index_cols[1].success("运行时索引已加载", icon=":material/check_circle:")
        st.caption("索引重建按钮在只读演示模式下已关闭。")


def render_knowledge_management(
    document_infos: list[dict],
    chunks: list[dict],
    latest_modified_time: str,
) -> None:
    """Render the merged knowledge overview and management page."""
    if is_demo_read_only():
        render_read_only_knowledge_management(
            document_infos,
            chunks,
            latest_modified_time,
        )
        return

    st.subheader("知识库管理")
    st.caption("统一查看、预览、上传、编辑、删除知识库文档，并重建运行时检索索引。")

    notice = st.session_state.pop("kb_management_notice", None)
    if notice:
        st.success(notice, icon=":material/check_circle:")

    overview_tab, document_tab, index_tab = st.tabs(
        ["知识库概览", "文档管理", "索引状态"]
    )

    with overview_tab:
        overview_cols = st.columns(4)
        overview_cols[0].metric("当前文档数量", len(document_infos))
        overview_cols[1].metric("知识块数量", len(chunks))
        overview_cols[2].markdown("**支持格式**\n\n`.md` / `.txt` / `.pdf`")
        overview_cols[3].metric("最近修改时间", latest_modified_time)

        st.caption(
            "当前 RAG 检索范围包括 .md 和 .txt 文档；PDF 当前仅支持上传与列表展示。"
        )
        if document_infos:
            st.dataframe(
                build_document_inventory_rows(document_infos),
                hide_index=True,
                width="stretch",
            )
        else:
            st.warning("当前知识库暂无可展示文档。", icon=":material/warning:")

        with st.expander("查看知识块预览", expanded=False, icon=":material/data_object:"):
            if chunks:
                for index, chunk in enumerate(chunks[:10], start=1):
                    with st.container(border=True):
                        st.markdown(f"**知识块 {index}：{chunk.get('chunk_id', '-')}**")
                        st.caption(
                            f"来源文档：{chunk.get('source_title', '未知来源')} · "
                            f"{chunk.get('char_count', 0)} 字"
                        )
                        st.text(build_preview(chunk.get("content"), limit=300))
            else:
                st.warning("当前暂无知识块，请先重建索引。", icon=":material/warning:")

    with document_tab:
        st.markdown("#### 上传文档")
        upload_key = f"kb_upload_file_{st.session_state['upload_widget_version']}"
        uploaded_file = st.file_uploader(
            "选择要上传到知识库的文件",
            type=["md", "txt", "pdf"],
            accept_multiple_files=False,
            key=upload_key,
        )
        if st.button("保存上传文件", key="kb_save_upload", icon=":material/upload:"):
            try:
                saved_info = save_uploaded_file(uploaded_file, KB_DIR)
                mark_index_dirty()
                st.session_state["upload_widget_version"] += 1
                st.session_state["kb_management_notice"] = (
                    f"上传成功：{saved_info['name']}。当前知识库已变更，建议重建索引。"
                )
                st.rerun()
            except Exception as exc:
                st.error(f"上传失败：{exc}", icon=":material/error:")

        st.markdown("#### 文档列表")
        if not document_infos:
            st.warning("当前知识库目录下暂无 .md、.txt、.pdf 文件。", icon=":material/warning:")
            return

        st.dataframe(
            [
                {
                    "文件名": item["name"],
                    "文件类型": item["type"],
                    "文件大小": item["size"],
                    "最后修改时间": item["modified_at"],
                }
                for item in document_infos
            ],
            hide_index=True,
            width="stretch",
        )

        st.markdown("#### 文档预览 / 编辑 / 删除")
        option_map = {item["path"]: item for item in document_infos}
        option_paths = list(option_map.keys())
        if st.session_state.get("kb_selected_file") not in option_paths:
            st.session_state["kb_selected_file"] = option_paths[0]

        selected_label = st.selectbox(
            "选择一个知识库文档",
            option_paths,
            format_func=lambda value: (
                f"{option_map[value]['name']}｜"
                f"{option_map[value]['type']}｜"
                f"{option_map[value]['size']}"
            ),
            key="kb_selected_file",
        )
        selected_document = option_map[selected_label]
        selected_path = selected_document["path"]
        selected_type = selected_document["type"]
        selected_identity = (
            f"{selected_path}|{selected_document['modified_at']}|"
            f"{selected_document['size_bytes']}"
        )
        if st.session_state.get("kb_active_file_identity") != selected_identity:
            st.session_state["kb_active_file_identity"] = selected_identity
            st.session_state["kb_load_full_text"] = False
            st.session_state["kb_confirm_delete"] = False
            st.session_state["kb_editor_loaded_identity"] = ""
            st.session_state["kb_editor_content"] = ""

        meta_cols = st.columns(3)
        meta_cols[0].markdown(f"**文件名：** {selected_document['name']}")
        meta_cols[1].markdown(f"**文件大小：** {selected_document['size']}")
        meta_cols[2].markdown(f"**最后修改时间：** {selected_document['modified_at']}")
        st.caption(f"文件路径：{selected_path}")

        read_error = False
        if selected_type in {".md", ".txt"}:
            is_large_text = selected_document["size_bytes"] > MAX_TEXT_PREVIEW_CHARS
            try:
                preview_content = read_document(
                    selected_path,
                    KB_DIR,
                    max_chars=MAX_TEXT_PREVIEW_CHARS,
                )
            except Exception as exc:
                read_error = True
                preview_content = ""
                st.error(f"读取失败：{exc}", icon=":material/error:")

            if not read_error:
                st.session_state["kb_preview_content"] = preview_content
                st.text_area(
                    f"文档预览（最多 {MAX_TEXT_PREVIEW_CHARS} 字）",
                    height=240,
                    disabled=True,
                    key="kb_preview_content",
                )
                load_full_text = True
                if is_large_text:
                    st.caption("为避免页面卡顿，大文本默认只加载预览。")
                    load_full_text = st.checkbox(
                        "加载全文进行编辑",
                        key="kb_load_full_text",
                    )

                if load_full_text:
                    try:
                        document_content = read_document(selected_path, KB_DIR)
                    except Exception as exc:
                        read_error = True
                        document_content = ""
                        st.error(f"读取全文失败：{exc}", icon=":material/error:")

                    if not read_error:
                        if (
                            st.session_state.get("kb_editor_loaded_identity")
                            != selected_identity
                        ):
                            st.session_state["kb_editor_content"] = document_content
                            st.session_state["kb_editor_loaded_identity"] = selected_identity
                        st.text_area(
                            "文档内容（可编辑）",
                            height=360,
                            key="kb_editor_content",
                        )
                        if st.button("保存修改", key="kb_save_edit", icon=":material/save:"):
                            try:
                                update_document(
                                    selected_path,
                                    st.session_state["kb_editor_content"],
                                    KB_DIR,
                                )
                                mark_index_dirty()
                                st.session_state["kb_management_notice"] = (
                                    "保存成功，请重建知识库索引以使修改生效。"
                                )
                                st.rerun()
                            except Exception as exc:
                                st.error(f"保存失败：{exc}", icon=":material/error:")
        elif selected_type == ".pdf":
            try:
                st.info(read_document(selected_path, KB_DIR), icon=":material/picture_as_pdf:")
            except Exception as exc:
                st.error(f"读取失败：{exc}", icon=":material/error:")
        else:
            st.warning("当前文件暂不支持编辑。", icon=":material/warning:")

        with st.expander("危险操作：删除文档", expanded=False, icon=":material/delete:"):
            confirm_delete = st.checkbox(
                f"我确认要删除：{selected_document['name']}",
                key="kb_confirm_delete",
            )
            if st.button(
                "删除所选文档",
                disabled=not confirm_delete,
                key="kb_delete_document",
                icon=":material/delete:",
            ):
                try:
                    deleted_info = delete_document(selected_path, KB_DIR)
                    mark_index_dirty()
                    st.session_state["kb_management_notice"] = (
                        f"已删除：{deleted_info['name']}。当前知识库已变更，建议重建索引。"
                    )
                    st.rerun()
                except Exception as exc:
                    st.error(f"删除失败：{exc}", icon=":material/error:")

    with index_tab:
        st.markdown("#### 索引状态")
        index_cols = st.columns(3)
        index_cols[0].metric("当前知识块数量", len(st.session_state["kb_chunks"]))
        index_cols[1].metric("最近一次重建时间", st.session_state["last_rebuild_time"])
        if st.session_state["index_dirty"]:
            index_cols[2].warning("需要重建", icon=":material/warning:")
        else:
            index_cols[2].success("已同步", icon=":material/check_circle:")

        st.caption(
            "当前项目使用运行时关键词检索。重建索引会重新读取 .md/.txt 文件并切分 chunks。"
        )
        st.info("PDF 当前仅支持上传和列表展示，暂不参与全文检索。", icon=":material/info:")
        if st.button(
            "重建知识库索引",
            type="primary",
            key="kb_rebuild_index",
            icon=":material/refresh:",
        ):
            try:
                with st.status("正在重建知识库索引...", expanded=True) as status:
                    status.write("正在读取 .md/.txt 文档")
                    index_info = refresh_knowledge_base_index()
                    status.write("正在切分文本 chunks")
                    status.update(label="索引重建完成", state="complete", expanded=False)
                st.session_state["kb_management_notice"] = (
                    "重建成功："
                    f"{index_info['document_count']} 个文本文档，"
                    f"{index_info['chunk_count']} 个 chunk。"
                )
                st.rerun()
            except Exception as exc:
                st.error(f"重建失败：{exc}", icon=":material/error:")


st.set_page_config(
    page_title="企业知识库 RAG 智能助手",
    page_icon=":material/database:",
    layout="wide",
)

require_demo_password()

st.markdown(
    """
    <style>
    .app-title {
        font-size: 2.2rem;
        font-weight: 760;
        margin-bottom: 0.15rem;
        letter-spacing: 0;
    }
    .app-subtitle {
        color: #5b6472;
        font-size: 1rem;
        margin-bottom: 1rem;
    }
    .sidebar-brand {
        font-size: 1.22rem;
        font-weight: 760;
        margin-bottom: 0.1rem;
        letter-spacing: 0;
    }
    .sidebar-subtitle {
        color: #667085;
        font-size: 0.88rem;
        margin-bottom: 0.7rem;
    }
    .soft-note {
        border-left: 3px solid #2563eb;
        background: #f8fafc;
        padding: 0.7rem 0.85rem;
        border-radius: 8px;
        color: #334155;
        margin: 0.35rem 0 0.9rem 0;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

if "kb_documents" not in st.session_state or "kb_chunks" not in st.session_state:
    refresh_knowledge_base_index()

st.session_state.setdefault("index_dirty", False)
st.session_state.setdefault("last_rebuild_time", "未重建")
st.session_state.setdefault("kb_version", 0)
st.session_state.setdefault("upload_widget_version", 0)

documents = st.session_state["kb_documents"]
chunks = st.session_state["kb_chunks"]
live_document_infos = list_documents(KB_DIR)
latest_modified_time = get_latest_modified_time(live_document_infos)
index_status = "需要重建" if st.session_state["index_dirty"] else "已同步"

with st.sidebar:
    st.markdown('<div class="sidebar-brand">企业知识库 RAG</div>', unsafe_allow_html=True)
    st.markdown(
        '<div class="sidebar-subtitle">售前 Agent 工作流 Demo</div>',
        unsafe_allow_html=True,
    )
    mode = st.radio(
        "导航",
        ["智能工作台", "知识库管理"],
        key="main_mode",
    )
    st.markdown("### 知识库状态")
    st.metric("文档数量", len(live_document_infos))
    st.metric("知识块数量", len(chunks))
    st.markdown(f"**索引状态：** {index_status}")
    st.caption(f"最近更新时间：{latest_modified_time}")
    if st.session_state["index_dirty"]:
        st.warning("当前知识库已变更，建议重建索引。", icon=":material/warning:")

st.markdown('<div class="app-title">企业知识库 RAG 智能助手</div>', unsafe_allow_html=True)
st.markdown(
    '<div class="app-subtitle">面向企业售前场景的知识库问答、客户需求分析与方案生成工具。</div>',
    unsafe_allow_html=True,
)
render_metric_row(live_document_infos, chunks, latest_modified_time, index_status)

if mode == "智能工作台":
    render_smart_workbench(documents, chunks)
else:
    render_knowledge_management(live_document_infos, chunks, latest_modified_time)
