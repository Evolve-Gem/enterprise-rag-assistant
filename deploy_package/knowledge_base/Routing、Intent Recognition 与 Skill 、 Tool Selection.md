---
type: 概念
area: AI与实习
status: active
up: "[[02-AI与实习地图]]"
created: 2026-07-19
---

# Routing、Intent Recognition 与 Skill、Tool Selection

> [!summary] 一句话总结
> **Routing 是 Agent 根据用户目标、任务类型和当前状态，将请求分配给合适 Skill、Tool 或 Workflow 的能力。Planning 决定下一步应该做什么，Routing 决定应该由哪个能力完成，Skill 封装业务能力，Tool 执行具体动作。企业 Agent 通常结合静态路由和动态路由，在效率和智能之间取得平衡。**

---

# 1. Routing｜路由

## 权威定义

Routing（路由）是 Agent 根据用户目标、任务类型、上下文信息和当前状态，将任务分配给合适处理模块的能力。

这些处理模块可能包括：

- Skill
- Tool
- Workflow
- 子 Agent

---

## 它在 Agent 中是什么？

Routing 是：

> Agent 判断“这个任务应该交给谁处理”的能力。

类似企业组织中的任务分派：

用户需求：

```
退款问题
↓
财务部门

技术问题
↓
技术团队

产品建议
↓
产品团队
```

---

# 2. 为什么 Agent 需要 Routing？

企业 Agent 通常拥有多个能力：

例如商业分析 Agent：

```
销量分析 Skill

渠道分析 Skill

价格分析 Skill

竞品分析 Skill

报告生成 Workflow
```

用户：

> 分析竞品 A 最近销量下降原因。


Agent 需要判断：

应该调用：

- 销量分析？
- 渠道分析？
- 价格分析？
- 产品分析？

这就是 Routing。

---

# 3. Routing 不等于关键词匹配

简单系统：

```python
if "价格" in question:
    use_price_tool
```

这属于：

关键词匹配。

---

真正 Agent Routing：

需要理解：

用户真正想完成什么。

例如：

用户：

> 最近这个品牌为什么卖不动了？


虽然没有出现：

- 销量
- 渠道
- 价格

但是 Agent 需要理解：

可能需要：

```
销量分析

+

渠道分析

+

竞品分析
```

---

所以：

Routing 本质：

```
自然语言目标

↓

任务理解

↓

能力匹配

↓

资源调度
```

---

# 4. Intent Recognition｜意图识别

## 定义

Intent Recognition 是识别用户请求目标和任务类型的能力。

---

它通常是 Routing 的第一步。

流程：

```
用户输入

↓

Intent Recognition

↓

Router

↓

选择 Skill / Tool

↓

执行
```

---

例如：

用户：

> 帮我计算两个竞品价格差异。


Intent：

```
price_comparison
```

然后：

选择：

```
价格分析 Skill
```

---

# 5. Planning 与 Routing 的区别

这是 Agent 设计中的核心区别。

---

## Planning

回答：

> 下一步应该做什么？


负责：

- 制定行动方向；
- 拆解任务；
- 根据反馈调整计划。


---

## Routing

回答：

> 这件事应该交给谁做？


负责：

- 选择 Skill；
- 选择 Tool；
- 选择 Workflow。

---

关系：

```
Planning

决定：
我要分析渠道

↓

Routing

决定：
调用 channel_analysis Skill
```

---

一句话：

> Planning 决定做什么，Routing 决定交给谁做。

---

# 6. Skill Selection 与 Tool Selection

## Skill Selection

选择：

> 业务能力。


例如：

用户：

> 比较两个品牌渠道差异。


选择：

```
channel_comparison Skill
```

---

## Tool Selection

选择：

> 执行具体动作的工具。


Skill 内部：

可能调用：

```
数据库查询 Tool

Python计算 Tool

文件读取 Tool
```

---

关系：

```
用户目标

↓

Routing

↓

Skill Selection

↓

Tool Selection

↓

执行
```

---

# 7. 为什么 Skill 层重要？

如果 Agent 直接面对大量 Tool：

例如：

```
100个工具

查询销量

读取文件

计算平均值

查询价格

计算增长率

...
```

会出现：

## 1. 决策空间过大

Agent 不知道选择哪个。

---

## 2. 缺少业务语义

Tool 是技术语言。

例如：

```
calculate_growth_rate()
```

