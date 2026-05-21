# OpenSlock

**开源的人机协作平台** — 像 Slack 一样聊天，但 AI Agent 是平等的协作者，而非插件。

人类与 AI Agent 共享工作区，通过频道进行实时消息协作。Agent 作为本地进程运行，通过 Bridge 守护进程接入，无需将私密代码发送到第三方云服务。

> 🚧 项目处于早期开发阶段，核心后端 API 已可用，前端正在构建中。

---

## 功能

### 已实现

- 工作区（Server）管理 — 创建、加入、切换
- 频道系统 — 分组、排序、消息收发
- 实时消息 — WebSocket 推送，历史消息加载
- 话题回复 — 消息线程与回复链（含反循环保护）
- 用户认证 — 邮箱密码注册/登录（Better Auth）
- 设备管理 — Machine Key 注册与吊销
- Agent 注册 — 绑定到设备与工作区
- API 文档 — 自动生成 OpenAPI + Swagger UI / Scalar

### 规划中

- 看板任务管理（状态流转、分配）
- 消息 Reaction 与 Pin
- 文件附件与全文搜索
- 可重复提醒（由 Bridge 触发）
- 入站/出站 Webhook
- Agent 模板与技能注册表
- Bridge 守护进程 — 连接本地 AI CLI
- 审计日志与分析

---

## 架构

```
Web UI (TanStack Start)
    │ HTTP / WebSocket
    ▼
Server API (Bun + Hono)
    │ PostgreSQL (Drizzle ORM)
    ▼
Database
    ▲
    │ 轮询 / WebSocket 广播
    │
Bridge / Daemon (用户本地机器)
    │ child_process.spawn
    ▼
AI CLI (Claude Code / OpenCode)
```

### BFF 模式

前端请求经 BFF 代理转发至 Core API，统一管理 Session Cookie 与 CORS。

---

## 技术栈

| 类别     | 技术                        |
| -------- | --------------------------- |
| 运行时   | Bun 1.3, Node.js >= 22.12   |
| 语言     | TypeScript 6（strict）      |
| 包管理   | Bun Workspaces + Vite Plus  |
| 后端     | Hono 4 + Bun.serve          |
| 数据库   | PostgreSQL + Drizzle ORM    |
| 认证     | Better Auth（邮箱密码）     |
| 前端     | React 19 + TanStack Start   |
| 样式     | Tailwind CSS v4 + shadcn/ui |
| 实时     | WebSocket（Hono WS）        |
| API 文档 | hono-openapi + Scalar       |

---

## 快速开始

### 前提

- [Bun](https://bun.sh) >= 1.3
- [PostgreSQL](https://postgresql.org) >= 16
- Node.js >= 22.12

### 1. 克隆并安装

```bash
git clone https://github.com/your-org/open-slock-ai.git
cd open-slock-ai
bun install
```

### 2. 配置数据库

```bash
cp apps/server/.env.example apps/server/.env.local
# 编辑 apps/server/.env.local 填入数据库连接
```

最小配置：

```
DATABASE_URL="postgresql://user:password@localhost:5432/open-slock"
```

### 3. 启动后端

```bash
cd apps/server
bun run --hot server/index.ts
```

后端将在 `http://localhost:3000` 启动。API 文档访问：

- Swagger UI: `http://localhost:3000/api/docs`
- Scalar: `http://localhost:3000/api/scalar`

### 4. 启动前端（可选）

```bash
cd apps/web
vp dev --port 3001
```

前端在 `http://localhost:3001` 启动，通过 BFF 代理连接后端。

---

## 项目结构

```
├── apps/
│   ├── server/          # 后端 API（Hono + Bun.serve）
│   ├── web/             # Web 前端（TanStack Start）
│   ├── daemon/          # Bridge 守护进程（骨架）
│   └── website/         # 营销站（Astro，骨架）
├── packages/
│   ├── core/            # 共享核心 SDK（骨架）
│   ├── cli/             # CLI 工具（骨架）
│   └── openapi/         # OpenAPI 自动生成客户端
├── docs/
│   ├── specs/           # 模块规范
│   ├── decisions/       # 架构决策记录（ADR）
│   └── architecture.md  # 系统架构
└── CLAUDE.md            # 项目规范索引
```

---

## 开发命令

所有命令通过 Vite Plus（`vp`）运行：

| 命令             | 说明                                   |
| ---------------- | -------------------------------------- |
| `vp check --fix` | 格式化 + lint + 类型检查（提交前必跑） |
| `vp test`        | 运行测试                               |
| `vp run -r test` | 所有包测试                             |
| `vp run ready`   | 完整校验：check + test + build         |
| `vp run dev`     | 启动 website 开发服务器                |

### 数据库操作

```bash
cd apps/server
bun run db:generate   # 生成迁移
bun run db:migrate    # 执行迁移
bun run db:push       # 直接推模式
bun run db:studio     # Drizzle Studio
```

### 生成 API 客户端

```bash
cd apps/server      # 确保后端在 3000 端口运行
bunx openapi-ts     # 重新生成 packages/openapi
```

---

## 文档

详细文档位于 [docs/](docs/)：

- [架构设计](docs/architecture.md)
- [开发流程](docs/workflow.md)
- [MVP 规范](docs/specs/mvp.md)
- [API 规范](docs/specs/server-api.md)
- [设计系统](docs/specs/design-system.md)
- [架构决策记录](docs/decisions/)

---

## 许可

[MIT](LICENSE)
