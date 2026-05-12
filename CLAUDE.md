# CLAUDE.md

本文件仅作为索引。所有规范存放在 [docs/](docs/)。

## 开发模式

**md 是源代码，ts 是 md 的实现。** 改代码前先读对应 spec；spec 与代码不一致时以 spec 为准。详见 [docs/workflow.md](docs/workflow.md)。

## 输出语言

**默认中文**（回答、注释、commit、PR、spec、ADR）。代码标识符与通用技术术语保留英文。用户明确切换时按指定语言输出。详见 [docs/conventions.md](docs/conventions.md#交流语言)。

## 文档入口

- [docs/README.md](docs/README.md) — 文档导航
- [docs/workflow.md](docs/workflow.md) — 开发流程
- [docs/conventions.md](docs/conventions.md) — 编码与文档约定
- [docs/architecture.md](docs/architecture.md) — 系统架构
- [docs/specs/](docs/specs/) — 模块规范
- [docs/decisions/](docs/decisions/) — 架构决策记录

## 工具链速查

Vite+ monorepo，包管理器 bun。所有任务通过 `vp` 执行，不直接调用底层工具。

```bash
vp install          # 安装依赖
vp check            # 格式化 + lint + 类型检查
vp check --fix      # 自动修复
vp test             # 当前包测试
vp run -r test      # 所有包测试
vp run -r build     # 构建所有包
vp run dev          # 启动 website 开发服务器
vp run ready        # 完整校验：check + test + build
```

`packages/utils` 内：`vp pack` 构建库，`vp pack --watch` 监听。

## 预提交钩子

根 `vite.config.ts` 配置了 staged-files 钩子，提交时自动跑 `vp check --fix`。失败时修复并**新建 commit**，不要 `--amend`。

## 全局 skill

本仓库启用 `karpathy-guidelines`：思考优先、极简实现、手术式变更、目标导向。
