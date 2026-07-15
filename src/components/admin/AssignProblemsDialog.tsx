import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useFolders } from "@/hooks/useProblemFolders";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Problem } from "@/integrations/supabase/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  problems: Problem[];
  assignedIds: string[];
  onSave: (ids: string[]) => void | Promise<void>;
}

const NO_FOLDER = "__none__";

export default function AssignProblemsDialog({ open, onOpenChange, problems, assignedIds, onSave }: Props) {
  const { user } = useAuth();
  const { data: folders = [] } = useFolders(user?.id);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) setChecked(new Set(assignedIds));
  }, [open, assignedIds]);

  const groups = new Map<string, Problem[]>();
  for (const p of problems) {
    const key = p.folder_id ?? NO_FOLDER;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  const folderName = (id: string) =>
    id === NO_FOLDER ? "미분류" : folders.find((f) => f.id === id)?.name || "미분류";

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(items: Problem[]) {
    const allChecked = items.every((p) => checked.has(p.id));
    setChecked((prev) => {
      const next = new Set(prev);
      for (const p of items) {
        if (allChecked) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>문제 할당</DialogTitle>
        </DialogHeader>
        <div className="max-h-96 space-y-4 overflow-auto">
          {problems.length === 0 ? (
            <p className="text-sm text-muted-foreground">아직 만든 문제가 없습니다.</p>
          ) : (
            Array.from(groups.entries()).map(([folderId, items]) => (
              <div key={folderId}>
                <label className="mb-1 flex cursor-pointer items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={items.every((p) => checked.has(p.id))}
                    onChange={() => toggleGroup(items)}
                    className="size-3.5"
                  />
                  {folderName(folderId)} 폴더 전체
                </label>
                <div className="space-y-1">
                  {items.map((p) => (
                    <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 text-sm hover:bg-accent">
                      <input
                        type="checkbox"
                        checked={checked.has(p.id)}
                        onChange={() => toggle(p.id)}
                        className="size-4"
                      />
                      <span className="truncate">{p.title || "(제목 없음)"}</span>
                    </label>
                  ))}
                </div>
              </div>
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
