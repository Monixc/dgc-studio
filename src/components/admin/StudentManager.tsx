import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, BarChart3, BookOpen, ChevronRight, ClipboardList, Coins, RefreshCw, Save, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { usePointsRanking } from "@/hooks/usePoints";
import {
  getStudentManagementNote,
  listManagedStudents,
  listStudentPointEarnings,
  listStudentSubmissions,
  listStudentTypingLogs,
  saveStudentManagementNote,
  type StudentSubmission,
} from "@/lib/studentManagement";
import { TYPING_MODE_LABEL } from "@/lib/typing-logs";
import { dailyTypingBests, type DailyTypingBest } from "@/lib/studentTypingAnalytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const dayLabel = new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" });

function ageFromBirthDate(birthDate: string | null | undefined) {
  if (!birthDate) return "미입력";
  const today = new Date();
  const birth = new Date(`${birthDate}T00:00:00`);
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday = today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age--;
  return `${age}세`;
}

function submissionGroups(submissions: StudentSubmission[]) {
  const groups = new Map<string, StudentSubmission[]>();
  for (const submission of submissions) groups.set(submission.problem_id, [...(groups.get(submission.problem_id) ?? []), submission]);
  return [...groups.values()].map((versions) => ({ latest: versions[0], versions }));
}

