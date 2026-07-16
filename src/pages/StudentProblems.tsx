import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LogOut, ChevronRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth";
import { usePublishedProblems } from "@/hooks/useProblems";
import { useProblemsRealtime } from "@/hooks/useProblemsRealtime";
import { listMySubmissions } from "@/lib/submissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function StudentProblems() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { data: problems = [], isLoading } = usePublishedProblems();
  useProblemsRealtime();

  const { data: submissions = [] } = useQuery({
    queryKey: ["my-submissions", user?.id],
    queryFn: () => listMySubmissions(user!.id),
    enabled: !!user,
  });
  const solvedIds = new Set(submissions.map((s) => s.problem_id));

  return (
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">문제 풀기</h1>
          <p className="text-sm text-muted-foreground">{profile?.display_name} 학생</p>
        </div>
        <Button variant="outline" onClick={() => signOut()}>
          <LogOut /> 로그아웃
        </Button>
      </header>

      {isLoading ? (
        <p className="text-muted-foreground">불러오는 중…</p>
      ) : problems.length === 0 ? (
        <p className="text-muted-foreground">아직 공개된 문제가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {problems.map((p) => (
            <Card key={p.id} className="cursor-pointer hover:bg-accent" onClick={() => navigate(`/solve/${p.id}`)}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-2">
                  {solvedIds.has(p.id) && <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />}
                  <div>
                    <div className="font-medium">{p.title || "(제목 없음)"}</div>
                    {p.description && <div className="line-clamp-1 text-xs text-muted-foreground">{p.description}</div>}
                  </div>
                </div>
                <ChevronRight className="text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
