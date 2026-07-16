import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, PanelBottomOpen, PanelBottomClose, Circle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useClasses } from "@/hooks/useClasses";
import { useAllStudents, useClassStudentIds } from "@/hooks/useClassStudents";
import { useOnlineUsers } from "@/hooks/usePresence";
import { useLiveCodeFeed, type LiveCodePayload } from "@/hooks/useLiveCode";
import { usePyodide } from "@/hooks/usePyodide";
import { useProblem } from "@/hooks/useProblems";
import { listMySubmissions } from "@/lib/submissions";
import FlowchartCanvas from "@/components/flow/FlowchartCanvas";
import { normalizeStored } from "@/lib/flow-graph";
import EditorPanel from "@/components/editor/EditorPanel";
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
  const { run, running, stop } = usePyodide();

  // 학생이 아직 이번 세션에 브로드캐스트하지 않았으면 마지막 제출 코드를 기본값으로 보여준다.
  const { data: lastSubmissions = [] } = useQuery({
    queryKey: ["last-submission", studentId],
    queryFn: () => listMySubmissions(studentId),
    enabled: !feed,
  });
  const lastSubmission = lastSubmissions[0];
  const { data: lastProblem } = useProblem(!feed ? lastSubmission?.problem_id : undefined);

  const fallback: (LiveCodePayload & { isLive: false }) | null =
    !feed && lastSubmission && lastProblem
      ? {
          isLive: false,
          code: lastSubmission.code,
          problemId: lastProblem.id,
          problemTitle: lastProblem.title,
          problemDescription: lastProblem.description ?? "",
          category: lastProblem.category,
          flowchart: lastProblem.flowchart,
        }
      : null;

  const display = feed ? { ...feed, isLive: true as const } : fallback;
  const isFlowchart = display?.category === "flowchart";

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-md border">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-2 py-1">
        <span className="truncate text-xs font-semibold">{name || "(이름 없음)"}</span>
        {display && <span className="truncate text-xs text-muted-foreground">— {display.problemTitle}</span>}
        {display && !display.isLive && (
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">최근 제출(실시간 아님)</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {display && (
            <button onClick={() => setShowProblem((v) => !v)} title="문제 펼치기/접기" className="text-muted-foreground hover:text-foreground">
              {showProblem ? <PanelBottomClose className="size-3.5" /> : <PanelBottomOpen className="size-3.5" />}
            </button>
          )}
          <button onClick={onClose} title="그만 보기" className="text-xs text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      </div>

      {!display ? (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
          아직 문제를 풀고 있지 않습니다.
        </div>
      ) : (
        <>
          {showProblem && (
            <div className={cn("overflow-auto border-b", isFlowchart ? "h-48" : "max-h-24 p-2 text-xs text-muted-foreground")}>
              {isFlowchart ? (
                <FlowchartCanvas graph={normalizeStored(display.flowchart)} resetKey={display.problemId} />
              ) : (
                display.problemDescription || "설명 없음"
              )}
            </div>
          )}
          {display.executionResult && display.executionResult.length > 0 && (
            <div className="max-h-20 overflow-auto border-b bg-muted/20 p-2 font-mono text-[11px]">
              <div className="mb-1 font-sans font-semibold text-muted-foreground">학생 실행 결과</div>
              {display.executionResult.map((l, i) => (
                <div key={i} className={cn(l.kind === "err" && "text-destructive")}>{l.text}</div>
              ))}
            </div>
          )}
          <div className="min-h-0 flex-1">
            <EditorPanel code={display.code} onCodeChange={() => {}} readOnly running={running} run={run} stop={stop} />
          </div>
        </>
      )}
    </div>
  );
}
