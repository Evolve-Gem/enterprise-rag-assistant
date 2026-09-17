# 部署报告 · Deployment Report

| | |
| --- | --- |
| **报告日期** | 2026-09-17 |
| **阶段** | V3.0 Freeze → Package → Deploy → Verify |
| **提交** | `74a51ce`（分支 `upgrade/v3-enterprise-copilot`） |
| **标签** | `v3.0.0` → `74a51ce`（annotated，对象 `41213ed`；**已推送远端**） |
| **本地冻结状态** | ✅ 完成 |
| **远端可获取状态** | ✅ `ls-remote` 三项 MATCH |
| **公网部署状态** | ❌ **未执行** |
| **最终结论** | **NOT READY FOR PUBLIC DEMO**（产物侧 **READY FOR SERVER DEPLOY**，见 §12.1） |

> 结论按用户给定口径给出：公网部署与外部验证尚未发生，因此不能写 READY。
> 阻塞项与解除条件见 §11，解除后本地侧无需再改代码。

---

## 1. 环境

### 1.1 本地（构建与验证机）

| 项 | 值 |
| --- | --- |
| OS | Windows 10/11 |
| Python | 3.12.0（项目 venv） |
| Node | 22.22.2 |
| Docker | **未安装**（无 Docker Desktop、无 WSL 发行版、无 podman/nerdctl） |
| Git | 可用；`origin` = `https://github.com/Evolve-Gem/enterprise-rag-assistant.git` |
| **GitHub 凭据** | **不可用**（非交互 shell 无法提示输入；`credential.helper = helper-selector` 未持有 token） |
| SSH | 可用（`~/.ssh/id_ed25519`，`~/.ssh/config` 已配置目标主机） |

### 1.2 目标服务器（`81.70.51.32`，只读勘查所得）

| 项 | 实测值 |
| --- | --- |
| 主机名 | `VM-0-16-ubuntu` |
| OS / 内核 | Ubuntu 22.04.5 LTS / 5.15.0-186-generic |
| 架构 | x86_64 |
| CPU | **2 vCPU** |
| 内存 | **1.9 GiB 总量，可用约 976 MiB** |
| Swap | **无（0 B）** ⚠️ |
| 磁盘 | 50 GB，已用 17 GB，**可用 31 GB** |
| Docker | **29.1.3**，daemon 运行中 |
| Docker Compose | **2.40.3** |
| Nginx | 1.18.0，active |
| UFW | inactive（真正的边界是腾讯云安全组） |

### 1.3 服务器上**已存在**的服务（决定部署方案的关键事实）

| 端口 | 占用者 | 归属 |
| --- | --- | --- |
| 80 / 443 | Nginx | 多个站点 |
| **8502** | **容器 `enterprise-rag-demo`（image `enterprise-rag-demo:20260822`，已运行 3 周，healthy）** | **本项目 V2（legacy Streamlit）** |
| **8000** | **gunicorn（绑定 127.0.0.1）** | `eat.changziqi.com` |
| 3001 | 空闲 | — |
| 18000 | 空闲 | — |

Nginx 现有 server block（`sites-enabled`）：

```
changziqi.com / www.changziqi.com   → 静态站 /var/www/changziqi-space       (HTTPS, Certbot)
eat.changziqi.com                   → proxy_pass 127.0.0.1:8000 (gunicorn)  (HTTPS, Certbot)
love-archive-preview                → 静态站 /var/www/love-archive-preview   (含 server_name 81.70.51.32)
rag.changziqi.com                   → proxy_pass 127.0.0.1:8502  ← 当前是 legacy V2 演示
default                             → /var/www/html
```

**`rag.changziqi.com` 当前已经在服务 legacy V2，且持有有效的 Let's Encrypt 证书。**
按「不要直接覆盖现有线上服务」，本报告**不修改任何 Nginx 配置**，改造方案写在 §7 阶段 B。

