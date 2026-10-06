# Enterprise RAG Copilot V4.0 — Production Release Report

> 目标站点：**https://rag.changziqi.com**
> 发布日期：2026-09-25
> 发布性质：生产发布（Product Experience Upgrade Round 1）

---

## 最终结论

# ENTERPRISE RAG COPILOT V4.0
# READY FOR PUBLIC HR DEMO

---

## 1. Commit SHA

| 项 | 值 |
| --- | --- |
| **Release commit** | **`5396db266e57093feeb5035fdee8dc02226147af`**（短：`5396db2`） |
| 提交信息 | `feat: release enterprise rag copilot v4 product experience` |
| 分支 | `upgrade/v3-enterprise-copilot` |
| 变更规模 | **30 files changed, 2803 insertions(+), 343 deletions(-)** |
| 前一个部署提交 | `8725620`（fast-forward，无分叉） |
| 部署服务器 HEAD | `5396db2`（工作区干净） |

✅ **`git push` 已完成**（由紫棋本人于 2026-09-25 22:1x 执行，远端分支头已核验为 `5396db2`）—— 详见 §9。

---

## 2. Build Result

```
cd /opt/enterprise-rag-copilot/repo && docker compose build web
→ web  Built
```

| 项 | 值 |
| --- | --- |
| 构建方式 | `docker compose build web`（**只构建，未启动**） |
| 构建耗时 | 约 10 分钟（2 vCPU / 2 GB 机器 + swap） |
| 结果 | ✅ 成功 |
| 构建期间运行中容器 | 未受影响（web/backend 仍 `Up 6 days`） |

> **关于 exit code**：本次构建通过 SSH 长会话执行，该会话在后台挂满 2 小时后被 `Connection reset by peer` 断开，
> 因此包装脚本的 `BUILD_EXIT=` 行未打印。**这属于会话断线，不是构建失败**，构建结果已用三项原始证据独立复核：
> ① 服务器构建日志结尾为 `web Built`，全文 0 处 `ERROR`/`FAILED`；
> ② `rag-copilot-web:4.0.0` 镜像存在（`sha256:e9d9d6a5a5ad…`，创建于 2026-09-25T18:31:16+08:00）；
> ③ 容器 `enterprise-rag-copilot-web-1` 已在该镜像上运行（复查时 `Up 2 hours (healthy)`）。

**Phase 3 前置门禁（防 `.env.local` 污染）**

| 检查 | 结果 |
| --- | --- |
| 服务器 `apps/web/.env.local` | **不存在** ✅（只有 `.env.local.example`） |
| 仓库根 `.env` | 存在，但被 `.dockerignore` 第 14–15 行排除 ✅ |

---

## 3. Image Version

| 镜像 | ID | 大小 | 创建 | 说明 |
| --- | --- | --- | --- | --- |
| **`rag-copilot-web:4.0.0`** | `e9d9d6a5a5ad` | 1.27 GB | 2026-09-25T18:31:16+08:00 | ✅ 本次发布 |
| `rag-copilot-web:3.0.0` | `21cd214378ea` | 1.26 GB | 2026-09-19T13:10:17+08:00 | 🔒 **保留（回滚用）** |
| `rag-copilot-backend:3.0.0` | `af895e658e6d` | 460 MB | 2026-09-19 | ✅ 按规程**不重建**（V4 无后端改动） |

**Phase 4 镜像内容验证（关键门禁）**

```
docker run --rm --entrypoint sh rag-copilot-web:4.0.0 -c \
  "grep -oE 'http://[a-zA-Z0-9._:-]+' .next/routes-manifest.json | sort -u"
→ http://backend:8000
```

| 检查 | 要求 | 实测 | 判定 |
| --- | --- | --- | --- |
| 烘焙的反代目标 | 只有 `http://backend:8000` | `http://backend:8000` | ✅ PASS |
| 是否出现 `http://127.0.0.1:8000` | 禁止 | 未出现 | ✅ PASS |

