import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Trash2, Folder, FolderPlus, ChevronRight, ChevronDown, Circle, Globe, EyeOff, Send, CheckSquare } from "lucide-react";
import type { ImperativePanelHandle } from "react-resizable-panels";
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
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuAction, SidebarInset, SidebarTrigger, SidebarRail,
  sidebarMenuButtonVariants, useSidebar,
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
  const [mobileListOpen, setMobileListOpen] = useState(false);

  useEffect(() => {
    const openId = (location.state as { openProblemId?: string } | null)?.openProblemId;
    if (openId) setSelectedId(openId);
  }, [location.state]);

  const listPanelRef = useRef<ImperativePanelHandle>(null);
  const [listCollapsed, setListCollapsed] = useState(false);
  function toggleListPanel() {
    if (listCollapsed) listPanelRef.current?.expand();
    else listPanelRef.current?.collapse();
  }

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
        <Circle className={cn("size-2 shrink-0", p.is_published ? "fill-emerald-500 text-emerald-500" : "fill-muted-foreground/40 text-muted-foreground/40")} />
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

  const problemListPanel = (
    <>
      <div className="flex items-center gap-1 border-b p-2">
        <span className="whitespace-nowrap text-sm font-semibold">문제 목록</span>
        {!bulkMode ? (
          <div className="ml-auto flex items-center gap-1">
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
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={toggleBulkMode}
              title="일괄 선택"
            >
              <CheckSquare className="size-4" />
            </Button>
          </div>
        ) : (
          <span className="ml-auto text-xs text-muted-foreground">{bulkSelected.size}개 선택됨</span>
        )}
      </div>
      <div className="flex-1 overflow-auto p-1">
        {isLoading ? (
          <p className="p-2 text-sm text-muted-foreground">불러오는 중…</p>
        ) : filtered.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">“문제 추가”로 시작하세요.</p>
        ) : (
          filtered.map((p) => renderProblemRow(p))
        )}
      </div>
      {bulkMode && (
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
    </>
  );

  const editorPanel = selectedId ? (
    <ProblemEditor key={selectedId} problemId={selectedId} />
  ) : (
    <div className="flex h-full items-center justify-center p-6 text-center text-muted-foreground">
      왼쪽에서 문제를 선택하거나 “문제 추가”를 누르세요.
    </div>
  );

  const selectedProblem = filtered.find((p) => p.id === selectedId);

  return (
    <>
    <SidebarProvider className="h-full min-h-0 items-stretch">
      <Sidebar collapsible="icon" className="border-r">
        <SidebarHeader className="flex-row items-center gap-1 border-b group-data-[collapsible=icon]:justify-center">
          <span className="whitespace-nowrap text-sm font-semibold group-data-[collapsible=icon]:hidden">폴더</span>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <FolderItem label="전체" active={activeFolder === ALL} onClick={() => setActiveFolder(ALL)} />
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
        </SidebarContent>
      </Sidebar>
      <SidebarRail />

      <SidebarInset className="overflow-hidden">
        {/* 모바일: 폴더는 사이드바 시트로, 문제 목록은 드롭다운으로 */}
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

        {/* 데스크톱: 문제 목록 + 에디터 리사이즈 패널 */}
        <SidebarTrigger className="m-2 hidden shrink-0 md:flex" />
        <ResizablePanelGroup direction="horizontal" className="hidden min-h-0 flex-1 overflow-hidden md:flex">
          <ResizablePanel
            ref={listPanelRef}
            defaultSize={18}
            minSize={14}
            maxSize={40}
            collapsible
            collapsedSize={5}
            onCollapse={() => setListCollapsed(true)}
            onExpand={() => setListCollapsed(false)}
            className="flex h-full flex-col bg-muted/20"
          >
            {listCollapsed ? (
              <div className="flex flex-col items-center gap-2 py-2">
                {filtered.map((p) => (
                  <Button
                    key={p.id}
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedId(p.id)}
                    title={p.title || "(제목 없음)"}
                    className={cn("size-8", selectedId === p.id && "bg-accent")}
                  >
                    <Circle className={cn("size-2.5", p.is_published ? "fill-emerald-500 text-emerald-500" : "fill-muted-foreground/40 text-muted-foreground/40")} />
                  </Button>
                ))}
              </div>
            ) : (
              problemListPanel
            )}
          </ResizablePanel>

          <ResizableHandle onToggle={toggleListPanel} collapsed={listCollapsed} />

          <ResizablePanel defaultSize={82} className="overflow-hidden">
            {editorPanel}
          </ResizablePanel>
        </ResizablePanelGroup>
      </SidebarInset>
    </SidebarProvider>
    {confirmDialog}
    </>
  );
}

function FolderItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        tooltip={label}
        onClick={() => {
          onClick();
          if (isMobile) setOpenMobile(false);
        }}
      >
        <Folder />
        <span className="flex-1 truncate">{label}</span>
      </SidebarMenuButton>
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
        style={{ paddingLeft: depth * 14 }}
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
