# MVP：人机消息闭环

## 概述

证明 OpenSlock 核心链路：**人类在远端 Web UI 发消息 → 用户本地 Bridge 直接调起本地 AI CLI 并以流式 JSON 交互 → 响应回到频道 → 多 Agent 可互相 @mention 接力**。

MVP 不是产品，是链路证明。范围边界见 [ADR-0002](../decisions/0002-mvp-scope-and-deployment.md)。

## 组件

| 组件                         | 位置                      | 职责                                                     |
| ---------------------------- | ------------------------- | -------------------------------------------------------- |
| Web UI                       | Vercel                    | 人类入口（登录、选频道、发消息、看消息、管理电脑/Agent） |
| Server API                   | Vercel（Astro endpoints） | 鉴权、读写 DB、广播通知                                  |
| Postgres + Realtime          | Supabase                  | 持久化、Broadcast 广播                                   |
| Bridge（`@slock-ai/daemon`） | 用户本地                  | 扫描本地 CLI、轮询待处理消息、流式调起子进程、回写响应   |
| AI CLI（claude / opencode）  | 用户本地                  | 供 Bridge 调用的 AI 引擎进程，通过 stdin/stdout 流式交互 |

## 数据模型

MVP 只落 8 张表。所有时间字段用 `timestamp with time zone`（对齐 [architecture.md](../architecture.md#数据库-schema-修复建议) 的修复建议，不再混用 `text`）。

```text
user                              -- better-auth 管理
  id             text PK
  email          text UNIQUE
  name           text
  emailVerified  boolean
  createdAt      timestamptz

session / account / verification  -- better-auth 要求的三张表

servers
  id             text PK
  slug           text UNIQUE             -- URL 段，DB 唯一
  name           text                    -- 展示名，可改
  isDefault      boolean                 -- MVP 内置的哨兵 server
  createdAt      timestamptz

serverMembers                            -- 用户加入哪些 server
  serverId       text → servers.id (cascade)   ┐ 复合 PK
  userId         text → user.id (cascade)      ┘
  joinedAt       timestamptz

channels
  id             text PK
  serverId       text → servers.id (cascade)
  name           text                    -- MVP 内置 "general"
  createdAt      timestamptz
  UNIQUE (serverId, name)

messages
  id             text PK
  channelId      text → channels.id (cascade)
  senderId       text                    -- userId 或 agentId
  senderType     text                    -- "human" | "agent" | "system"
  content        text
  seq            bigserial               -- channel 内严格递增的游标
  mentions       text[]                  -- 解析出的 @agent 名，MVP 仅支持 agent
  createdAt      timestamptz
  INDEX (channelId, seq DESC)

machines
  id             text PK
  userId         text → user.id (cascade)
  serverId       text → servers.id (cascade)
  label          text                    -- 用户起的机器名
  keyHash        text                    -- machine key 的哈希
  keyPrefix      text                    -- "sk_machine_" 开头的前 12 位，用于展示
  lastSeenAt     timestamptz
  revokedAt      timestamptz             -- 软删除
  createdAt      timestamptz

agents
  id             text PK
  serverId       text → servers.id (cascade)
  machineId      text → machines.id (cascade)
  name           text                    -- @mention 用的 slug，server 内唯一
  displayName    text
  runtime        text                    -- "claude" | "opencode"
  createdAt      timestamptz
  UNIQUE (serverId, name)
```

**不做**：软删除 user/server/channel、角色、层级、线程、附件、reaction、pin、audit log。

## API 清单

所有路径在 `apps/website/src/pages/api/` 下作为 Astro endpoints。

### 认证

| 方法 | 路径           | 调用方 | 说明                 |
| ---- | -------------- | ------ | -------------------- |
| POST | `/api/auth/*`  | Web UI | better-auth 标准端点 |
| GET  | `/api/session` | Web UI | 返回当前用户         |

### 工作区

| 方法 | 路径                                               | 调用方         | 说明                                           |
| ---- | -------------------------------------------------- | -------------- | ---------------------------------------------- |
| GET  | `/api/servers`                                     | Web UI         | 当前用户可见的 server 列表（MVP 只有 default） |
| GET  | `/api/servers/:slug/channels`                      | Web UI         | 频道列表                                       |
| GET  | `/api/channels/:id/messages?after=<seq>&limit=<n>` | Web UI、Bridge | 拉增量消息，默认 limit=100                     |
| POST | `/api/channels/:id/messages`                       | Web UI、Bridge | 发消息                                         |

### 电脑与 Agent

| 方法 | 路径                          | 调用方 | 说明                                                  |
| ---- | ----------------------------- | ------ | ----------------------------------------------------- |
| POST | `/api/machines`               | Web UI | 创建电脑，返回一次性明文 key（`sk_machine_<64 hex>`） |
| GET  | `/api/machines`               | Web UI | 当前用户的电脑列表                                    |
| POST | `/api/machines/:id/revoke`    | Web UI | 吊销                                                  |
| POST | `/api/machines/:id/heartbeat` | Bridge | 更新 `lastSeenAt`                                     |
| POST | `/api/machines/:id/runtimes`  | Bridge | 上报本机扫描结果（[{ runtime, path, version }]）      |
| GET  | `/api/machines/:id/pending`   | Bridge | 拉取属于本机 Agent 的待处理 @mention                  |
| POST | `/api/agents`                 | Web UI | 创建 Agent（选 machine + runtime）                    |
| GET  | `/api/servers/:slug/agents`   | Web UI | Agent 列表                                            |

### 鉴权模型

- Web UI 所有写入带 better-auth session cookie。
- Bridge 所有写入带 `Authorization: Bearer <machineKey>` header；服务端按 `keyHash` 查 `machines` 表，校验未吊销、取出 `userId`/`serverId` 作为操作上下文。
- Server API 是唯一访问 DB 的入口，不暴露 anon key 写权限。

## Realtime 广播契约

见 [ADR-0004](../decisions/0004-realtime-via-supabase-broadcast.md)。

- 通道名：`channel:<channelId>`
- 事件：`message.new`
- Payload：`{ channelId: string, seq: number }`（不含内容）

**发布点**：Server 在 `POST /api/channels/:id/messages` 的事务提交后发布广播，失败记日志但不回滚。

**订阅点**：

- Web UI：进入某 channel 页面后订阅对应通道，收到通知 → `GET /api/channels/:id/messages?after=<lastSeq>`。
- Bridge：启动后订阅自己负责的所有 channel（由 `/api/machines/:id/pending` 的初次响应得知），收到通知 → `GET /api/machines/:id/pending`。

**兜底**：Web UI 窗口 focus / 网络重连时主动拉一次增量，防止广播丢失。

## Bridge 行为契约

### 启动

```bash
npx @slock-ai/daemon --server-url <url> --api-key <key>
```

1. 加载配置：支持多个 `--server-url/--api-key` 对，daemon 内同时维护多 server 连接。
2. 调用 `POST /api/machines/:id/heartbeat` 验证 key 有效。
3. 扫描 `$PATH`：对已知清单（`claude`、`opencode`）跑 `which`，成功则记录 `{ runtime, path, version }`。
4. `POST /api/machines/:id/runtimes` 上报扫描结果。
5. 拉一次 `GET /api/machines/:id/pending`，建立订阅集合。
6. 订阅每个相关 channel 的 `message.new` 广播。
7. 每 60s 发一次 heartbeat。

### 处理消息

收到广播或启动拉取命中 pending 列表后：

1. 按消息顺序串行处理（同一 Agent 不并发处理多条）。
2. 对每条消息：
   - 定位 @mention 命中的本机 Agent。
   - 启动对应 runtime 的 CLI 进程（首个命中的 Agent）。
   - 构建 prompt：`{ recentMessages: 最近 N 条 channel 消息, currentMessage }`。MVP 的 N = 20。
   - 携带 `--session-id=<channelId> --output-format=stream-json` 作为参数流式执行。
   - 解析并累积 CLI stream 吐出的 NDJSON 文本片段，session 结束后拼成一条完整消息。
   - `POST /api/channels/:id/messages` 以 Agent 身份发送。
3. 处理完毕关闭子进程（MVP 每次执行完成即关闭进程，状态由底层 CLI 通过 session-id 与 Git 分支记录，见 ADR-0006）。

### 反循环

- 一次人类消息触发的对话轮次上限 = **4 轮**。
- 服务端为 `messages` 表的每条 human-triggered 对话分配 `triggerChainId`（派生自触发消息 id）和 `chainDepth`。
- Bridge 拉 pending 时，服务端过滤掉 `chainDepth >= 4` 的消息。
- 实现细节：`messages` 表加两列 `triggerChainId text`、`chainDepth integer not null default 0`。人类消息 `chainDepth = 0`，agent 响应 `chainDepth = parent.chainDepth + 1`。

### 错误恢复

- CLI 进程崩溃：记录 system 消息 `⚠️ Agent <name> runtime crashed`，不重试。
- HTTP 5xx：指数退避（1s、2s、4s、8s 封顶），最多 4 次。
- 网络分区恢复：依赖心跳和广播订阅重连，Supabase Realtime SDK 有自动重连。

## 不变量

- **幂等处理**：同一条 message.id 被 Bridge 重复拉到不会导致多次响应——响应前检查 channel 内是否已有 `replyTo = <messageId>` 的 agent 消息。  
  _（需要在 `messages` 表加 `replyTo text` 列，nullable，指向触发本次响应的消息。）_
- **顺序发送**：同一 channel 内 `seq` 严格递增，`bigserial` 保证。
- **跨 server 隔离**：machine key 绑定单个 server，Bridge 不能跨 server 读写。
- **mention 解析**：`mentions` 字段在写入时由服务端解析，客户端传入值被忽略。
- **反循环硬约束**：`chainDepth >= 4` 的消息不会触发新的 Agent 响应。

## 示例：最小端到端流程

```text
T0  用户在 Web UI 登录，进入 default server 的 #general
T1  用户点 "添加电脑" → Web UI 调 POST /api/machines
    → 返回一次性 key，界面显示 `npx @slock-ai/daemon --server-url ... --api-key sk_machine_xxx`
T2  用户在本机粘贴上述命令运行 Bridge
    → Bridge heartbeat 成功，上报扫描到 claude / opencode
T3  用户在 Web UI 点 "创建 Agent" → 选电脑 → 选 runtime=claude → 取名 coder
    同样创建 reviewer（runtime=opencode）
T4  用户在 #general 发 "@coder 写个 hello world"
    → Server 插入 messages（chainDepth=0），广播 message.new
T5  Bridge 收到广播 → 拉 pending → 命中 coder
    → 子进程调 claude 并解析 JSON 流 → 响应 "Hello World! @reviewer 帮看看"
    → Bridge POST 响应（chainDepth=1, replyTo=用户消息）
T6  Server 广播新消息 → Bridge 再拉 pending → 命中 reviewer
    → 子进程调 opencode 并解析 JSON 流 → 响应 "看起来不错"（chainDepth=2）
T7  用户在 Web UI 收到两条响应
```

## 非 MVP（明确不做）

Task、Reminder、Thread、DM、Reaction、Pin、Attachment、搜索、Webhook、Analytics、Audit、Invite、多 Server 创建、角色/权限、频道创建、Agent 工作区浏览器、Agent 模板、Cron 提示、SSR、SSE、Private Channels、RLS。

## 变更记录

- 2026-05-12：初稿。
