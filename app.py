import streamlit as st

from rag.loader import load_markdown_documents
from rag.retriever import keyword_retrieve
from rag.splitter import split_documents


st.set_page_config(page_title="企业知识库 RAG 智能助手", page_icon="📚")

st.title("企业知识库 RAG 智能助手")
st.caption("企业资料问答、客户需求分析与售前方案生成的最小可运行入口。")

documents = load_markdown_documents("knowledge_base")
chunks = split_documents(documents)

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

st.subheader("文本切分预览")
st.write(f"当前生成 {len(chunks)} 个 chunk。")

if chunks:
    for chunk in chunks[:5]:
        with st.expander(f"{chunk['chunk_id']} · {chunk['char_count']} 字"):
            st.markdown(f"**chunk_id：** `{chunk['chunk_id']}`")
            st.markdown(f"**来源文档：** {chunk['source_title']}")
            st.markdown(f"**字符数：** {chunk['char_count']}")
            preview = chunk["content"][:300]
            if len(chunk["content"]) > 300:
                preview += "..."
            st.text(preview)
else:
    st.warning("未生成文本切分结果，请确认知识库文档内容不为空。")

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
            retrieval_chunks = split_documents(documents)
            results = keyword_retrieve(question, retrieval_chunks, top_k=3)

            st.info("暂不调用大模型，当前仅展示关键词检索结果。")
            st.write(f"当前问题：{question}")

            if results:
                st.markdown("### 检索到的相关资料片段")
                for result in results:
                    with st.expander(
                        f"{result['chunk_id']} · score {result['score']}"
                    ):
                        st.markdown(f"**chunk_id：** `{result['chunk_id']}`")
                        st.markdown(f"**来源文档：** {result['source_title']}")
                        st.markdown(f"**匹配分数：** {result['score']}")
                        preview = result["content"][:300]
                        if len(result["content"]) > 300:
                            preview += "..."
                        st.text(preview)
            else:
                st.warning("暂未从知识库中检索到相关资料。")
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
