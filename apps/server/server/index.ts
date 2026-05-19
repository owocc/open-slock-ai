import { Hono } from "hono";
import { cors } from "hono/cors";
import { createBunWebSocket } from "hono/bun";
import { auth } from "./lib/auth";
import { seed } from "./seed";
import { handleIndex } from "./api/index";
import { handleRegisterAgent, RegisterAgentSchema } from "./api/agents/register.post";
import { handleRegisterMachine, RegisterMachineSchema } from "./api/machines/register.post";
import { handleRevokeMachine } from "./api/machines/[machineId]/revoke.post";
import { handleGetServers } from "./api/servers/index.get";
import { handlePostServers, CreateServerSchema } from "./api/servers/index.post";
import { handleGetChannels } from "./api/servers/[serverId]/channels/index.get";
import {
  handlePostChannels,
  CreateChannelSchema,
} from "./api/servers/[serverId]/channels/index.post";
import { handleGetAgents } from "./api/servers/[serverId]/agents/index.get";
import { handleGetMessages } from "./api/channels/[channelId]/messages/index.get";
import {
  handlePostMessages,
  PostMessageSchema,
} from "./api/channels/[channelId]/messages/index.post";
import { handleGetThread } from "./api/messages/[messageId]/thread.get";
import { ResponseError } from "./utils/auth";

import { swaggerUI } from "@hono/swagger-ui";
import { apiReference } from "@scalar/hono-api-reference";
import { describeRoute, validator as zValidator, resolver, generateSpecs } from "hono-openapi";
import "zod-openapi/extend";

// 1. 服务启动时，显式执行数据库初始化 Seed 操作
await seed();

const app = new Hono();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// 预留 of CORS 跨域辅助中间件
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

// WebSocket 初始化
const { upgradeWebSocket, websocket } = createBunWebSocket();

app.get(
  "/api/ws",
  upgradeWebSocket(() => ({
    onOpen(_evt, _ws) {
      console.log("[WS] Connected");
    },
    async onMessage(evt, ws) {
      const message = evt.data;
      const msgStr =
        typeof message === "string" ? message : new TextDecoder().decode(message as ArrayBuffer);
      console.log(`[WS] Received: ${msgStr}`);
      ws.send(`Echo: ${msgStr}`);
    },
    onClose(evt, _ws) {
      console.log(`[WS] Closed: ${evt.code} - ${evt.reason}`);
    },
  })),
);

// Better Auth 路由代理
app.on(["GET", "POST"], "/api/auth/*", async (c) => {
  const authResponse = await auth.handler(c.req.raw);
  const headers = new Headers(authResponse.headers);
  Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
  return new Response(authResponse.body, {
    status: authResponse.status,
    statusText: authResponse.statusText,
    headers,
  });
});

// 业务路由映射
app.get(
  "/api",
  describeRoute({
    summary: "API 根目录",
    description: "用于测试 API 连通性",
    responses: {
      200: { description: "API 连通正常" },
    },
  }),
  async (c) => c.json(await handleIndex(c.req.raw)),
);

app.get(
  "/api/servers",
  describeRoute({
    summary: "获取服务器列表",
    description: "获取当前用户参与的所有服务器空间",
    responses: {
      200: { description: "成功获取服务器列表" },
    },
  }),
  async (c) => c.json(await handleGetServers(c.req.raw)),
);

app.post(
  "/api/servers",
  describeRoute({
    summary: "创建服务器",
    description: "创建一个新的频道服务器空间，并将创建者归为管理员成员",
    responses: {
      200: {
        description: "服务器创建完成",
        content: {
          "application/json": {
            schema: resolver(CreateServerSchema),
          },
        },
      },
      400: { description: "输入校验未通过" },
    },
  }),
  zValidator("json", CreateServerSchema),
  async (c) => {
    const data = c.req.valid("json" as any);
    return c.json(await handlePostServers(c.req.raw, data));
  },
);

