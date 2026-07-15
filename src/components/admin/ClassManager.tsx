import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, Users, UserPlus, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  useClasses, useCreateClass, useRenameClass, useDeleteClass,
  useClassProblemIds, useSetClassProblems,
} from "@/hooks/useClasses";
import { useAllStudents, useClassStudentIds, useSetClassStudents } from "@/hooks/useClassStudents";
import { useMyProblems } from "@/hooks/useProblems";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import AssignProblemsDialog from "@/components/admin/AssignProblemsDialog";
import EnrollStudentsDialog from "@/components/admin/EnrollStudentsDialog";

export default function ClassManager() {
  const { user } = useAuth();
  const userId = user!.id;
  const { data: classes = [], isLoading } = useClasses(userId);
  const { data: problems = [] } = useMyProblems(userId);
  const createMut = useCreateClass();
  const renameMut = useRenameClass();
  const deleteMut = useDeleteClass();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);

  const selected = classes.find((c) => c.id === selectedId) ?? null;
  const { data: assignedIds = [] } = useClassProblemIds(selected?.id);
  const setProblemsMut = useSetClassProblems();

  const { data: students = [] } = useAllStudents();
  const { data: enrolledIds = [] } = useClassStudentIds(selected?.id);
  const setStudentsMut = useSetClassStudents();
  const [enrollOpen, setEnrollOpen] = useState(false);

  async function handleCreate() {
    try {
      const c = await createMut.mutateAsync({ userId, name: `새 반 ${classes.length + 1}` });
      setSelectedId(c.id);
    } catch (e: any) {
      toast.error(e?.message ?? "생성 실패");
    }
  }

  function startEdit(id: string, current: string) {
    setEditingId(id);
    setNameInput(current);
  }

  async function saveEdit(id: string) {
    try {
      await renameMut.mutateAsync({ id, name: nameInput.trim() || "이름 없음" });
    } catch (e: any) {
      toast.error(e?.message ?? "수정 실패");
    } finally {
      setEditingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 반을 삭제할까요? 배정된 문제 연결도 함께 삭제됩니다.")) return;
    try {
      await deleteMut.mutateAsync(id);
      if (selectedId === id) setSelectedId(null);
      toast.success("삭제됨");
    } catch (e: any) {
      toast.error(e?.message ?? "삭제 실패");
    }
  }

  const assignedProblems = problems.filter((p) => assignedIds.includes(p.id));
  const enrolledStudents = students.filter((s) => enrolledIds.includes(s.id));

  async function removeStudent(studentId: string) {
    if (!selected) return;
    try {
      await setStudentsMut.mutateAsync({
        classId: selected.id,
        studentIds: enrolledIds.filter((id) => id !== studentId),
      });
    } catch (e: any) {
      toast.error(e?.message ?? "실패");
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex h-full w-64 flex-col border-r bg-muted/20">
        <div className="flex items-center justify-between border-b p-2">
          <span className="text-sm font-semibold">반 목록</span>
          <Button size="sm" onClick={handleCreate} disabled={createMut.isPending}>
            <Plus /> 새 반
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-1">
          {isLoading ? (
            <p className="p-2 text-sm text-muted-foreground">불러오는 중…</p>
          ) : classes.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">“새 반”으로 시작하세요.</p>
          ) : (
            classes.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  "group flex cursor-pointer items-center gap-2 rounded-md p-2 text-sm hover:bg-accent",
                  selectedId === c.id && "bg-accent"
                )}
              >
                <Users className="size-4 shrink-0 text-muted-foreground" />
                {editingId === c.id ? (
                  <Input
                    autoFocus
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit(c.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-7"
                  />
                ) : (
                  <span className="flex-1 truncate">{c.name || "(이름 없음)"}</span>
                )}
                {editingId === c.id ? (
                  <button onClick={(e) => { e.stopPropagation(); saveEdit(c.id); }} title="저장">
                    <Check className="size-4" />
                  </button>
                ) : (
                  <button
                    className="opacity-0 group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); startEdit(c.id, c.name); }}
                    title="이름 수정"
                  >
                    <Pencil className="size-4" />
                  </button>
                )}
                <button
                  className="opacity-0 group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                  title="삭제"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {!selected ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            왼쪽에서 반을 선택하거나 “새 반”을 만드세요.
          </div>
        ) : (
          <>
            <h2 className="mb-4 text-lg font-bold">{selected.name}</h2>

            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">등록 학생 ({enrolledStudents.length})</h3>
                <Button size="sm" onClick={() => setEnrollOpen(true)}>
                  <UserPlus /> 학생 등록
                </Button>
              </div>
              {enrolledStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground">아직 등록된 학생이 없습니다.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {enrolledStudents.map((s) => (
                    <span key={s.id} className="flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-sm">
                      {s.display_name || "(이름 없음)"}
                      <button
                        onClick={() => removeStudent(s.id)}
                        title="등록 해제"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">할당된 문제 ({assignedProblems.length})</h3>
              <Button size="sm" onClick={() => setAssignOpen(true)}>
                <Plus /> 문제 할당
              </Button>
            </div>
            {assignedProblems.length === 0 ? (
              <p className="text-sm text-muted-foreground">아직 할당된 문제가 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {assignedProblems.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <span className="truncate">{p.title || "(제목 없음)"}</span>
                    <span className={cn("text-xs", p.is_published ? "text-emerald-600" : "text-muted-foreground")}>
                      {p.is_published ? "발행됨" : "미발행"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <AssignProblemsDialog
              open={assignOpen}
              onOpenChange={setAssignOpen}
              problems={problems}
              assignedIds={assignedIds}
              onSave={async (ids) => {
                try {
                  await setProblemsMut.mutateAsync({ classId: selected.id, problemIds: ids });
                  toast.success("배정 저장됨");
                  setAssignOpen(false);
                } catch (e: any) {
                  toast.error(e?.message ?? "저장 실패");
                }
              }}
            />
            <EnrollStudentsDialog
              open={enrollOpen}
              onOpenChange={setEnrollOpen}
              enrolledIds={enrolledIds}
              onSave={async (ids) => {
                try {
                  await setStudentsMut.mutateAsync({ classId: selected.id, studentIds: ids });
                  toast.success("등록 저장됨");
                  setEnrollOpen(false);
                } catch (e: any) {
                  toast.error(e?.message ?? "저장 실패");
                }
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