现有 Docker 资产：镜像 4 个（`enterprise-rag-demo:20260822` 803 MB、`python:3.12-slim` 179 MB，另 716 MB 可回收）；**无自定义 volume / network**；容器 2 个（1 运行 1 退出）。
`/opt` 下只有 `containerd`；legacy 应用实际位于 `/home/ubuntu/apps/enterprise-rag-assistant/`。

---

## 2. 冻结

| 检查项 | 结果 |
| --- | --- |
| `git status` | 干净（提交前曾列出 5 个待提交文件，全部属本轮产物，**未删除任何未知文件**） |
| 知识库 | **24 文档**，`git status` 干净（无未跟踪残留） |
| `docs/V3_ACCEPTANCE_REPORT.md` | 存在（29,899 字节，529 行） |
| README 使用 V3 截图 | 6 处引用 `docs/images/v3/` |
| 全部已验证修改已提交 | ✅ |
| 标签 `v3.0.0` | ✅ 已创建（annotated），指向 `a2aad25` |

冻结后的提交历史（自上而下）：

```
a2aad25  chore(deploy): same-origin API so one built image fits every environment
9bf68a2  chore(release): production packaging for v3.0.0 freeze
a6fa9f3  docs(memory): record acceptance findings, git-quotepath hazard, Tailwind grid pitfall
ad2b91e  fix(v3): acceptance pass — 4 real defects fixed, live UI verification + screenshots
0b13f51  docs: project memory, web README, handoff notes
2a2e449  feat(v3): enterprise-grade RAG copilot — Next.js + FastAPI + LangGraph
b1cdae1  chore: baseline snapshot before V3 enterprise upgrade
d88730a  docs: add demo screenshots to readme          ← main（未被触碰）
```

**未对 RAG / Agent / UI 做任何功能性改造。** 本轮只有部署打包改动，见 §3。

---

## 3. 打包审查：发现并修复 6 个真实部署缺陷

均为**会导致部署失败或线上异常**的问题，不是风格问题。

| # | 严重度 | 缺陷 | 后果 | 修复 |
| --- | --- | --- | --- | --- |
| **P1** | **Critical** | `env_file: .env` 会把 `.env.example` 里**空的** `KB_DIR=` 注入容器，**覆盖镜像 ENV**；应用回退到镜像内默认 `/app/backend/knowledge_base`（不存在） | **容器 healthy、但 0 文档**——最危险的一类故障：看起来成功 | compose 的 `environment` 显式钉住 `KB_DIR` / `PROMPTS_DIR` / `DATA_DIR`（service 级优先于 env_file）；同时把 `.env.example` 里的三个空路径改为注释 |
| **P2** | High | `Dockerfile.backend` 在同一步里 purge `build-essential && --auto-remove`，而 HEALTHCHECK 依赖 `curl` | 健康检查可能因 curl 缺失而永远 unhealthy，容器被判定失败 | 把 `curl` 安装**移到 purge 之后**单独执行 |
| **P3** | High | `Dockerfile.web` 的 `COPY` 未 `--chown`，`.next` 归 root；容器以 `nextjs` 用户运行 | `next start` 写 `.next/cache` 时 EACCES（图片优化 / ISR 场景） | 先建组、`adduser -G`，所有 COPY 加 `--chown=nextjs:nodejs`，并预建 `chown` 过的 `.next/cache` |
| **P4** | Medium | `npx next start` 入口 | 依赖 npx 解析，存在网络查找可能 | 改为 `node node_modules/next/dist/bin/next start` |
| **P5** | Medium | 两个服务均无日志上限 | `json-file` 日志无界增长，小磁盘机器会被写满 | `max-size: 10m` / `max-file: 3`；补 `stop_grace_period` |
| **P6** | Medium | `.dockerignore` 只排除 `.env` 与 `.env.local` | `.env.production` 等变体会**进入构建上下文** | 改为 `.env*` 全排除，并补 `*.pem` / `*.tsbuildinfo` / `*.log` |
| **P7** | **Critical** | compose 用 `${NEXT_PUBLIC_API_BASE_URL:-http://localhost:8000}` 传构建参数，Dockerfile.web 的 `ARG` 也默认成同一个 URL。POSIX 参数展开里 **`:-` 在「值为空」时同样取默认值** | 生产 `.env` 里 `NEXT_PUBLIC_API_BASE_URL=`（**模板就是空**）会被**静默改写成 `http://localhost:8000` 并烧进浏览器包**，直接废掉同源 `/api` 反代 | 改为 `${NEXT_PUBLIC_API_BASE_URL-}`（仅「未设置」时才取默认）；`Dockerfile.web` 的 `ARG` 默认改为**空**；`.env.example` 里的绝对地址默认值也一并改为空 |

