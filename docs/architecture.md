# OpenSlock — Architecture Document

> 本文档是从现有实现中提取的完整架构记录，用于指导下一次重建。

---

## 产品定位

OpenSlock 是一个**人机协作平台**。人类和 AI Agent 共享工作区（Server），通过 Channel 通信，协作管理 Task，Agent 运行在用户本地机器上，通过 Bridge 守护进程与平台连接。

核心差异点：

- Agent 不是云端服务，而是运行在用户本地机器上的进程（通过 Machine Key 认证）
- Agent 和人类共享同一套消息/任务系统，没有"AI 专属界面"
- Bridge 是本地守护进程，轮询数据库、调用 Claude CLI、写回响应

---

## 数据模型（23 张表）

### 身份与认证

```
user
  id          text PK
  name        text
  email       text UNIQUE
  emailVerified boolean
  image       text
  createdAt   timestamp
  updatedAt   timestamp

session
  id          text PK
  userId      text → user.id (cascade)
  token       text UNIQUE
  expiresAt   timestamp
  ipAddress   text
  userAgent   text

account                          -- 密码哈希 / OAuth token 存储
  id          text PK
  userId      text → user.id (cascade)
  providerId  text               -- "credential" | "github" 等
  accountId   text
  password    text               -- bcrypt hash（email/password 登录）
  accessToken / refreshToken / idToken / scope
  createdAt / updatedAt

verification                     -- 邮箱验证 / 密码重置 token
  id          text PK
  identifier  text
  value       text
  expiresAt   timestamp
```

### 工作区

```
servers
  id          text PK
  name        text UNIQUE
  slug        text UNIQUE
  description text
  ownerId     text → user.id
  createdAt   text (ISO-8601)

serverMembers
  serverId    text → servers.id (cascade)  ┐ 复合 PK
  memberId    text                          ┘
  memberType  "human" | "agent"
  role        "owner" | "admin" | "member"
  joinedAt    text
```

### 频道与消息

```
channels
  id          text PK
  serverId    text → servers.id
  name        text
  description text
  type        "public" | "private" | "dm" | "announcement"
  isArchived  integer (0/1)
  archivedAt / archivedBy
  createdBy   text
  createdAt   text
  UNIQUE (serverId, name)

channelMembers
  channelId   text → channels.id (cascade)  ┐ 复合 PK
  memberId    text                           ┘
  memberType  "human" | "agent"
  joinedAt    text

messages
  id          text PK
  channelId   text → channels.id (cascade)
  senderId    text
  senderType  "human" | "agent" | "system"
  content     text
  seq         integer
  threadParentId text                        -- 非 null 表示是回复
  createdAt / updatedAt text

messageReactions
  id          text PK
  messageId   text → messages.id (cascade)
  actorId     text
  actorType   "human" | "agent"
  emoji       text
  UNIQUE (messageId, actorId, emoji)

pinnedMessages
  id          text PK
  channelId   text → channels.id (cascade)
  messageId   text → messages.id (cascade)
  pinnedBy    text
  UNIQUE (channelId, messageId)

attachments
  id          text PK
  messageId   text → messages.id (cascade)
  fileName / fileSize / mimeType
  storagePath text                           -- 本地文件系统路径
  uploadedBy  text
```

### 任务

```
tasks
  id          text PK
  messageId   text → messages.id (cascade) UNIQUE  -- 任务锚定到一条消息
  channelId   text → channels.id (cascade)
  serverId    text → servers.id (cascade)
  taskNumber  integer                        -- 频道内自增编号
  status      "todo" | "in_progress" | "in_review" | "done"
  priority    "low" | "medium" | "high" | "urgent"
  assigneeId  text
  assigneeType "human" | "agent"
  dueDate     text
  createdAt / updatedAt text
```

### 提醒

```
reminders
  id          text PK
  authorId    text
  title       text
  schedule    text (ISO-8601)
  recurrence  text ("none" | cron 表达式)
  anchorMessageId / anchorChannelId text
  status      "active" | "snoozed" | "cancelled"
  snoozedUntil text

reminderEvents
  id          text PK
  reminderId  text → reminders.id (cascade)
  eventType   text
  detail      text
```

### Agent

