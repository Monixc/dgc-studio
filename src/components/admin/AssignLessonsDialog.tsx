import { useEffect, useState } from "react";
import { Code2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Lesson } from "@/integrations/supabase/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessons: Lesson[];
  assignedIds: string[];
  onSave: (ids: string[]) => void | Promise<void>;
}

export default function AssignLessonsDialog({ open, onOpenChange, lessons, assignedIds, onSave }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) setChecked(new Set(assignedIds));
  }, [open, assignedIds]);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>교안 할당</DialogTitle>
        </DialogHeader>
        <div className="max-h-96 space-y-1 overflow-auto">
          {lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">아직 만든 교안이 없습니다.</p>
          ) : (
            lessons.map((l) => (
              <label key={l.id} className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 text-sm hover:bg-accent">
                <input type="checkbox" checked={checked.has(l.id)} onChange={() => toggle(l.id)} className="size-4" />
                <span className="truncate">{l.title || "(제목 없음)"}</span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {l.content_type === "html" ? "HTML" : "MD"}
                </span>
                {l.code_practice && <Code2 className="size-3.5 text-primary" />}
              </label>
            ))
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => onSave(Array.from(checked))}>저장</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
