import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  getApiServers,
  postApiServers,
  getApiServersByServerIdChannels,
  postApiServersByServerIdChannels,
} from "openapi";
import { authClient } from "../../lib/auth-client";
import { Plus, Power, Users, Hash, Settings, User, Server } from "lucide-react";
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "#/components/ui/dropdown-menu";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
} from "#/components/ui/sidebar";
import {
  getEndpoints,
  mapEndpointIdToRouteId,
  mapRouteIdToEndpointId,
} from "../../lib/server-config";

export const Route = createFileRoute("/$providerId/$serverSlug")({
  component: ServerLayout,
});

interface ServerItem {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  createdAt: string;
}

interface ChannelItem {
  id: string;
  name: string;
  serverId: string;
  createdAt: string;
}

function ServerLayout() {
  const { providerId, serverSlug } = Route.useParams();
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [activeServer, setActiveServer] = useState<ServerItem | null>(null);

  // Modals state
  const [showCreateServerModal, setShowCreateServerModal] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [newServerSlug, setNewServerSlug] = useState("");
  const [createServerLoading, setCreateServerLoading] = useState(false);

  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [createChannelLoading, setCreateChannelLoading] = useState(false);

  const [loadingServers, setLoadingServers] = useState(true);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const providers = getEndpoints();
  const mappedProviderId = mapRouteIdToEndpointId(providerId);
  const activeEp = providers.find((p) => p.id === mappedProviderId) || providers[0];

  const handleSwitchProvider = (p: typeof activeEp) => {
    const routeId = mapEndpointIdToRouteId(p.id);
    window.location.href = `/${routeId}`;
  };

  const handleSwitchServer = (slug: string) => {
    void navigate({
      to: "/$providerId/$serverSlug",
      params: { providerId, serverSlug: slug },
    });
  };

  // Get session
  const { data: sessionData, isPending } = authClient.useSession();

  const fetchServers = async () => {
    try {
      setLoadingServers(true);
      const res = await getApiServers();
      console.log("[Dashboard] getApiServers raw response:", res);

      let serverList: ServerItem[] = [];
      if (Array.isArray(res)) {
        serverList = res as ServerItem[];
      } else if (
        res &&
        typeof res === "object" &&
        "data" in res &&
        Array.isArray((res as any).data)
      ) {
        serverList = (res as any).data;
      }

      if (serverList.length > 0) {
        setServers(serverList);
      } else {
        setServers([]);
      }
    } catch (err) {
      console.error("Failed to fetch servers", err);
      setServers([]);
    } finally {
      setLoadingServers(false);
    }
  };

  const fetchChannels = async (serverId: string) => {
    try {
      setLoadingChannels(true);
      const res = await getApiServersByServerIdChannels({
        path: { serverId },
      });
      console.log("[Dashboard] getApiChannels raw response:", res);

      let channelList: ChannelItem[] = [];
      if (Array.isArray(res)) {
        channelList = res as ChannelItem[];
      } else if (
        res &&
        typeof res === "object" &&
        "data" in res &&
        Array.isArray((res as any).data)
      ) {
        channelList = (res as any).data;
      }

      if (channelList.length > 0) {
        setChannels(channelList);
      } else {
        setChannels([]);
      }
    } catch (err) {
      console.error("Failed to fetch channels", err);
      setChannels([]);
    } finally {
      setLoadingChannels(false);
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

  // Resolve active server from slug
  useEffect(() => {
    if (loadingServers || isPending) return;

    console.log("[Dashboard] Params:", { providerId, serverSlug });
    console.log("[Dashboard] Servers:", servers);

    if (servers.length === 0) {
      console.log("[Dashboard] No servers found, redirecting to root");
      void navigate({
        to: "/$providerId",
        params: { providerId },
      });
      return;
    }

    const match = servers.find((s) => s.slug === serverSlug);
    if (!match) {
      console.log(`[Dashboard] No match for slug "${serverSlug}", redirecting to root`);
      void navigate({
        to: "/$providerId",
        params: { providerId },
      });
      return;
    }

    console.log("[Dashboard] Found match:", match.name);
    setActiveServer(match);
  }, [servers, loadingServers, isPending, serverSlug, providerId, navigate]);

  // Fetch channels when active server changes
  useEffect(() => {
    if (activeServer) {
      void fetchChannels(activeServer.id);
    }
  }, [activeServer]);

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServerName.trim()) return;

    setCreateServerLoading(true);
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
      setShowCreateServerModal(false);
      setNewServerName("");
      setNewServerSlug("");
      await fetchServers();
      if (createdServer && createdServer.slug) {
        void navigate({
          to: "/$providerId/$serverSlug",
          params: { providerId, serverSlug: createdServer.slug },
        });
      }
    } catch (err: any) {
      setError(err?.message || "创建空间失败");
    } finally {
      setCreateServerLoading(false);
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim() || !activeServer) return;

    setCreateChannelLoading(true);
    setError("");
    const formattedName = newChannelName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-");

    try {
      await postApiServersByServerIdChannels({
        path: { serverId: activeServer.id },
        body: {
          name: formattedName,
        },
      });
      setShowCreateChannelModal(false);
      setNewChannelName("");
      await fetchChannels(activeServer.id);
    } catch (err: any) {
      setError(err?.message || "创建频道失败");
    } finally {
      setCreateChannelLoading(false);
    }
  };

  const handleLogout = async () => {
    await authClient.signOut();
    void navigate({ to: "/$providerId/login", params: { providerId } });
  };

  if (isPending || loadingServers || !activeServer) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-canvas text-ink font-sans">
        <div className="text-body font-medium animate-pulse">加载中...</div>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen>
      <div className="flex h-screen w-screen overflow-hidden bg-canvas text-ink font-sans">
        {/* 统一侧边栏：频道列表 + 工作空间切换 */}
        <Sidebar
          collapsible="icon"
          style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
          className="bg-canvas-soft border-r border-hairline shrink-0"
        >
          <SidebarHeader className="p-0 border-b border-hairline">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="flex h-14 items-center justify-between px-4 w-full hover:bg-surface-strong/30 transition-colors cursor-pointer group group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                  title="切换工作空间"
                >
                  <div className="flex items-center gap-2 overflow-hidden group-data-[collapsible=icon]:gap-0">
                    <div className="h-8 w-8 rounded-lg bg-ink text-surface flex items-center justify-center font-bold text-xs shrink-0 shadow-soft group-data-[collapsible=icon]:mx-auto">
                      {activeServer.name.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="text-body-strong text-ink font-bold truncate group-data-[collapsible=icon]:hidden">
                      {activeServer.name}
                    </span>
                  </div>
                  <Users className="h-4 w-4 text-muted group-data-[collapsible=icon]:hidden" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="right"
                align="start"
                sideOffset={4}
                className="w-[320px] p-4 bg-surface text-ink border border-hairline shadow-lg z-[100]"
              >
                <div className="space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold text-ink">切换工作空间</h2>
                    <p className="text-xs text-muted-soft">
                      在当前服务提供商下切换不同的工作空间。
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                        工作空间
                      </h3>
                      <button
                        onClick={() => setShowCreateServerModal(true)}
                        className="text-muted hover:text-ink transition-colors cursor-pointer"
                        title="创建工作空间"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                      {servers.length === 0 ? (
                        <button
                          onClick={() => setShowCreateServerModal(true)}
                          className="w-full text-xs text-muted py-8 text-center bg-canvas/30 rounded border border-dashed border-hairline hover:bg-surface-strong/30 hover:text-ink transition-all cursor-pointer block"
                        >
                          暂无工作空间，点击创建
                        </button>
                      ) : (
                        servers.map((s) => {
                          const isActive = s.id === activeServer.id;
                          return (
                            <div
                              key={s.id}
                              onClick={() => handleSwitchServer(s.slug)}
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
              </PopoverContent>
            </Popover>
          </SidebarHeader>

          {/* 频道列表 */}
          <SidebarContent className="flex-1 overflow-y-auto p-2">
            <div className="px-3 py-2 flex items-center justify-between group-data-[collapsible=icon]:hidden">
              <span className="text-[10px] font-bold text-muted uppercase tracking-widest">
                Channels
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowCreateChannelModal(true)}
                className="h-5 w-5 text-muted hover:text-ink cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {loadingChannels ? (
              <div className="p-3 text-meta text-muted group-data-[collapsible=icon]:hidden">
                载入中...
              </div>
            ) : channels.length === 0 ? (
              <div className="p-3 text-meta text-muted group-data-[collapsible=icon]:hidden">
                暂无频道
              </div>
            ) : (
              <SidebarMenu>
                {channels.map((chan) => (
                  <SidebarMenuItem key={chan.id}>
                    <SidebarMenuButton asChild tooltip={chan.name}>
                      <Link
                        to="/$providerId/$serverSlug/$channelId"
                        params={{ providerId, serverSlug, channelId: chan.id }}
                        activeProps={{
                          className:
                            "bg-surface text-ink font-semibold shadow-soft border border-hairline",
                        }}
                        inactiveProps={{
                          className: "text-muted hover:bg-surface/50 hover:text-ink",
                        }}
                        className="flex items-center space-x-2 px-3 py-1.5 rounded-md text-body transition cursor-pointer"
                      >
                        <Hash className="h-4 w-4 flex-shrink-0 text-muted-soft" />
                        <span className="truncate">{chan.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarContent>

          <SidebarFooter className="p-2 border-t border-hairline group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:py-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1.5 w-full hover:bg-surface-strong/30 transition-colors rounded-md cursor-pointer group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
                  <div className="h-8 w-8 rounded-full bg-surface border border-hairline flex items-center justify-center text-xs font-bold text-muted shrink-0 shadow-sm">
                    {sessionData?.user?.name?.substring(0, 1).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0 text-left group-data-[collapsible=icon]:hidden">
                    <span className="text-xs font-bold text-ink truncate">
                      {sessionData?.user?.name}
                    </span>
                    <span className="text-[10px] text-muted truncate">
                      {sessionData?.user?.email}
                    </span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" sideOffset={12} className="w-64">
                <div className="px-2 py-1.5 border-b border-hairline mb-1">
                  <p className="text-xs font-bold text-ink truncate">{sessionData?.user?.name}</p>
                  <p className="text-[10px] text-muted truncate">{sessionData?.user?.email}</p>
                </div>

                <DropdownMenuItem asChild>
                  <Link
                    to="/$providerId/$serverSlug/settings"
                    params={{ providerId, serverSlug }}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Settings className="h-3.5 w-3.5 text-muted" />
                    <span>工作空间设置</span>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link
                    to="/$providerId/account"
                    params={{ providerId }}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <User className="h-3.5 w-3.5 text-muted" />
                    <span>个人账户中心</span>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer">
                    <Server className="h-3.5 w-3.5 text-muted" />
                    <span className="flex-1 text-left text-xs">{activeEp.name}</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent sideOffset={8} className="min-w-[180px]">
                    {providers.map((p) => {
                      const isActive = p.id === activeEp.id;
                      return (
                        <DropdownMenuItem
                          key={p.id}
                          onSelect={() => handleSwitchProvider(p)}
                          className={`cursor-pointer ${isActive ? "font-semibold" : ""}`}
                        >
                          <span className="truncate flex-1 text-xs">{p.name}</span>
                          {isActive && (
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                          )}
                        </DropdownMenuItem>
                      );
                    })}

                    <DropdownMenuSeparator />

                    <DropdownMenuItem asChild>
                      <Link to="/" className="flex items-center gap-2 cursor-pointer text-muted">
                        <Settings className="h-3 w-3" />
                        <span className="text-xs">管理提供商</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onSelect={handleLogout}
                  className="text-error hover:bg-error/5 cursor-pointer"
                >
                  <Power className="h-3.5 w-3.5" />
                  <span className="text-xs">退出登录</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        {/* 右侧主内容区 */}
        <div className="flex-1 flex flex-col bg-canvas overflow-hidden">
          <Outlet />
        </div>

        {/* 创建服务器模态框 */}
        <Dialog open={showCreateServerModal} onOpenChange={setShowCreateServerModal}>
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateServerModal(false)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={createServerLoading}>
                  {createServerLoading ? "创建中..." : "确认"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* 创建频道模态框 */}
        <Dialog open={showCreateChannelModal} onOpenChange={setShowCreateChannelModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建新频道</DialogTitle>
              <DialogDescription>频道是您的团队进行特定话题交流的地方。</DialogDescription>
            </DialogHeader>

            {error && (
              <div className="p-3 text-sm text-error bg-error/10 rounded border border-error/20">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div>
                <label className="block text-meta text-muted mb-1 font-medium">频道名称</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-3 h-4 w-4 text-muted-soft z-10" />
                  <Input
                    type="text"
                    required
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="例如: general"
                    className="pl-9"
                  />
                </div>
              </div>
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateChannelModal(false)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={createChannelLoading}>
                  {createChannelLoading ? "创建中..." : "确认"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarProvider>
  );
}
