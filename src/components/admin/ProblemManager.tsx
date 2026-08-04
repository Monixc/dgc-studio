import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Trash2, Folder, FolderPlus, ChevronRight, ChevronDown, Circle, ClipboardList, FileText, Globe, EyeOff, Send, CheckSquare } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/hooks/use-confirm";
import { useMyProblems, useCreateProblem, useDeleteProblem, useUpdateProblem } from "@/hooks/useProblems";
import { useProblemsRealtime } from "@/hooks/useProblemsRealtime";
import { useFolders, useCreateFolder, useDeleteFolder, useUpdateFolderColor } from "@/hooks/useProblemFolders";
import { resolveFolderCategory } from "@/lib/problemFolders";
import ProblemEditor from "@/components/teacher/ProblemEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupAction,
  SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuAction, SidebarSeparator,
  SidebarInset, SidebarTrigger, SidebarRail, sidebarMenuButtonVariants, useSidebar,
} from "@/components/ui/sidebar";
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
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [mobileListOpen, setMobileListOpen] = useState(false);

  useEffect(() => {
    const openId = (location.state as { openProblemId?: string } | null)?.openProblemId;
    if (openId) setSelectedId(openId);
  }, [location.state]);

  const childrenOf = (parentId: string | null) => folders.filter((f) => f.parent_id === parentId);
  const rootFolders = useMemo(() => folders.filter((f) => f.parent_id === null), [folders]);

  // 문제는 항상 순서도/파이썬/블럭코딩 중 하나에 속함 — "전체" 필터 없이 첫 대분류를 기본 선택.
  useEffect(() => {
    if (activeFolder === ALL && rootFolders[0]) setActiveFolder(rootFolders[0].id);
  }, [activeFolder, rootFolders]);

  const filtered = activeFolder === ALL ? problems : problems.filter((p) => p.folder_id === activeFolder);

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

  async function handleColorChange(id: string, color: string) {
    try {
      await updateFolderColorMut.mutateAsync({ id, color });
    } catch (e: any) {
      toast.error(e?.message ?? "색상 변경 실패");
    }
  }

  async function handleDeleteFolder(id: string) {
    if (!(await confirm({ description: "이 폴더를 삭제할까요? 하위 폴더도 함께 삭제됩니다.", destructive: true }))) return;
    try {
      const folder = folders.find((f) => f.id === id);
      await deleteFolderMut.mutateAsync(id);
      if (activeFolder === id) {
        setActiveFolder(folder?.parent_id ?? childrenOf(null).find((f) => f.id !== id)?.id ?? ALL);
      }
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
    if (!(await confirm({ description: "이 문제를 삭제할까요?", destructive: true }))) return;
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
    if (!(await confirm({ description: `선택한 문제 ${bulkSelected.size}개를 삭제할까요?`, destructive: true }))) return;
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
      setBulkSelected(new Set());
      if (bulkMode) setBulkMode(false);
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
    const raw = e.dataTransfer.getData(PROBLEM_DND_TYPE);
    if (!raw) return;
    let ids: string[];
    try { ids = JSON.parse(raw); } catch { ids = [raw]; }
    try {
      await Promise.all(
        ids.map((id) =>
          updateProblemMut.mutateAsync({ id, patch: { folder_id: folderId, category: resolveFolderCategory(folderId, folders) } })
        )
      );
      if (ids.length > 1) setBulkSelected(new Set());
    } catch (e: any) {
      toast.error(e?.message ?? "이동 실패");
    }
  }

  function handleProblemClick(id: string, index: number, e: React.MouseEvent) {
    if (bulkMode) {
      toggleBulkSelect(id);
      return;
    }
    if (e.shiftKey && lastClickedIndex !== null) {
      const [start, end] = [lastClickedIndex, index].sort((a, b) => a - b);
      setBulkSelected(new Set(filtered.slice(start, end + 1).map((p) => p.id)));
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      toggleBulkSelect(id);
      setLastClickedIndex(index);
      return;
    }
    setBulkSelected(new Set());
    setLastClickedIndex(index);
    setSelectedId(id);
  }

  function renderProblemRow(p: (typeof filtered)[number], opts?: { alwaysShowActions?: boolean; onAfterSelect?: () => void }) {
    const actionCls = opts?.alwaysShowActions ? "" : "opacity-0 group-hover:opacity-100";
    return (
      <div
        key={p.id}
        draggable={!bulkMode}
        onDragStart={(e) => e.dataTransfer.setData(PROBLEM_DND_TYPE, p.id)}
        onClick={() => { if (bulkMode) toggleBulkSelect(p.id); else { setSelectedId(p.id); opts?.onAfterSelect?.(); } }}
        className={cn(
          "group flex items-center gap-2 rounded-md p-2 text-sm hover:bg-accent",
          bulkMode ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
          (bulkMode ? bulkSelected.has(p.id) : selectedId === p.id) && "bg-accent"
        )}
      >
        {bulkMode && (
          <Checkbox
            checked={bulkSelected.has(p.id)}
            onChange={() => toggleBulkSelect(p.id)}
            onClick={(e) => e.stopPropagation()}
            className="size-3.5 shrink-0"
          />
        )}
        <Circle strokeWidth={0} className={cn("!size-2 shrink-0", p.is_published ? "fill-emerald-500" : "fill-muted-foreground/40")} />
        <span className="flex-1 truncate">{p.title || "(제목 없음)"}</span>
        {!bulkMode && (
          <>
            <Button variant="ghost" size="icon" className={cn("size-6", actionCls)} onClick={(e) => togglePublish(p.id, !p.is_published, e)} title="발행 전환">
              {p.is_published ? <EyeOff className="size-4" /> : <Globe className="size-4" />}
            </Button>
            <Button variant="ghost" size="icon" className={cn("size-6", actionCls)} onClick={(e) => handleDeleteProblem(p.id, e)} title="삭제">
              <Trash2 className="size-4" />
            </Button>
          </>
        )}
      </div>
    );
  }

  const editorPanel = selectedId ? (
    <ProblemEditor key={selectedId} problemId={selectedId} />
  ) : (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
      <p>왼쪽에서 문제를 선택하거나 새로 만드세요.</p>
      <Button variant="outline" onClick={handleCreateProblem} disabled={createProblemMut.isPending}>
        <Plus className="size-4" /> 새 문제 만들기
      </Button>
    </div>
  );

  const selectedProblem = filtered.find((p) => p.id === selectedId);

  return (
    <>
    <SidebarProvider className="h-full min-h-0 items-stretch">
      <Sidebar collapsible="icon" className="border-r">
        <SidebarHeader className="min-h-[45px] flex-row items-center gap-1 border-b group-data-[collapsible=icon]:justify-center">
          <ClipboardList className="hidden size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:block" />
          <span className="whitespace-nowrap text-sm font-semibold group-data-[collapsible=icon]:hidden">문제</span>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>폴더</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
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
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          <SidebarGroup>
            <SidebarGroupLabel>
              {bulkSelected.size > 0 ? `${bulkSelected.size}개 선택됨` : "문제 목록"}
            </SidebarGroupLabel>
            {!bulkMode ? (
              <>
                <SidebarGroupAction
                  className="group-data-[collapsible=icon]:hidden"
                  onClick={handleCreateProblem}
                  disabled={createProblemMut.isPending}
                  title="문제 추가"
                >
                  <Plus className="size-4" />
                </SidebarGroupAction>
                <SidebarGroupAction
                  className="right-8 group-data-[collapsible=icon]:hidden"
                  onClick={() => (bulkSelected.size > 0 ? void handleBulkPublishSelected() : toggleBulkMode())}
                  disabled={updateProblemMut.isPending}
                  title={bulkSelected.size > 0 ? "선택 항목 발행" : "일괄 선택"}
                >
                  {bulkSelected.size > 0 ? <Globe className="size-4" /> : <CheckSquare className="size-4" />}
                </SidebarGroupAction>
              </>
            ) : (
              <SidebarGroupAction className="group-data-[collapsible=icon]:hidden" onClick={toggleBulkMode} title="일괄 선택 취소">
                <CheckSquare className="size-4" />
              </SidebarGroupAction>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {isLoading ? (
                  <p className="p-2 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">불러오는 중…</p>
                ) : filtered.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">“문제 추가”로 시작하세요.</p>
                ) : (
                  filtered.map((p, index) => (
                    <ProblemMenuItem
                      key={p.id}
                      problem={p}
                      isActive={selectedId === p.id}
                      bulkMode={bulkMode}
                      bulkSelected={bulkSelected.has(p.id)}
                      dragIds={bulkSelected.has(p.id) && bulkSelected.size > 1 ? [...bulkSelected] : [p.id]}
                      onClick={(e) => handleProblemClick(p.id, index, e)}
                      onToggleBulk={toggleBulkSelect}
                      onTogglePublish={togglePublish}
                      onDelete={handleDeleteProblem}
                    />
                  ))
                )}
              </SidebarMenu>
              {bulkMode && (
                <div className="flex flex-col gap-1 p-2">
                  <Button variant="outline" size="sm" className="w-full" onClick={toggleSelectAll}>
                    {bulkSelected.size === filtered.length ? "전체 해제" : "전체 선택"}
                  </Button>
                  <div className="flex flex-wrap gap-1">
                    <Button variant="destructive" size="sm" className="min-w-24 flex-1" onClick={handleBulkDelete} disabled={deleteProblemMut.isPending}>
                      <Trash2 /> 삭제 ({bulkSelected.size})
                    </Button>
                    <Button variant="secondary" size="sm" className="min-w-24 flex-1" onClick={handleBulkPublishSelected} disabled={updateProblemMut.isPending}>
                      <Send /> 발행
                    </Button>
                  </div>
                </div>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarRail />

      <SidebarInset className="overflow-hidden">
        {/* 모바일: 폴더/문제 목록은 사이드바 시트, 문제 상세는 드롭다운으로 선택 */}
        <div className="flex items-center gap-1 border-b bg-muted/20 p-2 md:hidden">
          <SidebarTrigger />
          <Popover open={mobileListOpen} onOpenChange={setMobileListOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex flex-1 items-center gap-2 justify-start font-normal">
                <span className="flex-1 truncate text-left">{selectedProblem ? (selectedProblem.title || "(제목 없음)") : "문제 목록"}</span>
                <ChevronDown className={cn("size-4 shrink-0 transition-transform", mobileListOpen && "rotate-180")} />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 max-h-[60vh] overflow-auto p-1">
              <div className="flex items-center justify-end border-b p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  onClick={handleCreateProblem}
                  disabled={createProblemMut.isPending}
                  title="문제 추가"
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              {isLoading ? (
                <p className="p-2 text-sm text-muted-foreground">불러오는 중…</p>
              ) : filtered.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">“문제 추가”로 시작하세요.</p>
              ) : (
                filtered.map((p) => renderProblemRow(p, { alwaysShowActions: true, onAfterSelect: () => setMobileListOpen(false) }))
              )}
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex-1 overflow-hidden md:hidden">{editorPanel}</div>

        {/* 데스크톱: 에디터 */}
        <SidebarTrigger className="m-2 hidden shrink-0 md:flex" />
        <div className="hidden min-h-0 flex-1 overflow-hidden md:flex">{editorPanel}</div>
      </SidebarInset>
    </SidebarProvider>
    {confirmDialog}
    </>
  );
}

function ProblemMenuItem({
  problem, isActive, bulkMode, bulkSelected, dragIds, onClick, onToggleBulk, onTogglePublish, onDelete,
}: {
  problem: { id: string; title: string; is_published: boolean };
  isActive: boolean;
  bulkMode: boolean;
  bulkSelected: boolean;
  dragIds: string[];
  onClick: (e: React.MouseEvent) => void;
  onToggleBulk: (id: string) => void;
  onTogglePublish: (id: string, next: boolean, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive || bulkSelected}
        tooltip={problem.title || "(제목 없음)"}
        draggable
        onDragStart={(e) => e.dataTransfer.setData(PROBLEM_DND_TYPE, JSON.stringify(dragIds))}
        onClick={(e) => {
          onClick(e);
          if (isMobile) setOpenMobile(false);
        }}
      >
        {bulkMode && (
          <Checkbox
            checked={bulkSelected}
            onChange={() => onToggleBulk(problem.id)}
            onClick={(e) => e.stopPropagation()}
            className="size-3.5 shrink-0"
          />
        )}
        <FileText className={cn("hidden size-4 shrink-0 group-data-[collapsible=icon]:block", problem.is_published ? "text-emerald-500" : "text-muted-foreground")} />
        <Circle strokeWidth={0} className={cn("!size-2 shrink-0 group-data-[collapsible=icon]:hidden", problem.is_published ? "fill-emerald-500" : "fill-muted-foreground/40")} />
        <span className="flex-1 truncate group-data-[collapsible=icon]:hidden">{problem.title || "(제목 없음)"}</span>
      </SidebarMenuButton>
      {!bulkMode && (
        <>
          <SidebarMenuAction showOnHover className="right-7" onClick={(e) => onTogglePublish(problem.id, !problem.is_published, e)} title="발행 전환">
            {problem.is_published ? <EyeOff className="size-3.5" /> : <Globe className="size-3.5" />}
          </SidebarMenuAction>
          <SidebarMenuAction showOnHover onClick={(e) => onDelete(problem.id, e)} title="삭제">
            <Trash2 className="size-3.5" />
          </SidebarMenuAction>
        </>
      )}
    </SidebarMenuItem>
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
  const { isMobile, setOpenMobile } = useSidebar();

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
    <>
    <SidebarMenuItem>
      <div
        onClick={() => {
          onSelect(folder.id);
          if (isMobile) setOpenMobile(false);
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOverId(folder.id); }}
        onDragLeave={() => setDragOverId((id) => (id === folder.id ? null : id))}
        onDrop={(e) => onDrop(folder.id, e)}
        style={depth > 0 ? { paddingLeft: depth * 14 } : undefined}
        className={cn(
          sidebarMenuButtonVariants({ isActive: activeFolder === folder.id }),
          "group cursor-pointer",
          dragOverId === folder.id && "ring-2 ring-primary"
        )}
      >
        {kids.length > 0 ? (
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onToggleExpand(folder.id); }} className="size-5 shrink-0 text-muted-foreground">
            {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </Button>
        ) : depth > 0 ? (
          <span className="w-3.5 shrink-0" />
        ) : null}
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
        <span className={cn("flex-1 truncate group-data-[collapsible=icon]:hidden", isDefault && "font-medium")}>{folder.name}</span>
      </div>
      <SidebarMenuAction
        showOnHover
        className={cn("right-1", !isDefault && "right-7")}
        onClick={() => setCreating(true)}
        title="하위 폴더 추가"
      >
        <FolderPlus className="size-3.5" />
      </SidebarMenuAction>
      {!isDefault && (
        <SidebarMenuAction showOnHover onClick={() => onDelete(folder.id)} title="폴더 삭제">
          <Trash2 className="size-3.5" />
        </SidebarMenuAction>
      )}
    </SidebarMenuItem>
    {creating && (
      <SidebarMenuItem>
        <div style={{ paddingLeft: (depth + 1) * 14 }} className="flex items-center gap-1 p-2">
          <span className="w-3.5 shrink-0" />
          <Folder className="size-4 shrink-0 text-muted-foreground" />
          <Input
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
            className="h-6 flex-1"
          />
        </div>
      </SidebarMenuItem>
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
    </>
  );
}
