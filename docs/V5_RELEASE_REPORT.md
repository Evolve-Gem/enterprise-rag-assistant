# Enterprise RAG Copilot V5 — Production Release Report

**发布版本**：V5 — INK × AURORA（全站视觉品牌重塑）
**生产地址**：https://rag.changziqi.com
**发布日期（实际部署完成）**：2026-10-10（北京时间约 11:54）
**发布性质**：Release Engineering，Web-only（backend 零改动）

---

## 0 ｜ 最终判决

# V5 PRODUCTION RELEASE: PASS

---

## 1 ｜ Release Commit

| 项 | 值 |
|---|---|
| Commit | **`2e9069d2e42acbb0d8dc1de75d30fa318d08c9be`**（`2e9069d`） |
| 分支 | `upgrade/v3-enterprise-copilot` |
| Message | `feat: release enterprise rag copilot v5 ink aurora rebrand` |
| 内容 | 24 文件，+1588/−379：V5 前端源码（19）+ 设计系统 V3 + StageStrip 新原语 + `product-version.ts` → V5 + `docker-compose.yml` web tag → 5.0.0 + 三份验收文档 |
| backend 改动 | **0** |

## 2 ｜ GitHub Push 状态

**已同步**：`751b566..2e9069d  upgrade/v3-enterprise-copilot -> upgrade/v3-enterprise-copilot`（本轮 push 一次成功，无凭据问题）。

## 3 ｜ 生产服务器 Git HEAD

- 服务器仓库：`/opt/enterprise-rag-copilot/repo`
- HEAD：**`2e9069d2e42acbb0d8dc1de75d30fa318d08c9be`**（与 Release Commit 逐位一致）
- 同步方式：**git bundle**（`c3455ee1453b9b217270c61a6017b71d`，本地/服务器 md5 一致）→ `git fetch <bundle> && git merge --ff-only`
- 说明：服务端直连 GitHub 的 fetch 未生效（静默失败），故采用既有 bundle 方案；源码一致性已用 HEAD + md5 双重验证。

## 4 ｜ Web Image ID

| 项 | 值 |
|---|---|
| 镜像 | **`rag-copilot-web:5.0.0`** |
| Image ID | **`b95eb1e13468`** |
| 大小 / 构建时间 | 1.27 GB / 2026-10-10 11:52:30 +0800（服务器本地构建，rc=0，64.7s） |

## 5 ｜ Backend Image ID

**`rag-copilot-backend:3.0.0`**（`af895e658e6d`，未重建，直接复用；容器 Up 2 weeks healthy）。

## 6 ｜ 镜像 Proxy Verification（决定性门禁）

新镜像内实测 `.next/routes-manifest.json`：

| 目标 | 命中数 |
|---|---|
| `http://backend:8000` | **2**（`/api`、`/health`） |
| `http://127.0.0.1:8000` | **0** |

✅ 本地验收构建的 `127.0.0.1:8000` **未**进入生产镜像；生产镜像烘焙的是 `backend:8000`。

## 7 ｜ Environment Hygiene

- `.dockerignore` 四行防护有效：`.env` / `.env.*` / `**/.env` / `**/.env.*`
- `apps/web/.env.local`（含本地回环代理）存在于本机但被 `apps/web/.gitignore` 忽略 → **服务器源码来自 git，构建上下文不含本地环境文件**
- 服务器从 Release Commit 构建，非本地工作区拷贝

## 8 ｜ 备份及回滚资产

| 资产 | 状态 |
|---|---|
| `.env.bak.v5predeploy.20261010-1153` | ✅ 600 / 5556 B |
| `docker-compose.yml.bak.v5predeploy.20261010-1153`（部署前，web=4.2.0） | ✅ |
| `docker-compose.yml.bak.v5postsync.20261010-1153`（部署后，web=5.0.0） | ✅ |
| `rag-copilot-web:4.2.0`（`be3d64d438b3`）/ `4.1.0` / `4.0.0` / `3.0.0` | ✅ 全部保留 |
| `rag-copilot-backend:3.0.0`（`af895e658e6d`） | ✅ 未动 |
| backend volume `enterprise-rag-copilot_backend-data` + 知识库挂载 | ✅ 完好 |

