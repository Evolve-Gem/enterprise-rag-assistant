# 企业知识库智能问答与方案生成助手

## 项目简介

这是一个基于 RAG 思路构建的企业知识库问答与售前方案生成工具，用于模拟技术销售 / 解决方案工程师 / 技术型产品经理在售前场景中的资料查询、客户需求理解和方案初稿生成。

项目通过读取企业 Markdown 知识库资料，将文档切分为可检索片段，并基于关键词检索召回相关内容，再调用 DeepSeek API 生成结构化回答或售前方案。

## 项目亮点

- 支持企业 Markdown 知识库读取。
- 支持文档切分与资料片段管理。
- 支持关键词检索相关资料。
- 支持基于 DeepSeek API 的 RAG 问答。
- 支持根据客户需求生成结构化售前方案。
- 适合技术销售 / 解决方案工程师场景。

## 核心功能

### 知识库问答模式

输入：用户提出的企业资料相关问题。

处理流程：

1. 读取 `knowledge_base` 目录下的 Markdown 文档。
2. 将文档切分为 chunks。
3. 使用关键词检索相关资料片段。
4. 将检索片段和用户问题提交给 DeepSeek API。

输出结果：展示检索到的相关资料片段，并生成基于知识库内容的结构化回答。

### 方案生成模式

输入：客户背景、业务诉求或售前需求描述。

处理流程：

1. 基于客户需求检索相关企业资料、行业方案和成功案例。
2. 展示匹配到的方案参考资料。
3. 调用 DeepSeek API，生成结构化售前方案初稿。

输出结果：生成包含客户背景理解、核心需求、推荐方案、功能模块、实施步骤、预期价值和参考资料来源的售前方案。

## 技术栈

- Python 3.12
- Streamlit
- FastAPI
- DeepSeek API
- OpenAI SDK
- python-dotenv
- Git / GitHub

## 项目架构

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
└── README.md
```

目录说明：

- `api/`：FastAPI 后端接口，包含项目基础信息接口和健康检查接口。
- `rag/`：RAG 核心逻辑，包括文档读取、文本切分、关键词检索和 DeepSeek 调用链路。
- `knowledge_base/`：模拟企业知识库资料，使用 Markdown 文件维护。
- `prompts/`：问答和方案生成的 Prompt 模板。
- `app.py`：Streamlit 可视化页面入口。
- `requirements.txt`：项目依赖列表。

## 核心流程

知识库问答流程：

```text
Markdown 文档 → 文档读取 → 文本切分 → 关键词检索 → DeepSeek 生成回答
```

方案生成流程：

```text
客户需求 → 检索相关资料 → DeepSeek 生成售前方案
```

## 本地运行方式

创建虚拟环境：

```powershell
py -3.12 -m venv .venv
```

激活虚拟环境：

```powershell
.\.venv\Scripts\Activate.ps1
```

安装依赖：

```powershell
pip install -r requirements.txt
```

配置环境变量：

```powershell
Copy-Item .env.example .env
```

然后在 `.env` 中填写 DeepSeek API Key。

启动 Streamlit 页面：

```powershell
streamlit run app.py --server.port 8502
```

启动 FastAPI 服务：

```powershell
uvicorn api.main:app --reload --port 8001
```

FastAPI 接口：

- `GET /`
- `GET /health`

## 环境变量说明

项目根目录需要创建 `.env` 文件：

```env
DEEPSEEK_API_KEY=your_api_key_here
```

注意：`.env` 用于保存本地私密配置，不应提交到 GitHub。真实 API Key 不应写入代码或 README。

## 当前项目状态

当前已完成 MVP 核心链路：

- 知识库读取
- 文本切分
- 关键词检索
- RAG 问答生成
- 售前方案生成

## 后续优化方向

- 引入 Chroma / Embedding 实现向量检索。
- 优化检索排序和引用来源展示。
- 增加上传企业资料功能。
- 增加方案导出为 Word / PDF。
- 优化 UI 和演示截图。
- 整理软著申请材料。

## 求职场景价值

该项目用于展示从业务场景到 AI 应用原型的完整落地能力，覆盖知识库构建、资料检索、Prompt 设计、LLM API 调用和可视化交互。

项目体现的能力包括：

- AI 应用落地能力。
- ToB 业务理解。
- 技术销售 / 解决方案工程师思维。
- RAG 基础理解。
- 项目工程化与版本管理能力。
