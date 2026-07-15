import { useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMyMessages, useSendMessage } from "@/hooks/useMessages";
import type { Profile } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function MessageCenter({ recipients }: { recipients: Profile[] }) {
  const { user } = useAuth();
  const { data: messages = [], isLoading } = useMyMessages(user?.id);
  const sendMut = useSendMessage();
  const [recipientId, setRecipientId] = useState("");
  const [body, setBody] = useState("");

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
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <select
          value={recipientId}
          onChange={(e) => setRecipientId(e.target.value)}
          className="h-9 flex-1 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">받는 사람 선택</option>
          {recipients.map((r) => (
            <option key={r.id} value={r.id}>{r.display_name || "(이름 없음)"}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="쪽지 내용"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <Button size="sm" onClick={send} disabled={!recipientId || !body.trim() || sendMut.isPending}>
          <Send />
        </Button>
      </div>

      <div className="max-h-56 space-y-1.5 overflow-auto">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">불러오는 중…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">주고받은 쪽지가 없습니다.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn("rounded-lg border p-2 text-sm", m.sender_id === user?.id && "bg-muted/40")}>
              <div className="mb-0.5 text-xs text-muted-foreground">
                {m.sender_id === user?.id ? `${m.counterpart_name}에게` : `${m.counterpart_name} 보냄`}
              </div>
              {m.body}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