```
agents
  id          text PK
  name        text                           -- @mention 用
  displayName text
  description / systemPrompt text
  model       "sonnet" | "opus" | "haiku"
  status      "online" | "thinking" | "sleeping" | "offline"
  ownerId     text
  serverId    text
  machineKeyId text → machineKeys.id
  runtimeType text                           -- "claude-code-direct" | "acp-*" | "custom"
  runtimeConfig text (JSON)                 -- { cronPrompt, cronIntervalMinutes, ... }
  runtimePath text
  sessionId   text
  createdAt   text

machineKeys
  id          text PK
  keyPrefix   text                           -- "sk_machine_" 前缀
  keyHash     text                           -- 存储哈希，不存明文
  keyValue    text                           -- 仅创建时返回一次
  userId / serverId text
  label / computerName text
  isActive    integer (0/1)                  -- 软删除
  lastUsedAt  text

skills
  id          text PK
  name        text UNIQUE
  displayName / description text
  registry    "filesystem" | "npm" | "github" | "url"
  installCommand / version text

agentSkills
  agentId     text → agents.id (cascade)  ┐ 复合 PK
  skillId     text → skills.id (cascade)  ┘
  enabled     integer (0/1)
  config      text (JSON)
```

### 其他

```
bookmarks
  id / userId / messageId text
  UNIQUE (userId, messageId)

inviteLinks
  id          text PK
  token       text UNIQUE
  serverId    text → servers.id (cascade)
  createdBy   text
  maxUses     integer
  usedCount   integer
  expiresAt   text
  isActive    integer

auditLog                                     -- append-only，不删除
  id          text PK
  actorId / actorType / action text
  targetType / targetId text
  detail      text (JSON)
  createdAt   text

webhooks                                     -- 入站 webhook
  id / token UNIQUE / name text
  channelId / serverId text
  isActive / lastUsedAt / useCount

outgoingWebhooks                             -- 出站 webhook
  id / name / url text
  channelId / serverId text
  events      text (JSON array, 默认 ["message.sent"])
  isActive / lastFiredAt / fireCount
```

---

## 功能清单

### 已实现（可作为重建目标）

**工作区**

- 多租户 Server + Channel（public/private/dm）
- Server 加入/离开（My Servers + Discover 标签）
- Server 邀请链接（token、maxUses、过期时间）
- Server 成员管理（提升/降级/移除）
- Server 设置（改名、描述、危险区删除）
- 角色管理（owner 可提升/降级 admin）

**认证**

- Email + Password 登录（better-auth，bcrypt，session cookie）
- 个人资料页（显示名编辑）

**消息**

- 实时消息（3s 轮询，human/agent/system 三种发送者）
- 线程回复（点击 Reply → 侧边面板）
- 私信（DM channel，侧边栏独立区块）
- 消息 Reaction（emoji picker，hover 触发，toggle，计数）
- 消息置顶（pin/unpin，黄色 banner）
- 消息编辑/删除（仅自己的消息）
- Markdown 渲染（粗体、斜体、代码、链接、列表）
- 文件上传（📎 按钮，/api/upload 端点，本地存储）
- 全文搜索（含 channel 过滤，Cmd+K 快捷键）
- @mention 通知 bell（未读计数，localStorage 持久化）
- 书签（保存消息）

**Channel**

- 归档/取消归档
- 描述内联编辑
- 成员管理（从面板添加/移除）
- 通知偏好（all/mentions/muted，hover toggle）
- Channel 任务面板（✓ Tasks 按钮）

**任务**

- 创建/认领/状态流转（todo → in_progress → in_review → done）
- 看板视图
- 优先级（urgent/high/medium/low）+ 截止日期 + 逾期高亮
- 任务详情面板（含线程评论）
- 按优先级/截止日期排序，按负责人/优先级过滤
- 自动分配（⚡ Auto 按钮，分配给负载最低的在线 Agent）
- 从任务板批量分配给 Agent
- 任务完成时向 Channel 发送系统消息
- Bridge 自动检测 Agent CLI 输出中的任务完成信号
- Bridge 每 15 分钟向负责 Agent 发送逾期任务提醒
- 从任务详情面板设置提醒

**提醒**

- 创建/打盹/取消，支持重复
- Bridge 每 60s 触发到期提醒

**Agent**

