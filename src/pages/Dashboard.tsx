import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Plus, Megaphone, CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMyProblems } from "@/hooks/useProblems";
import { useOnlineUsers } from "@/hooks/usePresence";
import { listRecentSubmissions } from "@/lib/submissions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import AppShell from "@/components/layout/AppShell";
import ScheduleCalendar, { todayEventCount } from "@/components/dashboard/ScheduleCalendar";
import AnnouncementsPanel from "@/components/dashboard/AnnouncementsPanel";

function greetingFor(hour: number) {
  if (hour < 12) return "좋은 아침이에요";
  if (hour < 18) return "좋은 오후예요";
  return "좋은 저녁이에요";
}

function timeAgo(iso: string) {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  return `${Math.floor(diffHour / 24)}일 전`;
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const { data: problems = [] } = useMyProblems(user?.id);
  const online = useOnlineUsers();
  const onlineStudents = online.filter((u) => u.role === "student");

  const { data: recent = [] } = useQuery({
    queryKey: ["recent-submissions"],
    queryFn: () => listRecentSubmissions(8),
  });
  const [announceOpen, setAnnounceOpen] = useState(false);

  const titleOf = (id: string) => problems.find((p) => p.id === id)?.title ?? "문제";
  const todayClasses = user ? todayEventCount(user.id) : 0;
  const name = profile?.display_name || "선생님";

  return (
    <AppShell>
      <div className="p-6">
        <div className="grid auto-rows-[minmax(0,auto)] grid-cols-1 gap-4 md:grid-cols-4">
          {/* 인사말 히어로 */}
          <div className="flex flex-col justify-between rounded-2xl bg-zinc-900 p-6 text-white md:col-span-4">
            <div className="flex gap-1.5">
              <span className="size-3 rounded-full bg-red-400" />
              <span className="size-3 rounded-full bg-yellow-400" />
              <span className="size-3 rounded-full bg-green-400" />
            </div>
            <div className="mt-6">
              <h1 className="text-2xl font-bold">{greetingFor(new Date().getHours())}, {name}님.</h1>
              <p className="mt-2 text-sm text-white/70">
                오늘 수업 {todayClasses}개, 최근 제출 {recent.length}건이 있어요.
              </p>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => nav("/problems")}
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white/90"
              >
                제출 확인하기
              </button>
              <button
                onClick={() => document.getElementById("schedule")?.scrollIntoView({ behavior: "smooth" })}
                className="rounded-full border border-white/30 px-4 py-2 text-sm hover:bg-white/10"
              >
                시간표 보기
              </button>
            </div>
          </div>

          {/* 접속 중인 학생 */}
          <Bento className="md:col-span-2" icon={Users} title="접속 중인 학생" badge={`${onlineStudents.length} Online`}>
            {onlineStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground">접속 중인 학생이 없습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {onlineStudents.map((u) => (
                  <span key={u.id} className="relative flex items-center gap-2 rounded-full border bg-background py-1 pl-1 pr-3 text-sm">
                    <span className="relative flex size-6 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-semibold text-white">
                      {u.name.trim().charAt(0).toUpperCase()}
                      <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border border-background bg-orange-500" />
                    </span>
                    {u.name}
                  </span>
                ))}
              </div>
            )}
          </Bento>

          {/* 최근 제출 */}
          <Bento className="md:col-span-2 md:row-span-2" icon={CheckCircle2} title="최근 제출" action={
            <button onClick={() => nav("/problems")} className="text-xs text-muted-foreground hover:text-foreground">전체 보기</button>
          }>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">아직 제출이 없습니다.</p>
            ) : (
              <div className="space-y-1">
                {recent.slice(0, 5).map((s) => {
                  const perfect = s.passed_tests === s.total_tests && s.total_tests > 0;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => nav(`/students/${s.user_id}/problems/${s.problem_id}`)}
                      className="flex w-full items-center justify-between border-b py-2.5 text-left text-sm last:border-0 hover:bg-accent/50"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{titleOf(s.problem_id)}</div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="rounded-full bg-muted px-2 py-0.5">Python</span>
                          {s.student_name}
                        </div>
                      </div>
                      <div className="whitespace-nowrap text-right">
                        <div className={cn("font-semibold", perfect ? "text-orange-500" : "text-foreground")}>
                          {s.score}/{s.max_score}
                        </div>
                        <div className="text-xs text-muted-foreground">{timeAgo(s.submitted_at)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Bento>

          {/* 공지 */}
          <Bento className="md:col-span-2" icon={Megaphone} title="공지사항" action={
            <Button size="sm" className="ml-auto" onClick={() => setAnnounceOpen(true)}>
              <Plus /> 공지 추가
            </Button>
          }>
            <AnnouncementsPanel open={announceOpen} onOpenChange={setAnnounceOpen} />
          </Bento>

          {/* 수업 시간표 — 편집 가능 캘린더 */}
          <div id="schedule" className="md:col-span-4">
            <ScheduleCalendar />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Bento({
  className, icon: Icon, title, badge, action, children,
}: {
  className?: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border bg-card p-4", className)}>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4" />
        {title}
        {badge && <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{badge}</span>}
        {action}
      </div>
      {children}
    </div>
  );
}

