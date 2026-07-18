import { useMemo, useState } from "react";
import { ArrowLeft, MessageSquare, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/integrations/supabase/types";
import type { useChat } from "@/hooks/useChat";
import { cn } from "@/lib/utils";

type ChatState = ReturnType<typeof useChat>;

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPanel({
  open,
  onClose,
  userId,
  recipients,
  chat,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  recipients: Profile[];
  chat: ChatState;
}) {
  const { messages, send, markRead } = chat;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [body, setBody] = useState("");

  const active = recipients.find((r) => r.id === activeId) ?? null;
  const thread = useMemo(
    () =>
      [...messages]
        .filter((m) => m.sender_id === activeId || m.recipient_id === activeId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [messages, activeId],
  );
  const unreadFrom = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of messages) {
      if (m.recipient_id === userId && !m.read_at) map.set(m.sender_id, (map.get(m.sender_id) ?? 0) + 1);
    }
    return map;
  }, [messages, userId]);
  const lastWith = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of messages) {
      const other = m.sender_id === userId ? m.recipient_id : m.sender_id;
      if (!map.has(other)) map.set(other, m.body); // messages already newest-first
    }
    return map;
  }, [messages, userId]);

  const openThread = (id: string) => {
    setActiveId(id);
    if ((unreadFrom.get(id) ?? 0) > 0) void markRead.mutate(id);
  };

  const submit = async () => {
    if (!activeId || !body.trim()) return;
    try {
      await send.mutateAsync({ recipientId: activeId, body: body.trim() });
      setBody("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "전송 실패");
    }
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/20 md:bg-transparent" onClick={onClose} />}
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-dvh w-full max-w-sm flex-col border-l bg-background shadow-xl transition-transform",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
          {active ? (
            <button onClick={() => setActiveId(null)} className="rounded p-1 hover:bg-accent" title="목록">
              <ArrowLeft className="size-5" />
            </button>
          ) : (
            <MessageSquare className="size-5 text-primary" />
          )}
          <span className="flex-1 truncate font-semibold">{active ? active.display_name || "상대" : "채팅"}</span>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent" title="닫기">
            <X className="size-5" />
          </button>
        </header>

        {!active ? (
          <div className="flex-1 overflow-y-auto p-2">
            {recipients.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">대화 상대가 없습니다.</p>
            ) : (
              recipients.map((r) => {
                const unread = unreadFrom.get(r.id) ?? 0;
                return (
                  <button
                    key={r.id}
                    onClick={() => openThread(r.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left hover:bg-accent"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{r.display_name || "(이름 없음)"}</span>
                        {unread > 0 && (
                          <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                            {unread}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{lastWith.get(r.id) ?? "대화를 시작해 보세요."}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-1 flex-col-reverse gap-2 overflow-y-auto p-3">
              {/* col-reverse: 최신이 아래. 배열은 시간순이라 역순 렌더 */}
              {[...thread].reverse().map((m) => {
                const mine = m.sender_id === userId;
                return (
                  <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                    <span
                      className={cn(
                        "max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
                        mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted",
                      )}
                    >
                      {m.body}
                    </span>
                    <span className="mt-0.5 text-[10px] text-muted-foreground">{timeOf(m.created_at)}</span>
                  </div>
                );
              })}
              {thread.length === 0 && (
                <p className="m-auto text-sm text-muted-foreground">주고받은 메시지가 없습니다.</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2 border-t p-3">
              <Input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && submit()}
                placeholder="메시지 입력…"
                autoFocus
              />
              <Button size="icon" onClick={() => void submit()} disabled={!body.trim() || send.isPending}>
                <Send className="size-4" />
              </Button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