- 创建/配置/绑定机器/技能 toggle
- Agent 工作区浏览器 + MEMORY.md 编辑器
- Agent 详情页：活跃任务（含状态控制）
- Agent 列表：活跃任务数 badge
- Agent 活动日志（审计追踪，自动刷新）
- Agent 模板（6 种预配置：Coder/Reviewer/Writer/Planner/Researcher/DevOps）
- Agent Cron 提示（proactive 触发，runtimeConfig.cronPrompt + cronIntervalMinutes）
- 工作区浏览器显示 git 状态（分支 + 变更数 badge）

**机器与技能**

- Machine Key 管理（生成/验证/吊销，软删除）
- Bridge 健康指示器（Keys 页面）
- 技能注册表（120+ 预置，搜索过滤，per-agent toggle）

**分析与审计**

- Server 分析页（消息量、Agent 活动、任务分解、Channel 统计）
- 审计日志（全操作，分页 UI）

**Webhook**

- 入站 webhook（token 认证，POST JSON → Channel 消息）
- 出站 webhook（message.sent 触发，HTTP POST，channel 或 server 范围）

**UX**

- 移动端响应式侧边栏（CSS slide-in，汉堡按钮）
- 全局 Toast 通知（error/success/info，自动消失）
- 键盘快捷键（Cmd+K → 搜索，Escape → 关闭 modal）
- 未读消息指示（蓝点，localStorage）

---

## Bridge 守护进程

**工作流程**

1. 每 3s 轮询数据库，找到 @mention（或 DM 消息）
2. 构建 5 层 system prompt：Identity → Workspace → MEMORY.md → Communication Protocol + CLI Tools → Recent Context
3. 调用 `claude --print --model <agent.model>`
4. 将响应写回数据库

**Agent 环境变量**

```
DATABASE_URL
OPENSLOCK_SERVER_ID
OPENSLOCK_WORKSPACE
OPENSLOCK_AGENT_ID
```

**防护机制**

- 反循环：最多 4 轮对话
- 顺序处理：Agent 一次处理一条消息，保证看到前序响应
- Watchdog：重置卡在 "thinking" 超过 5 分钟的 Agent

**健康检查**

```
GET http://localhost:8099/health
GET http://localhost:8099/health/agents
```

**模型映射**

```
sonnet → claude-sonnet-4-5
opus   → claude-opus-4-5
haiku  → claude-haiku-4-5
```

---

## CLI 命令

```bash
openslock connect --server-url <url> --api-key <key> [--daemon]
openslock bridge start|status [--daemon]
openslock message send|read|check|search
openslock task list|create|claim|unclaim|update|done
openslock reminder schedule|list|snooze|cancel|update|log
openslock server info|channels|create|list|switch|export
openslock channel list|members|join|leave|create
openslock profile show|update
openslock attachment upload|view
openslock agent list|create|delete|status|online|offline|log
openslock machine list
openslock bookmark list|remove
openslock config show|set|reset
openslock webhook list|create|delete|test
```

---

## 当前实现的问题（重建时避免）

### 根本原因

1. **TanStack Start API 不稳定**：v1.167 的 `createStartHandler` / `StartClient` / `tsr` 配置项在小版本间发生 breaking change，导致 `ssr.tsx`、`client.tsx`、`vite.config.ts` 全部报错。
2. **中途迁移数据库**：从 SQLite 迁移到 Postgres，但 `createdAt` 等字段仍用 `text` 存 ISO-8601 字符串（为了兼容旧代码），导致 schema 混乱（部分表用 `timestamp`，部分用 `text`）。
3. **better-auth 后期接入**：auth 表（user/session/account/verification）的 `createdAt` 用 `timestamp`，其余业务表用 `text`，不一致。
4. **CLI 残留 SQLite 依赖**：`packages/cli/src/index.ts` 仍 import `better-sqlite3`，迁移不彻底。
5. **Agent 无约束开发**：24h 自动开发缺乏类型检查门控，错误积累无法及时发现。

### 具体错误

| 文件                      | 错误                                                | 原因                             |
| ------------------------- | --------------------------------------------------- | -------------------------------- |
| `ssr.tsx`                 | `getRouter` 不在 `CreateStartHandlerOptions` 类型中 | TanStack Start API 变更          |
| `client.tsx`              | `StartClient` 不接受 `router` prop                  | 同上                             |
| `vite.config.ts`          | `tsr` 不在插件选项中                                | 同上                             |
| `agents/$agentId.tsx:586` | `session` 未定义                                    | 变量作用域错误                   |
| `tasks.tsx:640`           | `actorId` 不在 `createReminder` 输入类型中          | server function 签名与调用不匹配 |
| `cli/src/index.ts`        | `better-sqlite3` 找不到                             | SQLite→Postgres 迁移不完整       |

