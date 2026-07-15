import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { usePublishedProblems } from "@/hooks/useProblems";
import { useProblemsRealtime } from "@/hooks/useProblemsRealtime";
import type { ProblemCategory, Problem } from "@/integrations/supabase/types";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  title: string;
  category?: ProblemCategory;
  problems?: Problem[];
}

/** category 지정 시 발행된 문제 중 해당 카테고리만, problems 직접 지정 시 그 목록 그대로. */
export default function PracticeList({ title, category, problems: fixedProblems }: Props) {
  const navigate = useNavigate();
  const { data: published = [], isLoading } = usePublishedProblems(!fixedProblems);
  useProblemsRealtime();

  const problems = fixedProblems ?? (category ? published.filter((p) => p.category === category) : published);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">{title}</h1>
      {isLoading && !fixedProblems ? (
        <p className="text-muted-foreground">불러오는 중…</p>
      ) : problems.length === 0 ? (
        <p className="text-muted-foreground">아직 문제가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {problems.map((p) => (
            <Card key={p.id} className="cursor-pointer hover:bg-accent" onClick={() => navigate(`/solve/${p.id}`)}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="font-medium">{p.title || "(제목 없음)"}</div>
                  {p.description && <div className="line-clamp-1 text-xs text-muted-foreground">{p.description}</div>}
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