业务人员不会说：

“调用增长率计算工具”。

他们说：

> 分析增长趋势。

Skill 可以把技术能力包装成业务能力。

---

## 3. 容易调用错误

用户：

> 分析竞品价格优势。


正确：

```
价格分析 Skill
```

而不是简单：

```
平均价格计算 Tool
```

---

# 8. Static Routing｜静态路由

## 定义

Static Routing 是任务开始时，根据输入直接确定处理路径。

---

例如：

用户：

> 计算两个竞品价格差。


直接：

```
价格分析 Skill
```

---

优点：

- 快；
- 稳定；
- 成本低。


缺点：

- 灵活性低。

---

适合：

明确任务。

---

# 9. Dynamic Routing｜动态路由

## 定义

Dynamic Routing 是 Agent 根据执行过程中的结果和状态变化，动态调整调用能力的方式。

---

例如：

任务：

> 分析竞品销量下降原因。


第一步：

调用销量分析。

发现：

```
华南区域下降明显
```

更新状态。

---

第二步：

重新 Routing：

调用：

```
渠道分析 Skill
```

发现：

渠道正常。

---

第三步：

重新 Routing：

调用：

```
价格分析 Skill
```

---

流程：

```
目标

↓

Planning

↓

Routing

↓

Skill执行

↓

Observation

↓

State更新

↓

重新Routing
```

---

# 10. Static Routing 与 Dynamic Routing 如何选择？

不是越动态越好。

---

## Static Routing

适合：

- 流程明确；
- 输入固定；
- 结果确定。


例如：

自动生成日报。

---

## Dynamic Routing

适合：

- 原因未知；
- 路径不确定；
- 需要探索。


例如：

分析销量下降原因。

---

企业最佳实践：

> 固定部分流程，动态部分决策。

---

# 11. 竞品分析 Agent 案例

用户：

> 分析竞品 A 最近销量下降原因。


## 第一步：Intent Recognition

识别：

```
competitor_analysis
```

---

## 第二步：Planning

决定：

```
需要先获取销量数据
```

---

## 第三步：Routing

选择：

```
销量分析 Skill
```

---

## 第四步：执行

得到：

```
华南区域下降明显
```

---

## 第五步：重新 Planning

决定：

分析渠道原因。

---

## 第六步：重新 Routing

选择：

```
渠道分析 Skill
```

---

这就是动态 Agent。

---

# 12. 与你的竞品策略 Agent 对应

你的代码：

## 意图识别

```python
recognize_intent()
```

对应：

Intent Recognition。


---

## Skill 注册表

```python
SKILL_REGISTRY
```

对应：

Skill Router。


---

## Skill

例如：

```python
compare_channels()

calculate_target_price()
```

对应：

业务能力封装。


---

## Tool

例如：

```python
load_competitor_data()
```

对应：

原子执行能力。


---

你的项目架构：

```
用户问题

↓

Intent Recognition

↓

Skill Selection

↓

Tool调用

↓

返回结果
```

已经是简化版 Agent。

---

# 13. 标准复述版本

> Routing 是 Agent 根据用户目标和任务状态选择合适 Skill、Tool 或 Workflow 的能力。Planning 负责决定下一步应该做什么，而 Routing 负责决定由哪个能力完成。企业 Agent 通常不会让模型直接面对大量 Tool，而是通过 Skill 层封装业务能力，再由 Routing 根据任务动态选择执行路径。

---

# 14. 核心记忆

```
Planning：
下一步做什么？

Routing：
交给谁做？

Skill：
业务能力

Tool：
具体动作

Static Routing：
一次决定路径

Dynamic Routing：
根据反馈不断调整路径
```

---

# 15. 今日 Agent 学习总结

今天完成：

## Agent 架构

```
Model
Orchestrator
Planning
Memory
Knowledge
Tool
Skill
Workflow
Harness
Evaluation
```

---

## 信息管理

```
Prompt：
任务要求

Memory：
长期经验

Knowledge：
外部知识

State：
当前进度

Context：
模型当前看到的信息
```

---

## Agent 决策能力

```
Planning：
规划行动

Reasoning：
分析判断

ReAct：
思考-行动-观察

Routing：
选择能力
```

---

## 工程设计原则

```
确定问题 → Workflow

不确定问题 → Agent


固定部分流程

动态部分决策


Skill封装业务

Tool执行动作
```