---

## 重建技术选型建议

### 保留

- **PostgreSQL + Drizzle ORM** — 数据模型设计合理，保留
- **better-auth** — 认证方案可行，保留
- **React 19 + TanStack Router** — 路由层稳定，保留
- **Tailwind CSS v4** — 样式方案保留
- **Bridge 架构** — 本地守护进程 + 轮询的设计思路保留

### 替换

| 当前                        | 建议替换                                  | 原因                                               |
| --------------------------- | ----------------------------------------- | -------------------------------------------------- |
| TanStack Start (SSR)        | **Next.js 15 App Router** 或 **Remix v2** | TanStack Start v1 API 不稳定，breaking change 频繁 |
| 轮询（3s）                  | **Server-Sent Events** 或 **WebSocket**   | 轮询在消息量大时浪费资源                           |
| 本地文件存储（attachments） | **S3 / R2** 或保持本地但用独立服务        | 当前路径硬编码 `~/.openslock/attachments`          |

### 数据库 Schema 修复建议

- 统一所有时间字段为 `timestamp with time zone`，不再用 `text` 存 ISO-8601
- 迁移时一次性更新所有读写点，不做兼容层

### 开发流程建议

- 在 CI 中加 `tsc --noEmit` 门控，阻止类型错误合并
- Agent 自动开发时限制在单个功能分支，合并前必须通过类型检查和测试

---

## 设计系统

```css
--canvas: #f5f1ec /* 奶油色背景 */ --ink: #111111 /* 主文字 */ --sidebar: #1a1a1a /* 深色侧边栏 */
  --surface-1: #ffffff /* 卡片 */ --hairline: #d3cec6 /* 细边框 */ --radius-md: 8px
  font-family: Inter;
```

---

---

## API 设计思路

本项目用 TanStack Start 的 `createServerFn` 作为 RPC 层，但其核心设计模式与框架无关，重建时可直接迁移到 Next.js Server Actions、tRPC、或标准 REST 路由。

---

### 1. Server Function 基本结构

每个 API 操作是一个独立函数，三段式：声明方法 → 校验输入 → 执行逻辑。

```ts
export const createTask = createServerFn({ method: "POST" })
  .inputValidator((data: { actorId: string; channelId: string; content: string }) => data)
  .handler(async ({ data }) => {
    // 业务逻辑
  });
```

**迁移到 Next.js Server Actions：**

```ts
"use server";
export async function createTask(data: { actorId: string; channelId: string; content: string }) {
  // 完全相同的业务逻辑
}
```

**迁移到 tRPC：**

```ts
createTask: protectedProcedure
  .input(z.object({ actorId: z.string(), channelId: z.string(), content: z.string() }))
  .mutation(async ({ input }) => { ... });
```

---

### 2. Actor 上下文：每个写操作都携带操作者身份

所有变更操作统一传入 `actorId` + `actorType`，不从 session 隐式读取。这样 Agent 和人类可以用同一套 API，Bridge 调用时直接传 Agent ID。

```ts
// 人类操作
updateTask({ actorId: session.id, actorType: "human", id: taskId, status: "done" });

// Agent 操作（Bridge 内）
updateTask({ actorId: agent.id, actorType: "agent", id: taskId, status: "done" });
```

**好处**：API 层不需要区分调用者是人还是 Agent，审计日志自动记录正确的操作者类型。

---

### 3. 审计日志：fire-and-forget 中间件

所有写操作末尾调用 `audit()`，不 await，不影响主流程。

```ts
// audit.ts
export function audit(
  actor: { id: string; type: "human" | "agent" | "system" },
  action: string,                          // "task.create" | "message.send" | ...
  target?: { type: string; id: string },   // { type: "task", id: "xxx" }
  detail?: Record<string, unknown>,        // 任意附加信息
): void {
  db.insert(auditLog).values({ ... })
    .then(() => {})
    .catch(err => console.error("[audit]", err)); // 吞掉错误，不影响主请求
}
```

**Action 命名规范**（`资源.动作`）：

```
auth.login / auth.signup / auth.logout
message.send / message.update / message.delete
task.create / task.update / task.claim / task.convert
agent.create / agent.update / agent.delete
channel.create / channel.archive
reminder.create / reminder.update / reminder.cancel
```

