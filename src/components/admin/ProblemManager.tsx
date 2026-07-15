import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Folder, FolderPlus, Circle, Globe, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMyProblems, useCreateProblem, useDeleteProblem, useUpdateProblem } from "@/hooks/useProblems";
import { useProblemsRealtime } from "@/hooks/useProblemsRealtime";
import { useFolders, useCreateFolder, useDeleteFolder } from "@/hooks/useProblemFolders";
import ProblemEditor from "@/components/teacher/ProblemEditor";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ALL = "__all__";
const NO_FOLDER = "__none__";

export default function ProblemManager() {
  const { user } = useAuth();
  const userId = user!.id;
  const { data: problems = [], isLoading } = useMyProblems(userId);
  useProblemsRealtime();
  const { data: folders = [] } = useFolders(userId);
  const createFolderMut = useCreateFolder();
  const deleteFolderMut = useDeleteFolder();
  const createProblemMut = useCreateProblem();
  const deleteProblemMut = useDeleteProblem();
  const updateProblemMut = useUpdateProblem();

  const [activeFolder, setActiveFolder] = useState<string>(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered =
    activeFolder === ALL
      ? problems
      : activeFolder === NO_FOLDER
        ? problems.filter((p) => !p.folder_id)
        : problems.filter((p) => p.folder_id === activeFolder);

  async function handleNewFolder() {
    const name = prompt("새 폴더 이름");
    if (!name?.trim()) return;
    try {
      await createFolderMut.mutateAsync({ userId, name: name.trim() });
    } catch (e: any) {
      toast.error(e?.message ?? "생성 실패");
    }
  }

  async function handleDeleteFolder(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("이 폴더를 삭제할까요? 안의 문제는 미분류로 이동합니다.")) return;
    try {
      await deleteFolderMut.mutateAsync(id);
      if (activeFolder === id) setActiveFolder(ALL);
    } catch (e: any) {
      toast.error(e?.message ?? "삭제 실패");
    }
  }

  async function handleCreateProblem() {
    try {
      const p = await createProblemMut.mutateAsync(userId);
      if (activeFolder !== ALL && activeFolder !== NO_FOLDER) {
        await updateProblemMut.mutateAsync({ id: p.id, patch: { folder_id: activeFolder } });
      }
      setSelectedId(p.id);
    } catch (e: any) {
      toast.error(e?.message ?? "생성 실패");
    }
  }

  async function handleDeleteProblem(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("이 문제를 삭제할까요?")) return;
    try {
      await deleteProblemMut.mutateAsync(id);
      if (selectedId === id) setSelectedId(null);
      toast.success("삭제됨");
    } catch (e: any) {
      toast.error(e?.message ?? "삭제 실패");
    }
  }

  async function togglePublish(id: string, next: boolean, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await updateProblemMut.mutateAsync({ id, patch: { is_published: next } });
    } catch (e: any) {
      toast.error(e?.message ?? "실패");
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex h-full w-48 flex-col border-r bg-muted/20">
        <div className="flex items-center justify-between border-b p-2">
          <span className="text-sm font-semibold">폴더</span>
          <button className="rounded p-1 hover:bg-accent" onClick={handleNewFolder} title="새 폴더">
            <FolderPlus className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-1">
          <FolderItem label="전체" active={activeFolder === ALL} onClick={() => setActiveFolder(ALL)} />
          <FolderItem label="미분류" active={activeFolder === NO_FOLDER} onClick={() => setActiveFolder(NO_FOLDER)} />
          {folders.map((f) => (
            <FolderItem
              key={f.id}
              label={f.name}
              active={activeFolder === f.id}
              onClick={() => setActiveFolder(f.id)}
              onDelete={(e) => handleDeleteFolder(f.id, e)}
            />
          ))}
        </div>
      </div>

      <div className="flex h-full w-64 flex-col border-r bg-muted/20">
        <div className="flex items-center justify-between border-b p-2">
          <span className="text-sm font-semibold">문제 목록</span>
          <Button size="sm" onClick={handleCreateProblem} disabled={createProblemMut.isPending}>
            <Plus /> 문제 추가
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-1">
          {isLoading ? (
            <p className="p-2 text-sm text-muted-foreground">불러오는 중…</p>
          ) : filtered.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">“문제 추가”로 시작하세요.</p>
          ) : (
            filtered.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "group flex cursor-pointer items-center gap-2 rounded-md p-2 text-sm hover:bg-accent",
                  selectedId === p.id && "bg-accent"
                )}
              >
                <Circle className={cn("size-2 shrink-0", p.is_published ? "fill-emerald-500 text-emerald-500" : "fill-muted-foreground/40 text-muted-foreground/40")} />
                <span className="flex-1 truncate">{p.title || "(제목 없음)"}</span>
                <button className="opacity-0 group-hover:opacity-100" onClick={(e) => togglePublish(p.id, !p.is_published, e)} title="발행 전환">
                  {p.is_published ? <EyeOff className="size-4" /> : <Globe className="size-4" />}
                </button>
                <button className="opacity-0 group-hover:opacity-100" onClick={(e) => handleDeleteProblem(p.id, e)} title="삭제">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {selectedId ? (
          <ProblemEditor key={selectedId} problemId={selectedId} />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            왼쪽에서 문제를 선택하거나 “문제 추가”를 누르세요.
          </div>
        )}
      </div>
    </div>
  );
}

function FolderItem({
  label, active, onClick, onDelete,
}: { label: string; active: boolean; onClick: () => void; onDelete?: (e: React.MouseEvent) => void }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex cursor-pointer items-center gap-2 rounded-md p-2 text-sm hover:bg-accent",
        active && "bg-accent"
      )}
    >
      <Folder className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate">{label}</span>
      {onDelete && (
        <button className="opacity-0 group-hover:opacity-100" onClick={onDelete} title="폴더 삭제">
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  );
}
