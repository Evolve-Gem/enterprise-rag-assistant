---
title: Prompt、Context、Memory 的区别与关系
type: 概念
area: AI与实习
up: "[[02-AI与实习地图]]"
date: 2026-07-14
status: evergreen
learning_status: 已掌握
tags:
  - AI-Agent
  - Prompt
  - Context
  - Memory
  - 大模型基础
---
# Prompt、Context、Memory、State、Knowledge 在 Agent 中的信息管理体系

> [!summary] 一句话总结
> **Prompt 决定任务如何被描述，Memory 保存长期可复用的信息，Knowledge 提供外部专业知识，State 记录当前任务执行状态，Context 则是模型在当前一次推理中实际能够看到的信息集合。Agent 的核心工作，就是从不同信息来源中选择必要内容，组织 Context，再驱动模型完成任务。**



---

# 1. Prompt｜提示词

## 权威定义

Prompt 是提供给模型、用于引导模型理解并完成当前任务的**用户输入内容。**

它用于告诉模型：

- 要完成什么任务；
- 使用什么背景；
- 遵守什么限制；
- 输出什么格式；
- 什么结果算完成。

---

## 它在 Agent 系统中是什么？

Prompt 是：

> 用户和系统向 Agent 提出的任务说明书。

它负责定义目标和要求。

---

## 示例

简单 Prompt：

> 分析竞品 A。

信息不足。

更完整：

> 分析竞品 A 最近四周销量变化，从区域、渠道和 SKU 三个维度展开。区分数据事实和原因假设，不得编造数据，按照“核心结论—数据证据—待验证事项”输出。

---

## Prompt 主要解决什么？

Prompt 解决：

1. 做什么？
2. 为什么做？
3. 根据什么做？
4. 如何输出？
5. 什么标准算完成？

因此：

> Agent 输出不好时，不能只修改 Prompt，需要检查整个系统链路。

---

# 2. Memory｜记忆

## 权威定义

Memory 是 Agent 用于保存过去信息，并在未来任务中按需重新利用的机制。

关键词：

- 长期保存；
- 跨任务复用；
- 经验积累。

---

## 它在 Agent 系统中是什么？

Memory 是：

> Agent 的长期经验系统。

类似人的：

- 工作习惯；
- 经验；
- 偏好；
- 历史知识。

---

## Memory 可以保存什么？

例如：

用户偏好：

```text
喜欢结构化回答
喜欢先结论后分析
```

业务规则：

```text
销量指标定义方式
区域划分规则
```

历史经验：

```text
过去竞品分析采用：
销量 → SKU → 渠道 → 原因假设
```

---

## Memory 通常如何实现？

大模型本身不会永久记忆。

通常依赖外围系统：

- 数据库；
- 文件；
- Session 存储；
- 用户画像系统；
- 向量数据库。

---

## Memory 与 Context 的关系

核心：

```text
Memory
（长期保存）

↓

筛选相关信息

↓

Context
（本次提供给模型）
```

因此：

> Memory 负责保存，Context 负责当前使用。

---

# 4. Knowledge｜知识库

## 权威定义

Knowledge 是 Agent 可以访问的**外部知识资源**，用于提供事实信息、专业知识和业务资料。

---

## 它在 Agent 系统中是什么？

Knowledge 是：

> Agent 的外部知识来源。

例如企业：

- 产品文档；
- 历史报告；
- FAQ；
- 业务规则；
- 市场资料。

---

## Knowledge 和 Memory 的区别

| | Knowledge | Memory |
|-|-|-|
| 来源 | 企业提供 | Agent/用户历史积累 |
| 内容 | 专业事实 | 经验偏好 |
| 作用 | 告诉 AI 外部世界 | 让 AI 记住过去 |
| 示例 | 产品手册 | 用户喜欢的报告格式 |

---

# 5. RAG 与 Knowledge 的关系

## RAG 是什么？

RAG（Retrieval Augmented Generation）是一种技术模式。

它通过：

```text
检索外部知识

↓

增强模型输入

↓

生成回答
```

提高模型回答的准确性。

---

## RAG 在 Agent 中的位置

```text
Knowledge

↓

RAG 检索

↓

相关资料片段

↓

Context

↓

Model
```

---

## 为什么 RAG 不是 Memory？

简单理解：

RAG：

> AI 临时查资料。

Memory：

> AI 长期积累经验。


例如：

产品介绍 PDF：

属于 Knowledge。

分析师喜欢什么格式：

属于 Memory。

---

# 6. State｜状态

## 权威定义

State 是 Agent 在当前任务执行过程中，用于记录任务进展、已有结果和当前环境状态的信息。

---

## 它在 Agent 系统中是什么？

