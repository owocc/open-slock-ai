import { createAuthClient } from "better-auth/react";
import { getActiveEndpoint } from "./server-config";
import { serializeRequest, proxyRequestServerFn, deserializeResponse } from "./api-client";

export const authClient = createAuthClient({
  // baseURL 主要作为 better-fetch 的后备域，其网络请求的绝对 URL 会在 customFetchImpl 中重映射替换
  baseURL: "http://localhost:3000",
  fetchOptions: {
    customFetchImpl: async (url, init) => {
      const activeEndpoint = getActiveEndpoint();
      const isServer = typeof window === "undefined";

      // 提取相对路由，与当前激活的服务器 baseURL 重组为绝对目标地址
      const urlString =
        typeof url === "string"
          ? url
          : url instanceof URL
            ? url.toString()
            : typeof url === "object" && url !== null && "url" in url
              ? (url as any).url
              : String(url);
      const parsedUrl = new URL(urlString);
      const absoluteTargetUrl = `${activeEndpoint.baseUrl}${parsedUrl.pathname}${parsedUrl.search}`;

      // 如果处于 SSR 服务端运行或未开启 BFF 代理，使用直连 fetch
      if (isServer || !activeEndpoint.useBffProxy) {
        return fetch(absoluteTargetUrl, init);
      }

      // CSR 并且是 server-fn 代理转发模式
      const req = new Request(absoluteTargetUrl, init);
      const data = await serializeRequest(req, absoluteTargetUrl);
      const serializedRes = await proxyRequestServerFn({ data });
      return deserializeResponse(serializedRes);
    },
  },
});
