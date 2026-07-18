import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Code2,
  FileImage,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Palette,
  Paperclip,
  Quote,
  Video,
} from "lucide-react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DrawingDialog } from "./DrawingDialog";
import {
  createPortfolioExtensions,
  parsePortfolioMarkdown,
  sanitizeExternalMediaUrl,
  sanitizeHttpsUrl,
  sanitizeImageUrl,
  serializePortfolioMarkdown,
  type PortfolioAsset,
  type PortfolioDocument,
  type ResolveAssetUrl,
} from "./portfolio";
import "./portfolio-editor.css";

export interface PortfolioEditorProps {
  value: PortfolioDocument;
  onChange: (value: PortfolioDocument) => void;
  resolveAssetUrl: ResolveAssetUrl;
  onUploadFile?: (file: File) => Promise<PortfolioAsset>;
  onMarkdownExport?: (markdown: string) => void | Promise<void>;
  onError?: (error: Error) => void;
  disabled?: boolean;
  className?: string;
}

type UrlDialog = "link" | "image" | "media" | null;

function ToolbarButton({
  active,
  label,
  ...props
}: React.ComponentProps<typeof Button> & { active?: boolean; label: string }) {
  return (
    <Button
      type="button"
      size="icon"
      variant={active ? "secondary" : "ghost"}
      className="size-8 rounded-md"
      title={label}
      aria-label={label}
      aria-pressed={active}
      {...props}
    />
  );
}

function run(editor: Editor | null, action: (editor: Editor) => void) {
  if (editor) action(editor);
}

