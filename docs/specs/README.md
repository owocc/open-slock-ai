# Specs

本目录存放模块规范。每个 `.md` 文件描述一个模块的契约，是对应 TypeScript 实现的"源代码"。

## 命名

- 文件名 kebab-case，与实现文件对应：
  - `packages/utils/src/slug.ts` ↔ `docs/specs/utils-slug.md`
  - `apps/website/src/pages/index.astro` ↔ `docs/specs/website-home.md`
- 跨模块的共享契约放 `docs/specs/shared-<name>.md`。

## 模板

新建 spec 时复制以下骨架：

```md
# <模块名>

## 概述

一段话说明这个模块做什么、为什么存在、谁在使用。

## 接口

\`\`\`ts
// 导出的类型与函数签名（只写签名，不写实现）
export function slugify(input: string): string
\`\`\`

## 行为

### 函数 A

- **成功路径**：输入 X → 输出 Y。
- **边界**：空字符串返回 `""`；超长输入截断到 N 字符。
- **错误**：非法字符抛 `TypeError("...")`。

### 函数 B

- ...

## 示例

\`\`\`ts
slugify("Hello World") // => "hello-world"
slugify("") // => ""
\`\`\`

## 不变量

- 对任意输入 `s`，`slugify(s)` 只包含 `[a-z0-9-]`。
- 幂等：`slugify(slugify(s)) === slugify(s)`。

## 变更记录

- 2026-05-12：初稿。
```

## 规则

- 只写契约，不写实现细节。"怎么做"留给代码。
- 不变量必须能被测试覆盖；没有对应测试的不变量不算数。
- spec 变更要在"变更记录"追加一行。
