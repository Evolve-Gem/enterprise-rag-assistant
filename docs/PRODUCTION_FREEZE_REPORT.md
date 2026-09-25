# Enterprise RAG Copilot V4.0 — Production Freeze Report

> **审计性质**：只读审计。本轮**未修改**任何 UI / 功能 / RAG / Agent / 数据库 / 依赖。
> 审计过程中未执行任何会改变运行态的操作（未 commit、未部署、未改配置、未在服务器上构建）。
>
> - 审计时间：2026-09-25
> - 目标：确认 V4 产品版本可以安全部署到 `rag.changziqi.com`
> - 被审对象：本地工作区 `C:\projects\enterprise-rag-assistant`（branch `upgrade/v3-enterprise-copilot`）
> - 现网基线：`/opt/enterprise-rag-copilot/repo`，commit `8725620`，tag 位置 `v3.0.4-1-g8725620`
> - 现网容器：`rag-copilot-web:3.0.0` / `rag-copilot-backend:3.0.0`，均 `Up 6 days (healthy)`

---

## 0. 总体结论

**PASS（条件通过）** — 不存在五条件的上线阻断项；但**必须**先满足 §4 的 4 项前置条件，其中 1 项是条件性 P0（部署方式一旦选错会静默打挂全部 API）。

| # | 检查项 | 结果 | 最高问题等级 |
| --- | --- | --- | --- |
| 1 | git status | **PASS** | P1 |
| 2 | frontend build | **PASS** | P2 |
| 3 | backend tests | **PASS** | — |
| 4 | docker build | **NOT VERIFIED**（本地无 Docker；未在生产上跑） | P2 |
| 5 | docker compose config | **PASS** | P1 |
| 6 | environment variables | **PASS** | **P0（条件触发）** / P1 |
| 7 | nginx config | **PASS** | — |
| 8 | API health check | **PASS** | P2 |
| 9 | production route check | **PASS（预期差异）** | — |

---

## 1. git status — PASS（P1）

**事实**

```
branch      : upgrade/v3-enterprise-copilot
HEAD        : 3d9e257 docs(resume): freeze the project facts into a reusable resume source
remote      : origin https://github.com/Evolve-Gem/enterprise-rag-assistant.git
ahead of origin/upgrade/v3-enterprise-copilot by : 8 commits
tags        : v3.0.0 … v3.0.4（无 v4.0.0）
```

**关键结论（本轮最重要的冻结事实）**

`git diff 8725620..HEAD` 显示：**V4 相对于现网已部署提交，不包含任何后端 / 基建改动。**

| 路径 | 相对现网的改动 |
| --- | --- |
| `backend/` | **0**（未改） |
| `docker/` | **0**（未改） |
| `docker-compose.yml` | **0**（未改） |
| `knowledge_base/` | **0**（未改） |
| `prompts/` | **0**（未改） |
| `apps/web/package.json` / `package-lock.json` | **0**（依赖未动） |
| `backend/requirements.txt` | **0**（依赖未动） |
| `apps/web/src/**` + `docs/**` | 本轮 V4 改动（**未提交**，19 处工作区变更） |

工作区 19 处变更**全部**落在 `apps/web/src`、`docs/`、`.workbuddy/`、`.task_state.json`，**无一处越界**。

`8725620` 是 HEAD 的祖先 → 部署可 fast-forward。

**问题**

- **P1-1｜V4 尚未形成 git revision。** 12 个修改文件 + 5 个新增路径（`app/about/`、`ui/page-intro.tsx`、`docs/V4_PRODUCT_ACCEPTANCE.md`、`docs/images/v4/`）仍是工作区状态。
  影响：① "冻结版本" 目前无法用 SHA 指代；② 回滚无法表达为 `git checkout <sha>`。
  **不构成硬阻断**（`docker build` 读的是工作区/检出内容），但在 freeze 语义下必须先提交。
- **P1-2｜本地领先远端 8 个提交未推送**，远端 `upgrade/v3-enterprise-copilot` 落后于本地。若部署走「服务器 `git pull`」，必须先推送。

---

