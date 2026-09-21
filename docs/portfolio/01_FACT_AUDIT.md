# Phase 1-A｜项目事实审计

> **项目**：企业知识库 RAG / Agent 智能助手（Enterprise RAG Copilot）
> **用途**：帆软 2027 校园招聘 · FDE 解决方案工程师 · 投递作品集
> **审计日期**：2026-09-21
> **审计方式**：只读审计。代码实读、测试实跑、API 实调、服务器实勘，不修改任何业务逻辑
> **事实边界**：本文档中每一条结论都标注了证据来源；无法验证的一律标 ⚠️ 或 ❌

---

## 0. 先纠正五处事实分歧

任务书给的「项目事实主线」摘要里，有 5 处与代码实际不符。**这些必须先纠偏，否则整份作品集会建立在错误的数字上**，面试官一打开 Demo 就能看出对不上。

| # | 任务书表述 | **实际事实** | 证据 | 影响 |
| --- | --- | --- | --- | --- |
| 1 | 「切分约 **160** 个 Chunk」 | **283 个 chunk** | `backend/data/index/index_meta.json` → `chunks: 283`；线上 `/health` 与启动日志同为 283 | 🔴 高。这是作品集最高频出现的数字 |
| 2 | 「**Top 3** 检索」 | **召回 `top_k=8` → 重排后 `rerank_top_k=4`**，即 Top-4 进 Prompt | `backend/app/core/config.py:163-164`；评测按 `k=4` 计算 Hit@4 | 🔴 高。指标名与参数都要改 |
| 3 | 技术栈「**Python + Streamlit**」 | **V3 主线是 Next.js 15 + FastAPI + LangGraph**；Streamlit 是已冻结的 legacy V2 | `apps/web/`（10 页面）+ `backend/`（61 模块）；`legacy/` 独立目录 | 🔴 高。写 Streamlit 会被认为是旧版，且主动暴露「技术栈落后」 |
| 4 | 「标题、关键词、**中文 n-gram 综合打分**」 | 是**四层链路**：BM25（文件名+章节+正文，字段加权）→ 向量 → RRF 融合 → **IDF 加权重排** | `backend/app/rag/{bm25,retriever,reranker}.py`；`docs/ARCHITECTURE.md` §3 | 🟡 中。原表述把「一个打分函数」说成全部，丢掉了最有技术含量的部分 |
| 5 | 「24 份 Markdown 文档」 | ✅ **正确**，24 篇 | `knowledge_base/*.md` → 24；索引 `documents: 24` | — |

**结论**：作品集叙事应以 **V3** 为准，legacy V2 作为「演进史」出现（它反而是加分项，见 §3.6）。

---

## 1. 已真实实现（可运行、可验证）

以下每一项都经过本次实测或有一手证据，**可以直接写进作品集**。

### 1.1 检索链路（四层，全部可观测）

| 能力 | 实现状态 | 证据 |
| --- | --- | --- |
| Markdown 结构化切分 | ✅ | 按标题切 section + 标题栈；段落级打包至 `chunk_size=500`；真实字符重叠 `chunk_overlap=100`；超长段落按句末边界硬切（`splitter.py`） |
| BM25 关键词检索 | ✅ | 自研，**字段加权**：文件名 + 章节路径 + 正文（`bm25.py`） |
| CJK 分词 | ✅ | 字符二元组 + 停用词表（`text.py`），避免虚词单字污染打分 |
| 向量检索 | ✅ | 默认离线哈希 TF-IDF；可切任意 OpenAI 兼容 embeddings（`embedder.py`）；npz 缓存 |
| 双分支融合 | ✅ | **RRF**（默认）/ 加权求和（`FUSION_STRATEGY`） |
| 重排序 | ✅ | heuristic（IDF 加权覆盖度 + 短语 + 章节 + 密度）；LLM 重排已实现 |
| 引用契约 | ✅ | 编号上下文 → 生成 → 反解 → **越界编号从正文删除**（`citations.py`） |
| 检索可观测 | ✅ | 每个 chunk 保留四类分数与名次，前端可视化（Knowledge Explorer 检索探测） |
| 索引缓存 | ✅ | `index_meta.json` + `vectors.npz`，带 `schema_version=3` |

