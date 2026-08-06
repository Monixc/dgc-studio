import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MessageSquarePlus, Send, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { usePyodide } from "@/hooks/usePyodide";
import { useStudentSubmissionsRealtime } from "@/hooks/useStudentSubmissionsRealtime";
import { notifyPush } from "@/lib/push";
import {
  createSubmissionComment,
  listManagedStudents,
  listStudentSubmissions,
  listSubmissionComments,
} from "@/lib/studentManagement";
import EditorPanel from "@/components/editor/EditorPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function StudentSubmissionReview() {
  const { studentId, problemId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  useStudentSubmissionsRealtime();
  const { run, running, stop } = usePyodide();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [selection, setSelection] = useState<{ startLine: number; endLine: number; text: string } | null>(null);
  const [refactoring, setRefactoring] = useState(false);
  const [refactorCode, setRefactorCode] = useState("");
  const { run: runRefactor, running: runningRefactor, stop: stopRefactor } = usePyodide();

  const { data: students = [] } = useQuery({
    queryKey: ["student-management", "students", user?.id],
    queryFn: () => listManagedStudents(user!.id),
    enabled: !!user,
  });
  const student = students.find((s) => s.id === studentId);

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["student-management", "submissions", studentId],
    queryFn: () => listStudentSubmissions(studentId!),
    enabled: !!studentId,
  });
  const versions = useMemo(
    () => submissions.filter((s) => s.problem_id === problemId),
    [submissions, problemId],
  );
  useEffect(() => {
    setSelectedId(null);
    setComment("");
    setSelection(null);
    setRefactoring(false);
  }, [studentId, problemId]);

  const selected = versions.find((s) => s.id === selectedId) ?? versions[0] ?? null;

  useEffect(() => {
    setRefactorCode(selected?.code ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 버전 전환시에만 재시드, 타이핑 중 덮어쓰기 방지
  }, [selected?.id]);

  const { data: comments = [] } = useQuery({
    queryKey: ["student-management", "comments", selected?.id],
    queryFn: () => listSubmissionComments(selected!.id),
    enabled: !!selected,
  });

  const addComment = useMutation({
    mutationFn: () =>
      createSubmissionComment({
        submissionId: selected!.id,
        authorId: user!.id,
        body: comment,
        anchor: selection ? { startLine: selection.startLine, endLine: selection.endLine, quotedText: selection.text } : undefined,
      }),
    onSuccess: (commentId) => {
      setComment("");
      setSelection(null);
      if (commentId) void notifyPush("submission_feedback", commentId);
      qc.invalidateQueries({ queryKey: ["student-management", "comments", selected?.id] });
    },
    onError: () => toast.error("코멘트를 저장하지 못했습니다."),
  });

  const highlightRanges = useMemo(
    () => comments.filter((c) => c.start_line != null && c.end_line != null).map((c) => ({ startLine: c.start_line!, endLine: c.end_line! })),
    [comments],
  );

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">불러오는 중…</div>;
  }
  if (!selected) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted-foreground">
        <p>제출을 찾을 수 없습니다.</p>
        <Button variant="outline" onClick={() => navigate("/students")}>학생 관리로</Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-2 border-b p-3">
        <Button size="icon" variant="ghost" onClick={() => navigate("/students")} title="학생 관리로">
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{selected.problem_title}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {student?.display_name || "학생"} · {selected.passed_tests}/{selected.total_tests} 통과 · {selected.score}/{selected.max_score}점
          </p>
        </div>
        <Button
          variant={refactoring ? "default" : "outline"}
          size="sm"
          onClick={() => setRefactoring((v) => !v)}
        >
          {refactoring ? <X /> : <Wrench />}
          {refactoring ? "리팩터링 종료" : "리팩터링"}
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-40 shrink-0 flex-col border-r">
          <div className="border-b px-3 py-2 text-xs font-semibold text-muted-foreground">제출 버전</div>
          <div className="flex-1 overflow-auto p-2">
            {versions.map((version) => (
              <Button
                key={version.id}
                variant="ghost"
                onClick={() => setSelectedId(version.id)}
                className={cn(
                  "mb-1 h-auto w-full justify-start rounded-md p-2 text-left text-xs",
                  selected.id === version.id ? "bg-accent font-medium text-accent-foreground" : "",
                )}
              >
                <span className="flex flex-col">
                  <span className="block">{new Date(version.submitted_at).toLocaleString("ko-KR")}</span>
                  <span className="block opacity-75">{version.score}/{version.max_score}점</span>
                </span>
              </Button>
            ))}
          </div>
        </aside>

        {refactoring ? (
          <div className="grid min-w-0 flex-1 grid-cols-2">
            <div className="min-h-0 min-w-0 border-r">
              <EditorPanel code={selected.code} onCodeChange={() => {}} readOnly running={running} run={run} stop={stop} />
            </div>
            <div className="min-h-0 min-w-0">
              <EditorPanel
                code={refactorCode}
                onCodeChange={setRefactorCode}
                running={runningRefactor}
                run={runRefactor}
                stop={stopRefactor}
              />
            </div>
          </div>
        ) : (
          <>
            <div className={cn("grid min-w-0 flex-1", selected.block_image && "grid-cols-2")}>
              {selected.block_image && (
                <section className="min-h-0 min-w-0 overflow-auto border-r bg-muted/20">
                  <h2 className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-semibold text-muted-foreground">
                    제출한 블록 조합
                  </h2>
                  <div className="p-3">
                    <img
                      src={selected.block_image}
                      alt="학생이 제출한 블록 조합"
                      className="max-w-none rounded border bg-white"
                    />
                  </div>
                </section>
              )}
              <div className="min-h-0 min-w-0">
                <EditorPanel
                  code={selected.code}
                  onCodeChange={() => {}}
                  readOnly
                  running={running}
                  run={run}
                  stop={stop}
                  onSelectionChange={setSelection}
                  highlightRanges={highlightRanges}
                />
              </div>
            </div>

            <aside className="flex w-72 shrink-0 flex-col border-l">
              <div className="border-b p-3">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                  <MessageSquarePlus className="size-4" /> 교사 코멘트
                </div>
                <p className="text-xs text-muted-foreground">{new Date(selected.submitted_at).toLocaleString("ko-KR")}</p>
              </div>
              <div className="flex-1 space-y-2 overflow-auto p-3">
                {comments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">아직 코멘트가 없습니다.</p>
                ) : (
                  comments.map((item) => (
                    <div key={item.id} className="rounded bg-muted p-2 text-xs">
                      {item.start_line != null && (
                        <p className="mb-1 font-mono text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                          {item.start_line === item.end_line ? `${item.start_line}줄` : `${item.start_line}–${item.end_line}줄`}
                        </p>
                      )}
                      <p>{item.body}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleString("ko-KR")}</p>
                    </div>
                  ))
                )}
              </div>
              {selection && (
                <div className="flex items-start gap-2 border-t bg-amber-50 p-2 text-xs dark:bg-amber-950">
                  <span className="mt-0.5 shrink-0 font-mono font-semibold text-amber-700 dark:text-amber-400">
                    {selection.startLine === selection.endLine ? `${selection.startLine}줄` : `${selection.startLine}–${selection.endLine}줄`}
                  </span>
                  <span className="line-clamp-2 flex-1 text-muted-foreground">{selection.text}</span>
                  <button type="button" onClick={() => setSelection(null)} className="shrink-0 text-muted-foreground hover:text-foreground">
                    <X className="size-3.5" />
                  </button>
                </div>
              )}
              <div className="flex gap-2 border-t p-3">
                <Input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) addComment.mutate();
                  }}
                  placeholder={selection ? "선택한 줄에 코멘트 남기기" : "코멘트 남기기"}
                  className="h-9 text-xs"
                />
                <Button size="icon" className="size-9" onClick={() => addComment.mutate()} disabled={!comment.trim() || addComment.isPending}>
                  <Send className="size-4" />
                </Button>
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
