# 数据库 Schema 规范

## 概述

本文档定义 OpenSlock 的完整数据库 schema，基于 PostgreSQL + Drizzle ORM，集成 Better Auth。

**设计原则**：

- 所有时间字段统一使用 `timestamp with time zone` (对应 Drizzle 的 `timestamp({ withTimezone: true })`)。
- 主键和外键引用的标识符统一使用 `text` 类型，采用 CUID2 或 UUID。
- 外键关系均使用级联删除策略（`ON DELETE CASCADE`），部分幂等自引用字段（如 `replyTo`）除外。
- 采用 Better Auth 接管核心用户及会话认证，业务数据表引用 `user.id`。

## Better Auth 表

Better Auth 通过其 CLI 与库自动生成和管理认证相关的核心表：`user`、`session`、`account`、`verification`。这些表满足 Better Auth 核心规范，并在我们项目目录的 `apps/server/server/db/schemas/auth-schema.ts` 中声明。

### 核心用户表接口

对于我们的业务数据，主要关联的是 Better Auth 的 `user` 表：

- `user.id` (`text`, Primary Key) — 用户唯一标识符。
- `user.email` (`text`, Unique) — 邮箱。

---

## 业务表（8 张）

### 1. servers (服务器/工作区)

服务器是系统内最顶层的逻辑隔离单元，用户和 Agent 在其内部进行协作沟通。

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

**核心说明**：

- `slug` — URL 部分，系统全局唯一（只允许小写字母、数字、连字符）。
- `isDefault` — 标志是否是 MVP 环境下的内置哨兵服务器（自动创建）。

---

### 2. serverMembers (服务器成员)

这是一个连接表，代表用户加入了哪些服务器。由于 MVP 暂无复杂角色，所有成员权限等同。

```sql
CREATE TABLE "serverMembers" (
  "serverId" text NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  "userId"   text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "joinedAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("serverId", "userId")
);

CREATE INDEX idx_serverMembers_userId ON "serverMembers"("userId");
```

---

### 3. channels (频道)

频道属于服务器。是系统消息沟通的主入口。每一个服务器在初始化时，会自动随带创建一个名为 `"general"` 的默认频道。

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

**唯一性约束**：

- 同一个服务器下频道名 `name` 不能重复 (`serverId`, `name` 复合唯一约束)。

---

### 4. machines (计算机)

计算机代表了用户的本地物理设备（例如用户的 Macbook），属于某个特定的 `serverId` 并归属于特定的 `userId`。只有成功注册并拥有有效 Machine Key 的计算机，其本地的 Daemon Bridge 才能与服务器进行双向通信。

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

**不变量**：

- `keyHash` 是 Machine Key 的 SHA-256 哈希值，确保机器的密钥验证安全。
- 若 `revokedAt` 非空则表示机器已被注销/吊销，Daemon 将无法通过其鉴权。

---

### 5. agents (代理)

Agent 是运行在指定计算机 (`machines`) 上的 AI 运行时实例。Agent 属于某一指定的服务器 (`serverId`)。

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

**不变量**：

- `name` 是在群聊中被 `@mention` 提及的唯一昵称标识，在对应的服务器内必须唯一 (`serverId`, `name` 复合唯一约束)。
- Agent 必须宿主在健康且未被吊销的 `machineId` 下。

---

### 6. messages (消息与话题)

消息是人类用户与本地 Agent 相互沟通交流的媒介。**消息必须隶属于某个频道，同时也可以是某个子话题（Thread）的回复。**

通过自引用列 `parentId` 来实现话题模式：

```sql
CREATE TABLE messages (
  id               text PRIMARY KEY,
  "channelId"      text NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  "parentId"       text REFERENCES messages(id) ON DELETE CASCADE,
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
CREATE INDEX idx_messages_parentId ON messages("parentId");
CREATE INDEX idx_messages_senderId ON messages("senderId");
CREATE INDEX idx_messages_replyTo ON messages("replyTo");
```

#### 话题设计细节与业务规约

1. **根通道消息**：
   - 正常在频道中首发、未在任何小话题里的普通消息，其 `parentId` 为 `NULL`。
2. **话题内回复**：
   - 当用户或 Agent 对某一特定消息点击“开启话题/回复讨论”时，该回复消息的 `parentId` 需要填入那条被回复消息的 `id`。
   - 子话题内的消息虽然代表一个独立的垂直会话树，但它们依旧共享同一个 `channelId` 便于归档和权限确认。
3. **删除级联**：
   - 当一条根消息被删除时，在 `parentId` 上建立的 `ON DELETE CASCADE` 会自动将所有挂载在此话题下的分支回复一并级联删除。
4. **对话深度控制与反循环**：
   - `triggerChainId` 关联触发这一对话链的最初始的人类消息 `id`。
   - `chainDepth` 依然代表链路深度。无论消息在主频道轴还是在子话题中，一旦由 Agent 触发响应且深度达到 4（`chainDepth >= 4`），系统停止触发本地 daemon 调用，以防多个 Agent 在话题里陷入无限递归循环。

---

## 索引与高频查询优化

1. **拉取频道普通消息流**：

   ```sql
   -- 查询主频道首屏消息（排除子话题）
   SELECT * FROM messages
   WHERE "channelId" = ? AND "parentId" IS NULL
   ORDER BY seq DESC;
   ```

   **索引**：`idx_messages_channelId_seq` 复合索引加速拉取。

2. **拉取某条消息衍生的子话题列表**：
   ```sql
   SELECT * FROM messages
   WHERE "parentId" = ?
   ORDER BY "createdAt" ASC;
   ```
   **索引**：在自引用外键上建立了 `idx_messages_parentId` 索引，保障高频检索速度。

## 数据初始化规范 (Seeding)

系统进行初始化（Dev 开启或部署阶段）时，必须执行预设：

1. 建立默认服务器（`slug = "default"`，`isDefault = true`）。
2. 在该服务器下建立名称为 `"general"` 的公共频道。

## 开发与迁移方式

在 `apps/server` 下定义完 drizzle schema 后，使用包中的 Vite Plus 命令来完成生成与迁移：

```bash
# 生成 drizzle sql 迁移文件
vp run db:generate

# 将迁移文件同步到数据库
vp run db:migrate
```
