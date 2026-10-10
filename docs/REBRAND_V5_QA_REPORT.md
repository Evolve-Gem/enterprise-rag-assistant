# Enterprise RAG Copilot V5 — 全站视觉品牌重塑 · 验收报告

**任务**：Whole Product Visual Rebrand（本地实现 + 本地验收，**未部署生产**）
**日期**：2026-10-09
**构建**：Next.js 15 生产构建（本机 `next build` + `next start`），真实浏览器（Chrome CDP）验收
**配套文档**：`docs/REBRAND_V5_VISUAL_GUIDE.md`（视觉升级说明）；截图 `docs/images/rebrand-v5/`

---

## 0 ｜ 验收结论

| 项 | 结果 |
|---|---|
| tsc | **0 error** |
| ESLint | **0 warning / 0 error** |
| 生产构建 | **成功**（12 路由，45s） |
| 页面巡检 | **33 组合（11 页 × 浅/深/移动）全部 0 横向溢出、0 console error、0 page error** |
| 移动端触控 | **11 页全部 0 个 <24px 独立控件、0 个 24–44px 独立控件** |
| 移动端首屏 | Home 三入口完整可见（第三行底 719px < 844px 视口）✅ |
| 键盘焦点 | 3 页真实 Tab 实测：`:focus-visible` 命中、outline 2px solid ✅ |
| 对比度 | **22 组 token 配对全部 ≥ 4.5:1**（含本轮修复的 2 个） |
| 真实 AI 回归 | Ask / Agent / Solution **3 次真实调用全部成功渲染**；引用抽屉打开 ✅ |
| backend | **0 改动**（git 核对） |
| 部署 | **未部署**（本轮明确禁止） |

**Verdict：PASS（本地验收口径）**

---

## 1 ｜ 变更清单（证据）

```
18 files changed, 965 insertions(+), 362 deletions(-)   （apps/web/src）

M  app/globals.css                    设计系统 V3（墨框/舞台/极光 token + 原语）
M  app/page.tsx                       Home 重构（舞台 Hero + Rail + 流水线 + 仪表盘）
M  app/ask/page.tsx                   kicker + 示例可点击预填
M  app/agent/page.tsx                 kicker + StageStrip
M  app/solution-studio/page.tsx       kicker + StageStrip
M  app/about/page.tsx                 kicker + 品牌 masthead
M  app/insights/gaps/page.tsx         kicker
M  app/insights/evaluation/page.tsx   kicker
M  components/layout/sidebar.tsx      墨色框架 + 品牌区 + 极光 active + LED 状态
M  components/layout/topbar.tsx       墨色框架 + 极光签名线
M  components/ui/hero-panel.tsx       玻璃 → 舞台材质
M  components/ui/page-intro.tsx       kicker + 20px 标题
M  components/ui/card.tsx             新增 Kicker
M  components/ui/section.tsx          ResultSection 墨色头带
M  components/ui/badge.tsx            ink 色阶 ×4
M  components/ui/button.tsx           frame / stage 变体
M  components/ui/data.tsx             CompactMetric plain|lg
M  components/rag/answer-card.tsx     结果头带墨色化 + 空闲控制台 + 示例可点击
?? components/ui/stage-strip.tsx      新增：流程条原语
?? docs/REBRAND_V5_VISUAL_GUIDE.md    视觉升级说明
```

`backend/` 改动数：**0**。未新增任何运行期依赖。未改动 API、文案语义、交互逻辑。

---

## 2 ｜ 视觉变化点（对照 V4.2）

1. **墨色框架**（Sidebar/Topbar/移动抽屉，两种主题恒定）——首屏第一感知变化
2. **舞台材质**：Home Hero / About masthead / Ask 空闲控制台 / Agent·Solution 流程条 / 全部结果头带（5 类旗舰瞬间）
3. **首页结构重构**：动作 Rail（连通三列）替代三张漂浮卡片；示例变列表；流水线变编号节点；指标变仪表盘
4. **排版放大**：Hero 27/36/40px 三档；页面标题 20px + kicker；展示级数字
5. **极光信号**：active 竖条、签名线、氛围光——只在墨面出现
6. **组件语言**：ink 徽章色阶、frame/stage 按钮变体、LED 状态点

（详述见视觉升级说明 §3–§6；Before/After 对照见 `docs/images/rebrand-v5/before-after/`，7 组。）

---

## 3 ｜ 一致性与主题检查

- **一致性**：11 个页面共享同一组原语与 kicker 语言；框架层（Sidebar/Topbar/画布/间距）全局唯一实现；结果头带在 Agent / Solution / Gaps / Evaluation / Documents 五个页面呈现完全相同的墨色语言
- **Light**：33 组合中 11 页浅色全部 0 溢出 / 0 console
- **Dark**：11 页深色全部 0 溢出 / 0 console；墨框与画布保持 1 级微差（frame `#0e0f15` vs canvas `#08080b`），层级由边线表达，属设计意图
- **未出现"翻色式"暗色回归**：舞台/框架为恒定材质，与主题解耦

---

## 4 ｜ 移动端检查

- 390×844 真实设备指标（deviceScaleFactor 2）下 11 页：
  - 横向溢出 **0**
  - console error **0**
  - **<24px 独立控件 0 个**；**24–44px 独立控件 0 个**（WCAG 2.2 SC 2.5.8 之上，产品线 44px 达标）
  - 行内引用（prose 内）按 WCAG 豁免规则未计入并单独保留豁免规则
- 首屏预算：Home 三入口完整落在 844px 视口内（实测第三行底 719px）——与 V4.2 的约束一致，本轮未牺牲首屏
- 移动导航抽屉：墨色材质、品牌区、极光 active、LED 状态区（截图 `after/23-home-390-drawer.png`）

