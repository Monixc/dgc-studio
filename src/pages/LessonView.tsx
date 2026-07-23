import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import AppShell, { STUDENT_MENU } from "@/components/layout/AppShell";
import { useLesson } from "@/hooks/useLessons";
import { usePyodide } from "@/hooks/usePyodide";
import EditorPanel from "@/components/editor/EditorPanel";
import { Markdown } from "@/components/Markdown";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import type { Lesson } from "@/integrations/supabase/types";

function LessonContent({ lesson }: { lesson: Lesson }) {
  if (lesson.content_type === "html") {
    return (
      <iframe
        title={lesson.title}
        className="h-full w-full bg-white"
        sandbox="allow-scripts"
        srcDoc={lesson.content}
      />
    );
  }
  return (
    <div className="h-full overflow-auto p-5">
      <Markdown>{lesson.content}</Markdown>
    </div>
  );
}

export default function LessonView() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { data: lesson, isLoading, isError } = useLesson(lessonId);
  const { run, running, stop } = usePyodide();
  const [code, setCode] = useState<string | null>(null);

  const body = (() => {
    if (isLoading) return <div className="p-6 text-sm text-muted-foreground">불러오는 중…</div>;
    if (isError || !lesson) return <div className="p-6 text-sm text-muted-foreground">교안을 찾을 수 없습니다.</div>;

    const editorCode = code ?? lesson.starter_code ?? "";

    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b bg-background px-4 py-2.5">
          <button
            type="button"
            className="rounded-full border px-3 py-1.5 text-sm hover:bg-accent"
            onClick={() => navigate("/myclass")}
          >
            <ArrowLeft className="mr-1 inline size-4" /> 내 수업
          </button>
          <span className="truncate font-semibold">{lesson.title || "교안"}</span>
        </div>

        {lesson.code_practice ? (
          <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
            <ResizablePanel defaultSize={55} minSize={30} className="min-w-0">
              <LessonContent lesson={lesson} />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={45} minSize={30} className="min-w-0">
              <EditorPanel code={editorCode} onCodeChange={setCode} running={running} run={run} stop={stop} />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="min-h-0 flex-1">
            <LessonContent lesson={lesson} />
          </div>
        )}
      </div>
    );
  })();

  return (
    <AppShell menu={STUDENT_MENU} homePath="/student">
      <div className="h-full">{body}</div>
    </AppShell>
  );
}
