import { useState, useEffect } from "react";
import { Server, Plus, Trash2, Check, Settings2, Pencil } from "lucide-react";
import {
  type ServerEndpoint,
  getEndpoints,
  saveEndpoints,
  getActiveEndpoint,
  setActiveEndpointId,
} from "#/lib/server-config";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#/components/ui/dialog";

export function ServerSelector() {
  const [endpoints, setEndpoints] = useState<ServerEndpoint[]>([]);
  const [activeEp, setActiveEp] = useState<ServerEndpoint | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // 打开新服务器表单状态
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [useBffProxy, setUseBffProxy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setEndpoints(getEndpoints());
    setActiveEp(getActiveEndpoint());
  }, []);

  const handleSelect = (id: string) => {
    setActiveEndpointId(id);
    setIsOpen(false);
  };

  const handleStartEdit = (ep: ServerEndpoint, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(ep.id);
    setNewName(ep.name);
    setNewUrl(ep.baseUrl);
    setUseBffProxy(ep.useBffProxy);
    setShowAddForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!newName.trim() || !newUrl.trim()) {
      setError("请填写完整的服务名称与接口 URL");
      return;
    }

    try {
      // 简单正则校验 URL
      new URL(newUrl);
    } catch {
      setError("输入的主机 URL 格式不正确");
      return;
    }

    const cleanUrl = newUrl.replace(/\/$/, ""); // 去除最后的斜杠

    let updatedList: ServerEndpoint[];
    if (editingId) {
      updatedList = endpoints.map((ep) =>
        ep.id === editingId ? { ...ep, name: newName.trim(), baseUrl: cleanUrl, useBffProxy } : ep,
      );
      setEndpoints(updatedList);
      saveEndpoints(updatedList);
      // 如果当前修改的是正在使用的服务器，刷新以应用配置更新
      if (activeEp?.id === editingId) {
        setActiveEndpointId(editingId);
      }
    } else {
      const newEp: ServerEndpoint = {
        id: `custom-${Date.now()}`,
        name: newName.trim(),
        baseUrl: cleanUrl,
        useBffProxy: useBffProxy,
      };
      updatedList = [...endpoints, newEp];
      setEndpoints(updatedList);
      saveEndpoints(updatedList);
      // 默认切到新添加的服务器
      setActiveEndpointId(newEp.id);
    }

    // 重置表单状态
    setEditingId(null);
    setNewName("");
    setNewUrl("");
    setUseBffProxy(true);
    setShowAddForm(false);
    setIsOpen(false);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // 无法删除最后一个或当前的服务器
    if (endpoints.length <= 1) {
      alert("必须保留至少一个服务器配置");
      return;
    }
    if (activeEp?.id === id) {
      alert("无法删除当前正在激活并使用的服务器配置");
      return;
    }

    const updated = endpoints.filter((ep) => ep.id !== id);
    setEndpoints(updated);
    saveEndpoints(updated);
  };

  if (!activeEp) return null;

  return (
    <div className="flex items-center gap-2">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <button className="flex items-center gap-2 px-3 py-1.5 border border-hairline-strong bg-surface hover:bg-surface-strong text-ink hover:text-ink-soft rounded-md text-meta transition-all select-none cursor-pointer duration-150">
            <Server className="h-3.5 w-3.5 text-muted shrink-0" />
            <span className="font-medium max-w-[140px] truncate">{activeEp.name}</span>
            <span className="text-[10px] text-muted-soft px-1.5 py-0.5 bg-canvas rounded">
              {activeEp.useBffProxy ? "BFF 转发" : "CORS 直连"}
            </span>
            <Settings2 className="h-3 w-3 text-muted/80 ml-1 shrink-0" />
          </button>
        </DialogTrigger>

        <DialogContent className="max-w-md w-[92vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>管理服务器接口</DialogTitle>
            <DialogDescription>
              选择用于前端交互的核心业务 API 服务器。更改后页面将刷新。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
            {/* 服务器地址列表 */}
            <div className="space-y-2">
              {endpoints.map((ep) => {
                const isActive = ep.id === activeEp.id;
                return (
                  <div
                    key={ep.id}
                    onClick={() => !isActive && handleSelect(ep.id)}
                    className={`flex items-start justify-between p-3 rounded-lg border text-left cursor-pointer transition-all ${
                      isActive
                        ? "border-ink-soft bg-surface-strong/60"
                        : "border-hairline hover:border-hairline-strong hover:bg-surface-strong/20"
                    }`}
                  >
                    <div className="space-y-1 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-meta text-ink">{ep.name}</span>
                        {isActive && <Check className="h-3.5 w-3.5 text-success shrink-0" />}
                      </div>
                      <span className="block text-xs font-mono text-muted">{ep.baseUrl}</span>
                      <span className="inline-block text-[10px] text-muted-soft px-1 py-0.2 bg-canvas rounded">
                        通信模式：
                        {ep.useBffProxy ? "BFF 转发 (ServerFn)" : "直接请求 (CORS)"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* 编辑动作按钮 */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted hover:text-ink shrink-0"
                        onClick={(e) => handleStartEdit(ep, e)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">编辑</span>
                      </Button>

                      {/* 删除动作按钮 - 只有非激活才可删除 */}
                      {!isActive && endpoints.length > 1 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted hover:text-error shrink-0"
                          onClick={(e) => handleDelete(ep.id, e)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">删除</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 新增按钮或表单 */}
            {!showAddForm ? (
              <Button
                variant="outline"
                className="w-full text-meta gap-1.5 h-9 rounded-md border-dashed"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="h-4 w-4" />
                新增服务器实例
              </Button>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="p-3 border border-hairline rounded-lg space-y-3 bg-canvas/40"
              >
                <div className="text-xs font-semibold text-ink">
                  {editingId ? "编辑业务节点" : "配制新业务节点"}
                </div>

                {error && (
                  <div className="p-2 text-[11px] text-error bg-error/10 border border-error/20 rounded">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted block">名称</label>
                    <Input
                      required
                      placeholder="例如：生成节点、开发测试"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted block">
                      接口 URL (协议与域名端口)
                    </label>
                    <Input
                      required
                      placeholder="https://api.example.com"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1 pb-2">
                    <input
                      type="checkbox"
                      id="useBffProxy"
                      checked={useBffProxy}
                      onChange={(e) => setUseBffProxy(e.target.checked)}
                      className="h-4 w-4 rounded border-hairline accent-ink cursor-pointer bg-canvas/40"
                    />
                    <label
                      htmlFor="useBffProxy"
                      className="text-[11px] font-medium text-muted cursor-pointer select-none"
                    >
                      通过 BFF Proxy 转发 (避免跨域 CORS 阻碍)
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingId(null);
                      setNewName("");
                      setNewUrl("");
                      setUseBffProxy(true);
                      setError("");
                    }}
                    className="h-8 text-xs"
                  >
                    取消
                  </Button>
                  <Button type="submit" size="sm" className="h-8 text-xs">
                    {editingId ? "保存修改" : "添加并应用"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