---

## 5 ｜ 键盘与焦点检查

真实 Tab 键驱动（非程序化 focus）：

| 页面 | focus 迁移 | outline | :focus-visible |
|---|---|---|---|
| home | ✅ | 2px solid | true |
| ask | ✅ | 2px solid | true |
| agent | ✅ | 2px solid | true |

墨面上的焦点环使用提亮极光色（`--color-frame-accent`，9.12:1）——修复了浅色主题 accent 在墨底仅约 2:1 的问题（`globals.css` 的 `.ink-frame :focus-visible` 规则）。

---

## 6 ｜ 对比度检查（全量计算，非抽样）

22 组 token 配对全部 ≥ 4.5:1（WCAG AA 正文级）。**本轮发现并修复 2 个**：

| token | 修复前 | 问题 | 修复后 |
|---|---|---|---|
| `--color-frame-ink-faint`（V5 新增） | `#686c7e` → **3.62:1** | 墨框上 10px 标签低于 AA | `#7d8093` → **4.83:1** |
| `--color-ink-faint`（**V4.2 遗留**） | `#7c7c88` → 白底 4.12:1 / 画布 3.75:1 | V4.2 报告声称 ≥4.4:1，实测不达标（4.4 本身也低于 AA 4.5） | `#6f6f7a` → 白底 4.96 / subtle 4.76 / inset 4.56 / 画布 4.52 |

其余关键配对（节选）：frame-ink 17.14:1 / stage-ink 17.80:1 / stage-ink-muted 6.94:1 / 主按钮白字 6.29:1 / kicker 5.73:1 / 深色主题 ink 16.85:1。完整清单见审计脚本输出（22/22 通过）。

> 方法说明：对比度按 WCAG 相对亮度公式对 token 十六进制值**计算**得出（后端 venv Python，脚本 `contrast_check.py`），与浏览器 computed style 交叉验证（`devcheck2` 曾实测 active 底色 `rgba(124,132,255,0.17)`、hero radius 24px 等均与 token 一致）。

---

## 7 ｜ 真实 AI 功能回归（本机生产构建 + 真实后端）

| 功能 | 操作 | 结果 |
|---|---|---|
| Ask | 输入问题 → 点击「提问」 | ✅ 回答渲染（`已溯源（4 条引用）`头带 + 正文 + 证据台账） |
| Citation Drawer | 点击正文引用编号 | ✅ 抽屉打开（`role="dialog"`），显示被引原文与检索元数据 |
| Agent | 输入任务 → 「运行 Agent」 | ✅ 结果渲染（`执行结果`头带 + 置信度 99% + langgraph·9.53s + 完整分析） |
| Solution | 输入需求 → 「生成售前方案」 | ✅ 结果渲染（`售前方案 · 8 章节 · 4 引用 · 9.74s` + 编号章节 + 导出按钮） |

> 采集方法：CDP 真实输入（React controlled input 原生 setter + input 事件）+ 精确按钮文案匹配 + **h2 标签级等待**（避免"按钮文案即含结果词"的假阳性——本轮曾因此误判一次 Solution 结果，已修正并重拍）。截图：`after/15..19b`。

---

## 8 ｜ 已知不足与下一步建议

**本轮已知不足（如实列出）**：

1. **结果态截图来自本机生产构建，非线上**——本轮明确不部署；截图中的回答内容受模型随机性影响，仅用于演示 UI 形态。
2. **工具型页面（Activity / Evaluation / Settings / Explorer）未做逐页结构重排**——它们通过原语（徽章/按钮/头带/kicker）继承新语言，但页面骨架仍是 V4.2 形态。判断：工具页密度优先，重构收益低于风险，列为 backlog。
3. **整页（fullPage）截图未采集**——沿用 V4.2 的视口截图策略（超长页整页捕获不稳定，V4.2 曾有超时前科）；如需长图可后续以分片拼接。
4. **`--color-ink-faint` 与 `--color-ink-muted` 的视觉层级差收窄**（#6f6f7a vs #63636f）——对比度修复的代价；层级现主要由字号/字重承载（与 V4.2 方法论一致）。
5. **结果页计数徽章（如「6/8 章节引用」）** 仍使用 V4.2 的 warning/accent 徽章色，未换 ink 语言——它在浅色正文里，浅色徽章是对的；保留。
6. **AppShell 在 backend 不可用时可能整站错误**（V4.1 既有战略债）——本轮未触碰，仍在登记。

**下一步建议（不自动执行）**：

- 若认可本轮效果 → 进入「V5 发布流程」（对齐 V4.2 的 precheck → build → deploy → smoke test 流程；本轮已产出可比对的全部本地证据）
- 工具页的逐页结构重排（Activity 时间轴 → 墨线时间轴；Evaluation 指标 → 仪表盘）可作为 V5.1
- Before/After 对照图可直接用于作品集/面试叙事（"全站品牌重塑"是比"UI 优化"强得多的信号）

---

## 附 ｜ 复现方式

```bash
# 构建（本机）
cd apps/web && API_PROXY_TARGET=http://127.0.0.1:8000 next build && next start --port 3001
# 后端
cd backend && uvicorn app.main:app --port 8000
# 巡检脚本（CDP，零第三方依赖）
node C:/agents/temp/rebrand/qa_crawl.mjs      # 33 组合 + 触控 + 焦点
node C:/agents/temp/rebrand/after_capture.mjs # 23 张截图（含 3 次真实调用）
python C:/agents/temp/rebrand/contrast_check.py  # 22 组对比度
```

*本报告所有数字均为本机实测，非估算；证据文件保留在 `C:/agents/temp/rebrand/`（qa-report.json / capture-log.json / 各阶段截图）。*
