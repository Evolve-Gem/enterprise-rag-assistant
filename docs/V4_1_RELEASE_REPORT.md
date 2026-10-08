# Enterprise RAG Copilot V4.1 — Production Release Report

> 将已验收的 V4.1 发布至 `https://rag.changziqi.com`。
> 本轮只做发布：**未做任何产品设计、UI 优化或顺手重构**。
>
> - 发布日期：2026-10-06
> - 发布前生产版本：V4.0（`rag-copilot-web:4.0.0`）
> - 发布后生产版本：**V4.1（`rag-copilot-web:4.1.0`）**

---

## 0. 最终结论

# V4.1 PRODUCTION RELEASE: PASS

`https://rag.changziqi.com` 已升级至 **Enterprise RAG Copilot V4.1**。

---

## 1. Release Commit SHA

| 项 | 值 |
| --- | --- |
| **Release Commit** | **`ac27d58f73f7eb138c7be6883590767d731f8506`**（短：`ac27d58`） |
| 提交信息 | `feat: release enterprise rag copilot v4.1 ux polish` |
| 变更规模 | **42 files changed, 3873 insertions(+), 1815 deletions(-)** |
| 前一提交 | `5396db2`（V4.0 发布） |
| 部署服务器 HEAD | `ac27d58`，工作区干净 |

**改动范围**（发布前审计）

| 范围 | 数量 |
| --- | --- |
| `apps/web/src/**` | 16 个文件（含 2 个新增组件） |
| `docs/**` | 3 个 markdown + 17 张截图 |
| `docker-compose.yml` | 1（web 镜像 tag 4.0.0 → 4.1.0） |
| **`backend/`** | **0** ✅ |

### ⚠️ `git push` 未能执行（凭据缺失，非网络）

```
fatal: could not read Username for 'https://github.com': terminal prompts disabled
```

这次的失败原因**与上次不同**：`github.com:443` 这次是**通的**（`git ls-remote` 成功返回），
但本机非交互 shell **没有 GitHub 凭据**，无法完成认证。远端仍停在 `5396db2`。

**采取的替代路径（一致达成本轮目标）**：用 **git bundle** 把 release commit 送到服务器 ——
仍是 git 通道，`.env.local`（被 gitignore）同样进不了构建上下文：

```
git bundle create v41_release.bundle 5396db2..upgrade/v3-enterprise-copilot
→ ac27d58，md5 879f842bbb71426d62013ab1c80009ce（两端一致）
服务器：git fetch ~/v41_release.bundle upgrade/v3-enterprise-copilot
        git merge --ff-only FETCH_HEAD  →  ac27d58
```

**待你本人执行（凭据可用时）**：`git push origin upgrade/v3-enterprise-copilot`
（本地现领先 origin **10 个提交**）。

### 附带清理

发布前在工作区发现**两个 0 字节空文件**（`因此`、`本轮为<PUA>本地实现`），
是本会话早前 bash 事故（heredoc 内反引号被当成命令替换）产生的副产物，不含任何用户内容。
已按「0 字节 + 未被 git 跟踪 + 名字命中」三重条件精确删除，未使用通配符。

---

## 2. Image ID

| 项 | 值 |
| --- | --- |
| 镜像 | **`rag-copilot-web:4.1.0`** |
| Image ID | **`sha256:fb6c58bbf954a70f486e6bb28c3ac3e849d2570584a24b97fe3d7ad9cd5bebd5`** |
| 短 ID | `fb6c58bbf954` |
| 创建时间 | **2026-10-06T17:14:40+08:00** |
| 大小 | 256,251,888 bytes（`docker images` 显示 1.27 GB 虚拟大小） |
| 容器 | `enterprise-rag-copilot-web-1`（ID `e2f1f0c2c854`） |

**版本策略**

| 镜像 | 状态 |
| --- | --- |
| `rag-copilot-web:4.1.0` | 本轮新增并部署 |
| `rag-copilot-web:4.0.0` | **未覆盖**，保留为本次回滚镜像 ✅ |
| `rag-copilot-web:3.0.0` | 仍在（更早的回滚点） |
| `rag-copilot-backend:3.0.0` | **未重建** —— 本轮 backend 零改动，按规程复用已验证镜像 ✅ |

---

## 3. Build Result

```
cd /opt/enterprise-rag-copilot/repo && docker compose build web
→ naming to docker.io/library/rag-copilot-web:4.1.0
→ web  Built
```

| 项 | 值 |
| --- | --- |
| 构建方式 | `docker compose build web`（**只构建，未启动**） |
| 结果 | ✅ 成功 |
| 构建期间运行中容器 | 未受影响（web 仍 `Up 10 days` on 4.0.0，backend `Up 2 weeks`） |