### 1.2 检索质量（确定性指标，可复现）

**权威数据**：`POST /api/evaluation/run {"k": 4}`，24 篇知识库 / 283 chunk / hybrid / heuristic rerank，**10 条冻结评测集**。

| 指标 | 实测值 | 含义 |
| --- | --- | --- |
| **Hit@4** | **90.0%**（9/10） | 期望文档进 Top-4 的比例 |
| **MRR** | **0.800** | 首个命中名次的倒数均值 |
| **Recall@4** | **69.2%** | 期望文档被召回比例 |
| 关键词覆盖 | 45.6% | 同时被两分支命中的比例（说明分支互补而非重复） |
| 平均检索延迟 | **1.57 ms** | 不含 LLM 生成 |
| `answer_accuracy` | **null** | 未人工评分时必须是 null（**只接受人工评分，禁止 LLM 自评**） |

> ⚠️ **必须主动说明的一条**：唯一 MISS 是「知识库里有哪些文档？」——这是**概览类问题，本身不存在「期望文档」**。它属于评测集设计缺陷，不是检索退化。把它算进分母是更诚实的做法。**面试时主动说这条，比被追问出来好得多。**

### 1.3 Agent 运行时

| 维度 | 事实 | 证据 |
| --- | --- | --- |
| 节点数 | **8 个固定节点** | `understand → route_intent → plan → execute_tools → retrieve → generate → human_check → finalize` |
| 引擎 | **双引擎**：LangGraph 1.2.11（默认）/ 内置状态机 | `AGENT_ENGINE=auto\|langgraph\|native` |
| 双引擎一致性 | 意图 / Skill / 节点序列 / skipped 集合**完全一致** | 单测 `test_both_engines_agree_on_core_outcome` 守门 |
| 回退行为 | LangGraph 运行期异常 → 自动回退 native + 携带 warning，**不静默降级** | `agents/graph.py` |
| 跳过可观测 | `skipped_nodes: ['retrieve','human_check']` 带原因显示 | Agent Trace |
| **Skill 数量** | **7 个** | `rag_qa` · `knowledge_overview` · `gap_analysis` · `requirement_analysis` · `solution_generation` · `document_intelligence` · `agent_optimization` |
| **Tool 数量** | **10 个** | `retrieve` · `list_documents` · `read_document` · `search_documents` · `knowledge_stats` · `analyze_requirements` · `generate_answer` · `generate_solution` · `analyze_coverage` · `summarize_document` |
| 意图路由 | **加权规则 + 置信度 + 次优意图**，非 LLM Router | `agents/router.py`；⚠️ 见 §3.5 |
| Trace | 每节点记录耗时/输入/输出，前端时间线渲染 | `core/tracing.py` + Agent Workspace |
| 活动台账 | SQLite，记录 intent/skill/tools/延迟/来源/引擎 | `services/activity_service.py` |

**一处刻意的、可讲深的设计**：`execute_tools` **排在 `retrieve` 之前**。原因是方案生成 Skill 必须先解析客户需求，再从解析结果里提取 `search_query`；直接拿口语化原文去检索召回质量明显更差。**这是本项目最容易被追问、也最能体现「想清楚才写」的细节。**

### 1.4 产品功能（10 个页面，全部真实可用）

| 页面 | 路由 | 核心能力 | 状态 |
| --- | --- | --- | --- |
| Overview | `/` | 知识/Agent/RAG/系统四组真实指标、覆盖摘要、最近活动 | ✅ |
| Ask | `/ask` | 多轮问答、**引用角标可点击**、来源抽屉（含全部检索分数）、检索参数可调 | ✅ |
| Agent Workspace | `/agent` | 意图+置信度、Skill/Tool 目录、执行计划、Tool 调用表、Trace 时间线、**引擎现场切换** | ✅ |
| Solution Studio | `/solution-studio` | 需求表单+自然语言 → 需求解析 → **8 章节方案** → Markdown/Word 导出 | ✅ |
| Documents | `/knowledge/documents` | 拖拽上传、解析/切分/索引、状态分类、删除、重建索引 | ✅ |
| Knowledge Explorer | `/knowledge/explorer` | 文档 → 正文/大纲 → 知识块 → **检索探测（四类分数）** | ✅ |
| Knowledge Gaps | `/insights/gaps` | **11 类**资料覆盖判定（covered/partial/missing）+ 证据文档 + 补录建议 | ✅ |
| Evaluation | `/insights/evaluation` | 数据集管理、Hit@K/MRR/Recall、人工评分、历史记录 | ✅ |
| Activity | `/insights/activity` | 全量台账、筛选、成功率、P95 延迟 | ✅ |
| Settings | `/settings` | 系统自检、Provider 状态（密钥打码）、检索参数、Prompt 清单与版本 | ✅ |