**回滚方案（单行，仅切 Web）**：
```bash
cd /opt/enterprise-rag-copilot/repo && \
sed -i 's/rag-copilot-web:5.0.0/rag-copilot-web:4.2.0/' docker-compose.yml && \
sudo docker compose up -d --no-deps web
```
（本轮不需要回滚；未删除任何数据、索引或业务记录。）

## 9 ｜ 部署时间

- 部署命令：`sudo docker compose up -d --no-deps web`
- **Web 容器 StartedAt：2026-10-10T03:54:04Z = 北京时间 11:54:04**（部署完成）
- Backend 未重建（Up 2 weeks，无中断）

## 10 ｜ 容器健康

| 容器 | 镜像 | 状态 |
|---|---|---|
| `enterprise-rag-copilot-web-1` | `rag-copilot-web:5.0.0` | Up（healthy） |
| `enterprise-rag-copilot-backend-1` | `rag-copilot-backend:3.0.0` | Up 2 weeks（healthy） |

## 11 ｜ HTTP / API 验收（真实公网）

- **页面路由 10/10 → 200**：`/` `/ask` `/agent` `/solution-studio` `/knowledge/documents` `/knowledge/explorer` `/insights/gaps` `/insights/evaluation` `/insights/activity` `/about`
- `/health`：`ok` · `index_ready=true` · 24 文档 / 283 块 · `agent_engine=langgraph` · `llm_configured=true` · `version=3.0.0`（API 版本）
- `/api/settings`：`password_required=false` · `read_only=true` · `rate_limit=10/60s`
- `/api/auth/status`：`password_required=false` · `read_only=true` · `version=3.0.0`
- `/api/overview`：200
- **产品版本 V5 已在生产可见**（Sidebar 品牌区 + About）；**后端 API 版本保持 3.0.0**（未改 backend）

## 12 ｜ Product Version V5

`apps/web/src/lib/product-version.ts`：`PRODUCT_VERSION="V5"`、`PRODUCT_STATUS="released"`、`releasedAt="2026-10-10"`（=实际部署日）。生产 DOM 实测：Sidebar/抽屉均显示 V5。

## 13 ｜ Release History（生产实测）

About 页 `#release-history`：

- **V5 · 已发布 · 2026-10-10（全站视觉品牌重塑）**
- V4.2 · 已发布 · 2026-10-08
- V4.1 · 已发布 · 2026-10-06
- V4.0 · 已发布 · 2026-09-25
- 未残留「待发布 / Product Review」；历史日期未改动

## 14 ｜ Desktop / Dark / Mobile（生产实测）

| 项 | 实测 |
|---|---|
| Desktop Light | Sidebar/Topbar `rgb(16,17,23)` 墨框；Hero `border-radius 24px`；连通 Rail 3 列；V5 标识 ✓ |
| Desktop Dark | `dark` class 生效，canvas `rgb(8,8,11)`，无白底回归 ✓ |
| Mobile 375 / 390 / 430 | 三入口完整落首屏（底 719px < 812/844/932）✓；横向溢出 0；抽屉含 V5、焦点陷阱、Escape 关闭 ✓（首屏不显示版本徽标，与历史版本行为一致，版本在抽屉与 About 可见）|

## 15 ｜ Ask / Agent / Solution（真实 AI 调用，公网）

| 功能 | 结果 |
|---|---|
| **Ask** | ✅ 真实生成；`已溯源（4 条引用）`；来源 chips 正常；引用抽屉打开正常；**关闭后焦点正确回到引用 `[2]`**（预置焦点后实测） |
| **Agent** | ✅ 真实执行：`知识库缺口分析 · 11.52 s`；置信度徽章；engine=langgraph；Skill 元信息正常 |
| **Solution** | ✅ 真实生成：**8/8 章节完整**（Executive Summary → Next Steps）；[X/8 章节引用] 标记正常 |

