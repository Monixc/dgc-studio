import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, Users, UserPlus, X, Coins, MonitorPlay, Bell, Circle, ChevronDown } from "lucide-react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useClasses, useCreateClass, useRenameClass, useDeleteClass, useUpdateClassSchedule,
  useClassProblemIds, useSetClassProblems,
} from "@/hooks/useClasses";
import { useAllStudents, useClassStudentIds, useSetClassStudents } from "@/hooks/useClassStudents";
import { useMyProblems } from "@/hooks/useProblems";
import { useAwardPoints } from "@/hooks/usePoints";
import { currentWeekSchedule } from "@/components/dashboard/ScheduleCalendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import AssignProblemsDialog from "@/components/admin/AssignProblemsDialog";
import EnrollStudentsDialog from "@/components/admin/EnrollStudentsDialog";
import AwardPointsDialog from "@/components/admin/AwardPointsDialog";
import { useOnlineUsers } from "@/hooks/usePresence";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export default function ClassManager() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user!.id;
  const { data: classes = [], isLoading } = useClasses(userId);
  const { data: problems = [] } = useMyProblems(userId);
  const createMut = useCreateClass();
  const renameMut = useRenameClass();
  const deleteMut = useDeleteClass();
  const scheduleMut = useUpdateClassSchedule();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const isMobile = useIsMobile();
  const [mobileListOpen, setMobileListOpen] = useState(false);

  const listPanelRef = useRef<ImperativePanelHandle>(null);
  const [listCollapsed, setListCollapsed] = useState(false);

  function toggleListPanel() {
    if (listCollapsed) listPanelRef.current?.expand();
    else listPanelRef.current?.collapse();
  }

  const selected = classes.find((c) => c.id === selectedId) ?? null;
  const { data: assignedIds = [] } = useClassProblemIds(selected?.id);
  const setProblemsMut = useSetClassProblems();

  const { data: students = [] } = useAllStudents();
  const { data: enrolledIds = [] } = useClassStudentIds(selected?.id);
  const setStudentsMut = useSetClassStudents();
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const weekSchedule = currentWeekSchedule(userId);
  const onlineIds = new Set(useOnlineUsers().map((u) => u.id));
  const awardMut = useAwardPoints();
  const [awardTarget, setAwardTarget] = useState<{ id: string; name: string } | null>(null);

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

  async function setSchedule(dayOfWeek: number | null, time: string | null) {
    if (!selected) return;
    try {
      await scheduleMut.mutateAsync({ id: selected.id, schedule_day_of_week: dayOfWeek, schedule_time: time });
    } catch (e: any) {
      toast.error(e?.message ?? "저장 실패");
    }
  }

  async function removeProblem(problemId: string) {
    if (!selected) return;
    if (!confirm("이 문제의 할당을 해제하시겠습니까?")) return;
    try {
      await setProblemsMut.mutateAsync({
        classId: selected.id,
        problemIds: assignedIds.filter((id) => id !== problemId),
      });
    } catch (e: any) {
      toast.error(e?.message ?? "실패");
    }
  }

  async function removeStudent(studentId: string) {
    if (!selected) return;
    if (!confirm("이 학생의 등록을 해제하시겠습니까?")) return;
    try {
      await setStudentsMut.mutateAsync({
        classId: selected.id,
        studentIds: enrolledIds.filter((id) => id !== studentId),
      });
    } catch (e: any) {
      toast.error(e?.message ?? "실패");
    }
  }

  function renderClassRow(c: (typeof classes)[number], opts?: { alwaysShowActions?: boolean; onAfterSelect?: () => void }) {
    const actionCls = opts?.alwaysShowActions ? "" : "opacity-0 group-hover:opacity-100";
    return (
      <div
        key={c.id}
        onClick={() => { setSelectedId(c.id); opts?.onAfterSelect?.(); }}
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
          <button className={actionCls} onClick={(e) => { e.stopPropagation(); startEdit(c.id, c.name); }} title="이름 수정">
            <Pencil className="size-4" />
          </button>
        )}
        <button className={actionCls} onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }} title="삭제">
          <Trash2 className="size-4" />
        </button>
      </div>
    );
  }

  const detail = !selected ? (
    <div className="flex h-full items-center justify-center p-6 text-center text-muted-foreground">
      {isMobile ? "위에서 반을 선택하거나 “새 반”을 만드세요." : "왼쪽에서 반을 선택하거나 “새 반”을 만드세요."}
    </div>
  ) : (
    <div className={isMobile ? "p-4" : "p-6"}>
      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border p-3">
              <Bell className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-sm font-medium">수업 시간</span>
              <select
                className="rounded-md border bg-background px-2 py-1 text-sm"
                value={selected.schedule_day_of_week ?? ""}
                onChange={(e) => setSchedule(e.target.value === "" ? null : Number(e.target.value), selected.schedule_time)}
              >
                <option value="">요일 선택</option>
                {DAY_LABELS.map((d, i) => (
                  <option key={i} value={i}>{d}요일</option>
                ))}
              </select>
              <input
                type="time"
                className="rounded-md border bg-background px-2 py-1 text-sm"
                value={selected.schedule_time?.slice(0, 5) ?? ""}
                onChange={(e) => setSchedule(selected.schedule_day_of_week, e.target.value || null)}
              />
              <span className="text-xs text-muted-foreground">설정 시 시작 30분 전 학생에게 알림이 갑니다.</span>

              <div className="relative ml-auto">
                <Button size="sm" variant="outline" onClick={() => setImportOpen((o) => !o)}>
                  시간표에서 가져오기
                </Button>
                {importOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setImportOpen(false)} />
                    <div className="absolute right-0 z-50 mt-1 w-56 rounded-lg border bg-background p-1 shadow-lg">
                      {weekSchedule.length === 0 ? (
                        <p className="p-2 text-xs text-muted-foreground">이번 주 시간표에 등록된 수업이 없습니다.</p>
                      ) : (
                        weekSchedule.map((s, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setSchedule(s.dayOfWeek, s.time);
                              setImportOpen(false);
                            }}
                            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                          >
                            <span className="truncate">{s.title}</span>
                            <span className="ml-2 shrink-0 text-xs text-muted-foreground">{DAY_LABELS[s.dayOfWeek]} {s.time}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">등록 학생 ({enrolledStudents.length})</h3>
                <Button size="sm" onClick={() => setEnrollOpen(true)}>
                  <UserPlus /> 학생 등록
                </Button>
              </div>
              {enrolledStudents.length === 0 ? (
                <div className="flex h-16 items-center justify-center rounded-lg bg-muted/40 text-sm text-muted-foreground">
                  아직 등록된 학생이 없습니다.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 rounded-lg border p-3">
                  {enrolledStudents.map((s) => (
                    <span key={s.id} className="flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-sm">
                      {onlineIds.has(s.id) && (
                        <span title="접속중" className="flex">
                          <Circle className="size-2 shrink-0 fill-emerald-500 text-emerald-500" />
                        </span>
                      )}
                      {s.display_name || "(이름 없음)"}
                      <button
                        onClick={() => setAwardTarget({ id: s.id, name: s.display_name || "(이름 없음)" })}
                        title="포인트 부여"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Coins className="size-3.5" />
                      </button>
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
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => setAssignOpen(true)}>
                  <Plus /> 문제 할당
                </Button>
                <Button size="sm" onClick={() => navigate(`/classes/${selected.id}/live`)}>
                  <MonitorPlay /> 수업하기
                </Button>
              </div>
            </div>
            {assignedProblems.length === 0 ? (
              <div className="flex h-16 items-center justify-center rounded-lg bg-muted/40 text-sm text-muted-foreground">
                아직 할당된 문제가 없습니다.
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border p-3">
                {assignedProblems.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => navigate("/problems", { state: { openProblemId: p.id } })}
                    className="flex cursor-pointer items-center justify-between rounded-lg border p-3 text-sm hover:bg-accent"
                  >
                    <span className="truncate">{p.title || "(제목 없음)"}</span>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs", p.is_published ? "text-emerald-600" : "text-muted-foreground")}>
                        {p.is_published ? "발행됨" : "미발행"}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeProblem(p.id); }}
                        title="할당 해제"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
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
            <AwardPointsDialog
              open={!!awardTarget}
              onOpenChange={(o) => !o && setAwardTarget(null)}
              studentName={awardTarget?.name ?? ""}
              onSave={async (amount, reason) => {
                if (!awardTarget) return;
                try {
                  await awardMut.mutateAsync({ teacherId: userId, studentId: awardTarget.id, amount, reason });
                  toast.success("포인트 부여됨");
                  setAwardTarget(null);
                } catch (e: any) {
                  toast.error(e?.message ?? "실패");
                }
              }}
            />
          </div>
  );

  if (isMobile) {
    return (
      <div className="flex h-full flex-col">
        <div className="relative border-b bg-muted/20 p-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMobileListOpen((o) => !o)}
              className="flex flex-1 items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
            >
              <Users className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-left">{selected ? selected.name || "(이름 없음)" : "반 목록"}</span>
              <ChevronDown className={cn("size-4 shrink-0 transition-transform", mobileListOpen && "rotate-180")} />
            </button>
            <button
              className="shrink-0 rounded p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
              onClick={handleCreate}
              disabled={createMut.isPending}
              title="새 반"
            >
              <Plus className="size-4" />
            </button>
          </div>
          {mobileListOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMobileListOpen(false)} />
              <div className="absolute inset-x-2 top-full z-50 mt-1 max-h-[60vh] overflow-auto rounded-lg border bg-background p-1 shadow-lg">
                {isLoading ? (
                  <p className="p-2 text-sm text-muted-foreground">불러오는 중…</p>
                ) : classes.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">“새 반”으로 시작하세요.</p>
                ) : (
                  classes.map((c) => renderClassRow(c, { alwaysShowActions: true, onAfterSelect: () => setMobileListOpen(false) }))
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex-1 overflow-auto">{detail}</div>
      </div>
    );
  }

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full overflow-hidden">
      <ResizablePanel
        ref={listPanelRef}
        defaultSize={17}
        minSize={14}
        maxSize={35}
        collapsible
        collapsedSize={5}
        onCollapse={() => setListCollapsed(true)}
        onExpand={() => setListCollapsed(false)}
        className="flex h-full flex-col bg-muted/20"
      >
        {!listCollapsed && (
          <div className="flex items-center gap-1 border-b p-2">
            <span className="whitespace-nowrap text-sm font-semibold">반 목록</span>
            <button
              className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
              onClick={handleCreate}
              disabled={createMut.isPending}
              title="새 반"
            >
              <Plus className="size-4" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-auto p-1">
          {listCollapsed ? (
            <div className="flex flex-col items-center gap-1 py-1">
              {classes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  title={c.name || "(이름 없음)"}
                  className={cn("rounded p-1.5 hover:bg-accent", selectedId === c.id && "bg-accent")}
                >
                  <Users className="size-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : isLoading ? (
            <p className="p-2 text-sm text-muted-foreground">불러오는 중…</p>
          ) : classes.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">“새 반”으로 시작하세요.</p>
          ) : (
            classes.map((c) => renderClassRow(c))
          )}
        </div>
      </ResizablePanel>

      <ResizableHandle onToggle={toggleListPanel} collapsed={listCollapsed} />

      <ResizablePanel defaultSize={83} className="overflow-auto">
        {detail}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
