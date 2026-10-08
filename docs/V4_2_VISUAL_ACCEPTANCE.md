# V4.2 · Visual Experience Overhaul — Acceptance Report

> ## ⚠️ 阅读顺序提示（2026-10-08 更新）
> **本文档的最新、最终结论在 §23。** §1–§22 是按时间顺序留下的过程记录，
> 其中**多处结论已被后续章节推翻**（如 §12「Dark Mode 未验证」、§13/§18 的旧 Gate 理由、
> §19.1 的旧 BUILD_ID、§21.2/§22 的 `NOT READY`——其唯一阻塞项「暗色主 CTA 对比度」已被 accent-solid 补丁修复）。
> **凡与 §23 冲突的表述，一律以 §23 为准（历史结果）。**
> §23 是**未参与任何代码修改的独立复验者**针对 `--color-accent-solid` 补丁的复验：
> **暗色主 CTA 6.05–6.18:1（hover 5.35–5.44）、8 项全过 → READY FOR PRODUCT REVIEW。**
> （§21.2 / §22 的 `NOT READY` 标注为历史结果，仅对其当时的构建成立。）

> **LOCAL IMPLEMENTATION + LOCAL QA ONLY.** 本轮未部署，`https://rag.changziqi.com`
> 仍是 V4.1。生产改动在单独评审后进行。
>
> - 验收时间：2026-10-07（初稿）/ 2026-10-08（独立复验）
> - 基线：Enterprise RAG Copilot V4.1
> - 范围：`apps/web/src/**` + `docs/**`。**`backend/` 0 修改。**

---

## 1. Design Direction

目标不是加功能，是让产品从「完成度很高的学生 AI 项目」变成「有成熟 SaaS 质感的 AI Copilot」。

关键词与落地判断标准：

| 关键词 | 落在哪 |
| --- | --- |
| Premium | 层级由**光与深度**承担（elevation + 分层背景），不再由「白底 + 灰边」承担 |
| Calm | 动效只允许透明度和 1–2px 位移；没有任何元素在阅读时持续运动 |
| Intelligent | AI 状态由 mascot 的 8 个真实状态 + 阶段文字承担，**没有伪造百分比进度** |
| Modern | 玻璃只用在 Hero 一处；没有 cyberpunk、没有霓虹、没有粒子 |
| Trustworthy | 长文阅读宽度、表格 hover、引用 chip 层级、Error 的「标题 + 说明 + 重试 + 折叠细节」 |
| Lightweight | 无新依赖；动效全部 CSS 或复用已有 framer-motion；无图片/视频背景 |
| Precise | 所有颜色走 token；暗色独立调优，不是反色 |

**明确拒绝的方向**（本轮自查项，见 §11）：渐变文字、大面积紫、到处 glow、每张卡一个 icon+标题+段落、
装饰 blob、漂浮卡片、badge 泛滥。

---

## 2. Design System V2

### 2.1 修掉的两个真实病灶

审计发现 V4.1 有两个**结构性**问题，不是主观审美问题：

1. **`--color-surface` 与 `--color-surface-raised` 在浅色下都是 `#ffffff`。**
   于是「页面 vs 卡片 vs 卡内卡」只能靠 1px 灰边区分 —— 这就是「白卡墙」的机械成因。
2. **`--color-ink-faint: #a1a1aa` 在 `#ffffff` 上对比度约 2.9:1**，低于 WCAG AA 的 4.5:1。
   而它被用在时间戳、元数据等**需要阅读**的地方。

### 2.2 Surface 层级（六层，各自独立取值 + 独立 elevation）

| Token | 用途 | 浅色 | 暗色 |
| --- | --- | --- | --- |
| `--color-canvas` | 页面画布 | `#f4f4f7`（比 V4.1 更深，白面才「浮」得起来） | `#08080b` |
| `--color-surface` | 普通内容卡 | `#ffffff` | `#111116` |
| `--color-surface-subtle` | 次级信息（要后退） | `#fafafb` | `#0e0e13` |
| `--color-surface-raised` | 主任务面板 / 浮层 | `#ffffff` + elev-2 | `#16161c` |
| `--color-surface-result` | **AI 产出** | `#fcfcff`（1% 品牌 wash） | `#12121c`（冷调，不是更浅的灰） |
| `--color-surface-inset` | 凹陷：代码 / 表头 / 输入井 | `#f5f5f8` | `#0d0d12` |

### 2.3 其余 token

- **边框三档**：`--color-line` / `-strong` / `-faint`（卡内分隔用 faint）
  + `--color-line-brand`（只用于 AI 结果区）
- **文字三档**：`--color-ink` / `-soft` / `-muted` / `-faint`（faint 已提至 ≥4.4:1）
- **品牌**：`--color-accent` / `-soft` / `-line` / `-ink` + `--color-brand-glow` / `-glow-soft`
- **Elevation 四级**：`--elevation-1`（普通卡）/ `-2`（主面板与结果）/ `-3` / `-hero`（带品牌色）
- **Motion**：`--motion-fast` 120ms / `-normal` 200ms / `-slow` 320ms；
  `--ease-standard` / `-enter` / `-exit`
- **Radius 语义别名**：`--radius-small`(8) / `-medium`(12) / `-large`(16) / `-hero`(20)
- **新增 `--color-switch-knob`**：`toggle.tsx` 原本硬编码 `bg-white`

### 2.4 复用型工具类

`.surface-base` / `-subtle` / `-raised` / `-result` / `-interactive` / `-inset` / `-glass`、
`.elev-1/2/3`、`.lift`（hover 上浮 1px）、`.press`、`.grain`（1% 噪点）、`.animate-reveal` / `-breathe`

**组件 API 兼容**：`Card` 新增可选 `surface` prop（默认 `base`），旧调用点行为不变。

---

## 3. Before / After

| 维度 | V4.1 | V4.2 |
| --- | --- | --- |
| 层级表达 | 白底 + 1px 灰边 | 六层 surface + 四级 elevation，**边框降为近乎不可见的发丝线** |
| 页面画布 | `#fafafa`（与白卡几乎同色） | `#f4f4f7`，白面因此成为「升起的一层」 |
| AI 结果 | 与普通白卡无区别 | 专用 `surface-result` + 品牌发丝边 |
| 元数据文字对比度 | ~2.9:1（低于 AA） | ≥4.4:1 |
| Hero | 单层玻璃卡 + 一个光晕 | **五层**：环境光 + 玻璃 + 内高光 + 1% 噪点 + 指针光晕（7% 上限） |
| 手机 Hero 状态区 | 72px mascot + `animate-float`（**V4.1 报告声称是 38px，实际不是**） | 38px 单行状态区（本轮真正落地） |
| 按钮 | 变体色变 + `hover:opacity-90` | 六态重做，主按钮带品牌色阴影并随 hover 加深，全站 1.5% 按压反馈 |
| 表单 | 白底 + 边框 | 凹陷输入井 → focus 抬起 + 品牌光晕 |
| Accordion | 边框变色 | 底色 tint + chevron 走统一 easing + header 图标 hover 变品牌色 |
| 动效 | 各页写死毫秒 | 统一 token；新增 `.animate-reveal` 只用于「结果出现」 |
| Reduced motion | 仅覆盖 CSS | **同时覆盖 framer-motion**（`MotionConfig reducedMotion="user"`） |
| 焦点可见 | `:focus-visible` 强制 4px 圆角（会把药丸/圆角卡压方） | 不再改圆角；表单不再 `outline-none` |
| 键盘可达 | 需先 Tab 过整个侧栏 | 新增 skip link + `main#main` |

---

## 4. 逐页视觉改动

### Home / Hero（旗舰）
- **Hero 五层结构**：页面画布 → 玻璃**背后**的环境光（`backdrop-blur` 才有东西可读）→ 玻璃本体
  → 顶部 1px 内高光（「有光的边」比任何边框色都更像玻璃）→ 1% 噪点 → **指针光晕**。
- 指针光晕：420px 衰减、7% 上限、`rAF` 节流、`pointer-events-none`，
  且在 `prefers-reduced-motion` 与触屏设备上**完全不挂载监听**。设计意图是「被感觉到，不被盯着看」。
- **Mascot 成为状态载体**：双层 halo（紧核心 + 弱外围，均 <10% alpha）+ 桌面 `animate-breathe` +
  `animate-float`；状态胶囊带扩散环 + 实心点。
- 手机端状态区压到 **38px 单行**，且去掉了浮动动画。
- 排版：主标题 `tracking-[-0.022em]`、桌面 32px；眉标字距收紧到 0.16em。
- **间距未变** —— 手机首屏三入口是硬约束，本轮的视觉提升全部由光与深度换来，不靠高度。

### Navigation / Sidebar
- Active 态：soft tint + **3px 圆角指示条** + 图标转品牌色（不是一整块紫）。
- hover 从 `surface-sunken` 改为更轻的 `surface-subtle`。
- 分组标签：去掉全大写式字距，改 `tracking-[0.04em]` + `--color-ink-muted`。
- 二级英文名从 `faint` 提到 `muted`。关闭按钮改为 32px 方形命中区。

### Page Header
- 全部页面统一：17px/600 标题 + 13px muted 副标题 + **一条发丝分隔线**。
  统一的是「层级与节奏」，不是「加一个深色横幅」——本产品没有首屏高度可以浪费。

### Buttons / Inputs / Controls
- 按钮六态（默认 / hover / pressed / focus / disabled / loading）全部重做；
  `aria-busy` 补齐；按压 `scale(0.985)`。
- 输入控件五态：凹陷井 → hover 边框收紧 → focus 抬起 + 3px 品牌光晕 → disabled inset；
  新增 `aria-invalid` 错误态样式。
- SegmentedControl 从 `tablist`/`tab` 改为 `radiogroup`/`radio` + `aria-checked`
  （原语义承诺了一个不存在的 tabpanel）。
- Tabs / CodeChip / Kbd / Switch 全部走 token 与统一 motion。

### Ask / Citation
- 问题输入区升为「提问台」：`surface-raised` + focus 品牌光晕。
- 答案区改用 `surface-result`；引用编号做成精致 chip，**不许抢正文**。
- Source Drawer：Document → Section → Snippet → **Retrieval Metadata 降级到最后**。
- 生成态改为**阶段文字**（理解问题 → 检索知识 → 筛选证据 → 组织回答），**无百分比进度**。

