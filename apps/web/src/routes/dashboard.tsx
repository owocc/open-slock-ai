import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getApiServers, postApiServers } from "openapi";
import { authClient } from "../lib/auth-client";
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

export const Route = createFileRoute("/dashboard")({
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
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [newServerSlug, setNewServerSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

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
      void navigate({ to: "/login" });
      return;
    }
    if (sessionData?.session) {
      void fetchServers();
    }
  }, [sessionData, isPending]);

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
        void navigate({ to: "/dashboard/$serverId", params: { serverId: createdServer.id } });
      }
    } catch (err: any) {
      setError(err?.message || "创建空间失败");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleLogout = async () => {
    await authClient.signOut();
    void navigate({ to: "/login" });
  };

  if (isPending || loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-canvas text-ink font-sans">
        <div className="text-body font-medium animate-pulse">加载中...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas text-ink font-sans">
      {/* 最左侧 Server 图标栏 (系统深色外壳) */}
      <div className="flex w-18 flex-col items-center py-4 bg-surface-dark space-y-3 z-10 border-r border-hairline-strong/10">
        <Link
          to="/dashboard"
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-dark-elevated text-on-dark hover:rounded-xl transition-all border border-hairline-strong/10"
          title="主控台"
        >
          <Users className="h-5 w-5" />
        </Link>
        <div className="w-8 border-b border-on-dark-soft/10 my-1" />

        {/* 服务器列表 */}
        <div className="flex-1 w-full space-y-2 overflow-y-auto px-2">
          {servers.map((srv) => (
            <Link
              key={srv.id}
              to="/dashboard/$serverId"
              params={{ serverId: srv.id }}
              activeProps={{ className: "bg-on-dark text-surface-dark rounded-xl" }}
              inactiveProps={{
                className:
                  "bg-surface-dark-elevated text-on-dark-soft hover:bg-surface-dark-elevated/80 hover:text-on-dark hover:rounded-xl rounded-3xl",
              }}
              className="flex h-12 w-12 items-center justify-center font-semibold transition-all text-xs truncate uppercase border border-hairline-strong/10 cursor-pointer"
              title={srv.name}
            >
              {srv.name.substring(0, 2)}
            </Link>
          ))}

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex h-12 w-12 items-center justify-center rounded-3xl bg-transparent border border-dashed border-on-dark-soft/30 text-on-dark-soft hover:border-on-dark hover:text-on-dark hover:rounded-xl transition-all cursor-pointer"
            title="添加空间"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {/* 退出按钮 */}
        <div
          className="pt-4 text-on-dark-soft hover:text-error transition-colors cursor-pointer"
          onClick={handleLogout}
          title="退出登录"
        >
          <Power className="h-5 w-5" />
        </div>
      </div>

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
  );
}