---

### 4. 局部更新模式

不接受完整对象替换，只更新传入的字段。构建 `updates` 对象，跳过 `undefined`。

```ts
const updates: Record<string, unknown> = {};
if (data.status !== undefined) updates.status = data.status;
if (data.assigneeId !== undefined) updates.assigneeId = data.assigneeId;
if (data.priority !== undefined) updates.priority = data.priority;
updates.updatedAt = new Date().toISOString();

await db.update(tasks).set(updates).where(eq(tasks.id, data.id));
```

**注意**：`null` 是有效值（表示清空字段），`undefined` 表示不修改。调用方传 `assigneeId: null` 可以取消分配。

---

### 5. 写后重读：始终返回数据库最新状态

不返回构造的对象，而是写完后重新查询，确保返回值与数据库一致（包含 `$defaultFn` 生成的字段）。

```ts
await db.update(tasks).set(updates).where(eq(tasks.id, data.id));

// 重新查询，不返回 updates 对象
const [updated] = await db.select().from(tasks).where(eq(tasks.id, data.id));
return updated;
```

---

### 6. 幂等创建

对于可能重复触发的创建操作，先检查是否已存在。

```ts
// convertToTask：消息已经是任务则直接返回
const [existing] = await db.select().from(tasks).where(eq(tasks.messageId, data.messageId));
if (existing) return existing;

// pinMessage：已置顶则跳过
const [existing] = await db
  .select()
  .from(pinnedMessages)
  .where(and(eq(...channelId), eq(...messageId)));
if (existing) return;
```

---

### 7. Toggle 模式

Reaction、Bookmark 等"开关"操作统一用 toggle：查存在 → 删除或插入 → 返回状态。

```ts
export const toggleReaction = createServerFn({ method: "POST" })
  .inputValidator((data: { messageId: string; actorId: string; emoji: string }) => data)
  .handler(async ({ data }) => {
    const [existing] = await db
      .select()
      .from(messageReactions)
      .where(and(eq(...messageId), eq(...actorId), eq(...emoji)));

    if (existing) {
      await db.delete(messageReactions).where(eq(messageReactions.id, existing.id));
      return { added: false };
    } else {
      await db.insert(messageReactions).values({ id: generateId(), ...data });
      return { added: true };
    }
  });
```

---

### 8. 带副作用的写操作

某些写操作会触发额外的系统消息，直接在 handler 内串行执行，不用事件队列。

**任务完成 → 发系统消息：**

```ts
if (data.status === "done" && existing.status !== "done") {
  await db.insert(messages).values({
    senderId: "system",
    senderType: "system",
    content: `✅ Task #${existing.taskNumber} completed: ${msgContent}`,
    channelId: existing.channelId,
  });
}
```

**任务分配给 Agent → 发 @mention 通知：**

```ts
if (data.assigneeType === "agent") {
  await db.insert(messages).values({
    senderId: "system",
    senderType: "system",
    content: `[task-assigned] @${agent.name} Task #${taskNumber} assigned to you: ${content}`,
    channelId: existing.channelId,
  });
}
```

**出站 Webhook → 非阻塞 fire-and-forget：**

```ts
// 不 await，不影响 sendMessage 的响应时间
fetch(hook.url, {
  method: "POST",
  body: JSON.stringify({ event: "message.sent", ... }),
  signal: AbortSignal.timeout(5000),
}).then(async () => {
  await db.update(outgoingWebhooks).set({ lastFiredAt: now, fireCount: count + 1 });
}).catch(() => {});
```

---

### 9. 分页：游标分页（不用 offset）

用 `before`（ISO 时间戳）作游标，避免 offset 在高并发下的跳页问题。

```ts
// 请求参数
{ channelId: string; limit?: number; before?: string }

// 查询
const conditions = before
  ? and(eq(messages.channelId, channelId), lt(messages.createdAt, before))
  : eq(messages.channelId, channelId);

const rows = await db.select().from(messages)
  .where(conditions)
  .orderBy(desc(messages.createdAt))
  .limit(limit);

