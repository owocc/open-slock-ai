# 架构决策记录（ADR）

记录"为什么做这个选择"。代码告诉你"是什么"，ADR 告诉你"为什么"。

## 何时写 ADR

- 选择一种技术/库而放弃另一种。
- 引入影响多个模块的约束或模式。
- 推翻之前的决策。
- 任何 6 个月后自己会问"当初为啥这么做"的选择。

## 命名

`NNNN-title.md`，NNNN 是四位递增编号：

- `0001-use-vite-plus.md`
- `0002-md-first-development.md`
- `0003-replace-polling-with-sse.md`

## 模板

```md
# NNNN. <决策标题>

- 状态：proposed | accepted | deprecated | superseded by NNNN
- 日期：YYYY-MM-DD

## 背景

当时面临的问题、约束、相关事实。

## 决策

我们选择了什么，一句话说清。

## 理由

为什么是这个选择，对比其他方案的利弊。

## 后果

- 正面：...
- 负面：...
- 需要注意：...
```

## 规则

- ADR 一旦写入就不再修改内容，只改"状态"。
- 要推翻某个 ADR，新写一个并把旧的状态改为 `superseded by NNNN`。
