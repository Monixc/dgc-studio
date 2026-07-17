import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Send, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProblem, usePublishedProblems } from "@/hooks/useProblems";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Solve() {
  const { problemId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: problem, isLoading } = useProblem(problemId);
  const { data: problems = [] } = usePublishedProblems();
  const { run, running, stop } = usePyodide();

  const { data: submissions = [], refetch: refetchSubmissions } = useQuery({
    queryKey: ["my-submissions", user?.id],
    queryFn: () => listMySubmissions(user!.id),
    enabled: !!user,
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
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<GradingSummary | null>(null);
  const [runResult, setRunResult] = useState<ConsoleLine[] | undefined>(undefined);

  // 임시저장 복원 (없으면 시작 코드)
  useEffect(() => {
    if (!problem || !user) return;
    setCode(loadDraft(user.id, problem.id) ?? problem.starter_code ?? "");
  }, [problem, user]);

  // 코드 변경 시 디바운스 임시저장
  useEffect(() => {
    if (!problem || !user) return;
    const t = setTimeout(() => saveDraft(user.id, problem.id, code), 500);
    return () => clearTimeout(t);
  }, [code, problem, user]);

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
      await submitSolution({ problemId: problem.id, userId: user.id, code, summary });
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
        <Button size="icon" variant="ghost" onClick={() => navigate(`/practice/${problem.category}`)} title="목록으로">
          <ArrowLeft />
        </Button>
        <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold uppercase text-primary-foreground">
          {problem.category}
        </span>
        <h1 className="text-lg font-semibold">{problem.title}</h1>
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
                    onClick={() => navigate(`/solve/${p.id}`)}
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

        <div className="grid flex-1 grid-cols-2 overflow-hidden">
        {/* 좌: (순서도일 때만 캔버스) + 설명 + 결과 */}
        <div className="flex flex-col overflow-hidden border-r">
          {problem.category === "flowchart" ? (
            <div className="min-h-0 flex-1">
              <FlowchartCanvas graph={normalizeStored(problem.flowchart)} resetKey={problem.id} />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {problem.description && <p className="whitespace-pre-wrap text-sm">{problem.description}</p>}
            </div>
          )}
          <div className={cn("overflow-auto border-t p-3", problem.category === "flowchart" ? "max-h-[45%]" : "max-h-[35%]")}>
            {problem.category === "flowchart" && problem.description && (
              <p className="mb-3 whitespace-pre-wrap text-sm">{problem.description}</p>
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
        </div>

          {/* 우: 코드 편집 + 실행 + 제출 */}
          <div className="h-full">
          <EditorPanel
            code={code}
            onCodeChange={(v) => { setCode(v); setRunResult(undefined); }}
            running={running}
            run={run}
            stop={stop}
            onResult={setRunResult}
            footer={
              <Button size="sm" onClick={handleSubmit} disabled={submitting || running}>
                <Send /> {submitting ? "채점 중…" : "제출"}
              </Button>
            }
          />
        </div>
        </div>
      </div>
    </div>
  );
}
