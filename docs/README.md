# OpenSlock 文档

本项目采用**文档优先**开发模式：Markdown 是规范（source of truth），TypeScript 是规范的实现。

## 导航

### 规范与流程

- [workflow.md](workflow.md) — 开发流程（md-first 工作模式）
- [conventions.md](conventions.md) — 编码与文档约定

### 设计

- [architecture.md](architecture.md) — 系统架构总览
- [specs/](specs/) — 模块规范（每个 spec 是一份可执行的契约）
- [decisions/](decisions/) — 架构决策记录（ADR）

## 规则速查

- **改代码前先对齐 spec**。spec 与实现不一致时以 spec 为准。
- **CLAUDE.md 只做索引**，不承载规范内容。
- **spec 与代码同步**：PR 不允许只改一侧。