## 2. frontend build — PASS（P2）

```
command : NODE_OPTIONS="" API_PROXY_TARGET=http://127.0.0.1:8000 node node_modules/next/dist/bin/next build
result  : exit 0 · Compiled successfully · 12 routes · .next/BUILD_ID 生成
```

12 条路由（含 V4 新增的 `/about`）：

```
/  /_not-found  /about  /agent  /ask
/insights/activity  /insights/evaluation  /insights/gaps
/knowledge/documents  /knowledge/explorer  /settings  /solution-studio
```

类型检查 `tsc --noEmit` = 0 error；ESLint = 0 warning / 0 error（同批次验证）。

**P2-1｜本机构建需要 `NODE_OPTIONS=""`。** 宿主经 `NODE_OPTIONS` 注入的 `node-language-shim.cjs` 会让
Next 的构建 tracer 抛 `EPERM: open '.next/trace'`（已排除文件锁：手工 `fs.writeFileSync` / `openSync(...,'a')`
均成功、目录可写、磁盘充足、无僵尸进程）。
**对部署无影响**：容器内不存在该宿主 shim，`Dockerfile.web` 的 `npm run build` 不受影响。

---

## 3. backend tests — PASS

```
cd backend && ../.venv/Scripts/python.exe -m pytest -q
171 passed in 30.03s
```

与本轮之前的历史基线一致（171 passed）。后端源码本轮零改动，此结果同时构成「V4 未破坏后端」的证据。

---

## 4. docker build — NOT VERIFIED（P2）

**为什么没有执行**

- 本机**无 Docker**（无 Desktop、无 WSL 发行版、无 podman），无法本地构建。
- **未在生产服务器上执行**：本轮交付要求是「只做审计」；且在一台 `Mem total 1963 MB`（available 984 MB）、
  同时跑着公开 Demo 的机器上执行 Next.js 镜像构建，会给线上服务带来可避免的内存压力。
  「构建一个镜像」虽不改配置，但属于对生产机的重负载动作，超出「只读审计」边界。

**补偿性证据（把未验证范围压到最小）**

| 证据 | 结论 |
| --- | --- |
| `docker/Dockerfile.web` / `Dockerfile.backend` / `docker-compose.yml` 的 md5 **与服务器上正在运行的那一份逐字节相同** | 构建脚本本身是**已被验证过的**版本（6 天 healthy 运行中） |
| `apps/web/package.json` / `package-lock.json` / `backend/requirements.txt` 相对现网**零差异** | 依赖层不会出现新的解析/下载风险 |
| 基础镜像 `node:22-alpine`、`python:3.12-slim` **已在服务器本地** | 构建不需要拉取基础镜像 |
| 本地 `next build` 成功（12 路由） | `Dockerfile.web` builder 阶段执行的正是同一条 `npm run build` |
| `.dockerignore` 已排除 `node_modules` / `**/node_modules` / `**/.next` / `backend/data` / `*.pem` | 构建上下文干净，不会把本地产物或密钥带进镜像 |

**残余风险**：镜像真正构建成功，只有在构建那一刻才能被证明。
**因此列为部署窗口内的强制步骤**（见 §4），并要求构建完成后先验证镜像内容再切换容器。

---

## 5. docker compose config — PASS（P1）

```
服务器执行（只读）：cd /opt/enterprise-rag-copilot/repo && sudo docker compose config -q  → OK
```

| 证据 | 值 |
| --- | --- |
| 服务器 compose 路径 | `/opt/enterprise-rag-copilot/repo/docker-compose.yml` |
| 项目名（compose `name:` ↔ 容器名前缀） | `enterprise-rag-copilot` ↔ `enterprise-rag-copilot-web-1` ✅ 一致 |
| compose 文件 md5（本地 ↔ 服务器） | `dba543751a3276921cae2231b4d53874` **完全相同** |
| Dockerfile.web md5 | `08312de9bb62a2f2e2f39755f1da1117` **完全相同** |
| Dockerfile.backend md5 | `7ea8e98ca16f6573b994b1252dfe8cbf` **完全相同** |
| 端口绑定 | `web 0.0.0.0:3001` / `backend 127.0.0.1:18000:8000` ✅ 符合预期 |
| `depends_on: backend: condition: service_healthy` | 可满足 —— 两个 Dockerfile 各自声明了 `HEALTHCHECK`（compose 本身未写 `healthcheck:`，来自镜像）✅ 已被 6 天 healthy 运行证明 |
| 两个容器的 HEALTHCHECK 实际状态 | `Up 6 days (healthy)` ✅ |

