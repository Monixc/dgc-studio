import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Loader2, LogOut, Save, Send } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PortfolioEditor } from "@/features/portfolio/PortfolioEditor";
import { PortfolioViewer } from "@/features/portfolio/PortfolioViewer";
import {
  getPortfolioPlainText,
  parsePortfolioMarkdown,
  plainTextToDocument,
  serializePortfolioMarkdown,
  type PortfolioDocument,
} from "@/features/portfolio/portfolio";
import {
  usePortfolioDocuments,
  usePortfolioSubmissions,
  useSubmitPortfolioDocument,
  useUpdatePortfolioDocument,
} from "@/hooks/usePortfolio";
import type { JsonValue } from "@/integrations/supabase/types";
import {
  PortfolioRevisionConflictError,
  getPortfolioAssetSignedUrl,
  uploadPortfolioAsset,
} from "@/lib/portfolio";
import { notifyPush } from "@/lib/push";
import { cn } from "@/lib/utils";

type EditMode = "plain" | "markdown" | "rich";

const MODES: Array<{ value: EditMode; label: string }> = [
  { value: "plain", label: "일반 텍스트" },
  { value: "markdown", label: "Markdown" },
  { value: "rich", label: "리치 텍스트" },
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
}

export default function StudentPortfolioEditor() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const documentsQuery = usePortfolioDocuments();
  const updateDocument = useUpdatePortfolioDocument();
  const submitDocument = useSubmitPortfolioDocument();
  const { data: submissions = [] } = usePortfolioSubmissions({ documentId });
  const stored = documentsQuery.data?.find((item) => item.id === documentId);
  const submissionCount = submissions.length;
  const nextVersion = submissionCount + 1;
  const [exitOpen, setExitOpen] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [revision, setRevision] = useState(0);
  const [content, setContent] = useState<PortfolioDocument>({ type: "doc", content: [{ type: "paragraph" }] });
  const [plainText, setPlainText] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [mode, setMode] = useState<EditMode>("rich");
  const [dirty, setDirty] = useState(false);
  const [conflicted, setConflicted] = useState(false);

  useEffect(() => {
    if (!stored || loadedId === stored.id) return;
    const document = stored.content_json as PortfolioDocument;
    setLoadedId(stored.id);
    setTitle(stored.title);
    setRevision(stored.revision);
    setContent(document);
    setPlainText(getPortfolioPlainText(document));
    setMarkdown(serializePortfolioMarkdown(document));
    setDirty(false);
    setConflicted(false);
  }, [loadedId, stored]);

  const resolveAssetUrl = useCallback(
    (assetId: string) => getPortfolioAssetSignedUrl(assetId),
    [],
  );

  const markdownPreview = useMemo(() => {
    try {
      return { document: parsePortfolioMarkdown(markdown), error: null };
    } catch (error) {
      return { document: null, error: errorMessage(error) };
    }
  }, [markdown]);

  const currentDocument = (): PortfolioDocument => {
    if (mode === "plain") return plainTextToDocument(plainText);
    if (mode === "markdown") return parsePortfolioMarkdown(markdown);
    return content;
  };

  const changeMode = (nextMode: EditMode) => {
    if (nextMode === mode) return;
    try {
      const document = currentDocument();
      setContent(document);
      if (nextMode === "plain") setPlainText(getPortfolioPlainText(document));
      if (nextMode === "markdown") setMarkdown(serializePortfolioMarkdown(document));
      setMode(nextMode);
      setDirty(true);
    } catch (error) {
      toast.error(`모드를 전환할 수 없습니다: ${errorMessage(error)}`);
    }
  };

  const goBack = () => {
    navigate(`/student/portfolio?document=${encodeURIComponent(documentId ?? "")}`);
  };

  /** 저장하고 갱신된 revision 반환. 실패 시 null. 네비게이션은 호출자 몫. */
  const persist = async (): Promise<number | null> => {
    if (!documentId || conflicted) return null;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("제목을 입력해 주세요.");
      return null;
    }
    try {
      const document = currentDocument();
      const updated = await updateDocument.mutateAsync({
        documentId,
        expectedRevision: revision,
        input: {
          title: trimmedTitle,
          contentJson: document as JsonValue,
          contentText: getPortfolioPlainText(document),
        },
      });
      setRevision(updated.revision);
      setContent(updated.content_json as PortfolioDocument);
      setDirty(false);
      return updated.revision;
    } catch (error) {
      if (error instanceof PortfolioRevisionConflictError) {
        setConflicted(true);
        void documentsQuery.refetch();
        toast.error("다른 곳에서 수정된 문서입니다. 현재 내용으로 덮어쓰지 않았습니다.");
        return null;
      }
      toast.error(`저장하지 못했습니다: ${errorMessage(error)}`);
      return null;
    }
  };

  const save = async () => {
    const saved = await persist();
    if (saved === null) return;
    toast.success("저장했습니다.");
    navigate(`/student/portfolio?document=${encodeURIComponent(documentId ?? "")}`);
  };

  const submit = async () => {
    if (!window.confirm(`v${nextVersion}으로 제출하시겠습니까?`)) return;
    let targetRevision = revision;
    if (dirty) {
      const saved = await persist();
      if (saved === null) return;
      targetRevision = saved;
    }
    try {
      const submitted = await submitDocument.mutateAsync({
        documentId: documentId!,
        expectedRevision: targetRevision,
      });
      void notifyPush("portfolio_submitted", submitted.id);
      toast.success(`v${submitted.version}으로 제출했습니다.`);
      navigate(`/student/portfolio?document=${encodeURIComponent(documentId ?? "")}`);
    } catch (error) {
      toast.error(`제출하지 못했습니다: ${errorMessage(error)}`);
    }
  };

  const uploadAsset = async (file: File) => {
    if (!documentId) throw new Error("문서를 찾을 수 없습니다.");
    const asset = await uploadPortfolioAsset(documentId, file);
    return { assetId: asset.id, alt: file.name, title: file.name };
  };

  if (documentsQuery.isLoading || (documentsQuery.isFetching && !stored)) {
    return <div className="flex h-dvh items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  if (!documentId || !stored) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">편집할 포트폴리오를 찾을 수 없습니다.</p>
        <Button variant="outline" onClick={() => navigate("/student/portfolio")}>목록으로</Button>
      </div>
    );
  }

  return (
    <div
      className="flex h-dvh min-h-0 flex-col bg-white text-slate-950"
      style={{
        "--background": "0 0% 100%",
        "--foreground": "222.2 84% 4.9%",
        "--muted": "210 40% 96.1%",
        "--muted-foreground": "215.4 16.3% 46.9%",
        "--border": "214.3 31.8% 91.4%",
      } as CSSProperties}
    >
      <header className="shrink-0 border-b bg-white">
        <div className="flex items-center gap-3 px-3 py-2">
          <Input
            value={title}
            maxLength={120}
            aria-label="포트폴리오 제목"
            className="h-9 min-w-0 flex-1 border-0 bg-transparent text-base font-semibold shadow-none"
            onChange={(event) => {
              setTitle(event.target.value);
              setDirty(true);
            }}
          />
          {conflicted && <span className="text-xs font-medium text-destructive">수정 충돌</span>}
          {submissionCount > 0 && (
            <span className="hidden whitespace-nowrap text-xs text-muted-foreground sm:inline">
              제출 {submissionCount}회 · 이번이 {nextVersion}번째
            </span>
          )}
          <Button
            variant="outline"
            onClick={() => void save()}
            disabled={!dirty || conflicted || updateDocument.isPending}
          >
            {updateDocument.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            저장
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={conflicted || submitDocument.isPending || updateDocument.isPending}
          >
            {submitDocument.isPending ? <Loader2 className="animate-spin" /> : <Send />}
            {submissionCount > 0 ? `v${nextVersion} 제출` : "제출"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setExitOpen(true)}
            className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut /> 편집 종료
          </Button>
        </div>
        <nav className="flex gap-1 px-3" aria-label="편집 모드">
          {MODES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => changeMode(item.value)}
              className={cn(
                "border-b-2 px-3 py-2 text-sm text-muted-foreground",
                mode === item.value && "border-primary font-semibold text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="min-h-0 flex-1">
        {mode === "plain" ? (
          <textarea
            autoFocus
            value={plainText}
            aria-label="일반 텍스트 내용"
            className="h-full w-full resize-none border-0 bg-white p-5 font-mono text-sm leading-7 outline-none sm:p-8"
            onChange={(event) => {
              setPlainText(event.target.value);
              setDirty(true);
            }}
          />
        ) : mode === "markdown" ? (
          <div className="grid h-full min-h-0 md:grid-cols-2">
            <textarea
              value={markdown}
              aria-label="Markdown 내용"
              className="min-h-[45vh] w-full resize-none border-0 bg-slate-950 p-5 font-mono text-sm leading-7 text-slate-100 outline-none md:min-h-0 md:border-r"
              onChange={(event) => {
                setMarkdown(event.target.value);
                setDirty(true);
              }}
            />
            <div className="min-h-[45vh] overflow-y-auto bg-white p-5 sm:p-8 md:min-h-0">
              {markdownPreview.document ? (
                <PortfolioViewer value={markdownPreview.document} resolveAssetUrl={resolveAssetUrl} />
              ) : (
                <p className="text-sm text-destructive">{markdownPreview.error}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto bg-muted/20 p-3 sm:p-5">
            <PortfolioEditor
              value={content}
              onChange={(document) => {
                setContent(document);
                setDirty(true);
              }}
              resolveAssetUrl={resolveAssetUrl}
              onUploadFile={uploadAsset}
              onError={(error) => toast.error(error.message)}
              className="mx-auto min-h-full max-w-5xl rounded-none"
            />
          </div>
        )}
      </main>

      <Dialog open={exitOpen} onOpenChange={setExitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>편집을 종료하시겠습니까?</DialogTitle>
          </DialogHeader>
          {dirty && (
            <p className="text-sm text-destructive">저장하지 않은 변경사항은 사라집니다.</p>
          )}
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline">취소</Button>
            </DialogClose>
            <Button variant="destructive" onClick={goBack}>
              <LogOut /> 종료
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