export default function StudentManager() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState("");
  const [notes, setNotes] = useState("");
  const [chartMetric, setChartMetric] = useState<"submissions" | "correct">("submissions");
  const [chartType, setChartType] = useState<"bar" | "line">("bar");

  const {
    data: students = [],
    isLoading: studentsLoading,
    isError: studentsError,
    error: studentsErrorDetail,
    refetch: refetchStudents,
  } = useQuery({
    queryKey: ["student-management", "students", user?.id],
    queryFn: () => listManagedStudents(user!.id),
    enabled: !!user,
  });
  const selectedStudent = students.find((student) => student.id === selectedId) ?? students[0] ?? null;

  useEffect(() => {
    if (!selectedId && students[0]) setSelectedId(students[0].id);
  }, [selectedId, students]);

  const { data: note, isLoading: noteLoading } = useQuery({
    queryKey: ["student-management", "note", selectedStudent?.id],
    queryFn: () => getStudentManagementNote(selectedStudent!.id),
    enabled: !!selectedStudent,
  });
  useEffect(() => {
    setBirthDate(note?.birth_date ?? "");
    setNotes(note?.notes ?? "");
  }, [note, selectedStudent?.id]);

  const { data: submissions = [], isLoading: submissionsLoading } = useQuery({
    queryKey: ["student-management", "submissions", selectedStudent?.id],
    queryFn: () => listStudentSubmissions(selectedStudent!.id),
    enabled: !!selectedStudent,
  });
  const {
    data: typingLogs = [],
    isLoading: typingLoading,
    isError: typingError,
  } = useQuery({
    queryKey: ["student-management", "typing-logs", selectedStudent?.id],
    queryFn: () => listStudentTypingLogs(selectedStudent!.id),
    enabled: !!selectedStudent,
  });
  const {
    data: pointEarnings = [],
    isLoading: pointEarningsLoading,
    isError: pointEarningsError,
  } = useQuery({
    queryKey: ["student-management", "point-earnings", selectedStudent?.id],
    queryFn: () => listStudentPointEarnings(selectedStudent!.id),
    enabled: !!selectedStudent,
  });
  const { data: pointRanking = [] } = usePointsRanking();
  const groups = useMemo(() => submissionGroups(submissions), [submissions]);

  const saveNote = useMutation({
    mutationFn: () => saveStudentManagementNote({
      studentId: selectedStudent!.id,
      birthDate: birthDate || null,
      notes,
      updatedBy: user!.id,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-management", "note", selectedStudent?.id] });
      toast.success("학생 정보를 저장했습니다.");
    },
    onError: () => toast.error("학생 정보를 저장하지 못했습니다."),
  });

  const filteredStudents = students.filter((student) => student.display_name.toLowerCase().includes(query.trim().toLowerCase()));
  const solvedCount = groups.filter(({ latest }) => latest.total_tests > 0 && latest.passed_tests === latest.total_tests).length;
  const totalAttempts = submissions.length;
  const points = pointRanking.find((row) => row.studentId === selectedStudent?.id)?.total ?? 0;
  const dailyData = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 14 }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (13 - i));
      const key = date.toISOString().slice(0, 10);
      const daySubmissions = submissions.filter((submission) => submission.submitted_at.slice(0, 10) === key);
      const count = chartMetric === "submissions"
        ? daySubmissions.length
        : new Set(daySubmissions.filter((submission) => submission.total_tests > 0 && submission.passed_tests === submission.total_tests).map((submission) => submission.problem_id)).size;
      return { key, label: dayLabel.format(date), count };
    });
  }, [chartMetric, submissions]);
  const maxDaily = Math.max(1, ...dailyData.map((day) => day.count));
  const typingTrend = useMemo(() => dailyTypingBests(typingLogs), [typingLogs]);

  if (studentsLoading) return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">학생 정보를 불러오는 중…</div>;
  if (studentsError) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-destructive/30 bg-background p-6 text-center shadow-sm">
          <AlertCircle className="mx-auto size-8 text-destructive" />
          <h1 className="mt-3 font-semibold">학생 목록을 불러오지 못했습니다.</h1>
          <p className="mt-2 break-words text-xs text-muted-foreground">
            {studentsErrorDetail instanceof Error ? studentsErrorDetail.message : "알 수 없는 조회 오류"}
          </p>
          <Button className="mt-4" size="sm" onClick={() => void refetchStudents()}>
            <RefreshCw className="size-4" /> 다시 시도
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-64 shrink-0 flex-col border-r bg-background">
        <div className="border-b p-3">
          <h1 className="mb-3 text-base font-bold">학생 관리</h1>
          <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="학생 검색" className="h-9 pl-8 text-xs" /></div>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {filteredStudents.length === 0 ? <p className="p-3 text-center text-xs text-muted-foreground">등록된 학생이 없습니다.</p> : filteredStudents.map((student) => (
            <button key={student.id} onClick={() => setSelectedId(student.id)} className={cn("mb-1 flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition", selectedStudent?.id === student.id ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
              <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold", selectedStudent?.id === student.id ? "bg-primary-foreground/15" : "bg-muted")}>{student.display_name.slice(0, 1) || "?"}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{student.display_name || "이름 없음"}</span><span className={cn("block truncate text-[11px]", selectedStudent?.id === student.id ? "text-primary-foreground/70" : "text-muted-foreground")}>{student.classes.map((c) => c.name).join(", ") || "미배정"}</span></span>
              <ChevronRight className="size-4 shrink-0 opacity-60" />
            </button>
          ))}
        </div>
      </aside>

      <section className="min-w-0 flex-1 overflow-auto bg-muted/20 p-4 md:p-6">
        {!selectedStudent ? <EmptyState /> : <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xl font-bold">{selectedStudent.display_name || "이름 없음"}</h2></div><span className="rounded-full bg-background px-3 py-1 text-xs text-muted-foreground shadow-sm">가입일 {new Date(selectedStudent.created_at).toLocaleDateString("ko-KR")}</span></div>

          <div className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="rounded-xl border bg-background p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRound className="size-5" /></span><h3 className="font-semibold">학생 프로필</h3></div>
              <div className="grid gap-4 sm:grid-cols-2"><InfoItem label="소속 반" value={selectedStudent.classes.map((c) => c.name).join(", ") || "배정된 반 없음"} /><div><label className="mb-1 block text-xs font-medium text-muted-foreground">생년월일 · 나이</label><Input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} className="h-9 text-xs" /><p className="mt-1 text-xs text-muted-foreground">{ageFromBirthDate(birthDate)}</p></div></div>
              <div className="mt-4"><label className="mb-1 block text-xs font-medium text-muted-foreground">특이사항 · 상담 메모</label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="학습 성향, 필요한 지원, 상담 내용 등을 기록하세요." className="min-h-20 text-sm" disabled={noteLoading} /></div>
              <div className="mt-3 flex justify-end"><Button size="sm" onClick={() => saveNote.mutate()} disabled={saveNote.isPending || noteLoading}><Save className="size-4" /> 저장</Button></div>
            </div>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-1"><Metric label="푼 문제" value={`${solvedCount}개`} icon={BookOpen} /><Metric label="제출 횟수" value={`${totalAttempts}회`} icon={ClipboardList} /><Metric label="보유 포인트" value={`${points.toLocaleString()}P`} icon={Coins} /><Metric label="최근 활동" value={submissions[0] ? new Date(submissions[0].submitted_at).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }) : "없음"} icon={BarChart3} /></div>
          </div>

          <div className="mb-5 rounded-xl border bg-background p-5 shadow-sm"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">최근 14일 학습 활동</h3><div className="flex items-center gap-2"><div className="flex rounded-md border p-0.5 text-xs"><button onClick={() => setChartMetric("submissions")} className={cn("rounded px-2 py-1", chartMetric === "submissions" && "bg-primary text-primary-foreground")}>제출 횟수</button><button onClick={() => setChartMetric("correct")} className={cn("rounded px-2 py-1", chartMetric === "correct" && "bg-primary text-primary-foreground")}>정답 문제</button></div><div className="flex rounded-md border p-0.5 text-xs"><button onClick={() => setChartType("bar")} className={cn("rounded px-2 py-1", chartType === "bar" && "bg-primary text-primary-foreground")}>막대</button><button onClick={() => setChartType("line")} className={cn("rounded px-2 py-1", chartType === "line" && "bg-primary text-primary-foreground")}>선</button></div></div></div><ActivityChart data={dailyData} max={maxDaily} type={chartType} metric={chartMetric} /></div>

          <div className="rounded-xl border bg-background shadow-sm">
            <div className="border-b px-5 py-4">
              <h3 className="font-semibold">제출 이력</h3>
              <p className="text-xs text-muted-foreground">문제별로 최신 제출만 표시합니다. 클릭하면 전체 화면에서 코드 실행·코멘트가 가능합니다.</p>
            </div>
            {submissionsLoading ? (
              <p className="p-5 text-sm text-muted-foreground">제출 이력을 불러오는 중…</p>
            ) : groups.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">아직 제출한 문제가 없습니다.</p>
            ) : (
              <div className="divide-y">
                {groups.map(({ latest, versions }) => (
                  <button
                    key={latest.problem_id}
                    onClick={() => navigate(`/students/${selectedStudent.id}/problems/${latest.problem_id}`)}
                    className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted/50"
                  >
                    <span className={cn("size-2 rounded-full", latest.total_tests > 0 && latest.passed_tests === latest.total_tests ? "bg-emerald-500" : "bg-amber-500")} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{latest.problem_title}</span>
                      <span className="text-xs text-muted-foreground">최근 제출 {new Date(latest.submitted_at).toLocaleString("ko-KR")} · {versions.length}개 버전</span>
                    </span>
                    <span className="text-sm font-semibold">{latest.score}/{latest.max_score}</span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 rounded-xl border bg-background shadow-sm">
            <div className="border-b px-5 py-4">
              <h3 className="font-semibold">포인트 획득 이력</h3>
              <p className="text-xs text-muted-foreground">문제 풀이와 타자 연습 등으로 획득한 포인트입니다.</p>
            </div>
            {pointEarningsLoading ? (
              <p className="p-5 text-sm text-muted-foreground">포인트 이력을 불러오는 중…</p>
            ) : pointEarningsError ? (
              <p className="p-5 text-sm text-destructive">포인트 이력을 불러오지 못했습니다.</p>
            ) : pointEarnings.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">아직 포인트 획득 이력이 없습니다.</p>
            ) : (
              <div className="max-h-80 divide-y overflow-auto">
                {pointEarnings.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
                      <Coins className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{entry.reason || "포인트 지급"}</p>
                      <p className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString("ko-KR")}</p>
                    </div>
                    <strong className="shrink-0 text-sm text-amber-600">+{entry.amount.toLocaleString()}P</strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 rounded-xl border bg-background p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="font-semibold">최근 30일 타자 속도 변화</h3>
              <p className="text-xs text-muted-foreground">모든 타자 연습 모드를 합쳐 날짜별 최고 기록만 표시합니다.</p>
            </div>
            {typingLoading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">타자 기록을 불러오는 중…</p>
            ) : typingError ? (
              <p className="py-12 text-center text-sm text-destructive">타자 기록을 불러오지 못했습니다.</p>
            ) : (
              <TypingTrendChart data={typingTrend} />
            )}
          </div>
        </>}
      </section>
    </div>
  );
}

function ActivityChart({ data, max, type, metric }: { data: { key: string; label: string; count: number }[]; max: number; type: "bar" | "line"; metric: "submissions" | "correct" }) {
  const xAt = (index: number) => 2 + (index / Math.max(1, data.length - 1)) * 96;
  const yAt = (count: number) => 112 - (count / max) * 96;
  const points = data.map((day, index) => `${xAt(index)},${yAt(day.count)}`).join(" ");
  return <div><div className="mb-2 text-xs text-muted-foreground">날짜별 {metric === "submissions" ? "제출 횟수" : "정답 처리된 문제 수"}</div><div className="relative h-40">{type === "bar" ? <div className="flex h-full items-end gap-1.5">{data.map((day) => <div key={day.key} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"><span className="text-[10px] text-muted-foreground">{day.count || ""}</span><div className="w-full max-w-8 rounded-t bg-primary/80 transition-all" style={{ height: `${Math.max(day.count ? 10 : 2, (day.count / max) * 105)}px` }} title={`${day.label}: ${day.count}개`} /><span className="whitespace-nowrap text-[9px] text-muted-foreground">{day.label}</span></div>)}</div> : <><div className="relative h-[125px]"><svg viewBox="0 0 100 120" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-label="학습 활동 선 그래프"><line x1="2" y1="112" x2="98" y2="112" stroke="currentColor" className="text-border" vectorEffect="non-scaling-stroke" /><polyline points={points} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>{data.map((day, index) => <span key={day.key} className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary" style={{ left: `${xAt(index)}%`, top: `${(yAt(day.count) / 120) * 100}%` }} title={`${day.label}: ${day.count}개`} />)}</div><div className="flex justify-between px-0.5">{data.map((day) => <span key={day.key} className="whitespace-nowrap text-[9px] text-muted-foreground">{day.label}</span>)}</div></>}</div></div>;
}

function TypingTrendChart({ data }: { data: DailyTypingBest[] }) {
  const max = Math.max(100, ...data.map((day) => day.taja));
  const xAt = (index: number) => 4 + (index / Math.max(1, data.length - 1)) * 92;
  const yAt = (taja: number) => 108 - (taja / max) * 92;
  const points = data.map((day, index) => `${xAt(index)},${yAt(day.taja)}`).join(" ");
  const hasRecords = data.some((day) => day.taja > 0);

  if (!hasRecords) {
    return <p className="py-12 text-center text-sm text-muted-foreground">최근 30일간 타자 연습 기록이 없습니다.</p>;
  }

  return (
    <div>
      <div className="mb-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{max}타</span>
        <span>일별 최고 타수</span>
      </div>
      <div className="relative h-48">
        <svg viewBox="0 0 100 116" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-label="타자 속도 변화 선 그래프">
          {[16, 62, 108].map((y) => (
            <line key={y} x1="4" y1={y} x2="96" y2={y} stroke="currentColor" className="text-border" vectorEffect="non-scaling-stroke" />
          ))}
          <polyline points={points} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        {data.map((day, index) => day.taja > 0 && (
          <span
            key={day.key}
            className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary"
            style={{ left: `${xAt(index)}%`, top: `${(yAt(day.taja) / 116) * 100}%` }}
            title={`${day.label}: ${day.taja}타${day.mode ? ` · ${TYPING_MODE_LABEL[day.mode]}` : ""}`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
        {data.filter((_, index) => index % 7 === 0 || index === data.length - 1).map((day) => <span key={day.key}>{day.label}</span>)}
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof BookOpen }) { return <div className="rounded-xl border bg-background p-3"><Icon className="mb-2 size-4 text-primary" /><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-0.5 text-lg font-bold">{value}</p></div>; }
function InfoItem({ label, value }: { label: string; value: string }) { return <div><p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p><p className="min-h-9 rounded-md border bg-muted/20 px-3 py-2 text-sm">{value}</p></div>; }
function EmptyState() { return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">관리할 학생을 선택하세요.</div>; }