### Agent
- 保持 V4.1 状态式结构（IDLE 输入为主角 / RESULT 结果为主角）。
- **执行轨迹重做为纵向 Timeline**：节点（Receive → Intent → Skill → Tool → Evidence → Generate → Complete）
  + 连线 + 状态 + 耗时 + 元数据；失败节点有「图标 + 标题 + 原因 + 折叠技术细节」的完整错误态。
- Tool 调用表：行 hover、状态点、等宽耗时。

### Solution Studio
- 方案结果升为 **Document Surface**：`max-w-[68ch]` 阅读宽度、章节 heading rhythm、
  发丝 section divider、Callout、表头 inset 底 + 行 hover。
- 导出按钮补 `title` 提示与 hover 反馈（复用既有 toast，未新增逻辑）。

### Knowledge / Explorer / Gaps / Evaluation / Activity / About
- **Documents**：指标条改为一条状态栏（`surface-subtle`，格间细线）；桌面表格行 hover +
  选中态 + 操作列 hover 显形；Document Drawer 分层。
- **Explorer**：Query 区改为 Search Lab（`surface-raised`）；BM25/Vector/RRF/Rerank 从「一排小数」
  改为 **compact score breakdown**（标签 + 细条 meter + 数值 + rank badge），无图饼/堆叠。
- **Gaps**：covered/partial/missing **不只靠颜色** —— 加图标 + 中文标签 + 计数；
  优先补充建议做成 actionable insight。
- **Evaluation**：指标卡改「Metric / Meaning / Status」三段式；状态分级**复用文件内既有的
  0.8 / 0.5 阈值**，未引入新算法。
- **Activity**：升级为 activity timeline（icon + 类型 + 时间 + 耗时）。
- **About**：内容未变，只重排视觉叙事层级。

---

## 5. Motion

- 统一三档时长 + 三档 easing，**禁止页面里写死毫秒**。
- 允许的动作：透明度、1–2px 位移、阴影、描边色、`scale ≤1.02`、按压 `0.985`。
- 新增 `.animate-reveal`（淡入 + 上移 4px），**每次结果只用一次**，不做列表 stagger。
- **Reduced motion 双层覆盖**：CSS 层（`globals.css`）把 `.animate-float` / `.animate-breathe` /
  `.animate-blink` / `.animate-pulse-ring` / `.shimmer` 直接置为 `none`；
  JS 层（本轮新增 `MotionProvider`）让 framer-motion 停止 transform/layout 动画但保留透明度。

---

## 6. Dark Mode

**独立调优，不是反色**：画布比 surface 更深（与浅色相反）、raised 面更冷更蓝、
AI 结果面是冷调品牌暗色而非更浅的灰、强调色整体提亮以免在暗底发闷。
Elevation 在暗色下靠黑色阴影 + 一丝品牌光，而非与白色的对比。

---

## 7. Mobile

- **首屏硬约束保持**：390 / 430 / 375 下三张核心入口仍完整可见（实测见 §9）。
- Hero 视觉提升全部来自光与深度，**未增加高度**。
- 手机 Hero 状态区本轮**才真正压到 38px**（V4.1 声称了但没落地，见 §11）。
- 抽屉保持 86vw 近全屏；引用为全屏 sheet；触控目标 ≥44px。
- 本轮新增的移动端问题与修复：见 §8 的 `.prose-copilot` 豁免。

---

## 8. Accessibility

本轮由独立审计角色（只读）执行了一次源码级审计，产出 **3 × P0 / 9 × P1 / 8 × P2**。
本报告只记录**已修**与**未修**，不含审计原文。

### 已修

| 项 | 问题 | 修法 |
| --- | --- | --- |
| P1-7 | `field.tsx` 的 `focus:outline-none` **吃掉全局 `:focus-visible` outline**（utilities 层压过 base 层），键盘用户只剩 7% 透明度的光晕作为焦点指示 | 移除该 utility，保留 border + halo 作为鼠标态，outline 留给键盘态 |
| P1-8 | `globals.css` 的 `:focus-visible { border-radius: 4px }` 会**把所有获焦元素压成 4px 圆角**（药丸、chip、圆角卡全部变形） | 删掉该行 |
| P1-9 | framer-motion **完全不看** `prefers-reduced-motion`（CSS 媒体查询管不到 JS 动画），mascot 的 `repeat: Infinity` 仍在转 | 新增 `MotionProvider`，在 root 挂 `MotionConfig reducedMotion="user"` |
| P1-3 | SegmentedControl 用 `tablist`/`tab` 但没有 tabpanel | 改为 `radiogroup`/`radio` + `aria-checked`（三处一起改，保持 ARIA 自洽） |
| P2-2 | 无 skip link，键盘用户要先 Tab 过整个侧栏 | 新增跳转链接 + `main#main` |
| **新发现** | 我在 V4.1 加的手机 44px 触控规则是**无层级 CSS**，优先级高于所有 `@layer utilities`，于是 `.prose-copilot` 里行内 `[n]` 引用按钮被撑到 44px，**把正文行高顶开** | 在 `globals.css` 内加 `.prose-copilot button / a[href] { min-height:0; min-width:0 }` 豁免（`min-h-0` utility 压不过无层级规则，只能在此处修） |

> 最后一条是**数字全绿但阅读体验被破坏**的典型：V4.1 的触控审计报「违规 0」，
> 因为那个规则确实让每个控件都 ≥44px —— 代价是答案正文被撑开。本轮由子代理发现。

### 未修（列入 backlog，见 §11）

**P0-1 / P0-3：Drawer 与 MobileNav 没有焦点陷阱、没有初始焦点、关闭后不归还焦点。**
这需要给两个组件加 `focus-trap` 行为，属结构性改动，本轮未做（见 §11 的说明）。

**P0-2：知识库上传区是 `div onClick` + 隐藏 input，键盘用户无法上传。**

**结构性问题：`eslint-plugin-jsx-a11y` 未启用**，所以上述问题**永远不会在 CI 里报警**。

---

## 9. Browser QA

### 9.1 ⚠️ 前一轮 QA 数据已作废（代理污染）

此前报告引用的 **110 行 / 32 失败组合 / 919 触控违规**，来自一次**被污染的采集**：

本机环境设置了 `http_proxy=http://127.0.0.1:35246`（WorkBuddy 沙箱代理），
**Chromium 会继承该变量且不会自动豁免回环地址**，于是访问 `127.0.0.1:3001` 的请求有时被送进代理并失败，
浏览器落到 Chrome 错误页。那 919 处「触控违规」的文本是 **「检查代理服务器和防火墙」** —— Chrome 错误页的链接。
同一轮的 `overflow=0 / console=0` 也因此**同属无意义**（错误页自然没有溢出）。

**修复**（三处一起改，缺一不可）：

1. Chromium 启动加 `--no-proxy-server` 与 `--proxy-bypass-list=<-loopback>`；
2. 启动环境清空 `http_proxy / https_proxy / HTTP_PROXY / HTTPS_PROXY / no_proxy`；
3. **服务启动、就绪验证、浏览器使用必须放在同一条命令内** —— 后台服务会随上一条命令的 shell 退出被回收。

另外：Phase 1 要求「HTTP 检测 + 真实页面 DOM 验证」。本机 `curl` 受代理影响**不可作为就绪判据**
（实测同一时刻 `curl` 返回 `000/502` 而页面实际正常），因此就绪判定改为**检查 `main` 存在且页面非错误页**。

### 9.2 有效结果（本轮）

**7 视口 × 10 页面 = 70 组合**，浅色。视口：1440×900 / 1280×800 / 1080×900 / 768×1024 / 430×932 / 390×844 / 375×812。

| 指标 | 结果 |
| --- | --- |
| 渲染到 Chrome 错误页 | **0 / 70** ✅ |
| 横向溢出 ≠ 0 | **0 / 70** ✅ |
| console error + page exception | **0 / 70** ✅ |
| 手机触控目标 <44px | **0** ✅（已排除错误页与 `.prose-copilot` 行内） |
| 内部链接 | 38 条唯一链接，**全部 200** ✅ |
| **失败组合** | **0 / 70** ✅ |

> 触控一项从「919」变成「0」不是放宽了判据，而是**把量错的对象改对了**：
> 同一套选择器与阈值，只在真实渲染的页面上执行。

### 9.3 各页高度（390×844，实测）

| 页面 | 高度 | 页面 | 高度 |
| --- | --- | --- | --- |
| 首页 | 1807 | 知识探索 | 3140 |
| 知识问答 | 984 | 知识洞察 | 1199 |
| AI 任务 | 940 | RAG 评测 | 1185 |
| 方案生成 | **844**（整一屏） | **运行记录** | **14130** ⚠️ |
| 知识库 | 3082 | 关于项目 | 3523 |

**运行记录 14,130 px** —— 见 §11 第 8 条。

## 10. Functional Regression

**状态：部分完成。** 视觉重构没有改动任何 API 调用、请求参数或业务判断
（`backend/` 0 修改、无接口变更），因此功能风险面很小；但本轮**只完成了三次真实调用**，
没有跑完整的后端回归。

| 链路 | 证据 | 结果 |
| --- | --- | --- |
| Ask | 截图运行中真实提问 → 等待「这次回答发生了什么」 | ✅ 回答渲染，引用可点开 |
| Agent | 真实运行 → 等待「刚刚发生了什么」 | ✅ 结果渲染（结果区截图 2880×8874） |
| Solution | 真实生成 → 等待「本次方案生成过程」 | ✅ 8 章节渲染（结果区截图 2880×7628） |
| 知识库 / 探索 / 洞察 / 评测 / 记录 / 关于 | 截图运行中均正常渲染截屏 | ✅ 渲染正常 |
| 后端测试套件 | **本轮未运行** | ❌ 未做 |
| Chrome console（交互期间） | 截图脚本在 crash 前未报出 console error | ⚠️ 不构成全量结论 |

> 说明：V4.1 发布时后端 `pytest` 为 171 passed。本轮前端改动未触及后端，
> 但**未重跑**，所以不写成"通过"。


---

## 11. Known Issues

