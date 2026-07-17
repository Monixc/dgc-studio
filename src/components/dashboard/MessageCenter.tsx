import { useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMyMessages, useSendMessage } from "@/hooks/useMessages";
import type { MessageRow, Profile } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function MessageCenter({ recipients }: { recipients: Profile[] }) {
  const { user } = useAuth();
  const { data: messages = [], isLoading } = useMyMessages(user?.id);
  const sendMut = useSendMessage();
  const [recipientId, setRecipientId] = useState("");
  const [body, setBody] = useState("");
  const [viewing, setViewing] = useState<MessageRow | null>(null);

  const thread = messages.filter(
    (m) => m.sender_id === recipientId || m.recipient_id === recipientId,
  );

  async function send() {
    if (!recipientId || !body.trim() || !user) return;
    try {
      await sendMut.mutateAsync({ senderId: user.id, recipientId, body: body.trim() });
      setBody("");
    } catch (e: any) {
      toast.error(e?.message ?? "전송 실패");
    }
  }

  return (
    <div className="flex gap-3">
      <div className="h-40 w-24 shrink-0 space-y-1 overflow-y-auto rounded-lg bg-muted/40 p-1">
        {recipients.map((r) => (
          <button
            key={r.id}
            onClick={() => setRecipientId(r.id)}
            className={cn(
              "w-full truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
              recipientId === r.id && "bg-accent font-medium",
            )}
          >
            {r.display_name || "(이름 없음)"}
          </button>
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="h-40 space-y-1.5 overflow-auto">
          {!recipientId ? (
            <p className="text-sm text-muted-foreground">받는 사람을 선택하세요.</p>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground">불러오는 중…</p>
          ) : thread.length === 0 ? (
            <p className="text-sm text-muted-foreground">주고받은 쪽지가 없습니다.</p>
          ) : (
            thread.map((m) => (
              <button
                key={m.id}
                onClick={() => setViewing(m)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border p-2 text-left text-sm",
                  m.sender_id === user?.id && "bg-muted/40",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{m.body}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{timeOf(m.created_at)}</span>
              </button>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="쪽지 내용"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            disabled={!recipientId}
          />
          <Button size="sm" onClick={send} disabled={!recipientId || !body.trim() || sendMut.isPending}>
            <Send />
          </Button>
        </div>
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{viewing && timeOf(viewing.created_at)}</DialogTitle>
          </DialogHeader>
          <p className="whitespace-pre-wrap text-sm">{viewing?.body}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
