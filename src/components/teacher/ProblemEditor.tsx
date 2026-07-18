import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { useProblem, useUpdateProblem } from "@/hooks/useProblems";
import { usePyodide } from "@/hooks/usePyodide";
import FlowchartCanvas from "@/components/flow/FlowchartCanvas";
import EditorPanel from "@/components/editor/EditorPanel";
import GradingTestsEditor from "@/components/GradingTestsEditor";
import type { GradingTest, ProblemCategory } from "@/integrations/supabase/types";
import { PROBLEM_CATEGORY_LABEL } from "@/integrations/supabase/types";
import type { FlowGraph } from "@/types/flowchart";
import { emptyGraph, normalizeStored } from "@/lib/flow-graph";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Markdown } from "@/components/Markdown";
import { cn } from "@/lib/utils";

function DescriptionField({
  value,
  onChange,
  fill,
  showLabel = true,
}: {
  value: string;
  onChange: (v: string) => void;
  /** true면 부모 높이를 그대로 채움(순서도 탭), false면 고정 높이(h-40) */
  fill?: boolean;
  showLabel?: boolean;
}) {
  const [preview, setPreview] = useState(false);
  const bodyClassName = fill ? "mt-1 flex-1 min-h-0" : "mt-1 h-40";
  return (
    <div className={cn(fill && "flex h-full min-h-0 flex-col")}>
      <div className="flex items-center justify-between">
        {showLabel ? <Label>문제 설명</Label> : <span />}
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className="text-xs text-muted-foreground underline underline-offset-2"
        >
          {preview ? "편집" : "미리보기"}
        </button>
      </div>
      {preview ? (
        <div className={cn("overflow-auto rounded-md border p-2", bodyClassName)}>
          <Markdown>{value || "_내용 없음_"}</Markdown>
        </div>
      ) : (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn("resize-none", bodyClassName)}
          placeholder="문제 설명을 학생에게 보여줍니다. (Markdown 지원)"
        />
      )}
    </div>
  );
}

export default function ProblemEditor({ problemId }: { problemId: string }) {
  const { data: problem, isLoading } = useProblem(problemId);
  const updateMut = useUpdateProblem();
  const { run, running, stop } = usePyodide();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ProblemCategory>("flowchart");
  const [points, setPoints] = useState(0);
  const [graph, setGraph] = useState<FlowGraph>(emptyGraph());
  const [starter, setStarter] = useState("");
  const [tests, setTests] = useState<GradingTest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const seeded = useRef(false);

  // 마운트당 1회만 시드(문제 refetch 가 편집 중 그래프를 덮어쓰지 않게)
  useEffect(() => {
    if (!problem || seeded.current) return;
    seeded.current = true;
    setTitle(problem.title);
    setDescription(problem.description);
    setCategory(problem.category ?? "flowchart");
    setPoints(problem.points ?? 0);
    setGraph(normalizeStored(problem.flowchart));
    setStarter(problem.teacher_code);
    setTests(problem.grading_tests ?? []);
    setLoaded(true);
  }, [problem]);

  async function save() {
    try {
      await updateMut.mutateAsync({
        id: problemId,
        patch: {
          title,
          description,
          category,
          points,
          teacher_code: starter,
          grading_tests: tests,
          flowchart: { nodes: graph.nodes, edges: graph.edges },
        },
      });
      toast.success("저장됨");
    } catch (e: any) {
      toast.error(e?.message ?? "저장 실패");
    }
  }

  if (isLoading) return <div className="flex h-full items-center justify-center text-muted-foreground">불러오는 중…</div>;
  if (!problem) return <div className="flex h-full items-center justify-center text-muted-foreground">문제를 찾을 수 없습니다.</div>;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b p-3">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-xs" placeholder="문제 제목" />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ProblemCategory)}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          {(Object.keys(PROBLEM_CATEGORY_LABEL) as ProblemCategory[]).map((c) => (
            <option key={c} value={c}>{PROBLEM_CATEGORY_LABEL[c]}</option>
          ))}
        </select>
        <div className="ml-auto flex gap-2">
          <Button onClick={() => save()} disabled={updateMut.isPending}>
            <Save /> 저장
          </Button>
        </div>
      </div>

      {category === "flowchart" ? (
        <div className="grid flex-1 grid-cols-2 overflow-hidden">
          <div className="h-full border-r">
            {loaded && <FlowchartCanvas graph={graph} editable resetKey={problemId} onChange={setGraph} />}
          </div>
          <div className="flex flex-col overflow-hidden">
            <Tabs defaultValue="starter" className="flex flex-1 flex-col overflow-hidden">
              <TabsList className="m-2 self-start">
                <TabsTrigger value="starter">코드 · 실행</TabsTrigger>
                <TabsTrigger value="desc">문제 설명</TabsTrigger>
                <TabsTrigger value="grading">채점 ({tests.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="starter" className="flex-1 overflow-hidden data-[state=inactive]:hidden">
                <EditorPanel code={starter} onCodeChange={setStarter} running={running} run={run} stop={stop} />
              </TabsContent>
              <TabsContent value="desc" className="flex flex-1 flex-col overflow-hidden p-3 data-[state=inactive]:hidden">
                <DescriptionField value={description} onChange={setDescription} fill showLabel={false} />
              </TabsContent>
              <TabsContent value="grading" className="flex-1 overflow-auto data-[state=inactive]:hidden">
                <div className="space-y-1 border-b p-3">
                  <Label htmlFor="points" className="font-normal text-muted-foreground">만점 시 지급 포인트</Label>
                  <Input
                    id="points"
                    type="number"
                    min={0}
                    value={points || ""}
                    onChange={(e) => setPoints(Number(e.target.value) || 0)}
                    className="w-full"
                    placeholder="포인트"
                  />
                </div>
                <div className="p-3">
                  <GradingTestsEditor tests={tests} onChange={setTests} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-2 overflow-hidden">
          <div className="flex h-full flex-col gap-4 overflow-auto border-r p-3">
            <DescriptionField value={description} onChange={setDescription} />
            <div>
              <Label>채점 ({tests.length})</Label>
              <div className="mb-3 mt-1 space-y-1">
                <Label htmlFor="points-alt" className="font-normal text-muted-foreground">만점 시 지급 포인트</Label>
                <Input
                  id="points-alt"
                  type="number"
                  min={0}
                  value={points || ""}
                  onChange={(e) => setPoints(Number(e.target.value) || 0)}
                  className="w-full"
                  placeholder="포인트"
                />
              </div>
              <GradingTestsEditor tests={tests} onChange={setTests} />
            </div>
          </div>
          <div className="overflow-hidden">
            <EditorPanel code={starter} onCodeChange={setStarter} running={running} run={run} stop={stop} />
          </div>
        </div>
      )}
    </div>
  );
}
