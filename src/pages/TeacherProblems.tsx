import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, LogOut, Globe, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth";
import { useMyProblems, useCreateProblem, useDeleteProblem, useUpdateProblem } from "@/hooks/useProblems";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function TeacherProblems() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { data: problems = [], isLoading } = useMyProblems(user?.id);
  const createMut = useCreateProblem();
  const deleteMut = useDeleteProblem();
  const updateMut = useUpdateProblem();

  async function handleCreate() {
    try {
      const p = await createMut.mutateAsync(user!.id);
      navigate(`/teacher/${p.id}`);
    } catch (e: any) {
      toast.error(e?.message ?? "생성 실패");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 문제를 삭제할까요?")) return;
    try {
      await deleteMut.mutateAsync(id);
      toast.success("삭제됨");
    } catch (e: any) {
      toast.error(e?.message ?? "삭제 실패");
    }
  }

  async function togglePublish(id: string, next: boolean) {
    try {
      await updateMut.mutateAsync({ id, patch: { is_published: next } });
      toast.success(next ? "발행됨" : "발행 취소됨");
    } catch (e: any) {
      toast.error(e?.message ?? "실패");
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">문제 관리</h1>
          <p className="text-sm text-muted-foreground">{profile?.display_name} 선생님</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleCreate} disabled={createMut.isPending}>
            <Plus /> 새 문제
          </Button>
          <Button variant="outline" onClick={() => signOut()}>
            <LogOut /> 로그아웃
          </Button>
        </div>
      </header>

      {isLoading ? (
        <p className="text-muted-foreground">불러오는 중…</p>
      ) : problems.length === 0 ? (
        <p className="text-muted-foreground">아직 문제가 없습니다. “새 문제”로 시작하세요.</p>
      ) : (
        <div className="space-y-3">
          {problems.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center justify-between p-4">
                <button className="flex-1 text-left" onClick={() => navigate(`/teacher/${p.id}`)}>
                  <div className="font-medium">{p.title || "(제목 없음)"}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.is_published ? "발행됨" : "비공개"} · {p.grading_tests?.length ?? 0}개 테스트
                  </div>
                </button>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => togglePublish(p.id, !p.is_published)} title="발행 전환">
                    {p.is_published ? <EyeOff /> : <Globe />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => navigate(`/teacher/${p.id}`)} title="편집">
                    <Pencil />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id)} title="삭제">
                    <Trash2 />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