export function PortfolioEditor({
  value,
  onChange,
  resolveAssetUrl,
  onUploadFile,
  onMarkdownExport,
  onError,
  disabled = false,
  className,
}: PortfolioEditorProps) {
  const onChangeRef = useRef(onChange);
  const onErrorRef = useRef(onError);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const readyRef = useRef(false);
  const [urlDialog, setUrlDialog] = useState<UrlDialog>(null);
  const [url, setUrl] = useState("");
  const [markdownOpen, setMarkdownOpen] = useState(false);
  const [markdown, setMarkdown] = useState("");
  const [drawingOpen, setDrawingOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  onChangeRef.current = onChange;
  onErrorRef.current = onError;

  const reportError = (error: unknown) => {
    onErrorRef.current?.(error instanceof Error ? error : new Error(String(error)));
  };

  const editor = useEditor(
    {
      extensions: createPortfolioExtensions(resolveAssetUrl),
      content: value,
      editable: !disabled,
      immediatelyRender: false,
      shouldRerenderOnTransaction: true,
      onUpdate: ({ editor: current }) => {
        if (readyRef.current) onChangeRef.current(current.getJSON());
      },
      editorProps: {
        attributes: {
          class: "portfolio-editor-content",
          role: "textbox",
          "aria-multiline": "true",
          "aria-label": "포트폴리오 내용",
        },
      },
    },
    [resolveAssetUrl],
  );

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    readyRef.current = false;
    if (!editor) return;
    const frame = requestAnimationFrame(() => {
      readyRef.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [editor]);

  useEffect(() => {
    if (!editor || JSON.stringify(editor.getJSON()) === JSON.stringify(value)) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  const uploadAsset = async (file: File) => {
    if (!onUploadFile) throw new Error("파일 업로드 콜백이 제공되지 않았습니다.");
    setUploading(true);
    try {
      const asset = await onUploadFile(file);
      if (!asset.assetId.trim()) throw new Error("업로드 결과에 assetId가 없습니다.");
      editor?.chain().focus().insertContent({
        type: "portfolioAssetImage",
        attrs: asset,
      }).run();
    } catch (error) {
      reportError(error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const uploadAttachment = async (file: File) => {
    if (!onUploadFile) throw new Error("파일 업로드 콜백이 제공되지 않았습니다.");
    setUploading(true);
    try {
      const asset = await onUploadFile(file);
      if (!asset.assetId.trim()) throw new Error("업로드 결과에 assetId가 없습니다.");
      editor?.chain().focus().insertContent({
        type: "portfolioAssetFile",
        attrs: {
          assetId: asset.assetId,
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
        },
      }).run();
    } catch (error) {
      reportError(error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const submitUrl = () => {
    if (!editor || !urlDialog) return;

    if (urlDialog === "link") {
      const safe = sanitizeHttpsUrl(url);
      if (!safe) return reportError(new Error("링크는 유효한 HTTPS URL이어야 합니다."));
      editor.chain().focus().extendMarkRange("link").setLink({ href: safe }).run();
    } else if (urlDialog === "image") {
      const safe = sanitizeImageUrl(url);
      if (!safe) return reportError(new Error("이미지는 유효한 HTTPS URL이어야 합니다."));
      editor.chain().focus().setImage({ src: safe }).run();
    } else {
      const media = sanitizeExternalMediaUrl(url);
      if (!media) return reportError(new Error("유효한 YouTube, Vimeo 또는 직접 동영상 URL이 아닙니다."));
      if (media.kind === "youtube") {
        editor.commands.setYoutubeVideo({ src: media.src });
      } else {
        editor.chain().focus().insertContent({
          type: "portfolioExternalMedia",
          attrs: media,
        }).run();
      }
    }

    setUrl("");
    setUrlDialog(null);
  };

  const importMarkdown = () => {
    try {
      const document = parsePortfolioMarkdown(markdown);
      editor?.commands.setContent(document);
      setMarkdownOpen(false);
      setMarkdown("");
    } catch (error) {
      reportError(error);
    }
  };

  const exportMarkdown = async () => {
    if (!editor) return;
    try {
      const result = serializePortfolioMarkdown(editor.getJSON());
      if (onMarkdownExport) await onMarkdownExport(result);
      else await navigator.clipboard.writeText(result);
    } catch (error) {
      reportError(error);
    }
  };

  return (
    <section className={cn("portfolio-editor rounded-lg border bg-background", className)}>
      <div className="portfolio-toolbar flex flex-wrap items-center gap-1 border-b p-2">
        <ToolbarButton
          label="제목 1"
          active={editor?.isActive("heading", { level: 1 })}
          disabled={disabled}
          onClick={() => run(editor, (item) => item.chain().focus().toggleHeading({ level: 1 }).run())}
        >
          <Heading1 />
        </ToolbarButton>
        <ToolbarButton
          label="제목 2"
          active={editor?.isActive("heading", { level: 2 })}
          disabled={disabled}
          onClick={() => run(editor, (item) => item.chain().focus().toggleHeading({ level: 2 }).run())}
        >
          <Heading2 />
        </ToolbarButton>
        <ToolbarButton
          label="제목 3"
          active={editor?.isActive("heading", { level: 3 })}
          disabled={disabled}
          onClick={() => run(editor, (item) => item.chain().focus().toggleHeading({ level: 3 }).run())}
        >
          <Heading3 />
        </ToolbarButton>
        <ToolbarButton
          label="굵게"
          active={editor?.isActive("bold")}
          disabled={disabled}
          onClick={() => run(editor, (item) => item.chain().focus().toggleBold().run())}
        >
          <Bold />
        </ToolbarButton>
        <ToolbarButton
          label="기울임"
          active={editor?.isActive("italic")}
          disabled={disabled}
          onClick={() => run(editor, (item) => item.chain().focus().toggleItalic().run())}
        >
          <Italic />
        </ToolbarButton>
        <ToolbarButton
          label="글머리 목록"
          active={editor?.isActive("bulletList")}
          disabled={disabled}
          onClick={() => run(editor, (item) => item.chain().focus().toggleBulletList().run())}
        >
          <List />
        </ToolbarButton>
        <ToolbarButton
          label="번호 목록"
          active={editor?.isActive("orderedList")}
          disabled={disabled}
          onClick={() => run(editor, (item) => item.chain().focus().toggleOrderedList().run())}
        >
          <ListOrdered />
        </ToolbarButton>
        <ToolbarButton
          label="인용문"
          active={editor?.isActive("blockquote")}
          disabled={disabled}
          onClick={() => run(editor, (item) => item.chain().focus().toggleBlockquote().run())}
        >
          <Quote />
        </ToolbarButton>
        <ToolbarButton
          label="인라인 코드"
          active={editor?.isActive("code")}
          disabled={disabled}
          onClick={() => run(editor, (item) => item.chain().focus().toggleCode().run())}
        >
          <Code2 />
        </ToolbarButton>
        <ToolbarButton
          label="링크"
          active={editor?.isActive("link")}
          disabled={disabled}
          onClick={() => {
            if (editor?.isActive("link")) editor.chain().focus().unsetLink().run();
            else setUrlDialog("link");
          }}
        >
          <Link2 />
        </ToolbarButton>

        <span className="mx-1 h-6 border-l" aria-hidden />

        <ToolbarButton label="HTTPS 이미지" disabled={disabled} onClick={() => setUrlDialog("image")}>
          <ImagePlus />
        </ToolbarButton>
        <ToolbarButton label="동영상" disabled={disabled} onClick={() => setUrlDialog("media")}>
          <Video />
        </ToolbarButton>
        <ToolbarButton
          label="이미지 파일 업로드"
          disabled={disabled || uploading || !onUploadFile}
          onClick={() => fileInputRef.current?.click()}
        >
          <FileImage />
        </ToolbarButton>
        <ToolbarButton
          label="그림 그리기"
          disabled={disabled || uploading || !onUploadFile}
          onClick={() => setDrawingOpen(true)}
        >
          <Palette />
        </ToolbarButton>
        <ToolbarButton
          label="파일 첨부"
          disabled={disabled || uploading || !onUploadFile}
          onClick={() => attachInputRef.current?.click()}
        >
          <Paperclip />
        </ToolbarButton>

        <div className="ml-auto flex gap-1">
          <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => setMarkdownOpen(true)}>
            MD 가져오기
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={exportMarkdown}>
            MD 내보내기
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadAsset(file).catch(() => undefined);
          event.target.value = "";
        }}
      />

      <input
        ref={attachInputRef}
        type="file"
        accept=".pdf,.md,.markdown,.txt,.doc,.docx,.hwp,.hwpx,.ppt,.pptx,.xls,.xlsx,.csv,.json,.ipynb,.py,.js,.ts,.java,.c,.h,.cpp,.cs,.rb,.go,.rs,.kt,.swift,.sb,.sb2,.sb3,.ent,.entry,.zip,application/pdf"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadAttachment(file).catch(() => undefined);
          event.target.value = "";
        }}
      />

      <EditorContent editor={editor} />

      <Dialog open={urlDialog !== null} onOpenChange={(open) => !open && setUrlDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {urlDialog === "link" ? "링크 추가" : urlDialog === "image" ? "이미지 추가" : "동영상 추가"}
            </DialogTitle>
          </DialogHeader>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              submitUrl();
            }}
          >
            <Input
              type="url"
              required
              autoFocus
              value={url}
              placeholder="https://…"
              onChange={(event) => setUrl(event.target.value)}
            />
            <Button type="submit">추가</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={markdownOpen} onOpenChange={setMarkdownOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Markdown 가져오기</DialogTitle>
          </DialogHeader>
          <textarea
            className="min-h-64 w-full rounded-md border bg-background p-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={markdown}
            aria-label="Markdown"
            onChange={(event) => setMarkdown(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setMarkdownOpen(false)}>취소</Button>
            <Button type="button" onClick={importMarkdown}>가져오기</Button>
          </div>
        </DialogContent>
      </Dialog>

      <DrawingDialog open={drawingOpen} onOpenChange={setDrawingOpen} onSave={uploadAsset} />
    </section>
  );
}
