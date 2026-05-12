# 0004. Realtime 用 Supabase Broadcast 公开通道

- 状态：accepted
- 日期：2026-05-12

## 背景

Web UI 和 Bridge 都需要感知"频道里有新消息"。可选方案：

- **HTTP 短轮询**：简单但延迟大、请求浪费。
- **Postgres LISTEN/NOTIFY + 独立 WebSocket 服务**：需要常驻进程，与 Vercel Serverless 不兼容。
- **Supabase Realtime Postgres Changes**：订阅 `messages` 表变更，但依赖 JWT + RLS，与 better-auth 的 session 体系不互通。
- **Supabase Realtime Broadcast**：pub/sub，消息由 Server 显式发布，订阅端无需 JWT。

## 决策

MVP 用 **Supabase Realtime Broadcast 公开通道**：

1. Server 写入 `messages` 成功后，向 `channel:<channelId>` 广播一个**通知事件**：
   ```json
   { "event": "message.new", "channelId": "xxx", "seq": 42 }
   ```
2. Web UI 订阅自己可见的 channel 列表，收到通知后 HTTP 拉取 `GET /api/channels/:id/messages?after=<seq>`。
3. Bridge 订阅自己负责的 machine 对应 Agent 的所有 channel，收到通知后 HTTP 拉 `GET /api/machines/:id/pending`。

**通道中不承载业务数据**，只传"有新消息"的轻通知。即使匿名订阅到通知，也无法获得消息内容——业务数据的访问控制在 HTTP API 层由 better-auth session / machine key 把守。

### 升级路径（非 MVP）

- **ADR-0005 待办**：better-auth 集成 Supabase JWT（HS256 共享 secret，signer 产生 `sub` / `aud: authenticated` claims）。
- 升级后可切换到 **Private Channels**，并启用 RLS 做细粒度订阅授权。
- 切换是加法：`supabase.channel(name, { config: { private: true } })`，不需要重构数据流。

## 理由

- **绕开 Vercel 长连接限制**：Broadcast 的 WebSocket 由 Supabase Realtime 服务维持，Vercel 只跑 HTTP 写入 + 广播 publish。
- **不与 better-auth 冲突**：公开通道无需 JWT。
- **通道瘦身**：不传业务 payload，避免订阅/接口的数据 schema 双写。
- **本地调试完全可复现**：`supabase start` 启动的 Realtime 容器与云端一致。
- **升级路径清晰**：公开 → 私有是一次配置切换 + JWT 插件启用，不涉及业务代码改动。

## 后果

- **正面**：Web UI 的消息延迟接近实时（通知到达后单次 HTTP 拉取），无轮询浪费。
- **正面**：测试环境完全离线可跑。
- **负面**：任何人拿到 anon key 就能订阅"有新消息"的事件流（但看不到内容），属于可接受的信息泄漏（谁在说话的时序）。MVP 之后升级私有通道解决。
- **负面**：广播失败时（网络抖动、Realtime 短暂不可用）客户端不会自动补齐，需要客户端在 focus/reconnect 时做一次 HTTP 拉取兜底。
- **需要注意**：Server 写数据库与广播是两次网络调用，非原子。若广播失败，消息仍在 DB，依赖客户端兜底拉取。MVP 接受这个一致性模型。
