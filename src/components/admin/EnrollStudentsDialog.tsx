import { useEffect, useState } from "react";
import { useAllStudents } from "@/hooks/useClassStudents";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrolledIds: string[];
  onSave: (ids: string[]) => void | Promise<void>;
}

export default function EnrollStudentsDialog({ open, onOpenChange, enrolledIds, onSave }: Props) {
  const { data: students = [] } = useAllStudents();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setChecked(new Set(enrolledIds));
  }, [open, enrolledIds]);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = students.filter((s) => s.display_name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>학생 등록</DialogTitle>
        </DialogHeader>
        <Input placeholder="이름으로 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="max-h-96 space-y-1 overflow-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">학생이 없습니다.</p>
          ) : (
            filtered.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 text-sm hover:bg-accent">
                <input
                  type="checkbox"
                  checked={checked.has(s.id)}
                  onChange={() => toggle(s.id)}
                  className="size-4"
                />
                <span className="truncate">{s.display_name || "(이름 없음)"}</span>
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
