import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  GitCompare,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import AppShell, { STUDENT_MENU } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  useCreatePortfolioDocument,
  useDeletePortfolioDocument,
  usePortfolioComments,
  usePortfolioDocuments,
  usePortfolioSubmissions,
  useSubmitPortfolioDocument,
} from "@/hooks/usePortfolio";
import { usePortfolioRealtime } from "@/hooks/usePortfolioRealtime";
import { getPortfolioAssetSignedUrl } from "@/lib/portfolio";
import { notifyPush } from "@/lib/push";
import { diffLines } from "@/lib/textDiff";
import { cn } from "@/lib/utils";
import { PortfolioViewer } from "@/features/portfolio/PortfolioViewer";
import type { PortfolioDocument as EditorDocument } from "@/features/portfolio/portfolio";
import type {
  JsonValue,
  PortfolioDocument as StoredDocument,
  PortfolioSubmission,
} from "@/integrations/supabase/types";

interface Draft {
  id: string;
  title: string;
  content: EditorDocument;
  revision: number;
}

function toEditorDocument(value: JsonValue): EditorDocument {
  return value as EditorDocument;
}

function toDraft(document: StoredDocument): Draft {
  return {
    id: document.id,
    title: document.title,
    content: toEditorDocument(document.content_json),
    revision: document.revision,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function StudentPortfolio() {
  const documentsQuery = usePortfolioDocuments();
  const { data: submissions = [] } = usePortfolioSubmissions();
  const createDocument = useCreatePortfolioDocument();
  const deleteDocument = useDeletePortfolioDocument();
  const submitDocument = useSubmitPortfolioDocument();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  usePortfolioRealtime();

  const listPanelRef = useRef<ImperativePanelHandle>(null);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const documents = useMemo(() => documentsQuery.data ?? [], [documentsQuery.data]);
  const submissionCountByDoc = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of submissions) map.set(item.document_id, (map.get(item.document_id) ?? 0) + 1);
    return map;
  }, [submissions]);
  const selectedDocument = documents.find((item) => item.id === selectedDocumentId) ?? null;
  const documentSubmissions = useMemo(
    () => submissions.filter((item) => item.document_id === selectedDocumentId),
    [selectedDocumentId, submissions],
  );
  const currentRevisionSubmission = selectedDocument
    ? documentSubmissions.find((item) => item.source_revision === selectedDocument.revision) ?? null
    : null;
  const selectedSubmission =
    documentSubmissions.find((item) => item.id === selectedSubmissionId) ?? null;
  const previousSubmission = selectedSubmission
    ? documentSubmissions.find((item) => item.version === selectedSubmission.version - 1) ?? null
    : null;
  const { data: comments = [], isLoading: commentsLoading } = usePortfolioComments(
    selectedSubmission?.id ?? null,
  );

  useEffect(() => {
    const requestedId = searchParams.get("document");
    if (requestedId && documents.some((item) => item.id === requestedId)) {
      if (selectedDocumentId !== requestedId) setSelectedDocumentId(requestedId);
      return;
    }
    if (!selectedDocumentId && documents.length) setSelectedDocumentId(documents[0].id);
    if (selectedDocumentId && !documents.some((item) => item.id === selectedDocumentId)) {
      setSelectedDocumentId(documents[0]?.id ?? null);
    }
  }, [documents, searchParams, selectedDocumentId]);

  useEffect(() => {
    setDraft(selectedDocument ? toDraft(selectedDocument) : null);
  }, [selectedDocument]);

  useEffect(() => {
    const requestedSubmissionId = searchParams.get("submission");
    if (requestedSubmissionId && documentSubmissions.some((item) => item.id === requestedSubmissionId)) {
      setSelectedSubmissionId(requestedSubmissionId);
      return;
    }
    setSelectedSubmissionId(currentRevisionSubmission?.id ?? null);
  }, [currentRevisionSubmission?.id, selectedDocumentId, searchParams, documentSubmissions]);

  const resolveAssetUrl = useCallback(
    (assetId: string) => getPortfolioAssetSignedUrl(assetId),
    [],
  );

  const toggleListPanel = () => {
    if (listCollapsed) listPanelRef.current?.expand();
    else listPanelRef.current?.collapse();
  };

  const selectDocument = (document: StoredDocument) => {
    setSelectedDocumentId(document.id);
    setDraft(toDraft(document));
    setSearchParams({ document: document.id });
  };

  const createNewDocument = async () => {
    try {
      const created = await createDocument.mutateAsync({
        title: "제목 없는 포트폴리오",
        contentJson: { type: "doc", content: [{ type: "paragraph" }] } as JsonValue,
        contentText: "",
      });
      toast.success("새 포트폴리오를 만들었습니다.");
      navigate(`/student/portfolio/${created.id}/edit`);
    } catch (error) {
      toast.error(`포트폴리오를 만들지 못했습니다: ${errorMessage(error)}`);
    }
  };

  const removeDocument = async (document: StoredDocument) => {
    if (submissions.some((item) => item.document_id === document.id)) return;
    if (!window.confirm(`"${document.title || "제목 없음"}" 포트폴리오를 삭제하시겠습니까?`)) return;
    try {
      await deleteDocument.mutateAsync(document.id);
      if (selectedDocumentId === document.id) {
        setSelectedDocumentId(null);
        setDraft(null);
        setSearchParams({});
      }
      toast.success("포트폴리오를 삭제했습니다.");
    } catch (error) {
      toast.error(`삭제하지 못했습니다: ${errorMessage(error)}`);
    }
  };

  const submitDraft = async () => {
    if (!draft) return;
    const nextVersion = (submissionCountByDoc.get(draft.id) ?? 0) + 1;
    if (!window.confirm(`현재 저장된 내용을 v${nextVersion}으로 제출하시겠습니까?`)) return;
    try {
      const submitted = await submitDocument.mutateAsync({
        documentId: draft.id,
        expectedRevision: draft.revision,
      });
      void notifyPush("portfolio_submitted", submitted.id);
      setSelectedSubmissionId(submitted.id);
      toast.success(`v${submitted.version}으로 제출했습니다.`);
    } catch (error) {
      toast.error(`제출하지 못했습니다: ${errorMessage(error)}`);
    }
  };

  const commentRanges = comments
    .filter(
      (comment) =>
        comment.anchor_type === "range" &&
        comment.start_position !== null &&
        comment.end_position !== null,
    )
    .map((comment) => ({ from: comment.start_position!, to: comment.end_position! }));

  if (documentsQuery.isLoading) {
    return (
      <AppShell menu={STUDENT_MENU} homePath="/student">
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 animate-spin" /> 불러오는 중…
        </div>
      </AppShell>
    );
  }

  if (documentsQuery.isError) {
    return (
      <AppShell menu={STUDENT_MENU} homePath="/student">
        <div className="m-3 rounded-xl border border-destructive/40 p-6 text-destructive">
          포트폴리오를 불러오지 못했습니다: {errorMessage(documentsQuery.error)}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell menu={STUDENT_MENU} homePath="/student">
      <ResizablePanelGroup direction="horizontal" className="h-full overflow-hidden">
        <ResizablePanel
          ref={listPanelRef}
          defaultSize={20}
          minSize={14}
          maxSize={35}
          collapsible
          collapsedSize={4}
          onCollapse={() => setListCollapsed(true)}
          onExpand={() => setListCollapsed(false)}
          className="flex h-full flex-col bg-muted/20"
        >
          {listCollapsed ? (
            <div className="flex flex-col items-center gap-1 py-2">
              {documents.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectDocument(item)}
                  title={item.title || "제목 없음"}
                  className={cn(
                    "rounded p-1.5",
                    item.id === selectedDocumentId ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                  )}
                >
                  <FileText className="size-4" />
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1 border-b px-3 py-2">
                <span className="text-sm font-semibold">내 노트</span>
                <button
                  type="button"
                  onClick={createNewDocument}
                  disabled={createDocument.isPending}
                  title="문서 작성"
                  className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  {createDocument.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                </button>
              </div>
              <div className="flex-1 space-y-1 overflow-y-auto p-2">
                {documents.length ? (
                  documents.map((item) => {
                    const active = item.id === selectedDocumentId;
                    const subCount = submissionCountByDoc.get(item.id) ?? 0;
                    const submitted = subCount > 0;
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "group flex items-center gap-1 rounded-md pr-1 transition hover:bg-accent",
                          active && "bg-accent",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => selectDocument(item)}
                          className="min-w-0 flex-1 p-2 text-left text-sm"
                        >
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span
                              className={cn(
                                "size-1.5 shrink-0 rounded-full",
                                submitted ? "bg-emerald-500" : "bg-muted-foreground/30",
                              )}
                              title={submitted ? `제출됨 · v${subCount}` : "미제출"}
                            />
                            <span className="truncate font-medium">{item.title || "제목 없음"}</span>
                          </span>
                          <span className="mt-0.5 block truncate pl-3 text-xs text-muted-foreground">
                            {formatDate(item.updated_at)}
                            {submitted && ` · 제출 v${subCount}`}
                          </span>
                        </button>
                        <button
                          type="button"
                          title="편집"
                          onClick={() => navigate(`/student/portfolio/${item.id}/edit`)}
                          className="rounded p-1 opacity-0 transition hover:bg-black/10 group-hover:opacity-100"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          title={submitted ? "제출 이력이 있어 삭제할 수 없습니다." : "삭제"}
                          disabled={submitted || deleteDocument.isPending}
                          onClick={() => removeDocument(item)}
                          className="rounded p-1 opacity-0 transition hover:bg-black/10 disabled:opacity-20 group-hover:opacity-100"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    새 포트폴리오를 만들어 보세요.
                  </p>
                )}
              </div>
            </>
          )}
        </ResizablePanel>

        <ResizableHandle onToggle={toggleListPanel} collapsed={listCollapsed} />

        <ResizablePanel defaultSize={80} className="min-w-0">
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
                {!draft ? (
                  <div className="flex min-h-80 items-center justify-center text-sm text-muted-foreground">
                    읽을 포트폴리오를 선택해 주세요.
                  </div>
                ) : (
                  <>
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-2xl font-bold tracking-tight">{draft.title || "제목 없음"}</h2>
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedSubmissionId ?? ""}
                          onChange={(event) => setSelectedSubmissionId(event.target.value || null)}
                          aria-label="버전 선택"
                          className="h-8 rounded-md border-0 bg-muted px-2 text-xs text-muted-foreground"
                        >
                          {!currentRevisionSubmission && (
                            <option value="">초안 (미제출)</option>
                          )}
                          {documentSubmissions.map((item) => (
                            <option key={item.id} value={item.id}>
                              v{item.version} · {formatDate(item.submitted_at)}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/student/portfolio/${draft.id}/edit`)}
                        >
                          <Pencil /> 편집
                        </Button>
                        <Button size="sm" onClick={() => void submitDraft()} disabled={submitDocument.isPending}>
                          <Send /> 제출
                        </Button>
                      </div>
                    </div>
                    {selectedSubmission ? (
                      <SubmissionView
                        submission={selectedSubmission}
                        previousSubmission={previousSubmission}
                        commentRanges={commentRanges}
                        resolveAssetUrl={resolveAssetUrl}
                      />
                    ) : (
                      <PortfolioViewer
                        value={draft.content}
                        resolveAssetUrl={resolveAssetUrl}
                        className="min-h-80"
                      />
                    )}
                  </>
                )}
              </div>
            </div>
            {selectedSubmission && (comments?.length ?? 0) > 0 && (
              <div className="h-56 shrink-0 overflow-y-auto border-t bg-muted/20">
                <div className="sticky top-0 flex items-center gap-2 border-b bg-muted/20 px-4 py-2 text-sm font-semibold backdrop-blur">
                  <MessageSquare className="size-4" /> 선생님 피드백
                </div>
                <div className="mx-auto max-w-3xl space-y-3 p-4">
                  {comments!.map((comment) => (
                    <article key={comment.id} className="rounded-lg border bg-background p-3 text-sm">
                      {comment.anchor_type === "asset" && (
                        <p className="mb-1 text-xs font-semibold text-primary">
                          {comment.asset_index ? `이미지 #${comment.asset_index}` : "이미지 피드백"}
                        </p>
                      )}
                      {comment.quoted_text && (
                        <blockquote className="mb-2 border-l-2 border-primary pl-2 text-xs text-muted-foreground">
                          “{comment.quoted_text}”
                        </blockquote>
                      )}
                      <p className="whitespace-pre-wrap">{comment.body}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{formatDate(comment.created_at)}</p>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

    </AppShell>
  );
}

function SubmissionView({
  submission,
  previousSubmission,
  commentRanges,
  resolveAssetUrl,
}: {
  submission: PortfolioSubmission;
  previousSubmission: PortfolioSubmission | null;
  commentRanges: { from: number; to: number }[];
  resolveAssetUrl: (assetId: string) => Promise<string | null>;
}) {
  const [showDiff, setShowDiff] = useState(false);

  useEffect(() => {
    setShowDiff(false);
  }, [submission.id]);

  const diff = useMemo(
    () => (previousSubmission ? diffLines(previousSubmission.content_text, submission.content_text) : []),
    [previousSubmission, submission.content_text],
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          제출 v{submission.version} · {formatDate(submission.submitted_at)}
        </p>
        {previousSubmission && (
          <button
            type="button"
            onClick={() => setShowDiff((value) => !value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition",
              showDiff ? "bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            <GitCompare className="size-3.5" /> v{previousSubmission.version} 비교
          </button>
        )}
      </div>
      {showDiff && previousSubmission ? (
        <div className="overflow-x-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs">
          <p className="mb-2 font-sans text-muted-foreground">
            v{previousSubmission.version} → v{submission.version} 변경분
          </p>
          {diff.map((op, index) => (
            <div
              key={index}
              className={cn(
                "whitespace-pre-wrap px-2",
                op.type === "add" && "bg-green-500/15 text-green-700 dark:text-green-400",
                op.type === "remove" && "bg-red-500/15 text-red-700 line-through dark:text-red-400",
                op.type === "same" && "text-muted-foreground",
              )}
            >
              {op.type === "add" ? "+ " : op.type === "remove" ? "− " : "  "}
              {op.text || " "}
            </div>
          ))}
        </div>
      ) : (
        <PortfolioViewer
          value={toEditorDocument(submission.content_json)}
          resolveAssetUrl={resolveAssetUrl}
          commentRanges={commentRanges}
        />
      )}
    </div>
  );
}