> **关于 exit code**：本次构建通过 SSH 会话执行，该会话在构建完成后仍保持打开、挂满 2 小时后被
> `Connection reset by peer` 断开，因此包装脚本的 `BUILD_EXIT=` 行未打印。
> **这属于会话断线，不是构建失败**（V4.0 发布时出现过同一个现象）。构建结果由五项独立证据确认：
> ① 服务器构建日志结尾为 `naming to docker.io/library/rag-copilot-web:4.1.0` + `web Built`；
> ② `docker images` 出现该镜像（`fb6c58bbf954`，created 2026-10-06T17:14:40）；
> ③ Phase 6 在该镜像内部读到 `.next/routes-manifest.json` 并验证通过；
> ④ Phase 8 用它启动的容器 `Up (healthy)`；
> ⑤ Phase 9–13 的全部实测都跑在这个容器上。

---

## 4. Proxy Verification（决定性门禁）

```
docker run --rm --entrypoint sh rag-copilot-web:4.1.0 -c \
  "grep -oE 'http://[a-zA-Z0-9._:-]+' .next/routes-manifest.json | sort -u"
→ http://backend:8000
```

| 检查 | 要求 | 实测 | 判定 |
| --- | --- | --- | --- |
| 烘焙的反代目标 | 只有 `http://backend:8000` | `http://backend:8000` | ✅ PASS |
| `127.0.0.1` 出现次数 | 禁止 | **0** | ✅ PASS |

重写条目：`/health → http://backend:8000/health`、`/api/:path* → http://backend:8000/api/:path*`。

### 环境门禁（Phase 4）—— 这次的结论要写清楚

| 检查 | 结果 |
| --- | --- |
| 服务器（真正的构建上下文）`apps/web/.env.local` | **不存在** ✅（只有 `.env.local.example`） |
| 服务器全仓库其他开发 env（`.env.local` / `.env.development*`） | 无 ✅ |
| git 是否跟踪任何非 example 的 `.env` | 无 ✅ |
| 本地 `apps/web/.env.local` | 存在，但被 `apps/web/.gitignore:34` 排除，**进不了提交** ✅ |

⚠️ **但 `.dockerignore` 存在一个真实的潜在缺口**：其 env 规则是 `.env` 与 `.env.*`
（第 14–15 行），**没有 `**/` 前缀**，因此只覆盖构建上下文根层，
保护不到 `apps/web/.env.local` 这类嵌套路径。

**为什么这没有构成本次发布阻断**：本轮的构建**只在服务器上**进行，上下文来自 git 检出，
而检出里不存在任何开发 env 文件（上方三项检查已证实），并由 Phase 6 在镜像内做了决定性验证。
按任务书「非 P0 发布阻断问题 → 记录为 backlog，禁止顺手优化」，**该项记为 backlog，本轮未修改**。
若将来有人把本地工作区（而非 git 检出）当作构建上下文，这条缺口就会变成 V4.0 前那种 P0。

---

## 5. Deployment Result

```
docker compose up -d
→ backend-1  Running      （未重建）
→ web-1      Recreate → Recreated → Started
```

| 项 | 值 |
| --- | --- |
| 部署时间 | **2026-10-06 17:22:34 +0800** |
| web 容器创建时间 | 2026-10-06 17:22:34 |
| backend 容器 | **未被重建**，`Up 2 weeks` ✅ |

## 6. Container Health

| 容器 | 镜像 | 状态 |
| --- | --- | --- |
| `enterprise-rag-copilot-web-1` | **`rag-copilot-web:4.1.0`** | **Up (healthy)** ✅ |
| `enterprise-rag-copilot-backend-1` | `rag-copilot-backend:3.0.0` | Up 2 weeks (healthy) ✅ |
| `enterprise-rag-demo` | `enterprise-rag-demo:20260822` | Up (healthy) |

---

## 7. HTTP Smoke Test

### 任务书列出的路径（逐个实测）

| 路径 | 状态 | 说明 |
| --- | --- | --- |
| `/` | **200** | |
| `/ask` | **200** | |
| `/agent` | **200** | |
| `/solution-studio` | **200** | |
| `/knowledge` | 404 | ⚠️ **不是本项目的路由**；真实路由见下 |
| `/insights/explorer` | 404 | ⚠️ **不是本项目的路由**；真实路由见下 |
| `/insights/gaps` | **200** | |
| `/insights/evaluation` | **200** | |
| `/about` | **200** | |
| `/health` | **200** | |

