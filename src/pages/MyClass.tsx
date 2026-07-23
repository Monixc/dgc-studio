import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, FileCode, Code2, ChevronRight, BookOpen, ClipboardList } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAssignedProblems } from "@/hooks/useClasses";
import { useAssignedLessons } from "@/hooks/useLessons";
import AppShell, { STUDENT_MENU } from "@/components/layout/AppShell";
import PracticeList from "@/components/student/PracticeList";
import { cn } from "@/lib/utils";

type Tab = "lessons" | "problems";

export default function MyClass() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: problems = [] } = useAssignedProblems(user?.id);
  const { data: lessons = [] } = useAssignedLessons(user?.id);

  const [override, setOverride] = useState<Tab | null>(null);
  // 수동 선택 전에는 교안이 있으면 교안, 없으면 문제 탭
  const tab: Tab = override ?? (lessons.length ? "lessons" : "problems");

  const tabs: { id: Tab; label: string; icon: typeof BookOpen; count: number }[] = [
    { id: "lessons", label: "교안", icon: BookOpen, count: lessons.length },
    { id: "problems", label: "문제", icon: ClipboardList, count: problems.length },
  ];

  return (
    <AppShell menu={STUDENT_MENU} homePath="/student">
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b px-4 pt-4 sm:px-6">
          <h1 className="mb-3 text-2xl font-bold">내 수업</h1>
          <div className="flex gap-1">
            {tabs.map(({ id, label, icon: Icon, count }) => (
              <button
                key={id}
                type="button"
                onClick={() => setOverride(id)}
                className={cn(
                  "inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors",
                  tab === id
                    ? "border-primary font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs",
                    tab === id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {tab === "lessons" ? (
            <div className="p-4 sm:p-6">
              {lessons.length === 0 ? (
                <p className="text-sm text-muted-foreground">아직 배정된 교안이 없습니다.</p>
              ) : (
                <div className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
                  {lessons.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => navigate(`/student/lessons/${l.id}`)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
                    >
                      {l.content_type === "html" ? (
                        <FileCode className="size-5 shrink-0 text-muted-foreground" />
                      ) : (
                        <FileText className="size-5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1 truncate font-medium">{l.title || "(제목 없음)"}</span>
                      {l.code_practice && (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          <Code2 className="size-3.5" /> 실습
                        </span>
                      )}
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <PracticeList problems={problems} solveScope="myclass" />
          )}
        </div>
      </div>
    </AppShell>
  );
}
