import { useEffect, useMemo, useRef } from "react";
import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { EditorContent, useEditor } from "@tiptap/react";
import { cn } from "@/lib/utils";
import {
  assertSafeDocument,
  createPortfolioExtensions,
  normalizePortfolioSelection,
  type PortfolioCommentRange,
  type PortfolioDocument,
  type PortfolioSelection,
  type ResolveAssetUrl,
} from "./portfolio";
import "./portfolio-editor.css";

export interface PortfolioViewerProps {
  value: PortfolioDocument;
  resolveAssetUrl: ResolveAssetUrl;
  onSelectionChange?: (selection: PortfolioSelection) => void;
  onAssetClick?: (assetId: string, imageNumber: number | null) => void;
  selectedAssetId?: string | null;
  selectedImageNumber?: number | null;
  commentRanges?: readonly PortfolioCommentRange[];
  className?: string;
}

const EMPTY_DOC: PortfolioDocument = { type: "doc", content: [] };

const CommentHighlights = Extension.create<{ ranges: readonly PortfolioCommentRange[] }>({
  name: "portfolioCommentHighlights",

  addOptions() {
    return { ranges: [] };
  },

  addProseMirrorPlugins() {
    const ranges = this.options.ranges;
    return [
      new Plugin({
        props: {
          decorations(state) {
            const max = state.doc.content.size;
            const decorations = ranges.flatMap((range) => {
              const from = Math.max(1, Math.min(range.from, range.to, max));
              const to = Math.max(from, Math.min(Math.max(range.from, range.to), max));
              return to > from
                ? [Decoration.inline(from, to, {
                    class: range.className ?? "portfolio-comment-highlight",
                    "data-portfolio-comment": "true",
                  })]
                : [];
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

function toSafeDocument(value: PortfolioDocument): PortfolioDocument | null {
  try {
    assertSafeDocument(value);
    return value;
  } catch {
    return null;
  }
}

export function PortfolioViewer({
  value,
  resolveAssetUrl,
  onSelectionChange,
  onAssetClick,
  selectedAssetId,
  selectedImageNumber,
  commentRanges = [],
  className,
}: PortfolioViewerProps) {
  const selectionRef = useRef(onSelectionChange);
  selectionRef.current = onSelectionChange;
  const rangesKey = JSON.stringify(commentRanges);
  const safeValue = useMemo(() => toSafeDocument(value), [value]);

  const editor = useEditor(
    {
      extensions: [
        ...createPortfolioExtensions(resolveAssetUrl),
        CommentHighlights.configure({ ranges: commentRanges }),
      ],
      content: safeValue ?? EMPTY_DOC,
      editable: false,
      immediatelyRender: false,
      onSelectionUpdate: ({ editor: current }) => {
        const { from, to } = current.state.selection;
        selectionRef.current?.(normalizePortfolioSelection(current.state.doc, from, to));
      },
      editorProps: {
        attributes: {
          class: "portfolio-editor-content portfolio-viewer-content",
          "aria-label": "포트폴리오 내용",
        },
      },
    },
    [resolveAssetUrl, rangesKey],
  );

  useEffect(() => {
    if (!editor) return;
    if (!safeValue) {
      editor.commands.setContent(EMPTY_DOC, { emitUpdate: false });
      return;
    }
    if (JSON.stringify(editor.getJSON()) === JSON.stringify(safeValue)) return;
    editor.commands.setContent(safeValue, { emitUpdate: false });
  }, [editor, safeValue]);

  useEffect(() => {
    if (!editor) return;
    editor.view.dom
      .querySelectorAll<HTMLElement>(".portfolio-asset[data-asset-id], .portfolio-feedback-target[data-asset-id]")
      .forEach((asset) => {
        const imageNumber = asset.dataset.imageNumber ? Number(asset.dataset.imageNumber) : null;
        asset.classList.toggle(
          "portfolio-asset-feedback-selected",
          asset.dataset.assetId === selectedAssetId && imageNumber === selectedImageNumber,
        );
    });
  }, [editor, selectedAssetId, selectedImageNumber, safeValue]);

  if (!safeValue) {
    return (
      <article className={cn("rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive", className)}>
        이 노트에 허용되지 않은 링크·미디어가 있어 표시할 수 없습니다.
      </article>
    );
  }

  return (
    <article
      className={cn("portfolio-editor portfolio-viewer", onAssetClick && "portfolio-assets-clickable", className)}
      onClick={(event) => {
        const asset = (event.target as HTMLElement).closest<HTMLElement>(
          ".portfolio-asset[data-asset-id], .portfolio-feedback-target[data-asset-id]",
        );
        if (asset?.dataset.assetId) {
          onAssetClick?.(
            asset.dataset.assetId,
            asset.dataset.imageNumber ? Number(asset.dataset.imageNumber) : null,
          );
        }
      }}
    >
      <EditorContent editor={editor} />
    </article>
  );
}
