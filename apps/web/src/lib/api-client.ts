import { client } from "openapi";
import { createServerFn } from "@tanstack/react-start";
import { getActiveEndpoint } from "./server-config";

export interface SerializableRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  bodyType: "text" | "base64" | "none";
}

export interface SerializableResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string | null;
  bodyType: "text" | "base64" | "none";
}

// 序列化 Request 逻辑
export async function serializeRequest(
  req: Request,
  absoluteTargetUrl: string,
): Promise<SerializableRequest> {
  const headersObj: Record<string, string> = {};
  req.headers.forEach((val, key) => {
    // 过滤由传输控制的固有请求头，便于 BFF 发出时自动补充
    if (!["host", "connection", "content-length"].includes(key.toLowerCase())) {
      headersObj[key] = val;
    }
  });

  let bodyStr: string | null = null;
  let bodyType: "text" | "base64" | "none" = "none";

  if (req.body) {
    const contentType = req.headers.get("content-type") || "";
    if (
      contentType.includes("json") ||
      contentType.includes("text") ||
      contentType.includes("xml") ||
      contentType.includes("x-www-form-urlencoded")
    ) {
      bodyStr = await req.clone().text();
      bodyType = "text";
    } else {
      const buffer = await req.clone().arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      bodyStr = btoa(binary);
      bodyType = "base64";
    }
  }

  return {
    url: absoluteTargetUrl,
    method: req.method,
    headers: headersObj,
    body: bodyStr,
    bodyType,
  };
}

// 反序列化 Response 逻辑
export function deserializeResponse(res: SerializableResponse): Response {
  let responseBody: BodyInit | null = null;
  if (res.body !== null) {
    if (res.bodyType === "base64") {
      const binaryString = atob(res.body);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      responseBody = bytes;
    } else {
      responseBody = res.body;
    }
  }

  const responseHeaders = new Headers();
  Object.entries(res.headers).forEach(([key, val]) => {
    responseHeaders.set(key, val);
  });

  return new Response(responseBody, {
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders,
  });
}

// 统一的 BFF Server Function 代理
export const proxyRequestServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: SerializableRequest) => data)
  .handler(async ({ data }: { data: SerializableRequest }) => {
    const startTime = Date.now();
    const { getRequestHeader, setResponseHeader } = await import("@tanstack/react-start/server");
    const headers = new Headers();
    Object.entries(data.headers).forEach(([k, v]) => headers.set(k, v as string));

    // 转发请求客户端已生成的 Cookie 与 UA，维持原有 session
    const cookie = getRequestHeader("cookie");
    if (cookie) headers.set("cookie", cookie);
    const ua = getRequestHeader("user-agent");
    if (ua) headers.set("user-agent", ua);

    // 透传真实的客户端 Origin 与 Referer 头部，解决 Better Auth CSRF 因 Missing Origin 阻断导致的 403
    const origin = getRequestHeader("origin");
    if (origin) {
      headers.set("origin", origin);
    } else if (!headers.has("origin")) {
      headers.set("origin", "http://localhost:3001");
    }
    const referer = getRequestHeader("referer");
    if (referer) {
      headers.set("referer", referer);
    }

    // 控制台输出接收到的请求日志
    console.log(`\n============== [BFF Proxy Request] ==============`);
    console.log(`Method & URL: ${data.method} ${data.url}`);

    // 安全过滤并打印请求头
    const loggedHeaders: Record<string, string> = {};
    headers.forEach((v, k) => {
      const lowerKey = k.toLowerCase();
      if (lowerKey === "authorization") {
        loggedHeaders[k] = v.substring(0, 15) + "... [MASKED]";
      } else if (lowerKey === "cookie") {
        loggedHeaders[k] = v.substring(0, 30) + "... [MASKED]";
      } else {
        loggedHeaders[k] = v;
      }
    });
    console.log(`Headers:`, JSON.stringify(loggedHeaders, null, 2));

    let bodyInit: BodyInit | undefined;
    if (data.body && data.bodyType !== "none") {
      if (data.bodyType === "base64") {
        const binaryString = atob(data.body);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        bodyInit = bytes;
        console.log(`Body: [Base64 Binary] Size: ${bytes.length} bytes`);
      } else {
        bodyInit = data.body;
        // 尝试以 JSON 格式美化打印请求体，并脱敏密码
        try {
          const parsed = JSON.parse(data.body);
          if (parsed && typeof parsed === "object") {
            const sanitized = { ...parsed };
            if ("password" in sanitized) sanitized.password = "******";
            console.log(`Body (JSON):`, JSON.stringify(sanitized, null, 2));
          } else {
            console.log(`Body:`, data.body);
          }
        } catch {
          console.log(`Body:`, data.body);
        }
      }
    }

    const response = await fetch(data.url, {
      method: data.method,
      headers,
      body: bodyInit,
    });

    // BFF 把 Core API 下发的 Set-Cookie 转发到最终的浏览器宿主
    const setCookies = response.headers.getSetCookie?.() || [];
    if (setCookies.length > 0) {
      setResponseHeader("set-cookie", setCookies);
    }

    const duration = Date.now() - startTime;
    console.log(`\n-------------- [BFF Proxy Response] --------------`);
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Duration: ${duration}ms`);
    if (setCookies.length > 0) {
      console.log(`Set-Cookie forwarded:`, setCookies);
    }

    let returnBody = "";
    let returnBodyType: "text" | "base64" | "none" = "none";
    if (response.body) {
      const contentType = response.headers.get("content-type") || "";
      if (
        contentType.includes("json") ||
        contentType.includes("text") ||
        contentType.includes("xml") ||
        contentType.includes("x-www-form-urlencoded")
      ) {
        returnBody = await response.text();
        returnBodyType = "text";
        try {
          const parsed = JSON.parse(returnBody);
          console.log(`Response Body (JSON):`, JSON.stringify(parsed, null, 2));
        } catch {
          console.log(
            `Response Body:`,
            returnBody.substring(0, 500) + (returnBody.length > 500 ? "..." : ""),
          );
        }
      } else {
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        returnBody = btoa(binary);
        returnBodyType = "base64";
        console.log(`Response Body: [Binary Data] Size: ${bytes.length} bytes`);
      }
    }
    console.log(`==================================================\n`);

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((v, k) => {
      // 避免重复设置 Set-Cookie
      if (k !== "set-cookie") {
        responseHeaders[k] = v;
      }
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: returnBody || null,
      bodyType: returnBody ? returnBodyType : "none",
    } as SerializableResponse;
  });

// 客户端 Fetch 拦截集成
const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const isServer = typeof window === "undefined";
  const activeEndpoint = getActiveEndpoint();

  const req = new Request(input, init);
  const parsedUrl = new URL(req.url);
  // 重映射目标 API 地址至选中的 Core API
  const absoluteTargetUrl = `${activeEndpoint.baseUrl}${parsedUrl.pathname}${parsedUrl.search}`;

  // 如果是在服务器端 (SSR / Loader) 或者没有开启 BFF 代理，直接 fetch 发出
  if (isServer || !activeEndpoint.useBffProxy) {
    return fetch(absoluteTargetUrl, init);
  }

  // 序列化后通过 BFF 代理
  const data = await serializeRequest(req, absoluteTargetUrl);
  const res = await proxyRequestServerFn({ data });
  return deserializeResponse(res);
};

client.setConfig({
  fetch: customFetch as any,
  credentials: "include",
});

export { client };