| # | 问题 | 等级 | 说明 |
| --- | --- | --- | --- |
| 1 | **本轮未部署** | — | 任务书 §37 要求本地实现 + 本地验收，生产保持 V4.1 |
| 2 | **V4.1 报告有一处结论是假的，本轮修正** | 已修 | V4.1 报告称手机 Hero「压缩为 38px 单行状态区」。实际 `ac27d58` 里 `size={38}`/`lg:hidden` 计数为 **0**、`size={72}` 为 1 —— 当时的脚本**声明了 `OLD_ASIDE`/`NEW_ASIDE` 却没有执行替换**，而脚本末尾打印的 "hero aside split" 是我自己写的、并不反映实际行为，我信了那行 print。三入口首屏当时仍达标（靠 Compact Action Row 撑住），所以没有暴露。**本轮已真正实现并加断言。** |
| 3 | ~~Drawer / MobileNav 焦点陷阱未实现（P0）~~ | **已修** | 新增 `useFocusTrap`：打开移入焦点 → Tab 在面板内循环 → 关闭归还到原触发元素；Drawer 补 `aria-labelledby` 与 `tabIndex`。见 §8 |
| 4 | 上传区键盘不可达（P0） | P0（backlog） | 同上 |
| 5 | `eslint-plugin-jsx-a11y` 未启用 | P1（backlog） | 加了它会在现有代码里产生一批 warning，需要单独一轮清理；先记录 |
| 6 | `TRACE_STATUS_TONE.dot` 字段未被使用 | P2 | 既有字段，保留 |
| 7 | 手机 Hero 状态区与 V4.1 报告不一致的时间差 | 已说明 | V4.1（已发布）与 V4.2（本地）在此处的实际行为不同；V4.2 才是报告描述的样子 |
| 8 | **activity 页超长时会让浏览器渲染进程挂死** | P1 | SSR 健康（200 / 4.6ms），无死循环；成因是该页把全部台账记录渲染为纵向 timeline，页面达数万像素，整页捕获稳定超时。既是 QA 阻塞点，也是 §19「不要后台日志感」的真实痛点。未见分页/虚拟化 |
| 9 | 后端测试套件本轮未重跑 | 未做 | V4.1 时为 171 passed；本轮前端改动未触及后端，但没有重跑就不写成通过 |
| 10 | ~~手机触控目标 32 处 <44px~~ **已作废** | — | 那是被代理污染的错误页采集结果。修复后实测 **0 / 70**。见 §9.1 |
| 11 | **Chromium 走系统代理导致采集落到错误页** | 已修 | `http_proxy` 被 Chromium 继承且不豁免回环；三处修复见 §9.1。**这类污染不会报错，只会安静地量错东西** |
| 12 | 上传区键盘不可达（P0） | 未修 | 仍是 `div onClick` + 隐藏 input |
| 13 | 暗色截图 / 手机截图 / 两轮视觉批判未完成 | 未做 | 见 §14 |

---

## 12. 分项 Verdict

§36 要求逐维度给结论，而不是只写 "Tests PASS"。

| 维度 | 结论 | 依据 |
| --- | --- | --- |
| **FUNCTIONAL QUALITY** | **PASS（有条件）** | `backend/` 0 修改、无接口变更；tsc 0 / lint 0 / 生产构建成功；Ask / Agent / Solution 三次真实调用全部成功。**但后端测试套件本轮未重跑**，故称"有条件"。 |
| **VISUAL QUALITY** | **PASS（有条件）** | Design Tokens V2 落地（六层 surface + 四级 elevation + 显式 motion 体系）；白卡墙的机械成因（surface 与 raised 同为 `#ffffff`）已消除；Hero 五层结构、按钮六态、表单五态、Timeline、Document Surface 均已实现并截图留证。**但 §30 要求的两轮 Screenshot Critique 本轮一轮都没做完**，视觉结论缺少独立批判环节。 |
| **MOBILE QUALITY** | **FAIL（唯一硬失败项）** | 首屏三入口约束保持、行内控件 44px 冲突已豁免、横向溢出 0、console 0；**但 390 下 activity 与 about 各有 23 处触控目标 <44px，§33 的 `touch <44px = 0` 未达成**，且手机截图批次未产出。 |
| **DARK MODE QUALITY** | ~~未验证~~ **（历史结果，已被 §22 取代）** | token 层做了独立调优（画布比 surface 更深、结果面为冷调品牌暗色、强调色提亮、elevation 改用黑色阴影 + 品牌微光），**但暗色截图一张都没拍出来**。没有证据，不给 PASS。 |
| **ACCESSIBILITY** | **PASS（有条件）** | 独立审计产出 3×P0 / 9×P1 / 8×P2；本轮修掉 **6 项**（含两项由我本轮亲手引入的缺陷：`field.tsx` 的 `outline-none` 吃掉全局焦点环、`:focus-visible` 强改圆角；以及 V4.1 遗留的触控规则与行内正文冲突）。**2 个 P0（Drawer / MobileNav 焦点陷阱、上传区键盘不可达）未修**，且 `eslint-plugin-jsx-a11y` 未启用，这类问题不会在 CI 报警。 |
| **PERFORMANCE** | **PASS** | 未新增任何依赖；动效全部为 CSS 或复用既有 framer-motion；指针光晕 `rAF` 节流、7% 上限、`pointer-events-none`，且在 `prefers-reduced-motion` 与触屏上不挂载监听；噪点为内联 SVG（无网络请求）；构建产物体积未增加依赖。未做量化 benchmark。 |

---

## 13. 最终 Gate

# NOT READY

**不是因为做了什么坏事，而是因为验收证据不完整。**

任务书 §36 规定只有 `READY FOR PRODUCT REVIEW` 与 `NOT READY` 两个结论。按当前证据：

**已具备** —— 设计系统与实现完成、编译与构建通过、三次真实 AI 调用成功、16 张浅色桌面截图落盘、
六项无障碍修复落地（含两项本轮自查发现的自身缺陷）。

**不具备** ——
1. §30 要求的 **≥2 轮 Screenshot Critique 一轮未完成**（这是本轮被定义为"重点"的环节）；
2. §9 的 Browser QA **已取得结果**：overflow 0 / console 0 / 断链 0 全部达标，**唯一未达标项是手机触控目标 32 处**（activity 与 about @390）；
3. **暗色与手机截图批次未产出**，Dark Mode 结论**只能给"未验证"**；
4. 两个 **P0 无障碍缺陷未修**；
5. 后端测试套件本轮未重跑。

把上面任何一条包装成 PASS，都会重演 V4.1 那次「拿旧结论当新证据」的错误。所以结论是 **NOT READY**，
并且我把每一条的**恢复入口**写在下面。

---

## 14. 恢复入口（下一轮从哪继续）

| 待办 | 具体入口 |
| --- | --- |
| 1. 跑完 Browser QA | `C:/agents/temp/v42_qa.mjs`（服务已在 3001/8000，脚本可直接重跑；建议把 activity 页从全页捕获改为仅测量） |
| 2. 补暗色 + 手机截图 | `C:/agents/temp/v42_shots.mjs`（已把 activity 改为视口截图；直接重跑该脚本即可产出 `desktop-dark/` 与 `mobile/`） |
| 3. 两轮视觉批判 | 截图齐了之后，按 §30 的 8 个问题逐张批；`visual-workspace` 已待命 |
| 4. P0 无障碍 | Drawer / MobileNav 加焦点陷阱 + 初始焦点 + 归还焦点；上传区改为真实 `button` 或补键盘处理 |
| 5. 后端回归 | `cd backend && ../.venv/Scripts/python.exe -m pytest -q` |
| 6. 可选 | 启用 `eslint-plugin-jsx-a11y` 并单独一轮清理 |

---

## 15. 本轮交付的截图（已落盘部分）

`docs/images/v4.2/desktop-light/`（**已作废** —— 见 §16.3，其中 9 张无效）：

```
01-home  02-ask-idle  03-ask-result  04-citation-drawer  05-agent-idle
06-agent-running  07-agent-result  08-solution-idle  09-solution-running
10-solution-result  11-documents  12-document-drawer  13-explorer
14-gaps  15-evaluation              (16-activity 视口版 + 17-about 待补)
```

`desktop-dark/` 与 `mobile/` 目录已建，内容待补。

---

*本报告只记录实测结果。未做的验证不写成已通过；已知问题写在 §11，不隐藏。*

## 16. 最终收口记录（2026-10-08）

### 16.1 Activity 长列表：已修，有实测数字

默认渲染最近 20 条 + 「加载更多」，保留原数据/排序/筛选，**未改后端 API**。

| 视口 | 修改前 | 修改后 | 变化 |
| --- | --- | --- | --- |
| 390×844 | 14,235 px | **3,248 px** | **−77.2%** |
| 1440×900 | 12,075 px | **2,534 px** | **−79.0%** |

三个概念分开验证（任务书要求）：**DOM 长度**下降是上表实测；**滚动性能**因 DOM 变短而改善；
**截图超时**只是前两者的结果 —— 不拿"截图不超时"当性能证据。

### 16.2 上传入口键盘可达：已修

知识库上传区由 `<div onClick>` + 隐藏 input 改为**原生 `<label htmlFor>` + 可聚焦 input**，
Enter/Space 均可触发。**只读权限未被绕过**：`disabled={readOnly}` 原样保留在 input 与所有操作按钮上。

### 16.3 ⚠️ 此前报告的「15 张浅色截图」大部分无效

独立核查（md5 + 图像内容）结论：

| 类别 | 数量 | 说明 |
| --- | --- | --- |
| **md5 完全相同的 Chrome 错误页** | 8 | 同一张错误页被重复保存为不同文件名 |
| **「后端未启动」错误横幅** | 2 | 不是结果态（`03-ask-result` / `04-citation-drawer`）；**后端从未启动过，所以"真实结果态"从未被截到** |
| 真实产品页面 | 5 | 仅这几张可作为视觉证据 |

**因此 §13「本轮交付的截图」与 §9 中任何基于截图集的描述都不成立**，已在本节更正。
这正是本轮最有价值的发现之一：**截图存在 ≠ 截图有效**。

### 16.4 ⚠️ 新的 P1 产品问题：后端抖动会导致整站白屏

`app-shell.tsx` 把 `api.authStatus()` 当作**渲染门禁**：只要该请求失败，
整个应用只渲染一个 ErrorState，**每一页都不存在 `<main>`**。

实测（后端停止时）：`document.querySelector('main') === null`、`body.innerText.length === 9`、console 出现 500。

后果不只是"看不到页面"：
- 公开 Demo 在后端重启/抖动期间会**完全白屏**，而正确行为应是降级为带提示的可读页面；
- 任何自动化（视觉回归、截图、QA）都会把这种状态误判为"页面未渲染"，**掩盖真实原因**。

本轮未修（属渲染门禁的行为改动，超出"视觉/交互"边界），记为 backlog，建议单独一轮处理。

### 16.5 采集可行性的硬约束（已定位）

