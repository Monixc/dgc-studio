import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Users, FileText, ClipboardList, Plus, Megaphone, Circle, CheckCircle2, XCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMyProblems } from "@/hooks/useProblems";
import { useOnlineUsers } from "@/hooks/usePresence";
import { listRecentSubmissions } from "@/lib/submissions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import AppShell from "@/components/layout/AppShell";
import ScheduleCalendar from "@/components/dashboard/ScheduleCalendar";

export default function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { data: problems = [] } = useMyProblems(user?.id);
  const online = useOnlineUsers();
  const onlineStudents = online.filter((u) => u.role === "student");

  const { data: recent = [] } = useQuery({
    queryKey: ["recent-submissions"],
    queryFn: () => listRecentSubmissions(8),
  });
  const { data: studentCount = 0 } = useQuery({
    queryKey: ["student-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("profiles").select("*", { count: "exact", head: true }).eq("role", "student");
      return count ?? 0;
    },
  });

  const published = problems.filter((p) => p.is_published).length;
  const titleOf = (id: string) => problems.find((p) => p.id === id)?.title ?? "문제";

  return (
    <AppShell>
      <div className="p-6">
        <h1 className="mb-1 text-2xl font-bold">대시보드</h1>
        <p className="mb-6 text-sm text-muted-foreground">학원 및 수업 현황 한눈에 보기</p>

        <div className="grid auto-rows-[minmax(0,auto)] grid-cols-1 gap-4 md:grid-cols-4">
          {/* 수업 시간표 — 편집 가능 캘린더 */}
          <ScheduleCalendar className="md:col-span-2 md:row-span-2" />

          {/* 접속 중인 학생 */}
          <Bento className="md:col-span-2" icon={Users} title={`접속 중인 학생 (${onlineStudents.length})`}>
            {onlineStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground">접속 중인 학생이 없습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {onlineStudents.map((u) => (
                  <span key={u.id} className="flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-sm">
                    <Circle className="size-2 fill-emerald-500 text-emerald-500" />
                    {u.name}
                  </span>
                ))}
              </div>
            )}
          </Bento>

          {/* 통계 */}
          <Stat icon={FileText} label="내 문제" value={problems.length} sub={`발행 ${published}개`} />
          <Stat icon={Users} label="등록 학생" value={studentCount} sub="전체" />

          {/* 최근 제출 */}
          <Bento className="md:col-span-2 md:row-span-2" icon={ClipboardList} title="최근 제출 현황">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">아직 제출이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {recent.map((s) => {
                  const ok = s.passed_tests === s.total_tests && s.total_tests > 0;
                  return (
                    <div key={s.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium">{s.student_name}</div>
                        <div className="truncate text-xs text-muted-foreground">{titleOf(s.problem_id)}</div>
                      </div>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        {ok ? (
                          <CheckCircle2 className="size-4 text-emerald-600" />
                        ) : (
                          <XCircle className="size-4 text-destructive" />
                        )}
                        <span className="font-semibold">{s.score}/{s.max_score}점</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Bento>

          {/* 빠른 실행 */}
          <Bento className="md:col-span-2" icon={Plus} title="빠른 실행">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => nav("/teacher")}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
              >
                문제 만들기
              </button>
              <button
                onClick={() => nav("/teacher")}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-accent"
              >
                문제 관리
              </button>
            </div>
          </Bento>

          {/* 공지 */}
          <Bento className="md:col-span-2" icon={Megaphone} title="공지사항">
            <p className="text-sm text-muted-foreground">등록된 공지가 없습니다.</p>
          </Bento>
        </div>
      </div>
    </AppShell>
  );
}

function Bento({
  className, icon: Icon, title, children,
}: { className?: string; icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-sm", className)}>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-primary" />
        {title}
      </div>
      {children}
    </div>
  );
}

function Stat({
  icon: Icon, label, value, sub,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; sub: string }) {
  return (
    <div className="flex flex-col justify-between rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </div>
      <div className="mt-2">
        <div className="text-3xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}