**P1-3｜web 镜像 tag 被钉在 `3.0.0`。** `docker-compose.yml` 中 `image: rag-copilot-web:3.0.0`。
V4 重建后，新的 web 镜像会**覆盖同一个 tag**，当前线上那份 `rag-copilot-web:3.0.0`（1.26 GB）将变成 dangling。
后果：**回滚不再是一条命令**（需重新构建旧 commit，构建期间线上无法回滚）。
建议在部署窗口把 web 镜像 tag 提升为 `4.0.0`（backend 未改动，可保持 `3.0.0` 不动）——
**本条为建议，本轮未自动修改。**

---

## 6. environment variables — PASS（含 1 项条件性 P0 + 1 项 P1）

### 6.1 密钥卫生 — PASS

| 检查 | 结果 |
| --- | --- |
| `.env` 是否被 gitignore | ✅ `.gitignore:2:.env` |
| `.env` 是否被 git 跟踪 | ✅ 未跟踪 |
| 被跟踪的 env 类文件 | 仅 `.env.example` / `.env.production.example` / `apps/web/.env.local.example` / `deploy_package/.env.example`（均为模板） |
| 跟踪文件中泄漏密钥模式扫描 | `sk-…` = **0** 命中；`DEEPSEEK_API_KEY=<值>` = **0**；`Bearer <长串>` = **0** |
| 被跟踪的运行时数据（索引 / 台账 / 评测集） | **0**（`backend/data` 已忽略） |
| 本机 `.env` 内容 | 仅 1 个键 `DEEPSEEK_API_KEY`（值不在本报告中出现） |

### 6.2 变量口径 — PASS

- `.env.example` 45 键 ↔ `.env.production.example` 49 键；**生产多出的 5 个键全部是 compose 层旋钮**：
  `API_PROXY_TARGET`、`BACKEND_HOST_PORT`、`WEB_HOST_PORT`、`NPM_REGISTRY`、`PIP_INDEX_URL` —— 符合设计。
- 生产 guard rails（实时读自 `https://rag.changziqi.com/api/settings`，**不含任何密钥值**）：

```json
guard_rails: {"password_required": false, "read_only": true,
              "rate_limit": {"enabled": true, "requests": 10, "window_seconds": 60, "scope": "ai_endpoints"}}
retrieval  : {"configured_mode": "hybrid", "effective_mode": "hybrid", "vector_store": "numpy",
              "top_k": 8, "rerank_top_k": 4, "fusion": "rrf", "rerank_provider": "heuristic"}
app        : {"name": "Enterprise RAG Copilot", "version": "3.0.0", "environment": "production"}
```

`/api/auth/status` → `{"password_required":false,"read_only":true,...}` ✅ 与「公开只读 Demo」一致。
V4 **未引入任何新环境变量**（预填功能走 URL 查询参数；`API_PROXY_TARGET` 语义未变）。

### 6.3 ⚠️ P0（条件触发）｜`apps/web/.env.local` 会劫持生产反代目标

**事实**

```bash
$ cat apps/web/.env.local          # 129 B，gitignore 于 apps/web/.gitignore:34 (.env*)，未被跟踪
NEXT_PUBLIC_API_BASE_URL=
API_PROXY_TARGET=http://127.0.0.1:8000
```

`apps/web/next.config.ts` 在**构建期**读取：

```ts
const API_PROXY_TARGET = (process.env.API_PROXY_TARGET || "http://backend:8000").replace(/\/$/, "");
```

而 `Dockerfile.web` 的 builder 阶段执行 `COPY apps/web/ ./` 后再 `npm run build`。

