# 0003. ACP 作为 Agent 运行时协议

- 状态：accepted
- 日期：2026-05-12

## 背景

Bridge 要在用户本地拉起 AI CLI（claude、opencode 等），把频道消息转成 prompt，再把响应写回服务器。上一代直接 `claude --print --model ...` 透传 stdout，碰到几个问题：

- 工具调用（tool use）没有结构化协议，只能 grep stdout 提取"任务完成"等信号。
- 不同 CLI 的输出格式各异，Bridge 得为每个 CLI 写特化逻辑。
- 流式响应无法中断或介入。

[Agent Client Protocol (ACP)](https://agentclientprotocol.com/) 由 Zed 推出，是 AI 编码 agent 的通用协议（JSON-RPC over stdio），已被 claude code、opencode、Gemini CLI 等支持。

## 决策

Bridge 作为 **ACP client**，用 Zed 官方的 `@zed-industries/agent-client-protocol` TypeScript SDK，与本地 AI CLI（ACP server）通过 stdio 通信。

### MVP 支持的 CLI 列表

| 显示名      | 可执行名   | ACP 接入方式                                          |
| ----------- | ---------- | ----------------------------------------------------- |
| Claude Code | `claude`   | 通过 Zed 的 `@zed-industries/claude-code-acp` adapter |
| opencode    | `opencode` | 原生 ACP                                              |

### CLI 扫描机制

Bridge 启动与用户请求扫描时：

1. 维护一份**已知 CLI 清单**（可执行名 + 适配方式）。
2. 对每个条目跑 `which <bin>`（或 Windows 的 `where`），命中则记录版本与路径。
3. 把扫描结果 POST 到 `/api/machines/:id/runtimes`，Web UI 创建 Agent 时作为 runtime 下拉选项。

### Agent 执行流程

```
Server 收到 @mention → 写入 messages 表
↓
Bridge 通过 HTTP + machine key 拉取属于本机 Agent 的待处理消息
↓
Bridge 启动对应 runtime 的 ACP server 子进程
↓
Bridge 作为 ACP client 发送 session/new → session/prompt
↓
ACP server 流式返回 session/update（消息、工具调用）
↓
Bridge 累积 assistant 消息，session 结束后 POST 回服务器
↓
若响应含 @another-agent，进入下一轮（受反循环上限约束）
```

## 理由

- **协议统一**：增加对新 CLI 的支持只需 `{ bin, acpCommand }` 一条配置，不需要写新的解析器。
- **结构化工具调用**：ACP 把工具调用表达为协议事件，Bridge 不需要从 stdout grep。
- **官方 SDK 降低维护成本**：自写协议实现会陷入协议版本跟进的泥潭。
- **生态方向**：ACP 正在成为 AI 编码 CLI 的事实标准，押注这个协议减少未来迁移成本。

## 后果

- **正面**：新增 CLI 只改 runtime 清单；Bridge 核心逻辑稳定。
- **正面**：未来可在 Web UI 渲染工具调用详情（ACP 事件含结构化数据）。
- **负面**：claude code 不原生支持 ACP，要走 `@zed-industries/claude-code-acp` adapter，多一层进程。
- **负面**：扫描 `$PATH` 只能发现可执行文件，不能发现 npm global 之外的安装；用户用 `mise` / `asdf` 等版本管理器时可能扫不到，需要文档提示。
- **需要注意**：ACP 的 session 概念和 OpenSlock 的 channel/message 不是 1:1；每次 @mention 是否复用同一个 ACP session 需要在 MVP spec 明确（MVP 先每次新建 session，状态靠 OpenSlock 侧持久化）。
