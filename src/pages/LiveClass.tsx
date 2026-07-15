import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, PanelBottomOpen, PanelBottomClose, Circle } from "lucide-react";
import Editor from "@monaco-editor/react";
import { useAuth } from "@/hooks/useAuth";
import { useClasses } from "@/hooks/useClasses";
import { useAllStudents, useClassStudentIds } from "@/hooks/useClassStudents";
import { useOnlineUsers } from "@/hooks/usePresence";
import { useLiveCodeFeed } from "@/hooks/useLiveCode";
import FlowchartCanvas from "@/components/flow/FlowchartCanvas";
import { normalizeStored } from "@/lib/flow-graph";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_WATCH = 4;

export default function LiveClass() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: classes = [] } = useClasses(user?.id);
  const cls = classes.find((c) => c.id === classId);

  const { data: students = [] } = useAllStudents();
  const { data: enrolledIds = [] } = useClassStudentIds(classId);
  const enrolled = students.filter((s) => enrolledIds.includes(s.id));

  const online = useOnlineUsers();
  const onlineIds = new Set(online.filter((u) => u.role === "student").map((u) => u.id));
  const [watching, setWatching] = useState<string[]>([]);

  function toggleWatch(id: string) {
    setWatching((prev) => {
      if (prev.includes(id)) return prev.filter((w) => w !== id);
      if (prev.length >= MAX_WATCH) return prev;
      return [...prev, id];
    });
  }

  const gridClass =
    watching.length <= 1 ? "grid-cols-1" : watching.length === 2 ? "grid-cols-2" : "grid-cols-2 grid-rows-2";

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-2 border-b p-3">
        <Button size="icon" variant="ghost" onClick={() => navigate("/classes")}>
          <ArrowLeft />
        </Button>
        <h1 className="font-semibold">수업하기 — {cls?.name || "반"}</h1>
      </header>

      <div className="flex min-h-0 flex-1 gap-3 p-3">
        <div className="w-48 shrink-0 overflow-auto border-r pr-2">
          <p className="mb-2 text-xs text-muted-foreground">접속 중인 학생을 선택하세요 (최대 {MAX_WATCH}명)</p>
          {enrolled.length === 0 ? (
            <p className="text-sm text-muted-foreground">등록된 학생이 없습니다.</p>
          ) : (
            enrolled.map((s) => {
              const isOnline = onlineIds.has(s.id);
              const isWatching = watching.includes(s.id);
              return (
                <button
                  key={s.id}
                  disabled={!isOnline}
                  onClick={() => toggleWatch(s.id)}
                  className={cn(
                    "mb-1 flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40",
                    isWatching && "bg-accent"
                  )}
                >
                  <Circle className={cn("size-2 shrink-0", isOnline ? "fill-emerald-500 text-emerald-500" : "fill-muted text-muted")} />
                  <span className="truncate">{s.display_name || "(이름 없음)"}</span>
                </button>
              );
            })
          )}
        </div>

        <div className="min-h-0 flex-1">
          {watching.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              왼쪽에서 학생을 선택하면 실시간 화면이 표시됩니다.
            </div>
          ) : (
            <div className={cn("grid h-full gap-2", gridClass)}>
              {watching.map((id) => (
                <StudentTile
                  key={id}
                  studentId={id}
                  name={enrolled.find((s) => s.id === id)?.display_name ?? ""}
                  compact={watching.length > 2}
                  onClose={() => toggleWatch(id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StudentTile({
  studentId,
  name,
  compact,
  onClose,
}: {
  studentId: string;
  name: string;
  compact: boolean;
  onClose: () => void;
}) {
  const feed = useLiveCodeFeed(studentId);
  const [showProblem, setShowProblem] = useState(!compact);
  const isFlowchart = feed?.category === "flowchart";

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-md border">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-2 py-1">
        <span className="truncate text-xs font-semibold">{name || "(이름 없음)"}</span>
        {feed && <span className="truncate text-xs text-muted-foreground">— {feed.problemTitle}</span>}
        <div className="ml-auto flex items-center gap-1">
          {feed && (
            <button onClick={() => setShowProblem((v) => !v)} title="문제 펼치기/접기" className="text-muted-foreground hover:text-foreground">
              {showProblem ? <PanelBottomClose className="size-3.5" /> : <PanelBottomOpen className="size-3.5" />}
            </button>
          )}
          <button onClick={onClose} title="그만 보기" className="text-xs text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      </div>

      {!feed ? (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
          아직 문제를 풀고 있지 않습니다.
        </div>
      ) : (
        <>
          {showProblem && (
            <div className={cn("overflow-auto border-b", isFlowchart ? "h-48" : "max-h-24 p-2 text-xs text-muted-foreground")}>
              {isFlowchart ? (
                <FlowchartCanvas graph={normalizeStored(feed.flowchart)} resetKey={feed.problemId} />
              ) : (
                feed.problemDescription || "설명 없음"
              )}
            </div>
          )}
          <div className="min-h-0 flex-1">
            <Editor
              language="python"
              value={feed.code}
              options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12, scrollBeyondLastLine: false }}
            />
          </div>
        </>
      )}
    </div>
  );
}
