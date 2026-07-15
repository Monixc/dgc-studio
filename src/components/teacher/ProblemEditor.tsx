import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Save, Globe, EyeOff } from "lucide-react";
import { useProblem, useUpdateProblem } from "@/hooks/useProblems";
import { usePyodide } from "@/hooks/usePyodide";
import FlowchartCanvas from "@/components/flow/FlowchartCanvas";
import EditorPanel from "@/components/editor/EditorPanel";
import GradingTestsEditor from "@/components/GradingTestsEditor";
import TeacherSubmissions from "@/components/TeacherSubmissions";
import type { GradingTest, ProblemCategory } from "@/integrations/supabase/types";
import { PROBLEM_CATEGORY_LABEL } from "@/integrations/supabase/types";
import type { FlowGraph } from "@/types/flowchart";
import { emptyGraph, normalizeStored } from "@/lib/flow-graph";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function ProblemEditor({ problemId }: { problemId: string }) {
  const { data: problem, isLoading } = useProblem(problemId);
  const updateMut = useUpdateProblem();
  const { run, running, stop } = usePyodide();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ProblemCategory>("flowchart");
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
    setCategory(problem.category);
    setGraph(normalizeStored(problem.flowchart));
    setStarter(problem.starter_code);
    setTests(problem.grading_tests ?? []);
    setLoaded(true);
  }, [problem]);

  async function save(extra?: { is_published?: boolean }) {
    try {
      await updateMut.mutateAsync({
        id: problemId,
        patch: {
          title,
          description,
          category,
          starter_code: starter,
          grading_tests: tests,
          flowchart: { nodes: graph.nodes, edges: graph.edges },
          ...extra,
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
          <TeacherSubmissions problemId={problemId} />
          <Button variant="outline" onClick={() => save({ is_published: !problem.is_published })} disabled={updateMut.isPending}>
            {problem.is_published ? <EyeOff /> : <Globe />}
            {problem.is_published ? "발행 취소" : "발행"}
          </Button>
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
              <TabsContent value="desc" className="flex-1 overflow-auto p-3 data-[state=inactive]:hidden">
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="h-full resize-none" placeholder="문제 설명을 학생에게 보여줍니다." />
              </TabsContent>
              <TabsContent value="grading" className="flex-1 overflow-auto data-[state=inactive]:hidden">
                <GradingTestsEditor tests={tests} onChange={setTests} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-2 overflow-hidden">
          <div className="flex h-full flex-col gap-4 overflow-auto border-r p-3">
            <div>
              <Label>문제 설명</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 h-40 resize-none"
                placeholder="문제 설명을 학생에게 보여줍니다."
              />
            </div>
            <div>
              <Label>채점 ({tests.length})</Label>
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