**已复现（实证，非推测）**：在 `apps/web/.env.local` 存在的情况下执行 `next build`（不显式传 `API_PROXY_TARGET`），
构建产物 `.next/routes-manifest.json` 中烘焙的反代目标变为：

```
/health      -> http://127.0.0.1:8000/health
/api/:path*  -> http://127.0.0.1:8000/api/:path*
```

（预期且正确值应为 `http://backend:8000/...`。恢复用显式环境变量后重新构建，已还原为正确值。）

**触发条件（必须同时满足）**

1. 部署方式为**把本地工作区拷到服务器**（rsync / scp / 手工复制，包含点文件）；且
2. `.dockerignore` 中的 `.env.*` 未覆盖嵌套路径 `apps/web/.env.local`。

> `.dockerignore` 写的是 `.env` 与 `.env.*`（无 `**/` 前缀）。Docker 的 `.dockerignore` 对**不带斜杠的模式**是否
> 匹配嵌套同名文件，本机无 Docker **无法实证**；该文件中同时存在 `node_modules` 与 `**/node_modules` 两条，
> 也说明作者对此不确定。

**后果**：web 容器内 `/api` 与 `/health` 全部指向容器自身的 `127.0.0.1:8000`（无服务监听）→
页面能打开，但**所有数据与 AI 调用失败**。属「看着像上线成功、实际全挂」的静默故障。

**若走 git 部署则不触发**：`apps/web/.env.local` 被 gitignore，永远不进入服务器检出，也就进不了构建上下文 ——
这正是当前 V3 镜像健康的原因（服务器上的构建上下文里没有这个文件）。

**处置（§4 已列为强制项）**：部署必须走 git 提交 + 服务器检出；并在切换容器前验证镜像内烘焙的反代目标。
**P1-4（建议，未自动修改）**：`.dockerignore` 增加 `**/.env*`，或把本地 `.env.local` 的 `API_PROXY_TARGET` 置空。

---

## 7. nginx config — PASS

```
$ sudo nginx -t
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

`rag.changziqi.com` 站点关键行（只读提取）：

```
server_name rag.changziqi.com;
listen 443 ssl;  listen [::]:443 ssl;              # managed by Certbot
ssl_certificate /etc/letsencrypt/live/rag.changziqi.com/fullchain.pem;
proxy_pass http://127.0.0.1:3001;
return 404;                                        # 80 端口块，managed by Certbot
```

结论：**V4 不需要任何 Nginx 改动**。V4 是纯前端展示层升级，路由集合除新增 `/about` 外未变，
Nginx 只做单点 `proxy_pass → 3001`，新路由天然被同一条规则覆盖。
（另：`/openapi.json` 与 `/docs` 返回 404，因为 Next 只反代 `/health` 与 `/api/:path*` —— 属**有意不公开** API 文档，是正向设计。）

---

## 8. API health check — PASS（P2）

**生产**

```
GET https://rag.changziqi.com/health
{"status":"ok","version":"3.0.0","environment":"production","agent_engine":"langgraph",
 "index_ready":true,"index_document_count":24,"index_chunk_count":283,"llm_configured":true}
