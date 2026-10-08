# V4.2 · Product Identity & Release History — Review

> 极小范围的产品身份完善：顶部品牌栏版本号 + 关于项目版本迭代历程。
> **未部署生产环境**，生产仍是 V4.1。

## 0. 最终结论

# READY FOR PRODUCT REVIEW

---

## 1. 实际修改文件

| 文件 | 性质 | 改了什么 |
| --- | --- | --- |
| `apps/web/src/lib/product-version.ts` | **新增** | 产品版本单一事实源：当前版本、发布状态、三个版本条目 |
| `apps/web/src/components/layout/sidebar.tsx` | 修改 | 品牌区产品名旁加轻量版本标识（链接到版本历程） |
| `apps/web/src/app/about/page.tsx` | 修改 | 修正「版本」磁贴、补充 API 版本说明、新增「G. 产品迭代历程」时间线 |

**未触碰**：RAG / Agent / Skill / Tool / Prompt / FastAPI 逻辑 / 知识库 / API Contract /
Docker / Nginx / 生产环境变量 / 权限与限流 / 首页 / Hero / 任何后端常量。
`backend/` **0 修改**。

---

## 2. 产品版本单一事实源

**位置：`apps/web/src/lib/product-version.ts`**

| 导出 | 用途 |
| --- | --- |
| `PRODUCT_VERSION = "V4.2"` | 品牌栏与 About 共用 |
| `PRODUCT_STATUS = "product-review"` | 当前未部署 |
| `STATUS_LABEL` | `released → 已发布`；`product-review → 待发布 · Product Review` |
| `RELEASES[]` | V4.2 / V4.1 / V4.0，含状态、日期、标题、摘要、要点 |
| `PRODUCT_NAME` / `PRODUCT_TAGLINE` | 品牌名与副标 |

### Product Version 与 Backend API Version 的区分（本次修掉的一个真实误导）

审计发现：**修改前前端没有任何地方知道产品版本**。About 页显示的是
`v{overview.data.system.version}` —— 那是**后端 API 版本**，却标成「版本」。
于是产品对外自称 **v3.0.0**，而实际是 V4.x；`package.json` 也停留在 `3.0.0`。

| | 值 | 含义 | 变更时机 |
| --- | --- | --- | --- |
| **产品版本** | `V4.2` | 访客看到的版本 | 仅在正式发布时变更 |
| **API 版本** | `3.0.0` | HTTP 接口版本（`backend/app/core/config.py`） | V4.0/V4.1/V4.2 **均未改动后端**，故三次发布保持不变 |

按任务要求**没有**通过改后端 `APP_VERSION` 来实现前端版本展示。

---

## 3. 版本信息如何被复用

**Sidebar 与 About 都从同一模块读取**，没有任何硬编码版本号：

- `sidebar.tsx` → `import { PRODUCT_TAGLINE, PRODUCT_VERSION } from "@/lib/product-version"`，
  渲染 `{PRODUCT_VERSION}` 与 `{PRODUCT_TAGLINE}`
- `about/page.tsx` → `import { PRODUCT_VERSION, RELEASES, STATUS_LABEL }`，
  磁贴用 `PRODUCT_VERSION`，时间线遍历 `RELEASES`

**改动前**版本号出现在三处且含义混乱（`about` 的「版本」、`app-shell` 的锁屏横幅、
`package.json`），且都是 API 版本。

---

## 4. 版本历程的来源证据（无一处编造）

| 版本 | 日期 | 状态 | 出处 |
| --- | --- | --- | --- |
| **V4.0** | **2026-09-25** | 已发布 | `docs/V4_RELEASE_REPORT.md`「发布日期：2026-09-25」；镜像 `rag-copilot-web:4.0.0` 创建于 `2026-09-25T18:31:16+08:00`；commit `5396db2` |
| **V4.1** | **2026-10-06** | 已发布 | `docs/V4_1_RELEASE_REPORT.md`；部署 `2026-10-06 17:22:34 +0800`；commit `ac27d58` |
| **V4.2** | **无日期** | **待发布 · Product Review** | 尚未部署，**不存在发布日期，未编造**；以 `V4_2_VISUAL_ACCEPTANCE.md` 与独立验收结论为依据 |

---

## 5. 版本状态语义

- About 时间线中 V4.2 节点为**空心**（未发布），V4.0/V4.1 为**实心**（已发布）—— 形状承载状态，不只靠颜色。
- V4.2 徽标文案为「**待发布 · Product Review**」，**不带日期**。
- **生产环境继续展示它实际部署的 V4.1**，本轮未触碰生产，未提前把线上标识改成 V4.2。

自动核查（实测页面文本）：

| 断言 | 实测 |
| --- | --- |
| 存在「产品迭代历程 / Release History」分节 | ✅ `True` |
| 提到 V4.2 / V4.1 / V4.0 | ✅ `True` / `True` / `True` |
| **V4.2 未被标记为已发布** | ✅ `True` |
| V4.2 带「待发布 / Product Review」 | ✅ `True` |
| V4.1 日期 2026-10-06 在页面 | ✅ `True` |
| V4.0 日期 2026-09-25 在页面 | ✅ `True` |
| API 版本单独说明且标为 v3.0.0 | ✅ `True` |
| 「产品版本」磁贴存在 | ✅ `True` |

