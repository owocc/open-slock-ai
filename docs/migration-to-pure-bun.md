# 从 Nitro 迁移到纯 Bun.serve 运行时的指导文档

## 1. 迁移背景 (Why)

1. **环境与适配器冲突**：在开发阶段启动 Nitro（`nitro dev`）时，Nitro 默认硬编码使用 `nitro-dev` 预设，该预设在启用 `features.websocket` 时会引入 CrossWS 的 Node.js 适配器。当使用 `--bun` 运行时启动时，该适配器会抛出 `[crossws] Using Node.js adapter in an incompatible environment` 错误导致退出。
2. **极简化设计**：为追求极高性能、低内存占用以及原生适配性，我们决定彻底摆脱 Nitro/H3 各种包装框架，转为使用 Bun 官方原生提供的 `Bun.serve(http/websocket)` 机制。

---

## 2. 依赖项变更

在 `apps/server/package.json` 中进行如下调整：

- **移除依赖**：
  - `nitro`
  - `h3`
- **保留/添加依赖**：
  - `better-auth`
  - `drizzle-orm`
  - `dotenv`
  - `drizzle-kit` (dev)

在 `package.json` 的 `scripts` 中将开发与启动脚本修改为纯 Bun 入口：

```json
"scripts": {
  "dev": "bun run --hot server/index.ts",
  "start": "bun run server/index.ts"
}
```

---

## 3. 服务端核心入口迁移 (`server/index.ts`)

新建或直接重构入口 `apps/server/server/index.ts`，使用纯粹的 `Bun.serve` 启动。

### 核心模板实现

```typescript
import { auth } from "./lib/auth";
import { seed } from "./plugins/seed";

// 1. 服务启动时，显式执行数据库初始化 Seed 操作
await seed();

// CORS 跨域辅助响应头
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// 使用 Bun.serve 启动 HTTP 与 WebSocket 监听
const server = Bun.serve({
  port: process.env.PORT || 3000,
  websocket: {
    open(ws) {
      console.log("[WS] Connected");
    },
    async message(ws, message) {
      console.log(`[WS] Received: ${message}`);
      ws.send(`Echo: ${message}`);
    },
    close(ws, code, reason) {
      console.log(`[WS] Closed: ${code} - ${reason}`);
    },
  },
  async fetch(req, server) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // 1) 拦截并处理 CORS Preflight (OPTIONS) 预检请求
    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // 2) 拦截并升级 WebSocket
    if (path === "/api/ws" && req.headers.get("upgrade") === "websocket") {
      const success = server.upgrade(req, {
        data: {
          connectedAt: Date.now(),
        },
      });
      if (success) return undefined; // 手动处理成功，无需返回 Response
    }

    // 3) Better Auth 路由分发 (以 /api/auth/ 开始的所有请求)
    if (path.startsWith("/api/auth/")) {
      const authResponse = await auth.handler(req);
      // 为 Better Auth 响应附加跨域请求头
      const headers = new Headers(authResponse.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
      return new Response(authResponse.body, {
        status: authResponse.status,
        statusText: authResponse.statusText,
        headers,
      });
    }

    // 4) 业务 API 请求路由映射分发
    try {
      // 匹配 GET /api/servers
      if (path === "/api/servers" && method === "GET") {
        return await handleGetServers(req, corsHeaders);
      }

      // 匹配 POST /api/servers
      if (path === "/api/servers" && method === "POST") {
        return await handlePostServers(req, corsHeaders);
      }

      // 匹配 GET /api/servers/:serverId/channels
      const channelsMatch = path.match(/^\/api\/servers\/([^\/]+)\/channels$/);
      if (channelsMatch && method === "GET") {
        const serverId = channelsMatch[1];
        return await handleGetChannels(req, serverId, corsHeaders);
      }

      // 匹配 POST /api/servers/:serverId/channels
      if (channelsMatch && method === "POST") {
        const serverId = channelsMatch[1];
        return await handlePostChannels(req, serverId, corsHeaders);
      }

      // 匹配 POST /api/machines/register
      if (path === "/api/machines/register" && method === "POST") {
        return await handleRegisterMachine(req, corsHeaders);
      }

      // 匹配 POST /api/machines/:machineId/revoke
      const revokeMatch = path.match(/^\/api\/machines\/([^\/]+)\/revoke$/);
      if (revokeMatch && method === "POST") {
        const machineId = revokeMatch[1];
        return await handleRevokeMachine(req, machineId, corsHeaders);
      }

      // 匹配 GET /api/servers/:serverId/agents
      const listAgentsMatch = path.match(/^\/api\/servers\/([^\/]+)\/agents$/);
      if (listAgentsMatch && method === "GET") {
        const serverId = listAgentsMatch[1];
        return await handleGetAgents(req, serverId, corsHeaders);
      }

      // 匹配 POST /api/agents/register
      if (path === "/api/agents/register" && method === "POST") {
        return await handleRegisterAgent(req, corsHeaders);
      }

      // 匹配 GET /api/channels/:channelId/messages
      const getMessagesMatch = path.match(/^\/api\/channels\/([^\/]+)\/messages$/);
      if (getMessagesMatch && method === "GET") {
        const channelId = getMessagesMatch[1];
        return await handleGetMessages(req, channelId, corsHeaders);
      }

      // 匹配 POST /api/channels/:channelId/messages
      if (getMessagesMatch && method === "POST") {
        const channelId = getMessagesMatch[1];
        return await handlePostMessages(req, channelId, corsHeaders);
      }

      // 匹配 GET /api/messages/:messageId/thread
      const getThreadMatch = path.match(/^\/api\/messages\/([^\/]+)\/thread$/);
      if (getThreadMatch && method === "GET") {
        const messageId = getThreadMatch[1];
        return await handleGetThread(req, messageId, corsHeaders);
      }

      // 兜底 404
      return new Response(JSON.stringify({ error: "Route not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("[Route Error]", error);
      return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
});

console.log(`[Bun http] Server listening on http://localhost:${server.port}`);
```

---

## 4. API 控制器代码迁移准则

由于不使用 H3/Nitro，我们有以下原生改动需要注意：

### A. 获取 Query 参数：

在 Nitro 下使用 `getQuery(event)`，在纯 Bun 下应当直接解析 `Request.url`：

```typescript
const url = new URL(req.url);
const paramValue = url.searchParams.get("paramName");
```

### B. 获取 JSON Body：

在 Nitro 下使用 `readBody(event)`，在纯 Bun 下使用：

```typescript
const body = await req.json();
```

### C. 设置带 CORS 及自定义 Header 的 HTTP 状态码响应：

在纯 Bun 下统一通过全局的 `Response` 构造函数构造响应：

```typescript
return new Response(JSON.stringify({ data: "success" }), {
  status: 200,
  headers: {
    ...corsHeaders,
    "Content-Type": "application/json",
  },
});
```

---

## 5. 开发调试

迁移完成后，直接使用以下脚本启动和进行开发热重载校验：

```bash
bun run dev
```

运行后通过 REST Client 和 WebSocket 测试工具连接 `http://localhost:3000/api/ws` 以验证迁移成果。