**另修正一处会导致「端口冲突」的设计**：原 compose 发布 `8000:8000`，而目标机 **8000 已被 gunicorn 占用**。同时考虑到 8502 被 legacy 容器占用、机器只有 1.9 GB 内存且无 swap，把部署面收敛为 **单端口**（见 §3.1）。

### 3.1 同源 API：一次构建，两种环境

`apps/web/next.config.ts` 新增 `rewrites()`：`/api/:path*` 与 `/health` 反代到 `API_PROXY_TARGET`。

| 收益 | 说明 |
| --- | --- |
| 只暴露 1 个公网端口 | FastAPI 端口绑定 `127.0.0.1`，不进公网 |
| 无 CORS | 全部同源请求 |
| 杜绝 `localhost:8000` 残留 | `NEXT_PUBLIC_API_BASE_URL` 留空即同源；已实测构建产物中 **0 处** `localhost:8000` |
| 阶段 A → 阶段 B 不需重建镜像 | `API_PROXY_TARGET` 在 `next start` 启动时读取，属**运行期**配置，只改 Nginx |
| 少占内存 | 只跑一个对外端口，不需要为第二端口做安全组变更 |

**这一改动已在本地实测验证，不是假设**（见 §6.3）。

---

## 4. Docker 服务

默认启动（`docker compose up`）**只有两个服务**：

| 服务 | 镜像 | 容器内端口 | 宿主端口 | 说明 |
| --- | --- | --- | --- | --- |
| `backend` | `rag-copilot-backend:3.0.0` | 8000 | **`127.0.0.1:${BACKEND_HOST_PORT:-18000}`** | 仅本机可达；由 web 反代 |
| `web` | `rag-copilot-web:3.0.0` | 3001 | `${WEB_HOST_PORT:-3001}` | **唯一对公网开放的端口** |

Profile 门控（**本次不启动**）：

| 服务 | Profile | 说明 |
| --- | --- | --- |
| `db`（pgvector/pg16） | `pg` | `VECTOR_STORE` 保持 `numpy`，**不启用** |
| `legacy`（Streamlit V2） | `legacy` | **不启动**；服务器上已有等价容器在跑 |

其他：
- `volumes`：`backend-data`（索引缓存 / 台账 / 评测集，命名卷，重启保留）、`./knowledge_base:/app/knowledge_base`（bind mount，可加文档而无需重建镜像）
- `depends_on`：`web` 等 `backend` 达到 `service_healthy` 才启动
- `restart: unless-stopped`，日志轮转见 §3

### 4.1 构建上下文排除（已核对）

| 内容 | 是否进入镜像 | 机制 |
| --- | --- | --- |
| `.env` / `.env.*` / `*.pem` | ❌ | `.dockerignore` |
| `.git` | ❌ | `.dockerignore` |
| `.venv` | ❌ | `.dockerignore` |
| `node_modules` / `.next` | ❌ | `.dockerignore` |
| `backend/data`（运行时数据） | ❌ | `.dockerignore` + 由命名卷挂载；容器内 `mkdir + chown` 保证可写 |
| `knowledge_base` | ✅ 复制进镜像 **且** bind mount 覆盖 | `Dockerfile.backend` COPY + compose volume |
| `prompts/v1` | ✅ 复制进镜像 | 运行时加载 |
| `legacy/` | ✅ 保留在上下文 | **有意为之**：`legacy` profile 用它构建 |

运行时数据策略：**索引缓存与台账放在命名卷 `backend-data`**，容器重建不丢；`DEMO_READ_ONLY=true` 只拦截用户发起的写操作，**不拦截启动时构建索引缓存**（否则只读模式下无法冷启动）。

