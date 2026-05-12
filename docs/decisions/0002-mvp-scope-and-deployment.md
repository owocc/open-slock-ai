# 0002. MVP 范围与部署拓扑

- 状态：accepted
- 日期：2026-05-12

## 背景

完全重建 OpenSlock。上一代踩坑主因不是功能错，而是范围过大 + 类型门控缺失（见 `docs/architecture.md`）。需要先锚定一个"证明链路"的最小闭环，而不是"重建所有功能"。

核心卖点需要在 MVP 就呈现：**AI 工具跑在用户本地，通过 Bridge 连接到远端 Web UI**，人类和多个本地 Agent 在频道里共享消息。

## 决策

### MVP 闭环

用户在任意设备打开 Web UI → 邮箱登录 → 进入**内置默认 server** 的 `#general` → 发消息 `@coder 你好` → 用户本地 Bridge 轮询到消息 → 通过 ACP 调本地 CLI → 响应写回 → Web UI 收到 Realtime 通知后刷新 → 若响应含 `@reviewer` 触发下一轮。

### MVP 范围

**包含**：

- 邮箱 + 密码登录（better-auth，最小配置）
- 内置一个默认 server，所有注册用户自动加入
- 频道列表 + 默认 `#general`（不支持创建频道）
- 消息发送、列表、@mention 解析
- 电脑注册 + machine key 生成（Web UI 操作）
- Bridge CLI（`npx @slock-ai/daemon`）扫描本地 AI CLI
- 创建 Agent：选电脑 + 选 runtime（claude / opencode）
- Agent 通过 ACP 响应 @mention
- 反循环保护（最多 N 轮）

**排除**（留到后续）：

Task、Reminder、Thread、DM、Reaction、Pin、Attachment、搜索、Webhook、Analytics、Audit、Invite、角色管理、归档、通知偏好、Skill 注册表、创建 Server/Channel 接口、Agent 工作区浏览器、Agent 模板、Cron 提示。

### 部署拓扑

| 场景             | Server + Web UI       | Postgres + Realtime        | Bridge     | AI CLI     |
| ---------------- | --------------------- | -------------------------- | ---------- | ---------- |
| 生产             | Vercel                | Supabase Cloud             | 用户本地   | 用户本地   |
| 本地开发         | `vp run dev`（Astro） | `supabase start`（Docker） | 开发机本地 | 开发机本地 |
| 自托管（MVP 后） | Docker 或 Node        | 自建 Postgres + Realtime   | 用户本地   | 用户本地   |

Web UI 与 Server API **同仓同部署**（`apps/website` 用 Astro endpoints 直接承载 API 路由），MVP 不拆分前后端。

### 认证边界

- **人类**：better-auth session cookie（邮箱 + 密码）。
- **Bridge**：machine key，格式 `sk_machine_<64 hex>`，在 Web UI 为某 server 生成，启动命令 `npx @slock-ai/daemon --server-url <url> --api-key <key>`。一台物理电脑可为多个 server 分别生成 key（daemon 支持多 server 同时连接）。

## 理由

- **Vercel + Supabase 降低部署摩擦**：用户可以 fork 仓库一键部署到 Vercel，Postgres 用 Supabase 免费额度，不用维护服务器。
- **`supabase start` 无云依赖调试**：本地 Docker 完整复现生产栈（Postgres + Realtime），不会因为调试失败才发现云端不兼容。
- **内置默认 server**：MVP 的目标是"跑通链路"，不是"工作区管理"。创建 server 的界面与流程消耗大、回报小。
- **同仓同部署**：Vercel 部署单一 Astro 项目比前后端分离简单，Astro 的 API endpoints 足够承载 MVP 的 REST 需求。

## 后果

- **正面**：一个 `vercel deploy` + 一个 Supabase 项目就能起生产；`supabase start` + `vp run dev` 就能本地起完整环境。
- **正面**：MVP 功能边界清晰，便于 spec 覆盖每一条行为。
- **负面**：Vercel Serverless 不能跑长连接，Realtime 必须经 Supabase Realtime，不能自己开 WebSocket（见 ADR-0004）。
- **负面**：内置默认 server 的 schema 需要预埋一条"哨兵"记录，后续开放多 server 创建时要处理这条记录。
- **需要注意**：Astro 的 API endpoints 在 Vercel 上跑 serverless，冷启动影响首次响应；MVP 接受这个代价。
