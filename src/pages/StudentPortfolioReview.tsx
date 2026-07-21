import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, GitCompare, Loader2, MessageSquarePlus, Send, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Textarea } from "@/components/ui/textarea";
import { PortfolioViewer } from "@/features/portfolio/PortfolioViewer";
import type {
  PortfolioDocument,
  PortfolioSelection,
} from "@/features/portfolio/portfolio";
import {
  useCreatePortfolioComment,
  useDeletePortfolioComment,
  usePortfolioComments,
  usePortfolioSubmissions,
} from "@/hooks/usePortfolio";
import { useAuth } from "@/hooks/useAuth";
import { usePortfolioRealtime } from "@/hooks/usePortfolioRealtime";
import { getPortfolioAssetSignedUrl } from "@/lib/portfolio";
import { notifyPush } from "@/lib/push";
import { diffLines } from "@/lib/textDiff";
import { cn } from "@/lib/utils";

function formatDate(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
}

export default function StudentPortfolioReview() {
  const { studentId, submissionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  usePortfolioRealtime();
  const submissionsQuery = usePortfolioSubmissions({ studentId });
  const submission = submissionsQuery.data?.find((item) => item.id === submissionId) ?? null;
  const versions = useMemo(
    () => (submissionsQuery.data ?? [])
      .filter((item) => item.document_id === submission?.document_id && item.student_id === studentId)
      .sort((a, b) => b.version - a.version),
    [studentId, submission?.document_id, submissionsQuery.data],
  );
  const previousSubmission = versions.find((item) => item.version === (submission?.version ?? 0) - 1) ?? null;
  const diff = useMemo(
    () => submission && previousSubmission
      ? diffLines(previousSubmission.content_text, submission.content_text)
      : [],
    [previousSubmission, submission],
  );
  const commentsQuery = usePortfolioComments(submission?.id ?? null);
  const createComment = useCreatePortfolioComment();
  const deleteComment = useDeletePortfolioComment();
  const [body, setBody] = useState("");
  const [selection, setSelection] = useState<PortfolioSelection | null>(null);
  const [anchorType, setAnchorType] = useState<"document" | "range" | "asset">("document");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedImageNumber, setSelectedImageNumber] = useState<number | null>(null);
  const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  useEffect(() => {
    setBody("");
    setSelection(null);
    setAnchorType("document");
    setSelectedAssetId(null);
    setSelectedImageNumber(null);
    setFocusedCommentId(null);
    setShowDiff(false);
  }, [submissionId]);

  const resolveAssetUrl = useCallback(
    (assetId: string) => getPortfolioAssetSignedUrl(assetId),
    [],
  );

  const selectText = useCallback((next: PortfolioSelection) => {
    if (next.to <= next.from || !next.quotedText.trim()) return;
    setSelection(next);
    setSelectedAssetId(null);
    setSelectedImageNumber(null);
    setAnchorType("range");
  }, []);

  const selectAsset = useCallback((assetId: string, imageNumber: number | null) => {
    setSelection(null);
    setSelectedAssetId(assetId);
    setSelectedImageNumber(imageNumber);
    setAnchorType("asset");
    setFocusedCommentId(null);
  }, []);

  const addComment = async () => {
    if (!submission || !body.trim()) return;
    if (anchorType === "range" && !selection?.quotedText.trim()) {
      toast.error("댓글을 남길 텍스트를 먼저 선택해 주세요.");
      return;
    }
    if (anchorType === "asset" && !selectedAssetId) return;

    try {
      const created = await createComment.mutateAsync({
        submissionId: submission.id,
        input: {
          body: body.trim(),
          anchor: anchorType === "asset" && selectedAssetId
            ? { anchorType: "asset", assetId: selectedAssetId, imageNumber: selectedImageNumber }
            : anchorType === "range" && selection
            ? {
                anchorType: "range",
                startPosition: selection.from,
                endPosition: selection.to,
                startLine: selection.startLine,
                endLine: selection.endLine,
                quotedText: selection.quotedText,
              }
            : { anchorType: "document" },
        },
      });
      void notifyPush("portfolio_feedback", created.id);
      setBody("");
      setSelection(null);
      setAnchorType("document");
      toast.success("피드백을 등록했습니다.");
    } catch (error) {
      toast.error(`피드백을 등록하지 못했습니다. ${errorMessage(error)}`);
    }
  };

  const removeComment = async (commentId: string) => {
    if (!submission || !window.confirm("이 피드백을 삭제하시겠습니까?")) return;
    try {
      await deleteComment.mutateAsync({ commentId, submissionId: submission.id });
      if (focusedCommentId === commentId) setFocusedCommentId(null);
      toast.success("피드백을 삭제했습니다.");
    } catch (error) {
      toast.error(`피드백을 삭제하지 못했습니다. ${errorMessage(error)}`);
    }
  };

  if (submissionsQuery.isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> 포트폴리오를 불러오는 중…
      </div>
    );
  }

  if (submissionsQuery.isError) {
    return (
      <ReviewState
        message={`포트폴리오를 불러오지 못했습니다. ${errorMessage(submissionsQuery.error)}`}
        onBack={() => navigate("/students")}
      />
    );
  }

  if (!studentId || !submissionId || !submission || submission.student_id !== studentId) {
    return <ReviewState message="해당 학생의 제출물을 찾을 수 없습니다." onBack={() => navigate("/students")} />;
  }

  const commentRanges = (commentsQuery.data ?? []).flatMap((comment) =>
    comment.anchor_type === "range"
      && comment.start_position !== null
      && comment.end_position !== null
      ? [{ from: comment.start_position, to: comment.end_position }]
      : [],
  );
  const visibleComments = (commentsQuery.data ?? []).filter((comment) =>
    selectedAssetId
      ? comment.anchor_type === "asset"
        && comment.asset_id === selectedAssetId
        && comment.asset_index === selectedImageNumber
      : true,
  );

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-muted/20">
      <header className="flex shrink-0 items-center gap-2 border-b bg-background p-3">
        <div className="mr-1 flex items-center gap-1.5" aria-label="검토 창">
          <span className="size-3 rounded-full bg-red-500" />
          <span className="size-3 rounded-full bg-yellow-400" />
          <span className="size-3 rounded-full bg-green-500" />
        </div>
        <Button size="icon" variant="ghost" onClick={() => navigate("/students")} title="학생 관리로">
          <ArrowLeft className="size-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{submission.title || "제목 없는 포트폴리오"}</h1>
          <p className="truncate text-xs text-muted-foreground">
            제출 v{submission.version} · {formatDate(submission.submitted_at)}
          </p>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 overflow-auto lg:grid-cols-[11rem_minmax(0,1fr)] lg:overflow-hidden">
        <aside className="border-b bg-background lg:flex lg:min-h-0 lg:flex-col lg:border-b-0 lg:border-r">
          <div className="border-b px-3 py-2 text-xs font-semibold text-muted-foreground">제출 버전</div>
          <div className="flex gap-2 overflow-x-auto p-2 lg:block lg:flex-1 lg:overflow-y-auto">
            {versions.map((version) => (
              <button
                key={version.id}
                type="button"
                onClick={() => navigate(`/students/${studentId}/portfolio/${version.id}`)}
                className={cn(
                  "min-w-36 rounded-md p-2 text-left text-xs lg:mb-1 lg:w-full lg:min-w-0",
                  version.id === submission.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent",
                )}
              >
                <span className="block font-semibold">v{version.version}</span>
                <span className="block opacity-75">{formatDate(version.submitted_at)}</span>
              </button>
            ))}
          </div>
        </aside>

        <ResizablePanelGroup direction="horizontal" className="min-h-0 min-w-0 lg:overflow-hidden">
        <ResizablePanel defaultSize={72} minSize={40} className="min-w-0">
        <main className="h-full min-w-0 overflow-visible p-3 sm:p-5 lg:overflow-y-auto">
          <div className="mx-auto mb-3 flex max-w-4xl justify-end">
            {previousSubmission && (
              <Button
                type="button"
                size="sm"
                variant={showDiff ? "default" : "outline"}
                onClick={() => setShowDiff((value) => !value)}
              >
                <GitCompare className="size-4" />
                v{previousSubmission.version}과 비교
              </Button>
            )}
          </div>
          {showDiff && previousSubmission ? (
            <div className="mx-auto max-w-4xl overflow-x-auto rounded-lg border bg-background p-3 font-mono text-xs">
              <p className="mb-2 font-sans text-muted-foreground">
                v{previousSubmission.version} → v{submission.version} 변경분
              </p>
              {diff.map((operation, index) => (
                <div
                  key={index}
                  className={cn(
                    "whitespace-pre-wrap px-2",
                    operation.type === "add" && "bg-green-500/15 text-green-700 dark:text-green-400",
                    operation.type === "remove" && "bg-red-500/15 text-red-700 line-through dark:text-red-400",
                    operation.type === "same" && "text-muted-foreground",
                  )}
                >
                  {operation.type === "add" ? "+ " : operation.type === "remove" ? "− " : "  "}
                  {operation.text || " "}
                </div>
              ))}
            </div>
          ) : (
            <PortfolioViewer
              value={submission.content_json as PortfolioDocument}
              resolveAssetUrl={resolveAssetUrl}
              onSelectionChange={selectText}
              onAssetClick={selectAsset}
              selectedAssetId={selectedAssetId}
              selectedImageNumber={selectedImageNumber}
              commentRanges={commentRanges}
              className="mx-auto min-h-full max-w-4xl"
            />
          )}
        </main>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={28} minSize={18} maxSize={55} className="min-w-0">
        <aside className="flex h-full min-h-[24rem] flex-col border-t bg-background lg:min-h-0 lg:border-l lg:border-t-0">
          <div className="border-b p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquarePlus className="size-4" /> 교사 피드백
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedAssetId
                ? selectedImageNumber
                  ? `이미지 #${selectedImageNumber}의 피드백만 표시합니다.`
                  : "선택한 이미지의 피드백만 표시합니다."
                : "본문을 드래그하거나 이미지를 누르면 해당 영역에 피드백을 남길 수 있습니다."}
            </p>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {commentsQuery.isLoading ? (
              <p className="text-xs text-muted-foreground">피드백을 불러오는 중…</p>
            ) : commentsQuery.isError ? (
              <p className="text-xs text-destructive">피드백을 불러오지 못했습니다.</p>
            ) : visibleComments.length ? (
              visibleComments.map((comment) => (
                <article
                  key={comment.id}
                  tabIndex={0}
                  onClick={() => setFocusedCommentId(comment.id)}
                  onFocus={() => setFocusedCommentId(comment.id)}
                  className={cn(
                    "cursor-pointer rounded-lg border bg-muted/50 p-3 text-xs outline-none transition",
                    focusedCommentId === comment.id && "border-primary ring-2 ring-primary/20",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-muted-foreground">
                      {comment.anchor_type === "range"
                        ? `${comment.start_line ?? "?"}–${comment.end_line ?? "?"}줄`
                        : comment.anchor_type === "asset"
                          ? comment.asset_index
                            ? `이미지 #${comment.asset_index}`
                            : "선택한 이미지"
                        : "문서 전체"}
                    </span>
                    {comment.author_id === user?.id && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="-mr-2 -mt-2 size-7"
                        title="피드백 삭제"
                        disabled={deleteComment.isPending}
                        onClick={(event) => {
                          event.stopPropagation();
                          void removeComment(comment.id);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                  {comment.quoted_text && (
                    <blockquote className="my-2 line-clamp-4 border-l-2 border-primary pl-2 text-muted-foreground">
                      “{comment.quoted_text}”
                    </blockquote>
                  )}
                  <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
                  <p className="mt-2 text-[10px] text-muted-foreground">{formatDate(comment.created_at)}</p>
                </article>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">아직 등록된 피드백이 없습니다.</p>
            )}
          </div>

          <div className="space-y-2 border-t p-3">
            <div className="flex rounded-md border p-0.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setAnchorType("document");
                  setSelectedAssetId(null);
                  setSelectedImageNumber(null);
                }}
                className={cn("flex-1 rounded px-2 py-1.5", anchorType === "document" && "bg-primary text-primary-foreground")}
              >
                문서 전체
              </button>
              <button
                type="button"
                onClick={() => selection && setAnchorType("range")}
                disabled={!selection}
                className={cn(
                  "flex-1 rounded px-2 py-1.5 disabled:cursor-not-allowed disabled:opacity-40",
                  anchorType === "range" && "bg-primary text-primary-foreground",
                )}
              >
                선택 영역
              </button>
              {selectedAssetId && (
                <button
                  type="button"
                  onClick={() => setAnchorType("asset")}
                  className={cn(
                    "flex-1 rounded px-2 py-1.5",
                    anchorType === "asset" && "bg-primary text-primary-foreground",
                  )}
                >
                  선택 이미지
                </button>
              )}
            </div>
            {anchorType === "range" && selection && (
              <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">
                <p className="font-medium">{selection.startLine}–{selection.endLine}줄</p>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap">“{selection.quotedText}”</p>
              </div>
            )}
            {anchorType === "asset" && selectedAssetId && (
              <p className="rounded-md bg-primary/10 p-2 text-xs text-primary">
                {selectedImageNumber
                  ? `이미지 #${selectedImageNumber}에 피드백을 작성합니다.`
                  : "선택한 이미지에 피드백을 작성합니다."}
              </p>
            )}
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void addComment();
              }}
              placeholder="피드백을 입력하세요."
              className="min-h-20 text-sm"
            />
            <Button
              type="button"
              className="w-full"
              disabled={
                !body.trim()
                || createComment.isPending
                || (anchorType === "range" && !selection)
                || (anchorType === "asset" && !selectedAssetId)
              }
              onClick={() => void addComment()}
            >
              {createComment.isPending
                ? <Loader2 className="size-4 animate-spin" />
                : <Send className="size-4" />}
              피드백 등록
            </Button>
          </div>
        </aside>
        </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

function ReviewState({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
      <p>{message}</p>
      <Button variant="outline" onClick={onBack}>학생 관리로</Button>
    </div>
  );
}
