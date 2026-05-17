import streamlit as st

from rag.loader import load_markdown_documents


st.set_page_config(page_title="企业知识库 RAG 智能助手", page_icon="📚")

st.title("企业知识库 RAG 智能助手")
st.caption("企业资料问答、客户需求分析与售前方案生成的最小可运行入口。")

documents = load_markdown_documents("knowledge_base")

st.subheader("当前知识库资料")
st.write(f"当前读取到 {len(documents)} 个文档。")

if documents:
    for document in documents:
        with st.expander(f"{document['title']} · {document['char_count']} 字"):
            st.markdown(f"**文档标题：** {document['title']}")
            st.markdown(f"**文件路径：** `{document['path']}`")
            st.markdown(f"**字符数：** {document['char_count']}")
            preview = document["content"][:300]
            if len(document["content"]) > 300:
                preview += "..."
            st.text(preview)
else:
    st.warning("未读取到知识库文档，请确认 knowledge_base 目录下存在 .md 文件。")

mode = st.radio(
    "请选择工作模式",
    ["知识库问答", "方案生成"],
    horizontal=True,
)

if mode == "知识库问答":
    st.subheader("知识库问答")
    question = st.text_area("请输入你的问题", placeholder="例如：产品适合哪些企业场景？")
    if st.button("提交问题"):
        if question.strip():
            st.info("RAG 问答链路将在后续阶段接入。")
            st.write(f"当前问题：{question}")
        else:
            st.warning("请先输入问题。")
else:
    st.subheader("方案生成")
    requirement = st.text_area(
        "请输入客户需求",
        placeholder="例如：某教育集团希望建设统一知识库并提升招生咨询效率。",
    )
    if st.button("生成方案"):
        if requirement.strip():
            st.info("方案生成链路将在后续阶段接入。")
            st.write(f"当前需求：{requirement}")
        else:
            st.warning("请先输入客户需求。")
