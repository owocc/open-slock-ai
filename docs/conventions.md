# 约定

## 代码

- TypeScript 严格模式；不允许 `any`，必要时用 `unknown` + 类型守卫。
- 一个模块 = 一份 spec (`docs/specs/x.md`) + 一个实现 (`src/x.ts`) + 一份测试 (`tests/x.test.ts`)。
- 命名：文件 kebab-case，类型/组件 PascalCase，函数/变量 camelCase。
- 写代码前先读对应的 spec；没有 spec 先写 spec。

## 文档

- 所有规范写在 `docs/`。CLAUDE.md 只做索引，不复制内容。
- spec 与代码必须同步；PR 不能只改其一。
- 架构决策写 ADR：`docs/decisions/NNNN-title.md`（NNNN 为四位递增编号）。

## 交流语言

- **默认输出语言：中文**。包括回答、注释、commit message、PR 描述、spec、ADR。
- 保留英文原文的情形：
  - 代码标识符（类型、函数、变量、文件名）。
  - 已约定俗成的技术术语（API、SSR、ORM、schema、payload 等）。
  - 外部引用的文档/库/错误信息。
- 用户若明确切换语言（"用英文回答"），按用户指定的语言输出。

## 工具链

本项目使用 **Vite Plus** (`vp`) 作为包管理器和任务运行器。

**命令规则**：

- ✅ **优先使用 `vp`** — 所有任务通过 `vp` 执行
- ✅ **允许使用 `bun`** — 仅用于 `bun run <script>` 执行 package.json 中定义的脚本
- ❌ **禁止直接调用** — 不要直接调用 `vite` / `vitest` / `tsc` / `oxlint` / `npm` / `pnpm` / `yarn`

**常用命令**（详见根目录 CLAUDE.md）：

- `vp install` — 安装依赖
- `vp check` — 格式化 + lint + 类型检查
- `vp check --fix` — 自动修复格式和 lint 问题
- `vp test` — 运行测试（调用 vitest）
- `vp run -r test` — 跨所有包运行测试
- `vp run ready` — 完整校验：check + test + build
- `bun run <script>` — 执行 package.json 中定义的脚本（如 `bun run db:migrate`）

**预提交钩子**：

- 提交前会自动跑 `vp check --fix`
- 失败时修复后**新建 commit**，不要 `--amend`

## 提交信息

- 使用 Conventional Commits：`feat:` / `fix:` / `docs:` / `refactor:` / `chore:` / `test:`。
- 标题 ≤ 70 字；正文说清"为什么"而非"做了什么"。
- 动 spec 也是 `docs:` 前缀。spec + 实现 + 测试一起改时用主要类型（通常 `feat:` 或 `fix:`）。

## 行为准则（自动应用）

- 全局 skill `karpathy-guidelines` 已安装。每次写代码遵循：
  - 思考优先：先说假设，有歧义先问。
  - 极简实现：不写未被请求的功能、抽象、防御式代码。
  - 手术式变更：只动必须动的地方，不顺手"改进"周边。
  - 目标导向：把任务转化为可验证的成功标准。
