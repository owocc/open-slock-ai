import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { getApiChannelsByChannelIdMessages, postApiChannelsByChannelIdMessages } from "openapi";
import { Send } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";

export const Route = createFileRoute("/dashboard/$serverId/$channelId")({
  component: ChannelChatComponent,
});

interface MessageItem {
  id: string;
  senderId: string;
  senderType: "human" | "agent" | "system";
  content: string;
  createdAt: string;
}

function ChannelChatComponent() {
  const { channelId } = useParams({ from: "/dashboard/$serverId/$channelId" });
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      const res = await getApiChannelsByChannelIdMessages({
        path: { channelId },
      });
      if (res && Array.isArray(res)) {
        setMessages(res as MessageItem[]);
      }
    } catch (err) {
      console.error("Failed to load channel messages", err);
    } finally {
      setLoading(false);
    }
  };

  // 轮询作为消息更新的降级与轮训方案
  useEffect(() => {
    if (channelId) {
      setLoading(true);
      void fetchMessages();

      const timer = setInterval(() => {
        void fetchMessages();
      }, 2000);

      return () => {
        clearInterval(timer);
      };
    }
  }, [channelId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;

    const messageText = inputText;
    setInputText("");
    setSending(true);

    try {
      await postApiChannelsByChannelIdMessages({
        path: { channelId },
        body: {
          content: messageText,
          senderType: "human",
        },
      });
      await fetchMessages();
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setSending(false);
    }
  };

  // 消息合并判定逻辑：同发送者在 2 分钟内
  const shouldGroup = (msg: MessageItem, idx: number, arr: MessageItem[]) => {
    if (idx === 0) return false;
    const prevMsg = arr[idx - 1];
    if (msg.senderId !== prevMsg.senderId) return false;
    if (msg.senderType !== prevMsg.senderType) return false;

    const diffMs = new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime();
    return diffMs < 2 * 60 * 1000;
  };

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden bg-canvas font-sans relative">
      {/* 顶部活动频道栏 */}
      <div className="flex h-14 items-center px-6 border-b border-hairline bg-surface shrink-0">
        <span className="text-title text-ink font-semibold tracking-wide flex items-center gap-1.5">
          <span className="text-muted">#</span> 聊天频道
        </span>
      </div>

      {/* 消息史流区域 (高密度，仅用 hairline 分界，无卡片气泡以显示大页面流式效果，但保留纯白气泡布局以作极简对比) */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3 relative">
        {loading && messages.length === 0 ? (
          <div className="text-meta text-muted text-center py-10">加载历史消息中...</div>
        ) : messages.length === 0 ? (
          <div className="text-body text-muted text-center py-10 max-w-sm mx-auto border border-dashed border-hairline-strong/60 rounded-lg p-6 bg-surface">
            这是一个新频道的起点，发送一条消息开始聊天吧！
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, idx) => {
              const isAgent = msg.senderType === "agent";
              const dateObj = new Date(msg.createdAt);
              const timeStr = dateObj.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });
              const isGrouped = shouldGroup(msg, idx, messages);

              if (isGrouped) {
                return (
                  <div
                    key={msg.id}
                    className="group relative flex items-start pl-12 -mt-1.5 min-h-[22px] animate-in fade-in duration-700"
                  >
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute left-0 text-[10px] text-muted-soft select-none text-right w-9 mt-1 pr-1 font-mono">
                      {timeStr}
                    </span>
                    <div className="flex-1 text-body leading-[1.5] text-ink-soft break-words">
                      {msg.content}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className="flex items-start space-x-3 animate-in fade-in slide-in-from-bottom-1 duration-150 pt-2"
                >
                  {/* 用户/Agent 头像 */}
                  <div
                    className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 select-none ${isAgent ? "bg-surface-strong text-ink border border-hairline-strong" : "bg-ink-soft text-white"}`}
                  >
                    {isAgent ? "AG" : msg.senderId.substring(0, 2)}
                  </div>
                  {/* 消息内容与头 */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-baseline space-x-2">
                      <span className="text-body-strong text-ink truncate">
                        {isAgent ? "Agent" : msg.senderId.substring(0, 8)}
                      </span>
                      {isAgent && (
                        <span className="text-[10px] font-semibold bg-surface-strong text-ink-soft px-1 rounded-sm scale-90 border border-hairline">
                          Agent
                        </span>
                      )}
                      <span className="text-meta text-muted">{timeStr}</span>
                    </div>
                    <div className="text-body leading-[1.5] text-ink-soft break-words">
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 底部输入框发送栏 */}
      <div className="p-4 bg-canvas border-t border-hairline shrink-0">
        <form
          onSubmit={handleSendMessage}
          className="relative flex items-center bg-surface border border-hairline-strong rounded-lg p-1.5 focus-within:border-ink transition-colors shadow-soft"
        >
          <Input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="在频道中发送消息..."
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
