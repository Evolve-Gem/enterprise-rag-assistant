# 架构说明 · Architecture

本文记录 Enterprise RAG Copilot 的技术决策、模块边界与踩过的真实问题。
**只写已经实现的东西**，未做验证的部分会明确标注。

---

## 1. 分层与依赖方向

```
apps/web  ──HTTP/JSON──▶  backend/app/api  ──▶  backend/app/services  ──▶  backend/app/rag
                                                          │                      │
                                                          └──▶  agents  ──────────┘
```

| 层 | 允许做 | 禁止做 |
| --- | --- | --- |
| `api/routes` | 解析请求、调用服务、返回 Schema | 写业务逻辑、直接读写文件 |
| `services` | 编排、持久化、跨模块组合 | 处理 HTTP 状态码、构造 JSON 响应 |
| `rag` / `agents` | 检索、生成、图执行 | 知道 FastAPI、知道 SQLite |
| `core` | 配置、日志、错误、安全、追踪 | 依赖上层 |

**为什么这样切**：让「换前端」和「换向量库」都只影响一层。
实际验证过：`VECTOR_STORE` 从 `numpy` 换成 `pgvector` 只需要改环境变量，检索器一行不动。

---

## 2. 索引（KnowledgeIndex）

单一进程内单例，职责：

```
scan → extract → classify → chunk → BM25 fit → embedder fit → vector upsert → persist cache
```

**关键决策**

| 决策 | 理由 |
| --- | --- |
| 磁盘缓存 + `INDEX_SCHEMA_VERSION` | 重启不重新 embedding；**改管线必须手动升版本号**，否则旧缓存会静默存活，测出来的指标描述的已经不是当前代码 |
| 指纹 = `size:mtime` | 比全文哈希便宜，且对编辑敏感 |
| 文档正文上限 200k 字符 | 防止超大 PDF 撑爆内存；chunking 仍用全文 |
| 抽取失败 ⇒ `status=failed` | 扫描件 PDF 的文本层为空。**宁可报失败，也不静默索引成空文档** |
| YAML front-matter 剥离 | front-matter 是元数据不是正文；把它当正文时，一个「键值对墙」chunk 会靠关键词密度赢下向量检索 |

---

## 3. 检索：为什么是这四层

```
BM25（关键词） ┐
               ├─▶ RRF 融合 ─▶ 重排序 ─▶ 编号上下文
向量（语义）   ┘
```

### 3.1 为什么需要混合

| | BM25 | 向量 |
| --- | --- | --- |
| 强项 | 产品名、错误码、缩写、精确术语 | 同义改写、自然语言提问 |
| 弱项 | 用户与文档用词不一致时召回不到 | 稀有专有名词容易漂移 |

两者失败模式几乎正交，所以融合的收益是真实的。

### 3.2 为什么默认 RRF 而不是加权求和

BM25 分数（无上界）与余弦相似度（0–1）**不同量纲**。
直接加权必须先做分数标定，而标定参数会随语料漂移。RRF 只用**名次**：

```
score(d) = Σ_branch 1 / (k + rank_branch(d))     k = 60
```

代价是丢弃了分数的绝对差距，收益是不需要维护标定参数。`FUSION_STRATEGY=weighted` 仍然保留，供语料稳定后调优。

### 3.3 重排序：IDF 加权覆盖度

初版覆盖度是「命中的查询词数 / 查询词总数」，会把「顺带提到」判得和「真正定义」一样好：

| 候选片段 | 命中词 | 朴素覆盖度 | 实际相关性 |
| --- | --- | --- | --- |
| `RAG.md`「RAG 解决了什么问题」 | rag, 解决, 问题 | 0.75 | 低（主题是 RAG 与 Agent 的区别） |
| `检索链路.md`「Rerank 是…重新评分…」 | rerank | 0.25 | **高（就是定义）** |

修复方式是给每个查询词乘上它的 IDF 并做 min-max 归一化：

```
coverage = Σ idf(t) · [t ∈ chunk]  /  Σ idf(t)
```

最没有信息量的查询词权重为 0，最稀有的为 1。修复后「定义」chunk 稳定排到第 1。

> 这是本项目里最值得讲的一个细节：**排序问题常常不是模型不够强，而是打分函数把稀有信号和高频噪声同等对待**。

### 3.4 检索诊断三件套

```bash
# 1) 单查询全分支对照
GET /api/rag/retrieve?q=Rerank&top_k=5&mode=hybrid

# 2) 前端 Knowledge Explorer → 检索探测（可视化分数条）
# 3) 评测集批量回归
POST /api/evaluation/run  {"k": 4}
```

任何检索改动都必须先跑这三步，再谈效果。

---

## 4. Agent 运行时

### 4.1 节点顺序与那次刻意的「反直觉」

```
understand → route_intent → plan → execute_tools → retrieve → generate → human_check → finalize
```

教科书顺序通常是「先检索再执行」，但方案生成 Skill 必须**先解析客户需求**才能得到好的检索查询：

