---
type: 概念
area: AI与实习
status: active
up: "[[02-AI与实习地图]]"
created: 2026-07-20
---

# MCP（Model Context Protocol）在企业 Agent 中的作用

> [!summary] 一句话总结
> **MCP（Model Context Protocol）是一种用于标准化连接大模型应用与外部工具、数据源和服务的开放协议。它不是 Tool，也不是 Agent，而是 Agent 连接外部世界的标准化通信方式，让模型能够发现、理解和调用外部能力。**

---

# 1. MCP 是什么？

## 权威定义

MCP（Model Context Protocol，模型上下文协议）是一种**开放协议**，用于**标准化**大模型应用与外部数据源、工具和服务之间的**连接方式**，使 AI 应用能够通过**统一接口**访问外部能力。


一句话定义：

> **MCP 是 AI 应用与外部工具之间的一套标准通信协议。**

关键词：

- Protocol（协议）
- Standardization（标准化）
- External Resources（外部资源）

---

# 2. 名称拆解

## Model

指：

大语言模型。

例如：

- GPT
- Claude
- DeepSeek


负责：

- 理解语言；
- 推理；
- 生成内容。

---

## Context

指：

模型完成任务时需要的信息。

例如：

- 用户问题；
- 文件；
- 数据；
- Tool 返回结果；
- 企业知识。

---

## Protocol

指：

不同系统之间通信的规则。

类似：

- HTTP；
- TCP/IP。

---

因此：

MCP：

> 是让模型以统一方式连接外部资源的一套协议。

---

# 3. 为什么需要 MCP？

## 没有 MCP 时

如果 Agent 需要连接：

- 数据库；
- 飞书；
- GitHub；
- CRM；
- 文件系统；

开发者需要分别开发接口：

```
数据库接口

↓

飞书接口

↓

GitHub接口

↓

文件接口
```

不同系统：

- 接口不同；
- 参数不同；
- 认证方式不同；
- 调用方式不同。

导致：

每开发一个 Agent，都需要重新连接外部系统。

---

# 4. MCP 解决什么问题？

MCP 解决：

> AI 应用连接外部能力缺少统一标准的问题。

---

没有 MCP：

```
Agent

↓

各种不同接口

↓

数据库
飞书
文件
CRM
```

---

有 MCP：

```
Agent

↓

MCP 标准协议

↓

MCP Server

↓

数据库
飞书
文件
CRM
```

---

因此：

MCP 的核心价值：

> 让 Agent 可以通过统一方式发现、理解和调用外部能力。

---

# 5. 为什么 MCP 类似 AI 世界的 USB-C？

USB-C 解决：

不同设备接口不统一的问题。

以前：

- Lightning；
- Micro USB；
- USB-A。

后来：

统一：

USB-C。

---

MCP 类似：

以前：

每个 Agent：

自己连接：

- 数据库；
- 文件；
- SaaS 系统。

后来：

统一：

MCP。

---

注意：

MCP 不是创造新的能力。

它只是：

> 统一连接能力的方式。

---

# 6. MCP 在 Agent 架构中的位置

传统 Agent：

```
用户

↓

Agent

↓

Planning

↓

Routing

↓

Skill

↓

Tool

↓

外部系统
```

加入 MCP：

```
用户

↓

Agent

↓

Planning

↓

Routing

↓

Skill

↓

MCP Client

↓

MCP Server

↓

外部资源
```

---

注意：

MCP 不替代：

- Agent；
- Skill；
- Tool。

它提供：

连接层。

---

# 7. MCP 的三个核心组成

## 7.1 MCP Host

### 定义

MCP Host 是承载 AI 应用并管理 MCP 连接的宿主程序。

---

例如：

- Claude Desktop；
- IDE；
- Agent 应用。


理解：

> AI 员工所在的办公室。

---

## 7.2 MCP Client

### 定义

MCP Client 是运行在 Host 中，负责与 MCP Server 通信的客户端组件。

负责：

- 发现能力；
- 请求资源；
- 调用工具。

---

理解：

> 办公室里的联系人。

---

## 7.3 MCP Server

### 定义

MCP Server 是通过 MCP 协议向 AI 应用提供工具、数据和资源的服务端。

---

例如：

数据库 MCP Server：

提供：

```
查询销量

读取表结构

执行SQL
```

---

文件 MCP Server：

提供：

```
读取文件

搜索文件

修改文件
```

