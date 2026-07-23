import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Upload, Trash2, FileText, FileCode, Code2, Eye, Pencil, Folder, FolderPlus, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  useLessons,
  useCreateLesson,
  useUpdateLesson,
  useDeleteLesson,
} from "@/hooks/useLessons";
import {
  useLessonFolders,
  useCreateLessonFolder,
  useRenameLessonFolder,
  useDeleteLessonFolder,
} from "@/hooks/useLessonFolders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const [activeFolder, setActiveFolder] = useState<string>(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = lessons.find((l) => l.id === selectedId) ?? null;

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
    if (!file) return;
    const text = await file.text();
    // 파일 교체: 이미 선택된 HTML 교안이 있으면 그 내용만 바꿈
    if (selected?.content_type === "html" && draft) {
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
    if (!confirm("이 교안을 삭제할까요? 반 배정도 함께 해제됩니다.")) return;
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
    if (!confirm("폴더를 삭제할까요? 안의 교안은 ‘미분류’로 이동합니다.")) return;
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
      <div
        key={id}
        onClick={() => setActiveFolder(id)}
        className={cn(
          "group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
          activeFolder === id && "bg-accent font-medium",
        )}
      >
        <Folder className="size-4 shrink-0 text-muted-foreground" />
        {editing ? (
          <Input
            autoFocus
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveFolderName(id)}
            onClick={(e) => e.stopPropagation()}
            className="h-6 flex-1"
          />
        ) : (
          <span className="flex-1 truncate">{label}</span>
        )}
        {!editing && <span className="text-xs text-muted-foreground">{count}</span>}
        {opts?.folder &&
          (editing ? (
            <button onClick={(e) => { e.stopPropagation(); saveFolderName(id); }} title="저장">
              <Check className="size-3.5" />
            </button>
          ) : (
            <>
              <button
                className="opacity-0 group-hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); setEditingFolderId(id); setFolderName(label); }}
                title="이름 수정"
              >
                <Pencil className="size-3.5 text-muted-foreground hover:text-foreground" />
              </button>
              <button
                className="opacity-0 group-hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); removeFolder(id); }}
                title="폴더 삭제"
              >
                <Trash2 className="size-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            </>
          ))}
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* 사이드바: 폴더 + 교안 목록 */}
      <aside className="flex w-64 shrink-0 flex-col border-r bg-muted/20">
        <div className="flex flex-wrap items-center gap-1 border-b p-2">
          <span className="mr-auto text-sm font-semibold">교안</span>
          <Button size="sm" variant="outline" onClick={createMd} disabled={createMut.isPending}>
            <Plus className="size-4" /> MD
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={createMut.isPending}>
            <Upload className="size-4" /> HTML
          </Button>
          <input ref={fileRef} type="file" accept=".html,.htm,text/html" className="hidden" onChange={onFilePicked} />
        </div>

        {/* 폴더 */}
        <div className="border-b p-1">
          <div className="flex items-center px-2 py-1">
            <span className="mr-auto text-xs font-semibold text-muted-foreground">폴더</span>
            <button onClick={addFolder} title="새 폴더" className="text-muted-foreground hover:text-foreground">
              <FolderPlus className="size-4" />
            </button>
          </div>
          {folderRow(ALL, "전체", lessons.length)}
          {folders.map((f) => folderRow(f.id, f.name || "(이름 없음)", countIn(f.id), { folder: true }))}
          {folderRow(NONE, "미분류", countIn(null))}
        </div>

        {/* 교안 목록 */}
        <div className="flex-1 overflow-auto p-1">
          {isLoading ? (
            <p className="p-2 text-sm text-muted-foreground">불러오는 중…</p>
          ) : filtered.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">교안이 없습니다.</p>
          ) : (
            filtered.map((l) => (
              <div
                key={l.id}
                onClick={() => setSelectedId(l.id)}
                className={cn(
                  "group flex cursor-pointer items-center gap-2 rounded-md p-2 text-sm hover:bg-accent",
                  selectedId === l.id && "bg-accent",
                )}
              >
                {l.content_type === "html" ? (
                  <FileCode className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="flex-1 truncate">{l.title || "(제목 없음)"}</span>
                {l.code_practice && <Code2 className="size-3.5 shrink-0 text-primary" />}
                <button
                  className="opacity-0 group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); remove(l.id); }}
                  title="삭제"
                >
                  <Trash2 className="size-4 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

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
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
              {selected.content_type === "html" ? "HTML" : "Markdown"}
            </span>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={draft.folder_id ?? ""}
              onChange={(e) => setDraft({ ...draft, folder_id: e.target.value || null })}
              title="폴더"
            >
              <option value="">미분류</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name || "(이름 없음)"}</option>
              ))}
            </select>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setPreview((p) => !p)}>
                {preview ? <><Pencil className="size-4" /> 편집</> : <><Eye className="size-4" /> 미리보기</>}
              </Button>
              {selected.content_type === "html" && (
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload className="size-4" /> 파일 교체
                </Button>
              )}
              <Button size="sm" onClick={save} disabled={!dirty || updateMut.isPending}>
                저장{dirty ? " *" : ""}
              </Button>
            </div>
          </div>

          <label className="mb-3 flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm">
            <input
              type="checkbox"
              className="size-4"
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
                <iframe title="교안 미리보기" className="h-[60vh] w-full" sandbox="allow-scripts" srcDoc={draft.content} />
              ) : (
                <Markdown>{draft.content}</Markdown>
              )}
            </div>
          ) : (
            <textarea
              className="min-h-[40vh] flex-1 rounded-lg border bg-background p-3 font-mono text-sm"
              value={draft.content}
              onChange={(e) => setDraft({ ...draft, content: e.target.value })}
              placeholder={selected.content_type === "html" ? "HTML 원본…" : "# 마크다운으로 작성"}
              spellCheck={false}
            />
          )}

          {draft.code_practice && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">시작 코드 (선택)</p>
              <textarea
                className="min-h-24 w-full rounded-lg border bg-background p-3 font-mono text-sm"
                value={draft.starter_code}
                onChange={(e) => setDraft({ ...draft, starter_code: e.target.value })}
                placeholder="# 학생 IDE에 미리 채워둘 코드"
                spellCheck={false}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
