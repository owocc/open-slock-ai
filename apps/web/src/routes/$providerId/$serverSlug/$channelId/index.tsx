import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { getApiChannelsByChannelIdMessages, postApiChannelsByChannelIdMessages } from "openapi";
import { ChevronDown, CornerDownRight, MessageSquare, Send, X, Clipboard } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { SidebarTrigger } from "#/components/ui/sidebar";
import { getActiveEndpoint } from "#/lib/server-config";

export const Route = createFileRoute("/$providerId/$serverSlug/$channelId/")({
  component: ChannelChatComponent,
});

export interface MessageItem {
  id: string;
  senderId: string;
  senderType: "human" | "agent" | "system";
  content: string;
  createdAt: string;
  parentId?: string | null;
  replyTo?: string | null;
  seq?: number;
}

function getWsUrl(): string {
  const endpoint = getActiveEndpoint();
  const baseUrl = endpoint.baseUrl.replace(/^http/, "ws");
  return `${baseUrl}/api/ws`;
}

// 按 seq（或 createdAt）升序排序，确保最新在最下方
function sortMessages(list: MessageItem[]) {
  return [...list].sort((a, b) => {
    if (a.seq != null && b.seq != null) return a.seq - b.seq;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function ChannelChatComponent() {
  const { providerId, serverSlug, channelId } = Route.useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [replyTo, setReplyTo] = useState<MessageItem | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; msg: MessageItem } | null>(null);
  // 保存原始消息列表（未过滤话题消息），用于统计 parentId 引用数
  const rawMessagesRef = useRef<MessageItem[]>([]);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // 加载初始消息历史（过滤掉话题内消息，并按时间升序排列）
  const fetchMessages = async () => {
    try {
      const res = await getApiChannelsByChannelIdMessages({
        path: { channelId },
      });
      const list = (res as any)?.data ?? res;
      if (list && Array.isArray(list)) {
        const all = list as MessageItem[];
        rawMessagesRef.current = all;
        setMessages(sortMessages(all.filter((m) => !m.parentId)));
      }
    } catch (err) {
      console.error("Failed to load channel messages", err);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    if (channelId) {
      setLoading(true);
      setMessages([]);
      setReplyTo(null);
      void fetchMessages();
    }
  }, [channelId]);

  // WebSocket 连接管理
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
            if (msg.parentId) return;
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return sortMessages([...prev, msg]);
            });
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
  }, [channelId]);

  // 兜底轮询：WS 断开时每隔 10s 拉取一次
  useEffect(() => {
    if (!channelId) return;

    const timer = setInterval(() => {
      if (!wsConnected) {
        void fetchMessages();
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [channelId, wsConnected]);

  // 智能滚动：在底部时自动滚动，不在底部时累计新消息数
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (atBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (messages.length > 0) {
      setNewMessageCount((prev) => prev + 1);
    }
  }, [messages]);

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

  const handleSendMessage = async (e: React.FormEvent) => {
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
          replyTo: replyTo?.id ?? null,
        },
      });
      const newMsg = (result as any)?.data ?? (result as any);
      if (newMsg && newMsg.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return sortMessages([...prev, newMsg as MessageItem]);
        });
      }
      setReplyTo(null);
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setSending(false);
    }
  };

  const handleEnterThread = (msg: MessageItem) => {
    void navigate({
      to: "/$providerId/$serverSlug/$channelId/$messageId",
      params: { providerId, serverSlug, channelId, messageId: msg.id },
    });
  };

  const handleSelectReply = (msg: MessageItem) => {
    setReplyTo((prev) => (prev?.id === msg.id ? null : msg));
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

  // 计算每条消息的总回复数（replyTo 引用 + 话题 parentId 引用）
  const replyCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    // 统计 replyTo 引用（来自已显示的消息列表）
    for (const msg of messages) {
      if (msg.replyTo) {
        counts[msg.replyTo] = (counts[msg.replyTo] || 0) + 1;
      }
    }
    // 统计 parentId 引用（来自原始消息，包含话题内消息）
    for (const msg of rawMessagesRef.current) {
      if (msg.parentId) {
        counts[msg.parentId] = (counts[msg.parentId] || 0) + 1;
      }
    }
    return counts;
  }, [messages]);

  const getOriginalMsg = (replyToId: string) => messages.find((m) => m.id === replyToId);

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden bg-canvas font-sans relative">
      {/* 顶部活动频道栏 */}
      <div className="flex h-14 items-center px-6 border-b border-hairline bg-surface shrink-0">
        <SidebarTrigger className="mr-3 cursor-pointer shrink-0" />
        <span className="text-title text-ink font-semibold tracking-wide flex items-center gap-1.5 animate-in fade-in duration-200">
          <span className="text-muted">#</span> 聊天频道
          {wsConnected && (
            <span className="ml-2 w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
          )}
        </span>
      </div>

      {/* 消息流区域 */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 md:p-6 relative">
        {loading && messages.length === 0 ? (
          <div className="text-meta text-muted text-center py-10">加载历史消息中...</div>
        ) : messages.length === 0 ? (
          <div className="text-body text-muted text-center py-10 max-w-sm mx-auto border border-dashed border-hairline-strong/60 rounded-lg p-6 bg-surface select-none">
            这是一个新频道的起点，发送一条消息开始聊天吧！
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isAgent = msg.senderType === "agent";
              const isSelected = replyTo?.id === msg.id;

              return (
                <div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  className={`group relative flex items-start gap-3 px-2 py-2 rounded-lg transition-colors cursor-pointer ${
                    isSelected ? "bg-ink/5 ring-1 ring-ink/10" : "hover:bg-surface-strong/40"
                  }`}
                  onClick={() => handleEnterThread(msg)}
                  onContextMenu={(e) => handleContextMenu(e, msg)}
                >
                  {/* 用户/Agent 头像 */}
                  <div
                    className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 select-none mt-0.5 ${
                      isAgent
                        ? "bg-surface-strong text-ink border border-hairline-strong"
                        : "bg-ink-soft text-white"
                    }`}
                  >
                    {isAgent ? "AG" : msg.senderId.substring(0, 2)}
                  </div>

                  {/* 消息气泡区域 */}
                  <div className="flex-1 min-w-0">
                    {/* 消息头部（发送者 + 时间） */}
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-body-strong text-ink font-semibold text-sm truncate">
                        {isAgent ? "Agent" : msg.senderId.substring(0, 8)}
                      </span>
                      {isAgent && (
                        <span className="text-[10px] font-semibold bg-surface-strong text-ink-soft px-1 rounded-sm border border-hairline leading-none py-0.5">
                          Agent
                        </span>
                      )}
                      <span className="text-meta text-muted-soft">{formatTime(msg.createdAt)}</span>
                    </div>

                    {/* 回复引用 badge：显示被回复的原消息摘要 */}
                    {msg.replyTo &&
                      (() => {
                        const original = getOriginalMsg(msg.replyTo!);
                        if (!original) return null;
                        return (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              scrollToMessage(msg.replyTo!);
                            }}
                            className="flex items-center gap-1.5 mb-1.5 text-[11px] text-muted hover:text-ink bg-surface-strong/50 hover:bg-surface-strong border border-hairline rounded-md px-2.5 py-1 transition-colors cursor-pointer max-w-[85%]"
                          >
                            <span className="font-medium shrink-0">
                              回复{" "}
                              {original.senderType === "agent"
                                ? "Agent"
                                : original.senderId.substring(0, 6)}
                            </span>
                            <span className="truncate text-muted-soft">{original.content}</span>
                          </button>
                        );
                      })()}

                    {/* 消息气泡 */}
                    <div className="inline-block max-w-[85%] bg-surface border border-hairline rounded-xl px-4 py-2.5 shadow-soft">
                      <div className="text-body leading-relaxed text-ink-soft break-words whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    </div>

                    {/* 回复计数器（展示有几条回复指向此消息） */}
                    {replyCountMap[msg.id] > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEnterThread(msg);
                        }}
                        className="flex items-center gap-1 mt-1.5 text-[12px] text-emerald-600 hover:text-emerald-700 font-medium transition-colors cursor-pointer"
                      >
                        <CornerDownRight className="h-3 w-3" />
                        {replyCountMap[msg.id]} 条话题消息
                      </button>
                    )}

                    {/* 回复/展开操作 */}
                    <div className="flex items-center gap-1.5 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectReply(msg);
                        }}
                        className="text-[11px] text-muted hover:text-ink flex items-center gap-1 px-2 py-0.5 rounded hover:bg-surface-strong transition-colors cursor-pointer"
                      >
                        <MessageSquare className="h-3 w-3" />
                        回复
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEnterThread(msg);
                        }}
                        className="text-[11px] text-muted hover:text-ink flex items-center gap-1 px-2 py-0.5 rounded hover:bg-surface-strong transition-colors cursor-pointer"
                        title="进入话题"
                      >
                        <CornerDownRight className="h-3 w-3" />
                        展开话题
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} />

        {/* 滚动到底部按钮 */}
        {newMessageCount > 0 && (
          <div className="sticky bottom-4 z-10 flex justify-center">
            <button
              onClick={() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

      {/* 回复指示栏 */}
      {replyTo && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-surface-strong border-t border-hairline text-sm text-muted">
          <MessageSquare className="h-3.5 w-3.5 text-muted-soft shrink-0" />
          <span className="truncate">
            正在回复{" "}
            <span className="font-semibold text-ink">
              {replyTo.senderType === "agent" ? "Agent" : replyTo.senderId.substring(0, 8)}
            </span>
            <span className="ml-1.5 text-muted-soft">
              "{replyTo.content.substring(0, 40)}
              {replyTo.content.length > 40 ? "..." : ""}"
            </span>
          </span>
          <button
            onClick={() => setReplyTo(null)}
            className="ml-auto text-muted-soft hover:text-ink transition-colors cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 底部输入框 */}
      <div className="p-4 bg-canvas border-t border-hairline shrink-0">
        <form
          onSubmit={handleSendMessage}
          className="relative flex items-center bg-surface border border-hairline-strong rounded-lg p-1.5 focus-within:border-ink transition-colors shadow-soft"
        >
          <Input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={replyTo ? "输入回复内容..." : "在频道中发送消息..."}
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
