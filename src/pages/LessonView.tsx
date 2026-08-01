import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useLesson } from "@/hooks/useLessons";
import { usePyodide } from "@/hooks/usePyodide";
import EditorPanel from "@/components/editor/EditorPanel";
import { Markdown } from "@/components/Markdown";
import { CourseShell } from "@/components/student/StudentCourseNav";
import Solve from "@/pages/Solve";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import type { Lesson } from "@/integrations/supabase/types";

/** HTML 교안: blob URL로 로드해 iframe 자체를 base로 삼음(목차 #앵커·상대경로가 앱 라우터로 새지 않도록). */
function LessonHtml({ lesson }: { lesson: Lesson }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const u = URL.createObjectURL(new Blob([lesson.content], { type: "text/html" }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [lesson.content]);
  if (!url) return null;
  return <iframe title={lesson.title} className="h-full w-full bg-white" sandbox="allow-scripts" src={url} />;
}

function LessonContent({ lesson }: { lesson: Lesson }) {
  if (lesson.content_type === "html") return <LessonHtml lesson={lesson} />;
  return (
    <div className="h-full overflow-auto p-5">
      <Markdown>{lesson.content}</Markdown>
    </div>
  );
}

export default function LessonView() {
  const { lessonId, problemId } = useParams();
  const { data: lesson, isLoading, isError } = useLesson(lessonId);
  const { run, running, stop } = usePyodide();
  const [code, setCode] = useState<string | null>(null);

  // 하위 문제 선택 시: 같은 페이지 본문에서 문제 풀이 임베드 렌더
  if (problemId) {
    return (
      <CourseShell>
        <Solve embedded problemId={problemId} />
      </CourseShell>
    );
  }

  let inner: React.ReactNode;
  if (isLoading) {
    inner = <div className="p-6 text-sm text-muted-foreground">불러오는 중…</div>;
  } else if (isError || !lesson) {
    inner = <div className="p-6 text-sm text-muted-foreground">교안을 찾을 수 없습니다.</div>;
  } else {
    const editorCode = code ?? lesson.starter_code ?? "";
    inner = (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b bg-background px-4 py-2.5">
          <span className="truncate font-semibold">{lesson.title || "교안"}</span>
        </div>
        <div className="min-h-0 flex-1">
          {lesson.code_practice ? (
            <ResizablePanelGroup direction="horizontal" className="h-full">
              <ResizablePanel defaultSize={55} minSize={30} className="min-w-0">
                <LessonContent lesson={lesson} />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize={45} minSize={30} className="min-w-0">
                <EditorPanel code={editorCode} onCodeChange={setCode} running={running} run={run} stop={stop} />
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            <LessonContent lesson={lesson} />
          )}
        </div>
      </div>
    );
  }

  return <CourseShell>{inner}</CourseShell>;
}
