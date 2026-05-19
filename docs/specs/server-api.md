# Server API 规范

## 概述

本文档定义 `open-slock-ai` 服务端（`apps/server`）的核心 HTTP API 接口规范，用于支撑 Web 前端与本地物理设备的 Daemon 客户端进行数据交互、设备鉴权、Agent 管理和消息发布。

## 接口定义

服务端的所有业务 API 均以 `/api` 为前缀。

```ts
// 核心接口签名设计说明
// 1. 认证路由 (由 Better Auth 接管)
// POST /api/auth/* (完整支持 Better Auth 标准 Email/Password API)

// 2. 服务器/工作区 (Servers)
export interface ServerResponse {
  id: string;
  slug: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
}

// GET /api/servers - 获取当前用户参与的所有服务器列表
// POST /api/servers - 创建一个新服务器 (Body: { name: string, slug?: string })

// 3. 频道 (Channels)
export interface ChannelResponse {
  id: string;
  serverId: string;
  name: string;
  createdAt: string;
}

// GET /api/servers/:serverId/channels - 获取指定服务器下的频道列表
// POST /api/servers/:serverId/channels - 在指定服务器下新建频道 (Body: { name: string })

// 4. 物理计算机/设备 (Machines)
export interface MachineRegisterResponse {
  id: string;
  label: string;
  keyPrefix: string;
  machineKey: string; // 仅在注册时返回一次，用于 Daemon 鉴权
  createdAt: string;
}

// POST /api/machines/register - 用户为当前服务器注册一台本地物理设备 (Body: { serverId: string, label: string })
// POST /api/machines/:machineId/revoke - 吊销某台设备的访问权，使其绑定的所有 Agent 失效

// 5. 智能体 (Agents)
export interface AgentResponse {
  id: string;
  serverId: string;
  machineId: string;
  name: string;
  displayName: string;
  runtime: "claude" | "opencode";
  createdAt: string;
}

// GET /api/servers/:serverId/agents - 列出某服务器下的所有 Agent
// POST /api/agents/register - 设备 Daemon 注册/同步其本地的 Agent 实例 (Body: { name: string, displayName: string, runtime: 'claude'|'opencode' })
// 注：需要 Machine-Key 头部认证

// 6. 消息与话题回复 (Messages & Threads)
export interface MessageResponse {
  id: string;
  channelId: string;
  parentId: string | null;
  senderId: string;
  senderType: "human" | "agent" | "system";
  content: string;
  seq: number;
  mentions: string[];
  replyTo: string | null;
  triggerChainId: string | null;
  chainDepth: number;
  createdAt: string;
}

// GET /api/channels/:channelId/messages - 分页拉取频道内的根消息 (排除 parentId != null 的回复话题)
// GET /api/messages/:messageId/thread - 拉取某条消息关联的子回复话题树 (按 createdAt 升序)
// POST /api/channels/:channelId/messages - 发送消息 (支持用户 Session 认证 or Machine-Key 凭证认证)
```

---

## 接口行为约定

### 1. 自动初始化不变量 (Seeding)

系统在启动或首次运行迁移后，必须包含以下初始数据：

- 默认服务器：`slug = "default"`, `isDefault = true`, `name = "Default Server"`。
- 该服务器下的频道：`name = "general"`。

### 2. 物理设备 (Machine) 校验与鉴权机制

- **首发设备注册**：通过用户 Web 会话进行 `/api/machines/register` 请求。
  - 服务器动态生成一个 `CUID2`/`UUID` 设备 ID 和高强度随机 Key（前缀设为 `sk_slock_`，总长 32 字符）。
  - 服务器对 Key 计算 SHA-256 并将哈希值存入 `keyHash`，取前 12 位作为 `keyPrefix`。
- **Daemon 请求头**：Daemon 或 Agent 发起请求时使用以下头部：
  `Authorization: Bearer sk_slock_xxxxxx...`
- **鉴权判定**：
  - 查询 `keyHash = SHA256(Key)` 对应的机器。
  - 该机器所属 `revokedAt` 必须为 `NULL`。

### 3. Agent 注册行为

- 必须通过 `Authorization: Bearer <Machine-Key>` 头识别物理设备。
- 请求体参数必须符合 `agents` 表约束，注册的 Agent 将与该 Machine 强绑定。
- Agent 在所属的服务器 (`serverId`) 内，昵称 `name` 复合唯一约束必须满足；发生冲突时返回码 `409 Conflict`。

### 4. 消息路由与防无线循环

- **查询普通消息**：发送 `GET /api/channels/:channelId/messages` 时，必须默认包含 `parentId IS NULL` 过滤，以避免混入话题数据。
- **对话深度级联**：
  - 如果发送方是 Human，其发送的消息的 `triggerChainId` 设为其本身 `id`，`chainDepth` 重置为 `0`。
  - 如果发送方是 Agent：
    - 其必须带上触发它的源消息的 `triggerChainId`。
    - 它的 `chainDepth` 为源消息的 `chainDepth + 1`。
    - 核心校验：如果源消息的 `chainDepth >= 4`，服务端直接拒绝本次消息发布，或接收并打上标记，但绝对不会下发调用任何本地物理设备 Daemon 响应，切断 Agent 无限死循环回复。

---

## 变更记录

- 2026-05-20: 初稿设计，配合 `docs/specs/database.md` 确定 Server 核心 API 规范。
