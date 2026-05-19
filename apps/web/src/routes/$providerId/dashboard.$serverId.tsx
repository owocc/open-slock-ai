import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getApiServersByServerIdChannels, postApiServersByServerIdChannels } from "openapi";
import { Hash, Plus } from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
} from "#/components/ui/sidebar";
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

export const Route = createFileRoute("/$providerId/dashboard/$serverId")({
  component: ServerLayout,
});

interface ChannelItem {
  id: string;
  name: string;
  serverId: string;
  createdAt: string;
}

function ServerLayout() {
  const { providerId, serverId } = Route.useParams();
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [loading, setLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const res = await getApiServersByServerIdChannels({
        path: { serverId },
      });
      if (res && Array.isArray(res)) {
        setChannels(res as ChannelItem[]);
      }
    } catch (err) {
      console.error("Failed to fetch channels", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (serverId) {
      void fetchChannels();
    }
  }, [serverId]);

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    setCreateLoading(true);
    setError("");
    const formattedName = newChannelName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-");

    try {
      await postApiServersByServerIdChannels({
        path: { serverId },
        body: {
          name: formattedName,
        },
      });
      setShowCreateChannelModal(false);
      setNewChannelName("");
      await fetchChannels();
    } catch (err: any) {
      setError(err?.message || "创建频道失败");
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden font-sans">
      {/* 中间频道侧栏 (浅色背景层 - 次级面板样式) */}
      <Sidebar
        collapsible="icon"
        style={{ "--sidebar-width": "15rem" } as React.CSSProperties}
        className="bg-canvas-soft border-r border-hairline shrink-0 left-[4.5rem]"
      >
        <SidebarHeader className="p-0">
          <div className="flex h-14 items-center justify-between px-4 border-b border-hairline group-data-[collapsible=icon]:justify-center">
            <span className="text-title text-ink font-semibold group-data-[collapsible=icon]:hidden">
              频道
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowCreateChannelModal(true)}
              className="h-7 w-7 text-muted hover:text-ink cursor-pointer group-data-[collapsible=icon]:hidden"
              title="新建频道"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </SidebarHeader>

        {/* 频道列表 */}
        <SidebarContent className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="p-3 text-meta text-muted group-data-[collapsible=icon]:hidden">
              载入频道中...
            </div>
          ) : channels.length === 0 ? (
            <div className="p-3 text-meta text-muted group-data-[collapsible=icon]:hidden">
              暂无频道，请新建
            </div>
          ) : (
            <SidebarMenu>
              {channels.map((chan) => (
                <SidebarMenuItem key={chan.id}>
                  <SidebarMenuButton asChild tooltip={chan.name}>
                    <Link
                      to="/$providerId/dashboard/$serverId/$channelId"
                      params={{ providerId, serverId, channelId: chan.id }}
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
        <SidebarRail />
      </Sidebar>

      {/* 右侧主聊天面板 */}
      <div className="flex-1 flex flex-col bg-canvas overflow-hidden">
        <Outlet />
      </div>

      {/* 创建频道模态框 (Dialog) */}
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
              <Button type="submit" disabled={createLoading}>
                {createLoading ? "创建中..." : "确认"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
