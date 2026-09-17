---
type: 概念
area: AI与实习
status: active
up: "[[02-AI与实习地图]]"
---

# Harness

## Harness 原词是什么意思？

Harness 原本指马具、安全带、挽具：

> 把一个有力量的对象固定、连接并控制起来，使它能够安全地做事。

放到 AI 里，可以理解为：

> **包裹在模型外面，使模型能够作为 Agent 运行的一整套控制和执行系统。**

**Anthropic 将 Agent Harness 或 Scaffold 描述为**
让模型能够成为 Agent 的系统：它负责处理输入、编排工具调用并返回结果。
**OpenAI 则将 Harness 描述为**：模型周围的控制层，管理 Agent 循环、模型调用、工具路由、审批、追踪和故障恢复。[![](https://www.google.com/s2/favicons?domain=https://www.anthropic.com&sz=128)Anthropic+1](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents?utm_source=chatgpt.com)

**Harness 是支撑 Agent 运行的外围控制和执行体系**，不只是安全或评估系统。它可能负责上下文管理、工具连接、权限、任务状态、日志、重试、沙箱、人工审批和评估支持。聪明模型只有大脑，而 Harness 为它提供可控的工作环境。

---

## Harness 通常包含什么？

一个比较完整的 Harness 可能包含：

```
1. Agent Loop
   模型思考 → 调用工具 → 查看结果 → 继续行动

2. Tool Routing
   决定怎样连接和执行不同工具

3. Context Management
   管理对话、资料和任务状态

4. Permissions
   控制 Agent 可以访问什么、修改什么

5. Guardrails
   检查输入、输出和工具调用是否安全合规

6. Approvals
   重要操作前要求人工确认

7. Tracing / Logs
   记录模型做过什么、调用了什么工具

8. Error Handling
   超时、错误、重试和恢复

9. Sandbox
   在隔离环境中执行代码和文件操作

10. Evaluation Support
   留存运行结果，方便测试和比较版本
```
最终关系：
```
                    ┌── Skill A ── Tool 1、Tool 2
用户目标 → Agent ──┼── Skill B ── Tool 3
                    └── Skill C ── Tool 4
                       │
                    Workflow
                       │
        Harness 包围并支撑整个运行过程
```

一句话记忆agent系统：
**Tool 是工具，Skill 是方法，Workflow 是路线，Agent 是执行与决策者，Harness 是运行和控制环境**
