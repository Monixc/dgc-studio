import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Upload, Trash2, FileText, FileCode, Code2, Eye, Pencil, Folder, FolderPlus, Check, ClipboardList, X } from "lucide-react";
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
import { useMyProblems } from "@/hooks/useProblems";
import AssignProblemsDialog from "@/components/admin/AssignProblemsDialog";
import {
  useLessonFolders,
  useCreateLessonFolder,
  useRenameLessonFolder,
  useDeleteLessonFolder,
} from "@/hooks/useLessonFolders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupAction,
  SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuAction, SidebarInset,
  SidebarTrigger, SidebarRail, SidebarSeparator, useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/Markdown";
import { cn } from "@/lib/utils";
import type { Lesson } from "@/integrations/supabase/types";

const ALL = "__all__";
const NONE = "__none__";

interface Draft {
  title: string;
  content: string;
  code_practice: boolean;
  starter_code: string;
  folder_id: string | null;
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
  const deleteFolderMut = useDeleteLessonFolder();
  const { data: myProblems = [] } = useMyProblems(userId);
  const setLessonProbsMut = useSetLessonProblems();

  const [activeFolder, setActiveFolder] = useState<string>(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState("");
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [attachOpen, setAttachOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // true면 현재 교안의 파일 교체, false면 새 교안 생성
  const replaceRef = useRef(false);

  const selected = lessons.find((l) => l.id === selectedId) ?? null;
  const { data: attachedIds = [] } = useLessonProblemIds(selected?.id);
  const attachedProblems = attachedIds
    .map((id) => myProblems.find((p) => p.id === id))
    .filter(Boolean) as typeof myProblems;

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
      (draft.folder_id ?? null) !== (selected.folder_id ?? null));

  const newFolderId = activeFolder === ALL || activeFolder === NONE ? null : activeFolder;
  const filtered = lessons.filter((l) =>
    activeFolder === ALL ? true : activeFolder === NONE ? !l.folder_id : l.folder_id === activeFolder,
  );

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

  async function removeFolder(id: string) {
    if (!(await confirm({ description: "폴더를 삭제할까요? 안의 교안은 ‘미분류’로 이동합니다.", destructive: true }))) return;
    try {
      await deleteFolderMut.mutateAsync(id);
      if (activeFolder === id) setActiveFolder(ALL);
    } catch (e: any) {
      toast.error(e?.message ?? "삭제 실패");
    }
  }

  const countIn = (fid: string | null) =>
    fid === null ? lessons.filter((l) => !l.folder_id).length : lessons.filter((l) => l.folder_id === fid).length;

  function folderRow(id: string, label: string, count: number, opts?: { folder?: boolean }) {
    const editing = editingFolderId === id;
    return (
      <SidebarMenuItem key={id}>
        {editing ? (
          <div className="flex items-center gap-2 rounded-md p-2">
            <Folder className="size-4 shrink-0 text-muted-foreground" />
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
        ) : (
          <>
            <SidebarMenuButton isActive={activeFolder === id} onClick={() => setActiveFolder(id)} tooltip={label}>
              <Folder />
              <span className="flex-1 truncate">{label}</span>
              <span className="text-xs text-muted-foreground">{count}</span>
            </SidebarMenuButton>
            {opts?.folder && (
              <>
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
            )}
          </>
        )}
      </SidebarMenuItem>
    );
  }

  return (
    <>
    <SidebarProvider className="h-full min-h-0 items-stretch">
      <Sidebar collapsible="icon" className="border-r">
        <SidebarHeader className="border-b group-data-[collapsible=icon]:items-center">
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold group-data-[collapsible=icon]:hidden">교안</span>
          </div>
          <div className="flex flex-wrap gap-1 group-data-[collapsible=icon]:hidden">
            <Button size="sm" variant="outline" onClick={createMd} disabled={createMut.isPending}>
              <Plus className="size-4" /> MD
            </Button>
            <Button size="sm" variant="outline" onClick={() => { replaceRef.current = false; fileRef.current?.click(); }} disabled={createMut.isPending}>
              <Upload className="size-4" /> HTML
            </Button>
          </div>
          <Input ref={fileRef} type="file" accept=".html,.htm,text/html" className="hidden" onChange={onFilePicked} />
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>폴더</SidebarGroupLabel>
            <SidebarGroupAction onClick={addFolder} title="새 폴더">
              <FolderPlus />
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu>
                {folderRow(ALL, "전체", lessons.length)}
                {folders.map((f) => folderRow(f.id, f.name || "(이름 없음)", countIn(f.id), { folder: true }))}
                {folderRow(NONE, "미분류", countIn(null))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {isLoading ? (
                  <p className="p-2 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">불러오는 중…</p>
                ) : filtered.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">교안이 없습니다.</p>
                ) : (
                  filtered.map((l) => (
                    <LessonMenuItem key={l.id} lesson={l} isActive={selectedId === l.id} onSelect={setSelectedId} onDelete={remove} />
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
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
          왼쪽에서 교안을 선택하거나 새로 만드세요.
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
              className="h-9 w-auto"
              value={draft.folder_id ?? ""}
              onChange={(e) => setDraft({ ...draft, folder_id: e.target.value || null })}
              title="폴더"
            >
              <option value="">미분류</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name || "(이름 없음)"}</option>
              ))}
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
                      <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                        미발행 — 학생이 못 봄
                      </span>
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
  lesson, isActive, onSelect, onDelete,
}: {
  lesson: Lesson;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        tooltip={lesson.title || "(제목 없음)"}
        onClick={() => {
          onSelect(lesson.id);
          if (isMobile) setOpenMobile(false);
        }}
      >
        {lesson.content_type === "html" ? <FileCode /> : <FileText />}
        <span className="flex-1 truncate">{lesson.title || "(제목 없음)"}</span>
        {lesson.code_practice && <Code2 className="size-3.5 shrink-0 text-primary" />}
      </SidebarMenuButton>
      <SidebarMenuAction showOnHover onClick={() => onDelete(lesson.id)} title="삭제">
        <Trash2 className="size-3.5" />
      </SidebarMenuAction>
    </SidebarMenuItem>
  );
}
