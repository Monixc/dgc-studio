import { useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BookOpen, FileCode, FileText, ChevronRight, ChevronDown, ClipboardList, Circle, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAssignedLessons, useLessonProblems, useLessonProblemIds } from "@/hooks/useLessons";
import { useAssignedProblems } from "@/hooks/useClasses";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Lesson } from "@/integrations/supabase/types";

/** 교안 하위 문제 서브리스트 (펼쳤을 때만 조회). */
function LessonSubProblems({ lessonId, activeProblemId }: { lessonId: string; activeProblemId?: string }) {
  const navigate = useNavigate();
  const { data: problems = [], isLoading } = useLessonProblems(lessonId);

  if (isLoading) return <p className="py-1 pl-9 text-xs text-muted-foreground">불러오는 중…</p>;
  if (problems.length === 0) return <p className="py-1 pl-9 text-xs text-muted-foreground">문제 없음</p>;

  return (
    <ul>
      {problems.map((p, i) => (
        <li key={p.id}>
          <button
            type="button"
            onClick={() => navigate(`/student/lessons/${lessonId}/problems/${p.id}`)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md py-1.5 pl-9 pr-2 text-left text-sm hover:bg-accent",
              activeProblemId === p.id && "bg-accent font-medium",
            )}
          >
            <span className="w-4 shrink-0 text-center text-xs text-muted-foreground">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">{p.title || "(제목 없음)"}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function LessonNavItem({
  lesson,
  activeLessonId,
  activeProblemId,
}: {
  lesson: Lesson;
  activeLessonId?: string;
  activeProblemId?: string;
}) {
  const navigate = useNavigate();
  const active = lesson.id === activeLessonId;
  const { data: problemIds = [] } = useLessonProblemIds(lesson.id);
  const hasProblems = problemIds.length > 0;
  const [open, setOpen] = useState(active);

  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md pr-1 text-sm hover:bg-accent",
          active && "bg-accent",
        )}
      >
        {hasProblems ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            title="하위 문제 펼치기/접기"
            className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          >
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        ) : (
          <span className="size-6 shrink-0" aria-hidden />
        )}
        <button
          type="button"
          onClick={() => navigate(`/student/lessons/${lesson.id}`)}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
        >
          {lesson.content_type === "html" ? (
            <FileCode className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <FileText className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className={cn("min-w-0 flex-1 truncate", active && "font-semibold")}>
            {lesson.title || "(제목 없음)"}
          </span>
        </button>
      </div>
      {open && hasProblems && <LessonSubProblems lessonId={lesson.id} activeProblemId={activeProblemId} />}
    </li>
  );
}

/** 좌측 코스 네비 — 교안 목록(+하위 문제) + 개별 배정 문제. */
export function StudentCourseNav() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { lessonId, problemId } = useParams();
  const { data: lessons = [] } = useAssignedLessons(user?.id);
  const { data: standalone = [] } = useAssignedProblems(user?.id);

  return (
    <nav className="w-full shrink-0 overflow-auto border-b bg-muted/20 p-2 md:max-h-none md:w-64 md:border-b-0 md:border-r max-md:max-h-56">
      <p className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-muted-foreground">
        <BookOpen className="size-3.5" /> 교안
      </p>
      {lessons.length === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">배정된 교안이 없습니다.</p>
      ) : (
        <ul className="mb-2">
          {lessons.map((l) => (
            <LessonNavItem key={l.id} lesson={l} activeLessonId={lessonId} activeProblemId={problemId} />
          ))}
        </ul>
      )}

      {standalone.length > 0 && (
        <>
          <p className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-muted-foreground">
            <ClipboardList className="size-3.5" /> 문제
          </p>
          <ul>
            {standalone.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/solve/${p.id}?scope=myclass`)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                    problemId === p.id && "bg-accent font-medium",
                  )}
                >
                  <Circle className="size-2 shrink-0 fill-muted text-muted" />
                  <span className="min-w-0 flex-1 truncate">{p.title || "(제목 없음)"}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </nav>
  );
}

/** 학생 수업 셸: 풀스크린(메인 사이드메뉴 없음) — 좌측 코스 네비 + 본문. Solve 화면과 동일 성격. */
export function CourseShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-2 border-b bg-background p-3">
        <Button size="icon" variant="ghost" onClick={() => navigate("/student")} title="홈으로">
          <ArrowLeft />
        </Button>
        <h1 className="font-semibold">내 수업</h1>
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <StudentCourseNav />
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