// 返回时反转，保持时间正序
return rows.reverse();
```

**前端加载更多**：取第一条消息的 `createdAt` 作为下次请求的 `before`。

---

### 10. 全文搜索：LIKE 模式匹配

当前用 `LIKE '%query%'`，简单但够用。重建时可替换为 PostgreSQL 的 `tsvector` 全文索引。

```ts
// 当前实现
const pattern = `%${data.query}%`;
const rows = await db
  .select({ message: messages, channelName: channels.name })
  .from(messages)
  .innerJoin(channels, eq(messages.channelId, channels.id))
  .where(and(eq(channels.serverId, data.serverId), like(messages.content, pattern)))
  .orderBy(desc(messages.createdAt))
  .limit(limit);

// 升级方案（PostgreSQL）
// ALTER TABLE messages ADD COLUMN search_vector tsvector
//   GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
// CREATE INDEX ON messages USING GIN(search_vector);
// WHERE search_vector @@ plainto_tsquery('english', query)
```

---

### 11. 自增编号（非自增主键）

任务编号在 channel 内自增，用 `max() + 1` 实现，不依赖数据库序列。

```ts
const [maxResult] = await db
  .select({ max: max(tasks.taskNumber) })
  .from(tasks)
  .where(eq(tasks.channelId, data.channelId));

const nextNumber = (maxResult?.max ?? 0) + 1;
```

**注意**：高并发下有竞态风险。重建时建议改用 PostgreSQL 序列或数据库级别的 `SERIAL` 列。

---

### 12. 认证：session cookie 单点读取

所有需要鉴权的 server function 调用 `getCurrentUserId()`，不直接读 cookie。

```ts
// auth.ts — 唯一读取 session 的地方
export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  return session?.user?.id ?? null;
}

// 其他 server function 中
const userId = await getCurrentUserId();
if (!userId) throw new Error("Unauthorized");
```

**重建建议**：用 tRPC 的 `protectedProcedure` 或 Next.js middleware 统一处理，不在每个函数里重复鉴权。

---

### 13. Agent 生命周期：创建时自动初始化

`createAgent` 做了 4 件事，保证 Agent 创建后立即可用：

```
1. 插入 agents 表
2. 加入 serverMembers（role: "member"）
3. 加入 #general channel 的 channelMembers
4. 创建本地工作区目录 + 初始化 MEMORY.md
```

`deleteAgent` 对应清理：

```
1. 删除 agents 记录
2. 删除 serverMembers 中的 agent 条目
3. 删除 channelMembers 中的 agent 条目
4. 递归删除 ~/.openslock/workspaces/{agentId}/
```

---

### 14. 消息发送者名称：N+1 问题

当前 `attachSenderName` 对每条消息单独查一次 user/agent 表，是 N+1 查询。

```ts
// 当前（N+1）
for (const msg of messages) {
  out.push(await attachSenderName(db, msg)); // 每条消息一次查询
}

// 重建建议：批量查询后 Map 映射
const humanIds = messages.filter((m) => m.senderType === "human").map((m) => m.senderId);
const agentIds = messages.filter((m) => m.senderType === "agent").map((m) => m.senderId);

const [users, agents] = await Promise.all([
  db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, humanIds)),
  db
    .select({ id: agents.id, name: agents.displayName })
    .from(agents)
    .where(inArray(agents.id, agentIds)),
]);

