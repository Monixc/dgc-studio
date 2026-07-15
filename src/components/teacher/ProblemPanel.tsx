import { toast } from "sonner";
import { Plus, Trash2, Globe, EyeOff, Circle } from "lucide-react";
import { useMyProblems, useCreateProblem, useDeleteProblem, useUpdateProblem } from "@/hooks/useProblems";
import { useProblemsRealtime } from "@/hooks/useProblemsRealtime";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  userId: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function ProblemPanel({ userId, selectedId, onSelect }: Props) {
  const { data: problems = [], isLoading } = useMyProblems(userId);
  useProblemsRealtime();
  const createMut = useCreateProblem();
  const deleteMut = useDeleteProblem();
  const updateMut = useUpdateProblem();

  async function handleCreate() {
    try {
      const p = await createMut.mutateAsync(userId);
      onSelect(p.id);
    } catch (e: any) {
      toast.error(e?.message ?? "생성 실패");
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("이 문제를 삭제할까요?")) return;
    try {
      await deleteMut.mutateAsync(id);
      if (selectedId === id) onSelect(null);
      toast.success("삭제됨");
    } catch (e: any) {
      toast.error(e?.message ?? "삭제 실패");
    }
  }

  async function togglePublish(id: string, next: boolean, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await updateMut.mutateAsync({ id, patch: { is_published: next } });
    } catch (e: any) {
      toast.error(e?.message ?? "실패");
    }
  }

  return (
    <div className="flex h-full w-64 flex-col border-r bg-muted/20">
      <div className="flex items-center justify-between border-b p-2">
        <span className="text-sm font-semibold">문제 목록</span>
        <Button size="sm" onClick={handleCreate} disabled={createMut.isPending}>
          <Plus /> 새 문제
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-1">
        {isLoading ? (
          <p className="p-2 text-sm text-muted-foreground">불러오는 중…</p>
        ) : problems.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">“새 문제”로 시작하세요.</p>
        ) : (
          problems.map((p) => (
            <div
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={cn(
                "group flex cursor-pointer items-center gap-2 rounded-md p-2 text-sm hover:bg-accent",
                selectedId === p.id && "bg-accent"
              )}
            >
              <Circle className={cn("size-2 shrink-0", p.is_published ? "fill-emerald-500 text-emerald-500" : "fill-muted-foreground/40 text-muted-foreground/40")} />
              <span className="flex-1 truncate">{p.title || "(제목 없음)"}</span>
              <button className="opacity-0 group-hover:opacity-100" onClick={(e) => togglePublish(p.id, !p.is_published, e)} title="발행 전환">
                {p.is_published ? <EyeOff className="size-4" /> : <Globe className="size-4" />}
              </button>
              <button className="opacity-0 group-hover:opacity-100" onClick={(e) => handleDelete(p.id, e)} title="삭제">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