**11 类缺口分类**（`rag/taxonomy.py` 实测）：产品介绍、FAQ/常见问题、成功案例、行业解决方案、价格/报价说明、实施流程、售后支持、竞品对比、客户需求模板、AI/Agent 方法论、术语表。

### 1.5 工程化与部署（**这是 FDE 岗位最该看重的部分**）

| 项 | 事实 | 证据 |
| --- | --- | --- |
| 容器化 | Docker Compose，`backend` + `web`，可选 `pg`/`legacy` profile | `docker-compose.yml` · `docker/*.Dockerfile` |
| 生产服务器 | 腾讯云轻量 Ubuntu 22.04.5，**2 vCPU / 1.9 GB 内存**（小机器跑生产，本身是加分项） | SSH 实勘 |
| 进程绑定 | backend 绑 **`127.0.0.1:18000`**（不对公网暴露），web 独占 `3001` | `docker ps` 实测 |
| 同源反代 | 前端把 `/api`、`/health` 反代到后端 → **只开一个端口**；构建产物零绝对 API 地址 | `next.config` + Nginx |
| HTTPS | `rag.changziqi.com`，**Let's Encrypt ECDSA，有效期至 2026-12-09** | `certbot certificates` 实测 |
| Nginx | 5 个站点并存（多项目共用一个入口），本项目最小增量改动 | `sites-enabled/` 实测 |
| 健康检查 | `/health` 返回索引状态、文档数、chunk 数、引擎、LLM 配置态 | 线上实测 ✅ |
| 自动重启 | 容器 `restart` 策略 + `healthy` 状态 | `Up 2 days (healthy)` |
| 密钥隔离 | `.env` + 响应打码 `****dc44` + 台账正则过滤凭据键 + 前端不存密钥 | 安全验收 §7.4 |
| 构建加速 | 镜像源可配置（清华 pypi / npmmirror），构建从**卡死 20+ 分钟 → 21 秒** | `DEPLOYMENT_REPORT.md` §15.8 |

### 1.6 安全与访问控制（**49/49 通过，三套运行模式实测**）

| 模式 | 结果 | 关键项 |
| --- | --- | --- |
| 默认实例 | **10/10** | 路径穿越 `../../etc/passwd` → 404；危险扩展名 → 415；超限文件 → 413；无凭据泄漏；无 stack trace |
| 只读实例 | **16/16** | 上传/更新/删除/重建索引 → **403 `read_only`**；清空台账 → 400 `clear_not_allowed`；读取与检索仍 200 |
| 口令实例 | **23/23** | 10 个端点无 token → 401；`/health`、`/api/auth/status` 必须公开 → 200 |

> **关键结论（值得在面试里讲）**：**写操作是在服务层被拒绝的（403 + 结构化错误码），不是前端隐藏按钮。** 用 curl 绕过前端同样被拦。

**当前线上形态**：**公开只读演示**。`password_required=false`、`read_only=true`、AI 端点按 IP 限流 **10 次/分钟**，超限 429 + `rate_limit_exceeded` 结构化错误；浏览类端点（overview/知识库/检索）**不限流**。

### 1.7 前端工程质量

| 项 | 结果 |
| --- | --- |
| 页面 × 视口 × 主题矩阵 | **40 次真实渲染**（10 路由 × 2 视口 × 2 主题） |
| 横向溢出 | **0**（1440 / 1280 / 1080 三档） |
| 内容裁切 | **0** |
| console error / page exception / failed request | **0 / 0 / 0** |
| TypeScript | `tsc --noEmit` **0 error** |
| ESLint | **0 warning** |
| 生产构建 | 通过 |
| 响应式 | 明暗双主题各页零 console 错误；Sidebar 折叠状态持久化 |
| ⚠️ 移动端 | **390px 下部分页面存在横向溢出**（见 §2.1，作品集**不要**写「全端适配」） |