```
原始需求（口语化）  →  search_query: "职业院校 招生政策 教务知识库 私有化部署"  →  检索
```

所以 `execute_tools`（准备阶段）排在 `retrieve` 之前。这是有意的偏离，代码里有注释。

### 4.2 Skill 的 `prepare` / `generate` 两段式

```python
@dataclass
class SkillSpec:
    prepare: PrepareFn | None      # 确定性 Tool 调用；可写 scratch["retrieval_query"]
    generate: GenerateFn           # 把证据组织成最终产物
    requires_retrieval: bool       # 图是否需要跑 retrieve 节点
```

好处：节点顺序固定，但 Skill 可以自由决定「要不要检索、检索什么词、输出什么形状」。
`knowledge_overview` / `agent_optimization` 两个 Skill 的 `requires_retrieval=False`，因此 `retrieve` 节点会被显式标记为 `skipped` —— **跳过也是可观测事件**。

### 4.3 双引擎如何保证不分叉

两个引擎调用**同一组 `node_functions()`**：

```python
# native
for name, fn in self.node_functions().items():
    fn(state, context)
    if len(state.trace.steps) > state.max_steps: break

# langgraph
graph = StateGraph(_GraphState)
for name in NODE_ORDER: graph.add_node(name, wrap(functions[name]))
graph.add_edge(START, NODE_ORDER[0])
...
graph.compile().invoke({"agent": state})
```

LangGraph 用单键 channel `{"agent": AgentState}` 承载可变状态，避免为两个引擎各写一套状态映射。
测试 `test_both_engines_agree_on_core_outcome` 就是防止两者行为漂移的守门员。

### 4.4 意图路由为什么还是规则

| 方案 | 成本 | 可解释 | 可测试 | 当前需求 |
| --- | --- | --- | --- | --- |
| 加权关键词规则 | 0 | ✅ 能说出命中了哪个词 | ✅ 纯函数 | **够用** |
| 小模型分类 | 每次调用 | ❌ 黑盒 | ❌ 需要标注集 | 后续 |
| 规则 + 模型兜底 | 低 | ✅ | ✅ | 下一步 |

七个意图是**封闭集合**，规则命中的准确率已经足够；再加置信度、次优候选与理由，就能满足可解释性要求。
模型路由的收益要等到「意图开放、表述高度多样」时才显现。

---

## 5. 引用与溯源（Grounding）

契约：**模型看到的编号上下文就是引用命名空间**，`[3]` 只能指向第 3 个块。

```
format_context()   → 编号块（供 Prompt）
build_citations()  → 同一顺序的 Citation 行
analyse_grounding()→ 从答案正文反解实际用到的编号
strip_invalid_citations() → 删掉越界编号
```

三个校验结果都会被渲染出来：

- **越界编号**（模型编了 `[7]` 但只有 4 个块）→ 从正文移除 + 步骤状态置 `warning` + 前端提示
- **零引用** → 标记为「弱溯源」
- **全部有效** → `grounded = true`

**为什么必须删越界编号**：一个指向不存在来源的 `[7]` 比没有编号更糟，因为它看起来可信。

---

## 6. 可观测性

### 6.1 Trace

`TraceRecorder.step()` 上下文管理器负责计时：

```python
with trace.step("retrieve", "检索知识库", tool="retrieve") as step:
    outcome = pipeline.retrieve_only(query)
    step.summary = f"命中 {len(outcome.items)} 段"
    step.outputs = {...}
```

产出的是**真实执行的耗时**，不是事后拼的说明文字。前端 Agent Timeline 直接渲染它。

### 6.2 活动台账（SQLite）

| 决策 | 理由 |
| --- | --- |
| SQLite 而非 PostgreSQL | 单机演示场景零运维；聚合用 SQL 完成；写入加锁防 ASGI 并发损坏 |
| JSONL 备用后端 | 只读文件系统或 SQLite 不可用时仍可记录 |
| `_sanitize_meta` 正则过滤 | 按**字段名分段**匹配 `key/secret/token/password/credential/dsn/...`；同时白名单 `tokens_used`、`total_tokens` 这类合法计数器 |
| 上限裁剪 | `ACTIVITY_MAX_RECORDS` 默认 2000，防止无限增长 |

> 这个过滤器是被测试逼出来的：最初的精确匹配放过了 `secret_key` 和 `credential`。
> 现在的测试 `test_activity_sanitizer_drops_credential_keys` 用一个 canary 值做真实泄漏断言。

---

## 7. 安全