限流尊重：全部调用间隔 ≥5s，单窗口峰值 ≤4 次（<10/60s）。

## 16 ｜ Knowledge Explorer

- 生产检索探测（真实执行）：283 候选 → 关键词 16 + 向量 16 → RRF 融合 → 重排 4，命中段与分数正常呈现 ✓
- **手机级联导航**（发布前专项，390×844）：列表 24 文档 → 点第 3 篇详情正确更新 → 滚动回顶列表可达 → 切第 6 篇再次更新 → 探测跑通 → 检索详情展开；0 console / 0 溢出 —— **无导航失效、无无法返回、无内容遮挡**，非发布阻断 ✓

## 17 ｜ Citation / Export（实际文件内容验证）

- Citation：浅/深双主题抽屉实开实拍；`[n]` 上标不破坏阅读
- **Markdown 导出**：真实按钮 → 7,969 B；11 个 `##` 章节（需求原文 + 需求解析 + 8 章节）；含引用编号标记
- **Word 导出**：真实按钮 → 39,839 B，PK zip 有效；`word/document.xml` 9,173 字符；**8/8 章节标题齐全** + 标题「售前解决方案（初稿）」
- 证据文件：`C:/agents/temp/rebrand/prod-downloads/prod-export.{md,docx}`
- 备注：浏览器下载落盘管道（CDP download behavior）在无头环境未生效，但**导出请求在生产后端日志中均为 200**（md 9 ms / docx 3824 ms），最终通过页面内 Blob 捕获取得**按钮真实产物字节**并完成内容校验。

## 18 ｜ Console / Overflow / Focus（生产实测）

**34 条记录全绿**：浅色桌面 10 页 + 深色桌面 10 页 + 移动 390 十页 + 375/430 首页 + 焦点 2 页。
- Console Errors = 0；Page Errors = 0；Horizontal Overflow = 0
- 移动触控（390 × 10 页 + 375/430）：**<24px 小目标 0**
- 键盘焦点：真实 Tab → `:focus-visible` 命中、2px solid

> 口径说明：本条为**生产实测**（2026-10-10），与本地终审记录（82 条 = 77 页面级 + 1 抽屉 + 4 焦点；独立触控 33）**分属不同批次**，未混用。本地终审报告计数已更正（83 → 82）。

## 19 ｜ Known Issues（登记，不在发布中顺手修复）

1. **AppShell 后端不可用容错**（V4.1 起登记）：后端不可用时整站错误态，无渐进降级
2. **Explorer 无页头/kicker**（P2-1）：工具页中最扁平；发布前专项已确认交互无阻断
3. **结果头带四页同构**（P2-2）：设计系统复用的正常代价，留待后续迭代
4. **浅色主题深色占比接近品牌上限**（P2-3）：观察项
5. **未使用 Danger Button 对比度 / 行内 Citation 触控体验**：历史登记项
6. **无头环境下载落盘**：仅影响自动化采集，真实浏览器下载正常（后端 200 + 字节校验已覆盖）
7. 生产无头浏览器深色首屏与浅色首屏 bodyLen 一致（2524），内容渲染正常

## 20 ｜ Final Verdict

# V5 PRODUCTION RELEASE: PASS

- 全部关键门禁通过：Precheck → 发布专项（Explorer 手机交互 / 计数更正）→ 版本 V5 → 环境安全 → Release Commit `2e9069d` → 服务器构建 `b95eb1e13468` → **Proxy Gate（backend:8000 ×2 / 127.0.0.1 ×0）** → 备份 → Web-only 部署（11:54:04）→ HTTP/API → 视觉 → 真实 AI → 浏览器 QA
- 回滚资产齐备；无 P0 / 无关键回归；未触发回滚
- **发布后冻结**：不进入 V5.1、不清理旧镜像、不删除回滚资产、不改动其他项目

---

*本报告在部署完成后生成，作为独立文档提交同步。生产地址：https://rag.changziqi.com*
