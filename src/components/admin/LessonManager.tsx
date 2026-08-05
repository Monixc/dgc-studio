import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Upload, Trash2, FileText, FileCode, Code2, Eye, Pencil, Folder, FolderPlus, Check, ClipboardList, X, ChevronRight, ChevronDown, Paperclip, ImagePlus, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/hooks/use-confirm";
import {
  useLessons,
  useCreateLesson,
  useUpdateLesson,
  useDeleteLesson,
  useLessonProblemIds,
  useSetLessonProblems,
} from "@/hooks/useLessons";
import { uploadLessonAsset } from "@/lib/lessons";
import { useMyProblems, useUpdateProblem } from "@/hooks/useProblems";
import AssignProblemsDialog from "@/components/admin/AssignProblemsDialog";
import {
  useLessonFolders,
  useCreateLessonFolder,
  useRenameLessonFolder,
  useUpdateLessonFolderColor,
  useDeleteLessonFolder,
} from "@/hooks/useLessonFolders";
import { FolderColorSwatch } from "@/components/admin/FolderColorSwatch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupAction,
  SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuAction, SidebarInset,
  SidebarTrigger, SidebarRail, SidebarSeparator, sidebarMenuButtonVariants, useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/Markdown";
import { cn } from "@/lib/utils";
import type { Lesson, LessonFolder, AnnouncementAttachment } from "@/integrations/supabase/types";

const NONE = "__none__";
const LESSON_DND_TYPE = "text/flowpy-lesson-id";

interface Draft {
  title: string;
  content: string;
  code_practice: boolean;
  starter_code: string;
  folder_id: string | null;
  attachments: AnnouncementAttachment[];
}

/** HTML 미리보기 — blob URL 로드로 목차 링크가 앱 라우터로 새지 않게. */
function HtmlPreview({ html, className }: { html: string; className?: string }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const u = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [html]);
  if (!url) return null;
  return <iframe title="교안 미리보기" className={className} sandbox="allow-scripts" src={url} />;
}

function toDraft(l: Lesson): Draft {
  return {
    title: l.title,
    content: l.content,
    code_practice: l.code_practice,
    starter_code: l.starter_code,
    folder_id: l.folder_id,
    attachments: l.attachments,
  };
}

