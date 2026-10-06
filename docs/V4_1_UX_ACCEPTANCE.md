# V4.1 · Product Polish & UX Compression — Acceptance Report

> 本轮为**本地实现 + 本地验收**。任务书明确要求「不要直接部署线上」，
> 因此 `https://rag.changziqi.com` **仍是 V4.0**，本报告的一切结论均来自本地生产构建。
>
> - 验收时间：2026-10-05（V4.1 首轮）+ 2026-10-06（Product Review Patch Pass，本报告全部数字以此为准）
> - 环境：本地 `next build` + `next start` + 真实 FastAPI 后端 + 真实索引（24 文档 / 283 知识块）
> - 改动范围：`apps/web/src/**` + `docs/**`。**`backend/` 0 修改。**

---

## 0.1 ⚠️ 更正：上一版报告有一条结论是错的

上一版报告写「**首屏可见三张核心入口卡片**」，并标注为「视口相对几何量测，非目测」。
**这条结论不成立。** 当初依据的截图里只有「知识问答」完整可见，
「AI 任务」露出部分，第三张「方案生成」在首屏之外。
（那张截图已被 Patch 后重拍覆盖；现在 `mobile/01-home-first-screen.png` 显示的是修正后的状态。）

### 错在测量口径，不在截图

1. **判定条件写错了。** 旧探针用 `rect.top < innerHeight` —— 元素**顶边**进入视口就算「可见」。
   一张从 y=800 开始、在 844px 视口里只露出 44px 的卡片会被判为可见。
2. **取元素的顺序也错了。** 旧探针用 `document.querySelector('a[href="/ask"]')` 取 DOM 中第一个匹配项，
   而第一个是**桌面卡片**（`hidden md:grid`）。隐藏元素的 rect 是 `0×0`，
   而 `0×0` 恰好能通过 `top >= 0 && bottom <= vh` 的判定 ——
   于是「三个入口全部可见」可以完全建立在三个 **0×0 的盒子**上。
3. **沿用旧结论。** 我直接把 V4.0 的 HR 旅程结论搬到 V4.1，没有在改动后重新量。

### 修正后的口径（本轮所有首屏结论均用此判定）

元素必须同时满足 `rect.width > 2 && rect.height > 2`（排除隐藏元素）、
`rect.top >= 0 && rect.bottom <= innerHeight`、`rect.left >= 0 && rect.right <= innerWidth`，
才算「完整可见」；且先从可见元素中按尺寸挑候选，再判定。

### 修正后的实测（`main h1` 作用域）

| 视口 | 价值主张 | 副标题 | 知识问答 | AI 任务 | 方案生成 |
| --- | --- | --- | --- | --- | --- |
| **390×844** | FULL 114→221 | FULL | FULL 591→651 | FULL 659→718 | **FULL 726→786** |
| **430×932** | FULL 114→185 | FULL | FULL 527→586 | FULL 594→654 | **FULL 662→721** |
| **375×812** | FULL 114→221 | FULL | FULL 591→651 | FULL 659→718 | **FULL 726→786** |

三个尺寸下，**三张入口全部完整落在首屏内**（390×844 下第三张底边 786 ≤ 844）。

> `main h1` 这个作用域也是修正的一部分：`document.querySelector('h1')` 会命中**顶栏标题**
> （它是 h1 且在 DOM 中靠前），旧数据里的 `w=165,h=20` 其实是顶栏那条，不是 Hero 主标题。

---

## 0.2 Patch Pass 结果（Product Review 后）

