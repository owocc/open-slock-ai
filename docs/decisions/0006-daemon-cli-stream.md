# 0006. Daemon 通过 CLI 流式 JSON 驱动 Agent

- 状态：accepted
- 日期：2026-05-20

## 背景

本地 Bridge (Daemon) 原定使用 ACP (Agent Client Protocol) 协议通过 `@zed-industries/agent-client-protocol` SDK 驱动本地 AI CLI（如 Claude Code CLI）。但在多 Agent 群聊和异步协同场景下，ACP 面临着设计上的不匹配和集成复杂度：

1. **协议绑定局限性**：ACP 由 Zed 专为 IDE/编辑器交互设计，对不属于编辑器的群聊 UI（像 Slack/Webhook 式的单条消息提交、没有主动 workspace textDocument 打开/监听动作等场景）适配沉重，包含大量冗余层事件。
2. **多余的转化进程**：Claude Code CLI 不原生暴露 ACP 接口，必须引入官方的 `claude-code-acp` adapter。这引入了额外的两重 stdio 代理进程，在大并发或者长时间运行时不稳定。
3. **命令行已提供标准流**：用 `claude` (或 `opencode`) 直接调用时，CLI 内置的 `--print --output-format=stream-json` 已经能平滑吐出 Newline-elimited JSON (NDJSON)。这包含了文本生成片段、工具调度状态以及完整的会话进程。

## 决策

我们选择弃用 ACP 协议和外部 Adapter 依赖，在本地 Daemon (Bridge) 中直接通过标准子进程驱动本地 CLI：

1. **子进程管理**：使用 Node.js 的 `child_process.spawn()` 直接拉起本地全局安装的 `claude` 或 `opencode` 可执行文件。
2. **流式交互指令**：
   - 第一次/非交互式提问：`claude <prompt> --print --output-format=stream-json --include-partial-messages --permission-mode=auto --session-id=<uuid>`。
   - `session-id` 会话复用：以群聊的频道 Channel ID 或长对话 UUID 作为 `--session-id` 参数传入，使得 Agent 能在多次 @mention 中天然继承之前的上下文状态和本地文件缓存，不需要 Daemon 做复杂的上下文恢复。
3. **NDJSON 解析与实时广播**：
   - 监听 stdout，实时使用流式边界分割器切分 NDJSON 结构。
   - 解析中间状态：提取文本片段 (`message-chunk`) 流式输出到 Web 端展现打字机；提取工具调用 (`tool-call`) 在 Web 端实时渲染 `Agent 正在使用 Read 工具...` 等微状态。
   - 接收最终聚合结果写回 Supabase messages 表中。

## 理由

- **降低复杂度**：完全剥离了 Zed 协议相关的 adapter SDK。底层的 Agent runtime 直接对齐 CLI 标准输出。
- **免二次包装**：充分发挥 Claude Code 原生 `--print` 参数的威力，无需再将其强制转换为 ACP 标准然后再转换回来。
- **群聊体验流畅**：流式 JSON 让 Daemon 随时拦截并向后端广播 Agent 执行的主动/被动状态（“思考中”、“运行测试中”），大大提升远端消费的实时感。

## 后果

- **正面**：架构变得极为扁平：`Slock Server ↔ Slock Daemon ↔ Claude Code CLI`，无多余中继层。
- **正面**：直接继承了 Claude Code CLI 原生的上下文会话引擎，甚至不需要 Daemon 在本地做多轮对话会话历史管理。
- **负面**：流式格式 (`stream-json`) 的解析依赖于本地 CLI 自身的输出格式稳定性。如果未来 CLI 更新破坏该输出结构，Daemon 需要随之更新解析逻辑。
- **需要注意**：使用 `--permission-mode=auto` 时，对一些敏感（如重大系统级改动）的工具，CLI 依然可能进行交互提示，Daemon 需要在二期中提供 STDIN 与 Web 控制台交互的指令劫持，一期（MVP）采用限制允许工具集（通过 `--allowed-tools`）来规避。