---

## 5. 生产环境变量

模板：**`.env.production.example`**（已纳入版本库，**不含任何真实密钥**）。
服务器上另建 `.env`（`chmod 600`，不提交）。以下**只列变量名**：

| 分类 | 变量名 |
| --- | --- |
| LLM | `LLM_API_KEY` `DEEPSEEK_API_KEY` `LLM_PROVIDER` `LLM_BASE_URL` `LLM_MODEL` `LLM_TIMEOUT_SECONDS` `LLM_TEMPERATURE` |
| Embedding | `EMBEDDING_PROVIDER` `EMBEDDING_API_KEY` `EMBEDDING_BASE_URL` `EMBEDDING_MODEL` `EMBEDDING_DIM` |
| 检索 | `RETRIEVER_MODE` `RETRIEVAL_TOP_K` `RERANK_TOP_K` `FUSION_STRATEGY` `FUSION_ALPHA` `RRF_K` `RERANK_PROVIDER` |
| 向量库 | `VECTOR_STORE` `DATABASE_URL` |
| 切分 | `CHUNK_SIZE` `CHUNK_OVERLAP` |
| Agent | `AGENT_ENGINE` `AGENT_MAX_STEPS` `AGENT_ALLOW_GENERAL_FALLBACK` `AGENT_REQUIRE_HUMAN_CHECK` |
| Prompt | `PROMPT_VERSION` |
| **访问控制** | **`DEMO_PASSWORD`**（仅服务器）**`DEMO_READ_ONLY`** |
| 端口/反代 | `BACKEND_HOST_PORT` `WEB_HOST_PORT` `API_PROXY_TARGET` |
| 上传限制 | `MAX_UPLOAD_BYTES` `ALLOWED_UPLOAD_SUFFIXES` |
| 可观测 | `ACTIVITY_ENABLED` `ACTIVITY_BACKEND` `ACTIVITY_MAX_RECORDS` |
| 其他 | `CORS_ORIGINS` `APP_NAME` `APP_VERSION` `ENVIRONMENT` `LOG_LEVEL` `NEXT_PUBLIC_API_BASE_URL` |

生产 Demo 目标取值（与验收版本一致，**不调参**）：

```
LLM_PROVIDER=deepseek            LLM_MODEL=deepseek-v4-flash
RETRIEVER_MODE=hybrid            EMBEDDING_PROVIDER=hashing
FUSION_STRATEGY=rrf              RERANK_PROVIDER=heuristic
VECTOR_STORE=numpy               AGENT_ENGINE=langgraph
PROMPT_VERSION=v1                DEMO_READ_ONLY=true
DEMO_PASSWORD=<server-only>      NEXT_PUBLIC_API_BASE_URL=（留空，同源）
```

**密钥卫生**：`.env` 已被 `.gitignore` 与 `.dockerignore` 双重排除；实测 `git check-ignore .env` 命中、`.dockerignore` 含 `.env*`；前端包中不含任何密钥。

---

## 6. 构建验证

### 6.1 后端

```
cd backend && python -m pytest -q
→ 161 passed（0 failed / 0 skipped），10.14 s，全程离线、使用临时语料
```

### 6.2 前端

| 检查 | 结果 |
| --- | --- |
| `tsc --noEmit` | **PASS**（0 错误） |
| `next lint` | **PASS**（`✔ No ESLint warnings or errors`） |
| `next build` | **PASS**（`✓ Compiled successfully` · `✓ Generating static pages (14/14)`） |

### 6.3 同源代理（本轮新增，**必须验证**）

| 检查 | 实测结果 |
| --- | --- |
| 以空 `NEXT_PUBLIC_API_BASE_URL` 构建 | PASS（14/14 路由） |
| 构建产物中是否残留 `localhost:8000` | **`grep -rl` → 0 个文件** ✅ |
| `GET /health` 经 Next 反代 | **200**，返回后端真实 health JSON |
| `GET /api/settings` 经 Next 反代 | **200** |
| `GET /api/knowledge/stats` 经反代 | **24 documents / 283 chunks**（真实后端数据） |
| 真实 Chromium 打开同源页面 | 仪表盘渲染真实数据（24 / 283 / langgraph），**0 console error、0 page exception、0 横向溢出** |