| 项 | 改动 | 实测 |
| --- | --- | --- |
| **P0-1 手机首屏** | Hero 压缩（`py-6→py-4`、区块间距 `gap-6→gap-3.5`、Mascot 72px 块 → **38px 单行状态区**）；三张大卡改为**三行 Compact Action Row** | 入口项高度 **127px → 60px**；三入口在 390 / 430 / 375 全部 FULL ✅ |
| **P0-2 Agent 状态式布局** | IDLE：MainTaskPanel **满宽**（左输入 + 右 compact 设置）+ Run；**不再渲染结果占位**。RESULT：输入折叠成「本次任务」一行摘要（展开即回完整表单）→ 执行结果 → 刚刚发生了什么 → Trace / 中间分析 / 引擎说明 Accordion | IDLE：1440 docHeight=900、Run 底边 **511**；390 docHeight=913、Run 底边 **799 → ≤844 无需滚动**（修复前 894，需滚 50px）。RESULT：**执行结果 y=232 在 刚刚发生了什么 y=3465 之前** ✅ 无空状态占位 Card ✅ |
| **P0-3 Solution 状态式布局** | IDLE 满宽面板；RESULT 输入折叠成「本次客户需求」一行摘要，**方案改为满宽** | IDLE：1440 Run 底边 624、390 底边 683，页面 390 下 **844 = 整一屏** ✅。RESULT：方案宽度 **1132 / 内容宽 1188 = 0.953**（满宽），8 个章节 ✅ |
| **P1 首页去重** | 移除默认展示的四个核心能力 tiles（与三入口语义重复），改为「它是怎么工作的」区块内的一条紧凑能力条 | 首页高度 手机 390 **2166 → 1854（−312px）**、桌面 1440 **1172 → 1138** ✅ 信息未丢失 |
| **附带** | 修掉 `motion.rect` 的 `<rect height="undefined">` 警告（补 `initial` 播种 motion value） | Solution 生成态 + 结果态 **console error 0**（此前 5 条） |

> **顺带更正一处我自己的验证盲区**：上一版报告写「交互运行期间 console error 归零」，
> 但依据的是 **Agent 运行** —— Agent 用的是 `searching` mascot 状态，
> 从未渲染出问题的那 5 个 `motion.rect`。**测过的路径为真，没测的路径为假。**
> 本轮补测 Solution 的 `generating` 状态才定位到。


---

## 0. 最终 Verdict

# 桌面 PASS + 手机 PASS → READY FOR PRODUCTION RELEASE

两端都必须通过才允许给这个结论。依据见 §0.1（更正后的首屏实测）、§0.2（Patch 结果）、§9 与 §10。

---

## 1. Before / After

| 维度 | V4.0 | V4.1 |
| --- | --- | --- |
| 首页纵向长度（桌面 1440） | **2895 px** | **1138 px**（**−60.7%**） |
| 首页纵向长度（手机 390） | **6157 px** | **1854 px**（**−69.9%**） |
| AI 任务页未运行态（桌面） | 1977 px | **900 px**（**−54.5%**）→ 恰好一屏 |
| AI 任务页未运行态（手机 390） | — | **913 px**，Run 按钮底边 799 → 无需滚动 |
| 方案生成未运行态（桌面） | 1317 px | **900 px**（**−31.7%**）→ 恰好一屏 |
| 知识问答（桌面） | 1000 px | 900 px（−10.0%） |
| Demo Dashboard | 与产品内容平铺，一屏看不到底 | 整体收进「查看完整 Demo 状态」 Accordion，**默认折叠** |
| Hero | 白色普通 Card，静态头像 | 轻玻璃拟态 + 环境光晕 + Mascot 状态感「AI Copilot 已就绪」 |
| 主 CTA | 无（只有卡片与快捷 chips） | **立即提问** / **体验 AI Agent** |
| 3 分钟体验 | 三张大卡纵向堆叠 | 桌面**一行 Rail**，手机 compact 纵向 |
| 执行设置 | 独立卡片，把 Run 按钮挤出首屏 | 合并进主任务卡内部 |
| 能力清单（Skill/Tool） | 默认铺开 | 默认折叠，摘要「7 Skills · 10 Tools」 |
| 技术细节 | 与业务信息混排 | 全部 Accordion 折叠，label 自解释 |
| Sidebar 高级能力 | 与核心入口同权重 | **可折叠**，默认收起（当前页所在组自动展开） |
| 手机导航抽屉 | 17rem / max 86vw | **86vw 近全屏**，保留关闭入口 |
| 手机顶栏 | 含刷新按钮 | 只留 页面名 / Menu / Theme |
| 手机触控目标 | 32–36 px（sm 按钮、Select） | **全部 ≥44 px**（设计系统层统一，非逐页补丁） |