| 面 | 措施 |
| --- | --- |
| 路径穿越 | `resolve_within()` 走 `Path.resolve()` 后校验父子关系，拒绝绝对路径逃逸与符号链接逃逸 |
| 上传文件名 | `sanitize_filename()`：剥离目录成分、NFKC 归一化、过滤非法字符、中和 Windows 保留名（`CON`/`LPT1`…） |
| 上传限制 | 后缀白名单 + 大小上限（`MAX_UPLOAD_BYTES`），超限返回 413 |
| 只读演示 | `DEMO_READ_ONLY=true` 时所有写操作在服务层抛 `ReadOnlyError`（403），**不是靠前端隐藏按钮** |
| 访问密码 | 常量时间比较 + HMAC 派生无状态会话令牌；不建会话表，重启不掉线，也没有会话存储可泄漏 |
| 密钥 | 后端只返回 `configured: bool` 与 `****1234` 提示；台账按字段名过滤；前端不存储任何密钥 |
| 错误响应 | 统一 `{error:{code,message,details}}`；500 只返回 `reference` 短码，堆栈只进服务端日志 |
| 前端响应头 | `nosniff` / `Referrer-Policy` / `X-Frame-Options` |

---

## 8. 前端工程

### 8.1 Design System

`globals.css` 用 Tailwind v4 `@theme` 定义全部 Token，明暗两套值分别调过（不是机械反色）：

```
surface / canvas / sunk    中性面
ink / ink-soft / ink-muted 文字层级
line / line-strong         描边
accent (+soft/+line/+ink)  品牌色，只用于描边、图标与小面积填充
success / warning / danger / info
viz-1..6                   数据可视化色序（按色盲可分辨性排序）
```

### 8.2 `useAsync` 的一个真实类型坑

最初写成：

```ts
return { ...state, reload: run, setState };   // state 是可辨识联合
```

**展开一个联合类型会丢失 `status` 与 `data` 的相关性**，于是 `if (r.status === "success") r.data.x` 全部报错。
改成显式构造每个变体 + `useMemo` 后恢复收窄；并把 `idle` 从联合中删掉（首帧即 `loading`），让调用点可以三段穷尽。

另一个坑：**在 `useEffect` / `useMemo` 这类闭包里，属性访问的类型收窄会失效**。
统一改成先在闭包内取局部常量再判断，例如：

```ts
useEffect(() => {
  const listData = list.status === "success" ? list.data : null;
  if (!listData) return;
  ...
}, [list]);
```

### 8.3 加载态设计

不用转圈 spinner，而是**把真实管线画出来**：

```
理解问题 → 检索知识库 → 阅读知识片段 → 重排序证据 → 生成回答
```

配一个手绘 SVG「知识精灵」小知（`components/mascot/`），七个状态对应七个管线阶段：
`understanding` 天线摆动、`searching` 轨道粒子、`reading` 翻页填字、`reranking` 三柱重排、`generating` 波形脉冲、`success` 打勾、`error` 眼睛变横线。
**全部为原创 SVG，无第三方素材，无版权问题**；`prefers-reduced-motion` 下自动降级。

---

## 9. 已踩过的工程坑（可复用）

| 现象 | 根因 | 处理 |
| --- | --- | --- |
| pytest 报 `'app' is not a package`，还夹着 Streamlit 警告 | 仓库根的 legacy `app.py` 在 `sys.path` 里遮蔽了后端的 `app` 包 | 删掉 `backend/__init__.py` 与 `tests/__init__.py`，让 pytest 只把 `backend` 加入路径 |
| `git branch upgrade/xxx` 返回 0 但 ref 不生成 | 该环境下 git 无法在 `.git/refs/heads/` 下创建嵌套目录 | 用 PowerShell 预建目录并写入完整 40 位 SHA；分支 ref 用 `packed-refs`（必须 LF 换行）维护 |
| `curl -d '{"question":"中文"}'` 得到 422 | Git Bash 把中文 payload 编成 GBK | 用 Python 写 UTF-8 文件后 `--data-binary @file`，或直接用 urllib |
| 评测接口无限递归 | `load_dataset(auto_seed=True)` → `seed_dataset()` → `load_dataset()` | 拆出 `_read_cases()`，seeding 不再回调 load |
| 改了切分逻辑但指标没变 | 磁盘索引缓存仍然有效 | 引入 `INDEX_SCHEMA_VERSION`，管线变更必须升版本 |
| 前端 `tsc` 报 `Cannot find module 'next'` | `npm install` 尚未完成（`.bin` 未生成） | 等到安装真正结束再判断类型错误 |

---

## 10. 未验证 / 已知限制

| 项 | 状态 | 说明 |
| --- | --- | --- |
| `PgVectorStore` | ⚠️ 未集成验证 | 代码完整（建表、HNSW 索引、余弦检索），但本机无 PostgreSQL；**只有 SQL 构造被单测覆盖** |
| LLM 重排序 | ⚠️ 未做质量对比 | 实现完整且有启发式兜底，但未跑「LLM rerank vs heuristic」的对照实验，因此默认关闭 |
| 多轮记忆 | ⚠️ 仅消解指代 | 历史进 Prompt 但不做查询改写 |
| OCR | ❌ | 扫描件 PDF 直接报失败 |
| 认证 | ❌ | 共享密码，无用户体系 |
| 并发上限 | 未测 | 索引是进程内单例且写入加锁；高并发写入场景未压测 |
| 前端 E2E | ❌ | 有类型检查/lint/构建与 HTTP 层验证，但**没有 Playwright 端到端用例**，主要依赖手动验收 |
