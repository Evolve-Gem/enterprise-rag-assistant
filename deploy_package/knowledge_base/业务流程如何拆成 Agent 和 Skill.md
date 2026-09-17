---
type: 方法
area: AI与实习
up: "[[02-AI与实习地图]]"
tags:
  - AI-Agent
  - Skill
  - 商业分析
  - 业务流程
status: active
learning_status: 学习中
date: 2026-07-13
---
**从具体业务问题出发，用最简单可靠的技术完成一个小闭环，再通过 Evaluation 和真实反馈持续调优，而不是一开始追求一个大而全的 Agent。**
# 一、Agent 与 Skill 的区别

Agent 负责：

- 理解用户需求
- 拆解任务
- 选择 Skill
- 组织执行顺序
- 整理最终结果

Skill 负责：

- 完成一个具体、稳定、可复用的业务能力

一句话总结：
**1、Skill 是一个可被 Agent 调用的、边界清晰、输入输出明确、能够稳定完成某项任务的==能力单元==。**

**2、官方定义：OpenAI 对 Agent Skills 的描述是：把任务相关的说明、资源和可选脚本打包起来，使 Agent 能够更可靠地执行特定流程；当前开放标准下，Skill 通常由 `SKILL.md` 和可选资源组成**

**3、更准确的说法：Skill 是一个业务能力包，Markdown 是说明和流程，代码是它可选的执行组件。**
Agent 负责安排，Skill 负责执行。

# 二、Skill 的基本组成

1. 名称
2. 描述
3. 触发场景
4. 输入字段
5. 执行逻辑
6. 业务规则
7. 输出格式
8. 错误处理
9. 人工复核点

# 三、业务流程拆解方法

触发点
→ 输入
→ 确定性处理
→ 业务规则
→ 结构化输出
→ 错误处理
→ 人工复核

# 四、重要原则

- Python 负责计算事实
- 规则负责判断状态
- 大模型负责理解与表达
- 人工负责最终确认

# 五、好的 Skill 特征

- 单一职责
- 输入明确
- 输出稳定
- 可以测试
- 可以复用
- 错误可定位

# 六、销售日报 Skill

输入：

- 区域
- 当前销售额
- 销售目标
- 上一期销售额

处理：

- 输入校验
- 计算达成率
- 计算环比
- 判断异常
- 生成日报

输出：

- 执行状态
- 指标结果
- 异常提醒
- 日报文本
- 人工复核标记
# 七、Skill 与 Python 模块化编程的关系

## 核心理解

Skill 和 Python 模块化编程非常相似。

模块化编程强调：

一个函数、类或 Python 文件只负责一种功能，由 main.py 统一调用。

Skill 强调：

将一个业务能力封装成输入明确、输出稳定、可以被 Agent 调用的能力单元。

## 二者区别

模块是技术视角的代码封装。

Skill 是业务视角的==能力封装==。

## Skill 的可能组成

- SKILL.md：说明书、触发条件、执行步骤和输出要求
- main.py：统一执行入口
- 其他 .py 文件：内部功能模块
- prompt.md：大模型提示词
- config.json：配置
- templates：输出模板
- tests：测试代码
- 比如说：
-sales_report_skill/
├── SKILL.md
├── main.py
├── validators.py
├── report_template.md
└── example_data.xlsx

## 一句话记忆

Agent 负责安排任务。

Skill 负责完成具体业务能力。

Python 函数负责执行具体动作。

SKILL.md 负责告诉 Agent 何时以及如何使用这项能力。


一个真正的skill：
# 我最后告诉你一个真正企业里的架构

你以后大概率会接触到的是：

```
Agent
│
├── Prompt
│
├── Workflow
│
├── Skills
│     │
│     ├── Tool1
│     ├── Tool2
│     ├── Tool3
│     └── Tool4
│
├── Knowledge
│
└── Evaluation Harness
```

这里：

- **Agent**：负责决策和编排。
    
- **Skill**：封装一类能力，决定什么时候调用、怎么组织多个步骤。
    
- **Tool**：执行一个明确、原子化的动作，比如查数据库、调用 API、生成图表。
    
- **Knowledge**：提供知识和数据来源。
    
- **Harness**：持续评测整个 Agent 是否真的做好了。