---

## 2. Homepage Compression

**做了什么**

1. 默认顺序：**Hero → 三个核心入口 → 第一次来？3 分钟体验 → 它是怎么工作的
   （内含能力条 + 「查看技术实现」折叠）→「查看完整 Demo 状态」**（默认折叠）。
2. 「当前 Demo 状态」**整体**（12 个指标 + 知识覆盖 + 资料分类 + 最近活动 + 最近文档 + 最近提问）
   收进一个 `SectionAccordion`，默认折叠，label 为「**查看完整 Demo 状态**」并附内容说明。
3. 「它是怎么工作的」保留业务五步（可见），把**技术实现表**折进「查看技术实现」。
4. **四个核心能力 tiles 已从默认首页移除** —— 它们与上方三个核心入口语义重复
   （知识问答 / 任务执行 / 方案生成说了两遍）。信息未丢弃，改为「它是怎么工作的」
   区块内**一条紧凑能力条**（4 项，单行）。
5. Demo 面板内的 12 个 `StatCard` 换成 `CompactMetric`（手机 2 列 / 桌面 6 列），即使展开也比原来矮得多。

**效果**：桌面 **−60.7%**（2895 → 1138 px），手机 **−69.9%**（6157 → 1854 px）。

首屏（390×844）内**完整可见**：产品名 + 价值主张 + 副标题 + 两个 CTA + 4 个技术标签
+ AI Copilot 状态区 + **三张核心入口（Compact Action Row，每项 60px，第三张底边 786 ≤ 844）**。
判定口径见 §0.1。

---

## 3. Hero

- **容器**：新增 `HeroPanel` —— 玻璃层**背后**放一层柔和 radial 渐变（`backdrop-blur` 才读得出玻璃感），
  低透明 border（`--color-glass-line`）、极轻阴影、单一内层光晕。**没有**高饱和霓虹、粒子动画或大面积渐变。