### 6.4 `docker compose build` —— ❌ **未能执行**

**本机未安装 Docker**（无 Docker Desktop、无 WSL 发行版、无 podman/nerdctl），因此
`docker compose build` 与 `docker compose up` **无法在本地执行**，两个镜像**未经构建验证**。

按用户 §6 的硬性要求（「必须确认 backend/web 两个镜像均成功」），这一项是**未满足项**，也是本报告结论为 NOT READY 的原因之一。
镜像构建验证的最快路径：在服务器上执行（服务器有 Docker 29.1.3），但需先加 swap 以降低 OOM 风险（见 §11）。

---

## 7. 部署方案（两阶段）

### 7.0 前置：把冻结版本推到远端 —— ✅ **已完成**

```bash
git push origin upgrade/v3-enterprise-copilot   # * [new branch]，rc=0
git push origin v3.0.0                          # * [new tag]，rc=0
```

`git ls-remote --heads --tags origin` 实测结果：

```
d88730afdfc321a15ce97aa6befc4106613f3aa7   refs/heads/main                        (未改动)
74a51cef1a0a5332f225b999c8dd1bbf06525147   refs/heads/upgrade/v3-enterprise-copilot
41213ed84505c108a5efd1bf4deb0c958c857fe2   refs/tags/v3.0.0
74a51cef1a0a5332f225b999c8dd1bbf06525147   refs/tags/v3.0.0^{}                    (peeled)
```

本地与远端逐项一致：分支 tip `74a51cef` = 本地 HEAD；tag 对象与 peeled commit 均 MATCH；
`main` 两侧同为 `d88730a`，未被改动。

> 服务器现在可以直接 `git clone` + `git checkout v3.0.0`，不再走「上传工作区压缩包」的旧路线。

### 7.1 服务器初始化（一次性）

```bash
ssh ubuntu@81.70.51.32

# 1) 强烈建议先加 swap：机器 1.9 GB 且无 swap，Next.js 构建容易 OOM
free -h                                  # 确认当前 swap = 0
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h                                  # 确认 Swap 2.0Gi

# 2) 取代码（真实密钥只在服务器 .env）
sudo mkdir -p /opt/enterprise-rag-copilot && sudo chown ubuntu:ubuntu /opt/enterprise-rag-copilot
git clone https://github.com/Evolve-Gem/enterprise-rag-assistant.git /opt/enterprise-rag-copilot/repo
cd /opt/enterprise-rag-copilot/repo
git checkout v3.0.0

# 3) 生产环境变量
cp .env.production.example .env
chmod 600 .env
#    填写 LLM_API_KEY 与 DEMO_PASSWORD（其余保持模板默认）
#    DEMO_READ_ONLY=true 必须保持
grep -nE "^(DEMO_READ_ONLY|VECTOR_STORE|AGENT_ENGINE|NEXT_PUBLIC_API_BASE_URL)=" .env
```

目标结构：

```
/opt/enterprise-rag-copilot/
├── repo/          # git clone，checkout v3.0.0
└── .env           # 真实密钥，chmod 600，不提交
```
（`docker-compose.yml` 与 `.env` 同目录，compose 会自动读取 `.env`。）

### 7.2 阶段 A：公网 IP + 端口验证

```bash
cd /opt/enterprise-rag-copilot/repo

# 顺序构建，降低峰值内存
docker compose build backend
docker compose build web

docker compose up -d
docker compose ps                 # 期望 backend/web 均 Up 且 (healthy)
docker compose logs --tail=50 backend
```

**构建期的内存保护**（若 OOM）：`DOCKER_BUILDKIT=1 docker compose build --memory=1200m web`，或临时停掉 legacy 容器释放内存（见 §11 决策 3）。

腾讯云**安全组**放行端口（控制台操作，SSH 无法代劳）：