`/health → http://backend:8000/health`、`/api/:path* → http://backend:8000/api/:path*` —— 与 compose 网络一致。

---

## 4. Deployment Time

| 事件 | 时间（+08:00） |
| --- | --- |
| Phase 0 快照 | 18:24 |
| Release commit 创建 | 18:26 |
| Bundle 传送到服务器（md5 校验一致） | 18:27 |
| 服务器 fast-forward 到 `5396db2` | 18:28 |
| Phase 3 构建开始 / 完成 | ≈18:30 → 18:31 |
| Phase 4 镜像验证 | 18:31 |
| Phase 5 `.env` 备份 | 18:39 |
| **Phase 6 `docker compose up -d` 完成** | **18:39:16** |
| Phase 7–10 验收完成 | 18:40 → 18:56 |

**容器状态**

| 容器 | 镜像 | 创建 | 状态 |
| --- | --- | --- | --- |
| `enterprise-rag-copilot-web-1` | **`rag-copilot-web:4.0.0`** | 2026-09-25 18:39:16 | **Up (healthy)** |
| `enterprise-rag-copilot-backend-1` | `rag-copilot-backend:3.0.0` | 2026-09-19 13:11:54 | **Up 6 days (healthy)** —— 未重建 |
| `enterprise-rag-demo` | `enterprise-rag-demo:20260822` | 2026-08-22 | Up 4 weeks (healthy) |

> `docker compose up -d` 的输出确认：`backend-1 Running`（未动）、`web-1 Recreate → Recreated → Started`。

---

## 5. Smoke Test（生产环境）

真实 Chromium（CDP）对线上站点：**3 视口 × 8 路由 = 24 组合**。

| 视口 | 结果 |
| --- | --- |
| desktop 1440×900 | 8/8 ✅（横向溢出 0 · console error 0） |
| phone 390×844 | 8/8 ✅ |
| phone 430×932 | 8/8 ✅ |

| 指标 | 结果 |
| --- | --- |
| 横向溢出 ≠ 0 | **0 / 24** |
| console error + page exception | **0** |
| 路由 HTTP 非 200 | **0** |

> 一处 `http=0` 是**探针自身伪影**：首格在浏览器仍处于 `about:blank`（无 origin）时先跑了相对路径 `fetch("/")`。
> 已用 `curl` 直取 `/` → **200** 复核，非站点问题。

**路由映射说明**：任务书 Phase 7 写的是 `/knowledge`、`/knowledge-gaps`、`/evaluation`，
但项目真实路由是 `/knowledge/documents`、`/insights/gaps`、`/insights/evaluation`。
本报告按**真实路由**测试，差异在此显式说明，而不是拿 404 冒充通过。

**V4 已上线的决定性证据**：`/about` 从部署前的 **404** 变为 **200** —— 该路由仅存在于 V4。

---

## 6. Mobile QA

| 尺寸 | 横向溢出 | 首屏三卡片可见 | 汉堡导航 |
| --- | --- | --- | --- |
| 390 × 844 | **0** | **3/3** | ✅ |
| 430 × 932 | **0** | — | ✅ |

（390 的"首屏三卡片"来自 Phase 9 的视口相对几何量测，非目测。）

---

## 7. HR Journey

完整记录见 **`docs/V4_USER_JOURNEY_TEST.md`**。生产环境实测摘要：

| 时间盒 | 目标 | 结果 |
| --- | --- | --- |
| 30 秒 | 知道产品是什么 | ✅ PASS —— 价值主张 + 副标题 + **三张入口卡片全在首屏 900px 内** |
| 1 分钟 | 找到三个入口 | ✅ PASS —— `/ask` `/agent` `/solution-studio` 齐备 + 「3 分钟体验」三步 |
| 3 分钟 | 完成一次真实体验 | ✅ PASS —— Step 1 链接 → `/ask?q=…` **预填成功且未自动提交** → 点击提问 → **真实 AI 回答 + 引用返回** |
| 手机 | 首屏可用 | ✅ PASS —— 溢出 0 · 三卡片在首屏 · 汉堡存在 |

