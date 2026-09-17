---
type: 概念
area: AI与实习
status: active
up: "[[02-AI与实习地图]]"
tags:
  - AI/Agent
  - AI/Skill
  - AI/Tool
  - AI/Architecture
aliases:
  - Agent、Skill、Tool 关系
  - Skill 与 Tool 的区别
created: 2026-07-16
---

# 🤖 Agent、Skill、Tool 的关系（企业级 AI Agent 架构）

## 📌 一、权威定义

### 1️⃣ Agent（智能体）

> **Agent 是负责理解用户目标、制定执行策略，并协调调用各种 Skill、Tool、知识库等资源完成任务的智能系统。**

Agent 最重要的职责不是干活，而是**决策（Decision）**。

一句话理解：

> **Agent 决定做什么。**

---

### 2️⃣ Skill（技能）

> **Skill 是完成某一类业务任务的能力封装，它定义了业务流程、调用规则、输入输出以及相关资源，可以协调多个 Tool 完成一个完整任务。**

一句话理解：

> **Skill 决定怎么做。**是一个**可复用的完整业务能力**。

Skill 更偏向：

- 业务能力
- 工作流（Workflow）
- Prompt
- 规则
- 输出规范

它更像一个"项目经理"。

---

### 3️⃣ Tool（工具）

>**执行一个具体动作的最小能力单元**。通常负责真正调用代码、API、数据库或系统能力。

一句话理解：

> Tool 真正去干活。边界明确、输入输出确定的原子动作，它能完整执行一个具体动作，但不能独立完成用户的完整业务任务。

Tool 更偏向：

- 查询数据库
- 调用 API
- 执行 Python
- 生成 PPT
- 发送飞书消息
- 读取 Excel

它更像一个"员工"。

---

# 📌 二、三者关系

整体关系如下：

```text
Agent
│
├── 调用 Skill A
├── 调用 Skill B
└── （部分框架也可以直接调用 Tool）
        │
        ▼
Skill
│
├── Tool 1
├── Tool 2
├── Tool 3
└── Tool 4
```

可以总结成一句话：

> **Agent 负责决策，Skill 负责组织，Tool 负责执行。**

---

# 📌 三、最容易混淆的地方

很多新人认为：

> Skill 包含 Tool。

更准确地说：

> **Skill 通常调用（Invoke）Tool，而不是拥有（Own）Tool。**

原因：

很多 Tool 是多个 Skill 共用的。

例如：

```text
                generate_ppt Tool
                 ↑      ↑      ↑
                 │      │      │
        竞品分析   销量分析   新品分析
           Skill    Skill    Skill
```

例如：

generate_ppt

可以被：

- 竞品分析 Skill
- 销量分析 Skill
- 新品分析 Skill

共同调用。

因此：

**Tool 更像公司的公共资源。**

---

# 📌 四、为什么公共 Tool 不放进某个 Skill？

假设：

generate_ppt

放到了：

```text
skills/
└── competitor_analysis/
        └── generate_ppt.py
```

那么：

销量分析 Skill，想生成 PPT：怎么办？

又复制一份？新品分析：再复制？

这样：整个项目到处都是：

generate_ppt.py

以后：Bug 修一次。

要改：十几份。

维护成本非常高。

所以：企业一般都会：

抽出来。

---

# 📌 五、企业推荐目录结构

```text
project/
│
├── skills/
│   ├── competitor_analysis/
│   ├── sales_analysis/
│   └── new_product_analysis/
│
├── tools/
│   ├── query_database.py
│   ├── calculate_metrics.py
│   ├── generate_chart.py
│   ├── export_ppt.py
│   └── send_feishu.py
│
└── tool_registry.py
```

特点：

Skill 放业务。

Tool 放公共能力。

---

# 📌 六、什么时候放 Skill 内部？

只有：

**这个能力完全不会复用。**

例如：

```text
skills/
└── competitor_analysis/
    └── scripts/
        └── calculate_competitor_gap.py
```

这个：

只有竞品分析会用。

可以放里面。

---

# 📌 七、什么时候抽成公共 Tool？

满足下面任意一条即可：

✅ 多个 Skill 都要调用

✅ 输入输出稳定

✅ 属于原子能力

✅ 希望统一维护

例如：

- 查询数据库
- SQL 执行
- Excel 读取
- 图表生成
- PPT 导出
- 飞书发送

这些几乎都会放到：

```text
tools/
```

里面。

---

# 📌 八、Skill 的真实组成

一个 Skill 通常包含：

```text
skill/
│
├── SKILL.md
├── scripts/
├── assets/
├── references/
└── yaml（部分框架）
```

各部分职责：

| 文件 | 作用 |
|------|------|
| SKILL.md | 描述 Skill 的用途、调用条件、输入输出（主要给 AI 看） |
| scripts | 真正执行脚本 |
| assets | 模板、图片、资源 |
| references | 文档、规范、示例 |
| yaml | Skill 配置、元数据（部分框架） |

---

# 📌 九、YAML 是什么？

> **YAML 本质上是配置文件（Configuration），用于描述 Skill 或 Tool 的元数据，而不是执行代码。**

通常包括：

- 名称
- 描述
- 入口脚本
- 参数
- 权限
- 版本

例如：

```yaml
name: competitor-analysis

entrypoint:
  scripts/run.py

permissions:
  - database
```

可以理解为：

> **Skill 或 Tool 的身份证。**

---

# 📌 十、最重要的一张图（建议背下来）

```text
                 用户
                  │
                  ▼
              Agent（决策）
                  │
      ┌───────────┴───────────┐
      ▼                       ▼
  Skill：竞品分析         Skill：销量分析
      │                       │
      ├──────────┐            │
      ▼          ▼            ▼
 query_db    chart Tool   export_ppt
      │          │            │
      └──────────┴────────────┘
             公共 Tool 层
```

---

# 🎯 一句话总结

> **Agent 决定做什么（调用skill或者tool），Skill 决定怎么做（完成一项业务能力），Tool 真正去干活（only执行一个动作）。Skill 通常会调用多个 Tool，而多个 Skill 也可以共享同一个公共 Tool，因此企业项目通常会建立独立的 Tool 层，而不是把 Tool 放进某一个 Skill 中。**

---

# 💡 我的理解

以后设计企业级 Agent 时，应优先遵循：

> **业务能力（Skill）与执行能力（Tool）分离。**

这样可以：

- 提高复用性；
- 降低维护成本；
- 更符合大型项目的模块化设计思想。

以后无论是商业分析 Agent、售前 Agent，还是企业知识库 Agent，都可以复用同一套 Tool，只需要编写不同的 Skill 即可。
