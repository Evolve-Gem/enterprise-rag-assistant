---
type: 概念
area: AI与实习
status: active
up: "[[02-AI与实习地图]]"
created: 2026-07-19
---

# 企业级 Agent 架构

> [!summary] 一句话总结
> Agent 不是一个单独的大模型，而是一套围绕目标运行的智能系统，由模型、规划、记忆、知识、工具、技能、流程、安全控制和评估机制等多个模块组成。其中 Agent 负责目标理解和动态决策，Tool 负责执行具体动作，Skill 封装业务能力，Workflow 固化流程，Harness 负责运行控制，Evaluation 负责持续优化。

---

# 1. 什么是 Agent Architecture？

## 权威定义

**Agent Architecture（Agent 架构）是指构成智能 Agent 系统的各个模块，以及这些模块之间的交互关系**。

通常包括：

- 模型（Model）
- Agent Orchestrator（智能体编排层）
- Planning（规划）
- Memory（记忆）
- Knowledge（知识）
- Tool（工具）
- Skill（能力封装）
- Workflow（流程）
- Harness（运行控制）
- Evaluation（评估）

---

## 通俗理解

一个企业 Agent 不应该理解成：

> 一个接入大模型的聊天机器人。

更应该理解成：

> 一个 AI 员工。

一个员工不仅需要“大脑”，还需要：

- 记忆过去经验；
- 理解任务目标；
- 使用工具；
- 遵守权限；
- 按流程工作；
- 接受绩效评价。

因此：

```text
Model ≠ Agent

Model = 大脑

Agent = 大脑 + 记忆 + 工具 + 决策 + 执行系统
```

---

# 2. 企业级 Agent 总体架构

```text
                用户
                 |
                 ↓

          Agent Interface
          （交互入口）

                 |
                 ↓

       Agent Orchestrator
       （智能体调度中心）

                 |
      -----------------------
      |          |          |

  Planning   Memory   Knowledge

      |
      |
  -----------------------
  |          |          |

 Tool      Skill    Workflow

      |
      ↓

 外部系统

 数据库 / API / 文件 / 企业系统


      ↓

 Harness

 权限、安全、日志、控制


      ↓

 Evaluation

 效果评估与持续优化
```

---

# 3. Model（模型层）

## 定义

Model 是提供语言理解、推理和生成能力的基础人工智能模型。

例如：

- GPT
- Claude
- DeepSeek

---

## 它在 Agent 中是什么角色？

Model 是：

> Agent 的大脑。

负责：

- 理解语言；
- 推理；
- 生成内容；
- 分析信息。

---

## 为什么大模型不是 Agent？

因为大模型本身不知道：

- 用户真正目标是什么；
- 应该调用哪个工具；
- 企业数据在哪里；
- 当前任务执行到哪里；
- 哪些操作需要审批。

例如：

用户：

> 分析竞品销量下降原因。


普通大模型只能回答：

“可能原因包括价格、渠道、营销等。”

但 Agent 可以：

```text
查询销量数据
→ 分析变化
→ 查询市场资料
→ 调用分析工具
→ 生成报告
```

---

# 4. Agent Orchestrator（智能体编排层）

## 定义

**Orchestrator 是负责协调 Agent 各模块运行、管理任务流程和调度资源的核心控制模块。**

---

## 它是什么？

可以理解为：

> Agent 的项目经理。

负责：

- 接收目标；
- 管理任务状态；
- 调度 Planning；
- 调用 Tool；
- 更新 State；
- 控制 Agent Loop。

---

## 示例

任务：

> 完成竞品分析报告。


Orchestrator：

```text
目标：
完成竞品分析

↓

查询销量数据

↓

发现华东区域异常增长

↓

决定进一步分析区域原因

↓

调用渠道分析能力
```

---

# 5. Planning（规划能力）

## 定义

**Planning 是 Agent 根据目标、当前状态和可用资源，生成任务执行计划，并根据执行结果动态调整计划的能力。**

---

## 它是什么？

Planning 是：

> **Agent 的任务规划能力。**

---

## Workflow 与 Planning 的区别

### Workflow

提前设计好的固定流程：

```text
取数
 ↓
计算
 ↓
制图
 ↓
生成报告
```

特点：

- 路径固定；
- 不需要动态决策。


### Planning

根据任务状态动态调整：

```text
目标：
分析竞品增长原因

↓

发现新品贡献较高

↓

调整计划：

分析新品策略
```

特点：

- 根据反馈改变路线；
- 更适合复杂任务。

---

# 6. Tool、Skill、Workflow 在架构中的关系

## Tool

定义：

> **执行一个具体动作的最小能力单元**。

例如：

商业分析：

```text
查询销量
计算增长率
读取文件
调用数据库
```

---

## Skill

定义：

> **围绕某类业务任务封装的方法、规则和工具组合。**

例如：

商业分析：

```text
竞品推荐 Skill

渠道分析 Skill

目标价格计算 Skill
```

Skill 可以包含多个 Tool。

---

## Workflow

定义：

> **提前设计好的固定业务处理流程。**

例如：

商业周报：

```text
取数
 ↓
计算指标
 ↓
生成图表
 ↓
生成周报
```


---

# 7. 商业分析案例

任务：

> 分析某竞品销量下降原因。


传统 Workflow：

```text
固定查询销量

↓

计算变化

↓

生成报告
```


Agent：

```text
理解任务目标

↓

查询销量

↓

发现下降集中在某渠道

↓

决定分析渠道变化

↓

发现竞品价格调整

↓

继续分析价格因素

↓

生成分析报告
```

Agent 会根据中间结果改变路径。

---

# 8. 标准复述表达

> 企业级 Agent 不是简单的大模型应用，而是一套围绕目标运行的智能系统。它以大模型作为推理核心，通过 Orchestrator 协调 Planning、Memory、Knowledge、Tool 和 Skill 等能力，根据任务状态动态决定下一步行动，并通过 Harness 管理权限和运行安全，通过 Evaluation 持续优化效果。

---

# 9. 本节核心记忆

```text
Model：
提供智能能力，是大脑

Orchestrator：
负责协调，是项目经理

Planning：
负责规划下一步

Memory：
保存历史信息

Knowledge：
提供外部知识

Tool：
执行具体动作

Skill：
封装业务能力

Workflow：
固定处理流程

Harness：
控制安全和运行

Evaluation：
评价和优化效果
```
