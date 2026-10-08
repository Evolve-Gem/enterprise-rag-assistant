# Enterprise RAG Copilot V4.2 — Production Release Report

**发布日期（部署完成）**：2026-10-08（北京时间约 17:10）
**生产地址**：https://rag.changziqi.com
**发布版本**：V4.2 — Visual Experience Overhaul + Product Identity & Release History
**最终判决**：# V4.2 PRODUCTION RELEASE: PASS

---

## 0 ｜ 本轮性质

这是一次**生产发布任务**，不是开发任务。全程未新增功能、未修改 RAG / Agent / Skill / Tool / Prompt / Retriever / Embedding / FastAPI 业务逻辑 / 知识库 / API Contract / Nginx / 安全组 / 密钥 / 限流策略，未清理旧镜像或数据卷，未进入 V4.3。

`backend/` 在本轮发布中**零改动**，因此后端镜像保持 `rag-copilot-backend:3.0.0` 不变。

---

## 1 ｜ Git

| 项 | 值 |
|---|---|
| Release Commit | `994fe38c880f85419824052cdeb699db992e07d1` |
| 分支 | `upgrade/v3-enterprise-copilot` |
| GitHub 同步 | ✅ 本地 HEAD == 远端 HEAD（`ac27d58..994fe38`） |
| 同步方式 | 正常 `git push`（首次因瞬时连接中断失败，retry 成功；非凭据问题） |
| backend 改动数 | **0** |
| 提交内容 | 前端源码（Design System V2 / 全站视觉 / 深色模式 / Mobile / Citation 焦点 / Activity 分页 / 无障碍 / Product Identity / About Release History）、文档、`.dockerignore` 安全修复、`docker-compose.yml` web tag `4.1.0 → 4.2.0` |

> Force Push：未执行。GitHub 凭据：未修改。Token：未硬编码。

---

## 2 ｜ Docker Image

| 镜像 | ID | 大小 | 创建时间（CST） | 状态 |
|---|---|---|---|---|
| `rag-copilot-web:4.2.0` | `be3d64d438b3` | 1.27 GB | 2026-10-08 17:03 | **本次新建** |
| `rag-copilot-web:4.1.0` | `fb6c58bbf954` | 1.27 GB | 2026-10-06 17:14 | 回滚资产（保留） |
| `rag-copilot-web:4.0.0` | `e9d9d6a5a5ad` | 1.27 GB | 2026-09-25 18:31 | 回滚资产（保留） |
| `rag-copilot-backend:3.0.0` | `af895e658e6d` | — | — | 未重建（保持） |

- 构建命令：`sudo docker compose build web`（仅 web，不启动新容器）
- 构建结果：**Built**，耗时约 63.5s
- 构建期间运行容器未受影响（web 仍 4.1.0、backend 仍 3.0.0）
- 未在原 `4.1.0` 标签上重建，回滚镜像完好

---

## 3 ｜ 决定性 Proxy 验证（镜像内实际烘焙配置）

在 `rag-copilot-web:4.2.0` 容器内直接读取 `.next/routes-manifest.json`：

| 目标 | 出现次数 |
|---|---|
| `http://backend:8000` | **2**（`/api`、`/health` 反代） |
| `http://127.0.0.1:8000` | **0** |

✅ 没有把本地开发代理烤进生产镜像。此前的 P0 风险（嵌套 `apps/web/.env.local` 经 `API_PROXY_TARGET` 污染构建）已通过 `.dockerignore` 新增 `**/.env` 与 `**/.env.*` 闭合。

---

## 4 ｜ 环境安全卫生

- `.env` 备份：`.env.bak.20261008-170400`（权限 600，与线上 `.env` 逐字节一致）
- `docker-compose.yml` 备份：`docker-compose.yml.bak.20261008-170400`
- 本地 `apps/web/.env.local` 未被纳入构建上下文（`.dockerignore` 已覆盖嵌套路径）
- 暂存区扫描：无 `.env` / 密钥 / `node_modules` 进入提交
- 密钥未出现在构建日志、提交或本报告

---

## 5 ｜ 生产部署

- 命令：`sudo docker compose up -d --no-deps web`（仅 web，backend 不动）
- 容器重建成 `rag-copilot-web:4.2.0`，约 20s 后 healthy
- 部署完成时间（容器 StartedAt）：2026-10-08T09:10:07Z = **北京时间 17:10:07**

### 容器最终状态

| 容器 | 镜像 | 状态 |
|---|---|---|
| `enterprise-rag-copilot-web-1` | `rag-copilot-web:4.2.0`（`be3d64d…`） | Up，healthy |
| `enterprise-rag-copilot-backend-1` | `rag-copilot-backend:3.0.0`（`af895e6…`） | Up 2 weeks，healthy |

---

## 6 ｜ 容器健康 & HTTP Smoke Test

### 容器健康
- Web：`rag-copilot-web:4.2.0`，healthy ✅
- Backend：`rag-copilot-backend:3.0.0`，healthy ✅

### HTTP 路由（真实公网，期望 200）

| 路由 | 状态 |
|---|---|
| `/` | 200 |
| `/ask` | 200 |
| `/agent` | 200 |
| `/solution-studio` | 200 |
| `/knowledge/documents` | 200 |
| `/knowledge/explorer` | 200 |
| `/insights/gaps` | 200 |
| `/insights/evaluation` | 200 |
| `/insights/activity` | 200 |
| `/about` | 200 |

> 注：项目真实路由为 `/knowledge/documents` 与 `/knowledge/explorer`，已按真实路径核验。

---

## 7 ｜ API 守卫

