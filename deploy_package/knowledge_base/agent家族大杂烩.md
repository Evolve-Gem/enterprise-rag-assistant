---
type: 概念
area: AI与实习
status: evergreen
up: "[[02-AI与实习地图]]"
---

# Tool、Skill、Workflow、Agent、Harness大杂烩

# Tool

Agent 可以调用的外部能力。

例如：

- 搜索
- 数据库
- Python
- 文件读取
- 邮件

Tool 是 Agent 的手和眼睛。

# Skill

针对一类任务封装的能力包，包括：

- 适用场景
- 操作说明
- 业务知识
- 工作流程
- 输出模板
- 可选代码和资源

Skill 告诉 Agent 一件事应该怎么做。

# Workflow

预先设计好的步骤和分支。

Workflow 是标准作业流程。

# Agent

理解用户目标，根据情况选择 Skill、Tool 或 Workflow，并完成任务。

Agent 是判断者和调度者。

# Harness

模型外面的运行与控制体系，可能包括：

- Agent Loop
- 上下文管理
- 工具路由
- 权限
- Guardrails
- 人工审批
- 日志与追踪
- 错误恢复
- 沙箱

# 一句话

Tool 是工具。
Skill 是方法。
Workflow 是路线。
Agent 是执行和决策者。
Harness 是运行与控制环境。

**Tool 是工具，Skill 是方法，Workflow 是路线，Agent 是执行与决策者，Harness 是运行和控制环境**

口述：
大模型本身更像一个聪明的大脑，但要让它在业务中真正完成任务，还需要一套外围能力。Tool 是它可以使用的工具，例如搜索、数据库和 Python；Skill 是针对某类任务沉淀的方法、说明和可选脚本；Workflow 是这些步骤的执行顺序；Agent 负责理解目标，并选择合适的 Skill 和 Tool；Harness 则是包裹在模型外面的运行和控制系统，负责上下文、权限、日志、错误处理和人工审批等。可以简单理解为：Tool 是工具，Skill 是工作方法，Workflow 是 SOP，Agent 是员工，Harness 是员工工作的整套组织和管理环境。
