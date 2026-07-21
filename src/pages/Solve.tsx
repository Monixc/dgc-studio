import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Send, CheckCircle2, XCircle, MessageSquare, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { listMySubmissionFeedback } from "@/lib/studentManagement";
import { useSubmissionFeedbackRealtime } from "@/hooks/useSubmissionFeedbackRealtime";
import { useProblem, usePublishedProblems } from "@/hooks/useProblems";
import { useAssignedProblems } from "@/hooks/useClasses";
import { getAssignedClassNames } from "@/lib/classes";
import type { Problem } from "@/integrations/supabase/types";
import { usePyodide } from "@/hooks/usePyodide";
import { buildGradingSummary, type GradingSummary } from "@/lib/grading";
import { submitSolution, listMySubmissions } from "@/lib/submissions";
import { listPublishedProblemFolders } from "@/lib/problemFolders";
import { loadDraft, saveDraft } from "@/lib/draft";
import { useBroadcastLiveCode } from "@/hooks/useLiveCode";
import FlowchartCanvas from "@/components/flow/FlowchartCanvas";
import { normalizeStored } from "@/lib/flow-graph";
import EditorPanel, { type ConsoleLine } from "@/components/editor/EditorPanel";
import BlockWorkspacePanel, { type BlockWorkspacePanelHandle } from "@/features/block-coding/BlockWorkspacePanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/Markdown";
import { RotateCcw } from "lucide-react";