- **内容**：`ENTERPRISE RAG COPILOT` 眉标 → 主标题（桌面两行 / 手机三行，实测桌面 h=83、手机 h=107）
  → 副标题 → **立即提问**（主）/**体验 AI Agent**（次）
  → 技术标签 4 个（Hybrid RAG / LangGraph / Citation / Public Read-only Demo）。
- **Mascot**：加 radial glow + 状态胶囊「AI Copilot 已就绪」（`StatusDot` pulse）。
  **桌面**：72px 静态姿态 + `animate-float` 悬浮，置于 CTA 右侧。
  **手机**：压缩为 **38px Mascot + 状态胶囊的「单行状态区」**（无悬浮动画），排在 CTA **之后**，
  只占 38px 高度 —— Patch 前这里是一个约 110px 的 Mascot 块，正是它把第三张入口挤出首屏的。
- **新增令牌**：`--radius-2xl: 20px`、`--color-glass` / `--color-glass-line`（浅深两套）。

---

## 4. Agent（本轮 P0）

页面是**状态式布局**：输入前输入是主角，输出后结果是主角。

**IDLE（未运行）—— 输入占满主内容区**

- **一张 `MainTaskPanel` 占主内容区完整宽度**：左侧任务输入（含示例 Chips），
  右侧 compact 执行设置（执行模式 / 执行引擎 / Human Check），底部整宽 **运行 Agent**。
  原来独立的「执行设置」卡被合并进来。
- **不再渲染任何结果占位**。旧版「左侧窄任务卡 + 右侧巨大空结果区」的形态已去除 ——
  Patch 前那里放的是 `EmptyState`（虽已收窄到 `py-8`，仍是一个占位的结果区）。
- 高度：桌面 1440 **900 px**（Run 底边 **511**）；手机 390 **913 px**、**Run 底边 799 ≤ 844 → 无需滚动**。
- **可用业务能力默认折叠**：header 显示「查看 Agent 可以完成哪些任务 · 7 Skills · 10 Tools」，
  展开后才是 Skill 明细与工具 chip。

**RESULT（执行后）—— 结果占满主内容区**

顺序：**「本次任务」折叠摘要**（一行任务文本，展开即回完整表单 + 重新运行）
→ **「执行结果」**（`ResultSection` 满宽，含置信度 / 输出类型 / 引擎徽标 + 引用入口）
→ **「刚刚发生了什么」**（Intent / Skill / Tool 数 / Step 数 / 耗时 / 证据）
→ **折叠**：查看完整执行轨迹（Trace / Tool 调用 / 执行计划三个 Tab）、查看中间分析结果、查看执行引擎说明。

实测结果优先成立：**执行结果 y=232 ＜ 刚刚发生了什么 y=3465**。
结果页高度 4734 px（V4.0 为 5076 px）。

## 5. Solution Studio

与 Agent **同一状态式范式**。

**IDLE（未生成）—— 需求输入满宽**

- 一张 `MainTaskPanel` 占主内容区**完整宽度**，内含：客户需求输入 → 快速体验示例（一键填「职业院校知识库」）
  → 你将得到 → 整宽 **生成售前方案**。
- **结构化需求字段**（6 项）与**生成设置**（模型 / 检索模式 / 引用上限）**默认折叠**。
- **不提前保留结果空白**：未生成态不渲染任何结果区域。
- 高度：桌面 1440 **900 px**（生成按钮底边 624）；手机 390 **844 px = 整一屏**（底边 683）。

**RESULT（生成后）—— 最终方案满宽**

顺序：**「本次客户需求」折叠摘要**（一行需求文本，展开即回完整表单）
→ **「售前方案」满宽**（`ResultSection` 渲染 8 个章节，`h3` 实测 8 个；导出 Markdown / Word 在该区块头部动作位）
→ 本次方案生成过程 → **折叠**：查看需求解析 / 查看检索证据与引用详情 / 查看生成技术过程。

方案宽度占比 **1132 / 内容宽 1188 = 0.953**（接近满宽；Patch 前是左侧 1/3 输入 + 右侧 2/3 方案，
8 个章节挤在 2/3 宽度里阅读）。

## 6. Knowledge（知识库 / 知识探索 / 知识洞察 / 评测）

| 页面 | 首屏 | 默认折叠 |
| --- | --- | --- |
| 知识库 | Compact Metrics（文档 / 知识块 / Index Status / Last Updated）→ Search+Filter → 文档列表；**详情改为 Drawer**（手机上全屏），不再往页面底部无限追加 | 查看知识块详情 / 查看索引详情 / 批量操作 / 技术说明 |
| 知识探索 | Query / Probe 输入 → Top results（每条只显示 Title / Section / Score / Snippet） | 查看检索详情（BM25 / Vector / RRF / Rerank / raw metadata） |
| 知识洞察 | Coverage Summary（完整度 + 已覆盖 / 部分覆盖 / 缺失）→ 优先补充建议 | 查看全部补充建议 / 查看完整覆盖判定依据 |
| RAG 评测 | 核心指标 Hit@K / MRR / Recall + **动态生成的用户结论** | 查看逐条评测结果 / 查看其余指标 / 查看指标定义 / 查看完整评测数据集 / 查看历史运行 / 查看人工评分说明 |

**评测页的「用户结论」是从 `hit_at_k` 计算的纯函数**，不是写死文案、也不经过模型：

```
>= 0.8 →「当前测试集中，大多数正确资料能够进入前 K 条结果。」
>= 0.5 →「当前测试集中，约一半以上的正确资料能进入前 K 条结果。」
<  0.5 →「当前测试集中，正确资料进入前 K 条的比例偏低。」
```

> Activity / Settings 按任务书「不做结构重构，只统一 Typography / Card / Spacing / Accordion / Empty State」处理：
> 统一卡片圆角与间距、统一标题与等宽数值排版、把存储路径 / Prompt 版本 / 演示保护 / 版本运行时 / 分布统计收进 Accordion。

## 7. Accordion Strategy

- 统一组件 `SectionAccordion`：`aria-expanded` + `aria-controls` + 关闭时 `inert`，
  动画用 `grid-template-rows: 0fr → 1fr`（200 ms，无需动画库），header 恒有 **≥44px** 触控高度。
- **`label` 是必填且必须自解释**（组件层强制）。本轮全部 label：

```
首页    查看完整 Demo 状态 / 查看技术实现
Agent   查看 Agent 可以完成哪些任务 / 本次任务 / 查看完整执行轨迹 / 查看中间分析结果 / 查看执行引擎说明
方案    查看结构化需求字段 / 查看生成设置 / 本次客户需求 / 查看需求解析 / 查看检索证据与引用详情 / 查看生成技术过程
知识库  查看知识块详情 / 查看索引详情 / 批量操作 / 技术说明
探索    查看检索详情
洞察    查看全部补充建议 / 查看完整覆盖判定依据
评测    查看逐条评测结果 / 查看其余指标（关键词覆盖 · 答案准确率）/ 查看指标定义 / 查看完整评测数据集 / 查看历史运行 / 查看人工评分说明
设置    查看 Agent 与运行时 / 查看演示保护与上传限制 / 查看存储路径 / 查看 Prompt 模板与版本 / 查看版本与运行时
记录    查看分布统计
```

> 上面这份清单是从代码里 `SectionAccordion` 的 `label` 逐个核出来的，不是凭记忆列的。
> 「本次任务」与「本次客户需求」是 Patch Pass 新增的两个（结果态下把输入折叠成一行摘要）。

**没有任何「更多」或「Details」。**

---

## 8. 移动端（独立设计，不是桌面的缩小版）

### 8.1 First Screen（390×844 / 430×932 / 375×812）

| 检查 | 390×844 | 430×932 | 375×812 |
| --- | --- | --- | --- |
| 价值主张完整可见 | ✅ 114→221 | ✅ 114→185 | ✅ 114→221 |
| 副标题完整可见 | ✅ | ✅ | ✅ |
| 主 CTA 完整可见 | ✅ 2/2 | ✅ 2/2 | ✅ 2/2 |
| **知识问答 完整可见** | ✅ 591→651 | ✅ 527→586 | ✅ 591→651 |
| **AI 任务 完整可见** | ✅ 659→718 | ✅ 594→654 | ✅ 659→718 |
| **方案生成 完整可见** | ✅ **726→786** | ✅ **662→721** | ✅ **726→786** |
| Mascot 占用高度 | 38 px 单行状态区，排在 CTA **之后** | 同左 | 同左 |
| 横向溢出 | **0** | **0** | **0** |

判定口径见 §0.1（必须**完整**落在视口内，且排除 `display:none` 的零尺寸元素）。

### 8.2 Navigation

- 桌面 Sidebar 在 `md` 以下完全隐藏；汉堡 → **86vw 近全屏** 左侧抽屉，带明确关闭按钮与 Escape 关闭。
- 分组：首页 / 核心能力 / 知识中心 / 高级能力（**可折叠，默认收起**；当前页所在组自动展开）/ 关于项目。
- 顶栏只保留 页面名 / Menu / Theme，**手机隐藏刷新按钮**，不出现 Badge 堆叠。

### 8.3 各页

| 页面 | 手机行为 |
| --- | --- |
| Home | Hero 单栏（Mascot 38px 单行状态区）；三个核心入口为 **Compact Action Row**（各 60px）；3 分钟体验 compact 纵向；Demo 状态保持收起 |
| Ask | 引导 → 输入 → 示例 Chips（允许横向滚动）→ CTA 全在首屏；回答后默认只给 Answer + 引用摘要 + 两个入口 |
| Citation | **全屏 sheet**：实测面板 390×844 = 视口 390×844（widthRatio 1.00 / heightRatio 1.00），带关闭按钮 |
| Agent | 单列；IDLE 一张满宽 MainTaskPanel 发起（Run 底边 799 ≤ 844）；执行设置 compact；业务能力默认完全收起；RESULT 输入折叠为「本次任务」 |
| Agent Trace | **纵向 Timeline**（既有组件即纵向，未做横向宽表） |
| Solution | IDLE 单列满宽：需求 → 快速示例 → 生成（页面 844 = 整一屏）；RESULT 输入折叠为「本次客户需求」，方案满宽 |
| Knowledge | 搜索/Filter 置顶；**卡片列表**而非表格（桌面仍保留表格）；详情全屏 Sheet；Chunk/Metadata 默认收起 |
| Evaluation | 单列 / 双列 compact 指标卡；数据集与逐条明细收进 Accordion |

### 8.4 Touch / Overflow（实测）

| 指标 | 结果 |
| --- | --- |
| 横向溢出（390 / 430 / 375 × 9 页面 = 27 组合） | **0** |
| 触控目标 <44px（390×844 × 9 页面） | **0**（修复前为 3） |
| Citation sheet 占屏比（390×844） | **1.00 × 1.00**（真全屏，非半宽抽屉） |
| console error | **0** |

触控目标在**设计系统层**解决，而非逐页打补丁：`globals.css` 增加 `@media (max-width: 639px)` 规则，
对 `button / [role=tab] / summary / select / input / textarea / a[href]` 施加 `min-height:44px`，
图标按钮与短文字链补 `min-width:44px`。**prose 内的行内链接天然不受影响**（`display:inline` 不吃 `min-height`）。

> 修复前的 3 处违规来自卡片头部的短链（「全部」22×44 /「管理」22×44 /「去提问」33×44），补 `min-width` 后归零。

---

## 9. Tests

| 项 | 命令 | 结果 |
| --- | --- | --- |
| 后端测试 | `python -m pytest -q` | **171 passed**（30.41s） |
| 类型检查 | `tsc --noEmit --incremental false` | **0 error** |
| Lint | `next lint` | **No ESLint warnings or errors** |
| 生产构建 | 见 §11 说明 | **成功**，12 路由 |

### Functional Regression（真实验证，非只跑单测）

| 链路 | 验证方式 | 结果 |
| --- | --- | --- |
| Ask | 真实提问 → 等待「这次回答发生了什么」→ 回答与引用渲染 | ✅（截图 `mobile/04-ask-result`、`mobile/03-ask-idle`） |
| Citation | 点击引用 chip → 抽屉打开；几何实测 **面板 390×844 = 视口 390×844（widthRatio=1.00 / heightRatio=1.00）**，关闭入口存在 | ✅ 全屏 sheet |
| Agent | 真实运行 → 等待「刚刚发生了什么」→ 结果 + 摘要 + 折叠轨迹 | ✅（截图 `v4.1/04-agent-result`、`mobile/07-agent-result`） |
| Solution | 真实生成 → 等待「本次方案生成过程」→ **8 个章节** + 导出按钮 | ✅（截图 `v4.1/06-solution-result`） |
| Knowledge | 列表渲染 + 详情 Drawer | ✅（截图 `v4.1/07-knowledge`、`mobile/09-knowledge`） |
| Gaps / Evaluation | 数据渲染 + 指标与动态结论 | ✅（Browser QA 无 console error） |

---

## 10. Browser QA

真实 Chromium（CDP）对**生产构建**：**5 视口 × 9 页面 = 45 组合**。

视口：1440×900 / 1080×900 / 430×932 / 390×844 / 375×812
页面：Home / Ask / Agent / Solution Studio / Knowledge / Explorer / Gaps / Evaluation / About

| 指标 | 结果 |
| --- | --- |
| 横向溢出 ≠ 0 | **0 / 45** |
| console error + page exception | **0 / 45** |
| 残留骨架屏 | **0 / 45** |
| 内部链接 | 38 条唯一链接，**全部 200**，无 404 |

### UX Compression 实测（默认折叠状态下的页面高度，px）

| 页面 | 1440 | 1080 | 430 | 390 | 375 |
| --- | --- | --- | --- | --- | --- |
| 首页 | 1138 | 1158 | 1772 | 1854 | 1854 |
| 知识问答 | 900 | 900 | 953 | 976 | 976 |
| AI 任务 | 900 | 900 | 932 | 913 | 913 |
| 方案生成 | 900 | 900 | 932 | **844** | 818 |
| 知识库 | 2321 | 2815 | 2590 | 3089 | 3109 |
| 知识探索 | 1548 | 3098 | 3310 | 3134 | 3090 |
| 知识洞察 | 947 | 947 | 1098 | 1134 | 1150 |
| RAG 评测 | 929 | 977 | 1091 | 1168 | 1205 |
| 关于项目 | 2139 | 2180 | 3419 | 3484 | 3521 |

**重点验收项**

| 任务书要求 | 实测 | 判定 |
| --- | --- | --- |
| Home 首要产品内容显著缩短 | 桌面 **−60.7%** / 手机 **−69.9%** | ✅ |
| Agent 未运行态无需明显滚动即可完成 输入 + 设置 + Run | 1440：900 px（Run 底边 **511**）· 390：Run 底边 **799 ≤ 844** | ✅ |
| Solution 未生成态无需明显滚动即可完成 需求输入 + Run | 1440：900 px（底边 **624**）· 390：**844 px = 整一屏**（底边 683） | ✅ |
| Knowledge 第一屏看到 状态 + 搜索 + 文档列表 | 首屏为 Compact Metrics → 搜索/Filter → 列表 | ✅ |
| **390×844 首页首屏三入口真实完整可见** | 三张入口底边 **786 ≤ 844**（口径见 §0.1） | ✅ |
| **Agent Result 结果优先** | 执行结果 y=232 ＜ 刚刚发生了什么 y=3465 | ✅ |
| **Solution Result 满宽** | 方案宽 1132 / 内容宽 1188 = **0.953** | ✅ |

---

## 11. Known Issues

| # | 问题 | 等级 | 说明 |
| --- | --- | --- | --- |
| 1 | **本轮未部署** | — | V4.1 Product Review **已于 2026-10-06 正式通过**；本报告为本地验收记录，生产发布另行走发布流程。`rag.changziqi.com` 目前仍是 V4.0 |
| 2 | `next build` 在本机**偶发** `EPERM: open '<distDir>/trace'` | P2（本地环境） | 根因已定位：`next/dist/trace/report/to-json.js` 用 `fs.createWriteStream` 写构建 trace **且未挂 error 监听**，写失败即致命。已证伪「文件锁 / 路径 / 宿主 shim」三条假设。**可用组合**（首次记录时连续成功 3 次，Patch Pass 期间再次连续成功）：`NODE_OPTIONS="" "C:/Program Files/nodejs/node.exe" ... next build` 且**保留 `.next` 不要先挪走**。备用保险绳 `C:/agents/temp/next-trace-tolerance.cjs`。**容器内不受影响**，Docker 构建正常。 |
| 3 | 知识库 / 知识探索两页未加 `PageIntro` | P2（有意） | 这两页的规格是「首屏 = 指标 + 搜索 + 列表」，加标题块会把主任务推下去；顶栏已显示页面名，不重复 |
| 4 | 知识库手机改为卡片列表、桌面仍是表格 | — | 任务书 §7 明确要求，属功能一致的两套呈现，非降级 |
| 5 | 关于项目页未压缩（2139 px） | P2 | 任务书未把 About 列入压缩范围；其内容为一次性阅读的 Product Story |
| 6 | 知识探索在 1080 宽度比 1440 更高（3098 vs 1548） | P2 | 三栏在 1080 退化为单列导致的正常重排，非缺陷 |
| 7 | **上一版的「三入口首屏可见」结论错误** | 已更正 | 判定条件用了 `rect.top < vh`（顶边进入即算可见），且 `querySelector` 取到的是 `display:none` 的桌面卡片（0×0 恰好通过判定）。已在 §0.1 更正口径并重新实测 |
| 8 | **上一版的「交互期间 console error 归零」只覆盖了 Agent 流程** | 已更正 | Agent 用 `searching` mascot，从未渲染出问题的那 5 个 `motion.rect`；补测 Solution 的 `generating` 状态才定位到，本轮已修（补 `initial` 播种 motion value），两状态实测均为 0 |
| 9 | 测量脚本本身多次出错（等待条件写成会出现在别处的宽泛串、选择器漏掉隐藏元素） | 流程 | 已固定为：等待条件必须选**只在目标状态出现**的字符串；元素判定必须先排除 `width/height < 2` 的隐藏元素 |

---

## 12. 本轮修正的一处 V4.0 事实错误

V4.0 发布报告曾把「知识洞察产品化」「RAG 评测产品化」标为 ✅。
**本轮复核发现该结论不成立**：`git show HEAD:apps/web/src/app/insights/{gaps,evaluation}/page.tsx` 中
`PageIntro` 计数为 **0**，且这两个文件从未被任何 V4 提交修改过。
根因是当时的批量改写脚本把改动累加到局部变量、却把**未修改的原始字符串**写回文件 ——
脚本零失败、tsc 通过，但**实际什么都没写**。
影响：仅两页未获得产品化改进，**无功能损坏、无线上事故**。
已在 `docs/V4_RELEASE_REPORT.md` §10 补更正条目，并在本轮真正完成这两页。

---

## 13. 视觉素材

`docs/images/v4.1/`（桌面 8 张）：

```
01-home.png                     02-home-detail-collapsed.png
03-agent-idle.png               04-agent-result.png
05-solution-idle.png            06-solution-result.png
07-knowledge.png                08-mobile-home.png
```

`docs/images/v4.1/mobile/`（手机 9 张）：

```
01-home-first-screen.png   02-home-onboarding.png    03-ask-idle.png
04-ask-result.png          05-citation-sheet.png     06-agent-idle.png
07-agent-result.png        08-solution-idle.png      09-knowledge.png
```

全部来自真实本地生产构建 + 真实后端，无 mock。`04-agent-result` / `06-solution-result` /
`mobile 04-ask-result` / `mobile 07-agent-result` 各含一次真实 AI 调用结果。

> **截图时效标注**（本次只标注、不重拍）：Patch Pass 按要求重拍的是 6 张 ——
> `01-home` · `03-agent-idle` · `04-agent-result` · `05-solution-idle` · `06-solution-result` ·
> `mobile/01-home-first-screen`，它们代表最终状态。
>
> 其余 11 张拍于 Patch 之前。其中 **6 张所拍的页面在 Patch 中改动过 UI**，
> 因此它们显示的是 Patch 前的形态，**不应作为最终状态依据**：
> `02-home-detail-collapsed` · `08-mobile-home` · `mobile/02-home-onboarding` ·
> `mobile/06-agent-idle` · `mobile/07-agent-result` · `mobile/08-solution-idle`。
>
> 剩下 5 张（`07-knowledge` · `mobile/03-ask-idle` · `mobile/04-ask-result` ·
> `mobile/05-citation-sheet` · `mobile/09-knowledge`）所拍页面本轮未改动，仍然有效。

---

## 14. Verdict

| 端 | 结论 | 依据 |
| --- | --- | --- |
| **桌面** | **PASS** | 45 组合零溢出 / 零 console error / 零断链；首页 1138px；Agent 与 Solution 未运行态各 **900px = 一屏**；Agent 结果优先、Solution 方案满宽（ratio 0.953） |
| **手机** | **PASS** | 3 个尺寸零溢出；触控目标违规 **0**；**三张核心入口在 390 / 430 / 375 全部完整落在首屏**（口径见 §0.1）；Agent 与 Solution 主操作在 390 下无需滚动；引用为全屏 sheet |

# READY FOR PRODUCTION RELEASE

---

*本报告只记录实测结果。未做的验证不写成已通过；已知问题写在 §11，不隐藏。*