---

## 6. 视觉与交互要求落实

| 要求 | 落实方式 |
| --- | --- |
| 小型、低存在感 | `text-2xs` 纯文本 + 透明底，**没有**紫色 Badge |
| 不抢 Logo | 版本号在产品名**右侧**且 `shrink-0`，产品名 `truncate` 先让位 |
| 不破坏侧栏宽度 | 折叠态（`collapsed`）直接不渲染版本号 |
| 不换行/截断/挤压 | 实测产品名宽 **135px**、版本标识 **30×14px**、**无重叠 `True`** |
| 链接要有真实反馈 | 是**真链接**（`href="/about#release-history"`），带 hover 底色 + `focus-visible` 描边；实测 Tab 键 `:focus-visible = True`、outline `2px solid rgb(79, 70, 229)` |
| 不用颜色单独表达状态 | 时间线节点用**实心 / 空心**区分已发布与待发布 |

暗色下版本号颜色实测 `rgb(162, 162, 174)`（浅色 `rgb(99, 99, 111)`），均走 token，未写死。

---

## 7. Mobile 适配

| 检查 | 实测 |
| --- | --- |
| 版本号在**导航抽屉品牌区**内 | ✅ `True` |
| 抽屉内版本标识命中区 | **44×44px**（满足 ≥44px） |
| 抽屉内产品名未挤压 / 不重叠 | **135px** / `True` |
| 关闭按钮未受影响 | **44×44px** |
| 375 / 390 / 430 三档横向溢出 | **0**（全部档位） |
| 三档首屏三核心入口完整可见 | 390：`True`，bottoms `[574, 642, 710]`<br>375：`True`<br>430：`True` |

---

## 8. QA 结果

| 项 | 结果 |
| --- | --- |
| TypeScript（`tsc --noEmit --incremental false`） | ✅ **0 error** |
| ESLint | ✅ **No ESLint warnings or errors** |
| Next.js production build | ✅ 成功 |
| 横向溢出（Light + Dark × 375/390/430/768/1080/1440 × `/` 与 `/about`，共 24 组合） | ✅ **全部 0**（非 0 项：无） |
| console error | ✅ **0** |
| 键盘 Focus（真实 Tab 键） | ✅ `:focus-visible` 生效，2px 品牌色描边 |
| 暗色对比度 | ✅ 版本号 `rgb(162, 162, 174)`，走 token |
| About 原有内容 | ✅ 保留（本次为纯增量，A–F 分节未删改） |
| V4.2 未被误标为已发布 | ✅ 见 §5 |

**保留 V4.2 既有 QA 成果**：本轮未重跑完整多 Agent 视觉重构流程（按任务要求），
§7 的溢出/首屏/触控为增量复测，V4.2 的 140 组合矩阵与独立验收结论仍然有效。

---

## 9. 截图

| 文件 | 内容 |
| --- | --- |
| `docs/images/v4.2-identity/01-desktop-light-sidebar.png` | Desktop Light · 品牌栏版本号 |
| `docs/images/v4.2-identity/02-desktop-dark-sidebar.png` | Desktop Dark · 品牌栏版本号 |
| `docs/images/v4.2-identity/03-about-release-history-light.png` | About · 版本历程（Light） |
| `docs/images/v4.2-identity/04-about-full-light.png` | About · 整页（Light） |
| `docs/images/v4.2-identity/05-about-release-history-dark.png` | About · 版本历程（Dark） |
| `docs/images/v4.2-identity/06-mobile-390-nav-drawer.png` | Mobile 390 · 导航抽屉含版本号 |

---

## 10. 已知问题

| # | 问题 | 说明 |
| --- | --- | --- |
| 1 | `package.json` 仍为 `3.0.0` | 本轮未改。产品的版本事实源是 `lib/product-version.ts`；`package.json` 的 `version` 对 Next 应用无实际作用，但**在仓库里仍是误导源**，建议后续对齐或加注释说明 |
| 2 | About 页 `overview` 未加载时版本历程仍显示 | 历程是**静态事实**（来自发布报告），不依赖接口，故先于数据渲染。这是刻意的：接口失败不应让版本信息消失 |
| 3 | 版本号链接会离开当前页 | 跳到 `/about#release-history`。若将来要求在侧栏内展开，需改交互形态 |
| 4 | 未做多 Agent 独立评审 | 按任务书「本轮不重新运行完整 V4.2 多 Agent 视觉重构流程」。改动集中在两处展示层，风险面小；若要更严格，可对本轮单独起一次独立评审 |

---

*本报告只记录实测结果。过程中我自己犯的两个探针错误（未限定作用域导致误判抽屉内无版本号、
用程序化 `.focus()` 判断焦点环）已在 §6、§7 用限定作用域与真实 Tab 键重测纠正。*