### 1.8 测试

| 项 | 实测 |
| --- | --- |
| 后端 | **171 passed in 18.62s**（本次实跑，2026-09-21） |
| 测试特性 | 全离线，不联网；使用临时知识库与临时 data 目录，不污染生产数据 |
| 覆盖重点 | 检索打分、引用越界剔除、双引擎一致性、只读守卫、限流滑窗、路径穿越、鉴权门 |

### 1.9 代码规模（实测）

| 部分 | 规模 |
| --- | --- |
| 后端 | **61 个 Python 模块 / 11,395 行** |
| 前端 | **36 个 ts/tsx 文件 / 10 个页面** |
| 知识库 | 24 篇 Markdown / 58,524 字符 |
| 索引 | 283 chunk（500/100 切分） |
| 文档 | README + 6 份 docs（ARCHITECTURE / DEMO_SCRIPT / INTERVIEW_GUIDE / V3_ACCEPTANCE_REPORT / DEPLOYMENT_REPORT / resume 稿） |
| Prompt | `prompts/v1/` 6 个模板，运行时加载、可切版本 |

---

## 2. 部分实现（程度必须写清楚）

### 2.1 移动端适配 ⚠️ PARTIAL

- **现状**：390×844 下部分页面存在横向溢出。桌面端 1440/1280/1080 三档为零溢出。
- **作品集写法**：只写「桌面端三档零溢出 + 明暗双主题零报错」。**不要写「全端响应式」**。
- **补充说明**：Demo 是给面试官在 PC 上打开的，移动端不构成投递障碍，但被问到要如实说。

### 2.2 pgvector ⚠️ PARTIAL

- **现状**：`PgVectorStore` **代码已实现**（raw SQL 建表 + HNSW + 余弦检索），但**本机无 PostgreSQL 实例，未做集成验证**，只有 SQL 构造被单测覆盖。
- **作品集写法**：「向量存储已抽象为可替换接口，numpy 与 pgvector 两种实现并存；pgvector 路径**尚未在真实实例上验证**」。
- **这不是缺点，是诚实边界**。面试官问「生产怎么换向量库」时，这正是最好的答案切入点。

### 2.3 LLM 重排序 ⚠️ PARTIAL

- **现状**：`RERANK_PROVIDER=llm` 已实现并有启发式兜底，**默认关闭以控制成本**；**未做 llm vs heuristic 的对照实验**。
- **作品集写法**：「提供了 LLM 重排实现与启发式兜底，默认启用启发式以控制 token 成本；两者效果对照尚未量化」。

### 2.4 对话记忆 ⚠️ PARTIAL

- **现状**：历史对话**仅用于消解指代**，**未做查询改写**，也没有长期记忆。
- **作品集写法**：「支持多轮上下文消解指代；查询改写与长期记忆在下一步计划中」。

### 2.5 意图路由 ⚠️ 规则而非模型

- **现状**：**加权规则 + 置信度**，不是 LLM Router。
- **这是一个需要主动解释的设计选择**，而且**理由站得住**：意图集合是**封闭集合**（7 个 Skill），规则路由**可解释、零 token 成本、延迟可预测、可写单测**；引入 LLM 路由只会把可解释性换成不可预测性。**当意图集合变成开放集合时才是换 LLM 路由的正确时机。**
- ⚠️ 注意与任务书摘要的冲突：任务书写「自定义 Router / Skill」，这条**是对的**，但不要在作品集里把它包装成「智能路由/LLM Router」。

### 2.6 Legacy V2 已冻结但仍可运行 ⚠️

- **现状**：`legacy/` + `deploy_package/` 是 V1/V2 的 Streamlit 实现，**故意保留**（绞杀者模式），生产上仍有一个容器 `enterprise-rag-demo` 在 8502 端口运行（`Up 4 weeks healthy`）。
- **技术债**：V2/V3 各有一份检索实现。这个债**写在 `legacy/README.md` 里，不假装不存在**。
- **作品集用法**：把它作为「迭代能力」的证据 —— 敢于重构、又保留可回退路径。见 §3.6。