---

结构：

```
MCP Host

↓

MCP Client

↓

MCP Server

↓

外部资源
```

---

# 8. MCP 与 Tool 的区别

这是最容易混淆的地方。

## Tool

定义：

Tool 是 Agent 可以执行的具体能力。

例如：

```
查询销量

读取文件

计算增长率
```

---

## MCP

定义：

MCP 是让 Agent 发现和调用这些能力的标准协议。

---

关系：

```
MCP

↓

暴露 Tool

↓

Agent 调用 Tool

↓

Tool 执行动作
```

---

一句话：

> Tool 是能力本身，MCP 是连接能力的方式。

---

# 9. MCP 与 API 的区别

很多人会问：

> MCP 不就是 API 吗？

不是。

---

## API

解决：

> 软件之间如何通信。

例如：

程序调用：

```
GET /sales
```

---

## MCP

解决：

> AI Agent 如何理解、发现和调用外部能力。

---

区别：

| | API | MCP |
|-|-|-|
| 面向 | 程序 | AI Agent |
| 解决 | 通信问题 | 能力连接问题 |
| 核心 | 请求和返回 | 能力描述和调用 |
| 使用者 | 开发者 | Agent |

---

更准确：

> API 面向程序调用，MCP 面向 Agent 能力调用。

---

# 10. MCP Server 提供什么？

MCP Server 可以提供：

## Tool

例如：

```
查询销量

搜索数据库

发送消息
```

---

## Resource

例如：

```
文件

文档

数据库内容
```

---

## Prompt 模板

例如：

```
标准分析模板

报告生成模板
```

---

# 11. 商业分析 Agent 案例

假设：

元气森林需要：

竞品分析 Agent。

需要连接：

- 马上赢数据；
- 尼尔森数据；
- 企业知识库；
- 飞书文档。


---

## 没有 MCP

开发：

```
销量接口

↓

市场数据接口

↓

知识库接口

↓

飞书接口
```

每个系统单独适配。

---

## 有 MCP

建立：

```
马上赢 MCP Server

尼尔森 MCP Server

知识库 MCP Server

飞书 MCP Server
```

Agent：

通过 MCP：

发现：

```
有哪些数据

有哪些工具

如何调用
```

然后：

根据任务选择能力。

---

# 12. MCP 与 Agent 的关系

关系：

```
Agent

负责：
理解目标、规划、决策


MCP

负责：
连接外部能力


Tool

负责：
实际执行动作
```

---

类比：

```
Agent = 员工

Tool = 工具

MCP = 标准化工具柜
```

---

# 13. 常见误区

## 误区1：

MCP = Agent

错误。

MCP 只是连接协议。

---

## 误区2：

MCP = Tool

错误。

Tool 是能力。

MCP 是提供能力的标准方式。

---

## 误区3：

有 MCP 就不需要 API

错误。

MCP 底层仍可能通过 API、数据库等方式实现。

---

# 14. 标准复述版本

> MCP（Model Context Protocol）是一种用于标准化连接大模型应用与外部工具、数据源和服务的开放协议。它类似 AI 世界的 USB-C，使 Agent 能够通过统一方式发现、理解和调用外部能力。MCP 不替代 Tool，而是提供 Tool 和外部资源接入 Agent 的标准方式。API 解决软件通信问题，而 MCP 更关注 AI Agent 如何连接和使用外部能力。

---

# 15. 核心记忆

```
Agent：
负责目标理解和决策


Planning：
决定下一步做什么


Routing：
选择能力


Skill：
业务能力封装


Tool：
执行具体动作


MCP：
连接外部能力的标准协议
```

---

# 16. 相关笔记

- [[元气森林AI实习/AI agent学习/企业级agent架构|Agent 架构总览]]
- [[元气森林AI实习/AI agent学习/区分prompt、context、memory|Prompt、Context、Memory、State、Knowledge 在 Agent 中的信息管理体系]]
- [[元气森林AI实习/AI agent学习/Planning、Reasoning、ReAct 与 Workflow 的区别]]
- [[元气森林AI实习/AI agent学习/Routing、Intent Recognition 与 Skill 、 Tool Selection|Routing、Intent Recognition 与 Skill、Tool Selection]]
- [[元气森林AI实习/AI agent学习/Evaluation、Evaluation Harness 与闭环调优|Evaluation 与 Agent 闭环优化]]