app.get(
  "/api/servers/:serverId/channels",
  describeRoute({
    summary: "获取频道列表",
    description: "获取指定服务器空间内的所有文字聊天频道",
    responses: {
      200: { description: "成功获取频道列表" },
    },
  }),
  async (c) => {
    const serverId = c.req.param("serverId");
    return c.json(await handleGetChannels(c.req.raw, serverId));
  },
);

app.post(
  "/api/servers/:serverId/channels",
  describeRoute({
    summary: "创建频道",
    description: "在指定服务器中创建一个新的文本对话频道",
    responses: {
      200: {
        description: "频道创建完成",
        content: {
          "application/json": {
            schema: resolver(CreateChannelSchema),
          },
        },
      },
      400: { description: "输入校验未通过" },
    },
  }),
  zValidator("json", CreateChannelSchema),
  async (c) => {
    const serverId = c.req.param("serverId");
    const data = c.req.valid("json" as any);
    return c.json(await handlePostChannels(c.req.raw, serverId, data));
  },
);

app.post(
  "/api/machines/register",
  describeRoute({
    summary: "注册受控物理机器机台",
    description:
      "在所属的服务器空间下新注册一个工作机器实例，并发放 Machine 校验主密钥 （sk_slock_*）",
    responses: {
      200: {
        description: "物理机台注册成功并返回密钥对",
        content: {
          "application/json": {
            schema: resolver(RegisterMachineSchema),
          },
        },
      },
      400: { description: "输入校验未通过" },
    },
  }),
  zValidator("json", RegisterMachineSchema),
  async (c) => {
    const data = c.req.valid("json" as any);
    return c.json(await handleRegisterMachine(c.req.raw, data));
  },
);

app.post(
  "/api/machines/:machineId/revoke",
  describeRoute({
    summary: "吊销物理机台",
    description: "吊销指定物理机台的鉴权凭证",
    responses: {
      200: { description: "吊销成功" },
    },
  }),
  async (c) => {
    const machineId = c.req.param("machineId");
    return c.json(await handleRevokeMachine(c.req.raw, machineId));
  },
);

app.get(
  "/api/servers/:serverId/agents",
  describeRoute({
    summary: "获取机器下的智能体列表",
    description: "获取绑定在特定服务器空间的所有智能体实例",
    responses: {
      200: { description: "成功获取智能体列表" },
    },
  }),
  async (c) => {
    const serverId = c.req.param("serverId");
    return c.json(await handleGetAgents(c.req.raw, serverId));
  },
);

app.post(
  "/api/agents/register",
  describeRoute({
    summary: "注册智能体",
    description: "由绑定在目标服务器机台上的运行守护进程上报并注册/更新智能体实例",
    responses: {
      200: {
        description: "智能体注册或更新成功",
        content: {
          "application/json": {
            schema: resolver(RegisterAgentSchema),
          },
        },
      },
      400: { description: "输入校验未通过" },
    },
  }),
  zValidator("json", RegisterAgentSchema),
  async (c) => {
    const data = c.req.valid("json" as any);
    return c.json(await handleRegisterAgent(c.req.raw, data));
  },
);

app.get(
  "/api/channels/:channelId/messages",
  describeRoute({
    summary: "获取频道消息",
    description: "获取特定聊天频道内的历史消息消息列表",
    responses: {
      200: { description: "成功获取历史消息" },
    },
  }),
  async (c) => {
    const channelId = c.req.param("channelId");
    return c.json(await handleGetMessages(c.req.raw, channelId));
  },
);

app.post(
  "/api/channels/:channelId/messages",
  describeRoute({
    summary: "发送频道消息",
    description: "在指定频道中发送文本消息内容，可附带父级节点及 Mentions 信息",
    responses: {
      200: {
        description: "消息投放成功并返回带有 UUID 的消息对象",
        content: {
          "application/json": {
            schema: resolver(PostMessageSchema),
          },
        },
      },
      400: { description: "参数检验未通过 / 防止循环触发超出深度限制" },
    },
  }),
  zValidator("json", PostMessageSchema),
  async (c) => {
    const channelId = c.req.param("channelId");
    const data = c.req.valid("json" as any);
    return c.json(await handlePostMessages(c.req.raw, channelId, data));
  },
);