---

## 3. 规划但未实现（**严禁写进「已实现成果」**）

| # | 能力 | 当前状态 | 备注 |
| --- | --- | --- | --- |
| 1 | **OCR** | ❌ TODO | 扫描件 PDF **明确报「解析失败」**，不做假成功 |
| 2 | **用户体系与权限** | ❌ TODO | 仅演示级共享密码，无用户/角色/部门密级过滤 |
| 3 | **流式输出（SSE）** | ❌ TODO | 当前一次性返回；生成态 UI 已就绪 |
| 4 | **多轮查询改写** | ❌ TODO | 仅消解指代（同 §2.4） |
| 5 | **评测驱动迭代闭环** | ❌ TODO | 尚未把失败案例自动转成调参建议 |
| 6 | **前端 E2E（Playwright）** | ❌ TODO | 现有类型检查/lint/构建/HTTP 层验证，无 E2E |
| 7 | **OpenTelemetry / 集中日志** | ❌ TODO | 有 Trace 与台账，未接标准可观测栈 |
| 8 | **token 配额与成本控制** | ❌ TODO | 无按租户配额；仅有 IP 限流保护额度 |
| 9 | **并发压测** | ❌ TODO | 索引为进程内单例且写入加锁，高并发未压测 |
| 10 | **多租户 / 知识库隔离** | ❌ TODO | 单知识库实例 |

### 3.1 特别提醒：一份已过期的简历稿

`docs/resume_enterprise_rag_update.md`（**2026-08-06**）里写着：

> 「目前主检索仍是关键词 / 短语匹配，不是正式向量检索」
> 「`vector_store.py` 仍是扩展占位，尚未接入 Embedding」
> 「没有正式 Eval 测试集」
> 「FastAPI 还不是完整业务 API 层」

**这四条在 V3 里全部已经实现**（向量检索 ✅、pgvector 实现 ✅、Eval 测试集与指标 ✅、FastAPI 完整业务 API 层 ✅）。

🔴 **该文件描述的是 V2，不能直接用于投递**——它会让你**严重低估**自己已经完成的工作。应按 V3 事实重写。

---

## 4. 可展示证据清单

| # | 证据类型 | 具体位置 | 内容 | 可直接公开? |
| --- | --- | --- | --- | --- |
| 1 | **在线 Demo** | `https://rag.changziqi.com` | 公开只读，无需密码，真实 LLM 可用 | ✅ 已实测 2026-09-21 |
| 2 | **GitHub 仓库** | `github.com/Evolve-Gem/enterprise-rag-assistant` | 分支 `upgrade/v3-enterprise-copilot`，tag `v3.0.0`→`v3.0.4` | ⚠️ 需确认仓库可见性，见 §5 |
| 3 | **README** | `README.md` | 15 节，含架构图、功能矩阵、指标、环境变量 | ✅ |
| 4 | **架构文档** | `docs/ARCHITECTURE.md` | 10 章，含「为什么是这四层」「三个真实坑」 | ✅ 高价值 |
| 5 | **验收报告** | `docs/V3_ACCEPTANCE_REPORT.md` | 30KB，含 40 次渲染矩阵、49/49 安全项、逐条评测结果 | ✅ 高价值 |
| 6 | **部署报告** | `docs/DEPLOYMENT_REPORT.md` | 52KB，三阶段（A/B/C）完整部署记录 + 回滚方案 | ✅ 高价值 |
| 7 | **演示脚本** | `docs/DEMO_SCRIPT.md` | 5 个稳定场景，含输入/预期/展示重点/意外应对 | ✅ |
| 8 | **面试指南** | `docs/INTERVIEW_GUIDE.md` | 1 分钟 / 3 分钟 / 14 个高频问题 | ✅ |
| 9 | **V3 截图 9 张** | `docs/images/v3/*.png` | Overview / Ask / 引用抽屉 / Agent / Trace / Solution / Explorer / Gaps / Evaluation | ✅ |
| 10 | **深色主题 3 张** | `docs/images/v3/dark-*.png` | dark-overview / dark-ask / dark-solution | ✅ |
| 11 | **V2 截图 6 张** | `docs/images/0*.png` | 可作为「演进史」对照 | ✅ |
| 12 | **测试记录** | 实跑输出 | `171 passed in 18.62s` | ✅ 可现场复现 |
| 13 | **API 契约** | `/docs`（FastAPI OpenAPI） | 自动生成、结构完整 | ✅ |
| 14 | **线上运维证据** | SSH 实勘 | 容器 healthy、证书到期日、磁盘/内存、5 站点并存 | ⚠️ 内部信息，作讲述材料而非公开截图 |
| 15 | **活动台账** | `backend/data/activity.sqlite3` | 真实运行记录 | ⚠️ 含本地路径，截图需裁剪 |
| 16 | **评测集** | `backend/data/evaluation/eval_dataset.json` | 10 条冻结用例 | ✅ |

