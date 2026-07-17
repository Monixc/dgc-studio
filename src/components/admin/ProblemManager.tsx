import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Trash2, Folder, FolderPlus, ChevronRight, ChevronDown, Circle, Globe, EyeOff, Send, CheckSquare } from "lucide-react";
import type { ImperativePanelHandle, ImperativePanelGroupHandle } from "react-resizable-panels";
import { useAuth } from "@/hooks/useAuth";
import { useMyProblems, useCreateProblem, useDeleteProblem, useUpdateProblem } from "@/hooks/useProblems";
import { useProblemsRealtime } from "@/hooks/useProblemsRealtime";
import { useFolders, useCreateFolder, useDeleteFolder, useUpdateFolderColor } from "@/hooks/useProblemFolders";
import { resolveFolderCategory } from "@/lib/problemFolders";
import ProblemEditor from "@/components/teacher/ProblemEditor";
import { Button } from "@/components/ui/button";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import type { ProblemFolder } from "@/integrations/supabase/types";

const ALL = "__all__";
const PROBLEM_DND_TYPE = "text/flowpy-problem-id";

export default function ProblemManager() {
  const location = useLocation();
  const { user } = useAuth();
  const userId = user!.id;
  const { data: problems = [], isLoading } = useMyProblems(userId);
  useProblemsRealtime();
  const { data: folders = [] } = useFolders(userId);
  const createFolderMut = useCreateFolder();
  const deleteFolderMut = useDeleteFolder();
  const updateFolderColorMut = useUpdateFolderColor();
  const createProblemMut = useCreateProblem();
  const deleteProblemMut = useDeleteProblem();
  const updateProblemMut = useUpdateProblem();

  const [activeFolder, setActiveFolder] = useState<string>(ALL);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const openId = (location.state as { openProblemId?: string } | null)?.openProblemId;
    if (openId) setSelectedId(openId);
  }, [location.state]);

  const panelGroupRef = useRef<ImperativePanelGroupHandle>(null);
  const folderPanelRef = useRef<ImperativePanelHandle>(null);
  const listPanelRef = useRef<ImperativePanelHandle>(null);
  const [folderCollapsed, setFolderCollapsed] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);
  const lastFolderSizeRef = useRef(17);
  const lastListSizeRef = useRef(15);

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

  async function handleAddChild(parentId: string, name: string) {
    if (!name.trim()) return;
    try {
      await createFolderMut.mutateAsync({ userId, name: name.trim(), parentId });
      setExpanded((prev) => new Set(prev).add(parentId));
    } catch (e: any) {
      toast.error(e?.message ?? "생성 실패");
    }
  }

  // 패널 하나를 접거나 펼 때 라이브러리가 남는 공간을 다른 패널에 비례 배분하면서,
  // 이미 접혀 있던 옆 패널까지 임계값을 넘겨 같이 펼쳐버리는 문제가 있었음.
  // 그래서 두 패널 크기를 항상 명시적으로 계산해 setLayout으로 한 번에 고정한다.
  function applyPanelLayout(nextFolderCollapsed: boolean, nextListCollapsed: boolean) {
    const folderSize = nextFolderCollapsed ? 5 : lastFolderSizeRef.current;
    const listSize = nextListCollapsed ? 5 : lastListSizeRef.current;
    panelGroupRef.current?.setLayout([folderSize, listSize, 100 - folderSize - listSize]);
  }

  function toggleFolderPanel() {
    const next = !folderCollapsed;
    setFolderCollapsed(next);
    applyPanelLayout(next, listCollapsed);
  }

  function toggleListPanel() {
    const next = !listCollapsed;
    setListCollapsed(next);
    applyPanelLayout(folderCollapsed, next);
  }

  async function handleColorChange(id: string, color: string) {
    try {
      await updateFolderColorMut.mutateAsync({ id, color });
    } catch (e: any) {
      toast.error(e?.message ?? "색상 변경 실패");
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
      setFolderCollapsed(true);
      applyPanelLayout(true, listCollapsed);
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

  function toggleBulkMode() {
    setBulkMode((v) => !v);
    setBulkSelected(new Set());
  }

  function toggleBulkSelect(id: string) {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    if (bulkSelected.size === 0) return toast.info("선택된 문제가 없습니다.");
    if (!confirm(`선택한 문제 ${bulkSelected.size}개를 삭제할까요?`)) return;
    try {
      await Promise.all([...bulkSelected].map((id) => deleteProblemMut.mutateAsync(id)));
      if (selectedId && bulkSelected.has(selectedId)) setSelectedId(null);
      toast.success(`${bulkSelected.size}개 삭제됨`);
      toggleBulkMode();
    } catch (e: any) {
      toast.error(e?.message ?? "삭제 실패");
    }
  }

  async function handleBulkPublishSelected() {
    if (bulkSelected.size === 0) return toast.info("선택된 문제가 없습니다.");
    try {
      await Promise.all([...bulkSelected].map((id) => updateProblemMut.mutateAsync({ id, patch: { is_published: true } })));
      toast.success(`${bulkSelected.size}개 발행 완료`);
      toggleBulkMode();
    } catch (e: any) {
      toast.error(e?.message ?? "일괄 발행 실패");
    }
  }

  function toggleSelectAll() {
    setBulkSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((p) => p.id))));
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
    <ResizablePanelGroup ref={panelGroupRef} direction="horizontal" className="h-full overflow-hidden">
      <ResizablePanel
        ref={folderPanelRef}
        defaultSize={17}
        minSize={14}
        maxSize={35}
        collapsible
        collapsedSize={5}
        onResize={(size) => { if (size > 5.5) lastFolderSizeRef.current = size; }}
        onCollapse={() => setFolderCollapsed(true)}
        onExpand={() => setFolderCollapsed(false)}
        className="flex h-full flex-col bg-muted/20"
      >
        {!folderCollapsed && (
          <div className="flex items-center border-b p-2">
            <span className="whitespace-nowrap text-sm font-semibold">폴더</span>
          </div>
        )}
        <div className="flex-1 overflow-auto p-1">
          {folderCollapsed ? (
            <div className="flex flex-col items-center gap-1 py-1">
              <button
                onClick={() => setActiveFolder(ALL)}
                title="전체"
                className={cn("rounded p-1.5 hover:bg-accent", activeFolder === ALL && "bg-accent")}
              >
                <Folder className="size-4 text-muted-foreground" />
              </button>
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFolder(f.id)}
                  title={f.name}
                  className={cn("rounded p-1.5 hover:bg-accent", activeFolder === f.id && "bg-accent")}
                >
                  <Folder className={cn("size-4", !f.color && "text-muted-foreground")} style={f.color ? { color: f.color, fill: f.color, fillOpacity: 0.2 } : undefined} />
                </button>
              ))}
            </div>
          ) : (
            <>
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
                  onColorChange={handleColorChange}
                  dragOverId={dragOverId}
                  setDragOverId={setDragOverId}
                  onDrop={handleDropOnFolder}
                />
              ))}
            </>
          )}
        </div>
      </ResizablePanel>

      <ResizableHandle onToggle={toggleFolderPanel} collapsed={folderCollapsed} />

      <ResizablePanel
        ref={listPanelRef}
        defaultSize={15}
        minSize={14}
        maxSize={40}
        collapsible
        collapsedSize={5}
        onResize={(size) => { if (size > 5.5) lastListSizeRef.current = size; }}
        onCollapse={() => setListCollapsed(true)}
        onExpand={() => setListCollapsed(false)}
        className="flex h-full flex-col bg-muted/20"
      >
        {!listCollapsed && (
          <div className="flex items-center gap-1 border-b p-2">
            <span className="whitespace-nowrap text-sm font-semibold">문제 목록</span>
            {!bulkMode ? (
              <div className="ml-auto flex items-center gap-1">
                <button
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                  onClick={handleCreateProblem}
                  disabled={createProblemMut.isPending}
                  title="문제 추가"
                >
                  <Plus className="size-4" />
                </button>
                <button
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={toggleBulkMode}
                  title="일괄 선택"
                >
                  <CheckSquare className="size-4" />
                </button>
              </div>
            ) : (
              <span className="ml-auto text-xs text-muted-foreground">{bulkSelected.size}개 선택됨</span>
            )}
          </div>
        )}
        <div className="flex-1 overflow-auto p-1">
          {listCollapsed ? (
            <div className="flex flex-col items-center gap-2 py-2">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  title={p.title || "(제목 없음)"}
                  className={cn("rounded p-1.5 hover:bg-accent", selectedId === p.id && "bg-accent")}
                >
                  <Circle className={cn("size-2.5", p.is_published ? "fill-emerald-500 text-emerald-500" : "fill-muted-foreground/40 text-muted-foreground/40")} />
                </button>
              ))}
            </div>
          ) : isLoading ? (
            <p className="p-2 text-sm text-muted-foreground">불러오는 중…</p>
          ) : filtered.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">“문제 추가”로 시작하세요.</p>
          ) : (
            filtered.map((p) => (
              <div
                key={p.id}
                draggable={!bulkMode}
                onDragStart={(e) => e.dataTransfer.setData(PROBLEM_DND_TYPE, p.id)}
                onClick={() => (bulkMode ? toggleBulkSelect(p.id) : setSelectedId(p.id))}
                className={cn(
                  "group flex items-center gap-2 rounded-md p-2 text-sm hover:bg-accent",
                  bulkMode ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
                  (bulkMode ? bulkSelected.has(p.id) : selectedId === p.id) && "bg-accent"
                )}
              >
                {bulkMode && (
                  <input
                    type="checkbox"
                    checked={bulkSelected.has(p.id)}
                    onChange={() => toggleBulkSelect(p.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="size-3.5 shrink-0"
                  />
                )}
                <Circle className={cn("size-2 shrink-0", p.is_published ? "fill-emerald-500 text-emerald-500" : "fill-muted-foreground/40 text-muted-foreground/40")} />
                <span className="flex-1 truncate">{p.title || "(제목 없음)"}</span>
                {!bulkMode && (
                  <>
                    <button className="opacity-0 group-hover:opacity-100" onClick={(e) => togglePublish(p.id, !p.is_published, e)} title="발행 전환">
                      {p.is_published ? <EyeOff className="size-4" /> : <Globe className="size-4" />}
                    </button>
                    <button className="opacity-0 group-hover:opacity-100" onClick={(e) => handleDeleteProblem(p.id, e)} title="삭제">
                      <Trash2 className="size-4" />
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
        {!listCollapsed && bulkMode && (
          <div className="flex flex-col gap-1 border-t p-2">
            <Button variant="outline" className="w-full" onClick={toggleSelectAll}>
              {bulkSelected.size === filtered.length ? "전체 해제" : "전체 선택"}
            </Button>
            <div className="flex flex-wrap gap-1">
              <Button variant="destructive" className="min-w-24 flex-1" onClick={handleBulkDelete} disabled={deleteProblemMut.isPending}>
                <Trash2 /> 선택 삭제 ({bulkSelected.size})
              </Button>
              <Button variant="secondary" className="min-w-24 flex-1" onClick={handleBulkPublishSelected} disabled={updateProblemMut.isPending}>
                <Send /> 선택 발행
              </Button>
            </div>
            <Button variant="ghost" className="w-full" onClick={toggleBulkMode}>
              취소
            </Button>
          </div>
        )}
      </ResizablePanel>

      <ResizableHandle onToggle={toggleListPanel} collapsed={listCollapsed} />

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
  folder, depth, childrenOf, expanded, onToggleExpand, activeFolder, onSelect, onAddChild, onDelete, onColorChange,
  dragOverId, setDragOverId, onDrop,
}: {
  folder: ProblemFolder;
  depth: number;
  childrenOf: (parentId: string | null) => ProblemFolder[];
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  activeFolder: string;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string, name: string) => void;
  onDelete: (id: string) => void;
  onColorChange: (id: string, color: string) => void;
  dragOverId: string | null;
  setDragOverId: (v: string | null | ((prev: string | null) => string | null)) => void;
  onDrop: (folderId: string, e: React.DragEvent) => void;
}) {
  const kids = childrenOf(folder.id);
  const isExpanded = expanded.has(folder.id);
  const isDefault = !!folder.category;

  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");

  function submitCreate() {
    const name = draftName.trim();
    setCreating(false);
    setDraftName("");
    if (name) onAddChild(folder.id, name);
  }

  // 컬러피커 드래그 중 매 픽셀마다 onChange(=input 이벤트)로 뮤테이션이 나가면
  // 리렌더가 겹쳐 네이티브 팝업이 바로 닫혀버림 → 드래그 종료(change 이벤트)에만 커밋.
  const colorInputRef = useRef<HTMLInputElement>(null);
  const [liveColor, setLiveColor] = useState(folder.color ?? "#94a3b8");
  useEffect(() => setLiveColor(folder.color ?? "#94a3b8"), [folder.color]);
  useEffect(() => {
    const el = colorInputRef.current;
    if (!el) return;
    const handleCommit = (e: Event) => onColorChange(folder.id, (e.target as HTMLInputElement).value);
    el.addEventListener("change", handleCommit);
    return () => el.removeEventListener("change", handleCommit);
  }, [folder.id, onColorChange]);

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
        <label
          className="flex shrink-0 cursor-pointer items-center justify-center rounded-md p-0.5 hover:bg-accent"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onDragStart={(e) => e.preventDefault()}
          title="폴더 색상"
        >
          <Folder className={cn("size-4", !folder.color && "text-muted-foreground")} style={folder.color ? { color: folder.color, fill: folder.color, fillOpacity: 0.2 } : undefined} />
          <input
            ref={colorInputRef}
            type="color"
            value={liveColor}
            onChange={(e) => setLiveColor(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="sr-only"
          />
        </label>
        <span className={cn("flex-1 truncate", isDefault && "font-medium")}>{folder.name}</span>
        <button
          className="flex size-5 shrink-0 items-center justify-center opacity-0 group-hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); setCreating(true); }}
          title="하위 폴더 추가"
        >
          <FolderPlus className="size-3.5" />
        </button>
        {!isDefault && (
          <button
            className="flex size-5 shrink-0 items-center justify-center opacity-0 group-hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); onDelete(folder.id); }}
            title="폴더 삭제"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      {creating && (
        <div style={{ paddingLeft: (depth + 1) * 14 }} className="flex items-center gap-1 p-2">
          <span className="w-3.5 shrink-0" />
          <Folder className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitCreate();
              if (e.key === "Escape") { setCreating(false); setDraftName(""); }
            }}
            onBlur={submitCreate}
            placeholder="새 폴더 이름"
            className="h-6 flex-1 rounded border bg-background px-1 text-sm outline-none"
          />
        </div>
      )}
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
          onColorChange={onColorChange}
          dragOverId={dragOverId}
          setDragOverId={setDragOverId}
          onDrop={onDrop}
        />
      ))}
    </div>
  );
}
