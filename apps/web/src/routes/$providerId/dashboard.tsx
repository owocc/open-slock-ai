import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getApiServers, postApiServers } from "openapi";
import { authClient } from "../../lib/auth-client";
import { Plus, Power, Users } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
} from "#/components/ui/sidebar";
import {
  getEndpoints,
  mapEndpointIdToRouteId,
  mapRouteIdToEndpointId,
} from "../../lib/server-config";

export const Route = createFileRoute("/$providerId/dashboard")({
  component: DashboardLayout,
  beforeLoad: async () => {
    // 页面加载前基本验证
  },
});

interface ServerItem {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  createdAt: string;
}

function DashboardLayout() {
  const { providerId } = Route.useParams();
  const routerParams = useParams({ strict: false }) as Record<string, string>;
  const currentServerId = routerParams.serverId;

  const [servers, setServers] = useState<ServerItem[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [newServerSlug, setNewServerSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const providers = getEndpoints();
  const mappedProviderId = mapRouteIdToEndpointId(providerId);
  const activeEp = providers.find((p) => p.id === mappedProviderId) || providers[0];

  const handleSwitchProvider = (p: typeof activeEp) => {
    const routeId = mapEndpointIdToRouteId(p.id);
    window.location.href = `/${routeId}/dashboard`;
  };

  const handleSwitchServer = (id: string) => {
    void navigate({
      to: "/$providerId/dashboard/$serverId",
      params: { providerId, serverId: id },
    });
  };

  // 获取会话信息
  const { data: sessionData, isPending } = authClient.useSession();

  const fetchServers = async () => {
    try {
      setLoading(true);
      const res = await getApiServers();
      if (res && Array.isArray(res)) {
        setServers(res as ServerItem[]);
      }
    } catch (err: any) {
      console.error("Failed to fetch servers", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isPending && !sessionData?.session) {
      void navigate({ to: "/$providerId/login", params: { providerId } });
      return;
    }
    if (sessionData?.session) {
      void fetchServers();
    }
  }, [sessionData, isPending, providerId]);

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServerName.trim()) return;

    setCreateLoading(true);
    setError("");
    const slugValue =
      newServerSlug.trim() ||
      newServerName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");

    try {
      const res = await postApiServers({
        body: {
          name: newServerName,
          slug: slugValue,
        },
      });
      const createdServer = res as any;
      setShowCreateModal(false);
      setNewServerName("");
      setNewServerSlug("");
      await fetchServers();
      if (createdServer && createdServer.id) {
        void navigate({
          to: "/$providerId/dashboard/$serverId",
          params: { providerId, serverId: createdServer.id },
        });
      }
    } catch (err: any) {
      setError(err?.message || "创建空间失败");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleLogout = async () => {
    await authClient.signOut();
    void navigate({ to: "/$providerId/login", params: { providerId } });
  };

  if (isPending || loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-canvas text-ink font-sans">
        <div className="text-body font-medium animate-pulse">加载中...</div>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen>
      <div className="flex h-screen w-screen overflow-hidden bg-canvas text-ink font-sans">
        {/* 最左侧 Server 图标栏 */}
        <Sidebar
          collapsible="none"
          style={{ "--sidebar-width": "4.5rem" } as React.CSSProperties}
          className="bg-canvas-soft border-r border-hairline flex flex-col items-center z-20 shrink-0 text-ink"
        >
          <SidebarHeader className="p-0 py-4 flex flex-col items-center space-y-3 w-full">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface text-ink hover:bg-surface-strong/50 hover:rounded-xl transition-all border border-hairline shadow-soft cursor-pointer"
                  title="切换提供商与工作空间"
                >
                  <Users className="h-5 w-5" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="right"
                align="start"
                sideOffset={12}
                className="w-[480px] p-4 bg-surface text-ink border border-hairline shadow-lg"
              >
                <div className="space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold text-ink">切换协作空间</h2>
                    <p className="text-xs text-muted-soft">
                      在下方选择服务提供商，或切换当前提供商下的工作空间与团队。
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-1 divide-x divide-hairline">
                    {/* 左侧：选择服务提供商 (Providers) */}
                    <div className="space-y-3 pr-2">
                      <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                        服务提供商
                      </h3>
                      <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                        {providers.map((p) => {
                          const isActive = p.id === activeEp.id;
                          return (
                            <div
                              key={p.id}
                              onClick={() => handleSwitchProvider(p)}
                              className={`p-2 rounded-md border text-left cursor-pointer transition-all flex items-center justify-between group ${
                                isActive
                                  ? "border-emerald-600 bg-emerald-50/10 text-emerald-600 font-medium"
                                  : "border-hairline hover:bg-surface-strong/30"
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold truncate">{p.name}</div>
                                <div className="text-[9px] text-muted truncate">{p.baseUrl}</div>
                              </div>
                              {isActive && (
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 ml-1.5" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 右侧：选择空间服务器 (Servers) */}
                    <div className="space-y-3 pl-3">
                      <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                        空间服务器
                      </h3>
                      <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                        {servers.length === 0 ? (
                          <div className="text-xs text-muted py-8 text-center bg-canvas/30 rounded border border-dashed border-hairline">
                            暂无空间服务器 (暂无可用空间)
                          </div>
                        ) : (
                          servers.map((s) => {
                            const isActive = s.id === currentServerId;
                            return (
                              <div
                                key={s.id}
                                onClick={() => handleSwitchServer(s.id)}
                                className={`p-2 rounded-md border text-left cursor-pointer transition-all flex items-center justify-between group ${
                                  isActive
                                    ? "border-ink-soft bg-surface-strong/60 font-semibold"
                                    : "border-hairline hover:bg-surface-strong/30"
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-semibold text-ink truncate">
                                    {s.name}
                                  </div>
                                  <div className="text-[9px] text-muted truncate">/{s.slug}</div>
                                </div>
                                {isActive && (
                                  <div className="h-1.5 w-1.5 rounded-full bg-ink shrink-0 ml-1.5" />
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <div className="w-8 border-b border-hairline my-1" />
          </SidebarHeader>

          {/* 服务器列表 */}
          <SidebarContent className="flex-1 w-full space-y-2 overflow-y-auto px-2">
            {servers.map((srv) => (
              <Link
                key={srv.id}
                to="/$providerId/dashboard/$serverId"
                params={{ providerId, serverId: srv.id }}
                activeProps={{ className: "bg-ink text-surface rounded-xl shadow-soft" }}
                inactiveProps={{
                  className:
                    "bg-surface text-muted hover:bg-surface-strong hover:text-ink hover:rounded-xl rounded-3xl",
                }}
                className="flex h-12 w-12 items-center justify-center font-semibold transition-all text-xs truncate uppercase border border-hairline cursor-pointer"
                title={srv.name}
              >
                {srv.name.substring(0, 2)}
              </Link>
            ))}

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex h-12 w-12 items-center justify-center rounded-3xl bg-transparent border border-dashed border-hairline-strong text-muted hover:border-ink hover:text-ink hover:rounded-xl transition-all cursor-pointer"
              title="添加空间"
            >
              <Plus className="h-5 w-5" />
            </button>
          </SidebarContent>

          {/* 退出按钮 */}
          <SidebarFooter className="py-4 flex items-center justify-center">
            <div
              className="text-muted hover:text-error transition-colors cursor-pointer"
              onClick={handleLogout}
              title="退出登录"
            >
              <Power className="h-5 w-5" />
            </div>
          </SidebarFooter>
        </Sidebar>

        {/* 主工作区视图 */}
        <div className="flex-1 flex overflow-hidden">
          <Outlet />
        </div>

        {/* 创建服务器模态框 (使用标准的 Dialog 组件封装) */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建新工作空间</DialogTitle>
              <DialogDescription>创建一个新的项目或团队专属空间来共同协作。</DialogDescription>
            </DialogHeader>

            {error && (
              <div className="p-3 text-sm text-error bg-error/10 rounded border border-error/20">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateServer} className="space-y-4">
              <div>
                <label className="block text-meta text-muted mb-1 font-medium">空间名称</label>
                <Input
                  type="text"
                  required
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  placeholder="例如: 极力开发组"
                />
              </div>
              <div>
                <label className="block text-meta text-muted mb-1 font-medium">
                  唯一标识符 (Slug)
                </label>
                <Input
                  type="text"
                  value={newServerSlug}
                  onChange={(e) => setNewServerSlug(e.target.value)}
                  placeholder="例如: team-core (选填)"
                />
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={createLoading}>
                  {createLoading ? "创建中..." : "确认"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarProvider>
  );
}