后台服务会**随启动它的命令的 shell 退出而被回收**，因此：
- 启动服务、就绪验证、浏览器采集 **必须在同一条命令内**完成；
- 就绪判定必须用 **DOM**（`main` 存在且非 Chrome 错误页），**不能用 curl**
  —— 本机 `http_proxy` 会污染 curl 与 Chromium，两者都不可作为判据。

`cdp.mjs` 已加 `--no-proxy-server` + `--proxy-bypass-list=<-loopback>` + 代理环境变量清空。

### 16.6 两轮视觉评审状态

| 轮次 | 状态 |
| --- | --- |
| 第 1 轮（独立 Agent 逐图批判 + 修复） | **进行中**（需先完成有效截图采集） |
| 第 2 轮（另一个未改代码的 Agent 做 Before/After 独立比较） | **未开始** |

**按任务书要求，本轮不得由改代码的 Agent 单独充当最终评委**，因此第 2 轮会指派一个
未参与任何代码修改的 Agent；在第 2 轮完成前，Visual Quality 不能给 PASS。

---

---

## 17. 第二轮独立视觉评审（最终评委）

评审者**与本项目所有代码修改无关**，自建采集器重拍 **53 张**（生产构建 `next build` + `next start`，
非 dev），存于 `docs/images/v4.2-round2/`。原始数据：`C:/agents/temp/v42r2_report.json`。

### 17.1 两轮拍摄是否一致

静态页**逐一张尺寸完全一致**（home 2880×2256、documents 2880×4650、explorer 2880×3108、
gaps 2880×1958、evaluation 2880×1896、activity 2880×5098、about 2880×4314；dark 全 10 页一致；
mobile 重叠项一致）→ **采集可复现**。唯一差异是 LLM 结果页高度（模型输出长度天然不同），
**不是采集不稳定**。

> 评审者另指出一处我的错误：我让它用作旗舰对比基线的 `docs/images/v4.1/01-home.png`
> 实际是 **390px 手机截图**（780×3708），不是桌面基线。它改用 `02-home-detail-collapsed.png`
> 与 `v4.1/mobile/` 双基线，并在结论里标注 —— **是我给错了参照物**。

### 17.2 七维度结论

| 维度 | 判定 | 依据 |
| --- | --- | --- |
| Hero 旗舰质感 | **FAIL** | 比 V4.1 **有提升，但只是一档微调，不是"档位式"跃迁**。白色卡落在近白画布（相差约 4%）→ 玻璃与辉光几乎不可见；吉祥物是一枚通用圆脸机器人，是全页最廉价处 |
| 白卡墙消失 | PASS（勉强） | 面层级色阶确实建立（canvas `#f4f4f7` / surface `#ffffff` / subtle `#fafafb` / sunken `#ececf1` / inset `#f5f5f8`）；"靠边框堆白卡"的病治了。但 Home 之下仍是卡片矩阵，**密度问题仍在** |
| 结果阅读区文档质感 | **PASS（本轮最强项）** | Agent 缺口报告是真表格（类型/判定依据/证据文档）；Solution 是编号式交付物 + 导出；**Citation 抽屉（46rem）品质明显高于项目其他任何一屏** |
| 暗色是否真正设计过 | PASS **（历史结果；§22 发现暗色主 CTA 对比度 2.66:1 不达标）** | 分层暗色调色板而非反色：canvas `#08080b` < surface `#111116` < raised `#16161c`；辉光 alpha 单独调过；explorer 三栏 / about 分区在暗色成立 |
| 手机是否精修 | PASS | off-canvas 抽屉 + 双语标签、表单纵堆、执行引擎整宽分段控件、activity 统计 2×2；**不是桌面压窄** |
| AI 模板感 | **FAIL（残留）** | 「Hero → 3 功能卡 → 3 步上手 → 流程条 → chip 行」是 AI 落地页的模板骨架；执行合格，但骨架一眼可辨 |
| 视觉重点 | PASS（有保留） | 全页只有一个实心主色块；保留意见：Home 吉祥物无功能却抢注意力，层级主要靠字号而非"面" |

### 17.3 Before/After 关键结论

| 项 | 结论 |
| --- | --- |
| Hero 深度 | 提升，但**只是一档**（"干净"→"干净且有光"），未到旗舰 |
| 卡片体系 | **真提升**，"靠边框堆卡"消失 |
| Ask / Agent / Solution 结果 | **明显提升**，从"长文本"变"交付物" |
| 暗色 | 新增且合格（V4.1 无暗色基线，只能评自身） |
| 手机端 | 提升（"能用"→"精修"） |
| **Agent / Solution 空态** | **几乎没变** —— "多页面视觉升级"是**不均匀的**：Home 与 token 层动了，多个内页基本是 V4.1 原样 |

### 17.4 实测数字（组合数与元素数严格分开）

**QA 矩阵 = 7 视口 × 10 页 × 浅/暗 = 140 组合**

| 指标 | 结果 |
| --- | --- |
| 组合总数 | **140** |
| **失败组合数** | **0** |
| 渲染到 Chrome 错误页 | **0** |
| 未真实渲染（无 `main`） | **0** |
| 横向溢出组合数 | **0** |
| console error 数 | **0** |
| 内部链接非 200 | **0**（38 条全 200） |

**触控违规（元素数，非组合数）**：`<24×24` 出现 **272 次 / 去重 34 个**；
其中 375/390/430 三档合计 **0**，全部来自 **768×1024**；那 34 个**全是行内文本级链接**
（文档名链接高 16px、`全部` 22×17、`去提问` 33×17 等），属 WCAG 2.5.8 内联豁免。
`<44×44` 出现 2312 次 / 去重 141 个（桌面 `size="sm"` 32px、图标按钮 32–36px —— 鼠标场景预期）。

**唯一真正的小控件**：Ask 结果页行内引用 chip `[n]` 实测 **16×18 px**（7 个）。
项目在 `globals.css` 有带 WCAG 依据的豁免声明 —— 不判失败，但**如实披露：手机上点 `[n]` 的命中区只有 16×18**。

**⚠️ 口径缺口**：44px 底线写在 `@media (max-width: 639px)`，**640–767px 不生效**，
而 **768×1024 是 iPad 竖屏、是触控设备** —— 那里仍有 34 个 <24px 链接。

### 17.5 键盘 / 焦点实测（真实 CDP 键事件，390）

| 场景 | 焦点移入 | Tab 困住 | Escape 关闭 | 焦点归还 |
| --- | --- | --- | --- | --- |
| 导航抽屉 | ✅ | ✅ | ✅ | ✅ |
| **Citation 抽屉** | ✅ | ✅ | ✅ | ❌ **落到 `<body>`** |

### 17.6 ⚠️ 我 12:19 的修复是失败的（两个独立复现确认）

**事实**：我按"记住被点击的节点"思路改了 `components/ui/use-focus-trap.ts`
（新增 capture 阶段 `click` 监听 + `document.contains()` 守卫 + 兜底）。

**结果：无效。** `visual-round2` 在两个不同的最新构建上复验，焦点**仍然落到 `<body>`**。

**真正的根因（由两个 Agent 独立定位，比我的更根本）**：
`components/rag/markdown.tsx` **每次渲染都内联新建 react-markdown 的 `components` 映射** →
元素类型身份改变 → React 对整棵引用子树 **unmount + mount** → 所有 `[n]` chip 被换成新节点。
**"记住节点"这条思路物理上不成立** —— `previous` 与我兜底用的 `lastInteracted` 指向同一个已销毁节点，
`document.contains()` 守卫把两者**一起拒掉**，于是不调用 `focus()`，焦点落 body。

**正确的修法**（已定位、未执行）：把该映射 `useMemo(() => ({ ... }), [])` 稳定化，
用 `ref` 持有最新 `onCitation`，从而**消除 remount**；`use-focus-trap` 的逻辑本身无需改。
`decorate()` 的解析逻辑与引用语义不动。

**为什么本轮没做**：收口阶段我的团队上下文已结束，无法派发；而我**拒绝在没有验证的情况下**
再改共享组件 —— 本轮已经因为"评审窗口内改代码"污染过一次证据，重复同样的错误不可接受。

### 17.7 流程教训（必须记）

评审期间我改了源码并重建，导致**评审证据与构建对不上**（两个 Agent 都独立指出）。
纪律：**一旦开始评审，冻结被评审的构建**；要改就等评审结束、改完重新完整评审。

---

## 18. 最终 Gate（第二轮后）

# NOT READY

失败项与依据：

| # | 项 | 等级 | 证据 |
| --- | --- | --- | --- |
| 1 | **Citation 抽屉关闭后焦点不归还触发元素** | **P0** | §17.5 实测；我的修复经两次独立复现确认无效（§17.6） |
| 2 | **Hero 未达旗舰标准** | P1 | §17.2；第二轮评委明确表示"修不了这条，这一版挂不了旗舰视觉的名头" |
| 3 | **AI 模板骨架残留** | P1 | §17.2；三张同构入口卡 + 3 步卡组 + 流程条 + chip 行 |
| 4 | 触控 44px 底线不覆盖 640–767px | P2 | §17.4；768 iPad 竖屏仍有 34 个 <24px |
| 5 | Agent / Solution 空态几乎未变 | P2 | §17.3；"多页面升级"不均匀 |
| 6 | `app-shell` 鉴权门禁 → 后端抖动即整站白屏 | P1 | §16.4 |

**通过的部分（有证据）**：QA 矩阵 **140 组合 0 失败**、0 溢出、0 console error、0 断链、
0 错误页；暗色 / 手机 / 结果阅读区三个维度独立判为 PASS。

**为什么不给"有条件 READY"**：任务书写明「直到所有 P0 关闭、两轮视觉评审完成并具备完整回归证据，
才能给出 READY」。**P0 未关闭**，且第二位评委明确表示旗舰标准未达。
把这两条包装成"基本达标"就是重复 V4.1 那次「拿旧结论当新证据」的错误。

> 注：§9–§16 中凡与本节冲突的表述，以本节为准（前面的 QA 数字来自浅色单轮 70 组合，
> 本节 140 组合为双主题完整轮，两者不矛盾：前者是后者的子集）。

## 19. 最终精修（V4.2 Precision Patch）

### 19.1 ⚠️（历史结果 · 已被 §21.4 取代）Phase-2 冻结构建标识