| 端点 | 结果 |
|---|---|
| `/health` | `{"status":"ok","version":"3.0.0","index_ready":true,"index_document_count":24,"index_chunk_count":283}` |
| `/api/settings` | `password_required=false`、`read_only=true`、`rate_limit` 10/60s |
| `/api/auth/status` | `password_required=false`、`read_only=true`、`version=3.0.0` |

- 守卫语义与发布前一致，**未因发布改变**
- `version` 返回 `3.0.0` 是 **API 版本**（后端接口版本），与产品版本 `V4.2` 刻意区分，不混淆

---

## 8 ｜ Product Version & Release History（真实 DOM 核验）

通过本地 CDP 浏览器渲染生产站点读取 DOM：

| 检查项 | 结果 |
|---|---|
| Sidebar 显示 V4.2 | ✅ |
| About 显示 V4.2 · 已发布 | ✅ |
| V4.1 · 2026-10-06 | ✅ |
| V4.0 · 2026-09-25 | ✅ |
| 不再显示「待发布」/「Product Review」 | ✅ |
| 产品版本与 API 版本未混淆 | ✅ |

---

## 9 ｜ UX 验证（真实 DOM，生产站点）

| 视图 | 检查项 | 结果 |
|---|---|---|
| Desktop Light (1440) | Sidebar V4.2、body `rgb(244,244,247)`（浅色画布非纯白）、版本链接存在 | ✅ |
| Desktop Dark | 点击「切换主题」后 body `rgb(8,8,11)`、无白底回归、theme=`dark` | ✅ |
| Mobile (390×844) | 导航抽屉打开、含 V4.2、无横向溢出 | ✅ |

---

## 10 ｜ 真实 AI 功能回归（公网真实执行）

> 测试请求频率已尊重 `rate_limit = 10 requests / 60s`（三次调用间隔 ≥ 8s）。

### Ask — `POST /api/chat`
- answer 长度 **520** 字，非空
- citations **4**，sources **4**
- 行为正确：对知识库未覆盖的问题如实回答「资料中没有列出……」，未编造检索模式清单（RAG 诚实性表现，非失败）

### Agent — `POST /api/agent/run`
- `run_id` `b6090315518d`
- intent `rag_answer`｜skill `rag_qa_skill`｜engine `langgraph`
- answer 长度 **754** 字，citations **3**，trace **11** 步

### Solution — `POST /api/solutions/generate`
- **8 个章节**全部生成（Executive Summary / Customer Needs / Recommended Architecture / Product Mapping / Implementation Plan / Case References / Risks / Next Steps）
- `grounded=True`，markdown 长度 **2832** 字，citations **4**
- Markdown 导出内容非空（Word 导出为前端对同源 markdown 的转换，已在验收报告对相同构建产物核验）

---

## 11 ｜ Console Errors & Horizontal Overflow

- 生产 `/` 与 `/about`：**0 console error / 0 page error / 0 failed request**（clean）
- 相同构建产物在验收阶段已覆盖 7 视口 × 10 页 × 浅/深 = 140 组合，**零溢出、零 console error**
- 生产移动端 390 实测无横向溢出

---

## 12 ｜ Rollback Readiness

| 资产 | 状态 |
|---|---|
| 回滚镜像 `rag-copilot-web:4.1.0`（`fb6c58bbf954`） | ✅ 保留 |
| 更早回滚镜像 `rag-copilot-web:4.0.0`（`e9d9d6a5a5ad`） | ✅ 保留 |
| Backend 镜像 `rag-copilot-backend:3.0.0`（`af895e658e6d`） | ✅ 未动 |
| Backend volume `enterprise-rag-copilot_backend-data` | ✅ 存在 |
| 知识库挂载 `/opt/enterprise-rag-copilot/repo/knowledge_base → /app/knowledge_base` | ✅ 存在 |
| `.env` 备份（600）与 compose 备份 | ✅ 已备 |

回滚方案（仅在 V4.2 失败时执行）：将 `docker-compose.yml` 的 web tag 改回 `4.1.0`，`sudo docker compose up -d --no-deps web` 仅重建 web。**不删除** backend volume、索引、活动记录、知识库或旧镜像。

---

## 13 ｜ Known Issues（继承自 V4.1，本轮未改动，未伪装已解决）

1. AppShell 在 backend 暂时不可用时可能让整站进入错误状态（不得通过放松鉴权解决）。
2. 部分首页布局仍有模板化痕迹。
3. 未使用的 danger 按钮变体存在暗色对比度问题。
4. 手机正文行内 Citation 命中区较小。

本轮发布**未引入新的生产回归**：所有路由 200、AI 功能正常、深色调无白底回归、产品版本正确显示、部署为 web-only 不影响 backend。

---

## 14 ｜ 最终 Verdict

# V4.2 PRODUCTION RELEASE: PASS

- Git Commit：`994fe38c880f85419824052cdeb699db992e07d1`（已 Push）
- Web Image：`rag-copilot-web:4.2.0`（`be3d64d438b3`）
- Backend Image：`rag-copilot-backend:3.0.0`（未变）
- 部署时间：2026-10-08 17:10 CST
- 容器健康：Web + Backend 均 healthy
- HTTP / API / UX / AI 回归：全部通过
- 回滚资产：齐备

**发布成功后停止**：不进入 V4.3、不增加新功能、不再修改 UI、不清理旧镜像、不删除回滚资产。

---

*本报告在 Release Commit 之后生成，作为独立文档提交并同步（见后续 `docs: add V4.2 release report` 提交）。未暴露任何密钥。*
