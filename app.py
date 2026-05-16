import streamlit as st


st.set_page_config(page_title="企业知识库 RAG 智能助手", page_icon="📚")

st.title("企业知识库 RAG 智能助手")
st.caption("企业资料问答、客户需求分析与售前方案生成的最小可运行入口。")

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
