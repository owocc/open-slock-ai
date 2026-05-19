# 设计系统

## 概述

OpenSlock 产品 UI 的视觉与组件约定。**基调借用**自 `docs/references/elevenlabs-aesthetic.md`（ElevenLabs 编辑杂志风），**只保留**能服务于高密度产品界面的部分：色板、圆角、hairline 几何、ink pill CTA。**裁掉**：渐变光球、Waldenburg 字体、display-mega 级排版、96px 段距。

字体统一 **Inter**。技术实现见 ADR-0005。

## 颜色 Token

Tailwind v4 的 `@theme` 块中定义，映射到 CSS custom properties。以下是 token 名 → hex。

### 背景层（浅）

| Token                    | Hex       | 用途                   |
| ------------------------ | --------- | ---------------------- |
| `--color-canvas`         | `#f5f5f5` | 页面底色               |
| `--color-canvas-soft`    | `#fafafa` | 备用分层（极少用）     |
| `--color-surface`        | `#ffffff` | 卡片、输入框、消息气泡 |
| `--color-surface-strong` | `#f0efed` | 徽章、次级面板         |

### 背景层（深）

仅用于左侧主导航 / 用户菜单等"系统外壳"：

| Token                           | Hex       | 用途                      |
| ------------------------------- | --------- | ------------------------- |
| `--color-surface-dark`          | `#0c0a09` | 侧边栏底色                |
| `--color-surface-dark-elevated` | `#1c1917` | 侧边栏内高亮项、active 行 |
| `--color-on-dark`               | `#ffffff` | 深色层上的主文字          |
| `--color-on-dark-soft`          | `#a8a29e` | 深色层上的次级文字        |

### 文字

| Token                | Hex       | 用途                       |
| -------------------- | --------- | -------------------------- |
| `--color-ink`        | `#0c0a09` | 主文字、display            |
| `--color-ink-soft`   | `#292524` | 加粗文字、primary CTA 底色 |
| `--color-body`       | `#4e4e4e` | 默认正文                   |
| `--color-muted`      | `#777169` | 次级标签、meta             |
| `--color-muted-soft` | `#a8a29e` | 占位符、禁用               |

### Hairline

| Token                     | Hex       | 用途             |
| ------------------------- | --------- | ---------------- |
| `--color-hairline`        | `#e7e5e4` | 默认 1px 分隔    |
| `--color-hairline-soft`   | `#f0efed` | 更轻的分隔       |
| `--color-hairline-strong` | `#d6d3d1` | 输入框、面板边框 |

### 语义

| Token             | Hex       | 用途                                   |
| ----------------- | --------- | -------------------------------------- |
| `--color-success` | `#16a34a` | 成功反馈                               |
| `--color-error`   | `#dc2626` | 错误、危险操作                         |
| `--color-warning` | `#d97706` | 警示（新增，design.md 未列但产品需要） |

**不做**：`gradient-*` 系列、saturated 品牌色。CTA 只用 ink pill，不引入品牌蓝/绿。

## 圆角 Token

| Token           | 值       | 用途                   |
| --------------- | -------- | ---------------------- |
| `--radius-xs`   | `4px`    | 内联标签、徽章小角     |
| `--radius-sm`   | `6px`    | 紧凑行、小卡片         |
| `--radius-md`   | `8px`    | **默认输入框、菜单项** |
| `--radius-lg`   | `12px`   | 对话框、卡片           |
| `--radius-xl`   | `16px`   | 大型容器（MVP 少用）   |
| `--radius-pill` | `9999px` | CTA 按钮、徽章         |
| `--radius-full` | `9999px` | 头像、圆形图标         |

**不做**：`radius-xxl (24px)` —— 只用于 design.md 的 gradient-orb-card，MVP 不用。

## 间距 Token

4px 基础单位：

| Token        | 值     |
| ------------ | ------ |
| `--space-1`  | `4px`  |
| `--space-2`  | `8px`  |
| `--space-3`  | `12px` |
| `--space-4`  | `16px` |
| `--space-5`  | `20px` |
| `--space-6`  | `24px` |
| `--space-8`  | `32px` |
| `--space-12` | `48px` |

**不做**：`--space-section (96px)` —— 营销页专用。产品页最大段距 48px。

## 字体与排版

**唯一字体**：Inter（variable）。作为 `--font-sans`，不引入衬线字体。

```css
--font-sans:
  "Inter Variable", ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", sans-serif;
```