const nameMap = new Map([...users, ...agents].map((r) => [r.id, r.name]));
return messages.map((m) => ({ ...m, senderName: nameMap.get(m.senderId) ?? null }));
```

---

### API 完整清单

| 模块             | 函数                    | 方法 | 说明                         |
| ---------------- | ----------------------- | ---- | ---------------------------- |
| **Auth**         | `login`                 | POST | email + password 登录        |
|                  | `register`              | POST | 注册，自动登录               |
|                  | `logout`                | POST | 清除 session                 |
|                  | `getSession`            | GET  | 获取当前用户                 |
|                  | `updateProfile`         | POST | 更新显示名/头像              |
| **Servers**      | `getServers`            | GET  | 列表（含 isMember/role）     |
|                  | `getServer`             | GET  | 单个 server                  |
|                  | `createServer`          | POST | 创建，自动加入               |
|                  | `joinServer`            | POST | 加入 server                  |
|                  | `leaveServer`           | POST | 离开 server                  |
|                  | `updateServer`          | POST | 改名/描述                    |
|                  | `deleteServer`          | POST | 删除（危险）                 |
| **Channels**     | `getChannels`           | GET  | 含最后一条消息               |
|                  | `createChannel`         | POST | 自动加入创建者               |
|                  | `archiveChannel`        | POST | 归档                         |
|                  | `updateChannel`         | POST | 改名/描述                    |
|                  | `getChannelMembers`     | GET  | 成员列表                     |
|                  | `addChannelMember`      | POST | 添加成员                     |
|                  | `removeChannelMember`   | POST | 移除成员                     |
| **Messages**     | `getMessages`           | GET  | 分页，支持 thread            |
|                  | `sendMessage`           | POST | 发消息，触发出站 webhook     |
|                  | `updateMessage`         | POST | 编辑（仅自己）               |
|                  | `deleteMessage`         | POST | 删除（仅自己）               |
|                  | `searchMessages`        | GET  | LIKE 全文搜索                |
|                  | `getUserMentions`       | GET  | @mention 列表                |
|                  | `toggleReaction`        | POST | 添加/取消 emoji              |
|                  | `getReactions`          | GET  | channel 内所有 reaction      |
|                  | `pinMessage`            | POST | 置顶                         |
|                  | `unpinMessage`          | POST | 取消置顶                     |
|                  | `getPinnedMessages`     | GET  | 置顶列表                     |
|                  | `toggleBookmark`        | POST | 收藏/取消                    |
|                  | `getBookmarks`          | GET  | 收藏列表                     |
|                  | `getMessageAttachments` | GET  | 附件列表                     |
| **Tasks**        | `getServerTasks`        | GET  | server 内所有任务            |
|                  | `getChannelTasks`       | GET  | channel 内任务               |
|                  | `createTask`            | POST | 创建（同时创建消息）         |
|                  | `convertToTask`         | POST | 消息转任务（幂等）           |
|                  | `updateTask`            | POST | 更新状态/优先级/截止日期     |
|                  | `claimTask`             | POST | 认领，自动通知 Agent         |
| **Agents**       | `getAgents`             | GET  | 列表，可按 machineKey 过滤   |
|                  | `getAgent`              | POST | 单个 agent                   |
|                  | `createAgent`           | POST | 创建 + 初始化工作区          |
|                  | `updateAgent`           | POST | 更新配置/状态                |
|                  | `deleteAgent`           | POST | 删除 + 清理成员关系 + 工作区 |
|                  | `getAgentWorkspace`     | GET  | 工作区文件列表 + git 状态    |
|                  | `updateAgentMemory`     | POST | 写 MEMORY.md                 |
| **Reminders**    | `getReminders`          | GET  | 列表，可按状态过滤           |
|                  | `createReminder`        | POST | 创建                         |
|                  | `updateReminder`        | POST | 更新/打盹                    |
|                  | `cancelReminder`        | POST | 取消                         |
| **Members**      | `getServerMembers`      | GET  | 人类 + Agent 成员            |
|                  | `addServerMember`       | POST | 添加                         |
|                  | `removeServerMember`    | POST | 移除                         |
|                  | `updateMemberRole`      | POST | 提升/降级                    |
| **Machine Keys** | `getMachineKeys`        | GET  | 列表                         |
|                  | `createMachineKey`      | POST | 生成（仅此时返回明文）       |
|                  | `revokeMachineKey`      | POST | 吊销（软删除）               |
|                  | `verifyMachineKey`      | POST | 验证（Bridge 启动时调用）    |
| **Webhooks**     | `getWebhooks`           | GET  | 入站 webhook 列表            |
|                  | `createWebhook`         | POST | 创建                         |
|                  | `revokeWebhook`         | POST | 停用                         |
|                  | `getOutgoingWebhooks`   | GET  | 出站 webhook 列表            |
|                  | `createOutgoingWebhook` | POST | 创建                         |
|                  | `toggleOutgoingWebhook` | POST | 启用/停用                    |
|                  | `deleteOutgoingWebhook` | POST | 删除                         |
| **Analytics**    | `getServerAnalytics`    | GET  | 消息量/任务统计/Agent 活动   |
| **Audit**        | `getAuditLog`           | GET  | 分页，支持多维度过滤         |
| **Invites**      | `createInviteLink`      | POST | 生成邀请链接                 |
|                  | `getInviteLinks`        | GET  | 列表                         |
|                  | `revokeInviteLink`      | POST | 吊销                         |
|                  | `useInviteLink`         | POST | 使用邀请（加入 server）      |

---

_提取自 open-slock 仓库，提取时间：2026-05-12_