State 是：

> Agent 当前任务的工作进度表。

---

## 示例

竞品分析 Agent：

```json
{
"任务":"分析竞品A增长原因",

"已完成":[
"销量查询",
"增长趋势分析"
],

"发现":
"华东区域增长明显",

"下一步":
"分析渠道变化"
}
```

---

## State 与 Memory 的区别

| | State | Memory |
|-|-|-|
| 时间 | 当前任务 | 过去经验 |
| 生命周期 | 短期 | 长期 |
| 作用 | 推进当前任务 | 改善未来任务 |

一句话：

> State 记录现在做到哪里，Memory 保存过去学到了什么。

---

# 7. Context｜上下文

## 权威定义

Context 是**大模型**在当前一次生成过程中，**实际能够看到**和参考的信息集合。

---

## 它在 Agent 系统中是什么？

Context 是：

> 模型当前办公桌上的全部材料。

---

## Context 可能包括

- System Instructions；
- 用户 Prompt；
- 当前任务 State；
- 相关 Memory；
- RAG 检索结果；
- Knowledge 片段；
- Tool 执行结果；
- 历史对话。

---

## 注意

不是所有 Memory 和 Knowledge 都会进入 Context。

例如：

企业知识库：

10000份文档。

用户问：

> 分析竞品 A。

真正进入 Context 的可能只有：

- 竞品 A 历史报告；
- 最近销量数据；
- 相关市场资料。

---

# 8. Context Window｜上下文窗口

## 定义

Context Window 是模型一次能够接收的**最大 Context 容量。**

通常使用 Token 衡量。

---

区别：

| 概念 | 含义 |
|-|-|
| Context | 当前实际给模型的信息 |
| Context Window | 模型最多能接收的信息量 |

---

## 为什么 Context 不是越多越好？

信息过多会导致：

- 重点被淹没；
- 无关信息干扰；
- 指令冲突；
- 成本增加；
- 响应变慢。

所以：

> Context Engineering 的核心不是提供更多信息，而是提供更正确的信息。

---

# 9. Agent 一次推理的信息流

完整流程：

```text
用户目标

↓

Prompt

+

State

+

相关 Memory

+

RAG 检索 Knowledge

+

Tool Results

↓

组成 Context

↓

Model 推理

↓

产生行动

↓

更新 State

↓

必要信息写入 Memory
```

---

# 10. 商业分析 Agent 案例

任务：

> 分析竞品 A 最近销量下降原因。


## Prompt

规定：

- 时间范围；
- 分析维度；
- 输出格式；
- 禁止编造。


## Knowledge

提供：

- 产品资料；
- 历史报告；
- 市场信息。


## Memory

保存：

- 分析师习惯；
- 指标口径；
- 历史经验。


## State

记录：

```text
已完成销量查询

发现华南下降明显

下一步分析渠道
```

## Context

模型本轮真正看到：

- 用户任务；
- State；
- 相关资料；
- 工具结果；
- 输出要求。

---

# 11. 如何定位 Agent 输出问题？

## Prompt 问题

表现：

- 格式错误；
- 没遵守要求；
- 输出角度错误。


解决：

优化任务描述。

---

## Context 问题

表现：

- 缺少关键资料；
- 检索错误；
- 信息冲突。

解决：

优化上下文构造。

---

## Memory 问题

表现：

- 忘记长期要求；
- 使用错误历史经验。

解决：

优化记忆管理。

---

## Knowledge 问题

表现：

- 企业资料缺失；
- 数据过期。

解决：

更新知识库。

---

# 12. 标准复述版本

> 在企业 Agent 中，不同信息承担不同角色。Prompt 负责描述当前任务，Memory 保存长期可复用经验，Knowledge 提供外部业务知识，State 记录当前任务执行状态，而 Context 是模型本次推理真正接收到的信息集合。Agent 会根据当前目标，从 Memory、Knowledge、State 和 Tool 结果中选择必要信息，组织 Context，再驱动模型完成任务。

---

# 13. 核心记忆

```text
Prompt：
这次让 AI 做什么？

Memory：
过去哪些经验以后还能用？

Knowledge：
企业有哪些资料可以查？

State：
这次任务做到哪里？

Context：
模型现在真正看到什么？
```

---

## 相关笔记

- [[元气森林AI实习/AI agent学习/agent家族大杂烩|Tool、Skill、Workflow、Agent、Harness]]
- [[元气森林AI实习/AI agent学习/召回、Top K、Rerank 与 RAG 检索链路|RAG 与信息检索链路]]
- [[元气森林AI实习/AI agent学习/Evaluation、Evaluation Harness 与闭环调优|Evaluation 与 Agent 闭环优化]]