> **本节已作废。** 它是 **Phase 2 结束、Phase 3 精修之前**的构建身份。Phase 3 改了
> `hero-panel.tsx` 与 `globals.css`（§19.4 / §20.2），随后重建，产生了**新的 BUILD_ID 与新 md5**。
> **当前被评审版本以下方 §21.4 为准**；本表仅作历史留痕（其中 BUILD_ID 与两个 md5 均已过期）。

| 项 | 值（历史） |
| --- | --- |
| Git SHA | `ac27d58f73f7eb138c7be6883590767d731f8506` |
| BUILD_ID | `-7qwbDOMQaVnmas2PZCDj`（**历史**，Phase-2 构建） |
| `components/ui/use-focus-trap.ts` | md5 `280756b6c4e7ebf3608639626efb34a3` |
| `components/rag/markdown.tsx` | md5 `81d776e246742268e700cfb73e1295bb` |
| `components/ui/hero-panel.tsx` | md5 `9e0fd0eeb1066b034ec87fb15e90490e`（**历史**） |
| `app/globals.css` | md5 `7ef6d7be1369e9dc474f51464783cab5`（**历史**） |

> 上一轮的教训：我在评审窗口内改了源码并重建，导致评审证据与构建对不上。
> **本次先冻结、后评审**，上表即为被评审的确切版本。

### 19.2 Phase 1 — Citation 焦点 P0：已关闭

**根因**（上一轮由两个独立 Agent 定位，我据此修复）：
`components/rag/markdown.tsx` **每次渲染都内联新建 react-markdown 的 `components` 映射**（7 个箭头函数）。
元素类型身份每帧都变 → React 把整棵被 `decorate` 的子树 **unmount + mount** → 所有 `[n]` chip 被销毁重建
→ 关闭抽屉时无法把焦点还给被点击的 chip。

**为什么我上一轮的"记住节点"兜底无效**：节点已被销毁，`previous` 与兜底用的 `lastInteracted`
指向同一个死节点，`document.contains()` 守卫把两者一起拒掉 —— **那条思路物理上不成立，我承认修错了方向。**

**修法**（`markdown.tsx`）：
1. `components` 用 `useMemo` 稳定身份，React 不再 remount；
2. 用 `ref` 持有最新 `onCitation`，memo 依赖里只放 `hasHandler` 布尔 —— **映射稳定且无闭包过期**；
3. `decorate()` 的解析逻辑、引用编号语义、视觉**一律未改**。

**验证（真实鼠标事件，非合成事件）**

| 检查 | 结果 |
| --- | --- |
| ① 点正文 `[n]` → 抽屉打开 | ✅ |
| ② 焦点正确进入面板 | ✅ `inside: true` |
| ③ Tab / Shift+Tab 被困在面板内 | ✅ `wrappedForward` / `wrappedBack` 均为 true |
| ④ Escape 关闭后焦点归还**该** chip | ✅ 引用 #0 → 回到 chip 0；#3 → chip 3 |
| ⑤ 点关闭按钮同样归还 | ✅ 引用 #1 → 回到 chip 1 |
| ⑥ 连续打开不同引用各自正确归还 | ✅（#0 / #3 / #1 各归各位） |
| ⑦ **引用 DOM 节点无预期卸载** | ✅ `beforeCount 9 / stillInDom 9 / identicalNodes 9` |

> 第 ⑦ 条才是这次修复的直接证据：**chip 节点在抽屉打开后全部存活且是同一批节点**。
> 第 ④⑤⑥ 条是它的行为结果。

**过程中我修正了自己的一次测量错误**：第一次复验我用 `dispatchEvent(new MouseEvent('click'))`，
**合成事件不会让元素获得焦点**，所以 `previous` 一开始就不是 chip，得出"未归还"的假结论。
改用真实 `Input.dispatchMouseEvent`（press + release）后结论成立。**测焦点的测试本身必须用真实焦点路径。**

### 19.3 Phase 2 — 触控按能力判定，不按视口宽度

**原来的问题**：44px 底线写死在 `@media (max-width: 639px)`，
于是 **768×1024 的 iPad 竖屏（触控设备）被完全漏掉**，那里实测有 **34 个 <24px 的目标**。

**改为**：`@media (max-width: 639px), (pointer: coarse)`，并补上 `[role="radio"]`、`[role="button"]`。

- 用 `pointer`（**主指针**）而非 `any-pointer`：带触摸屏但以鼠标为主的笔记本仍报 `pointer: fine`，
  **桌面布局不被改动**；而平板/手机的主指针是手指 → 命中区放大。
- 保留 `max-width: 639px`：手写笔优先的手机可能报 `pointer: fine`，但仍是拇指操作。
- **不扩大行内引用 chip**：`.prose-copilot` 内的 `button` / `a[href]` 继续豁免（WCAG 2.5.8 内联例外），
  避免撑高正文行高（V4.1 踩过这个坑）。

**实测**

| 尺寸 | `<24px` | `<44px` |
| --- | --- | --- |
| **768×1024（iPad 竖屏）** | **0**（原 34） | 1 |
| 390×844 | 0 | 0 |
| 1440×900 | 0 | 1（桌面鼠标场景，WCAG 2.5.8 合规，无需放大） |

### 19.4 Phase 3 — Hero 旗舰精修

独立评审上一轮判定：面板 `#ffffff` 落在画布 `#f4f4f7` 上（相差约 4%），**玻璃与辉光几乎不可见**，
整体是"干净"而不是"有光"。本轮按材质做三处改动（**全部不涉及尺寸**）：

1. **环境光**：单瓣改为**双层重叠**（品牌紫 + 冷青反向瓣），衰减更长、`blur` 从 18px 提到 26px，
   并**溢出到画布上** —— 让边缘是"光的边界"而不是"边框"。
2. **玻璃自身带渐变**：由一层平的半透明白改为**上密下透的纵向渐变**（0.82 → 0.62 → 0.70），
   这是让表面读起来像**材质**而不是像浮层的关键；`saturate` 提到 1.35。
3. **顶部受光边 + 底部柔光倒角**：原来只有一条上边高光，现在上下都有，面板有了厚度感。

指针光晕从 7% 提到 8%、半径 420→440px，仍为 `rAF` 节流且在 `prefers-reduced-motion` 与触屏下**不挂载**。

**手机首屏硬约束**：尺寸未变，390×844 下三个核心入口仍完整可见（由独立评委复核，见 §20）。

### 19.5 Phase 4 — 首页去模板化：部分处理

上一轮评审已把材质分层做掉：入口卡改 `surface-raised` + `elevation-2`，`QuickStart` / `HowItWorks`
下沉到 `surface-subtle`，内部 chip 改 `surface` + `line-faint` —— 即任务书允许的"轻量调整视觉编排与卡片材质"。

**未做**（如实记录）：评审指出的"Hero → 3 卡 → 3 步 → 流程条 → chip 行"这套骨架本身**结构未变**。
根治需要删除或合并信息块，属信息架构改动，超出本轮"不重新设计全站"的边界，列为 backlog。

### 19.6 AppShell 错误态（评审要求给建议）

**问题**：`app-shell.tsx` 把 `api.authStatus()` 当作**渲染门禁**，后端一旦不可达，
整个应用只渲染一个 ErrorState，**每一页都不存在 `<main>`**（实测 `main=null`、`innerText.length=9`）。
公开 Demo 会在后端抖动/重启期间**整站白屏**，同时让所有自动化把这种状态误判为"页面未渲染"。

**建议（本轮未实施，明令不得通过放松鉴权修复）**：
1. `authStatus` 失败时**保留应用外壳**：仍然渲染顶栏/侧栏与页面容器，只在内容区放
   降级提示（"服务暂时不可用，正在重试"）+ 重试按钮；
2. **区分"未授权"与"连不上"**：前者维持现在的门禁行为（这是安全语义，不能放松），
   后者只降级不阻断 —— 两者当前被同一个 `error` 分支合并处理，这才是缺陷所在；
3. 加一层轻量重试（已有 `useAsync` 的重试能力可复用），避免瞬时抖动直接白屏。

这是**容错与语义区分**的改动，不是权限放宽；建议单独一轮做，并配套测试"后端挂掉时页面仍可读"。

---

## 20. Phase 3 的两个自我回归（独立评委抓到，已修）

这一轮我在 Hero 精修里**自己引入了两个回归**，都不是我自己的测试发现的 —— **两次都是独立评委用测量抓出来的**。
如实记录，因为它们比"Hero 变好看了"更重要。

### 20.1 横向溢出回归（已修，已自测）

**我引入的**：环境光层的水平外扩从 `-inset-x-2`（8px）改成 `-inset-x-6`（24px），
**超过 `main` 的横向 padding（16px）**，而该层是 `<section overflow-hidden>` 的**兄弟节点**、不被裁剪。

**后果**：首页在 375/390/430 各溢出 **8px**、768/1080 各 **4px**，140 组合里 **10 个失败**。
精修把旗舰页修出了横向滚动条。

**修法**：`hero-panel.tsx` 最外层加 `overflow-x-clip`（**不是** `overflow-hidden` —— `clip` 不创建滚动容器，
纵向环境光与 sticky 后代都不受影响，只裁横向）。

**自测**：home × 浅/暗 × 8 尺寸 = **16 组合全部 `overflow=0`**（改前 10/140 失败）。
**独立复验**：judge2 在全矩阵上确认 **140 组合溢出失败数 = 0**，原 10 个失败**全部消失** ✅

### 20.2 暗色 Hero 对比度回归（已修，**仅自测**）

**我引入的**：为让玻璃"有材质"，我把面板背景写成**硬编码白色渐变**
`rgb(255 255 255 / 0.82 → 0.62 → 0.70)`。它**不随主题变化**，但文字色走 `--color-ink`
（暗色下翻转为近白 `rgb(242,242,245)`）→ **白字压浅灰板**。
V4.1 用的是 `var(--color-glass)`，暗色下有正确的深色值 —— **是我改坏的**。

**后果（judge2 像素实测）**：暗色 **H1 对比度 1.74:1**、副标题约 2:1。
AA 正文要求 4.5:1、大字 3:1 —— **远不达标，副标题几乎不可读**。

**修法**：玻璃填充改为**主题令牌**（新增 `--color-glass-from/-via/-to`，浅深各一套），
暗色为 `rgb(24 24 34 / 0.86) → rgb(16 16 24 / 0.74) → rgb(20 20 30 / 0.80)`；
顶部受光边从 `255/0.9` 降到 `255/0.55`（暗色下不再过亮）。

