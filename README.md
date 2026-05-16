# 企业知识库 RAG 智能助手

这是一个用于简历展示的 Python 项目骨架，定位为「企业知识库智能问答与方案生成助手」。

项目后续将基于 RAG 实现企业资料问答、客户需求分析和售前方案生成。

## 功能规划

- 企业知识库 Markdown 文档加载
- 文档切分与向量化
- 基于知识库的智能问答
- 客户需求分析
- 售前解决方案生成
- Streamlit 前端页面
- FastAPI 后端接口

## 项目结构

```text
enterprise-rag-assistant/
├── api/
│   └── main.py
├── rag/
│   ├── __init__.py
│   ├── chains.py
│   ├── loader.py
│   ├── retriever.py
│   ├── splitter.py
│   └── vector_store.py
├── knowledge_base/
│   ├── FAQ.md
│   ├── 产品介绍.md
│   ├── 教育行业解决方案.md
│   └── 成功案例.md
├── prompts/
│   ├── qa_prompt.md
│   └── solution_prompt.md
├── app.py
├── requirements.txt
├── .env.example
├── .gitignore
└── README.md
```

## 本地运行

安装依赖：

```bash
pip install -r requirements.txt
```

启动 Streamlit 页面：

```bash
streamlit run app.py
```

启动 FastAPI 服务：

```bash
uvicorn api.main:app --reload
```

访问接口：

- `GET /`
- `GET /health`

## 当前阶段

当前仅完成第一阶段基础骨架，不包含 LangChain、Chroma、Embedding 等复杂 RAG 逻辑。
