# 数据库 Schema 规范

## 概述

本文档定义 OpenSlock MVP 的完整数据库 schema，基于 PostgreSQL + Drizzle ORM，集成 Better Auth。

**设计原则**：

- 所有时间字段统一使用 `timestamp with time zone`（不再混用 `text` 存 ISO-8601）
- 主键统一使用 `text` 类型（存储 CUID2 或类似格式）
- 外键统一使用 `CASCADE` 删除策略
- Better Auth 表遵循其官方 schema 定义

## Better Auth 表

Better Auth 通过其 CLI 自动生成和管理认证相关的表。这些表的具体字段由 Better Auth 版本决定，我们不在此 spec 中详细定义。

**集成方式**：

1. Better Auth CLI 生成 `auth-schema.ts`（包含 user, session, account, verification 等表）
2. 我们的业务表通过外键引用 `user.id`
3. Drizzle 自动推导类型，无需手动维护

**参考文档**：[Better Auth Schema](https://www.better-auth.com/docs/concepts/database)

**业务表依赖**：

- 所有需要关联用户的业务表使用 `text` 类型外键引用 `user.id`
- 删除策略根据业务需求选择 `CASCADE` 或 `SET NULL`

## 业务表（8 张）

### servers

工作区（Server）是用户和 Agent 协作的顶层容器。

```sql
CREATE TABLE servers (
  id          text PRIMARY KEY,
  slug        text UNIQUE NOT NULL,
  name        text NOT NULL,
  "isDefault" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_servers_slug ON servers(slug);
```

**字段说明**：

- `slug` — URL 段，全局唯一（如 `"default"`）
- `name` — 展示名（如 `"Default Server"`）
- `isDefault` — MVP 内置的哨兵 server（系统启动时自动创建）

**不变量**：

- 系统中有且仅有一个 `isDefault = true` 的 server
- `slug` 只能包含小写字母、数字、连字符

### serverMembers

用户加入的 server 列表。

```sql
CREATE TABLE "serverMembers" (
  "serverId" text NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  "userId"   text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "joinedAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("serverId", "userId")
);

CREATE INDEX idx_serverMembers_userId ON "serverMembers"("userId");
```

**字段说明**：

- 复合主键：一个用户在同一 server 中只能有一条记录
- MVP 不做角色管理，所有成员权限相同

### channels

频道是消息的容器。

```sql
CREATE TABLE channels (
  id          text PRIMARY KEY,
  "serverId"  text NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name        text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("serverId", name)
);

CREATE INDEX idx_channels_serverId ON channels("serverId");
```

**字段说明**：

- `name` — 频道名（如 `"general"`），server 内唯一
- MVP 内置 `"general"` 频道，系统自动创建

**不变量**：

- 每个 server 至少有一个 `name = "general"` 的频道
- `name` 只能包含小写字母、数字、连字符

### messages

消息是人类和 Agent 交互的基本单位。

```sql
CREATE TABLE messages (
  id               text PRIMARY KEY,
  "channelId"      text NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  "senderId"       text NOT NULL,
  "senderType"     text NOT NULL CHECK ("senderType" IN ('human', 'agent', 'system')),
  content          text NOT NULL,
  seq              bigserial NOT NULL,
  mentions         text[] NOT NULL DEFAULT '{}',
  "replyTo"        text REFERENCES messages(id) ON DELETE SET NULL,
  "triggerChainId" text,
  "chainDepth"     integer NOT NULL DEFAULT 0,
  "createdAt"      timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("channelId", seq)
);

CREATE INDEX idx_messages_channelId_seq ON messages("channelId", seq DESC);
CREATE INDEX idx_messages_senderId ON messages("senderId");
CREATE INDEX idx_messages_replyTo ON messages("replyTo");
CREATE INDEX idx_messages_triggerChainId ON messages("triggerChainId");
```

**字段说明**：

- `senderId` — 发送者 ID（`user.id` 或 `agents.id` 或 `"system"`）
- `senderType` — 发送者类型（`"human"` | `"agent"` | `"system"`）
- `seq` — 频道内严格递增的序列号（用于增量拉取和排序）
- `mentions` — 解析出的 @mention 列表（仅包含 agent name，服务端写入时解析）
- `replyTo` — 指向触发本次响应的消息（用于幂等处理）
- `triggerChainId` — 对话链 ID（人类消息的 `id`，agent 响应继承触发消息的 `triggerChainId`）
- `chainDepth` — 对话链深度（人类消息为 0，agent 响应为 `parent.chainDepth + 1`）

**不变量**：

- `seq` 在同一 `channelId` 内严格递增（由 `bigserial` 保证）
- `chainDepth >= 4` 的消息不会触发新的 Agent 响应（反循环机制）
- `senderType = "human"` 时 `senderId` 必须存在于 `user` 表
- `senderType = "agent"` 时 `senderId` 必须存在于 `agents` 表
- `mentions` 数组中的值必须是有效的 agent name

### machines

电脑（Machine）代表用户的本地机器，通过 Machine Key 认证。

```sql
CREATE TABLE machines (
  id           text PRIMARY KEY,
  "userId"     text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "serverId"   text NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  label        text NOT NULL,
  "keyHash"    text NOT NULL,
  "keyPrefix"  text NOT NULL,
  "lastSeenAt" timestamptz,
  "revokedAt"  timestamptz,
  "createdAt"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_machines_userId ON machines("userId");
CREATE INDEX idx_machines_serverId ON machines("serverId");
CREATE INDEX idx_machines_keyHash ON machines("keyHash");
```

**字段说明**：

- `label` — 用户起的机器名（如 `"MacBook Pro"`）
- `keyHash` — Machine Key 的 SHA-256 哈希（用于验证）
- `keyPrefix` — Machine Key 的前 12 位（如 `"sk_machine_a1b2"`，用于 UI 展示）
- `lastSeenAt` — Bridge 最后一次心跳时间
- `revokedAt` — 吊销时间（软删除，非 null 表示已吊销）

**不变量**：

- Machine Key 格式：`sk_machine_<64 位十六进制>`
- `keyHash` 全局唯一
- 已吊销的 machine（`revokedAt IS NOT NULL`）不能用于认证

### agents

Agent 是运行在用户本地机器上的 AI 实例。

```sql
CREATE TABLE agents (
  id            text PRIMARY KEY,
  "serverId"    text NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  "machineId"   text NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  name          text NOT NULL,
  "displayName" text NOT NULL,
  runtime       text NOT NULL CHECK (runtime IN ('claude', 'opencode')),
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("serverId", name)
);

CREATE INDEX idx_agents_serverId ON agents("serverId");
CREATE INDEX idx_agents_machineId ON agents("machineId");
```

**字段说明**：

- `name` — @mention 用的 slug（如 `"coder"`），server 内唯一
- `displayName` — 展示名（如 `"Coder Agent"`）
- `runtime` — AI CLI 类型（`"claude"` | `"opencode"`）

**不变量**：

- `name` 只能包含小写字母、数字、下划线
- `name` 在同一 server 内唯一
- Agent 只能绑定到未吊销的 machine

## 索引策略

### 高频查询索引

```sql
-- 拉取增量消息（Web UI / Bridge）
CREATE INDEX idx_messages_channelId_seq ON messages("channelId", seq DESC);

-- 查找待处理的 @mention（Bridge）
CREATE INDEX idx_messages_mentions ON messages USING GIN(mentions);

-- 反循环查询
CREATE INDEX idx_messages_triggerChainId ON messages("triggerChainId");

-- Machine Key 验证
CREATE INDEX idx_machines_keyHash ON machines("keyHash");
```

### 外键索引

所有外键列自动创建索引（Drizzle 默认行为）。

## 迁移策略

### 初始化

```bash
# 生成迁移文件
vp run db:generate
# 或
bun run db:generate

# 应用迁移
vp run db:migrate
# 或
bun run db:migrate

# 或直接推送到开发数据库（跳过迁移文件）
vp run db:push
# 或
bun run db:push
```

**说明**：本项目使用 Vite Plus (`vp`) 作为包管理器，优先使用 `vp run <script>`，也可使用 `bun run <script>`。

### 数据初始化

系统启动时自动执行：

1. 创建 default server（`slug = "default"`, `isDefault = true`）
2. 创建 general channel（`name = "general"`）

```bash
vp run db:seed
# 或
bun run db:seed
```

实现位置：`apps/web/src/db/seed.ts`

## 类型安全

Drizzle 自动从 schema 生成 TypeScript 类型：

```typescript
import { type InferSelectModel, type InferInsertModel } from "drizzle-orm";
import * as schema from "./schema";

// 查询结果类型
export type User = InferSelectModel<typeof schema.user>;
export type Message = InferSelectModel<typeof schema.messages>;

// 插入数据类型
export type NewMessage = InferInsertModel<typeof schema.messages>;
```

## 环境变量

```bash
# .env
DATABASE_URL=postgresql://user:password@localhost:5432/openslock
```

## 变更记录

- 2026-05-14：更新 Better Auth 表说明，改为引用 Better Auth CLI 生成的 schema
- 2026-05-13：初稿，基于 MVP spec 定义完整 schema