**自测（像素实测）**：暗色 H1 计算色 `rgb(242,242,245)` vs 面板实测底色 `(28,28,62)`
→ **对比度 14.63:1**（此前 1.74:1）。

> **这一条只有我的自测，没有独立复验** —— 见 §21。

### 20.3 为什么这两个回归值得单独写

本项目到目前为止，**我的自我评估已经错了五次**：

| # | 我的自述 | 实际 | 谁发现的 |
| --- | --- | --- | --- |
| 1 | V4.1 报告：手机 Hero 已压到 38px | 代码里 `size={38}` 计数为 0，从未落盘 | 用户 |
| 2 | V4.1 报告：首屏三入口可见 | 探针取到 `display:none` 的 0×0 元素 | 用户 |
| 3 | V4.2 报告：919 处触控违规 | 全是 Chrome 错误页上的元素 | 我自己复算原始 JSON |
| 4 | V4.2 报告：交互期间 console 归零 | 只覆盖了 Agent 路径 | 我自己补测 |
| 5 | Phase 3：Hero 精修完成 | **引入溢出 + 暗色对比度两个回归** | **两位独立评委** |

结论很清楚：**在这个项目上，我的自测不足以作为放行依据。** 这不是自谦，是有记录的事实。

---

## 21. 最终 Gate

### 21.1 逐维度判定

| 维度 | 判定 | 依据 |
| --- | --- | --- |
| **Functional Quality** | **PASS** | tsc 0 / lint 0 / `next build` 成功；Ask / Agent / Solution 真实调用正常；`backend/` 0 修改 |
| **Visual Quality** | **PASS** | 浅色 Hero 独立判 PASS（H1 对比度 16.66:1，玻璃可感知、环境光克制）；结果阅读区、暗色分层、手机精修此前均已独立判 PASS |
| **Mobile Quality** | **PASS** | 390 首屏三入口 bottom **574 / 642 / 710 ≤ 844**（独立复验）；触控 `<24px` = 0（390 与 768） |
| **Dark Mode Quality** | ~~FAIL（已独立复验，见 §22）~~ → **PASS（accent-solid 补丁后复验，见 §23）** | 历史 FAIL：主 CTA「立即提问」= 白字压在 `--color-accent`（暗色 `#8b95ff`）上，实测仅 2.63–2.68:1。**该 token 级问题已由 `--color-accent-solid` 修复，§23 独立像素复验为 6.05–6.18:1（含 hover 5.35–5.44）**。H1 / 眉标 / 副标题 / 描边 CTA / 状态胶囊全程达标 |
| **Accessibility** | **PASS** | Citation 焦点 P0 五项独立复验全过 + `sameNode` 全等；Drawer/MobileNav 焦点陷阱；skip link；焦点环修复；`.prose-copilot` 行内豁免 |
| **Performance** | **PASS** | 无新增依赖；`markdown.tsx` 的 `useMemo` **顺带消除了"每次重渲染 remount 全部段落"的浪费**；指针光晕 rAF 节流 |

### 21.2 结论

> ⚠️ **历史结果（2026-10-08，早于 `--color-accent-solid` 补丁）。**
> 本节的 `NOT READY` 只对其陈述的当时构建成立。其中**唯一阻塞项「暗色主 CTA 对比度」已在 §23 修复并经独立像素复验为 PASS（6.05–6.18:1）**。
> 本节其余结论（H1/副标题/溢出/三入口/焦点/后端）在 §23 已用**新构建**重测，仍然成立。**当前状态以 §23 为准。**

# NOT READY（历史）

**唯一原因**：**暗色主 CTA 对比度不达标。**

原先这一条是"没有独立复验"，本轮已由**未参与任何代码修改的独立评审者**完成复验（§22）——
结果**不是**"全过"，而是抓出一个真实缺陷：暗色下主 CTA「立即提问」白字压在浅紫（`#8b95ff`）上，
像素实测 **2.63–2.68:1**，低于 AA 普通文本 4.5:1。H1（14.93–16.35:1）与副标题（6.79–7.15:1）等其余项均通过。

**这次修复本身是成功的**（H1 从 1.74:1 → 14.9:1，玻璃不再被硬编码），
但"暗色玻璃填充"这一个病灶修好，**不代表暗色整体达标** —— CTA 按钮走的是另一条 token（`--color-accent`），
它在暗色被提亮后与 `text-white` 的组合不再达标。**这正是"只自测 H1"会漏掉的东西。**

因此本轮结论仍是 **NOT READY**：把 2.66:1 写成 PASS 会重演 V4.1「拿旧结论当新证据」的错误。

### 21.3 距离 READY 只剩一步（已更新）

| 待办 | 具体做法 |
| --- | --- |
| **修暗色主 CTA 对比度** | 二选一：① 主按钮文字改用 `--color-accent-ink` 系（暗色下 `#c9cfff` 之类的深底浅字）或保持白字但**把按钮底色改为更深的品牌色**；② 新增一个"实心按钮底色"token（浅=`#4f46e5` / 暗≈`#4f46e5` 或更深），不要用被提亮过的 `--color-accent`。目标：白字/深字与底色 ≥4.5:1 |
| **同步检查品牌标** | `sidebar.tsx` 品牌块同为 `bg-[var(--color-accent)] text-white`，需一并处理 |
| **改完重建后重新独立复验** | 复验范围：暗色 CTA + H1 + 副标题（§22 方法可直接复用），并重跑溢出 12 组合与焦点 3 项 |

**其余已具备**：构建身份一致（§22.1）、横向溢出 12/12=0、手机三入口 bottom 574/642/710、Citation 焦点 3/3、后端 pytest 171 passed（§22.4）。

### 21.4 冻结构建（被评审版本）

| 项 | 值 |
| --- | --- |
| Git SHA | `ac27d58f73f7eb138c7be6883590767d731f8506`（**仅提交基线**，V4.2 大量改动未提交） |
| BUILD_ID | `qLjhRHbk5xXetbyhTrEBK` |
| `markdown.tsx` | md5 `81d776e246742268e700cfb73e1295bb` |
| `hero-panel.tsx` | md5 `e642352ad96e9fa45237e2d12d363078` |
| `globals.css` | md5 `d0ceb7765d835ec878350ee4e94f0f99` |

> ⚠️ **BUILD_ID 不是稳定身份**：Next.js 每次 `next build` 都会**随机重新生成** BUILD_ID。
> 独立复验者用**完全相同的源码**重建，BUILD_ID 由 `qLjh…` 变成了 `-cZb3EicpbxhorTSMI5Lw`，
> 而三个 md5 一字未变。因此 **BUILD_ID 只能标识"某一次构建产物"，不能跨构建比对；真正的身份是源码 md5。**
> 详见 §22.1。

---

## 22. 独立复验（verify-final，未参与任何代码修改）

> ⚠️ **历史结果：针对 accent-solid 补丁之前的构建（`globals.css` md5 `d0ceb776…`）。**
> 本节 §22.2 的**失败项（主 CTA 2.63–2.68:1）已被 §23 修复并复验为 PASS**；§22.5 的 `NOT READY` 随之失效。
> 本节其余项（H1/副标题/描边 CTA/眉标/胶囊、浅色无硬编码残留、溢出 12/12、手机三入口、Citation 焦点 3/3、后端 pytest 171）在 §23 已用**新构建重测**，结论不变。

> 复验者**没有改过一行代码**。评审期间源码冻结：三个关键文件 md5 与 §21.4 **逐字一致**（见 22.1）。
> 方法：**真实生产构建** + `next start` + 真实 Chromium（CDP，`--no-proxy-server`，DOM 就绪判定）。
> 服务与采集在**同一条命令内**完成。原始数据：`C:/agents/temp/verify/`。

### 22.1 构建身份核对

| 项 | 报告（§21.4） | 实测（复验前磁盘值） | 一致 |
| --- | --- | --- | --- |
| BUILD_ID | `qLjhRHbk5xXetbyhTrEBK` | `qLjhRHbk5xXetbyhTrEBK` | ✅ |
| `hero-panel.tsx` | `e642352ad96e9fa45237e2d12d363078` | `e642352ad96e9fa45237e2d12d363078` | ✅ |
| `globals.css` | `d0ceb7765d835ec878350ee4e94f0f99` | `d0ceb7765d835ec878350ee4e94f0f99` | ✅ |
| `markdown.tsx` | `81d776e246742268e700cfb73e1295bb` | `81d776e246742268e700cfb73e1295bb` | ✅ |

**结论：用户给出的 `qLjhRHbk5xXetbyhTrEBK` 是对的；报告 §21 已写对。真正过期的是 §19.1 的 `-7qwbDOMQaVnmas2PZCDj`（Phase-2 构建），已标记为历史。**

- `git log`：最新提交 `ac27d58`（V4.1），**V4.2 全部改动未提交** —— `git status` 显示 31 个已改 + 5 个新增文件，**全部在 `apps/web/src/**` 与 `docs/**`**。
- `git status backend/` **为空** → 后端 0 修改（与报告一致）。
- **是否又发生过一次构建？** 是。§19.1 记录的是 Phase-2 构建；Phase 3 改了 `hero-panel.tsx`（mtime 13:21:13）与 `globals.css`（13:21:13）后重建 → `BUILD_ID` 文件 mtime 13:21:53，产出了 `qLjh…`。
- **独立重建实验（关键）**：复验者用 `NODE_OPTIONS="" npx next build` 对**同一份源码**重新构建，BUILD_ID 变为 `-cZb3EicpbxhorTSMI5Lw`，**三个 md5 完全没变**，构建 15/15 页成功。→ **证明 BUILD_ID 每次构建随机重生，不能当跨构建身份；md5 才是身份。**

### 22.2 暗色 Hero 独立像素复验

方法：真实渲染截图 + 计算样式 + **实际背景合成色**三者交叉。
把 H1/眉标/副标题/两个 CTA/状态胶囊的 `color` 置为 `transparent` 后**再截一张图**，
在**文字所在区域沿横向取 7 个点**（f = 0.06/0.20/0.34/0.50/0.66/0.80/0.94）读取**真实合成背景**像素；
文字色取计算样式，并与正常截图里文字带内最接近该色的像素交叉核对。