| 端口 | 用途 | 是否必须 |
| --- | --- | --- |
| **3001** | web（唯一公网入口） | ✅ 必须 |
| 18000 | backend | ❌ **不需要**（绑定 127.0.0.1） |

外网验证（浏览器 + 手机流量）：

```
http://81.70.51.32:3001
```

逐项确认：

| # | 验证项 | 通过标准 |
| --- | --- | --- |
| 1 | **登录门禁** | 未输密码无法进入；错误密码被拒；正确密码进入 |
| 2 | **未登录不可读取** | 直接访问 `/api/knowledge/documents`、`/api/overview`、`/api/settings`、`/api/insights/coverage`、`/api/evaluation/dataset`、`/api/activity`、`/api/agent/catalog`、`/api/rag/retrieve` 全部 **401** |
| 3 | **只公开** | `/health` 与 `/api/auth/*` 返回 200 |
| 4 | Overview | 显示真实 24 文档 / 283 知识块 |
| 5 | Ask | 提问返回带引用角标的回答 |
| 6 | Citation Drawer | 点开 `[1]` 可见 chunk_id、section、原文、BM25/向量/RRF/重排四类分数 |
| 7 | Agent | gap 分析返回 8 节点轨迹，`retrieve`/`human_check` 显示 skipped |
| 8 | Solution Studio | 生成 8 章节方案且带引用 |
| 9 | Evaluation | 运行评测得到 Hit@4 ≈ 90%、MRR ≈ 0.800 |
| 10 | **只读强制** | 尝试上传/删除 → **403 `read_only`**（不是前端隐藏按钮） |

容器重启后复验：

```bash
docker compose restart && sleep 20 && docker compose ps
# 浏览器再走一遍 1/4/5/7
```

### 7.3 阶段 B：域名 + HTTPS（**阶段 A 全部通过后**再做）

**改动前的只读确认（已勘查，执行时再核一遍）**：

```bash
ls -l /etc/nginx/sites-enabled/
sudo nginx -T | grep -nE "server_name|listen |proxy_pass" | head -40
sudo ss -tlnp | grep -E ':(80|443|3001|8502|18000)'
sudo cp /etc/nginx/sites-available/rag.changziqi.com \
        /etc/nginx/sites-available/rag.changziqi.com.bak.$(date +%F)
```

**最小增量改动**：现有 `rag.changziqi.com` block 已经存在（含 Certbot 签发的证书），且**当前指向 8502（legacy）**。
最小改动是**只改一行**：把 `proxy_pass http://127.0.0.1:8502;` 改为 `proxy_pass http://127.0.0.1:3001;`。

```bash
sudo sed -i 's#proxy_pass http://127.0.0.1:8502;#proxy_pass http://127.0.0.1:3001;#' \
     /etc/nginx/sites-available/rag.changziqi.com
sudo nginx -t && sudo systemctl reload nginx
```

要点：
- **不需要改证书**：`rag.changziqi.com` 的 Let's Encrypt 证书与 80→443 跳转已由 Certbot 配好并可复用
- **不需要新增 server block**，因此不影响 `changziqi.com` / `eat.changziqi.com` / `love-archive-preview` / `default`
- web 已把 `/api` 与 `/health` 同源反代到 backend，所以 **Nginx 只需代理 `/` 到 3001**，无需额外的 `/api` location
- 回滚：`sudo cp /etc/nginx/sites-available/rag.changziqi.com.bak.<date> /etc/nginx/sites-available/rag.changziqi.com && sudo nginx -t && sudo systemctl reload nginx`

外网验证：**手机流量**打开 `https://rag.changziqi.com`，复跑 §7.2 的 1–10 项；再 `docker compose restart` 后复验。

---

## 8. 安全态势

