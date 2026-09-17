---
title: MCP 与 CLI 对比：Agent 如何获得外部应用能力
aliases:
  - MCP与CLI
  - Agent外部工具接入
  - 飞书CLI与MCP
tags:
  - AI-Agent
  - MCP
  - CLI
  - Tool
  - Skill
  - 飞书
  - 企业AI
date: 2026-07-23
status: 已学习
---

# MCP 与 CLI 对比：Agent 如何获得外部应用能力

## 一、先说结论

通俗理解：

> **CLI 和 MCP 都可以帮助 Agent 获得调用外部应用的能力，让 Agent 不只会“思考和回答”，还能够进入飞书、GitHub、数据库等外部系统真正做事。**

但是两者在系统中的类别和层级不同：

> **CLI 是可以直接执行操作的工具；MCP 是让 Agent 标准化发现和调用外部工具的一套协议。**

一句话区分：

- **CLI：Agent 通过终端调用的具体工具。**
- **MCP：Agent 接入各种外部工具的统一接口标准。**

---

# 二、CLI 是什么？

## 2.1 权威定义

CLI 全称：

> **Command Line Interface**

中文：

> **命令行界面**

CLI 是一种通过输入命令操作软件或系统的交互方式。

例如：

```powershell
python app.py
git status
lark-cli base ...
```

这些都是通过 CLI 执行操作。

---

## 2.2 CLI 在 Agent 系统里是什么？

在 Agent 应用中，CLI 通常处于：

> **Tool 执行层**

它是 Agent 真正可以调用、并完成具体操作的工具。

例如飞书 CLI 可以把飞书开放 API 封装成一条条命令，让 Agent 能够：

- 读取飞书文档；
- 查询飞书多维表；
- 获取表格字段和记录；
- 搜索飞书消息；
- 调用日历；
- 返回 JSON 数据。

因此：

> **飞书 CLI 是一个把飞书开放 API 封装成终端命令的 Tool。**

它本身不是 Agent，也不是 AI。

---

## 2.3 Agent 如何使用 CLI？

以 Codex 读取飞书多维表为例：

```text
用户提出需求
    ↓
Codex 理解任务
    ↓
飞书 Skill 告诉 Codex 命令怎么使用
    ↓
Codex 在终端执行 lark-cli 命令
    ↓
lark-cli 携带用户授权调用飞书开放 API
    ↓
飞书返回真实数据
    ↓
CLI 输出 JSON
    ↓
Codex 继续分析数据
```

在这条链路中：

| 对象 | 系统角色 |
|---|---|
| Codex | Agent，决定下一步做什么 |
| 飞书 Skill | 业务能力和操作方法，告诉 Agent 怎么完成任务 |
| 飞书 CLI | Tool，真正执行读取操作 |
| OAuth 授权 | 身份和权限证明 |
| 飞书开放 API | 飞书对外提供的底层业务能力 |
| JSON | CLI 返回给 Agent 的结构化结果 |

---

# 三、MCP 是什么？

## 3.1 权威定义

MCP 全称：

> **Model Context Protocol**

中文：

> **模型上下文协议**

MCP 是一种让 AI 应用能够以统一方式连接外部工具、数据和系统的协议。

---

## 3.2 MCP 在 Agent 系统里是什么？

MCP 位于：

> **Agent 与外部 Tool 之间的工具接入层**

它不是某一个具体工具，而是一套约定：

- 外部系统有哪些工具；
- 每个工具叫什么；
- 工具需要什么参数；
- 工具返回什么结果；
- Agent 如何调用工具；
- 工具如何把结果返回 Agent。

例如，一个飞书 MCP Server 可以告诉 Agent：

```text
工具名称：read_bitable_records

作用：读取飞书多维表记录

输入参数：
- app_token
- table_id
- filter

输出：
- records
- page_token
- has_more
```

Agent 看见这些结构化说明后，就知道这个工具是什么、何时调用、参数怎么填写。

---

## 3.3 Agent 如何通过 MCP 使用飞书？

```text
用户提出需求
    ↓
Agent 理解任务
    ↓
Agent 从 MCP Server 发现可用工具
    ↓
Agent 调用飞书读取工具
    ↓
飞书 MCP Server 调用飞书开放 API
    ↓
飞书返回数据
    ↓
MCP Server 将结构化结果返回 Agent
    ↓
Agent 继续分析
```

其中：

| 对象 | 系统角色 |
|---|---|
| Agent Host | 运行 Agent 的应用，例如 Codex、Claude Desktop |
| MCP Client | Agent 应用中负责 MCP 通信的部分 |
| MCP Server | 向 Agent 暴露外部工具和资源 |
| Tool | MCP Server 提供的具体能力 |
| 飞书开放 API | 最终提供真实飞书数据 |
| OAuth | 控制用户身份和权限 |

---

# 四、CLI 与 MCP 的核心区别

