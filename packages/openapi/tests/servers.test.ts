import { expect, test, vi } from "vite-plus/test";
import { client, getApiServers, postApiServers } from "../src/index.ts";

test("getApiServers should send GET request to /api/servers", async () => {
  const mockServers = [
    {
      id: "srv-1",
      name: "Mock Server 1",
      slug: "mock-1",
      isDefault: true,
      createdAt: "2026-05-20T00:00:00.000Z",
    },
  ];

  const fetchSpy = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      headers: new Headers({ "Content-Type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify(mockServers)),
    } as Response),
  );

  // 配置全局 SDK client 实例使用 mock fetch
  const originalFetch = client.getConfig().fetch;
  client.setConfig({ fetch: fetchSpy });

  try {
    const res = await getApiServers({ responseStyle: "data" });
    expect(res).toEqual(mockServers);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const callArg = fetchSpy.mock.calls[0][0];
    expect(callArg).toBeInstanceOf(Request);
    const req = callArg as Request;
    expect(req.url).toBe("http://localhost:3000/api/servers");
    expect(req.method).toBe("GET");
  } finally {
    // 恢复原有 fetch 配置以防污染其他测试
    client.setConfig({ fetch: originalFetch });
  }
});

test("postApiServers should send POST request with body parameters", async () => {
  const mockCreatedServer = {
    id: "srv-new",
    name: "New Workspace",
    slug: "new-workspace",
    isDefault: false,
    createdAt: "2026-05-20T00:00:00.000Z",
  };

  const fetchSpy = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      headers: new Headers({ "Content-Type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify(mockCreatedServer)),
    } as Response),
  );

  const originalFetch = client.getConfig().fetch;
  client.setConfig({ fetch: fetchSpy });

  try {
    const serverPayload = { name: "New Workspace", slug: "new-workspace" };
    const res = await postApiServers({
      body: serverPayload,
      responseStyle: "data",
    });

    expect(res).toEqual(mockCreatedServer);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const callArg = fetchSpy.mock.calls[0][0];
    expect(callArg).toBeInstanceOf(Request);
    const req = callArg as Request;
    expect(req.url).toBe("http://localhost:3000/api/servers");
    expect(req.method).toBe("POST");

    const bodyText = await req.text();
    expect(JSON.parse(bodyText)).toEqual(serverPayload);
  } finally {
    client.setConfig({ fetch: originalFetch });
  }
});
