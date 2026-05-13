# CLAUDE.md

**本文件是规范索引，不承载规范内容。** 所有规范存放在 [docs/](docs/)。

## 🚨 核心约束（必读）

- **md 是源代码** — spec 与代码冲突时以 spec 为准 → [workflow.md](docs/workflow.md)
- **默认中文输出** — 回答、注释、commit、PR、spec、ADR → [conventions.md](docs/conventions.md#交流语言)
- **只用 vp 或 bun** — 使用 Vite Plus (`vp`) 或 `bun run`，不直接调用 vite/vitest/tsc/oxlint/npm/pnpm/yarn → [conventions.md](docs/conventions.md#工具链)
- **spec/实现/测试同步** — PR 不允许只改其一 → [workflow.md](docs/workflow.md#pr-规则)

## 📚 规范文档

| 文档                                    | 用途                       |
| --------------------------------------- | -------------------------- |
| [README.md](docs/README.md)             | 文档导航与规则速查         |
| [workflow.md](docs/workflow.md)         | 开发流程（四步工作法）     |
| [conventions.md](docs/conventions.md)   | 编码与文档约定             |
| [architecture.md](docs/architecture.md) | 系统架构与 API 设计模式    |
| [specs/](docs/specs/)                   | 模块规范（每个模块的契约） |
| [decisions/](docs/decisions/)           | 架构决策记录（ADR）        |

## 🤔 我应该...

- **改功能** → 先读 `docs/specs/<module>.md`，确认 spec 是否需要更新
- **修 bug** → 先写失败的测试，再改实现
- **加模块** → 先写 `docs/specs/<module>.md`，再写测试和实现
- **做架构决策** → 写 ADR 到 `docs/decisions/`
- **不确定** → 问用户，不要猜

## ⚡ 快速命令

```bash
vp check --fix      # 格式化 + lint + 类型检查（提交前必跑）
vp test             # 运行测试（调用 vitest）
vp run -r test      # 所有包测试
vp run ready        # 完整校验：check + test + build
vp run dev          # 启动 website 开发服务器
```

完整命令列表 → [conventions.md](docs/conventions.md#工具链)

## ✅ 提交前检查

- [ ] 读过对应的 spec
- [ ] spec、实现、测试三者同步
- [ ] `vp check --fix` 通过
- [ ] commit message 符合 Conventional Commits（`feat:`/`fix:`/`docs:`/`refactor:`/`test:`/`chore:`）
- [ ] 钩子失败时新建 commit（不要 `--amend`）

## ❌ 常见错误

| 错误                                 | 正确做法                     |
| ------------------------------------ | ---------------------------- |
| 只改代码不改 spec                    | 先改 spec，再改代码          |
| 直接调用 `vite` / `vitest`           | 统一用 `vp` 命令             |
| 钩子失败后 `--amend`                 | 修复后新建 commit            |
| 用英文写 commit message              | 默认用中文（标识符保留英文） |
| 代码与 spec 不一致时改 spec 迁就代码 | 以 spec 为准，修正代码       |

## 🎯 行为准则

本仓库启用 `karpathy-guidelines`：

- **思考优先** — 先说假设，有歧义先问
- **极简实现** — 不写未被请求的功能、抽象、防御式代码
- **手术式变更** — 只动必须动的地方，不顺手"改进"周边
- **目标导向** — 把任务转化为可验证的成功标准

## 📝 预提交钩子

根 `vite.config.ts` 配置了 staged-files 钩子，提交时自动跑 `vp check --fix`。

**钩子失败时**：修复问题后**新建 commit**，不要 `--amend`（会修改到前一个 commit）。

<!-- SPECKIT START -->

For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan

<!-- SPECKIT END -->
