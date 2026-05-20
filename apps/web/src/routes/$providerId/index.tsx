import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getApiServers, postApiServers } from "openapi";
import { authClient } from "../../lib/auth-client";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";

export const Route = createFileRoute("/$providerId/")({
  component: ProviderIndex,
});

interface ServerItem {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  createdAt: string;
}

function ProviderIndex() {
  const { providerId } = Route.useParams();
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [newServerSlug, setNewServerSlug] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const { data: sessionData, isPending } = authClient.useSession();

  const fetchServers = async () => {
    try {
      setLoading(true);
      const res = await getApiServers();

      let list: ServerItem[] = [];
      if (Array.isArray(res)) {
        list = res as ServerItem[];
      } else if (
        res &&
        typeof res === "object" &&
        "data" in res &&
        Array.isArray((res as any).data)
      ) {
        list = (res as any).data;
      }

      setServers(list);
      if (list.length > 0) {
        const firstServer = list.find((s) => s.isDefault) || list[0];
        void navigate({
          to: "/$providerId/$serverSlug",
          params: { providerId, serverSlug: firstServer.slug },
        });
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
      if (createdServer && createdServer.slug) {
        void navigate({
          to: "/$providerId/$serverSlug",
          params: { providerId, serverSlug: createdServer.slug },
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

  // 如果没有服务器，显示创建首个空间的界面
  if (servers.length === 0) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-canvas text-ink font-sans p-4">
        <div className="w-full max-w-sm bg-surface border border-hairline rounded-2xl shadow-soft p-6 space-y-6">
          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">创建您的首个工作空间</h1>
            <p className="text-xs text-muted leading-relaxed">
              当前提供商账号尚未创建任何空间服务器。您需要至少创建一个空间服务器才能进入工作台。
            </p>
          </div>

          {error && (
            <div className="p-3 text-xs text-error bg-error/10 rounded border border-error/20">
              {error}
            </div>
          )}

          <form onSubmit={handleCreateServer} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-meta text-muted font-medium">空间名称</label>
              <Input
                type="text"
                required
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
                placeholder="例如: 极力开发组"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-meta text-muted font-medium">
                唯一标识符 (Slug) (可空)
              </label>
              <Input
                type="text"
                value={newServerSlug}
                onChange={(e) => setNewServerSlug(e.target.value)}
                placeholder="例如: team-core"
              />
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <Button type="submit" disabled={createLoading} className="w-full font-medium">
                {createLoading ? "创建中..." : "创建并开始使用"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full text-muted hover:text-ink font-medium"
                onClick={handleLogout}
              >
                退出登录
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return null;
}