```

**V4 依赖的全部 13 个只读端点（生产，匿名）**

| 端点 | 结果 |
| --- | --- |
| `/api/overview` | 200 · 16,770 B · 0.18 s |
| `/api/settings` | 200 · 1,265 B |
| `/api/auth/status` | 200 · 98 B |
| `/api/agent/catalog` | 200 · 4,823 B |
| `/api/solutions/config` | 200 · 278 B |
| `/api/insights/gaps` | 200 · 7,905 B |
| `/api/evaluation/dataset` | 200 · 3,643 B |
| `/api/evaluation/runs` | 200 · 496 B |
| `/api/activity` | 200 · 58,119 B |
| `/api/activity/stats` | 200 · 360 B |
| `/api/knowledge/documents` | 200 · 11,866 B |
| `/api/knowledge/stats` | 200 · 519 B |
| `/api/settings/prompts` | 200 · 1,556 B |

全部 200，最快 0.13 s / 最慢 0.52 s。**V4 前端所依赖的 API 契约在现网完整可用**，无需后端变更。

**本地对照**：`/health` ok（24 docs / 283 chunks / langgraph）；`/api/overview`、`/api/settings`、
`/api/agent/catalog`、`/api/insights/gaps`、`/api/evaluation/dataset`、`/api/solutions/config` 全部 200。
本地与生产返回体结构一致（本地 `/api/overview` 更大，因台账记录更多）。

**P2-2｜`/api/overview` 出现 1 次瞬时连接失败。** 首轮探测 4 次中 1 次 `code=000`（curl 未能完成连接）；
随后 **3/3 重试均 200**（0.19–0.73 s）。判定为**公网瞬时抖动，非应用缺陷**，无需处置；建议部署后观察一次。

**P2-3｜原始知识库端点匿名可读（设计如此）。** `/api/knowledge/documents` 未携带任何凭证即返回 200。
在「公开只读 Demo」定位下这是产品本身（只读即产品），且写操作仍被服务层 403 拦截；
但需明确认知：**知识库原文对公网完全开放**。若日后定位改为「限流演示」，需重新评估。

---

## 9. production route check — PASS（含 1 项预期差异）

| 路由 | 现网状态 |
| --- | --- |
| `/` | 200 |
| `/ask` | 200 |
| `/agent` | 200 |
| `/solution-studio` | 200 |
| `/knowledge/documents` | 200 |
| `/knowledge/explorer` | 200 |
| `/insights/gaps` | 200 |
| `/insights/evaluation` | 200 |
| `/insights/activity` | 200 |
| `/settings` | 200 |
| **`/about`** | **404** |

`/about` 返回 404 是**预期且正确**的：它正是 V4 新增的路由，证明**现网仍是 V3**。
这条同时定义了部署后的验收判据 —— 部署后 11/11 必须全部 200。

---

## 10. 服务器资源余量（部署可行性）

| 项 | 实测 | 判断 |
| --- | --- | --- |
| 内存 | total 1963 MB / used 785 MB / available **984 MB** | 偏紧 |
| **Swap** | **2047 MB（已用 545 MB，剩 1502 MB），`/swapfile`** | ✅ **swap 已配置** —— 与旧记录「无 swap」不符，Next.js 构建的 OOM 风险显著降低 |
| 磁盘 | `/dev/vda2` 50 G，已用 29 G，**剩 19 G（61%）** | 够放一份新 web 镜像（~1.3 GB）+ 构建缓存 |
| 基础镜像 | `node:22-alpine`、`python:3.12-slim` 已本地存在 | 构建无需外网拉取 |
| 现存镜像 | `rag-copilot-web:3.0.0` 1.26 GB / `rag-copilot-backend:3.0.0` 460 MB | 见 P1-3 |

---

## 11. 问题清单（按等级）

### P0 — 阻断上线

无**无条件** P0。

**P0-1（条件触发）｜`apps/web/.env.local` 劫持生产反代目标**
触发条件：部署方式为文件拷贝 **且** `.dockerignore` 的 `.env.*` 未覆盖嵌套路径。
后果：线上所有 `/api`、`/health` 请求打到不存在的 `127.0.0.1:8000`，页面可开但功能全挂（静默故障）。
已本地复现（见 §6.3）。走 git 部署不触发。**必须在部署窗口按 §4-③ 验证。**

### P1 — 建议修复

| 编号 | 问题 | 影响 |
| --- | --- | --- |
| P1-1 | V4 工作区改动未提交（12 改 + 5 新增） | 冻结版本无 SHA；回滚无法用 SHA 表达 |
| P1-2 | 本地领先远端 8 个提交未推送 | 走 `git pull` 部署会拉不到 V4 |
| P1-3 | web 镜像 tag 钉在 `3.0.0`，重建会覆盖现有镜像 | 回滚从「一条命令」退化为「重新构建」 |
| P1-4 | `.dockerignore` 的 `.env.*` 未覆盖嵌套 env 文件 | 纵深防御缺口，是 P0-1 的一半成因 |

### P2 — 可接受

| 编号 | 问题 | 判断依据 |
| --- | --- | --- |
| P2-1 | 本机构建需 `NODE_OPTIONS=""` | 宿主 shim 问题，容器内不存在 |
| P2-2 | `/api/overview` 1 次瞬时连接失败（4 次中 1 次） | 3/3 重试 200；公网抖动 |
| P2-3 | 知识库原文端点匿名可读 | 「公开只读 Demo」的设计即如此；写操作仍 403 |
| P2-4 | `docker build` 未实际执行 | 构建脚本与依赖均与现网逐字节相同；列为部署窗口强制步骤 |
| P2-5 | `docker-compose.override.yml` 未被 gitignore | 当前不存在该文件；一旦本地生成有被误提交的风险 |
| P2-6 | 内存余量 984 MB 偏紧 | swap 2 GB 可用（剩 1502 MB），磁盘 19 G 充足 |

---

## 12. 部署前强制清单（Gate）

> 以下 5 项全部满足前，**不得**执行 `docker compose up -d`。本轮只列出，未代为执行。

1. **提交 V4 工作区**（解决 P1-1），并推送到 `origin/upgrade/v3-enterprise-copilot`（解决 P1-2）。
2. **提升 web 镜像 tag**：`docker-compose.yml` 中 `rag-copilot-web:3.0.0` → `4.0.0`，保留旧镜像以便回滚（解决 P1-3）。
   *（后端未改动，`rag-copilot-backend:3.0.0` 可不动。）*
3. **仅构建、不切换**：
   `cd /opt/enterprise-rag-copilot/repo && docker compose build web`
   构建完成后**先验证镜像内烘焙的反代目标**（解决 P0-1 + P2-4）：
   ```bash
   docker run --rm --entrypoint sh rag-copilot-web:4.0.0 -c \
     "grep -o 'http://[^\"]*' .next/routes-manifest.json | sort -u"
   # 期望输出：http://backend:8000  —— 若出现 http://127.0.0.1:8000，立即停止，不要 up
   ```
4. **确认服务器构建上下文不含 env 文件**：`ls -a apps/web/.env*` 应只看到 `.env.local.example`
   （或按 P1-4 给 `.dockerignore` 加 `**/.env*`）。
5. 备份当前 `.env`：`cp .env .env.bak.$(date +%Y%m%d-%H%M%S)`（保持现有 600 权限）。

## 13. 部署后验收清单

1. `docker compose ps` → 两个容器 `(healthy)`，`Up` 时间重新计时。
2. `curl -s https://rag.changziqi.com/health` → `status:ok` / `index_document_count:24` / `index_chunk_count:283`。
3. **11/11 路由 200**（含本次新增的 `/about`）—— 这是 §9 那条 404 的收敛判据。
4. `curl -s https://rag.changziqi.com/api/settings` → `guard_rails.read_only=true`、`password_required=false`、
   `rate_limit 10/60s` 三项与部署前一致。
5. 重跑浏览器验收矩阵（4 视口 × 11 页面）：横向溢出 0 / console error 0 / 断链 0
   （脚本已就绪：`C:/agents/temp/v4_qa.mjs`，把 `BASE` 指向线上即可）。
6. 首屏确认「公开只读」提示仍在，且 `POST` 写操作仍返回 403。

---

## 14. 审计边界声明

- 本轮**未**修改任何代码、配置、依赖、数据库或线上状态。
- 唯一写入是**本报告本身**（`docs/PRODUCTION_FREEZE_REPORT.md`）与本地构建产物 `.next/`（构建输出，已 gitignore）。
- 服务器侧全部为只读命令：`docker inspect` / `docker ps` / `docker compose config -q` / `nginx -t` /
  `awk` 提取配置 / `md5sum` / `free` / `df` / `docker images`。**未执行** `docker build`、`docker compose up`、
  未修改 `.env`、未重启任何服务。
- 报告中**不含任何密钥值**：`.env` 只列键名，`/api/settings` 的 `key_hint` 为掩码。

---

*本报告只记录实测结果。未执行的验证标记为 NOT VERIFIED，不以推断充当证据。*
