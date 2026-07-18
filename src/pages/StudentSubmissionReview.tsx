import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MessageSquarePlus, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { usePyodide } from "@/hooks/usePyodide";
import { useStudentSubmissionsRealtime } from "@/hooks/useStudentSubmissionsRealtime";
import { notifyPush } from "@/lib/push";
import {
  createSubmissionComment,
  listManagedStudents,
  listStudentSubmissions,
  listSubmissionComments,
} from "@/lib/studentManagement";
import EditorPanel from "@/components/editor/EditorPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function StudentSubmissionReview() {
  const { studentId, problemId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  useStudentSubmissionsRealtime();
  const { run, running, stop } = usePyodide();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const { data: students = [] } = useQuery({
    queryKey: ["student-management", "students", user?.id],
    queryFn: () => listManagedStudents(user!.id),
    enabled: !!user,
  });
  const student = students.find((s) => s.id === studentId);

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["student-management", "submissions", studentId],
    queryFn: () => listStudentSubmissions(studentId!),
    enabled: !!studentId,
  });
  const versions = useMemo(
    () => submissions.filter((s) => s.problem_id === problemId),
    [submissions, problemId],
  );
  useEffect(() => {
    setSelectedId(null);
    setComment("");
  }, [studentId, problemId]);

  const selected = versions.find((s) => s.id === selectedId) ?? versions[0] ?? null;

  const { data: comments = [] } = useQuery({
    queryKey: ["student-management", "comments", selected?.id],
    queryFn: () => listSubmissionComments(selected!.id),
    enabled: !!selected,
  });

  const addComment = useMutation({
    mutationFn: () => createSubmissionComment({ submissionId: selected!.id, authorId: user!.id, body: comment }),
    onSuccess: (commentId) => {
      setComment("");
      if (commentId) void notifyPush("submission_feedback", commentId);
      qc.invalidateQueries({ queryKey: ["student-management", "comments", selected?.id] });
    },
    onError: () => toast.error("코멘트를 저장하지 못했습니다."),
  });

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">불러오는 중…</div>;
  }
  if (!selected) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted-foreground">
        <p>제출을 찾을 수 없습니다.</p>
        <Button variant="outline" onClick={() => navigate("/students")}>학생 관리로</Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-2 border-b p-3">
        <Button size="icon" variant="ghost" onClick={() => navigate("/students")} title="학생 관리로">
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{selected.problem_title}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {student?.display_name || "학생"} · {selected.passed_tests}/{selected.total_tests} 통과 · {selected.score}/{selected.max_score}점
          </p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-36 shrink-0 flex-col border-r">
          <div className="border-b px-3 py-2 text-xs font-semibold text-muted-foreground">제출 버전</div>
          <div className="flex-1 overflow-auto p-2">
            {versions.map((version, index) => (
              <button
                key={version.id}
                onClick={() => setSelectedId(version.id)}
                className={cn(
                  "mb-1 w-full rounded-md p-2 text-left text-xs",
                  selected.id === version.id ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                <span className="block font-semibold">v{versions.length - index}</span>
                <span className="block opacity-75">{new Date(version.submitted_at).toLocaleString("ko-KR")}</span>
                <span className="block opacity-75">{version.score}/{version.max_score}점</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <EditorPanel
            code={selected.code}
            onCodeChange={() => {}}
            readOnly
            running={running}
            run={run}
            stop={stop}
          />
        </div>

        <aside className="flex w-72 shrink-0 flex-col border-l">
          <div className="border-b p-3">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <MessageSquarePlus className="size-4" /> 교사 코멘트
            </div>
            <p className="text-xs text-muted-foreground">{new Date(selected.submitted_at).toLocaleString("ko-KR")}</p>
          </div>
          <div className="flex-1 space-y-2 overflow-auto p-3">
            {comments.length === 0 ? (
              <p className="text-xs text-muted-foreground">아직 코멘트가 없습니다.</p>
            ) : (
              comments.map((item) => (
                <div key={item.id} className="rounded bg-muted p-2 text-xs">
                  <p>{item.body}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleString("ko-KR")}</p>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2 border-t p-3">
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) addComment.mutate();
              }}
              placeholder="코멘트 남기기"
              className="h-9 text-xs"
            />
            <Button size="icon" className="size-9" onClick={() => addComment.mutate()} disabled={!comment.trim() || addComment.isPending}>
              <Send className="size-4" />
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