---

## 8. Rollback Status

**✅ 回滚能力完整保留。**

| 回滚要素 | 状态 |
| --- | --- |
| `rag-copilot-web:3.0.0` 镜像 | **存在** —— `sha256:21cd214378ea…`，2026-09-19 构建，1.26 GB |
| `.env` 部署前备份 | **存在** —— `.env.bak.v4predeploy.20260925-183904`（**权限 600**，5556 B） |
| backend volume | **存在** —— `enterprise-rag-copilot_backend-data`（未删除） |
| backend 镜像 | 未重建（V3 容器仍在运行，`Up 6 days`） |
| 回滚命令 | `sed -i "s\|rag-copilot-web:4.0.0\|rag-copilot-web:3.0.0\|" docker-compose.yml && docker compose up -d web` |

**全程未删除任何旧版本。** 唯一被删除的是 Phase 0 前就已确认的废弃资源（T1/T2 清理，与本次发布无关）。

---

## 9. `git push` —— 发布时受阻，已由本人补齐

**发布当时** `git push origin upgrade/v3-enterprise-copilot` **失败**，原因是本机网络层阻断，与代码无关：

| 探测点 | 结果 |
| --- | --- |
| `github.com:443`（本机） | **TCP BLOCKED** |
| `api.github.com:443` | TCP OK |
| `codeload.github.com:443` | TCP OK |
| `ssh.github.com:443` | TCP OK |
| SSH 认证 | `Permission denied (publickey)` —— 无 GitHub 凭据 |
| 服务器直连 GitHub | 不可达 |

（该四点对照与项目既往记录**完全一致**：只有 `github.com` 主机名被阻断。）

**采取的替代路径（已达成同一目标）**：用 **git bundle** 把 release commit 直接送到服务器，
仍是 git 通道，因此 `apps/web/.env.local`（被 gitignore）同样不会进入构建上下文：

```
git bundle create v4_release.bundle 8725620..upgrade/v3-enterprise-copilot
→ 961e887004f72e2603b903b1f408f1d0（两端 md5 一致）
服务器：git fetch ~/v4_release.bundle upgrade/v3-enterprise-copilot
        git merge --ff-only FETCH_HEAD  →  5396db2
```

部署因此**不受影响**。临时 bundle 用完后已从服务器 `~` 删除。

### 9.1 已补齐（2026-09-25 22:1x 回执）

紫棋本人执行了 push。**远端状态已用 `api.github.com` 独立核验**（本 shell 的 `git ls-remote`
至今仍报 `schannel: server closed abruptly`，说明**是本工作 shell 到 `github.com:443` 的通道不通**，
不代表远端没收到 —— 因此不以"我连不上"推断"没推上去"）：

| 项 | 值 |
| --- | --- |
| 本地 HEAD | `5396db266e57093feeb5035fdee8dc02226147af` |
| **远端分支头**（`api.github.com/repos/.../commits/upgrade/v3-enterprise-copilot`） | **`5396db266e57093feeb5035fdee8dc02226147af`** |
| 提交信息 | `feat: release enterprise rag copilot v4 product experience` |
| 提交时间 | 2026-09-25T10:25:16Z（= 18:25:16 +08:00） |
| 结论 | **远端 = 本地，逐字符一致** ✅ |

**至此 §9 不再有任何未完成项。** 远端与生产服务器均位于 `5396db2`。

---

## 10. 已知观察（不阻塞发布）