export default function LessonManager() {
  const { user } = useAuth();
  const userId = user!.id;
  const { data: lessons = [], isLoading } = useLessons(userId);
  const { data: folders = [] } = useLessonFolders(userId);
  const createMut = useCreateLesson();
  const updateMut = useUpdateLesson();
  const deleteMut = useDeleteLesson();
  const createFolderMut = useCreateLessonFolder();
  const renameFolderMut = useRenameLessonFolder();
  const updateColorMut = useUpdateLessonFolderColor();
  const deleteFolderMut = useDeleteLessonFolder();
  const { data: myProblems = [] } = useMyProblems(userId);
  const setLessonProbsMut = useSetLessonProblems();
  const updateProblemMut = useUpdateProblem();

  const [activeFolder, setActiveFolder] = useState<string>(NONE);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState("");
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [attachOpen, setAttachOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // true면 현재 교안의 파일 교체, false면 새 교안 생성
  const replaceRef = useRef(false);
  const [assetUploading, setAssetUploading] = useState(false);
  const assetImageRef = useRef<HTMLInputElement>(null);
  const assetFileRef = useRef<HTMLInputElement>(null);

  const selected = lessons.find((l) => l.id === selectedId) ?? null;
  const { data: attachedIds = [] } = useLessonProblemIds(selected?.id);
  const attachedProblems = attachedIds
    .map((id) => myProblems.find((p) => p.id === id))
    .filter(Boolean) as typeof myProblems;

  async function publishProblem(id: string) {
    try {
      await updateProblemMut.mutateAsync({ id, patch: { is_published: true } });
      toast.success("발행됨");
    } catch (e: any) {
      toast.error(e?.message ?? "발행 실패");
    }
  }

  async function detachProblem(id: string) {
    if (!selected) return;
    try {
      await setLessonProbsMut.mutateAsync({ lessonId: selected.id, problemIds: attachedIds.filter((x) => x !== id) });
    } catch (e: any) {
      toast.error(e?.message ?? "실패");
    }
  }

  useEffect(() => {
    setDraft(selected ? toDraft(selected) : null);
    setPreview(false);
  }, [selectedId, selected?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty =
    !!selected &&
    !!draft &&
    (draft.title !== selected.title ||
      draft.content !== selected.content ||
      draft.code_practice !== selected.code_practice ||
      draft.starter_code !== selected.starter_code ||
      (draft.folder_id ?? null) !== (selected.folder_id ?? null) ||
      JSON.stringify(draft.attachments) !== JSON.stringify(selected.attachments));

  const newFolderId = activeFolder === NONE ? null : activeFolder;
  const filtered = lessons.filter((l) =>
    activeFolder === NONE ? !l.folder_id : l.folder_id === activeFolder,
  );

  const childrenOf = (parentId: string | null) => folders.filter((f) => f.parent_id === parentId);
  const rootFolders = folders.filter((f) => f.parent_id === null);

  function folderPath(id: string): LessonFolder[] {
    const path: LessonFolder[] = [];
    let cur = folders.find((f) => f.id === id);
    while (cur) {
      path.unshift(cur);
      cur = folders.find((f) => f.id === cur!.parent_id);
    }
    return path;
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function createMd() {
    try {
      const l = await createMut.mutateAsync({
        userId,
        input: { title: "새 교안", content_type: "md", content: "# 제목\n\n내용을 작성하세요.", folder_id: newFolderId },
      });
      setSelectedId(l.id);
    } catch (e: any) {
      toast.error(e?.message ?? "생성 실패");
    }
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const replace = replaceRef.current;
    replaceRef.current = false;
    if (!file) return;
    const text = await file.text();
    // "파일 교체"로 열었을 때만 현재 교안 내용 교체. 그 외엔 항상 새 교안 생성.
    if (replace && selected?.content_type === "html" && draft) {
      setDraft({ ...draft, content: text });
      toast.message("파일 내용을 불러왔어요. ‘저장’을 눌러 반영하세요.");
      return;
    }
    try {
      const l = await createMut.mutateAsync({
        userId,
        input: { title: file.name.replace(/\.html?$/i, ""), content_type: "html", content: text, folder_id: newFolderId },
      });
      setSelectedId(l.id);
      toast.success("HTML 교안 업로드됨");
    } catch (err: any) {
      toast.error(err?.message ?? "업로드 실패");
    }
  }

  async function addAssets(files: FileList | null) {
    if (!files?.length || !draft) return;
    setAssetUploading(true);
    try {
      for (const file of Array.from(files)) {
        const attachment = await uploadLessonAsset(file);
        setDraft((prev) => (prev ? { ...prev, attachments: [...prev.attachments, attachment] } : prev));
      }
    } catch (e: any) {
      toast.error(e?.message ?? "첨부 업로드 실패");
    } finally {
      setAssetUploading(false);
    }
  }

  function removeAsset(index: number) {
    setDraft((prev) => (prev ? { ...prev, attachments: prev.attachments.filter((_, i) => i !== index) } : prev));
  }

  async function save() {
    if (!selected || !draft) return;
    try {
      await updateMut.mutateAsync({ id: selected.id, patch: draft });
      toast.success("저장됨");
    } catch (e: any) {
      toast.error(e?.message ?? "저장 실패");
    }
  }

  async function remove(id: string) {
    if (!(await confirm({ description: "이 교안을 삭제할까요? 반 배정도 함께 해제됩니다.", destructive: true }))) return;
    try {
      await deleteMut.mutateAsync(id);
      if (selectedId === id) setSelectedId(null);
      toast.success("삭제됨");
    } catch (e: any) {
      toast.error(e?.message ?? "삭제 실패");
    }
  }

  async function handleBulkDelete() {
    if (bulkSelected.size === 0) return toast.info("선택된 교안이 없습니다.");
    if (!(await confirm({ description: `선택한 교안 ${bulkSelected.size}개를 삭제할까요? 반 배정도 함께 해제됩니다.`, destructive: true }))) return;
    try {
      await Promise.all([...bulkSelected].map((id) => deleteMut.mutateAsync(id)));
      if (selectedId && bulkSelected.has(selectedId)) setSelectedId(null);
      toast.success(`${bulkSelected.size}개 삭제됨`);
      setBulkSelected(new Set());
    } catch (e: any) {
      toast.error(e?.message ?? "삭제 실패");
    }
  }

  function handleLessonClick(id: string, index: number, e: React.MouseEvent) {
    if (e.shiftKey && lastClickedIndex !== null) {
      const [start, end] = [lastClickedIndex, index].sort((a, b) => a - b);
      setBulkSelected(new Set(filtered.slice(start, end + 1).map((l) => l.id)));
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      setBulkSelected((prev) => {
        const next = new Set(prev.size > 0 ? prev : selectedId ? [selectedId] : []);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setLastClickedIndex(index);
      return;
    }
    setBulkSelected(new Set());
    setLastClickedIndex(index);
    setSelectedId(id);
  }

  async function addFolder() {
    try {
      const f = await createFolderMut.mutateAsync({ userId, name: "새 폴더" });
      setActiveFolder(f.id);
      setEditingFolderId(f.id);
      setFolderName("새 폴더");
    } catch (e: any) {
      toast.error(e?.message ?? "폴더 생성 실패");
    }
  }

  async function saveFolderName(id: string) {
    try {
      await renameFolderMut.mutateAsync({ id, name: folderName.trim() || "이름 없음" });
    } catch (e: any) {
      toast.error(e?.message ?? "실패");
    } finally {
      setEditingFolderId(null);
    }
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

  async function removeFolder(id: string) {
    if (!(await confirm({ description: "폴더를 삭제할까요? 하위 폴더도 함께 삭제되고, 안의 교안은 ‘미분류’로 이동합니다.", destructive: true }))) return;
    try {
      const folder = folders.find((f) => f.id === id);
      // 삭제 대상이 현재 보고 있는 폴더 자신이거나 조상이면(하위 폴더까지 함께 지워지므로)
      // activeFolder가 사라진 폴더를 가리키는 좀비 상태가 되지 않게 미리 확인.
      const affected = activeFolder !== NONE && folderPath(activeFolder).some((f) => f.id === id);
      await deleteFolderMut.mutateAsync(id);
      if (affected) setActiveFolder(folder?.parent_id ?? NONE);
    } catch (e: any) {
      toast.error(e?.message ?? "삭제 실패");
    }
  }

  const countIn = (fid: string | null) =>
    fid === null ? lessons.filter((l) => !l.folder_id).length : lessons.filter((l) => l.folder_id === fid).length;

  async function handleDropOnFolder(folderId: string | null, e: React.DragEvent) {
    e.preventDefault();
    setDragOverId(null);
    const raw = e.dataTransfer.getData(LESSON_DND_TYPE);
    if (!raw) return;
    let ids: string[];
    try { ids = JSON.parse(raw); } catch { ids = [raw]; }
    try {
      await Promise.all(ids.map((id) => updateMut.mutateAsync({ id, patch: { folder_id: folderId } })));
      if (ids.length > 1) setBulkSelected(new Set());
    } catch (e: any) {
      toast.error(e?.message ?? "이동 실패");
    }
  }

  function folderRow(id: string, label: string, count: number, opts?: { folder?: LessonFolder; dropTarget?: string | null }) {
    const editing = editingFolderId === id;
    const dragProps =
      opts && "dropTarget" in opts
        ? {
            onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOverId(id); },
            onDragLeave: () => setDragOverId((prev) => (prev === id ? null : prev)),
            onDrop: (e: React.DragEvent) => void handleDropOnFolder(opts.dropTarget!, e),
          }
        : {};
    return (
      <SidebarMenuItem key={id}>
        {editing ? (
          <div className="flex items-center gap-2 rounded-md p-2">
            {opts?.folder ? (
              <FolderColorSwatch color={opts.folder.color} onChange={(color) => updateColorMut.mutate({ id, color })} />
            ) : (
              <Folder className="size-4 shrink-0 text-muted-foreground" />
            )}
            <Input
              autoFocus
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveFolderName(id)}
              className="h-6 flex-1"
            />
            <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={() => saveFolderName(id)} title="저장">
              <Check className="size-3.5" />
            </Button>
          </div>
        ) : opts?.folder ? (
          <>
            <div
              onClick={() => setActiveFolder(id)}
              {...dragProps}
              className={cn(
                sidebarMenuButtonVariants({ isActive: activeFolder === id }),
                "cursor-pointer",
                dragOverId === id && "ring-2 ring-primary"
              )}
            >
              <FolderColorSwatch color={opts.folder.color} onChange={(color) => updateColorMut.mutate({ id, color })} />
              <span className="flex-1 truncate font-medium group-data-[collapsible=icon]:hidden">{label}</span>
              <span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">{count}</span>
            </div>
            <SidebarMenuAction
              showOnHover
              className="right-7"
              onClick={() => { setEditingFolderId(id); setFolderName(label); }}
              title="이름 수정"
            >
              <Pencil className="size-3.5" />
            </SidebarMenuAction>
            <SidebarMenuAction showOnHover onClick={() => removeFolder(id)} title="폴더 삭제">
              <Trash2 className="size-3.5" />
            </SidebarMenuAction>
          </>
        ) : (
          <SidebarMenuButton
            isActive={activeFolder === id}
            onClick={() => setActiveFolder(id)}
            tooltip={label}
            {...dragProps}
            className={cn(dragOverId === id && "ring-2 ring-primary")}
          >
            <Folder />
            <span className="flex-1 truncate group-data-[collapsible=icon]:hidden">{label}</span>
            <span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">{count}</span>
          </SidebarMenuButton>
        )}
      </SidebarMenuItem>
    );
  }

  return (
    <>
    <SidebarProvider className="h-full min-h-0 items-stretch">
      <Sidebar collapsible="icon" className="border-r">
        <SidebarHeader className="min-h-[45px] flex-row items-center gap-1 border-b group-data-[collapsible=icon]:justify-center">
          <FileText className="hidden size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:block" />
          <span className="whitespace-nowrap text-sm font-semibold group-data-[collapsible=icon]:hidden">교안</span>
          <Input ref={fileRef} type="file" accept=".html,.htm,text/html" className="hidden" onChange={onFilePicked} />
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>폴더</SidebarGroupLabel>
            <SidebarGroupAction onClick={addFolder} title="새 폴더">
              <FolderPlus className="size-4" />
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu>
                {rootFolders.map((f) => (
                  <LessonFolderTreeNode
                    key={f.id}
                    folder={f}
                    depth={0}
                    childrenOf={childrenOf}
                    expanded={expanded}
                    onToggleExpand={toggleExpand}
                    activeFolder={activeFolder}
                    onSelect={setActiveFolder}
                    onAddChild={handleAddChild}
                    onDelete={removeFolder}
                    onColorChange={(id, color) => updateColorMut.mutate({ id, color })}
                    editingFolderId={editingFolderId}
                    folderName={folderName}
                    setFolderName={setFolderName}
                    onStartRename={(id, name) => { setEditingFolderId(id); setFolderName(name); }}
                    onSaveRename={saveFolderName}
                    countIn={countIn}
                    dragOverId={dragOverId}
                    setDragOverId={setDragOverId}
                    onDrop={handleDropOnFolder}
                  />
                ))}
                {folderRow(NONE, "미분류", countIn(null), { dropTarget: null })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          <SidebarGroup>
            <SidebarGroupLabel>
              {bulkSelected.size > 0 ? (
                `${bulkSelected.size}개 선택됨`
              ) : activeFolder === NONE ? (
                "미분류"
              ) : (
                <span className="flex min-w-0 items-center gap-1 truncate">
                  {folderPath(activeFolder).map((f, i) => (
                    <span key={f.id} className="flex min-w-0 items-center gap-1 truncate">
                      {i > 0 && <ChevronRight className="size-3 shrink-0" />}
                      <span className="truncate">{f.name}</span>
                    </span>
                  ))}
                </span>
              )}
            </SidebarGroupLabel>
            <SidebarGroupAction
              className="group-data-[collapsible=icon]:hidden"
              onClick={createMd}
              disabled={createMut.isPending}
              title="교안 추가"
            >
              <Plus className="size-4" />
            </SidebarGroupAction>
            {bulkSelected.size > 0 && (
              <SidebarGroupAction
                className="right-10 group-data-[collapsible=icon]:hidden"
                onClick={() => void handleBulkDelete()}
                disabled={deleteMut.isPending}
                title="선택 항목 삭제"
              >
                <Trash2 className="size-4" />
              </SidebarGroupAction>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {isLoading ? (
                  <p className="p-2 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">불러오는 중…</p>
                ) : filtered.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">교안이 없습니다.</p>
                ) : (
                  filtered.map((l, index) => (
                    <LessonMenuItem
                      key={l.id}
                      lesson={l}
                      isActive={selectedId === l.id}
                      bulkSelected={bulkSelected.has(l.id)}
                      dragIds={bulkSelected.has(l.id) && bulkSelected.size > 1 ? [...bulkSelected] : [l.id]}
                      onClick={(e) => handleLessonClick(l.id, index, e)}
                      onDelete={remove}
                    />
                  ))
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarRail />

      <SidebarInset className="overflow-auto">
      <SidebarTrigger className="m-2 shrink-0" />
      {/* 편집 */}
      {!selected || !draft ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
          <p>왼쪽에서 교안을 선택하거나 새로 만드세요.</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={createMd} disabled={createMut.isPending}>
              <Plus className="size-4" /> MD로 만들기
            </Button>
            <Button variant="outline" onClick={() => { replaceRef.current = false; fileRef.current?.click(); }} disabled={createMut.isPending}>
              <Upload className="size-4" /> HTML 업로드
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col overflow-auto p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Input
              className="h-9 max-w-xs font-semibold"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="교안 제목"
            />
            <Badge variant="muted">{selected.content_type === "html" ? "HTML" : "Markdown"}</Badge>
            <Select
              value={draft.folder_id ?? "__none__"}
              onValueChange={(v) => setDraft({ ...draft, folder_id: v === "__none__" ? null : v })}
            >
              <SelectTrigger className="h-9 w-auto" title="폴더">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">미분류</SelectItem>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name || "(이름 없음)"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setPreview((p) => !p)}>
                {preview ? <><Pencil className="size-4" /> 편집</> : <><Eye className="size-4" /> 미리보기</>}
              </Button>
              {selected.content_type === "html" && (
                <Button size="sm" variant="outline" onClick={() => { replaceRef.current = true; fileRef.current?.click(); }}>
                  <Upload className="size-4" /> 파일 교체
                </Button>
              )}
              <Button size="sm" onClick={save} disabled={!dirty || updateMut.isPending}>
                저장{dirty ? " *" : ""}
              </Button>
            </div>
          </div>

          <label className="mb-3 flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm">
            <Checkbox
              checked={draft.code_practice}
              onChange={(e) => setDraft({ ...draft, code_practice: e.target.checked })}
            />
            <Code2 className="size-4 text-primary" />
            <span className="font-medium">코드 실습</span>
            <span className="text-xs text-muted-foreground">
              체크 시 학생 화면에 코드 IDE를 함께 띄웁니다. 미체크 시 교안 내용만 보여줍니다.
            </span>
          </label>

          {preview ? (
            <div className="flex-1 overflow-auto rounded-lg border p-4">
              {selected.content_type === "html" ? (
                <HtmlPreview html={draft.content} className="h-[60vh] w-full" />
              ) : (
                <Markdown>{draft.content}</Markdown>
              )}
            </div>
          ) : (
            <Textarea
              className="min-h-[40vh] flex-1 resize-none font-mono text-sm"
              value={draft.content}
              onChange={(e) => setDraft({ ...draft, content: e.target.value })}
              placeholder={selected.content_type === "html" ? "HTML 원본…" : "# 마크다운으로 작성"}
              spellCheck={false}
            />
          )}

          {draft.code_practice && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">시작 코드 (선택)</p>
              <Textarea
                className="min-h-24 w-full resize-none font-mono text-sm"
                value={draft.starter_code}
                onChange={(e) => setDraft({ ...draft, starter_code: e.target.value })}
                placeholder="# 학생 IDE에 미리 채워둘 코드"
                spellCheck={false}
              />
            </div>
          )}

          {/* 학습 자료 첨부 (학생이 교안에서 다운로드) */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Paperclip className="size-4 text-muted-foreground" /> 학습 자료 ({draft.attachments.length})
              </p>
              <div className="flex gap-2">
                <input
                  ref={assetImageRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => { void addAssets(e.target.files); e.target.value = ""; }}
                />
                <input
                  ref={assetFileRef}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => { void addAssets(e.target.files); e.target.value = ""; }}
                />
                <Button size="sm" variant="outline" disabled={assetUploading} onClick={() => assetImageRef.current?.click()}>
                  {assetUploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} 이미지
                </Button>
                <Button size="sm" variant="outline" disabled={assetUploading} onClick={() => assetFileRef.current?.click()}>
                  <Paperclip className="size-4" /> 파일
                </Button>
              </div>
            </div>
            {draft.attachments.length === 0 ? (
              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                첨부된 학습 자료가 없습니다.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {draft.attachments.map((att, index) => (
                  <span key={index} className="flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1 text-xs">
                    {att.kind === "image" ? <ImagePlus className="size-3.5" /> : <Paperclip className="size-3.5" />}
                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="max-w-40 truncate hover:underline">
                      {att.name}
                    </a>
                    <Button variant="ghost" size="icon" className="size-5" onClick={() => removeAsset(index)} title="제거">
                      <X className="size-3" />
                    </Button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 이 교안에 붙는 문제 (학생은 교안 열면 콘텐츠 → 이 문제들 순서대로 풂) */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <ClipboardList className="size-4 text-muted-foreground" /> 문제 ({attachedProblems.length})
              </p>
              <Button size="sm" variant="outline" onClick={() => setAttachOpen(true)}>
                <Plus className="size-4" /> 문제 붙이기
              </Button>
            </div>
            {attachedProblems.length === 0 ? (
              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                이 교안에 붙은 문제가 없습니다. 학생은 교안 내용만 봅니다.
              </div>
            ) : (
              <ol className="space-y-1.5">
                {attachedProblems.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-2 rounded-lg border p-2.5 text-sm">
                    <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{p.title || "(제목 없음)"}</span>
                    {!p.is_published && (
                      <button
                        type="button"
                        onClick={() => publishProblem(p.id)}
                        disabled={updateProblemMut.isPending}
                        className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 hover:bg-amber-200"
                        title="클릭해서 바로 발행"
                      >
                        미발행 — 클릭해서 발행
                      </button>
                    )}
                    <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground" onClick={() => detachProblem(p.id)} title="떼기">
                      <X className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <AssignProblemsDialog
            open={attachOpen}
            onOpenChange={setAttachOpen}
            problems={myProblems}
            assignedIds={attachedIds}
            onSave={async (ids) => {
              try {
                await setLessonProbsMut.mutateAsync({ lessonId: selected.id, problemIds: ids });
                toast.success("문제 저장됨");
                setAttachOpen(false);
              } catch (e: any) {
                toast.error(e?.message ?? "저장 실패");
              }
            }}
          />
        </div>
      )}
      </SidebarInset>
    </SidebarProvider>
    {confirmDialog}
    </>
  );
}

function LessonMenuItem({
  lesson, isActive, bulkSelected, dragIds, onClick, onDelete,
}: {
  lesson: Lesson;
  isActive: boolean;
  bulkSelected: boolean;
  dragIds: string[];
  onClick: (e: React.MouseEvent) => void;
  onDelete: (id: string) => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive || bulkSelected}
        tooltip={lesson.title || "(제목 없음)"}
        draggable
        onDragStart={(e) => e.dataTransfer.setData(LESSON_DND_TYPE, JSON.stringify(dragIds))}
        onClick={(e) => {
          onClick(e);
          if (isMobile) setOpenMobile(false);
        }}
      >
        {lesson.content_type === "html" ? <FileCode /> : <FileText />}
        <span className="flex-1 truncate group-data-[collapsible=icon]:hidden">{lesson.title || "(제목 없음)"}</span>
        {lesson.code_practice && <Code2 className="size-3.5 shrink-0 text-primary group-data-[collapsible=icon]:hidden" />}
      </SidebarMenuButton>
      <SidebarMenuAction showOnHover onClick={() => onDelete(lesson.id)} title="삭제">
        <Trash2 className="size-3.5" />
      </SidebarMenuAction>
    </SidebarMenuItem>
  );
}

function LessonFolderTreeNode({
  folder, depth, childrenOf, expanded, onToggleExpand, activeFolder, onSelect, onAddChild, onDelete, onColorChange,
  editingFolderId, folderName, setFolderName, onStartRename, onSaveRename, countIn, dragOverId, setDragOverId, onDrop,
}: {
  folder: LessonFolder;
  depth: number;
  childrenOf: (parentId: string | null) => LessonFolder[];
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  activeFolder: string;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string, name: string) => void;
  onDelete: (id: string) => void;
  onColorChange: (id: string, color: string) => void;
  editingFolderId: string | null;
  folderName: string;
  setFolderName: (v: string) => void;
  onStartRename: (id: string, name: string) => void;
  onSaveRename: (id: string) => void;
  countIn: (fid: string | null) => number;
  dragOverId: string | null;
  setDragOverId: (v: string | null | ((prev: string | null) => string | null)) => void;
  onDrop: (folderId: string, e: React.DragEvent) => void;
}) {
  const kids = childrenOf(folder.id);
  const isExpanded = expanded.has(folder.id);
  const editing = editingFolderId === folder.id;
  const { isMobile, setOpenMobile } = useSidebar();

  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");

  function submitCreate() {
    const name = draftName.trim();
    setCreating(false);
    setDraftName("");
    if (name) onAddChild(folder.id, name);
  }

  return (
    <>
    <SidebarMenuItem>
      {editing ? (
        <div style={depth > 0 ? { paddingLeft: depth * 14 } : undefined} className="flex items-center gap-2 rounded-md p-2">
          <FolderColorSwatch color={folder.color} onChange={(color) => onColorChange(folder.id, color)} />
          <Input
            autoFocus
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSaveRename(folder.id)}
            className="h-6 flex-1"
          />
          <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={() => onSaveRename(folder.id)} title="저장">
            <Check className="size-3.5" />
          </Button>
        </div>
      ) : (
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
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); onToggleExpand(folder.id); }}
              className="size-5 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden"
            >
              {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </Button>
          ) : depth > 0 ? (
            <span className="w-3.5 shrink-0 group-data-[collapsible=icon]:hidden" />
          ) : null}
          <FolderColorSwatch color={folder.color} onChange={(color) => onColorChange(folder.id, color)} />
          <span className="flex-1 truncate font-medium group-data-[collapsible=icon]:hidden">{folder.name || "(이름 없음)"}</span>
          <span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">{countIn(folder.id)}</span>
        </div>
      )}
      {!editing && (
        <>
          <SidebarMenuAction
            showOnHover
            className="right-[52px]"
            onClick={() => onStartRename(folder.id, folder.name)}
            title="이름 수정"
          >
            <Pencil className="size-3.5" />
          </SidebarMenuAction>
          <SidebarMenuAction showOnHover className="right-7" onClick={() => setCreating(true)} title="하위 폴더 추가">
            <FolderPlus className="size-3.5" />
          </SidebarMenuAction>
          <SidebarMenuAction showOnHover onClick={() => onDelete(folder.id)} title="폴더 삭제">
            <Trash2 className="size-3.5" />
          </SidebarMenuAction>
        </>
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
      <LessonFolderTreeNode
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
        editingFolderId={editingFolderId}
        folderName={folderName}
        setFolderName={setFolderName}
        onStartRename={onStartRename}
        onSaveRename={onSaveRename}
        countIn={countIn}
        dragOverId={dragOverId}
        setDragOverId={setDragOverId}
        onDrop={onDrop}
      />
    ))}
    </>
  );
}
