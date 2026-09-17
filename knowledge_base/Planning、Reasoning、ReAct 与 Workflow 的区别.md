---
type: 概念
area: AI与实习
status: active
up: "[[02-AI与实习地图]]"
created: 2026-07-19
---

# Planning、Reasoning、ReAct 与 Workflow 的区别

> [!summary] 一句话总结
> **Workflow 是提前定义好的固定执行流程，Planning 是 Agent 根据目标、状态和环境反馈动态决定下一步行动的能力；Reasoning 负责理解问题和判断行动，ReAct 则通过“思考—行动—观察”循环，让 Agent 根据反馈持续完成任务。**

---

# 1. Planning｜规划能力

## 权威定义

Planning 是 Agent 根据目标、当前状态、可用资源和环境反馈，生成任务执行方案，并在执行过程中动态调整计划的能力。

关键词：

- Goal（目标）
- State（状态）
- Resource（资源）
- Feedback（反馈）
- Replanning（重新规划）

---

## 它在 Agent 中是什么？

Planning 是：

> Agent 将目标转化为行动路径的能力。

类似人的：

- 制定计划；
- 分解任务；
- 根据情况调整方案。

---

## 示例

目标：

> 分析竞品 A 销量下降原因。


Agent：

第一步：

查询销量。

结果：

发现：

华南区域下降明显。


重新规划：

下一步：

分析华南渠道变化。


如果发现：

渠道正常。


继续调整：

分析价格变化。


这就是 Planning。

---

# 2. Planning 与 Workflow 的区别

| | Workflow | Planning |
|-|-|-|
| 本质 | 固定流程 | 动态决策能力 |
| 路径 | 提前设计 | 运行中生成 |
| 决策者 | 开发者 | Agent |
| 适合 | 确定性任务 | 不确定任务 |

---

一句话：

> Workflow 告诉系统怎么走，Planning 让 Agent 判断下一步怎么走。

---

# 3. 为什么 Agent 需要 Planning？

现实任务通常不是：

```text
输入
↓
固定输出
```

而是：

```text
目标

↓

探索

↓

发现信息

↓

调整方向

↓

继续执行

↓

完成目标
```

例如：

“分析竞品增长原因”

无法提前确定：

增长来自：

- 产品？
- 价格？
- 渠道？
- 营销？

因此需要动态规划。

---

# 4. Task Decomposition｜任务拆解

Planning 的第一步通常是：

> 将复杂目标拆解成多个可执行子任务。

例如：

目标：

制作竞品分析报告。

拆解：

```text
获取数据

↓

分析趋势

↓

寻找异常

↓

查询市场资料

↓

形成原因假设

↓

生成报告
```

---

# 5. Replanning｜重新规划

## 定义

Replanning 是 Agent 根据执行过程中获得的新信息，调整原有计划的能力。

---

## 示例

原计划：

```text
分析渠道变化
```

发现：

增长主要来自新品。

Agent：

更新 State：

```text
增长原因：
新品贡献
```

重新规划：

```text
分析新品策略
```

---

# 6. Reasoning｜推理

## 定义

Reasoning 是模型根据目标、信息和规则进行分析、判断和产生行动依据的过程。

---

## 在 Agent 中：

Reasoning 负责：

- 理解任务；
- 分析状态；
- 判断下一步行动。

例如：

> 当前缺少销量数据，因此应该调用销量查询工具。

---

# 7. ReAct｜Reasoning and Acting

## 权威定义

ReAct 是一种 Agent 设计模式，通过让模型循环执行：

Reasoning（思考）

↓

Action（行动）

↓

Observation（观察）

使 Agent 根据环境反馈动态完成任务。

---

## 流程

```text
Reasoning

↓

Action

↓

Observation

↓

Update State

↓

Reasoning
```

---

## 商业分析案例

任务：

分析竞品增长原因。

Reasoning：

需要知道增长来源。

Action：

调用销量 Tool。

Observation：

发现增长集中在华东。

Reasoning：

需要分析区域渠道。

Action：

调用渠道分析 Skill。

---

# 8. Tool 与 Planning 的关系

很多人误解：

Agent = 大模型调用 Tool。

错误。


正确：

```text
用户目标

↓

Planning

决定做什么

↓

Tool Selection

选择工具

↓

Tool Execution

执行动作

↓

Observation

反馈结果

↓

Replanning
```

---

Tool 是：

> 执行动作的能力。


Planning 是：

> 决定下一步动作的能力。

---

# 9. 商业分析场景判断

## 自动生成商业周报

流程：

```text
读取数据

↓

计算指标

↓

生成报告
```

适合：

Workflow。

原因：

- 流程固定；
- 不需要动态决策。


---

## 分析竞品销量下降原因

需要：

- 判断原因；
- 选择分析方向；
- 调用不同能力。

适合：

Agent。

---

# 10. 如何判断该用 Workflow 还是 Agent？

三个问题：

## 1. 流程是否固定？

固定：

Workflow。

不固定：

Agent。

---

## 2. 是否需要根据中间结果改变路线？

需要：

Agent。

不需要：

Workflow。

---

## 3. 是否存在探索和判断？

存在：

Agent。

不存在：

Workflow。

---

# 11. 标准复述版本

> Workflow 是预先设计好的固定执行流程，适合目标明确、步骤稳定的问题。Planning 是 Agent 根据目标、状态和环境反馈动态规划下一步行动的能力，是 Agent 区别于传统 Workflow 的核心能力。ReAct 则通过 Reasoning、Action、Observation 循环，让 Agent 能够根据执行结果不断调整策略完成复杂任务。

---

# 核心记忆

```text
Workflow：
固定路线执行

Planning：
动态决定路线

Reasoning：
判断为什么这样做

Action：
执行动作

Observation：
获取反馈

Replanning：
根据反馈调整计划
```