app.get(
  "/api/messages/:messageId/thread",
  describeRoute({
    summary: "获取消息会话线程",
    description: "获取针对单条消息展开的回复会话链",
    responses: {
      200: { description: "成功获取话题线程消息" },
    },
  }),
  async (c) => {
    const messageId = c.req.param("messageId");
    return c.json(await handleGetThread(c.req.raw, messageId));
  },
);

function mergeOpenAPISchemas(honoSchema: any, authSchema: any) {
  const merged = { ...honoSchema };

  // 1. 合并路径 (Paths)，并为 Better Auth 接口路径加 "/api/auth" 前缀
  merged.paths = { ...merged.paths };
  if (authSchema && authSchema.paths) {
    for (const [pathKey, pathItem] of Object.entries(authSchema.paths)) {
      const prefixedKey = `/api/auth${pathKey}`;

      const patchedPathItem = { ...(pathItem as any) };
      for (const method of Object.keys(patchedPathItem)) {
        if (typeof patchedPathItem[method] === "object" && patchedPathItem[method] !== null) {
          patchedPathItem[method] = {
            ...patchedPathItem[method],
            tags: ["Authentication"],
          };
        }
      }

      merged.paths[prefixedKey] = patchedPathItem;
    }
  }

  // 2. 合并基础组件 (Components)
  merged.components = merged.components || {};

  // 合并数据模型 (Schemas)
  if (authSchema && authSchema.components?.schemas) {
    merged.components.schemas = {
      ...merged.components.schemas,
      ...authSchema.components.schemas,
    };
  }

  // 合并安全方案 (Security Schemes)
  if (authSchema && authSchema.components?.securitySchemes) {
    merged.components.securitySchemes = {
      ...merged.components.securitySchemes,
      ...authSchema.components.securitySchemes,
    };
  }

  return merged;
}

// 挂载 OpenAPI Docs JSON 规范导出端点
app.get("/api/openapi.json", async (c) => {
  const honoSchema = await generateSpecs(
    app,
    {
      documentation: {
        info: {
          title: "Slock AI API 服务",
          version: "1.0.0",
          description: "开源自托管 AI 服务端接口 API 说明文档",
        },
        servers: [{ url: "http://localhost:3000", description: "本地开发服务器" }],
      },
    },
    c,
  );

  let authSchema: any = {};
  try {
    if (typeof auth.api?.generateOpenAPISchema === "function") {
      authSchema = await auth.api.generateOpenAPISchema();
    }
  } catch (error) {
    console.error("Failed to generate Better Auth OpenAPI schema:", error);
  }

  const mergedSchema = mergeOpenAPISchemas(honoSchema, authSchema);
  return c.json(mergedSchema);
});

// 挂载 Swagger UI 终点界面
app.get("/api/docs", swaggerUI({ url: "/api/openapi.json" }));

// 挂载 Scalar 接口可视化 UI 终点界面
app.get(
  "/api/scalar",
  apiReference({
    spec: {
      url: "/api/openapi.json",
    },
  }),
);

// 统一错误处理
app.onError((err, c) => {
  if (err instanceof ResponseError) {
    return c.json({ error: err.message }, err.status as any);
  }
  console.error("[Route Error]", err);
  return c.json({ error: err.message || "Internal Server Error" }, 500);
});

// 统一 404 兜底处理
app.notFound((c) => {
  return c.json({ error: "Route not found" }, 404);
});

// 使用 Bun 托管 Hono 应用
const server = Bun.serve({
  port: process.env.PORT || 3000,
  fetch: app.fetch,
  websocket,
});

console.log(`[Bun http] Server listening on http://localhost:${server.port}`);
