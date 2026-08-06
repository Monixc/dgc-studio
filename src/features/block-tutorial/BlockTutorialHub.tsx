import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCompletedMissionIds } from "@/hooks/useBlockTutorialProgress";
import { BLOCK_TUTORIALS } from "@/features/block-tutorial/tutorials";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CatMascot from "@/features/block-tutorial/assets/CatMascot";

export default function BlockTutorialHub() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: completedIds = [] } = useCompletedMissionIds(user?.id);
  const completedSet = new Set(completedIds);

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center gap-3">
        <CatMascot mood="happy" />
        <div>
          <h2 className="font-bold">기본 튜토리얼</h2>
          <p className="text-sm text-muted-foreground">블록을 만지며 파이썬 개념을 하나씩 배워봅니다.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {BLOCK_TUTORIALS.map((t) => {
          const total = t.missions.length;
          const done = t.missions.filter((m) => completedSet.has(m.id)).length;
          const finished = done === total;
          return (
            <Card
              key={t.id}
              className="cursor-pointer transition-colors hover:bg-accent/40"
              onClick={() => navigate(`/practice/block/tutorial/${t.id}`)}
            >
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <Badge variant={finished ? "success" : "muted"}>
                    {finished ? <Check className="size-3" /> : <Sparkles className="size-3" />}
                    {t.concept}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {done}/{total}
                  </span>
                </div>
                <div className="font-semibold">{t.title}</div>
                <p className="text-sm text-muted-foreground">{t.summary}</p>
                <div className="mt-1 flex items-center gap-1 text-sm font-medium text-primary">
                  {finished ? "다시 해보기" : done > 0 ? "이어하기" : "시작하기"} <ChevronRight className="size-4" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
