import { useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BookOpen, FileCode, FileText, ChevronRight, ChevronDown, ClipboardList, Circle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAssignedLessons, useLessonProblems, useLessonProblemIds } from "@/hooks/useLessons";
import { useAssignedProblems } from "@/hooks/useClasses";
import { Button } from "@/components/ui/button";
import AppShell, { STUDENT_MENU } from "@/components/layout/AppShell";
import {
  SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupContent,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger, SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { Lesson } from "@/integrations/supabase/types";

/** 교안 하위 문제 서브리스트 (펼쳤을 때만 조회). */
function LessonSubProblems({ lessonId, activeProblemId }: { lessonId: string; activeProblemId?: string }) {
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();
  const { data: problems = [], isLoading } = useLessonProblems(lessonId);

  if (isLoading) return <p className="py-1 pl-9 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">불러오는 중…</p>;
  if (problems.length === 0) return <p className="py-1 pl-9 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">문제 없음</p>;

  return (
    <ul className="group-data-[collapsible=icon]:hidden">
      {problems.map((p, i) => (
        <li key={p.id}>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              navigate(`/student/lessons/${lessonId}/problems/${p.id}`);
              if (isMobile) setOpenMobile(false);
            }}
            className={cn(
              "h-auto w-full justify-start gap-2 py-1.5 pl-9 pr-2 font-normal",
              activeProblemId === p.id && "bg-accent text-foreground font-medium",
            )}
          >
            <span className="w-4 shrink-0 text-center text-xs text-muted-foreground">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">{p.title || "(제목 없음)"}</span>
          </Button>
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
  const { isMobile, setOpenMobile } = useSidebar();
  const active = lesson.id === activeLessonId;
  const { data: problemIds = [] } = useLessonProblemIds(lesson.id);
  const hasProblems = problemIds.length > 0;
  const [open, setOpen] = useState(active);

  return (
    <SidebarMenuItem>
      <div
        className={cn(
          "group/row flex items-center gap-1 rounded-md pr-1 text-sm hover:bg-accent group-data-[collapsible=icon]:justify-center",
          active && "bg-accent",
        )}
      >
        {hasProblems ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setOpen((o) => !o)}
            title="하위 문제 펼치기/접기"
            className="size-6 shrink-0 rounded text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:hidden"
          >
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </Button>
        ) : (
          <span className="size-6 shrink-0 group-data-[collapsible=icon]:hidden" aria-hidden />
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            navigate(`/student/lessons/${lesson.id}`);
            if (isMobile) setOpenMobile(false);
          }}
          className="h-auto min-w-0 flex-1 justify-start gap-2 py-1.5 font-normal group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
        >
          {lesson.content_type === "html" ? (
            <FileCode className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <FileText className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className={cn("min-w-0 flex-1 truncate group-data-[collapsible=icon]:hidden", active && "font-semibold")}>
            {lesson.title || "(제목 없음)"}
          </span>
        </Button>
      </div>
      {open && hasProblems && <LessonSubProblems lessonId={lesson.id} activeProblemId={activeProblemId} />}
    </SidebarMenuItem>
  );
}

/** 좌측 코스 네비 — 교안 목록(+하위 문제) + 개별 배정 문제. */
export function StudentCourseNav() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();
  const { lessonId, problemId } = useParams();
  const { data: lessons = [] } = useAssignedLessons(user?.id);
  const { data: standalone = [] } = useAssignedProblems(user?.id);

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>
          <BookOpen className="mr-1.5 size-3.5" /> 교안
        </SidebarGroupLabel>
        <SidebarGroupContent>
          {lessons.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">배정된 교안이 없습니다.</p>
          ) : (
            <SidebarMenu>
              {lessons.map((l) => (
                <LessonNavItem key={l.id} lesson={l} activeLessonId={lessonId} activeProblemId={problemId} />
              ))}
            </SidebarMenu>
          )}
        </SidebarGroupContent>
      </SidebarGroup>

      {standalone.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel>
            <ClipboardList className="mr-1.5 size-3.5" /> 문제
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {standalone.map((p) => (
                <SidebarMenuItem key={p.id}>
                  <SidebarMenuButton
                    isActive={problemId === p.id}
                    tooltip={p.title || "(제목 없음)"}
                    onClick={() => {
                      navigate(`/solve/${p.id}?scope=myclass`);
                      if (isMobile) setOpenMobile(false);
                    }}
                  >
                    <Circle className="size-2 shrink-0 fill-muted text-muted" />
                    <span className="min-w-0 flex-1 truncate">{p.title || "(제목 없음)"}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
    </>
  );
}

/** 학생 수업 셸: AppShell(전역 헤더) + 좌측 코스 네비(진짜 Sidebar, 접기 가능) + 본문. */
export function CourseShell({ children }: { children: ReactNode }) {
  return (
    <AppShell menu={STUDENT_MENU} homePath="/student">
      <SidebarProvider className="h-full min-h-0 items-stretch">
        <Sidebar collapsible="icon" className="border-r">
          <SidebarHeader className="border-b">
            <span className="whitespace-nowrap text-sm font-semibold group-data-[collapsible=icon]:hidden">내 수업</span>
          </SidebarHeader>
          <SidebarContent>
            <StudentCourseNav />
          </SidebarContent>
        </Sidebar>
        <SidebarRail />

        <SidebarInset className="min-w-0">
          <div className="flex items-center gap-1 border-b p-2">
            <SidebarTrigger />
          </div>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </AppShell>
  );
}
