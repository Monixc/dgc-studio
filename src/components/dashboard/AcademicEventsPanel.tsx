import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAcademicEvents, useCreateAcademicEvent, useDeleteAcademicEvent } from "@/hooks/useAcademicEvents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AcademicEventsPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { user } = useAuth();
  const { data: events = [], isLoading } = useAcademicEvents();
  const createMut = useCreateAcademicEvent();
  const deleteMut = useDeleteAcademicEvent();
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");

  async function add() {
    if (!date || !title.trim() || !user) return;
    try {
      await createMut.mutateAsync({ teacherId: user.id, date, title: title.trim() });
      setDate("");
      setTitle("");
    } catch (e: any) {
      toast.error(e?.message ?? "등록 실패");
    }
  }

  return (
    <div className="space-y-2">
      {!readOnly && (
        <div className="flex gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
          />
          <Input placeholder="일정 제목" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <Button size="sm" onClick={add} disabled={!date || !title.trim() || createMut.isPending}>
            <Plus />
          </Button>
        </div>
      )}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">등록된 일정이 없습니다.</p>
      ) : (
        <div className="space-y-1.5">
          {events.map((ev) => (
            <div key={ev.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
              <span>
                <span className="mr-2 text-xs text-muted-foreground">{ev.date}</span>
                {ev.title}
              </span>
              {!readOnly && (
                <button onClick={() => deleteMut.mutate(ev.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