| 对比维度 | CLI | MCP |
|---|---|---|
| 全称 | Command Line Interface | Model Context Protocol |
| 中文 | 命令行界面 | 模型上下文协议 |
| 它是什么 | 一个可以执行命令的工具或操作方式 | 一套 Agent 接入外部工具的标准协议 |
| 所处层级 | Tool 执行层 | Tool 接入与通信层 |
| 谁使用 | 人、脚本、Agent | 支持 MCP 的 AI 应用 |
| 调用方式 | 在终端执行命令 | 通过标准化 MCP 请求调用工具 |
| 工具发现方式 | 查看帮助文档、Skill 或命令说明 | MCP Server 主动暴露工具定义 |
| 输出方式 | JSON、文本、表格等 | 标准化工具响应 |
| 是否专门服务 AI | 不是，人也可以使用 | 主要面向 AI 应用和 Agent |
| 是否依赖终端 | 通常需要 | 不一定，可以是本地或远程服务 |
| 是否是具体工具 | 是或承载具体工具 | 不是，它是连接工具的协议 |
| 最终是否调用 API | 通常会 | MCP Server 通常也会调用 API |
| 适合场景 | 快速验证、个人使用、终端自动化 | 多 Agent、多工具、平台化和标准化接入 |

---

# 五、为什么 Codex 不用 MCP，也能连接飞书？

因为 Codex 具备一个重要能力：

> **Codex 可以操作电脑终端。**

只要电脑中安装了飞书 CLI，并完成用户授权，Codex 就能直接在终端中执行命令。

当前实际链路是：

```text
Codex Agent
    ↓
操作 Shell / 终端
    ↓
飞书 CLI
    ↓
OAuth 用户授权
    ↓
飞书开放 API
    ↓
飞书真实数据
```

因此，Agent 连接外部应用并不一定必须使用 MCP。

真正不可缺少的是：

```text
外部系统提供的 API
+
身份认证
+
权限授权
```

CLI 和 MCP 只是使用这些 API 能力的不同路径。

---

# 六、CLI 路径与 MCP 路径对比

## 6.1 CLI 路径

```text
Agent
  ↓
终端命令
  ↓
CLI 工具
  ↓
外部应用 API
  ↓
真实数据
```

例如：

```text
Codex
  ↓
lark-cli
  ↓
飞书开放 API
  ↓
多维表记录
```

特点：

- 路径直接；
- 容易安装和测试；
- 可以直接观察命令和返回结果；
- 适合 Codex、Claude Code 等能够控制终端的 Agent；
- 适合个人和小规模快速验证。

---

## 6.2 MCP 路径

```text
Agent
  ↓
MCP Client
  ↓
MCP Server
  ↓
外部应用 API
  ↓
真实数据
```

例如：

```text
Codex / Claude
  ↓
飞书 MCP Server
  ↓
飞书开放 API
  ↓
多维表记录
```

特点：

- 工具定义更加标准；
- Agent 可以自动发现工具；
- 输入参数和输出结构更加明确；
- 不同 AI 应用可以共用一套 MCP Server；
- 更适合企业平台化和多工具管理。

---

# 七、飞书 Skill、CLI、MCP、API 的关系

这是最容易混淆的一部分。

## 7.1 飞书 Skill

Skill 是：

> **Agent 完成一类飞书任务的方法、规则和操作流程。**

它可能包含：

- 应该调用哪些工具；
- 命令怎么写；
- 参数如何填写；
- 如何处理分页；
- 如何理解返回字段；
- 哪些操作存在风险；
- 写操作前是否需要人工确认。

Skill 通常不直接提供数据，而是组织 Agent 如何完成任务。

---

## 7.2 飞书 CLI

CLI 是：

> **真正执行飞书读取、搜索或写入操作的 Tool。**

它负责：

- 构造 API 请求；
- 携带授权信息；
- 调用飞书 API；
- 获取数据；
- 将结果输出为 JSON。

---

## 7.3 飞书 MCP

MCP 是：

> **让 Agent 以统一形式发现和调用飞书工具的接入协议。**

MCP Server 可以把“读取文档”“读取多维表”“搜索消息”等能力封装成标准工具。

---

## 7.4 飞书开放 API

API 是：

> **飞书官方真正对外提供数据和操作能力的底层接口。**

无论通过 CLI、MCP，还是自己写 Python，最后通常都要访问飞书开放 API。

---

# 八、三种常见的飞书接入方式

## 方式一：Agent 调用 CLI

```text
Agent
  ↓
CLI
  ↓
飞书 API
```

适合：

- Codex；
- Claude Code；
- 本地开发；
- 快速验证；
- 个人工作流。

---

## 方式二：Agent 调用 MCP Server

```text
Agent
  ↓
MCP Server
  ↓
飞书 API
```

适合：

- 多个 Agent 共用飞书能力；
- 企业统一工具平台；
- 标准化工具注册；
- 集中管理权限；
- 远程部署。

---

## 方式三：程序直接调用 SDK 或 API

```text
Python 程序
  ↓
飞书 SDK / HTTP 请求
  ↓
飞书 API
```

适合：

- 正式业务系统；
- 自动化 Workflow；
- 后端服务；
- 定时任务；
- 高度自定义的数据处理。

---

# 九、具体案例：读取“能量提振饮料”赛道数据

## 9.1 当前 CLI 方式