| 元素 | 字号/字重 | 阈值 | 7 点对比度（最差 / 最好） | 判定 |
| --- | --- | --- | --- | --- |
| H1 主标题 | 32px / 700（Large） | **3.0** | **14.93 / 16.35** | ✅ PASS |
| 眉标 ENTERPRISE RAG COPILOT | 11px / 600 | 4.5 | 5.85 / 6.68 | ✅ PASS |
| 副标题 | 14px / 400 | 4.5 | 6.79 / 7.15 | ✅ PASS |
| CTA 描边「体验 AI Agent」 | 14px / 500 | 4.5 | 16.03 / 16.39 | ✅ PASS |
| **CTA 主按钮「立即提问」** | 14px / 500 | 4.5 | **2.63 / 2.68** | ❌ **FAIL** |
| 状态胶囊「AI Copilot 已就绪」 | 11px / 400 | 4.5 | 11.88（计算色 204,205,212 对 surface） | ✅ PASS |

> 采样点原始值（H1，7 点背景 → 对比度）：`(26,29,41)→15.02 / (27,27,39)→15.25 / (25,26,39)→15.43 / (28,29,42)→14.93 / (26,28,41)→15.13 / (24,24,35)→15.74 / (21,20,29)→16.35`。
> 主 CTA 7 点背景 → 对比度：`(142,151,252)→2.63 / (140,151,253)→2.64 / (141,150,253)→2.65 / (142,149,251)→2.68 / (140,150,252)→2.66 / (140,150,253)→2.66 / (139,150,254)→2.66`。
> 文字色经正常截图交叉核对：H1 命中 `(242,242,245)`、主 CTA 命中 `(255,254,255)`，与计算样式一致。

**截图（已归档 `docs/images/v4.2-verify/`）**：
`dark-hero-normal.png`（真实渲染）、`dark-hero-textgone.png`（文字置透明后的纯背景）、
`dark-hero-crop.png`（首屏裁切）、`cta-zoom.png`（CTA 放大：可见白字压浅紫）。

**失败根因**：`button.tsx` primary 变体为 `bg-[var(--color-accent)] text-white`；
暗色下 `--color-accent: #8b95ff`（被提亮以避免在暗底发闷）→ **白字压浅紫**。
浅色下 `--color-accent: #4f46e5`，白字对比约 6.3:1（合格）→ **这是暗色专属回归**。
同一写法还出现在 `sidebar.tsx:142` 的品牌标。

**浅色硬编码残留：无（亮底浅字已消除）**。
纯背景截图中，最亮的 40×40 区块平均亮度仅 **0.312**；Hero 文字带平均 RGB `(26,27,39)`、平均亮度 **0.018** —— 面板是真正的深色玻璃，§20.2 的 token 化修复成立。
（Hero 顶部 1px 受光边是**有意的**高光，非硬编码面板。）

### 22.3 增量回归（同一冻结构建）

**A. 横向溢出（home × 375/390/430/768/1080/1440 × Light/Dark）**

| 重测数量 | 通过（=0） | 失败（≠0） |
| --- | --- | --- |
| **12** | **12** | **0** |

12 个组合 `documentElement.scrollWidth − clientWidth` 全部为 0；无 Chrome 错误页、`main` 全部存在。

**B. 手机首屏 390×844 · 三个核心入口**（取 `section.md:hidden` 内的可见组，非 `length===3`）

| 入口 | top | **bottom（原始）** | 完整可见（bottom ≤ 844） |
| --- | --- | --- | --- |
| /ask 知识问答 | 515 | **574** | ✅ |
| /agent AI 任务 | 582 | **642** | ✅ |
| /solution-studio 方案生成 | 650 | **710** | ✅ |

（另有 Hero 内 `a[href="/ask"]` 的两处 CTA 链接，非三入口；已按"可见的那一组"排除。）

**C. Citation 焦点归还（真实鼠标 `Input.dispatchMouseEvent` press+release；真实 `Input.dispatchKeyEvent` Escape）**

| 用例 | 抽屉打开 | 焦点入面板 | 关闭方式 | 关闭后 activeElement | 判定 |
| --- | --- | --- | --- | --- | --- |
| A：点 `[0]` → Escape | ✅ | ✅ inside | Escape | **chip #0**（非 body） | ✅ |
| B：点 `[1]` → 关闭按钮 | ✅ | ✅ inside | 「关闭面板」按钮 | **chip #1**（非 body） | ✅ |
| C：点 `[2]` → Escape | ✅ | ✅ inside | Escape | **chip #2**（非 body） | ✅ |

**通过 3 / 失败 0。** （用真实事件而非 `dispatchEvent`；合成事件不会移动焦点，正是作者曾踩的坑。）

### 22.4 后端 pytest（本轮实际执行）

先查证据：`C:/agents/temp/pytest_out.txt` 为 **2026-09-17**（V4.1 时代，159 passed），**不是本轮**。
本轮改动尚未跑过后端测试，故**实际执行**：

```
cd C:/projects/enterprise-rag-assistant/backend
.venv/Scripts/python.exe -m pytest -q
→ 171 passed in 21.17s
```

`git status backend/` 为空 → 后端 0 修改，171 passed 与本轮前端改动无冲突。

### 22.5 独立复验总判定

> ⚠️ **历史结果。** 下表为 accent-solid 补丁**之前**的构建。**主 CTA 的 FAIL 行已被 §23 修复复验为 PASS**，故本节 `NOT READY` 不再代表当前状态。

| 维度 | 独立结论 |
| --- | --- |
| 构建身份 | ✅ 一致（md5 逐字相同；BUILD_ID 随机性已澄清） |
| 暗色 Hero · H1/副标题/描边 CTA/眉标/胶囊 | ✅ PASS |
| 暗色 Hero · **主 CTA「立即提问」** | ❌ **FAIL（2.63–2.68:1 < 4.5:1）** → ✅ 已由 §23 修复（6.05–6.18:1） |
| 浅色硬编码残留 | ✅ 无 |
| 横向溢出 12 组合 | ✅ 12/12 = 0 |
| 手机三入口 | ✅ 574 / 642 / 710 ≤ 844 |
| Citation 焦点归还 | ✅ 3/3 |
| 后端 pytest | ✅ 171 passed |

# NOT READY（历史）

**唯一阻塞项**：暗色主 CTA 文字对比度 **2.63–2.68:1**，低于 WCAG AA 普通文本 **4.5:1**（跨页面 token 级问题）。
其余均有独立证据。修复入口见 §21.3。**该阻塞项已在 §23 消除。**

> `NOT READY` ≠ 全盘否定：这一版把 H1 从 1.74:1 救回 ~15:1、消除了溢出回归、关闭了 Citation 焦点 P0，
> 且这些**都经独立复验确认**。但主 CTA 白字压浅紫是真实可读性缺陷，**不能包装成 PASS**。

---

## 23. Accent Contrast Patch — 独立复验（verify-accent，未参与任何代码修改）

> 复验者**没有改过一行代码/配置/后端**。评审期间源码冻结：四个关键文件 md5 在**构建前后逐字一致**（见 §23.1）。
> 方法：**真实生产构建**（`NODE_OPTIONS="" npx next build`）+ `next start` + 真实 Chromium（CDP，`--no-proxy-server`，DOM 就绪判定）。
> **服务与采集在同一条命令内完成**。原始数据与脚本：`C:/agents/temp/verify-accent/`。

### 23.1 原问题、修改文件、构建身份

**原问题**：暗色主 CTA「立即提问」白字压浅紫填充，§22 像素实测仅 **2.63–2.68:1**。
**根因**：`--color-accent` 同时承担「文字/描边/图标强调色」（暗色被提亮成 `#8b95ff`）与「实心按钮填充」两种职责，两者对亮度要求相反。

**改动（4 个文件，本次仅核对、未修改）**

| 文件 | 改动 | md5（磁盘 = 复验值） |
| --- | --- | --- |
| `apps/web/src/app/globals.css` | 新增 `--color-accent-solid` / `--color-accent-solid-hover`；浅 `#4f46e5`/`#4338ca`，暗 `#4f46e5`/`#5850f0`；**`--color-accent` 未动** | `8645e43142ded1998bd8a5a232761c0f` |
| `apps/web/src/components/ui/button.tsx` | primary 变体填充/hover 改用 `accent-solid` | `093368746c657b7472ae671709d89e74` |
| `apps/web/src/components/layout/sidebar.tsx` | 品牌标（`size-7` 方块 + 白字图标）改用 `accent-solid` | `c313b2f00379ef8c03e5a7669c931e94` |
| `apps/web/src/components/ui/toggle.tsx` | Switch 打开态轨道改用 `accent-solid`（白旋钮压浅紫属 1.4.11 非文字对比） | `c01d9a4980ba4d0bbcd54891118785dd` |

**四个 md5 全部与磁盘一致 → 构建与本次改动对应，可以继续复验。**

**冻结构建标识（md5 才是身份；BUILD_ID 不是）**

| 项 | 值 |
| --- | --- |
| `globals.css` | `8645e43142ded1998bd8a5a232761c0f` |
| `button.tsx` | `093368746c657b7472ae671709d89e74` |
| `sidebar.tsx` | `c313b2f00379ef8c03e5a7669c931e94` |
| `toggle.tsx` | `c01d9a4980ba4d0bbcd54891118785dd` |
| 构建前 `.next/BUILD_ID` | `dYr6qDgOQQ6Rzf-Pyy5JX` |
| **本次重建后 BUILD_ID** | `yJ2WEnDJaq_gitMAB3Sbf` |

> ⚠️ **BUILD_ID 每次 `next build` 都随机重生，不能当跨构建身份。** 同一份源码至今已产出过
> `qLjhRHbk5xXetbyhTrEBK`（§21.4）、`-cZb3EicpbxhorTSMI5Lw`（§22.1）、`dYr6qDgOQQ6Rzf-Pyy5JX`（补丁后构建）、
> `yJ2WEnDJaq_gitMAB3Sbf`（本次）四个不同值，而**四个源码 md5 一字未变**。**真正的身份是源码 md5。**
> `git status backend/` 为空 → 后端 0 修改。

### 23.2 对比度复验（实际渲染像素，非令牌值）

**方法**：把目标文字/图标置 `color:transparent` 后**再截一张图**，读文字所在带的**真实合成背景**像素；
沿文字带横向取 **6 个采样点**（f = 0.08/0.24/0.40/0.56/0.72/0.88），取**最差点**判定。
文字/图标色取计算样式，并与正常截图中文字带内最接近该色的像素交叉核对。
阈值：普通文本 **4.5:1**；Large Text（≥24px，或 ≥18.66px 且 bold）**3.0:1**；非文字 UI 组件 **3.0:1**。

**① 主 CTA「立即提问」（14px/500，普通文本，阈值 4.5）**

