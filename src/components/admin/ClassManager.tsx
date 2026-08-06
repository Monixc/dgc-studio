import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, Users, UserPlus, X, Coins, MonitorPlay, Bell, Circle, NotebookPen, Code2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { listStudentSubmissions } from "@/lib/studentManagement";
import { useConfirm } from "@/hooks/use-confirm";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useClasses, useCreateClass, useRenameClass, useDeleteClass, useUpdateClassSchedule,
  useClassProblemIds, useSetClassProblems,
} from "@/hooks/useClasses";
import { useAllStudents, useClassStudentIds, useSetClassStudents } from "@/hooks/useClassStudents";
import { useMyProblems } from "@/hooks/useProblems";
import { useLessons, useClassLessonIds, useSetClassLessons } from "@/hooks/useLessons";
import { useAwardPoints } from "@/hooks/usePoints";
import { currentWeekSchedule } from "@/components/dashboard/ScheduleCalendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuAction, SidebarInset, SidebarTrigger, SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import AssignProblemsDialog from "@/components/admin/AssignProblemsDialog";
import AssignLessonsDialog from "@/components/admin/AssignLessonsDialog";
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
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const isMobile = useIsMobile();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const selected = classes.find((c) => c.id === selectedId) ?? null;
  const { data: assignedIds = [] } = useClassProblemIds(selected?.id);
  const setProblemsMut = useSetClassProblems();

  const { data: lessons = [] } = useLessons(userId);
  const { data: assignedLessonIds = [] } = useClassLessonIds(selected?.id);
  const setLessonsMut = useSetClassLessons();
  const [assignLessonsOpen, setAssignLessonsOpen] = useState(false);

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
      setSelectedStudentId(null);
    } catch (e: any) {
      toast.error(e?.message ?? "생성 실패");
    }
  }

  function selectClass(id: string) {
    setSelectedId(id);
    setSelectedStudentId(null);
  }

  function toggleStudent(id: string) {
    setSelectedStudentId((cur) => (cur === id ? null : id));
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
    if (!(await confirm({ description: "이 반을 삭제할까요? 배정된 문제 연결도 함께 삭제됩니다.", destructive: true }))) return;
    try {
      await deleteMut.mutateAsync(id);
      if (selectedId === id) setSelectedId(null);
      toast.success("삭제됨");
    } catch (e: any) {
      toast.error(e?.message ?? "삭제 실패");
    }
  }

  const assignedProblems = problems.filter((p) => assignedIds.includes(p.id));
  const assignedLessons = lessons.filter((l) => assignedLessonIds.includes(l.id));
  const enrolledStudents = students.filter((s) => enrolledIds.includes(s.id));
  const selectedStudent = enrolledStudents.find((s) => s.id === selectedStudentId) ?? null;

  const { data: studentSubmissions = [] } = useQuery({
    queryKey: ["class-manager", "student-submissions", selectedStudentId],
    queryFn: () => listStudentSubmissions(selectedStudentId!),
    enabled: !!selectedStudentId,
  });
  const latestSubmissionByProblem = new Map<string, (typeof studentSubmissions)[number]>();
  for (const sub of studentSubmissions) {
    if (!latestSubmissionByProblem.has(sub.problem_id)) latestSubmissionByProblem.set(sub.problem_id, sub);
  }
  function isSolved(problemId: string) {
    const sub = latestSubmissionByProblem.get(problemId);
    return !!sub && sub.total_tests > 0 && sub.passed_tests === sub.total_tests;
  }

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
    if (!(await confirm("이 문제의 할당을 해제하시겠습니까?"))) return;
    try {
      await setProblemsMut.mutateAsync({
        classId: selected.id,
        problemIds: assignedIds.filter((id) => id !== problemId),
      });
    } catch (e: any) {
      toast.error(e?.message ?? "실패");
    }
  }

  async function removeLesson(lessonId: string) {
    if (!selected) return;
    if (!(await confirm("이 교안의 할당을 해제하시겠습니까?"))) return;
    try {
      await setLessonsMut.mutateAsync({
        classId: selected.id,
        lessonIds: assignedLessonIds.filter((id) => id !== lessonId),
      });
    } catch (e: any) {
      toast.error(e?.message ?? "실패");
    }
  }

  async function removeStudent(studentId: string) {
    if (!selected) return;
    if (!(await confirm("이 학생의 등록을 해제하시겠습니까?"))) return;
    try {
      await setStudentsMut.mutateAsync({
        classId: selected.id,
        studentIds: enrolledIds.filter((id) => id !== studentId),
      });
    } catch (e: any) {
      toast.error(e?.message ?? "실패");
    }
  }

  const detail = !selected ? (
    <div className="flex h-full items-center justify-center p-6 text-center text-muted-foreground">
      {isMobile ? "위에서 반을 선택하거나 “새 반”을 만드세요." : "왼쪽에서 반을 선택하거나 “새 반”을 만드세요."}
    </div>
  ) : (
    <div className={isMobile ? "p-4" : "p-6"}>
      <div className="mb-4 flex items-center gap-2">
        {editingId === selected.id ? (
          <>
            <Input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveEdit(selected.id)}
              className="h-9 max-w-xs text-xl font-bold"
            />
            <Button variant="ghost" size="icon" onClick={() => saveEdit(selected.id)} title="저장">
              <Check className="size-4" />
            </Button>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold">{selected.name || "(이름 없음)"}</h2>
            <Button variant="ghost" size="icon" onClick={() => startEdit(selected.id, selected.name)} title="이름 수정">
              <Pencil className="size-4" />
            </Button>
          </>
        )}
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border p-3">
              <Bell className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-sm font-medium">수업 시간</span>
              <Select
                value={selected.schedule_day_of_week != null ? String(selected.schedule_day_of_week) : "__none__"}
                onValueChange={(v) => setSchedule(v === "__none__" ? null : Number(v), selected.schedule_time)}
              >
                <SelectTrigger className="h-8 w-auto">
                  <SelectValue placeholder="요일 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">요일 선택</SelectItem>
                  {DAY_LABELS.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>{d}요일</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="time"
                className="h-8 w-auto"
                value={selected.schedule_time?.slice(0, 5) ?? ""}
                onChange={(e) => setSchedule(selected.schedule_day_of_week, e.target.value || null)}
              />
              <span className="text-xs text-muted-foreground">설정 시 시작 30분 전 학생에게 알림이 갑니다.</span>

              <div className="ml-auto">
                <Popover open={importOpen} onOpenChange={setImportOpen}>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline">
                      시간표에서 가져오기
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-56 p-1">
                    {weekSchedule.length === 0 ? (
                      <p className="p-2 text-xs text-muted-foreground">이번 주 시간표에 등록된 수업이 없습니다.</p>
                    ) : (
                      weekSchedule.map((s, i) => (
                        <Button
                          key={i}
                          variant="ghost"
                          onClick={() => {
                            setSchedule(s.dayOfWeek, s.time);
                            setImportOpen(false);
                          }}
                          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm font-normal"
                        >
                          <span className="truncate">{s.title}</span>
                          <span className="ml-2 shrink-0 text-xs text-muted-foreground">{DAY_LABELS[s.dayOfWeek]} {s.time}</span>
                        </Button>
                      ))
                    )}
                  </PopoverContent>
                </Popover>
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
                    <span
                      key={s.id}
                      onClick={() => toggleStudent(s.id)}
                      className={cn(
                        "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm",
                        selectedStudentId === s.id ? "border-primary bg-primary/10" : "bg-background hover:bg-accent"
                      )}
                    >
                      {onlineIds.has(s.id) && (
                        <span title="접속중" className="flex">
                          <Circle className="size-2 shrink-0 fill-emerald-500 text-emerald-500" />
                        </span>
                      )}
                      {s.display_name || "(이름 없음)"}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-5 text-muted-foreground hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); setAwardTarget({ id: s.id, name: s.display_name || "(이름 없음)" }); }}
                        title="포인트 부여"
                      >
                        <Coins className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-5 text-muted-foreground hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); removeStudent(s.id); }}
                        title="등록 해제"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                할당된 문제 ({assignedProblems.length})
                {selectedStudent && (
                  <span className="ml-2 font-normal text-muted-foreground">— {selectedStudent.display_name || "(이름 없음)"} 진행 현황</span>
                )}
              </h3>
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
              <div className="max-h-[52rem] space-y-2 overflow-y-auto rounded-lg border p-3">
                {assignedProblems.map((p) => (
                  <div
                    key={p.id}
                    onClick={() =>
                      selectedStudent
                        ? navigate(`/students/${selectedStudent.id}/problems/${p.id}`)
                        : navigate("/problems", { state: { openProblemId: p.id } })
                    }
                    className="flex cursor-pointer items-center justify-between rounded-lg border p-3 text-sm hover:bg-accent"
                  >
                    <span className="truncate">{p.title || "(제목 없음)"}</span>
                    <div className="flex items-center gap-2">
                      {selectedStudent && (
                        <span className={cn("text-xs font-medium", isSolved(p.id) ? "text-emerald-600" : "text-muted-foreground")}>
                          {isSolved(p.id) ? "완료" : "미완"}
                        </span>
                      )}
                      <span className={cn("text-xs", p.is_published ? "text-emerald-600" : "text-muted-foreground")}>
                        {p.is_published ? "발행됨" : "미발행"}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); removeProblem(p.id); }}
                        title="할당 해제"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mb-2 mt-6 flex items-center justify-between">
              <h3 className="text-sm font-semibold">할당된 교안 ({assignedLessons.length})</h3>
              <Button size="sm" onClick={() => setAssignLessonsOpen(true)}>
                <NotebookPen /> 교안 할당
              </Button>
            </div>
            {assignedLessons.length === 0 ? (
              <div className="flex h-16 items-center justify-center rounded-lg bg-muted/40 text-sm text-muted-foreground">
                아직 할당된 교안이 없습니다.
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border p-3">
                {assignedLessons.map((l) => (
                  <div
                    key={l.id}
                    onClick={() => navigate("/lessons")}
                    className="flex cursor-pointer items-center justify-between rounded-lg border p-3 text-sm hover:bg-accent"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{l.title || "(제목 없음)"}</span>
                      <Badge variant="muted" className="shrink-0 px-1.5 py-0.5 text-[10px]">
                        {l.content_type === "html" ? "HTML" : "MD"}
                      </Badge>
                      {l.code_practice && <Code2 className="size-3.5 shrink-0 text-primary" />}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground hover:text-foreground"
                      onClick={(e) => { e.stopPropagation(); removeLesson(l.id); }}
                      title="할당 해제"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <AssignLessonsDialog
              open={assignLessonsOpen}
              onOpenChange={setAssignLessonsOpen}
              lessons={lessons}
              assignedIds={assignedLessonIds}
              onSave={async (ids) => {
                if (!selected) return;
                try {
                  await setLessonsMut.mutateAsync({ classId: selected.id, lessonIds: ids });
                  toast.success("배정 저장됨");
                  setAssignLessonsOpen(false);
                } catch (e: any) {
                  toast.error(e?.message ?? "저장 실패");
                }
              }}
            />

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

  return (
    <>
    <SidebarProvider className="h-full min-h-0 items-stretch">
      <Sidebar collapsible="icon" className="border-r">
        <SidebarHeader className="min-h-[45px] flex-row items-center gap-1 border-b group-data-[collapsible=icon]:justify-center">
          <span className="whitespace-nowrap text-sm font-semibold group-data-[collapsible=icon]:hidden">반 목록</span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto size-7 group-data-[collapsible=icon]:ml-0"
            onClick={handleCreate}
            disabled={createMut.isPending}
            title="새 반"
          >
            <Plus className="size-4" />
          </Button>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {isLoading ? (
                  <p className="p-2 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">불러오는 중…</p>
                ) : classes.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">“새 반”으로 시작하세요.</p>
                ) : (
                  classes.map((c) => (
                    <ClassMenuItem
                      key={c.id}
                      c={c}
                      isActive={selectedId === c.id}
                      isEditing={editingId === c.id}
                      nameInput={nameInput}
                      onNameInputChange={setNameInput}
                      onSelect={selectClass}
                      onSaveEdit={saveEdit}
                      onStartEdit={startEdit}
                      onDelete={handleDelete}
                    />
                  ))
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarRail />

      <SidebarInset>
        {isMobile ? (
          <div className="flex shrink-0 items-center gap-2 border-b bg-muted/20 p-2">
            <SidebarTrigger />
            <Users className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-medium">{selected ? selected.name || "(이름 없음)" : "반 목록"}</span>
          </div>
        ) : (
          <SidebarTrigger className="m-2 shrink-0" />
        )}
        <div className="min-h-0 flex-1 overflow-auto">{detail}</div>
      </SidebarInset>
    </SidebarProvider>
    {confirmDialog}
    </>
  );
}

function ClassMenuItem({
  c, isActive, isEditing, nameInput, onNameInputChange, onSelect, onSaveEdit, onStartEdit, onDelete,
}: {
  c: { id: string; name: string };
  isActive: boolean;
  isEditing: boolean;
  nameInput: string;
  onNameInputChange: (v: string) => void;
  onSelect: (id: string) => void;
  onSaveEdit: (id: string) => void;
  onStartEdit: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();

  if (isEditing) {
    return (
      <SidebarMenuItem>
        <div className="flex items-center gap-2 rounded-md p-2">
          <Users className="size-4 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            value={nameInput}
            onChange={(e) => onNameInputChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSaveEdit(c.id)}
            className="h-7"
          />
          <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => onSaveEdit(c.id)} title="저장">
            <Check className="size-4" />
          </Button>
        </div>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        tooltip={c.name || "(이름 없음)"}
        onClick={() => {
          onSelect(c.id);
          if (isMobile) setOpenMobile(false);
        }}
      >
        <Users />
        <span className="group-data-[collapsible=icon]:hidden">{c.name || "(이름 없음)"}</span>
      </SidebarMenuButton>
      <SidebarMenuAction showOnHover className="right-7" onClick={() => onStartEdit(c.id, c.name)} title="이름 수정">
        <Pencil className="size-3.5" />
      </SidebarMenuAction>
      <SidebarMenuAction showOnHover onClick={() => onDelete(c.id)} title="삭제">
        <Trash2 className="size-3.5" />
      </SidebarMenuAction>
    </SidebarMenuItem>
  );
}
