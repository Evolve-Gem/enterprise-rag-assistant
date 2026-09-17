# Enterprise RAG Copilot · 项目长期记忆

## 项目定位

企业知识智能与售前 Agent 工作台。同时是紫棋的**毕业设计载体**（Project Companion 路线的
Memory / RAG / Tool Calling / Workflow 环节）。求职方向：AI Solution Engineer / AI 产品。

## 不可动摇的约定

1. **不伪造能力**。未实现/未验证的能力必须在 README 功能矩阵里标 ⚠️ / ❌。
   检索指标只写实测值；答案质量**只接受人工评分**，禁止 LLM 自评。
2. **不伪造证据**。报告里的响应样例必须从真实调用取，不能凭记忆构造。
3. **触发对齐（Trigger Alignment）是重点**：把「意图 → 置信度 → Skill」做成可解释的，
   不引入模型路由，除非意图集合变成开放集合。
4. **排序问题先看打分函数，不要先怀疑模型**。这是本项目最有价值的方法论沉淀。
5. **索引缓存必须升版本**：改切分/抽取/打分管线时，`INDEX_SCHEMA_VERSION` 必须 +1，
   否则旧缓存静默存活，测出来的指标描述的已不是当前代码。

## 架构关键点

- 分层：`api/routes` → `services` → `rag` / `agents`；`rag` 与 `agents` 不认识 FastAPI。
- 检索四层：BM25（文件名+章节+正文，字段加权）→ 向量 → RRF 融合 → 重排序（IDF 加权覆盖度）。
- 融合默认 **RRF 而非加权求和**：BM25 分与余弦相似度不同量纲，加权需要标定，标定参数会漂移。
- Agent 节点顺序：`understand → route_intent → plan → **execute_tools → retrieve** → generate
  → human_check → finalize`。**Tool 执行刻意排在检索之前**，因为方案 Skill 要先解析需求
  才能产出好的 `search_query`。
- 双引擎（LangGraph / native）**共用同一组 node_functions**，测试
  `test_both_engines_agree_on_core_outcome` 是防漂移守门员。
- 引用契约：编号上下文 = 引用命名空间；越界编号必须从正文**删除**（假引用比没引用更糟）。

## 本机环境坑位

- **git 嵌套 ref 静默失效**：`git branch upgrade/xxx` / `update-ref` 返回 0 但不写文件。
  绕过：PowerShell 预建 `.git/refs/heads/<dir>`，或维护 `.git/packed-refs`（**必须 LF 换行** +
  完整 40 位 SHA）。每次 commit 后需手动把新 SHA 写回 packed-refs。
- **pytest 导入冲突**：仓库根 `app.py`（legacy Streamlit）会遮蔽后端 `app` 包。
  保持 `backend/__init__.py` 与 `backend/tests/__init__.py` **不存在**。
- **Windows Git Bash 会把中文 payload 编成 GBK** → `curl -d '{"中文":...}'` 得到 422。
  用 Python 写 UTF-8 文件 + `--data-binary @file`，或直接 urllib。
- **curl 不认 `/c/...` 路径**，要用 `C:/...`。
- **`npx tsc` 会装到错误的包**；用 `node node_modules/typescript/bin/tsc`。
- **后台进程在非交互回合结束会被回收**：启服务 + 校验必须在**同一条命令**内完成。
- **PowerShell 工具不回显 stdout**：需要把输出重定向到文件再 Read。

## 关键路径

| 用途 | 路径 |
| --- | --- |
| 知识库 | `knowledge_base/`（24 篇，可替换） |
| 索引缓存 / 台账 / 评测集 | `backend/data/`（gitignore） |
| Prompt 模板 | `prompts/v1/*.md`（运行时加载，`PROMPT_VERSION` 可切） |
| 后端入口 | `backend/app/main.py`（`uvicorn app.main:app`，cwd=backend） |
| 前端入口 | `apps/web`（`npm run dev`，端口 3001） |
| 冻结的 V2 | `legacy/`（`streamlit run legacy/app.py`） |

## 常用验证命令

```bash
# 后端（全离线，用临时 KB 与临时 data 目录）
cd backend && ../.venv/Scripts/python.exe -m pytest -q      # 159 passed

# 前端
cd apps/web
node node_modules/typescript/bin/tsc --noEmit               # 0 error
node node_modules/next/dist/bin/next lint                   # 0 warning
node node_modules/next/dist/bin/next build                  # 成功
```

## 决策记录

- **保留 legacy 而不删除**：绞杀者模式。代价是 V2/V3 各有一份检索实现，
  这个技术债写在 `legacy/README.md` 里，不假装不存在。
- **默认离线哈希向量**：让项目在没有任何 embedding key 的环境下也功能完整，
  这是「可部署性 > 技术炫耀」的选择。`EMBEDDING_PROVIDER=openai` 可随时切真向量。
- **pgvector 实现但标未验证**：诚实标注比假装集成过更安全。