| 主题 / 状态 | 文字色（计算值） | 填充（像素实测） | 6 点对比度（最差…最好） | 判定 |
| --- | --- | --- | --- | --- |
| **dark · default** | `rgb(255,255,255)` | `(79,70,229)` = `#4f46e5` | **6.05 / 6.18** | ✅ PASS |
| **dark · hover** | `rgb(255,255,255)` | `(88,80,240)` = `#5850f0` | **5.35 / 5.44** | ✅ PASS |
| **light · default** | `rgb(255,255,255)` | `(79,70,229)` = `#4f46e5` | **6.13 / 6.23** | ✅ PASS |
| **light · hover** | `rgb(255,255,255)` | `(67,56,202)` = `#4338ca` | **7.66 / 7.80** | ✅ PASS |

- dark default 6 点原始背景 → 对比度：`(83,73,228)→6.10 / (82,74,229)→6.05 / (82,73,228)→6.12 / (82,74,227)→6.09 / (80,73,228)→6.15 / (81,72,228)→6.18`。
- dark hover 6 点：`5.35 / 5.36 / 5.36 / 5.36 / 5.42 / 5.44`。
- 文字色经正常截图交叉核对：dark/light 均命中 `(254–255,254–255,255)`，与计算样式 `rgb(255,255,255)` 一致。
- **对比 §22 历史值 2.63–2.68:1：暗色主 CTA 已从 FAIL 修到 6.05–6.18:1。**

**② 其余 Hero 文本（与 §22 参考值对照，阈值 H1 3.0 / 其余 4.5）**

| 元素 | 主题 | 6 点对比度（最差…最好） | 参考值（§22.2） | 判定 |
| --- | --- | --- | --- | --- |
| H1 主标题（32px/700，Large） | dark | **14.66 / 15.77** | 14.93–16.35 | ✅ PASS |
| H1 主标题 | light | **16.78 / 17.98** | — | ✅ PASS |
| 眉标 `ENTERPRISE RAG COPILOT`（11px/600） | dark | 5.75 / 6.53 | 5.85–6.68 | ✅ PASS |
| 副标题（14px/400） | dark | **6.96 / 7.12** | 6.79–7.15 | ✅ PASS |
| 副标题 | light | 5.24 / 5.42 | — | ✅ PASS |
| 描边 CTA「体验 AI Agent」（14px/500） | dark | 15.83 / 16.40 | 16.03–16.39 | ✅ PASS |
| 状态胶囊「AI Copilot 已就绪」（11px/400） | dark | **11.17 / 11.35** | 11.88（名义值） | ✅ PASS |
| 状态胶囊 | light | 10.91 / 10.97 | — | ✅ PASS |

> 差异说明：采样分数（0.08–0.88 vs §22 的 0.06–0.94）与 Hero 指针光晕相位不同，导致 H1 落在 14.66–15.77
> 而非 §22 的 14.93–16.35，**两者都远高于 3.0**，非回归。
> 另：状态胶囊在 §22 用的是退化采样（命中隐藏的移动端副本的子元素，rect=0），本次**改为只取可见副本**，
> dark 11.17–11.35 / light 10.91–10.97 才是真实像素值。

**③ 品牌标（`size-7` 方块 + 白色 Database 图标，方块内无文字）**

| 元素 | 主题 | 6 点对比度 | 阈值 | 判定 |
| --- | --- | --- | --- | --- |
| 白色图标 vs `#4f46e5` 填充 | dark | **6.29**（6 点全等） | 3.0（非文字） | ✅ PASS |
| 白色图标 vs `#4f46e5` 填充 | light | **6.29**（6 点全等） | 3.0（非文字） | ✅ PASS |
| 相邻品牌文字 `Enterprise RAG Copilot`（13px/600） | dark | 16.85 | 4.5 | ✅ PASS |
| 相邻品牌文字 | light | 18.98 | 4.5 | ✅ PASS |

> 品牌方块内**只有图标、没有文字**；即便按最严的「普通文本 4.5」衡量，6.29:1 也达标。

**④ Switch 打开态（白/近白旋钮 vs `accent-solid` 轨道，SC 1.4.11，阈值 3.0）**

| 主题 | 旋钮 | 轨道（像素实测） | 6 点对比度 | 判定 |
| --- | --- | --- | --- | --- |
| light | `rgb(255,255,255)` | `rgb(79,70,229)` | **6.29** | ✅ PASS |
| dark | `rgb(238,237,242)` | `rgb(79,70,229)` | **5.40** | ✅ PASS |

**⑤ 其他实心强调色填充 — 全仓 grep 审计（第 4 项要求，不是只信清单）**

- 所有 `text-white` 搭配强调色填充的位置**只有两处**：`button.tsx:23`（primary）与 `sidebar.tsx:144`（品牌标）——**均已改为 `accent-solid`**。
- 其余 `bg-[var(--color-accent)]` 全部是**纯装饰/指示件，其上不承载文字或图标**：`badge.tsx` / `utils.ts` 的状态点、`data.tsx` / `retrieval-panel.tsx` 的进度条、`sidebar.tsx:221` 的 3px 选中条、`tabs.tsx:60` 的下划线；Hero 的径向渐变与吉祥物 SVG 亦为装饰。**不存在同类「白字压浅紫」。**
- `--color-accent-soft` 底一律配 `--color-accent-ink` 文字（软色，非实心）。
- **潜在（未渲染）问题**：`button.tsx` 的 `danger` 变体是 `bg-[var(--color-danger)] text-white`，暗色 `--color-danger: #f78c8c` 下白字仅 **2.31:1**（解析值）。但**全仓无任何 `variant="danger"` 使用点**（grep 0 命中），**该按钮不会被渲染**。记录为 dead code 的潜在风险，**不构成本次 Gate 的阻塞项**。

### 23.3 hover 态与 disabled 态的处理

- **hover 态已实测**：主 CTA（浅/暗）与品牌标均已覆盖。CTA hover 暗=`#5850f0`→5.35–5.44、浅=`#4338ca`→7.66–7.80，**均 ≥4.5**。品牌标无 hover 样式，等于默认态 6.29。
- **disabled 态单独评估**：primary 按钮 disabled 时为 `opacity-45`。按 WCAG 1.4.3/1.4.6，**禁用控件不计入对比度要求**，故**不纳入通过/失败判定**，仅记录其存在。**未与可操作态混同。**

### 23.4 增量回归（同一冻结构建）

**A. 横向溢出（home × 375/390/430/768/1080/1440 × light/dark）**

| 重测组合 | 通过（over=0） | 失败 | 备注 |
| --- | --- | --- | --- |
| **12** | **12** | **0** | 12 组合 `scrollWidth−clientWidth` 全 0；`main` 全部存在、无 Chrome 错误页 |

**B. 390×844 首屏三个核心入口**（取 `section.md:hidden` 内**可见**组，**未用 `length===3`**）

| 入口 | top | bottom | bottom ≤ 844 |
| --- | --- | --- | --- |
| /ask 知识问答 | 515 | **574** | ✅ |
| /agent AI 任务 | 582 | **642** | ✅ |
| /solution-studio 方案生成 | 650 | **710** | ✅ |

> DOM 中确实**同时存在**手机行与桌面/卡片链接：Hero 内 `a[href="/ask"]`（top 291–335）、`a[href="/agent"]`（343–387），
> 以及页脚 `a[href="/ask"]`（top 3795）。**证实 `length===3` 会误判**，本复验按「可见行」判定。

**C. Citation 焦点归还（真实 `Input.dispatchMouseEvent` press+release；真实 `Input.dispatchKeyEvent` Escape）**

| 用例 | 抽屉打开 | 焦点入面板 | 关闭方式 | 关闭后 activeElement | 判定 |
| --- | --- | --- | --- | --- | --- |
| A：点 `[0]` → Escape | ✅ | ✅ | Escape | **data-chip=0**（非 body，`isClickedChip=true`） | ✅ |
| B：点 `[1]` → 关闭按钮 | ✅ | ✅ | 「关闭面板」按钮 | **data-chip=1**（非 body） | ✅ |
| C：点 `[2]` → Escape | ✅ | ✅ | Escape | **data-chip=2**（非 body） | ✅ |

**通过 3 / 失败 0。**（后端真实生成回答：`answer rendered: true`。）

### 23.5 逐项结论

| # | 复验项 | 结果 |
| --- | --- | --- |
| 1 | Dark 主 CTA 文本对比度 ≥4.5 | ✅ **6.05–6.18:1**（hover 5.35–5.44） |
| 2 | Light 主 CTA 仍 ≥4.5 | ✅ **6.13–6.23:1**（hover 7.66–7.80） |
| 3 | Sidebar 品牌标图标对比度 | ✅ **6.29:1**（非文字组件，≥3） |
| 4 | 其他实心强调色填充同类问题 | ✅ 无（grep 审计；危险按钮变体为未渲染 dead code） |
| 5 | Hero H1 / 副标题 / 状态文案维持 | ✅ H1 14.66–15.77、副标题 6.96–7.12、胶囊 11.17–11.35 |
| 6 | 12 组合无横向溢出 | ✅ 12/12 = 0 |
| 7 | 390×844 三入口完整可见 | ✅ 574 / 642 / 710 ≤ 844 |
| 8 | Citation 焦点恢复 | ✅ 3/3 |

### 23.6 交付截图（`docs/images/v4.2-accent/`）

`dark-cta.png` / `dark-cta-hover.png` / `dark-cta-fill-only.png`、`light-cta.png` / `light-cta-hover.png` / `light-cta-fill-only.png`、
`dark-brandmark.png` / `light-brandmark.png`、`dark-switch.png` / `light-switch.png`、`dark-hero.png` / `light-hero.png`。
（`*-fill-only.png` 为文字置透明后的纯填充，用于证明采样背景即真实填充色。）

### 23.7 最终 Gate

# READY FOR PRODUCT REVIEW

**8 项全部通过。** 暗色主 CTA 的 token 级缺陷已由 `--color-accent-solid` 消除，
并经**未参与改动的独立评审者**用真实生产构建 + 实际渲染像素复验确认。

> `READY FOR PRODUCT REVIEW` ≠ `READY FOR PRODUCTION RELEASE`。本轮仍是**本地实现 + 本地 QA**，
> 未部署；生产发布另行走查（见文首声明）。
> 遗留（不阻塞）：`button.tsx` 的 `danger` 变体在暗色下白字 2.31:1——**当前无任何调用点**，属于 dead code，记录待清理或连同 `danger` 一起 token 化。
