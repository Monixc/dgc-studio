import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Send, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProblem } from "@/hooks/useProblems";
import { usePyodide } from "@/hooks/usePyodide";
import { buildGradingSummary, type GradingSummary } from "@/lib/grading";
import { submitSolution } from "@/lib/submissions";
import FlowchartPanel from "@/components/flow/FlowchartPanel";
import EditorPanel from "@/components/editor/EditorPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Solve() {
  const { problemId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: problem, isLoading } = useProblem(problemId);
  const { run, running, stop } = usePyodide();

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<GradingSummary | null>(null);

  useEffect(() => {
    if (problem) setCode(problem.starter_code ?? "");
  }, [problem]);

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
        <Button size="icon" variant="ghost" onClick={() => navigate("/student")}>
          <ArrowLeft />
        </Button>
        <h1 className="font-semibold">{problem.title}</h1>
      </header>

      <div className="grid flex-1 grid-cols-2 overflow-hidden">
        {/* 좌: 순서도 + 설명 + 결과 */}
        <div className="flex flex-col overflow-hidden border-r">
          <div className="min-h-0 flex-1">
            <FlowchartPanel dsl={problem.flowchart?.dsl ?? ""} positions={problem.flowchart?.positions} readOnly />
          </div>
          <div className="max-h-[45%] overflow-auto border-t p-3">
            {problem.description && <p className="mb-3 whitespace-pre-wrap text-sm">{problem.description}</p>}
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
            onCodeChange={setCode}
            running={running}
            run={run}
            stop={stop}
            footer={
              <Button size="sm" onClick={handleSubmit} disabled={submitting || running}>
                <Send /> {submitting ? "채점 중…" : "제출"}
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
}