export default function Solve() {
  const { problemId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isMyClass = searchParams.get("scope") === "myclass";
  const { data: problem, isLoading } = useProblem(problemId);
  const { data: published = [] } = usePublishedProblems(!isMyClass);
  const { data: assigned = [] } = useAssignedProblems(isMyClass ? user?.id : undefined);
  const problems = isMyClass ? assigned : published;
  const { data: classNames = [] } = useQuery({
    queryKey: ["assigned-class-names", user?.id, problemId],
    queryFn: () => getAssignedClassNames(user!.id, problemId!),
    enabled: isMyClass && !!user && !!problemId,
  });
  const { run, running, stop } = usePyodide();

  const { data: submissions = [], refetch: refetchSubmissions } = useQuery({
    queryKey: ["my-submissions", user?.id],
    queryFn: () => listMySubmissions(user!.id),
    enabled: !!user,
  });
  useSubmissionFeedbackRealtime();
  const { data: feedback = [] } = useQuery({
    queryKey: ["my-submission-feedback", user?.id, problemId],
    queryFn: () => listMySubmissionFeedback(user!.id, problemId!),
    enabled: !!user && !!problemId,
  });
  const folderIds = [...new Set(problems.flatMap((p) => (p.folder_id ? [p.folder_id] : [])))];
  const { data: folders = [] } = useQuery({
    queryKey: ["published-problem-folders", folderIds],
    queryFn: () => listPublishedProblemFolders(folderIds),
    enabled: folderIds.length > 0,
  });

  const bestSubmissionByProblem = new Map<string, (typeof submissions)[number]>();
  for (const submission of submissions) {
    const best = bestSubmissionByProblem.get(submission.problem_id);
    if (!best || submission.score > best.score) bestSubmissionByProblem.set(submission.problem_id, submission);
  }

  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
  const problemSections = problems
    .filter((p) => p.category === problem?.category)
    .reduce<{ folderId: string | null; folderName: string | null; problems: Problem[] }[]>((sections, item) => {
      const folder = item.folder_id ? foldersById.get(item.folder_id) : undefined;
      const subfolder = folder?.parent_id ? folder : undefined;
      let section = sections.find((candidate) => candidate.folderId === (subfolder?.id ?? null));
      if (!section) {
        section = { folderId: subfolder?.id ?? null, folderName: subfolder?.name ?? null, problems: [] };
        sections.push(section);
      }
      section.problems.push(item);
      return sections;
    }, []);

  const [code, setCode] = useState("");
  const [codeReady, setCodeReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<GradingSummary | null>(null);
  const [runResult, setRunResult] = useState<ConsoleLine[] | undefined>(undefined);
  const [feedbackOpen, setFeedbackOpen] = useState(searchParams.get("feedback") === "1");
  const blockPanelRef = useRef<BlockWorkspacePanelHandle>(null);

  // 임시저장 복원 (없으면 시작 코드)
  useEffect(() => {
    if (!problem || !user) return;
    setCodeReady(false);
    setCode(loadDraft(user.id, problem.id) ?? problem.starter_code ?? "");
    setCodeReady(true);
  }, [problem, user]);

  // 코드 변경 시 디바운스 임시저장
  useEffect(() => {
    if (!problem || !user) return;
    const t = setTimeout(() => saveDraft(user.id, problem.id, code), 500);
    return () => clearTimeout(t);
  }, [code, problem, user]);

  useEffect(() => {
    if (searchParams.get("feedback") === "1") setFeedbackOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (!feedbackOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFeedbackOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [feedbackOpen]);

  // 선생님 "수업하기" 라이브 뷰용 실시간 브로드캐스트 (교사가 볼 때만 의미 있음, 저장 없음)
  useBroadcastLiveCode(
    user?.id,
    problem
      ? {
          code,
          problemId: problem.id,
          problemTitle: problem.title,
          problemDescription: problem.description ?? "",
          category: problem.category,
          flowchart: problem.flowchart,
          executionResult: runResult,
        }
      : null
  );

  async function handleSubmit() {
    if (!problem || !user) return;
    const tests = problem.grading_tests ?? [];
    setSubmitting(true);
    setResult(null);
    try {
      const outputs: string[] = [];
      for (const t of tests) {
        const res = await run(code, { stdin: t.input, timeoutMs: 5000 });
        outputs.push(res.output);
      }
      const summary = buildGradingSummary(tests, outputs);
      const blockImage = problem.category === "block"
        ? await blockPanelRef.current?.captureImage()
        : undefined;
      await submitSolution({ problemId: problem.id, userId: user.id, code, blockImage, summary });
      await refetchSubmissions();
      setResult(summary);
      toast.success(`${summary.passed}/${summary.total} 통과 · ${summary.score}/${summary.maxScore}점`);
    } catch (e: any) {
      toast.error(e?.message ?? "제출 실패");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">불러오는 중…</div>;
  if (!problem) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">문제를 찾을 수 없습니다.</div>;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-2 border-b p-3">
        <Button size="icon" variant="ghost" onClick={() => navigate(isMyClass ? "/myclass" : `/practice/${problem.category}`)} title="목록으로">
          <ArrowLeft />
        </Button>
        <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold uppercase text-primary-foreground">
          {isMyClass && classNames.length > 0 ? classNames.join(", ") : problem.category}
        </span>
        <h1 className="text-lg font-semibold">{problem.title}</h1>
        <Button
          size="icon"
          variant="ghost"
          className="relative ml-auto"
          onClick={() => setFeedbackOpen(true)}
          title="선생님 첨삭"
          aria-label="선생님 첨삭 열기"
        >
          <MessageSquare />
          {feedback.length > 0 && (
            <span className="absolute right-0 top-0 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {feedback.length}
            </span>
          )}
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* 문제 목록 사이드 패널 */}
        <aside className="w-56 shrink-0 overflow-auto border-r">
          {problemSections.map((section) => (
            <div key={section.folderId ?? "unfiled"}>
              {section.folderName && (
                <div className="sticky top-0 z-10 border-b bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground">
                  {section.folderName}
                </div>
              )}
              {section.problems.map((p) => {
                const submission = bestSubmissionByProblem.get(p.id);
                const isCorrect = !!submission && submission.max_score > 0 && submission.score >= submission.max_score;
                return (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/solve/${p.id}${isMyClass ? "?scope=myclass" : ""}`)}
                    className={cn(
                      "flex w-full items-center gap-2 border-b p-2.5 text-left text-sm hover:bg-accent",
                      p.id === problem.id && "bg-accent"
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{p.title || "(제목 없음)"}</span>
                    <span
                      className={cn(
                        "shrink-0 text-xs font-medium",
                        !submission && "text-muted-foreground",
                        submission && !isCorrect && "text-amber-600",
                        isCorrect && "text-emerald-600"
                      )}
                    >
                      {submission ? `${submission.score}/${submission.max_score}점` : "미제출"}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </aside>

        <div
          className={cn(
            "flex-1 overflow-hidden",
            problem.category === "block" ? "flex flex-col" : "grid grid-cols-2",
          )}
        >
        {/* 순서도: 좌(캔버스+설명+결과) 우(에디터) 2열 / 블록 코딩: 위(설명+결과) 아래(블록 작업대) 세로 배치 */}
        <div
          className={cn(
            "flex flex-col overflow-hidden",
            problem.category === "block" ? "max-h-[38%] border-b" : "border-r",
          )}
        >
          {problem.category === "flowchart" ? (
            <div className="min-h-0 flex-1">
              <FlowchartCanvas graph={normalizeStored(problem.flowchart)} resetKey={problem.id} />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {problem.description && <Markdown>{problem.description}</Markdown>}
            </div>
          )}
          {(problem.category === "flowchart" || result) && (
          <div className={cn("overflow-auto border-t p-3", problem.category === "flowchart" ? "max-h-[45%]" : "max-h-[35%]")}>
            {problem.category === "flowchart" && problem.description && (
              <Markdown className="mb-3">{problem.description}</Markdown>
            )}
            {result && (
              <div className="space-y-1">
                <div className="text-sm font-semibold">
                  결과: {result.passed}/{result.total} 통과 · {result.score}/{result.maxScore}점
                </div>
                {result.details.map((d) => (
                  <div key={d.caseId} className="flex items-center gap-2 text-xs">
                    {d.passed ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : (
                      <XCircle className="size-4 text-destructive" />
                    )}
                    <span className={cn(!d.passed && "text-destructive")}>{d.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
        </div>

          {/* 우/아래: 코드 편집 + 실행 + 제출 */}
          <div className={cn(problem.category === "block" ? "min-h-0 flex-1" : "h-full")}>
          <EditorPanel
            code={code}
            onCodeChange={(v) => { setCode(v); setRunResult(undefined); }}
            running={running}
            run={run}
            stop={stop}
            onResult={setRunResult}
            editor={
              problem.category === "block" && codeReady ? (
                <BlockWorkspacePanel
                  key={problem.id}
                  ref={blockPanelRef}
                  starterCode={problem.starter_code ?? ""}
                  initialCode={code}
                  onCodeChange={(v) => { setCode(v); setRunResult(undefined); }}
                />
              ) : undefined
            }
            footer={
              <>
                {problem.category === "block" && (
                  <Button size="sm" variant="outline" onClick={() => blockPanelRef.current?.resetToStarter()}>
                    <RotateCcw /> 초기화
                  </Button>
                )}
                <Button size="sm" onClick={handleSubmit} disabled={submitting || running}>
                  <Send /> {submitting ? "채점 중…" : "제출"}
                </Button>
              </>
            }
          />
        </div>
        </div>
      </div>

      {feedbackOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setFeedbackOpen(false)}
            aria-label="첨삭 패널 닫기"
          />
          <aside
            className="fixed inset-y-0 right-0 z-50 flex w-80 max-w-[90vw] flex-col border-l bg-background shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-panel-title"
          >
            <div className="flex items-center gap-2 border-b p-3">
              <MessageSquare className="size-4 text-primary" />
              <h2 id="feedback-panel-title" className="font-semibold">선생님 첨삭</h2>
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto"
                onClick={() => setFeedbackOpen(false)}
                aria-label="닫기"
              >
                <X />
              </Button>
            </div>
            <div className="flex-1 space-y-3 overflow-auto p-3">
              {feedback.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">아직 등록된 첨삭이 없습니다.</p>
              ) : (
                feedback.map((comment) => (
                  <article key={comment.id} className="rounded-lg border bg-muted/30 p-3 text-sm">
                    <p className="whitespace-pre-wrap">{comment.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(comment.created_at).toLocaleString("ko-KR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </article>
                ))
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