| # | 观察 | 等级 | 说明 |
| --- | --- | --- | --- |
| 1 | API 自报版本仍是 `3.0.0` | P2 | 后端按规程未重建，`APP_VERSION` 属环境变量（明令禁止修改）。因此 `/about` 页脚会显示 `v3.0.0`，而镜像 tag 是 4.0.0。下次动后端时把 `APP_VERSION` 提到 4.0.0 即可 |
| 2 | 带必填 body 的写端点返回 422 而非 403 | P2 | `POST /api/knowledge/upload`（无 body）先触发 body 校验。**非 V4 回归** —— backend 容器 6 天未重建、代码未变；`POST /api/knowledge/reindex` 与 `DELETE /api/knowledge/documents/{id}` 均正确返回 **403 + `{"error":{"code":"read_only"}}`**，只读守卫完好 |
| 3 | 首屏 HTML 不含产品文案 | P2 | `AppShell` 在认证探测完成前渲染"正在连接后端服务…"外壳，真实 UI 客户端水合后渲染。对真人访问无影响，仅影响无 JS 的爬虫 |
| 4 | 服务器磁盘由 23 G 增至 27 G | P2 | 新增 1.27 GB 镜像 + 构建缓存；仍有 21 G 可用（57%） |
| 5 | `.dockerignore` 的 `.env.*` 未加 `**/` 前缀 | P1（遗留） | 本次部署安全（服务器上无 `apps/web/.env.local`），但这是**未来部署的潜在陷阱**。建议后续加 `**/.env*` |
| 6 | **⚠️ 更正：AC12 / AC13 实际未实现** | P1（已更正） | V4.0 报告曾把「知识洞察产品化」「RAG 评测产品化」标为 ✅。**2026-10-05 复核发现该结论不成立**：`git show HEAD:apps/web/src/app/insights/{gaps,evaluation}/page.tsx` 中 `PageIntro` 计数为 **0**，且这两个文件**从未被任何 V4 提交修改**（最后一次变更是 `ad2b91e`，即 V3 验收提交）。根因是当时的批量改写脚本把改动累加到局部变量 `text`，却把**未修改的原始字符串**写回文件 —— 脚本零失败、tsc 通过，但**实际什么都没写**，属静默空操作。影响：仅两页未获得产品化改进，**无功能损坏、无线上事故**。已于 V4.1 重做这两页并纳入本轮验收。 |

---

## 11. Release Rules 遵守情况

| 规则 | 遵守 |
| --- | --- |
| 禁止直接覆盖当前生产 | ✅ 新 tag `4.0.0`，未覆盖 `3.0.0` |
| 禁止删除 V3 镜像 | ✅ 仍在 |
| 禁止删除 backend volume | ✅ 未动 |
| 禁止修改 nginx 架构 | ✅ 未动（nginx 无需改动） |
| 禁止修改安全组 | ✅ 未动 |
| 禁止修改环境变量 | ✅ 未动（仅**备份** `.env`） |
| 禁止修改 RAG / Agent 逻辑 | ✅ 零改动 |
| 必须保留 V3 回滚能力 | ✅ §8 |
| 必须先 build | ✅ Phase 3 |
| 必须先验证 | ✅ Phase 4（镜像内容门禁） |
| 再切换 | ✅ Phase 6 |
| 部署后 smoke test | ✅ Phase 7–9 |
| 禁止大规模重构 / 顺手优化其他项目 | ✅ 变更集仅 `apps/web/src` + `docs` + 一行 compose 镜像 tag |

---

## 12. 发布后现场证据

```
GET https://rag.changziqi.com/health
{"status":"ok","version":"3.0.0","environment":"production","agent_engine":"langgraph",
 "index_ready":true,"index_document_count":24,"index_chunk_count":283,"llm_configured":true}

GET /api/auth/status
{"password_required":false,"read_only":true,"app_name":"Enterprise RAG Copilot","version":"3.0.0"}

guard_rails: {"password_required": false, "read_only": true,
              "rate_limit": {"enabled": true, "requests": 10, "window_seconds": 60, "scope": "ai_endpoints"}}
```

三项守卫语义与发布前**逐字一致**：无口令、只读、10 次/60 秒（仅 AI 端点）。

---

*本报告只记录实测结果。发布时受阻、随后由本人补齐的 `git push`（§9）、未做的观察项、以及探针伪影都已如实列出。*
