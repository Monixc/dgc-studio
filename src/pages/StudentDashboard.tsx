import { useNavigate } from "react-router-dom";
import { BookOpen, Trophy, ChevronRight, Megaphone } from "lucide-react";
import AnnouncementsPanel from "@/components/dashboard/AnnouncementsPanel";
import { useAuth } from "@/hooks/useAuth";
import { usePublishedProblems } from "@/hooks/useProblems";
import { useAssignedProblems } from "@/hooks/useClasses";
import { useAllStudents } from "@/hooks/useClassStudents";
import { usePointsRanking } from "@/hooks/usePoints";
import { useQuery } from "@tanstack/react-query";
import { listMySubmissions } from "@/lib/submissions";
import { cn } from "@/lib/utils";
import AppShell, { STUDENT_MENU } from "@/components/layout/AppShell";

function greetingFor(hour: number) {
  if (hour < 12) return "좋은 아침이에요";
  if (hour < 18) return "좋은 오후예요";
  return "좋은 저녁이에요";
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { data: problems = [] } = usePublishedProblems();
  const { data: assigned = [] } = useAssignedProblems(user?.id);
  const { data: students = [] } = useAllStudents();
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
    .slice(0, 5);
  const name = user?.user_metadata?.display_name || "학생";

  return (
    <AppShell menu={STUDENT_MENU} homePath="/student">
      <div className="p-6">
        <div className="grid auto-rows-[minmax(0,auto)] grid-cols-1 gap-4 md:grid-cols-4">
          <div className="flex flex-col justify-between rounded-2xl bg-zinc-900 p-6 text-white md:col-span-4">
            <div className="flex gap-1.5"><span className="size-3 rounded-full bg-red-400" /><span className="size-3 rounded-full bg-yellow-400" /><span className="size-3 rounded-full bg-green-400" /></div>
            <div className="mt-6"><h1 className="text-2xl font-bold">{greetingFor(new Date().getHours())}, {name}님.</h1><p className="mt-2 text-sm text-white/70">오늘 풀어볼 문제 {assigned.length}개, 누적 제출 {submissions.length}회가 있어요.</p></div>
            <div className="mt-6"><button onClick={() => nav("/myclass")} className="rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white/90">문제 풀러 가기</button></div>
          </div>
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

          {/* 공지사항 */}
          <Bento className="md:col-span-4" icon={Megaphone} title="공지사항">
            <AnnouncementsPanel readOnly />
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