| 项 | 生产配置 | 依据 |
| --- | --- | --- |
| 访问口令 | `DEMO_PASSWORD` 必须设置 | 中间件级鉴权门已覆盖全部 `/api` 读取与写入端点（验收 23/23） |
| 只读锁 | `DEMO_READ_ONLY=true` | 上传/更新/删除/重建索引/清空台账在**服务层**返回 403（验收 16/16） |
| 公网面 | 仅 web 端口；backend 绑定 127.0.0.1 | compose 端口绑定 |
| 密钥 | 只在服务器 `.env`（600） | 镜像不含 `.env*`；前端包不含密钥；后端响应只返回掩码 |
| 台账 | 按字段名分段正则过滤凭据键 | 验收 10/10，canary 断言 |
| 错误 | 不返回 Python 堆栈 | 验收通过 |
| 上传（第二道防线） | 后缀白名单 + 8 MB 上限 | 415 / 413 |
| 路径穿越 | 归一化后校验父子关系 | 404 |

**唯一公网暴露面 = web 端口**，且该端口后面是「口令门 + 只读锁」。

---

## 9. 验证状态矩阵

| 项目 | 状态 | 证据 |
| --- | --- | --- |
| 后端测试 | ✅ 已验证 | 161 passed |
| 前端 tsc / lint / build | ✅ 已验证 | 0 / 0-0 / 14 路由 |
| 同源 API 反代 | ✅ 已验证 | HTTP + 真实浏览器（§6.3） |
| 包内无 `localhost:8000` | ✅ 已验证 | `grep -rl` → 0 文件 |
| 鉴权门 / 只读锁覆盖全部端点 | ✅ 已验证 | 验收 49/49 |
| **冻结提交与 tag 推送远端** | ✅ **已验证** | `ls-remote` 三项 MATCH，`main` 未动 |
| **`docker compose build`** | ❌ **未验证** | 本机无 Docker |
| **镜像启动与 healthy** | ❌ **未验证** | 同上 |
| **公网 IP 访问** | ❌ **未执行** | 未部署；安全组端口未放行 |
| **域名 / HTTPS** | ❌ **未执行** | 未部署；Nginx 未改动 |
| **外网 Golden Demo 冒烟** | ❌ **未执行** | 同上 |
| **容器重启后恢复** | ❌ **未执行** | 同上 |

---

## 10. 已知限制（沿用验收结论，未新增）

1. **移动端未适配**：390px 下部分页面有 27–196 px 横向溢出（桌面优先）。
2. **pgvector 未验证**：代码完整，但无真实 PostgreSQL 集成测试；本次不启用。
3. **LLM 重排序未做对照实验**：默认 `heuristic`。
4. **评测集含 1 条非检索型用例**（「知识库里有哪些文档？」），是 Hit@4 的唯一 MISS；冻结集不重写。
5. **无前端 E2E 测试套件**（CDP 验收脚本未纳入仓库）。
6. **无 OCR**（扫描件 PDF 明确报失败，不做假成功）。
7. **无用户体系**：仅共享口令。
8. **单进程单 worker**：`uvicorn` 未加 `--workers`；多 worker 会各自建索引，需外部索引服务才能水平扩展。
9. **无流式输出**（一次性返回）。
10. **服务器资源紧张**：2 vCPU / 1.9 GB / 无 swap（部署时建议加 2 GB swap）。

---

## 11. 阻塞项与需你决策的事项

### 11.1 阻塞（我无法在本机完成）

| # | 阻塞 | 原因 | 状态 / 解除方式 |
| --- | --- | --- | --- |
| B1 | ~~git push 未执行~~ | 本机无交互凭据 | ✅ **已解除**：GCM 使用已缓存凭据推送成功，见 §7.0 |
| B2 | **镜像未构建验证** | 本机无 Docker | 服务器上 `docker compose build`（建议先加 swap） |
| B3 | **未部署 / 未公网验证** | 依赖 B2；且安全组需在腾讯云控制台放行 3001 | §7.1 → §7.2 |
| B4 | **Nginx 未改动** | 按「不破坏现有服务」原则，需你在阶段 A 通过后授权 | §7.3 单行改动 + 备份 + 回滚方案已备好 |

### 11.2 需你决策

