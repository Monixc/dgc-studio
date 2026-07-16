import { useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Folder, FolderPlus, ChevronRight, ChevronDown, Circle, Globe, EyeOff, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { useAuth } from "@/hooks/useAuth";
import { useMyProblems, useCreateProblem, useDeleteProblem, useUpdateProblem } from "@/hooks/useProblems";
import { useProblemsRealtime } from "@/hooks/useProblemsRealtime";
import { useFolders, useCreateFolder, useDeleteFolder } from "@/hooks/useProblemFolders";
import { resolveFolderCategory } from "@/lib/problemFolders";
import ProblemEditor from "@/components/teacher/ProblemEditor";
import { Button } from "@/components/ui/button";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import type { ProblemFolder } from "@/integrations/supabase/types";

const ALL = "__all__";
const PROBLEM_DND_TYPE = "text/flowpy-problem-id";

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const folderPanelRef = useRef<ImperativePanelHandle>(null);
  const listPanelRef = useRef<ImperativePanelHandle>(null);
  const [folderCollapsed, setFolderCollapsed] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);

  const filtered = activeFolder === ALL ? problems : problems.filter((p) => p.folder_id === activeFolder);

  const childrenOf = (parentId: string | null) => folders.filter((f) => f.parent_id === parentId);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAddChild(parentId: string) {
    const name = prompt("새 하위 폴더 이름");
    if (!name?.trim()) return;
    try {
      await createFolderMut.mutateAsync({ userId, name: name.trim(), parentId });
      setExpanded((prev) => new Set(prev).add(parentId));
    } catch (e: any) {
      toast.error(e?.message ?? "생성 실패");
    }
  }

  async function handleDeleteFolder(id: string) {
    if (!confirm("이 폴더를 삭제할까요? 하위 폴더도 함께 삭제됩니다.")) return;
    try {
      await deleteFolderMut.mutateAsync(id);
      if (activeFolder === id) setActiveFolder(ALL);
    } catch (e: any) {
      toast.error(e?.message ?? "삭제 실패");
    }
  }

  async function handleCreateProblem() {
    try {
      // "전체"에서 추가하면 기본 대분류(순서도)로 들어감 — 미분류 상태를 만들지 않음.
      const defaultFolder = folders.find((f) => f.category === "flowchart" && f.parent_id === null);
      const folderId = activeFolder !== ALL ? activeFolder : defaultFolder?.id ?? null;
      const category = resolveFolderCategory(folderId, folders);
      const p = await createProblemMut.mutateAsync({ userId, category, folderId });
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

  async function handleDropOnFolder(folderId: string, e: React.DragEvent) {
    e.preventDefault();
    setDragOverId(null);
    const problemId = e.dataTransfer.getData(PROBLEM_DND_TYPE);
    if (!problemId) return;
    try {
      await updateProblemMut.mutateAsync({
        id: problemId,
        patch: { folder_id: folderId, category: resolveFolderCategory(folderId, folders) },
      });
    } catch (e: any) {
      toast.error(e?.message ?? "이동 실패");
    }
  }

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full overflow-hidden">
      <ResizablePanel
        ref={folderPanelRef}
        defaultSize={18}
        minSize={12}
        maxSize={35}
        collapsible
        collapsedSize={5}
        onCollapse={() => setFolderCollapsed(true)}
        onExpand={() => setFolderCollapsed(false)}
        className="flex h-full flex-col bg-muted/20"
      >
        <div className={cn("flex items-center border-b p-2", folderCollapsed ? "justify-center" : "justify-between")}>
          {!folderCollapsed && <span className="whitespace-nowrap text-sm font-semibold">폴더</span>}
          <button
            className={cn("shrink-0 text-muted-foreground hover:text-foreground", !folderCollapsed && "ml-auto")}
            onClick={() => (folderCollapsed ? folderPanelRef.current?.expand() : folderPanelRef.current?.collapse())}
            title={folderCollapsed ? "폴더 패널 펼치기" : "폴더 패널 접기"}
          >
            {folderCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>
        {!folderCollapsed && (
          <div className="flex-1 overflow-auto p-1">
            <FolderItem
              label="전체"
              active={activeFolder === ALL}
              onClick={() => setActiveFolder(ALL)}
            />
            {childrenOf(null).map((f) => (
              <FolderTreeNode
                key={f.id}
                folder={f}
                depth={0}
                childrenOf={childrenOf}
                expanded={expanded}
                onToggleExpand={toggleExpand}
                activeFolder={activeFolder}
                onSelect={setActiveFolder}
                onAddChild={handleAddChild}
                onDelete={handleDeleteFolder}
                dragOverId={dragOverId}
                setDragOverId={setDragOverId}
                onDrop={handleDropOnFolder}
              />
            ))}
          </div>
        )}
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel
        ref={listPanelRef}
        defaultSize={22}
        minSize={14}
        maxSize={40}
        collapsible
        collapsedSize={5}
        onCollapse={() => setListCollapsed(true)}
        onExpand={() => setListCollapsed(false)}
        className="flex h-full flex-col bg-muted/20"
      >
        <div className={cn("flex items-center border-b p-2", listCollapsed ? "justify-center" : "justify-between")}>
          {!listCollapsed && <span className="whitespace-nowrap text-sm font-semibold">문제 목록</span>}
          <div className={cn("flex items-center gap-1", !listCollapsed && "ml-auto")}>
            {!listCollapsed && (
              <Button size="sm" onClick={handleCreateProblem} disabled={createProblemMut.isPending}>
                <Plus /> 문제 추가
              </Button>
            )}
            <button
              className="shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => (listCollapsed ? listPanelRef.current?.expand() : listPanelRef.current?.collapse())}
              title={listCollapsed ? "문제 목록 패널 펼치기" : "문제 목록 패널 접기"}
            >
              {listCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </button>
          </div>
        </div>
        {!listCollapsed && (
          <div className="flex-1 overflow-auto p-1">
            {isLoading ? (
              <p className="p-2 text-sm text-muted-foreground">불러오는 중…</p>
            ) : filtered.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">“문제 추가”로 시작하세요.</p>
            ) : (
              filtered.map((p) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData(PROBLEM_DND_TYPE, p.id)}
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    "group flex cursor-grab items-center gap-2 rounded-md p-2 text-sm hover:bg-accent active:cursor-grabbing",
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
        )}
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={60} className="overflow-hidden">
        {selectedId ? (
          <ProblemEditor key={selectedId} problemId={selectedId} />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            왼쪽에서 문제를 선택하거나 “문제 추가”를 누르세요.
          </div>
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function FolderItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center gap-1 rounded-md p-2 text-sm hover:bg-accent",
        active && "bg-accent"
      )}
    >
      <Folder className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate">{label}</span>
    </div>
  );
}

function FolderTreeNode({
  folder, depth, childrenOf, expanded, onToggleExpand, activeFolder, onSelect, onAddChild, onDelete,
  dragOverId, setDragOverId, onDrop,
}: {
  folder: ProblemFolder;
  depth: number;
  childrenOf: (parentId: string | null) => ProblemFolder[];
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  activeFolder: string;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
  dragOverId: string | null;
  setDragOverId: (v: string | null | ((prev: string | null) => string | null)) => void;
  onDrop: (folderId: string, e: React.DragEvent) => void;
}) {
  const kids = childrenOf(folder.id);
  const isExpanded = expanded.has(folder.id);
  const isDefault = !!folder.category;

  return (
    <div>
      <div
        onClick={() => onSelect(folder.id)}
        onDragOver={(e) => { e.preventDefault(); setDragOverId(folder.id); }}
        onDragLeave={() => setDragOverId((id) => (id === folder.id ? null : id))}
        onDrop={(e) => onDrop(folder.id, e)}
        style={{ paddingLeft: depth * 14 }}
        className={cn(
          "group flex cursor-pointer items-center gap-1 rounded-md p-2 text-sm hover:bg-accent",
          activeFolder === folder.id && "bg-accent",
          dragOverId === folder.id && "ring-2 ring-primary"
        )}
      >
        {kids.length > 0 ? (
          <button onClick={(e) => { e.stopPropagation(); onToggleExpand(folder.id); }} className="shrink-0 text-muted-foreground">
            {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <Folder className="size-4 shrink-0 text-muted-foreground" />
        <span className={cn("flex-1 truncate", isDefault && "font-medium")}>{folder.name}</span>
        <button
          className="opacity-0 group-hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); onAddChild(folder.id); }}
          title="하위 폴더 추가"
        >
          <FolderPlus className="size-3.5" />
        </button>
        {!isDefault && (
          <button
            className="opacity-0 group-hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); onDelete(folder.id); }}
            title="폴더 삭제"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      {isExpanded && kids.map((k) => (
        <FolderTreeNode
          key={k.id}
          folder={k}
          depth={depth + 1}
          childrenOf={childrenOf}
          expanded={expanded}
          onToggleExpand={onToggleExpand}
          activeFolder={activeFolder}
          onSelect={onSelect}
          onAddChild={onAddChild}
          onDelete={onDelete}
          dragOverId={dragOverId}
          setDragOverId={setDragOverId}
          onDrop={onDrop}
        />
      ))}
    </div>
  );
}