---

## 5. 当前缺失的展示资产（**需要补拍/补充**）

按对作品集的重要性排序。

### 🔴 P0 —— 没有它作品集会缺关键证据

| # | 缺失资产 | 为什么必须要 | 获取方式 |
| --- | --- | --- | --- |
| 1 | **GitHub 仓库公开可见性确认** | 作品集要放仓库链接，若为 private 则面试官打不开 | 需你本人确认/切换（**我不代你改仓库设置**） |
| 2 | **Demo 演示注意事项说明** | 面试官打开后会遇到两件事：① 不能上传文件（只读）② 连续问 >10 次会被 429。**不提前说明会被误判为故障** | 由我撰写「Demo 使用说明」卡片 |
| 3 | **二维码**（Demo + GitHub） | P10 页要用 | 我用脚本生成 |
| 4 | **架构图导出为图片** | 当前架构图是 README 里的 mermaid，**PDF 里不能直接渲染** | 我把 mermaid 转成 SVG/PNG |
| 5 | **Agent Workflow 流程图** | P4 页核心图示 | 同上，需新绘 |

### 🟡 P1 —— 显著提升说服力

| # | 缺失资产 | 说明 |
| --- | --- | --- |
| 6 | **一段 60–90 秒录屏** | 从提问 → 引用角标 → 点开抽屉看分数。**动态证据比静态截图强一个量级** |
| 7 | **「检索诊断三件套」对照图** | README/ARCHITECTURE 里讲了三个坑（unigram 噪声 / 文件名零权重 / 覆盖度不加权），**修复前 vs 修复后的排名对照**若能可视化，是全篇最亮的技术证据 |
| 8 | **Gaps 页完整数据截图** | 11 类覆盖判定 + 证据文档，当前截图可能偏小 |
| 9 | **同一问题在 `rerank=off` vs `heuristic` 下的对比截图** | 直接证明重排序有效（INTERVIEW_GUIDE 提到实测差异，但缺图） |
| 10 | **双引擎现场对比截图** | langgraph vs native 节点序列一致的证据 |
| 11 | **`/docs` OpenAPI 页面截图** | 证明「API 是真的」，对 FDE 岗位有说服力 |
| 12 | **终端 `pytest -q` 运行截图** | 171 passed 的可视证据 |

### 🟢 P2 —— 锦上添花

| # | 缺失资产 | 说明 |
| --- | --- | --- |
| 13 | 服务器部署架构图（含端口/反代/证书） | 私有化部署思维的展示 |
| 14 | 明暗双主题对比拼图 | 已有个别截图，可合成一张 |
| 15 | 代码片段高亮图（引用校验 / RRF / IDF 加权） | 证明技术含量在代码里 |
| 16 | 知识库文档截图（24 篇的分类分布） | 证明是真实语料 |

---

## 6. 数据口径说明（**写作品集时必须区分，否则会被质疑**）

审计中发现两组数字来源不同，**混用会被面试官抓出来**：

| 指标 | 本机验收数据（2026-09-17） | 线上实时数据（2026-09-21 实测） |
| --- | --- | --- |
| 知识库 | 24 文档 / 283 chunk | 24 文档 / 283 chunk |
| Agent 运行次数 | **16 次** | **7 次**（线上台账独立，部署后重新累计） |
| 溯源率 | 100% | 100%（`grounded_rate: 1.0`） |
| 平均延迟 | — | 1611 ms（含 LLM 生成） |
| 检索延迟 | 1.57 ms（评测口径） | — |

