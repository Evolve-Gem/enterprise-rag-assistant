# V4.0 Release Precheck — Release Snapshot

> Phase 0 of the V4.0 Production Release Procedure.
> 本阶段**只读**：未 commit、未 push、未 build、未部署。
>
> - 时间：2026-09-25 18:24 (+08:00)
> - 目标：`https://rag.changziqi.com`
> - 回滚基线：`rag-copilot-web:3.0.0`（必须保留）

---

## 1. Git 状态（本地）

| 项 | 值 |
| --- | --- |
| branch | `upgrade/v3-enterprise-copilot` |
| HEAD | `3d9e257 docs(resume): freeze the project facts into a reusable resume source` |
| 领先 `origin/upgrade/v3-enterprise-copilot` | **8 commits**（未推送） |
| tags | … `v3.0.2` / `v3.0.3` / **`v3.0.4`**（无 v4.0.0） |

**HEAD 最近 5 个提交**

```
3d9e257 docs(resume): freeze the project facts into a reusable resume source
684d11d docs(portfolio): audit the project facts before writing anything for a job application
5cca2e1 docs(memory): record the intermittent-push finding and the self-referential trap
56cfc34 docs(report): freeze section 15.11 to stop the self-referential chase
e40df7c docs(report): keep 15.11 self-consistent after the range grew
```

**待纳入 V4 提交的工作区变更（13 改 + 8 新增）**

```
 M .task_state.json
 M .workbuddy/memory/2026-09-21.md
 M .workbuddy/memory/MEMORY.md
 M apps/web/src/app/agent/page.tsx
 M apps/web/src/app/ask/page.tsx
 M apps/web/src/app/page.tsx
 M apps/web/src/app/solution-studio/page.tsx
 M apps/web/src/components/layout/app-shell.tsx
 M apps/web/src/components/layout/sidebar.tsx
 M apps/web/src/components/layout/topbar.tsx
 M apps/web/src/components/rag/generation-state.tsx
 M apps/web/src/components/ui/states.tsx
 M apps/web/src/lib/hooks.ts
?? .workbuddy/memory/2026-09-22.md
?? .workbuddy/memory/2026-09-25.md
?? apps/web/src/app/about/
?? apps/web/src/components/ui/page-intro.tsx
?? docs/PRODUCTION_FREEZE_REPORT.md
?? docs/SERVER_INVENTORY_AUDIT.md
?? docs/V4_PRODUCT_ACCEPTANCE.md
?? docs/images/v4/
```

✅ `apps/web/src` 与 `docs` **均已在变更集内**，无遗漏。

---

## 2. 构建上下文风险检查（Phase 3 的前置确认）

| 检查 | 结果 |
| --- | --- |
| `apps/web/.env.local` 是否存在 | 存在（129 B） |
| 是否被 gitignore | ✅ `apps/web/.gitignore:34:.env*` |
| 是否会被提交 | ❌ **不会** —— 因此**不会进入服务器检出，也就进不了 Docker 构建上下文** |
| 内容风险 | 含 `API_PROXY_TARGET=http://127.0.0.1:8000`（非空）—— **若进入构建上下文会导致生产 API 全挂**（Freeze Audit 已实证复现） |
| `apps/web/.env.local.example` | 模板，会被提交（安全） |

> 结论：走 **git 提交 + 服务器检出** 部署，天然规避该风险。
> Phase 3 仍会在**服务器侧**复核一次，Phase 4 会在**镜像内**再验一次（双保险）。

---

## 3. Docker 状态（生产 `81.70.51.32`）

**docker ps**

| 容器 | 镜像 | 状态 | 端口 |
| --- | --- | --- | --- |
| `enterprise-rag-copilot-web-1` | `rag-copilot-web:3.0.0` | **Up 6 days (healthy)** ✅ | `0.0.0.0:3001→3001` |
| `enterprise-rag-copilot-backend-1` | `rag-copilot-backend:3.0.0` | **Up 6 days (healthy)** ✅ | `127.0.0.1:18000→8000` |
| `enterprise-rag-demo` | `enterprise-rag-demo:20260822` | Up 4 weeks (healthy) | `0.0.0.0:8502→8501` |

**docker images**

| 镜像 | ID | 大小 | 创建 |
| --- | --- | --- | --- |
| `rag-copilot-web:3.0.0` | `21cd214378ea` | 1.26 GB | 6 days ago |
| `rag-copilot-backend:3.0.0` | `af895e658e6d` | 460 MB | 6 days ago |
| `python:3.12-slim` | `78387bc3881b` | 190 MB | 3 weeks ago |
| `enterprise-rag-demo:20260822` | `138dde237055` | 803 MB | 4 weeks ago |
| `node:22-alpine` | `c610fcdfb1d5` | 232 MB | 8 weeks ago |
| `hello-world:latest` | `c3cbe1cc1aa5` | 25.9 kB | 6 months ago |

**volumes**：`enterprise-rag-copilot_backend-data`（**禁止删除**）

**docker compose ps**：`backend` 与 `web` 均 `Up 6 days (healthy)`
**服务器当前部署提交**：`8725620 fix(docker): keep the path separator when rewriting the npm registry`
**服务器工作区**：干净（无未提交改动）

---

## 4. Phase 0 门禁结论

| 门禁项 | 要求 | 实测 | 判定 |
| --- | --- | --- | --- |
| V3 web healthy | 必须 | Up 6 days (healthy) | ✅ PASS |
| V3 backend healthy | 必须 | Up 6 days (healthy) | ✅ PASS |
| V3 回滚镜像存在 | 必须 | `rag-copilot-web:3.0.0`（1.26 GB） | ✅ PASS |
| backend volume 存在 | 必须 | `enterprise-rag-copilot_backend-data` | ✅ PASS |
| 服务器工作区干净 | 推荐 | 干净 | ✅ PASS |
| 危险 env 文件在提交之外 | 必须 | `.env.local` 已 gitignore | ✅ PASS |
| 磁盘余量 | 需要 | 23 G 已用 / 25 G 可用（49%） | ✅ PASS |

**Phase 0 结论：PASS — 可以进入 Phase 1（Commit V4）。**

---

*本文件只记录 Phase 0 实测快照。*
