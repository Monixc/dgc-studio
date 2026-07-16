import { Plus, Trash2 } from "lucide-react";
import type { GradingTest } from "@/integrations/supabase/types";
import { makeEmptyTest, toPositivePoints } from "@/lib/grading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Props {
  tests: GradingTest[];
  onChange: (tests: GradingTest[]) => void;
}

export default function GradingTestsEditor({ tests, onChange }: Props) {
  const update = (id: string, patch: Partial<GradingTest>) =>
    onChange(tests.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const remove = (id: string) => onChange(tests.filter((t) => t.id !== id));

  return (
    <div className="space-y-4 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          입력(stdin)을 주고 학생 코드의 출력(stdout)이 기대 출력과 일치하면 정답. 총 {tests.length}개.
        </p>
        <Button size="sm" onClick={() => onChange([...tests, makeEmptyTest()])}>
          <Plus /> 테스트 추가
        </Button>
      </div>

      {tests.length === 0 && <p className="text-sm text-muted-foreground">테스트가 없으면 제출 점수는 0점입니다.</p>}

      {tests.map((t, i) => (
        <div key={t.id} className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">#{i + 1}</span>
            <Input value={t.title} onChange={(e) => update(t.id, { title: e.target.value })} placeholder="테스트 이름" className="flex-1" />
            <div className="flex items-center gap-1">
              <Label className="text-xs">배점</Label>
              <Input
                type="number"
                min={1}
                value={t.points || ""}
                onChange={(e) => update(t.id, { points: e.target.value === "" ? 0 : Number(e.target.value) })}
                onBlur={(e) => update(t.id, { points: toPositivePoints(e.target.value) })}
                className="w-16"
              />
            </div>
            <Button size="icon" variant="ghost" onClick={() => remove(t.id)} title="삭제">
              <Trash2 />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">입력 (stdin)</Label>
              <Textarea value={t.input} onChange={(e) => update(t.id, { input: e.target.value })} className="h-24 font-mono text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">기대 출력 (stdout)</Label>
              <Textarea value={t.expectedOutput} onChange={(e) => update(t.id, { expectedOutput: e.target.value })} className="h-24 font-mono text-xs" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
