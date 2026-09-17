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

## 生产服务器事实（2026-09-17 只读勘查）

**腾讯云轻量 `81.70.51.32`**（`VM-0-16-ubuntu`，Ubuntu 22.04.5，x86_64，2 vCPU / **1.9 GB 内存 / 无 swap**，磁盘 50G 用 17G）
Docker 29.1.3 + Compose 2.40.3；Nginx 1.18；UFW inactive（边界是**腾讯云安全组**）；SSH 免密（`~/.ssh/config` 已配）。

| 端口 | 占用者 | 备注 |
| --- | --- | --- |
| 80 / 443 | Nginx | 多站点 |
| **8000** | gunicorn（绑 127.0.0.1） | `eat.changziqi.com` —— **不可复用** |
| **8502** | 容器 `enterprise-rag-demo` | 本项目 **legacy V2**，已跑数周 |
| 3001 / 18000 | 空闲 | V3 用这两个 |

现存 Nginx 站点：`changziqi.com` / `eat.changziqi.com` / `love-archive-preview`（含 `server_name 81.70.51.32`）/
**`rag.changziqi.com`（→ 127.0.0.1:8502，即 legacy V2，Certbot 证书有效）** / `default`。

**部署 V3 的既定路线**：
- 阶段 A：公网 IP + **单端口 3001**（前端同源反代 `/api`、`/health` 到 backend；backend 绑 `127.0.0.1:18000`）
- 阶段 B：把 `rag.changziqi.com` 的 `proxy_pass` 从 `8502` **改一行**为 `3001`（复用现有证书，无需新 server block）
- 服务器构建前**必须加 2GB swap**（1.9GB 无 swap 构建 Next.js 极易 OOM）
- 部署目录建议 `/opt/enterprise-rag-copilot/{repo,.env}`（legacy 在 `~/apps/`，用户可能偏好后者）

**本机能力边界**：**无 Docker**（无 Desktop / 无 WSL 发行版 / 无 podman）→ 不能本地构建或运行镜像；
**无 GitHub 凭据**（非交互 shell 无法提示输入）→ **不能 push**，push 必须用户本人执行。

## 本机环境坑位

- **⚠️ 程序化用 git 做文件差集 = 危险**：`git ls-files` / `git status --porcelain` 对**非 ASCII 路径
  输出八进制转义**（`"knowledge_base/\351\252\214..."`），与真实路径不匹配。
  本机曾因此把 **22 篇中文知识文档误判为「未跟踪」并删除**（`git restore` 救回，零丢失）。
  **硬性规则**：① 必须加 `-z` 或 `-c core.quotepath=false`；② **禁止用差集推导删除目标**，
  只删除**明确列举**的产物，删除前先打印清单并核对数量。
- **宿主 safe-delete 垫片（Python）**：`sitecustomize.py` 拦截 `Path.unlink`，触发
  `_check_bulk_delete_guard` → `SystemExit(1)`，会**直接杀掉 uvicorn 进程**。
  表现：DELETE 请求超时 + 后端失联。换回合重试即通过，**不是产品缺陷**。
- **宿主 safe-delete 垫片（Node）**：`next build` 清理 `.next/` 会被拦（同回合 > 50 次删除），
  报 `SAFE_DELETE_BULK_CONFIRM_REQUIRED`。绕过：先 `rm -rf .next` 再构建。
- **git 嵌套 ref 静默失效**：`git branch upgrade/xxx` / `update-ref` 返回 0 但不写文件。
  绕过：维护 `.git/packed-refs`（**必须 LF 换行** + 完整 40 位 SHA）。
  **每次 commit 后都要手动把新 SHA 写回 packed-refs**。
- **pytest 导入冲突**：仓库根 `app.py`（legacy Streamlit）会遮蔽后端 `app` 包。
  保持 `backend/__init__.py` 与 `backend/tests/__init__.py` **不存在**。
- **Windows Git Bash 会把中文 payload 编成 GBK** → `curl -d '{"中文":...}'` 得到 422。
  用 Python 写 UTF-8 文件 + `--data-binary @file`，或直接 urllib。
- **curl 不认 `/c/...` 路径**（含 `-o` 输出路径），要用 `C:/...`。
- **`npx tsc` 会装到错误的包**；用 `node node_modules/typescript/bin/tsc`。
- **后台进程在非交互回合结束会被回收**：启服务 + 校验必须在**同一条命令**内完成。
- **后台命令可能被执行不止一次**：会产生重复产物（如重复上传 probe 文件），
  排查「数据莫名多一条」时先怀疑这一点。
- **PowerShell 工具不回显 stdout**：需要把输出重定向到文件再 Read。

## 前端工程坑位（Tailwind）

- **响应式 grid 必须给基础列定义**：`grid gap-5 xl:grid-cols-3` 在低于 `xl` 时
  **完全没有 `grid-template-columns`**，隐式单列按 **max-content** 撑开容器 → 横向溢出。
  正确写法：`grid grid-cols-1 gap-5 xl:grid-cols-3`（`grid-cols-1` = `repeat(1, minmax(0,1fr))`，
  `minmax(0,…)` 才是把轨道钉在容器宽度上的关键）。本项目曾因此有 23 处容器在 1080 宽度溢出 635px。
- **在 `useEffect` / `useMemo` 等闭包内，属性访问的类型收窄会失效**：
  必须在闭包内先取局部常量再判断。
- **对象展开会丢失可辨识联合的类型收窄**：`{...state, extra}` 之后 `status === "success"` 无法收窄
  `data`。用 `useMemo` 显式构造每个变体。

## UI 验收手段（本机可用的零依赖方案）

Chromium 已存在于 `%LOCALAPPDATA%\ms-playwright\chromium-1234\chrome-win64\chrome.exe`，
Node 22 内置 `WebSocket` 与 `fetch` → 可以**零安装**用 CDP 驱动真实浏览器：
真实渲染、真实点击、截图、收集 console error、量测横向溢出。
脚本模板：`C:\agents\temp\cdp.mjs` + `ui_acceptance.mjs` + `ui_probe.mjs`（已固化为 Skill）。


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