```text
用户：读取能量提振饮料赛道及其关联产品
    ↓
Codex 判断需要先读取赛道表
    ↓
飞书 Skill 提供操作方法
    ↓
Codex 执行 lark-cli 命令
    ↓
飞书 CLI 调用飞书 API
    ↓
返回赛道记录和关联记录 ID
    ↓
Codex 继续读取产品、二级赛道和需求空间
    ↓
返回 JSON 数据
```

当前真实验证结果包括：

- 1 条赛道；
- 30 条产品；
- 7 条二级赛道；
- 2 条需求空间。

这证明当前链路已经能够完成：

```text
飞书授权
→ 多维表读取
→ 关联字段解析
→ 关联记录继续查询
→ JSON 输出
```

---

## 9.2 假设使用 MCP

```text
用户：读取能量提振饮料赛道及其关联产品
    ↓
Agent 发现 MCP Server 中的相关工具
    ↓
调用 search_track
    ↓
调用 list_related_products
    ↓
调用 list_related_demand_spaces
    ↓
MCP Server 请求飞书 API
    ↓
返回结构化结果
```

最终获得的数据可能相同，只是中间接入方式不同。

---

# 十、CLI 和 MCP 谁更好？

不能简单判断谁更高级。

## 当前阶段，CLI 更适合

原因：

- 已经安装成功；
- 已经完成飞书 OAuth 授权；
- Codex 可以直接操作终端；
- 返回 JSON 适合继续分析；
- 调试过程直观；
- 不需要额外开发 MCP Server；
- 可以快速支持当前赛道看板任务。

## 长期平台化，MCP 更适合

当需要以下能力时，可以考虑 MCP：

- ChatGPT、Codex、Claude 等多个 Agent 共用工具；
- 统一管理飞书、数据库、GitHub 等工具；
- Agent 自动发现工具；
- 工具参数标准化；
- 集中权限控制；
- 统一日志和审计；
- 构建企业级 Agent 基础设施。

---

# 十一、一个非常重要的认识

以前容易产生的错误理解是：

> 外部应用连接飞书必须依靠 MCP。

更准确的说法是：

> **外部应用连接飞书，底层依靠飞书开放 API、身份认证和权限授权；CLI、MCP、SDK 是使用这些能力的不同接入方式。**

所以：

```text
飞书开放 API
    ↑
CLI / MCP Server / Python SDK
    ↑
Agent 或业务程序
```

真正提供飞书能力的是 API。

CLI 和 MCP 是不同形式的桥梁。

---

# 十二、与 Agent、Skill、Tool 的对应关系

根据我们已经建立的理解：

> Agent 决定做什么，Skill 组织如何完成一项业务能力，Tool 执行具体原子操作。

那么当前飞书 CLI 系统可以表示为：

```text
用户目标
    ↓
Codex Agent
决定下一步行动
    ↓
飞书 Skill
组织如何查询飞书数据
    ↓
lark-cli Tool
执行具体读取命令
    ↓
飞书开放 API
提供真实业务数据
```

如果换成 MCP：

```text
用户目标
    ↓
Agent
决定调用什么工具
    ↓
MCP
标准化发现和调用工具
    ↓
飞书 MCP Server 中的 Tool
执行飞书操作
    ↓
飞书开放 API
提供真实数据
```

注意：

> MCP 不等于 Tool，MCP 是 Tool 的标准化接入方式。

---

# 十三、通俗类比

可以把 Agent 惽成一个老板。

## CLI

老板直接找到一名会操作终端的执行人员，说：

> “运行这条命令，帮我把飞书表读回来。”

CLI 是：

> **可以直接干活的执行工具。**

## MCP

老板进入一个标准化工具大厅。

大厅会告诉老板：

- 有哪些工具；
- 每个工具能做什么；
- 需要填写什么参数；
- 调用后会返回什么。

MCP 是：

> **让老板统一认识、选择和调用不同工具的服务标准。**

---

# 十四、最终复述

## 最简单的版本

> CLI 和 MCP 都可以让 Agent 获得外部应用能力。

## 更准确的版本

> CLI 是 Agent 能够通过终端直接调用的具体工具；MCP 是 Agent 标准化发现和调用外部工具的一套协议。

## 完整版本

> 外部系统的真实能力来自 API。CLI 把 API 封装成可执行的终端命令，MCP 把外部工具封装成 Agent 可以统一发现和调用的标准服务。两者都能扩展 Agent 的行动边界，但所在层级和实现方式不同。

---

# 十五、我的当前理解

我当前使用的是：

```text
我
↓
Codex Agent
↓
飞书 Skill
↓
lark-cli Tool
↓
OAuth 用户授权
↓
飞书开放 API
↓
元气森林飞书真实数据
```

这套系统目前已经帮助我读取：

- 赛道表；
- 产品明细表；
- 二级赛道；
- 需求空间；
- 表之间的关联数据。

因此，我目前不需要为了使用 MCP 而切换到 MCP。

当前阶段更重要的是：

> 先使用已经跑通的 CLI 链路完成真实业务任务，再在未来需要多 Agent 共用、统一工具管理和企业平台化时考虑 MCP。