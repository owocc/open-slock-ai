# OpenSlock 文档

本项目采用**文档优先**开发模式：Markdown 是规范（source of truth），TypeScript 是规范的实现。

## 导航

### 规范与流程

- [workflow.md](workflow.md) — 开发流程（md-first 工作模式）
- [conventions.md](conventions.md) — 编码与文档约定

### 设计

- [architecture.md](architecture.md) — 系统架构总览（上一代实现的经验与教训）
- [specs/mvp.md](specs/mvp.md) — **当前目标**：MVP 人机消息闭环
- [specs/design-system.md](specs/design-system.md) — 产品 UI 视觉与组件约定
- [specs/](specs/) — 模块规范（每个 spec 是一份可执行的契约）
- [references/](references/) — 外部素材与风格参考（非规范）
- [decisions/](decisions/) — 架构决策记录（ADR）
  - [0001](decisions/0001-md-first-development.md) md-first 开发模式
  - [0002](decisions/0002-mvp-scope-and-deployment.md) MVP 范围与部署拓扑
  - [0003](decisions/0003-acp-for-agent-runtime.md) ACP 作为 Agent 运行时协议 (superseded by 0006)
  - [0004](decisions/0004-realtime-via-supabase-broadcast.md) Realtime 用 Supabase Broadcast 公开通道
  - [0005](decisions/0005-web-ui-stack.md) Web UI 技术栈：Astro + React islands + shadcn v4 + Base UI
  - [0006](decisions/0006-daemon-cli-stream.md) Daemon 通过 CLI 流式 JSON 驱动 Agent

## 规则速查

- **改代码前先对齐 spec**。spec 与实现不一致时以 spec 为准。
- **CLAUDE.md 只做索引**，不承载规范内容。
- **spec 与代码同步**：PR 不允许只改一侧。
