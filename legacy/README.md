# Legacy — Streamlit Demo（已冻结）

这里是 V2 版本的单文件 Streamlit 演示，**保持可运行但不再演进**。
V3 的产品形态是 `backend/`（FastAPI）+ `apps/web/`（Next.js）。

## 为什么保留

1. **零回归**：V3 是新增，不是重写。旧版本随时可以跑起来做对照。
2. **面试讲解对比**：可以现场对比「Streamlit 原型」与「前后端分离产品」在
   信息密度、可观测性、可部署性上的差别。
3. **行为基线**：V3 的关键行为（关键词检索、方案生成章节结构）沿用自这里，
   保留原实现便于追溯设计演进。

## 如何运行

在**仓库根目录**执行（`knowledge_base/` 在根目录，legacy 需要读它）：

```powershell
# 使用项目共享的虚拟环境
.\.venv\Scripts\activate
pip install -r legacy\requirements.txt
streamlit run legacy/app.py --server.port 8502
```

或使用 Docker：

```powershell
docker build -f legacy/Dockerfile -t rag-legacy .
docker run --rm -p 8502:8501 --env-file .env rag-legacy
```

## 文件说明

| 路径 | 说明 |
| --- | --- |
| `app.py` | Streamlit 入口；文件头部有 `sys.path` 引导，因此可以从根目录启动 |
| `agent_core.py` | V2 的规则型 Agent（意图 → Skill → Tool），V3 已重写为图执行 |
| `kb_tools.py` | V2 的知识库读写工具（含只读模式与路径校验） |
| `rag/` | V2 的 RAG 链路：loader / splitter / retriever / chains（硬编码 Prompt） |
| `api/` | V2 的最小 FastAPI（仅 `/` 与 `/health`） |
| `prompts/` | V2 的 Prompt 文件。注意：**V2 并没有真正加载它们**，Prompt 是硬编码在 `rag/chains.py` 里——这正是 V3 引入 `prompts/v1/` + 运行时加载的原因 |
| `requirements.txt` | V2 依赖（Streamlit 栈） |
| `Dockerfile` | V2 的容器构建 |

## 与 V3 的关系

V2 的 `rag/`、`kb_tools.py`、`agent_core.py` 在 V3 中被**重新实现**而不是复用：

- 检索：关键词打分 → BM25 + 向量 + RRF 融合 + 重排序
- 切分：定长窗口 → 标题感知切分（保留章节路径）
- Agent：`if/elif` 路由 → LangGraph / 原生状态机双引擎 + 完整 Trace
- Prompt：硬编码 f-string → `prompts/v1/*.md` 运行时加载

一份刻意的技术债：V2 与 V3 各有一份检索实现。这是「绞杀者模式（Strangler Fig）」
的代价——先让新链路完全独立地站稳，再决定是否让 legacy 反向依赖 V3。