**两个 404 是任务书里的路径简写与实际路由不符，不是缺陷。** 对应页面存在于各自真实路由并返回 200：

| 任务书写法 | 项目真实路由 | 实测 |
| --- | --- | --- |
| `/knowledge` | **`/knowledge/documents`** | **200** ✅ |
| `/insights/explorer` | **`/knowledge/explorer`** | **200** ✅ |

判定用的是真实路由。这里显式写出映射，是为了避免「拿 404 冒充通过」或「悄悄换 URL 测」两种失真。

### API

| 端点 | 结果 |
| --- | --- |
| `/api/overview` | 200 |
| `/api/settings` | 200 |
| `/api/auth/status` | 200 —— `{"password_required":false,"read_only":true,...}` ✅ |
| `/health` | `{"status":"ok","index_ready":true,"index_document_count":24,"index_chunk_count":283,...}` |

**守卫语义与发布前逐字一致**：

```
guard_rails: {"password_required": false, "read_only": true,
              "rate_limit": {"enabled": true, "requests": 10, "window_seconds": 60,
                             "scope": "ai_endpoints"}}
```

限流策略**保持原状**（10 次 / 60 秒，仅 AI 端点）✅

> 注：`/health` 与 `/api/auth/status` 自报 `version: 3.0.0` —— 这是**后端**的版本号。
> 本轮 backend 按规程未重建，故该字段不变（与 V4.0 时相同，非本次回归）。

---

## 8. Desktop V4.1 UX Verification（1440×900，生产环境实测）

**Home**

| 检查 | 实测 |
| --- | --- |
| Hero 为新版（玻璃容器 + 新版文案） | ✅ `heroH1Present: true`、`heroIsGlass: true` |
| 首页信息压缩 | **docHeight = 1138 px**（与本地构建实测值完全一致） |
| Demo Status 默认折叠 | ✅ 折叠容器存在，`aria-expanded = "false"` |
| 四个核心能力 tiles 已从默认首页移除 | ✅ 旧 tiles 的 4 条描述句 **全部不存在**；「它是怎么工作的」内部有**恰好 4 项**的能力条（可溯源问答 / 任务执行 / 方案生成 / 知识洞察） |

**Agent IDLE**

| 检查 | 实测 |
| --- | --- |
| MainTaskPanel 满宽 | `panelWidthRatio = 0.953`（占主内容区） ✅ |
| 无巨大结果占位 | ✅ 无「执行结果」区块 |
| 执行设置在主面板内 | ✅ 面板内含「执行模式」 |
| Skill / Tool 默认折叠 | ✅ 折叠容器存在且 `aria-expanded="false"` |
| Run 首屏可触达 | `runBottom = 511` ≤ 900 ✅ |
| 页面高度 | 900 px = 一屏 |

**Solution Studio IDLE**

| 检查 | 实测 |
| --- | --- |
| 输入满宽 | `panelWidthRatio = 0.953` ✅ |
| 无结果预留 | ✅ 未渲染任何结果区（`h3` 计数 0，无 EmptyState） ✅ |
| Generate 首屏可触达 | `generateBottom = 624` ≤ 900 ✅ |

---

## 9. Mobile QR Verification（P0）

判定口径（与验收报告 §0.1 一致）：元素需 `width > 2 && height > 2`（排除隐藏元素）且
`top >= 0 && bottom <= innerHeight && left >= 0 && right <= innerWidth` 才算「完整可见」。

| 检查 | 390×844 | 430×932 | 375×812 |
| --- | --- | --- | --- |
| 价值主张完整可见 | ✅ 114→221 | ✅ 114→185 | ✅ 114→221 |
| 两个 CTA 完整可见 | ✅ 2/2 | ✅ 2/2 | ✅ 2/2 |
| 知识问答完整可见 | ✅ 591→651 | ✅ 527→586 | ✅ 591→651 |
| AI 任务完整可见 | ✅ 659→718 | ✅ 594→654 | ✅ 659→718 |
| **方案生成完整可见** | ✅ **726→786** | ✅ **662→721** | ✅ **726→786** |
| 第三入口 bottom ≤ 844 | **786 ≤ 844** ✅ | **721 ≤ 932** ✅ | **786 ≤ 812** ✅ |
| 横向溢出 | **0** | **0** | **0** |

---

## 10. Mobile Functional Journey（模拟 HR 扫码）

