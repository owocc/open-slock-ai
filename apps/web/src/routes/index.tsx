import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Server, Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import {
  type ServerEndpoint,
  getEndpoints,
  saveEndpoints,
  getActiveEndpoint,
  mapEndpointIdToRouteId,
  isPrimaryServer,
} from "../lib/server-config";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";

export const Route = createFileRoute("/")({ component: Home });

interface PingStats {
  status: "testing" | "online" | "offline";
  latency: number | null;
}

function Home() {
  const [endpoints, setEndpoints] = useState<ServerEndpoint[]>([]);
  const [activeEp, setActiveEp] = useState<ServerEndpoint | null>(null);
  const [pings, setPings] = useState<Record<string, PingStats>>({});
  const [isTestingAll, setIsTestingAll] = useState(false);

  // 表单状态
  const [showForm, setShowForm] = useState(false);
  const [editingEp, setEditingEp] = useState<ServerEndpoint | null>(null);
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formUseBff, setFormUseBff] = useState(true);
  const [formError, setFormError] = useState("");

  const refreshData = () => {
    const list = getEndpoints();
    setEndpoints(list);
    setActiveEp(getActiveEndpoint());
    return list;
  };

  const runPingTests = async (list: ServerEndpoint[]) => {
    setIsTestingAll(true);
    // 初始化所有节点状态为测试中
    const initialPings = { ...pings };
    for (const ep of list) {
      initialPings[ep.id] = { status: "testing", latency: null };
    }
    setPings(initialPings);

    // 并发测试每个节点的连通性
    await Promise.all(
      list.map(async (ep) => {
        const start = performance.now();
        try {
          // 利用 AbortController 控制 3 秒超时
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);

          await fetch(`${ep.baseUrl}/api`, {
            mode: "no-cors",
            signal: controller.signal,
            credentials: "omit",
          });

          clearTimeout(timeoutId);
          const duration = Math.round(performance.now() - start);

          setPings((prev) => ({
            ...prev,
            [ep.id]: { status: "online", latency: duration },
          }));
        } catch {
          setPings((prev) => ({
            ...prev,
            [ep.id]: { status: "offline", latency: null },
          }));
        }
      }),
    );
    setIsTestingAll(false);
  };

  useEffect(() => {
    const currentList = refreshData();
    void runPingTests(currentList);
  }, []);

  const handleSelect = (ep: ServerEndpoint) => {
    const routeId = mapEndpointIdToRouteId(ep.id);
    // 通过路由路径跳转，完成重映射与全局状态重置
    window.location.href = `/${routeId}`;
  };

  const handleStartCreate = () => {
    setEditingEp(null);
    setFormName("");
    setFormUrl("http://");
    setFormUseBff(true);
    setFormError("");
    setShowForm(true);
  };

  const handleStartEdit = (ep: ServerEndpoint, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEp(ep);
    setFormName(ep.name);
    setFormUrl(ep.baseUrl);
    setFormUseBff(ep.useBffProxy);
    setFormError("");
    setShowForm(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formName.trim() || !formUrl.trim()) {
      setFormError("服务名称与接口连接 URL 不能为空");
      return;
    }

    try {
      new URL(formUrl);
    } catch {
      setFormError("请输入正确的 URL 主机地址（包含 http:// 或 https://）");
      return;
    }

    const cleanUrl = formUrl.replace(/\/$/, "");

    let updatedList: ServerEndpoint[];
    if (editingEp) {
      // 禁止更新保护的主节点 ID 和 URL
      if (isPrimaryServer(editingEp.id)) {
        setFormError("系统内置主节点配置不可更改");
        return;
      }

      updatedList = endpoints.map((ep) =>
        ep.id === editingEp.id
          ? { ...ep, name: formName.trim(), baseUrl: cleanUrl, useBffProxy: formUseBff }
          : ep,
      );
    } else {
      const newEp: ServerEndpoint = {
        id: `custom-${Date.now()}`,
        name: formName.trim(),
        baseUrl: cleanUrl,
        useBffProxy: formUseBff,
      };
      updatedList = [...endpoints, newEp];
    }

    saveEndpoints(updatedList);
    setShowForm(false);
    const refreshed = refreshData();
    void runPingTests(refreshed);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (isPrimaryServer(id)) {
      alert("系统主服务提供商（Primary）是核心内置配置，不可被删除或卸载");
      return;
    }

    if (activeEp?.id === id) {
      alert("无法删除当前正在激活选中的工作提供商连接，请先进行切换");
      return;
    }

    if (confirm("确定要删除该服务器提供商配置吗？")) {
      const updated = endpoints.filter((ep) => ep.id !== id);
      saveEndpoints(updated);
      const refreshed = refreshData();
      void runPingTests(refreshed);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink font-sans">
      {/* 顶部优雅 Header */}
      <header className="border-b border-hairline bg-surface py-4 px-6 md:px-12 flex items-center justify-between shadow-soft">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-ink-soft rounded-lg flex items-center justify-center text-white font-mono font-bold tracking-wider select-none shrink-0 shadow-sm text-sm">
            OS
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight text-ink">OpenSlock</h1>
            <p className="text-[10px] text-muted tracking-wider uppercase font-medium">
              自托管Agent协作中心
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void runPingTests(endpoints)}
            disabled={isTestingAll}
            className="gap-1.5 h-8 text-xs px-2.5"
          >
            <RefreshCw className={`h-3 w-3 ${isTestingAll ? "animate-spin" : ""}`} />
            刷新测速
          </Button>

          <Button onClick={handleStartCreate} size="sm" className="gap-1.5 h-8 text-xs px-2.5">
            <Plus className="h-3 w-3" />
            新增提供商
          </Button>
        </div>
      </header>

      {/* 主展示区 */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 md:py-16 space-y-8 animate-in fade-in duration-200">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-ink">服务器提供商管理</h2>
          <p className="text-sm text-muted leading-relaxed max-w-2xl">
            OpenSlock 采用分布式集群设计，支持链接任何兼容 API 规范的服务实例进行认证。
            在下方查看当前可用的实例服务状态并自主选择切换。
          </p>
        </div>

        {/* 提供商卡网格 */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {endpoints.map((ep) => {
            const isPrimary = ep.id === "default-local";
            const isActive = activeEp?.id === ep.id;
            const ping = pings[ep.id];

            return (
              <div
                key={ep.id}
                onClick={() => handleSelect(ep)}
                className={`relative group flex flex-col justify-between p-5 rounded-lg border bg-surface cursor-pointer select-none transition-all duration-200 ${
                  isActive
                    ? "border-emerald-600 shadow-soft ring-1 ring-emerald-500/10"
                    : "border-hairline hover:border-hairline-strong hover:shadow-soft hover:translate-y-[-1px]"
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-ink group-hover:text-ink-soft transition-colors line-clamp-1">
                          {ep.name}
                        </span>
                        {isPrimary && (
                          <span className="text-[10px] select-none text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded font-medium border border-blue-105 shrink-0">
                            Primary
                          </span>
                        )}
                        {isActive && (
                          <span className="text-[10px] select-none text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded font-medium border border-emerald-105 shrink-0">
                            当前激活
                          </span>
                        )}
                      </div>
                      <span
                        className="block font-mono text-[11px] text-muted-soft truncate max-w-[200px]"
                        title={ep.baseUrl}
                      >
                        {ep.baseUrl}
                      </span>
                    </div>

                    <div className="h-8 w-8 bg-canvas rounded-lg flex items-center justify-center shrink-0">
                      <Server className="h-4 w-4 text-muted" />
                    </div>
                  </div>

                  {/* 测速状态区域 */}
                  <div className="flex items-center gap-1.5">
                    {ping?.status === "testing" && (
                      <>
                        <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-xs text-amber-600">正在探测...</span>
                      </>
                    )}
                    {ping?.status === "online" && (
                      <>
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="text-xs text-emerald-600 font-medium">
                          联机在线 {ping.latency ? `(${ping.latency}ms)` : ""}
                        </span>
                      </>
                    )}
                    {ping?.status === "offline" && (
                      <>
                        <div className="h-2 w-2 rounded-full bg-red-500" />
                        <span className="text-xs text-red-500 font-medium">无法接通</span>
                      </>
                    )}
                    {!ping && (
                      <>
                        <div className="h-2 w-2 rounded-full bg-muted-soft" />
                        <span className="text-xs text-muted-soft">未检测</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-hairline-soft flex items-center justify-between">
                  <span className="text-[10px] text-muted bg-canvas px-1.5 py-0.5 rounded font-medium">
                    {ep.useBffProxy ? "BFF 代理转发" : "CORS 直接通信"}
                  </span>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    {!isPrimary && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => handleStartEdit(ep, e)}
                          className="h-7 w-7 text-muted hover:text-ink shrink-0"
                          title="编辑配置"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        {!isActive && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => handleDelete(ep.id, e)}
                            className="h-7 w-7 text-muted hover:text-error shrink-0"
                            title="卸载连接"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* 新增 / 编辑 Dialog 配制弹窗 */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md w-[92vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEp ? "编辑服务器端点" : "连接新服务提供商"}</DialogTitle>
            <DialogDescription>
              请输入对方兼容系统的 URL 地址以将其绑定为通信提供商。
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="p-2.5 text-xs text-error bg-error/10 border border-error/20 rounded">
              {formError}
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted block">机构 / 提供商名称</label>
              <Input
                required
                placeholder="例如: 生成工作区、极客节点"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted block">
                服务连接 URL (支持自定义协议及端口)
              </label>
              <Input
                required
                placeholder="https://api.example.com"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="flex items-center gap-2 pt-1 pb-1">
              <input
                type="checkbox"
                id="formUseBffProxy"
                checked={formUseBff}
                onChange={(e) => setFormUseBff(e.target.checked)}
                className="h-4 w-4 rounded border-hairline accent-ink cursor-pointer bg-canvas/40"
              />
              <label
                htmlFor="formUseBffProxy"
                className="text-[11px] font-medium text-muted cursor-pointer select-none"
              >
                启用 BFF 服务转发代理 (防 CORS 拦截)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-hairline">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(false)}
                className="h-8 text-xs"
              >
                取消
              </Button>
              <Button type="submit" size="sm" className="h-8 text-xs">
                {editingEp ? "保存修改" : "确认绑定"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <footer className="border-t border-hairline bg-surface py-5 px-6 text-center text-xs text-muted-soft mt-12 font-sans select-none">
        OpenSlock Cluster Manager · 精致而高密度设计的协作中枢
      </footer>
    </div>
  );
}
