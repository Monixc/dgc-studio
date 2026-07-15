import { useNavigate } from "react-router-dom";
import { BookOpen, Megaphone, CalendarDays, Trophy, MessageSquare, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePublishedProblems } from "@/hooks/useProblems";
import { useAllStudents } from "@/hooks/useClassStudents";
import { useAllTeachers } from "@/hooks/useMessages";
import { usePointsRanking } from "@/hooks/usePoints";
import { useQuery } from "@tanstack/react-query";
import { listMySubmissions } from "@/lib/submissions";
import { cn } from "@/lib/utils";
import AppShell, { STUDENT_MENU } from "@/components/layout/AppShell";
import AnnouncementsPanel from "@/components/dashboard/AnnouncementsPanel";
import AcademicEventsPanel from "@/components/dashboard/AcademicEventsPanel";
import MessageCenter from "@/components/dashboard/MessageCenter";

export default function StudentDashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { data: problems = [] } = usePublishedProblems();
  const { data: students = [] } = useAllStudents();
  const { data: teachers = [] } = useAllTeachers();
  const { data: ranking = [] } = usePointsRanking();

  const { data: submissions = [] } = useQuery({
    queryKey: ["my-submissions", user?.id],
    queryFn: () => listMySubmissions(user!.id),
    enabled: !!user,
  });

  const titleOf = (id: string) => problems.find((p) => p.id === id)?.title ?? "문제";
  const recentProblemIds = [...new Set(submissions.map((s) => s.problem_id))].slice(0, 6);

  const rankedStudents = [...students]
    .map((s) => ({ ...s, total: ranking.find((r) => r.studentId === s.id)?.total ?? 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return (
    <AppShell menu={STUDENT_MENU} homePath="/student">
      <div className="p-6">
        <h1 className="mb-1 text-2xl font-bold">대시보드</h1>
        <p className="mb-6 text-sm text-muted-foreground">{user && "환영합니다"}</p>

        <div className="grid auto-rows-[minmax(0,auto)] grid-cols-1 gap-4 md:grid-cols-4">
          {/* 학습 현황: 이어서 풀기 */}
          <Bento className="md:col-span-2 md:row-span-2" icon={BookOpen} title="학습 현황 · 이어서 풀기">
            {recentProblemIds.length === 0 ? (
              <p className="text-sm text-muted-foreground">아직 제출한 문제가 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {recentProblemIds.map((id) => (
                  <div
                    key={id}
                    onClick={() => nav(`/solve/${id}`)}
                    className="flex cursor-pointer items-center justify-between rounded-lg border p-2.5 text-sm hover:bg-accent"
                  >
                    <span className="truncate">{titleOf(id)}</span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}
          </Bento>

          {/* 포인트 랭킹 */}
          <Bento className="md:col-span-2 md:row-span-2" icon={Trophy} title="포인트 랭킹">
            {rankedStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground">아직 포인트 기록이 없습니다.</p>
            ) : (
              <div className="space-y-1.5">
                {rankedStudents.map((s, i) => (
                  <div
                    key={s.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-2 text-sm",
                      s.id === user?.id && "border-primary bg-primary/5",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-5 text-xs text-muted-foreground">{i + 1}</span>
                      {s.display_name || "(이름 없음)"}
                    </span>
                    <span className="font-semibold">{s.total}점</span>
                  </div>
                ))}
              </div>
            )}
          </Bento>

          {/* 공지 */}
          <Bento className="md:col-span-2" icon={Megaphone} title="공지사항">
            <AnnouncementsPanel readOnly />
          </Bento>

          {/* 학사 일정 */}
          <Bento className="md:col-span-2" icon={CalendarDays} title="학사 일정">
            <AcademicEventsPanel readOnly />
          </Bento>

          {/* 쪽지 보내기 */}
          <Bento className="md:col-span-4" icon={MessageSquare} title="쪽지 보내기">
            <MessageCenter recipients={teachers} />
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
