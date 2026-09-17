# Enterprise RAG Copilot · Web

Next.js 15 前端（App Router + TypeScript + Tailwind CSS 4）。

## 开发

```bash
npm install
cp .env.local.example .env.local      # 设置 NEXT_PUBLIC_API_BASE_URL
npm run dev                           # http://localhost:3001
```

后端需另行启动（见仓库根 README）：

```bash
cd ../../backend && uvicorn app.main:app --port 8000
```

## 脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 开发服务器（:3001） |
| `npm run build` | 生产构建 |
| `npm start` | 启动生产构建 |
| `npm run lint` | ESLint |
| `npm run typecheck` | tsc --noEmit |

## 目录

```
src/
├── app/            10 个页面（App Router）
├── components/
│   ├── layout/     Sidebar · Topbar · AppShell（含演示密码门）
│   ├── ui/         Design System 组件（button/card/badge/field/data/tabs/drawer/states/toggle）
│   ├── rag/        Markdown 引用渲染 · 答案卡 · 来源抽屉 · 检索面板 · 生成态
│   ├── agent/      Trace 时间线
│   ├── mascot/     原创 SVG「知识精灵」小知（7 种状态）
│   └── providers/  Theme · Toast
└── lib/            api 客户端 · types（镜像后端 Pydantic）· hooks · utils
```

设计令牌集中在 `src/app/globals.css` 的 `@theme` 与 `.dark`，明暗两套值独立调校。