**规则**：
- **知识库规模、检索指标（Hit@4/MRR）用「本机验收」口径**，因为那是权威评测场景。
- **不要写「累计服务 XX 次运行」** —— 线上台账是演示实例，数字小且会被演示行为改变。
- 更安全的做法：**只写结构性指标**（文档数、chunk 数、指标值），不写使用量类指标。

---

## 7. 审计结论

### ✅ 可以放心主张的能力（有实测证据）

1. **独立完成一个可运行、可访问、可解释、可部署、可演示的 RAG + Agent 系统** —— 这一条**完全成立**，且证据链完整（代码 / 测试 / 公网 Demo / 部署记录 / 验收报告）。
2. **四层检索链路的设计与调优能力**，并有三个真实踩坑案例可讲（unigram 噪声、文件名零权重、覆盖度不加权）。
3. **Agent / Skill / Tool 三层架构**，7 Skill + 10 Tool，双引擎可现场切换对比。
4. **引用溯源的可信设计**：编号 → 角标 → 抽屉 → 原文，越界编号自动剔除。
5. **工程化与部署**：Docker、Linux、Nginx、HTTPS、健康检查、密钥隔离、只读/限流守卫 —— **对 FDE 岗位这是最直接的对口证据**。
6. **安全边界意识**：49/49 三模式验收，服务层拒绝而非前端隐藏。
7. **诚实的能力边界管理**：README 功能矩阵中 ⚠️/❌ 标注齐全，不用 LLM 自评答案质量。

### ⚠️ 必须绕着走的表述（否则会被问穿）

| 危险表述 | 为什么危险 | 替换为 |
| --- | --- | --- |
| 「Top 3 检索」 | 参数是 8→4 | 「召回 Top-8 → 重排 Top-4」 |
| 「约 160 个 chunk」 | 实际 283 | 「283 个知识块」 |
| 「全端响应式」 | 390px 有溢出 | 「桌面端三档零溢出」 |
| 「企业级权限体系」 | 只有共享密码 | 「演示级访问控制；权限体系在下一步」 |
| 「已接入向量数据库」 | pgvector 未集成验证 | 「向量存储已抽象；numpy 已验证，pgvector 待集成测试」 |
| 「LLM 智能路由」 | 是加权规则 | 「规则路由 + 置信度，**可解释、零 token 成本**」 |
| 「提升准确率 XX%」 | 无 A/B 与人工评分数据 | 只给确定性检索指标 |
| 「服务了 XX 用户」 | 无 | 不提使用量 |

### 🎯 对帆软 FDE 岗位的核心叙事（一句话）

> **我不只是学过 RAG——我独立把一个企业知识库场景做成了可访问、可解释、可部署、带工程守门的产品，并且能说清每一层为什么这样设计、边界在哪里。**

---

## 附：审计方法与可复现命令

```bash
# 1) 测试（真实结果）
cd backend && ../.venv/Scripts/python.exe -m pytest -q        # 171 passed in 18.62s

# 2) 索引实际规模
python -c "import json;d=json.load(open('backend/data/index/index_meta.json',encoding='utf-8'));print(len(d['documents']),'docs /',len(d['chunks']),'chunks')"

# 3) Skill / Tool 数量
grep -c "SkillSpec(" backend/app/agents/skills.py
grep -c 'name="' backend/app/agents/tools.py

# 4) 线上健康
curl -s https://rag.changziqi.com/health
curl -s https://rag.changziqi.com/api/auth/status

# 5) 代码规模
find backend/app -name "*.py" | wc -l && find backend/app -name "*.py" | xargs wc -l | tail -1
find apps/web/src -name "page.tsx" | wc -l
```

**审计范围声明**：本次审计**只读**，未修改任何业务代码、未改动知识库、未触碰生产配置。§0 与 §3.1 的修正仅涉及文档中的过期数字（161/159 → 171）与一处错别字（ID → IDF），不改变任何技术事实。