| # | 决策点 | 我的建议 | 备选 |
| --- | --- | --- | --- |
| D1 | 部署目录 | `/opt/enterprise-rag-copilot/{repo,.env}` | 跟随现有习惯 `~/apps/enterprise-rag-copilot`（legacy 就在 `~/apps/`） |
| D2 | 服务器上是否加 2 GB swap | **建议加**：1.9 GB 无 swap 构建 Next.js 有很大 OOM 风险 | 不加则需在低负载时段构建，或本地构建后 `docker save` 传镜像 |
| D3 | **legacy 容器 `enterprise-rag-demo`（占 8502）如何处理** | **先保留不动**。阶段 A 用 3001，两者互不干扰；阶段 B 切域名后再决定是否停它（可释放约 150 MB 内存与 8502） | 阶段 A 之前就停掉以腾内存构建（会临时中断 `rag.changziqi.com` 现有演示） |
| D4 | backend 宿主端口 | `18000`（8000 已被 gunicorn 占用） | 其他空闲端口 |
| D5 | web 宿主端口 | `3001`（空闲） | 阶段 B 可改为只绑 127.0.0.1，彻底不对公网开放 |
| D6 | 阶段 B 是否接受「复用现有 `rag.changziqi.com` 证书、只改一行 `proxy_pass`」 | **建议接受**：改动最小、可回滚、不影响其他站点 | 新建独立 server block（需再跑 Certbot） |
| D7 | 是否允许我通过 SSH 执行部署 | 本轮我只做了**只读勘查**，未做任何改动；执行部署会重启/新增容器并改 Nginx | 你授权后我可以按 §7 执行，或你手动执行 |

**明确声明**：本轮我对服务器**只执行了只读命令**（`free`/`df`/`docker ps`/`docker images`/`ss`/`nginx -T`/`cat` 配置），
**未修改任何配置、未重启任何服务、未创建或删除任何文件**。

---

## 12. 最终结论

# ❌ NOT READY FOR PUBLIC DEMO

**理由（逐条对应本报告证据）**

1. **`docker compose build` 未执行**：本机无 Docker，两个镜像未经构建验证 —— 用户 §6 的硬性门禁未满足。
2. **未部署**：容器未在任何环境启动过，`health` 未验证。
3. **未做公网验证**：公网 IP / 域名 / HTTPS / 外网 Golden Demo 冒烟 / 重启恢复，全部未执行。
4. **未推送**：`v3.0.0` 与分支仅存在于本地，远端 `main` 之外无此版本，服务器无法 `git checkout v3.0.0`。
5. **存在未决的服务器资源与端口冲突**（§11.2 D2/D3）：1.9 GB 无 swap、8000/8502 被占用 —— 需先决策再动手。

**为什么不是「差不多就 READY」**：本报告的可验证部分（冻结、打包、本地回归、同源反代、安全策略）已全部通过，
但**「部署」本身一次都没有发生过**。按用户「不要因为『差不多』就写 READY」的要求，结论必须是 NOT READY。

### 12.1 与服务端部署就绪度的区分

本轮之后，**产物侧**（代码冻结 + tag + 远端可获取）已经就绪：
`v3.0.0` 已推送、`docker compose build` 所需的全部配置缺陷已修（含 §3 的 P1–P7，其中 P7 为
「生产构建会把 `localhost:8000` 烧进浏览器包」的 Critical 缺陷，已用**阳性对照**证明漏洞真实存在、
并证明修复后构建产物 0 命中）。

因此：

| 口径 | 结论 |
| --- | --- |
| **READY FOR SERVER DEPLOY**（产物可直接上服务器构建） | ✅ **是** |
| **READY FOR PUBLIC DEMO**（已部署并公网验证） | ❌ 否 —— 部署尚未发生 |

**解除后无需再改代码**：剩余工作全是执行动作 —— 服务器构建 → 阶段 A 验证 → 阶段 B 改一行 Nginx。
本地侧已经冻结在 `a2aad25` / `v3.0.0`，不需要新的代码变更。
本报告将在上述步骤完成后**追加实测结果**（部署时间、镜像 ID、容器状态、公网 URL、health 输出、冒烟结果），并把结论更新为 READY FOR PUBLIC DEMO。
