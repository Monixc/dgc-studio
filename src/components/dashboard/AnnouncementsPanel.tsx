import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAnnouncements, useCreateAnnouncement, useDeleteAnnouncement } from "@/hooks/useAnnouncements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function AnnouncementsPanel({
  readOnly = false, open: openProp, onOpenChange,
}: { readOnly?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const { user } = useAuth();
  const { data: announcements = [], isLoading } = useAnnouncements();
  const createMut = useCreateAnnouncement();
  const deleteMut = useDeleteAnnouncement();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  async function save() {
    if (!title.trim() || !user) return;
    try {
      await createMut.mutateAsync({ teacherId: user.id, title: title.trim(), body: body.trim() });
      setOpen(false);
      setTitle("");
      setBody("");
    } catch (e: any) {
      toast.error(e?.message ?? "등록 실패");
    }
  }

  return (
    <>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      ) : announcements.length === 0 ? (
        <p className="text-sm text-muted-foreground">등록된 공지가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {announcements.map((a) => (
            <div key={a.id} className="rounded-lg border p-2.5 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{a.title}</span>
                {!readOnly && (
                  <button onClick={() => deleteMut.mutate(a.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
              {a.body && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{a.body}</p>}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>공지 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            <Textarea placeholder="내용" value={body} onChange={(e) => setBody(e.target.value)} className="h-24 resize-none" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button onClick={save} disabled={!title.trim() || createMut.isPending}>등록</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