| 步骤 | 实测 |
| --- | --- |
| 1. 打开首页 | ✅ 溢出 0 |
| 2. 点击知识问答 | ✅ 跳转到 `/ask`，溢出 0 |
| 3. 完成一次真实 Ask | ✅ **回答渲染**（真实 AI 调用） |
| 4. 查看 Citation | ✅ 抽屉打开，**面板 390×844 = 视口 390×844（widthRatio 1.00 / heightRatio 1.00）** → 保持全屏 sheet |
| 5. 进入 AI 任务 | ✅ **Run 底边 799 ≤ 844 → 无需滚动即可触达** |
| 6. 进入方案生成 | ✅ **Generate 底边 683 ≤ 844 → 无需滚动即可触达** |

| 指标 | 结果 |
| --- | --- |
| horizontal overflow | **0** |
| console error | **0** |
| broken CTA | **0**（全部跳转 200） |
| touch issue（<44px 触控目标） | **0** |

---

## 11. Real AI Regression

三次**真实**执行（非静态页面判断）：

| 链路 | 实测 |
| --- | --- |
| **Ask** | ✅ 回答渲染；引用 chip 可点击并打开来源 |
| **Agent** | ✅ 执行结果渲染；**结果优先成立**（执行结果 y=232 ＜ 刚刚发生了什么 y=3994）；完整执行轨迹折叠块存在且可展开 |
| **Solution** | ✅ 渲染 **8 个章节**；输入折叠为「本次客户需求」（默认收起）；方案宽度比 **0.953（满宽）**；**Markdown 与 Word 导出入口均存在** |

---

## 12. Rollback Readiness

| 回滚要素 | 状态 |
| --- | --- |
| `rag-copilot-web:4.0.0` | **存在** —— `sha256:e9d9d6a5a5ad…`，2026-09-25 构建 ✅ |
| `.env` 部署前备份 | **存在** —— `.env.bak.v41predeploy.20261006-172225`（**权限 600**） ✅ |
| backend volume | **存在** —— `enterprise-rag-copilot_backend-data` ✅ |

**回滚命令（本轮未执行，仅验证路径成立）**

```bash
cd /opt/enterprise-rag-copilot/repo
sed -i "s|rag-copilot-web:4.1.0|rag-copilot-web:4.0.0|" docker-compose.yml
docker compose up -d web
```

**全程未删除任何旧生产资产。**

---

## 13. Known Issues（均为 backlog，本轮按要求未顺手优化）

| # | 问题 | 等级 | 说明 |
| --- | --- | --- | --- |
| 1 | `git push` 未执行 | 外部 | 本机非交互 shell 无 GitHub 凭据（本次网络是通的）。已用 git bundle 完成部署；待你本人 push（本地领先 origin 10 个提交） |
| 2 | **`.dockerignore` 的 env 规则缺 `**/` 前缀** | P1（潜在） | `.env` / `.env.*` 只覆盖根层，保护不到 `apps/web/.env.local`。本次不构成阻断（服务器检出里不存在任何开发 env，且 Phase 6 已在镜像内验证）。**若将来改用本地工作区当构建上下文，会立刻变成 P0** |
| 3 | `/knowledge` 与 `/insights/explorer` 不存在 | P2 | 任务书使用的路径简写；真实路由为 `/knowledge/documents` 与 `/knowledge/explorer`（均 200）。加跳转属产品改动，本轮不做 |
| 4 | 能力条只保留 4 项名称 | P2（精度说明） | Patch 移除了独立 tiles 区块，其原本的 4 条一句话描述未随之下沉。验收报告里「信息未丢失」指的是**四个能力项本身**保留，描述句已不再呈现 |
| 5 | API 自报版本仍为 `3.0.0` | P2 | backend 按规程未重建，`APP_VERSION` 属环境变量（本轮禁止修改） |
| 6 | 知识库 / 知识探索两页未加 `PageIntro` | P2（有意） | 见 `V4_1_UX_ACCEPTANCE.md` §11 |

---

## 14. 现场证据

```
GET https://rag.changziqi.com/health
{"status":"ok","version":"3.0.0","environment":"production","agent_engine":"langgraph",
 "index_ready":true,"index_document_count":24,"index_chunk_count":283,"llm_configured":true}

docker ps
enterprise-rag-copilot-web-1     | rag-copilot-web:4.1.0     | Up (healthy) | 0.0.0.0:3001->3001/tcp
enterprise-rag-copilot-backend-1 | rag-copilot-backend:3.0.0 | Up 2 weeks (healthy) | 127.0.0.1:18000->8000/tcp

服务器 git HEAD: ac27d58 (working tree clean)
磁盘: 50G 中已用 29G（62%）
```

---

*本报告只记录实测结果。未完成的 `git push`、未做的 backlog 项、以及探针自身的口径错误都已如实列出。*
