# 0005. Web UI 技术栈：Astro + React islands + shadcn/cli v4 + Base UI

- 状态：accepted
- 日期：2026-05-12

## 背景

`apps/website` 当前是裸 Astro 6，无 React、无 Tailwind、无组件库。MVP 需要产品 UI（登录、频道列表、消息流、机器/Agent 管理），需要一套可维护的组件基础，且产物要能部署到 Vercel（见 ADR-0002）。

候选方案：

- **自写无库**：MVP 能用，但表单/对话框/菜单的 a11y 和键盘交互实现成本高。
- **Material UI / Mantine / Chakra**：组件完整但主题系统重，难对齐 design.md 的极简编辑风格。
- **shadcn/cli v4 + Radix primitives**：主流、生态广。
- **shadcn/cli v4 + Base UI primitives**：同生态，底层换成 Material UI 团队的 Base UI。

## 决策

采用 **Astro 6（React islands） + shadcn/cli v4 + Base UI + Tailwind v4**。

- **shadcn 模式**：组件源码直接进仓库（`apps/website/src/components/ui/`），不是 npm 依赖。便于按产品调性改写。
- **Base UI 作为 primitive 层**：`shadcn init --base base`。Base UI 是 MUI 团队推出的无样式 React 组件，API 更贴近 W3C 规范、props 更干净。
- **Tailwind v4**：shadcn 默认集成；OpenSlock 的设计 token 通过 `@theme` 定义到 CSS variables，见 `docs/specs/design-system.md`。
- **Astro React islands**：Astro 页面作为 server-rendered shell，交互区（消息流、输入框、频道列表）用 React island 承载。
- **官方 skill `shadcn/ui`**：项目装完 `components.json` 后安装，让 coding agent 正确使用 CLI 和组件模式。

### MVP 执行步骤

1. `cd apps/website && bunx astro add react tailwind` — 装 Astro 官方 React + Tailwind integration。
2. `bunx shadcn@latest init --base base` — 生成 `components.json`，base=base-ui。
3. 配置 `src/styles/global.css` 的 `@theme` 块，落地 `design-system.md` 的 token。
4. `bunx skills add shadcn/ui` — 按项目安装 shadcn skill。

## 理由

- **shadcn 源码托管符合 md-first**：组件代码就在仓库里，和对应 spec 并列维护，符合"代码是 spec 的实现"。npm 黑盒依赖难做契约绑定。
- **Base UI 与 shadcn 一等公民**：v4 官方把 `--base base` 和 `--base radix` 放在同一层级，两者维护等价。Base UI 的 props 通常更简洁（比如 `Menu.Item` 的 `render` prop 替代 Radix 的 `asChild`），长期可读性占优。
- **MUI 团队背书**：Base UI 由 MUI 团队维护，a11y 和长期兼容性可预期。
- **单字体 Inter + 浅色系**：Tailwind v4 的 `@theme` 机制让 token 改动即时生效，不需要重新编译 CSS-in-JS。
- **Astro islands 成本低**：大部分静态页面（landing、marketing）零 JS；产品 UI 在需要交互的地方按 island 打包，避免 SPA 的冷启动代价。

## 后果

- **正面**：组件可按需 eject 并改写；Base UI 的渲染 props 模式减少了 Radix 的 `asChild` 歧义。
- **正面**：`shadcn docs <component>` / `shadcn info` 给 agent 提供确切的组件 API，配合 `shadcn/ui` skill 降低误用。
- **正面**：产品 UI 与未来 marketing 页共用 `@theme`，颜色/圆角一致，字体仍可在 marketing 页叠加 display 字体（如 EB Garamond 300）。
- **负面**：Base UI 生态比 Radix 小，第三方 block 库多数基于 Radix；MVP 不依赖第三方 block，影响可控。
- **负面**：Astro + React islands 的状态管理需要显式传 props / 用外部 store（zustand 或类似）；MVP 作用范围小，React 自带 state 够用。
- **需要注意**：`components.json` 里的 `aliases` 要匹配 Astro 的 `~/` 或 `@/` 规范；落地时在 spec 中记录实际别名。
