import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Coins, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePublishedProblems } from "@/hooks/useProblems";
import { useProblemsRealtime } from "@/hooks/useProblemsRealtime";
import { listMySubmissions } from "@/lib/submissions";
import type { ProblemCategory, Problem } from "@/integrations/supabase/types";

interface Props {
  title: string;
  category?: ProblemCategory;
  problems?: Problem[];
  /** solve 진입 시 사이드바/뒤로가기 범위 (예: "myclass"면 내 수업 할당 문제만). */
  solveScope?: string;
}

/** category 지정 시 발행된 문제 중 해당 카테고리만, problems 직접 지정 시 그 목록 그대로. */
export default function PracticeList({ title, category, problems: fixedProblems, solveScope }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: published = [], isLoading } = usePublishedProblems(!fixedProblems);
  useProblemsRealtime();
  const { data: submissions = [] } = useQuery({
    queryKey: ["my-submissions", user?.id, "practice-list"],
    queryFn: () => listMySubmissions(user!.id),
    enabled: !!user,
  });

  const problems = fixedProblems ?? (category ? published.filter((p) => p.category === category) : published);
  const statusByProblem = useMemo(() => {
    const map = new Map<string, { attempts: number; bestScore: number; maxScore: number; solved: boolean }>();
    for (const submission of submissions) {
      const current = map.get(submission.problem_id) ?? {
        attempts: 0,
        bestScore: 0,
        maxScore: submission.max_score,
        solved: false,
      };
      current.attempts += 1;
      current.bestScore = Math.max(current.bestScore, submission.score);
      current.maxScore = Math.max(current.maxScore, submission.max_score);
      current.solved ||= submission.max_score > 0 && submission.score >= submission.max_score;
      map.set(submission.problem_id, current);
    }
    return map;
  }, [submissions]);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">{title}</h1>
      {isLoading && !fixedProblems ? (
        <p className="text-muted-foreground">불러오는 중…</p>
      ) : problems.length === 0 ? (
        <p className="text-muted-foreground">아직 문제가 없습니다.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          {problems.map((p) => {
            const status = statusByProblem.get(p.id);
            return (
              <button
                key={p.id}
                type="button"
                className="flex w-full items-center gap-3 border-t px-4 py-3 text-left transition first:border-t-0 hover:bg-accent/50"
                onClick={() => navigate(`/solve/${p.id}${solveScope ? `?scope=${solveScope}` : ""}`)}
              >
                <div className="truncate font-medium">{p.title || "(제목 없음)"}</div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  <Coins className="size-3" />
                  {p.points}P
                </span>
                {status?.solved && (
                  <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    완료
                  </span>
                )}
                {status && (
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    제출 {status.attempts}회{!status.solved && ` · ${status.bestScore}/${status.maxScore}점`}
                  </span>
                )}
                <div className="flex-1" />
                {p.description && (
                  <span title={p.description} className="flex">
                    <MessageCircle className="size-4 shrink-0 text-muted-foreground" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

