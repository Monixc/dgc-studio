import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  FileText,
  GitCompare,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import AppShell, { STUDENT_MENU } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useConfirm } from "@/hooks/use-confirm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuAction, SidebarInset, SidebarTrigger, SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCreatePortfolioDocument,
  useDeletePortfolioDocument,
  usePortfolioComments,
  usePortfolioDocuments,
  usePortfolioSubmissions,
  useSubmitPortfolioDocument,
} from "@/hooks/usePortfolio";
import { usePortfolioRealtime } from "@/hooks/usePortfolioRealtime";
import { useSubmissionFeedbackRealtime } from "@/hooks/useSubmissionFeedbackRealtime";
import { getPortfolioAssetSignedUrl } from "@/lib/portfolio";
import { listMyAllSubmissionFeedback, type MyProblemFeedbackItem } from "@/lib/studentManagement";
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
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "알 수 없는 오류가 발생했습니다.";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function StudentPortfolio() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const documentsQuery = usePortfolioDocuments();
  const { data: submissions = [] } = usePortfolioSubmissions();
  const createDocument = useCreatePortfolioDocument();
  const deleteDocument = useDeletePortfolioDocument();
  const submitDocument = useSubmitPortfolioDocument();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  usePortfolioRealtime();
  useSubmissionFeedbackRealtime();
  const problemFeedbackQuery = useQuery({
    queryKey: ["my-submission-feedback", "all", user?.id],
    queryFn: () => listMyAllSubmissionFeedback(user!.id),
    enabled: !!user,
  });

  const [mobileDocOpen, setMobileDocOpen] = useState(false);
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
      navigate(`/student/portfolio/${created.id}/edit`, { state: { isNew: true } });
    } catch (error) {
      toast.error(`포트폴리오를 만들지 못했습니다: ${errorMessage(error)}`);
    }
  };

  const removeDocument = async (document: StoredDocument) => {
    if (submissions.some((item) => item.document_id === document.id)) return;
    if (!(await confirm({
      title: "포트폴리오 삭제",
      description: `"${document.title || "제목 없음"}" 포트폴리오를 삭제하시겠습니까?`,
      confirmText: "삭제",
      destructive: true,
    }))) return;
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
    if (!(await confirm({
      title: "포트폴리오 제출",
      description: `현재 저장된 내용을 v${nextVersion}으로 제출하시겠습니까?`,
      confirmText: "제출",
    }))) return;
    try {
      const submitted = await submitDocument.mutateAsync({
        documentId: draft.id,
        expectedRevision: draft.revision,
      });
      void notifyPush("portfolio_submitted", submitted.id);
      setSelectedSubmissionId(submitted.id);
      toast.success(`v${submitted.version}으로 제출했습니다.`);
    } catch (error) {
      console.error("portfolio submit failed", error);
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

  function renderDocumentRow(item: StoredDocument, opts?: { alwaysShowActions?: boolean; onAfterSelect?: () => void }) {
    const active = item.id === selectedDocumentId;
    const subCount = submissionCountByDoc.get(item.id) ?? 0;
    const submitted = subCount > 0;
    const actionCls = opts?.alwaysShowActions ? "" : "opacity-0 transition group-hover:opacity-100";
    return (
      <div
        key={item.id}
        className={cn(
          "group flex items-center gap-1 rounded-md pr-1 transition hover:bg-accent",
          active && "bg-accent",
        )}
      >
        <Button
          variant="ghost"
          onClick={() => { selectDocument(item); opts?.onAfterSelect?.(); }}
          className="h-auto min-w-0 flex-1 flex-col items-stretch justify-start gap-0 p-2 text-left text-sm font-normal"
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
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="편집"
          onClick={() => navigate(`/student/portfolio/${item.id}/edit`)}
          className={cn("size-6", actionCls)}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title={submitted ? "제출 이력이 있어 삭제할 수 없습니다." : "삭제"}
          disabled={submitted || deleteDocument.isPending}
          onClick={() => removeDocument(item)}
          className={cn("size-6 disabled:opacity-20", actionCls)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    );
  }

  function renderSidebarDocumentRow(item: StoredDocument) {
    const active = item.id === selectedDocumentId;
    const subCount = submissionCountByDoc.get(item.id) ?? 0;
    const submitted = subCount > 0;
    return (
      <DocumentMenuItem
        key={item.id}
        item={item}
        active={active}
        submitted={submitted}
        subCount={subCount}
        onSelect={() => selectDocument(item)}
        onEdit={() => navigate(`/student/portfolio/${item.id}/edit`)}
        onDelete={() => removeDocument(item)}
        deletePending={deleteDocument.isPending}
      />
    );
  }

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
        <Card className="m-3 border-destructive/40 text-destructive">
          <CardContent className="pt-6">
            포트폴리오를 불러오지 못했습니다: {errorMessage(documentsQuery.error)}
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const viewerContent = (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          {!draft ? (
            <div className="flex min-h-80 items-center justify-center text-sm text-muted-foreground">
              읽을 포트폴리오를 선택해 주세요.
            </div>
          ) : (
            <>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-2xl font-bold tracking-tight">{draft.title || "제목 없음"}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={selectedSubmissionId ?? ""}
                    onChange={(event) => setSelectedSubmissionId(event.target.value || null)}
                    aria-label="버전 선택"
                    className="h-8 w-auto border-0 bg-muted pl-2 pr-8 text-xs text-muted-foreground"
                  >
                    {!currentRevisionSubmission && (
                      <option value="">문서 (미제출)</option>
                    )}
                    {documentSubmissions.map((item) => (
                      <option key={item.id} value={item.id}>
                        v{item.version} · {formatDate(item.submitted_at)}
                      </option>
                    ))}
                  </Select>
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
  );

  return (
    <AppShell menu={STUDENT_MENU} homePath="/student">
      <Tabs defaultValue="notes" className="flex h-full flex-col overflow-hidden">
        {isMobile && (
          <TabsList className="m-2 w-fit shrink-0 self-start">
            <TabsTrigger value="problems">문제 첨삭</TabsTrigger>
            <TabsTrigger value="notes">노트 첨삭</TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="problems" className="min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden">
          <ProblemFeedbackList
            items={problemFeedbackQuery.data ?? []}
            isLoading={problemFeedbackQuery.isLoading}
            onOpen={(problemId) => navigate(`/solve/${problemId}`)}
          />
        </TabsContent>

        <TabsContent value="notes" className="min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
          {isMobile ? (
            <div className="flex h-full flex-col">
              <div className="relative border-b bg-muted/20 p-2">
                <div className="flex items-center gap-1">
                  <Popover open={mobileDocOpen} onOpenChange={setMobileDocOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex flex-1 items-center gap-2 justify-start font-normal"
                      >
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate text-left">{selectedDocument?.title || "내 노트"}</span>
                        <ChevronDown className={cn("size-4 shrink-0 transition-transform", mobileDocOpen && "rotate-180")} />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[calc(100vw-2rem)] max-h-[60vh] overflow-auto p-1">
                      {documents.length ? (
                        documents.map((item) => renderDocumentRow(item, { alwaysShowActions: true, onAfterSelect: () => setMobileDocOpen(false) }))
                      ) : (
                        <p className="p-4 text-center text-sm text-muted-foreground">
                          새 포트폴리오를 만들어 보세요.
                        </p>
                      )}
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={createNewDocument}
                    disabled={createDocument.isPending}
                    title="문서 작성"
                    className="shrink-0"
                  >
                    {createDocument.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  </Button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">{viewerContent}</div>
            </div>
          ) : (
            <SidebarProvider className="h-full min-h-0 items-stretch">
              <Sidebar collapsible="icon" className="border-r">
                <SidebarHeader className="flex-row items-center gap-1 border-b group-data-[collapsible=icon]:justify-center">
                  <span className="whitespace-nowrap text-sm font-semibold group-data-[collapsible=icon]:hidden">내 노트</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={createNewDocument}
                    disabled={createDocument.isPending}
                    title="문서 작성"
                    className="ml-auto size-7 group-data-[collapsible=icon]:ml-0"
                  >
                    {createDocument.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  </Button>
                </SidebarHeader>
                <SidebarContent>
                  <SidebarGroup>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {documents.length ? (
                          documents.map((item) => renderSidebarDocumentRow(item))
                        ) : (
                          <p className="p-2 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
                            "문서 작성"으로 시작하세요.
                          </p>
                        )}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                </SidebarContent>
              </Sidebar>
              <SidebarRail />

              <SidebarInset className="min-w-0">
                <SidebarTrigger className="m-2 shrink-0" />
                <div className="min-h-0 flex-1">{viewerContent}</div>
              </SidebarInset>
            </SidebarProvider>
          )}
        </TabsContent>
      </Tabs>
      {confirmDialog}
    </AppShell>
  );
}

function DocumentMenuItem({
  item, active, submitted, subCount, onSelect, onEdit, onDelete, deletePending,
}: {
  item: StoredDocument;
  active: boolean;
  submitted: boolean;
  subCount: number;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deletePending: boolean;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        tooltip={item.title || "제목 없음"}
        className="h-auto py-2"
        onClick={() => {
          onSelect();
          if (isMobile) setOpenMobile(false);
        }}
      >
        <FileText className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
          <span className="flex items-center gap-1.5">
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
        </span>
      </SidebarMenuButton>
      <SidebarMenuAction showOnHover className="right-7" onClick={onEdit} title="편집">
        <Pencil className="size-3.5" />
      </SidebarMenuAction>
      <SidebarMenuAction
        showOnHover
        onClick={onDelete}
        disabled={submitted || deletePending}
        title={submitted ? "제출 이력이 있어 삭제할 수 없습니다." : "삭제"}
        className="disabled:pointer-events-none disabled:opacity-20"
      >
        <Trash2 className="size-3.5" />
      </SidebarMenuAction>
    </SidebarMenuItem>
  );
}

function ProblemFeedbackList({
  items,
  isLoading,
  onOpen,
}: {
  items: MyProblemFeedbackItem[];
  isLoading: boolean;
  onOpen: (problemId: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> 불러오는 중…
      </div>
    );
  }
  if (!items.length) {
    return (
      <div className="flex h-40 items-center justify-center text-center text-sm text-muted-foreground">
        아직 받은 문제 첨삭이 없습니다.
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-2xl space-y-3 p-4">
      {items.map((item) => (
        <Button
          key={item.id}
          variant="outline"
          onClick={() => onOpen(item.problemId)}
          className="h-auto w-full flex-col items-stretch justify-start p-3 text-left text-sm font-normal"
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="truncate font-medium">{item.problemTitle}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{formatDate(item.createdAt)}</span>
          </div>
          <p className="whitespace-pre-wrap text-muted-foreground">{item.body}</p>
        </Button>
      ))}
    </div>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDiff((value) => !value)}
            className={cn(showDiff && "bg-primary text-primary-foreground hover:bg-primary")}
          >
            <GitCompare className="size-3.5" /> v{previousSubmission.version} 비교
          </Button>
        )}
      </div>
      {showDiff && previousSubmission ? (
        <Card className="overflow-x-auto bg-muted/30 font-mono text-xs">
          <CardContent className="p-3">
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
          </CardContent>
        </Card>
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
