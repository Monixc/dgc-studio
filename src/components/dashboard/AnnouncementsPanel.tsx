import { useRef, useState } from "react";
import { toast } from "sonner";
import { Trash2, ImagePlus, Paperclip, X, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAnnouncements, useCreateAnnouncement, useDeleteAnnouncement } from "@/hooks/useAnnouncements";
import { uploadAnnouncementAsset } from "@/lib/announcements";
import type { AnnouncementAttachment } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Markdown } from "@/components/Markdown";

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
  const [attachments, setAttachments] = useState<AnnouncementAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const attachment = await uploadAnnouncementAsset(file);
        setAttachments((prev) => [...prev, attachment]);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "첨부 업로드 실패");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!title.trim() || !user) return;
    try {
      await createMut.mutateAsync({ teacherId: user.id, title: title.trim(), body: body.trim(), attachments });
      setOpen(false);
      setTitle("");
      setBody("");
      setAttachments([]);
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
              {a.body && <Markdown className="mt-1 text-muted-foreground">{a.body}</Markdown>}
              {a.attachments?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {a.attachments.map((att, index) =>
                    att.kind === "image" ? (
                      <a key={index} href={att.url} target="_blank" rel="noopener noreferrer">
                        <img src={att.url} alt={att.name} className="h-20 w-20 rounded-md border object-cover" />
                      </a>
                    ) : (
                      <a
                        key={index}
                        href={att.url}
                        download={att.name}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1 text-xs hover:bg-accent"
                      >
                        <Paperclip className="size-3.5" /> {att.name}
                      </a>
                    ),
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>공지 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            <Textarea
              placeholder="내용 (마크다운 형식 지원)"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="h-32 resize-none font-mono text-xs"
            />
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((att, index) => (
                  <span key={index} className="flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1 text-xs">
                    {att.kind === "image" ? <ImagePlus className="size-3.5" /> : <Paperclip className="size-3.5" />}
                    <span className="max-w-32 truncate">{att.name}</span>
                    <button onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}>
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  void addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  void addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => imageInputRef.current?.click()}>
                {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />} 이미지 첨부
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                <Paperclip /> 파일 첨부
              </Button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button onClick={() => void save()} disabled={!title.trim() || uploading || createMut.isPending}>등록</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