### 字级（产品 UI 专用，裁剪自 design.md）

| Token                | Size | Weight | Line-height | Letter-spacing | 用途                        |
| -------------------- | ---- | ------ | ----------- | -------------- | --------------------------- |
| `text-display`       | 28px | 500    | 1.25        | `-0.01em`      | 页面顶部 h1（如"Channels"） |
| `text-title`         | 20px | 500    | 1.35        | `0`            | 面板标题                    |
| `text-subtitle`      | 18px | 500    | 1.44        | `0.01em`       | 列表分组头                  |
| `text-body`          | 15px | 400    | 1.5         | `0.01em`       | 消息正文、默认段落          |
| `text-body-strong`   | 15px | 500    | 1.5         | `0.01em`       | 强调                        |
| `text-meta`          | 13px | 400    | 1.4         | `0.01em`       | 时间戳、发送者旁注          |
| `text-caption-upper` | 11px | 600    | 1.3         | `0.08em`       | 侧边栏分组标签、TAG         |
| `text-button`        | 14px | 500    | 1.0         | `0`            | 按钮                        |

**删除**：`display-mega (64px)`、`display-xl (48px)`、`display-lg (36px)`、`display-md (32px)`、`display-sm (24px)`——营销页级排版，产品 UI 用不到。

**消息流密度**：消息气泡用 `text-body` (15px) + 1.5 行高，连续消息（同发送者 2 分钟内）合并渲染，减少头像与 meta 重复。

## 阴影

唯一阴影层：

```css
--shadow-soft: 0 4px 16px rgba(0, 0, 0, 0.04);
```

用于 hover 态卡片、dropdown、tooltip 浮层。其他用 hairline 替代阴影。

## 组件映射（shadcn 名称 ↔ 设计意图）

| shadcn/ui                  | OpenSlock 用法                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| `button` variant=`default` | Ink pill CTA，`bg-ink-soft text-white rounded-pill`。primary 动作                        |
| `button` variant=`outline` | 透明 + hairline-strong border，次级                                                      |
| `button` variant=`ghost`   | 无边无底，仅 hover 态，工具栏                                                            |
| `input`                    | `bg-surface border-hairline-strong rounded-md h-10 px-4 text-body`，聚焦时 border 变 ink |
| `dialog`                   | `bg-surface rounded-lg shadow-soft`，背景遮罩 `bg-ink/40`                                |
| `dropdown-menu` / `select` | Base UI Menu primitive，`rounded-md shadow-soft`                                         |
| `avatar`                   | `rounded-full`，占位用 `bg-surface-strong text-ink`                                      |
| `badge`                    | `bg-surface-strong text-ink text-caption-upper rounded-pill px-2 py-0.5`                 |

## 布局原则

- **信息密度优先**：产品 UI 不用 96px 段距；面板内部元素间距 16–24px。
- **Hairline 分隔**：列表、面板边界默认 1px hairline，不加阴影。
- **Sidebar 唯一深色**：左侧导航是系统外壳，用 `surface-dark`；其余一律浅色 canvas。
- **CTA 克制**：同一视图内只有 1 个 primary ink pill，其他用 outline / ghost。
- **双栏高雅卡片式布局**：登录页和注册页采用卡片布局（`bg-surface border-hairline shadow-soft`），配合去饱和度高反差的抽象大理石艺术背景图像，将极简排版艺术、服务条款细微标识与清晰的输入域结合。
- **消息密度高合并渲染**：在聊天消息流中，若同一发送者在 2 分钟内连续发送消息，将进行合并展示，不重复渲染头像和账户名，仅在悬停该行消息时在左侧栏边缘透出极小的时间戳标记（`text-[10px] text-muted-soft select-none`），实现信息密度最大化。

## 不变量

- **字体唯一**：`font-family` 仅允许解析到 Inter 或系统 fallback。不得在任意组件引入其他字体。
- **CTA 颜色唯一**：`primary` 动作背景只能是 `--color-ink-soft`，不得引入品牌色。
- **圆角来自 token**：不得在组件样式中写裸 `border-radius`，必须用 `rounded-<token>` 类或 `var(--radius-*)`。
- **禁用装饰元素**：不得引入 gradient orb / blur-backdrop 风格的纯装饰元素。

## 变更记录

- 2026-05-12：初稿，基调提取自 `docs/references/elevenlabs-aesthetic.md`。
