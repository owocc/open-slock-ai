export interface ServerEndpoint {
  id: string;
  name: string;
  baseUrl: string;
  useBffProxy: boolean;
}

export const DEFAULT_ENDPOINT: ServerEndpoint = {
  id: "default-local",
  name: "本地开发服务器",
  baseUrl: "http://localhost:3000",
  useBffProxy: true,
};

const STORAGE_KEYS = {
  ENDPOINTS: "open_slock_endpoints",
  ACTIVE_ID: "open_slock_active_endpoint_id",
};

export function getEndpoints(): ServerEndpoint[] {
  if (typeof window === "undefined") {
    return [DEFAULT_ENDPOINT];
  }
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ENDPOINTS);
    if (!data) {
      // 初始化默认值
      localStorage.setItem(STORAGE_KEYS.ENDPOINTS, JSON.stringify([DEFAULT_ENDPOINT]));
      return [DEFAULT_ENDPOINT];
    }
    const list = JSON.parse(data) as ServerEndpoint[];
    // 确保列表非空
    if (list.length === 0) {
      return [DEFAULT_ENDPOINT];
    }
    return list;
  } catch {
    return [DEFAULT_ENDPOINT];
  }
}

export function saveEndpoints(endpoints: ServerEndpoint[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.ENDPOINTS, JSON.stringify(endpoints));
  } catch {
    console.error("Failed to save endpoints to localStorage");
  }
}

export function getActiveEndpoint(): ServerEndpoint {
  if (typeof window === "undefined") {
    // 服务端渲染时，如果在 BFF 端，可以使用环境配置，或者默认端口
    return {
      ...DEFAULT_ENDPOINT,
      baseUrl: process.env.CORE_API_URL || DEFAULT_ENDPOINT.baseUrl,
    };
  }
  try {
    const activeId = localStorage.getItem(STORAGE_KEYS.ACTIVE_ID);
    const endpoints = getEndpoints();
    const active = endpoints.find((ep) => ep.id === activeId);
    return active || endpoints[0] || DEFAULT_ENDPOINT;
  } catch {
    return DEFAULT_ENDPOINT;
  }
}

export function setActiveEndpointId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, id);
    // 刷新页面，以便重新实例化客户端，保证全站环境一致性
    window.location.reload();
  } catch {
    console.error("Failed to set active endpoint id");
  }
}
