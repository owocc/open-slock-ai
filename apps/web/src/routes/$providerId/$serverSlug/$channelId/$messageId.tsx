import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  getApiChannelsByChannelIdMessages,
  getApiMessagesByMessageIdThread,
  postApiChannelsByChannelIdMessages,
} from "openapi";
import { ArrowLeft, ChevronDown, Clipboard, CornerDownRight, Send } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { SidebarTrigger } from "#/components/ui/sidebar";
import { getActiveEndpoint } from "#/lib/server-config";
import type { MessageItem } from "./index";

export const Route = createFileRoute("/$providerId/$serverSlug/$channelId/$messageId")({
  component: MessageDetailPage,
});

function getWsUrl(): string {
  const endpoint = getActiveEndpoint();
  const baseUrl = endpoint.baseUrl.replace(/^http/, "ws");
  return `${baseUrl}/api/ws`;
}

function sortMessages(list: MessageItem[]) {
  return [...list].sort((a, b) => {
    if (a.seq != null && b.seq != null) return a.seq - b.seq;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function MessageDetailPage() {
  const { providerId, serverSlug, channelId, messageId } = Route.useParams();
  const navigate = useNavigate();
  const [parentMsg, setParentMsg] = useState<MessageItem | null>(null);
  const [threadReplies, setThreadReplies] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; msg: MessageItem } | null>(null);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // 加载父消息和所有关联消息（回复 + 话题）
  const fetchData = async () => {
    try {
      setLoading(true);

      const [msgRes, threadRes] = await Promise.allSettled([
        getApiChannelsByChannelIdMessages({ path: { channelId } }),
        getApiMessagesByMessageIdThread({ path: { messageId } }),
      ]);

      console.log(
        "[ThreadPage] msgRes:",
        msgRes.status,
        msgRes.status === "fulfilled" ? msgRes.value : msgRes.reason,
      );
      console.log(
        "[ThreadPage] threadRes:",
        threadRes.status,
        threadRes.status === "fulfilled" ? threadRes.value : threadRes.reason,
      );

      // 工具函数：无论 API 返回 { data: [...] } 还是裸数组，都提取出数组
      const extractArray = (val: unknown): MessageItem[] => {
        if (!val) return [];
        const arr = (val as any)?.data ?? val;
        if (Array.isArray(arr)) return arr;
        // 可能是 { data: { data: [...] } } 双层包裹
        if (arr?.data && Array.isArray(arr.data)) return arr.data;
        return [];
      };

      let foundParent: MessageItem | undefined;

      // ---- 从频道消息中找父消息和 replyTo 回复 ----
      if (msgRes.status === "fulfilled") {
        const list = extractArray(msgRes.value);
        console.log("[ThreadPage] Channel messages extracted:", list.length, list);
        foundParent = list.find((m: MessageItem) => m.id === messageId);
        if (foundParent) {
          console.log("[ThreadPage] Parent found in channel messages");
          setParentMsg(foundParent);
        } else {
          console.log("[ThreadPage] Parent NOT found in channel messages");
        }

        const replyMessages = list.filter(
          (m: MessageItem) => m.replyTo === messageId && m.id !== messageId,
        );
        console.log("[ThreadPage] replyTo messages:", replyMessages.length, replyMessages);
        setThreadReplies(sortMessages(replyMessages));
      } else {
        console.error("[ThreadPage] Channel messages API failed:", msgRes.reason);
      }

      // ---- 从线程 API 获取 parentId 指向的消息 ----
      if (threadRes.status === "fulfilled") {
        const threadMessages = extractArray(threadRes.value);
        console.log("[ThreadPage] Thread API extracted:", threadMessages.length, threadMessages);
        if (threadMessages.length > 0) {
          setThreadReplies((prev) => {
            console.log("[ThreadPage] Merging thread messages, prev:", prev);
            const merged = [...prev];
            for (const t of threadMessages) {
              if (!merged.some((m) => m.id === t.id)) {
                merged.push(t);
              }
            }
            const sorted = sortMessages(merged);
            console.log("[ThreadPage] After merge:", sorted);
            return sorted;
          });
        }
      } else {
        console.error("[ThreadPage] Thread API failed:", threadRes.reason);
      }

      // ---- 父消息兜底：尝试从线程 API 响应中查找 ----
      if (!foundParent && threadRes.status === "fulfilled") {
        const threadMessages = extractArray(threadRes.value);
        const fromThread = threadMessages.find((m: MessageItem) => m.id === messageId);
        if (fromThread) {
          setParentMsg(fromThread);
          foundParent = fromThread;
        }
      }

      if (!foundParent) {
        setNotFound(true);
      }
    } catch (err) {
      console.error("Failed to load message thread", err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (channelId && messageId) {
      void fetchData();
    }
  }, [channelId, messageId]);

  // WebSocket for live thread updates
  useEffect(() => {
    if (!channelId) return;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;

      const ws = new WebSocket(getWsUrl());

      ws.onopen = () => {
        if (closed) {
          ws.close();
          return;
        }
        ws.send(JSON.stringify({ type: "subscribe", channelId }));
        setWsConnected(true);
      };

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.type === "message" && data.message) {
            const msg = data.message as MessageItem;
            const isRelated =
              msg.parentId === messageId || msg.replyTo === messageId || msg.id === messageId;
            if (!isRelated) return;
            if (msg.id === messageId) {
              setParentMsg(msg);
            } else {
              setThreadReplies((prev) => {
                if (prev.some((m) => m.id === msg.id)) return prev;
                return sortMessages([...prev, msg]);
              });
            }
          }
        } catch {
          // ignore non-JSON messages
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        wsRef.current = null;
        if (!closed) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [channelId, messageId]);

  // 智能滚动：在底部时自动滚动，不在底部时累计新消息数
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (atBottom) {
      threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (threadReplies.length > 0) {
      setNewMessageCount((prev) => prev + 1);
    }
  }, [threadReplies]);

  // 监听手动滚动，滚到底部时重置新消息计数
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
        setNewMessageCount(0);
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // 点击空白处关闭右键菜单
  useEffect(() => {
    if (!ctxMenu) return;
    const handler = () => setCtxMenu(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [ctxMenu]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;

    const messageText = inputText;
    setInputText("");
    setSending(true);

    try {
      const result = await postApiChannelsByChannelIdMessages({
        path: { channelId },
        body: {
          content: messageText,
          senderType: "human",
          parentId: messageId,
          replyTo: messageId,
        },
      });
      const newMsg = (result as any)?.data ?? (result as any);
      if (newMsg && newMsg.id) {
        setThreadReplies((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return sortMessages([...prev, newMsg as MessageItem]);
        });
      }
    } catch (err) {
      console.error("Failed to send reply", err);
    } finally {
      setSending(false);
    }
  };

  const handleBack = () => {
    void navigate({
      to: "/$providerId/$serverSlug/$channelId",
      params: { providerId, serverSlug, channelId },
    });
  };

  const handleContextMenu = (e: React.MouseEvent, msg: MessageItem) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, msg });
  };

  const copyMessageId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      // fallback
    }
    setCtxMenu(null);
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col h-full overflow-hidden bg-canvas font-sans">
        <div className="flex h-14 items-center px-6 border-b border-hairline bg-surface shrink-0">
          <SidebarTrigger className="mr-3 cursor-pointer shrink-0" />
          <span className="text-meta text-muted">加载话题中...</span>
        </div>
      </div>
    );
  }

  if (notFound || !parentMsg) {
    return (
      <div className="flex flex-1 flex-col h-full overflow-hidden bg-canvas font-sans">
        <div className="flex h-14 items-center px-6 border-b border-hairline bg-surface shrink-0">
          <SidebarTrigger className="mr-3 cursor-pointer shrink-0" />
          <span className="text-meta text-muted">消息未找到</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted mb-4">该消息不存在或已被删除</p>
            <Button variant="outline" onClick={handleBack} className="cursor-pointer">
              返回频道
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isAgent = parentMsg.senderType === "agent";

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden bg-canvas font-sans relative">
      {/* 顶部栏 */}
      <div className="flex h-14 items-center px-4 border-b border-hairline bg-surface shrink-0 gap-3">
        <SidebarTrigger className="mr-1 cursor-pointer shrink-0" />
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-muted hover:text-ink transition-colors cursor-pointer shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">返回</span>
        </button>
        <span className="text-title text-ink font-semibold tracking-wide flex items-center gap-1.5">
          <CornerDownRight className="h-4 w-4 text-muted" />
          话题
          {wsConnected && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
          )}
        </span>
      </div>

      {/* 消息列表 */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 relative"
      >
        {/* 父消息（固定置顶） */}
        <div className="bg-surface border border-hairline rounded-xl p-4 shadow-soft">
          <div className="flex items-start gap-3">
            <div
              className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 select-none mt-0.5 ${
                isAgent
                  ? "bg-surface-strong text-ink border border-hairline-strong"
                  : "bg-ink-soft text-white"
              }`}
            >
              {isAgent ? "AG" : parentMsg.senderId.substring(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="text-body-strong text-ink font-semibold text-sm truncate">
                  {isAgent ? "Agent" : parentMsg.senderId.substring(0, 8)}
                </span>
                {isAgent && (
                  <span className="text-[10px] font-semibold bg-surface-strong text-ink-soft px-1 rounded-sm border border-hairline leading-none py-0.5">
                    Agent
                  </span>
                )}
                <span className="text-meta text-muted-soft">{formatTime(parentMsg.createdAt)}</span>
              </div>
              <div className="text-body leading-relaxed text-ink-soft break-words whitespace-pre-wrap">
                {parentMsg.content}
              </div>
            </div>
          </div>
        </div>

        {/* 线程回复分隔 */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-hairline" />
          <span className="text-meta text-muted-soft shrink-0 font-medium">
            {threadReplies.length} 条回复
          </span>
          <div className="flex-1 h-px bg-hairline" />
        </div>

        {/* 线程回复列表 */}
        {threadReplies.length === 0 ? (
          <div className="text-center text-meta text-muted-soft py-8">
            暂无回复，发送第一条回复开始话题讨论
          </div>
        ) : (
          <div className="space-y-3">
            {threadReplies.map((msg) => {
              const replyIsAgent = msg.senderType === "agent";
              return (
                <div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  className="group flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-surface-strong/30 transition-colors"
                  onContextMenu={(e) => handleContextMenu(e, msg)}
                >
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 select-none mt-0.5 ${
                      replyIsAgent
                        ? "bg-surface-strong text-ink border border-hairline-strong"
                        : "bg-ink-soft text-white"
                    }`}
                  >
                    {replyIsAgent ? "AG" : msg.senderId.substring(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-body-strong text-ink font-semibold text-sm truncate">
                        {replyIsAgent ? "Agent" : msg.senderId.substring(0, 8)}
                      </span>
                      {replyIsAgent && (
                        <span className="text-[10px] font-semibold bg-surface-strong text-ink-soft px-1 rounded-sm border border-hairline leading-none py-0.5">
                          Agent
                        </span>
                      )}
                      <span className="text-meta text-muted-soft">{formatTime(msg.createdAt)}</span>
                    </div>
                    <div className="inline-block max-w-[85%] bg-surface border border-hairline rounded-xl px-4 py-2.5 shadow-sm">
                      <div className="text-body leading-relaxed text-ink-soft break-words whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={threadEndRef} />

        {/* 滚动到底部按钮 */}
        {newMessageCount > 0 && (
          <div className="sticky bottom-4 z-10 flex justify-center">
            <button
              onClick={() => {
                threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
                setNewMessageCount(0);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-ink text-white rounded-full shadow-xl border border-white/10 text-sm font-medium hover:bg-ink-soft hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <ChevronDown className="h-4 w-4" />
              <span>{newMessageCount} 条新消息</span>
            </button>
          </div>
        )}
      </div>

      {/* 右键菜单 */}
      {ctxMenu && (
        <div
          className="fixed z-[200] bg-surface border border-hairline-strong rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => copyMessageId(ctxMenu.msg.id)}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-ink hover:bg-surface-strong transition-colors cursor-pointer"
          >
            <Clipboard className="h-3.5 w-3.5 text-muted" />
            复制消息 ID
          </button>
        </div>
      )}

      {/* 底部回复输入框 */}
      <div className="p-4 bg-canvas border-t border-hairline shrink-0">
        <form
          onSubmit={handleSendReply}
          className="relative flex items-center bg-surface border border-hairline-strong rounded-lg p-1.5 focus-within:border-ink transition-colors shadow-soft"
        >
          <Input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="输入回复..."
            className="flex-1 border-none focus-visible:outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent h-9 text-body placeholder:text-muted-soft shadow-none"
          />
          <Button
            type="submit"
            disabled={!inputText.trim() || sending}
            size="icon"
            variant="default"
            className="h-8 w-8 cursor-pointer shrink-0 select-none"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
