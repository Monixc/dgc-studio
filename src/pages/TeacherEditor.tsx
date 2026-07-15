import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import Editor from "@monaco-editor/react";
import type { XYPosition } from "@xyflow/react";
import { ArrowLeft, Save, Globe, EyeOff } from "lucide-react";
import { useProblem, useUpdateProblem } from "@/hooks/useProblems";
import FlowchartPanel from "@/components/flow/FlowchartPanel";
import GradingTestsEditor from "@/components/GradingTestsEditor";
import TeacherSubmissions from "@/components/TeacherSubmissions";
import type { GradingTest } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const DSL_HELP = `start / end
input <식>   output <식>   process <문장>
if <조건> / elif <조건> / else
for <헤더>   while <조건>   def <이름(인자)>
들여쓰기로 블록을 엽니다 (Python처럼).`;

export default function TeacherEditor() {
  const { problemId } = useParams();
  const navigate = useNavigate();
  const { data: problem, isLoading } = useProblem(problemId);
  const updateMut = useUpdateProblem();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dsl, setDsl] = useState("");
  const [starter, setStarter] = useState("");
  const [tests, setTests] = useState<GradingTest[]>([]);
  const [positions, setPositions] = useState<Record<string, XYPosition>>({});

  useEffect(() => {
    if (!problem) return;
    setTitle(problem.title);
    setDescription(problem.description);
    setDsl(problem.flowchart?.dsl ?? "");
    setStarter(problem.starter_code);
    setTests(problem.grading_tests ?? []);
    setPositions(problem.flowchart?.positions ?? {});
  }, [problem]);

  async function save(extra?: { is_published?: boolean }) {
    if (!problemId) return;
    try {
      await updateMut.mutateAsync({
        id: problemId,
        patch: {
          title,
          description,
          starter_code: starter,
          grading_tests: tests,
          flowchart: { dsl, positions },
          ...extra,
        },
      });
      toast.success("저장됨");
    } catch (e: any) {
      toast.error(e?.message ?? "저장 실패");
    }
  }

  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">불러오는 중…</div>;
  if (!problem) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">문제를 찾을 수 없습니다.</div>;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-2 border-b p-3">
        <Button size="icon" variant="ghost" onClick={() => navigate("/teacher")}>
          <ArrowLeft />
        </Button>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-xs" placeholder="문제 제목" />
        <div className="ml-auto flex gap-2">
          {problemId && <TeacherSubmissions problemId={problemId} />}
          <Button
            variant="outline"
            onClick={() => save({ is_published: !problem.is_published })}
            disabled={updateMut.isPending}
          >
            {problem.is_published ? <EyeOff /> : <Globe />}
            {problem.is_published ? "발행 취소" : "발행"}
          </Button>
          <Button onClick={() => save()} disabled={updateMut.isPending}>
            <Save /> 저장
          </Button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-2 overflow-hidden">
        {/* 좌: 편집 */}
        <div className="flex flex-col overflow-hidden border-r">
          <Tabs defaultValue="dsl" className="flex flex-1 flex-col overflow-hidden">
            <TabsList className="m-2 self-start">
              <TabsTrigger value="dsl">순서도 DSL</TabsTrigger>
              <TabsTrigger value="starter">시작 코드</TabsTrigger>
              <TabsTrigger value="desc">문제 설명</TabsTrigger>
              <TabsTrigger value="grading">채점 ({tests.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="dsl" className="flex-1 overflow-hidden data-[state=inactive]:hidden">
              <div className="flex h-full flex-col">
                <pre className="whitespace-pre-wrap border-b bg-muted/50 p-2 text-[11px] text-muted-foreground">{DSL_HELP}</pre>
                <div className="flex-1">
                  <Editor language="python" value={dsl} onChange={(v) => setDsl(v ?? "")} options={{ minimap: { enabled: false }, fontSize: 13 }} />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="starter" className="flex-1 overflow-hidden data-[state=inactive]:hidden">
              <Editor language="python" value={starter} onChange={(v) => setStarter(v ?? "")} options={{ minimap: { enabled: false }, fontSize: 13 }} />
            </TabsContent>
            <TabsContent value="desc" className="flex-1 overflow-auto p-3 data-[state=inactive]:hidden">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="h-full resize-none" placeholder="문제 설명을 학생에게 보여줍니다." />
            </TabsContent>
            <TabsContent value="grading" className="flex-1 overflow-auto data-[state=inactive]:hidden">
              <GradingTestsEditor tests={tests} onChange={setTests} />
            </TabsContent>
          </Tabs>
        </div>

        {/* 우: 순서도 미리보기 */}
        <div className="h-full">
          <FlowchartPanel dsl={dsl} positions={positions} onPositionsChange={setPositions} />
        </div>
      </div>
    </div>
  );
}
