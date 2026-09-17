---
title: LangChain、LangGraph、Workflow 与 Agent
type: 概念
area: AI与实习
up: "[[02-AI与实习地图]]"
date: 2026-07-16
status: evergreen
learning_status: 已学习
tags:
  - LangChain
  - LangGraph
  - Workflow
  - Agent
  - AI-Agent
---

# LangChain、LangGraph、Workflow 与 Agent

> [!summary] 一句话总结
> **LangChain是用于开发大模型应用和Agent的软件框架，LangGraph是用于编排有状态Workflow和Agent的底层运行框架；Workflow和Agent是系统架构，而LangChain和LangGraph是实现这些架构的工具。**

## 1. LangChain是什么？

LangChain是一个用于开发大模型应用和Agent的**软件框架。**

它提供的常见组件包括：

- 大模型连接
- Tool定义与调用
- 消息管理
- 检索器
- Agent Loop
- 常见Agent架构

LangChain不是Agent本身，而是用于构建Agent和其他大模型应用的开发工具。

## 2. LangGraph是什么？

LangGraph是一个用于构建、管理和运行有状态Workflow与Agent的底层编排框架。

它主要包含三个核心概念：

### State

记录应用当前的状态和中间结果。

### Node

执行具体工作的节点，例如：

- 查询数据库
- 运行Python
- 调用大模型
- 检索资料
- 人工审核

### Edge

决定一个节点执行结束后，下一步进入哪个节点。

Edge可以是固定连接，也可以根据State动态选择。

## 3. Workflow与Agent的判断标准

### Workflow

执行路径提前确定。

```text
读取数据
→ 计算指标
→ 生成摘要
→ 人工审核
```

即使使用大模型，只要整体路径固定，仍然更接近Workflow。

### Agent

系统根据**用户目标、当前状态和中间结果，动态决定**下一步。

```text
发现销量异常
→ 判断异常来源
→ 选择分析SKU、渠道或区域
→ 根据结果继续调用Tool
→ 信息不足时追问用户
```

Agent的关键不是“会理解”，而是：

> 根据中间结果动态选择行动和执行路线。

## 4. LangChain和LangGraph的关系

当前LangChain的Agent构建在LangGraph之上。

可以理解为：

```text
LangChain
→ 提供较高层的模型、Tool和Agent组件

LangGraph
→ 提供状态、节点、条件分支和运行控制
```

LangChain适合较快构建常见Agent。

LangGraph适合更精细地控制：

- 状态
- 分支
- 循环
- 人工介入
- 长任务运行
- 故障恢复

## 5. 商业分析案例

系统包含以下节点：

```text
理解需求
查询销量
分析SKU
分析渠道
RAG检索资料
生成报告
人工审核
```

### 固定路线

```text
理解需求
→ 查询销量
→ 分析SKU
→ 分析渠道
→ 检索资料
→ 生成报告
```

属于Workflow。

### 动态路线

```text
查询销量
→ 根据异常类型选择分析维度
→ 根据分析结果决定是否继续检索
→ 信息不足时追问用户
→ 生成报告
```

更接近Agent。

## 6. 三个重要结论

```text
使用LangChain
≠
自动做出了Agent

构建Agent
≠
必须使用LangChain

没有使用LangChain
≠
不能实现Agent
```

使用普通Python也可以自己实现Agent Loop：

```text
调用模型
→ 模型选择Tool
→ 执行Tool
→ 返回Tool结果
→ 模型继续判断
→ 直到任务完成
```

LangChain的价值是帮助开发者更方便地连接模型、Tool、检索和Agent循环。

## 7. 可直接复述的标准表述

> LangChain是用于开发大模型应用和Agent的软件框架，提供模型、Tool、检索和Agent Loop等组件。LangGraph则更加偏向底层的状态和流程编排，可以使用节点、状态和条件边构建固定Workflow或动态Agent。Workflow和Agent是系统架构，LangChain和LangGraph是实现这些架构的工具。
