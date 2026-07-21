/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState } from "react";
import {
  Node,
  createAtomBlockMarkdownSpec,
  mergeAttributes,
  type AnyExtension,
  type JSONContent,
} from "@tiptap/core";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Youtube from "@tiptap/extension-youtube";
import { Markdown, MarkdownManager } from "@tiptap/markdown";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Blocks, Download, Paperclip } from "lucide-react";
import { isScratchFile, loadSb3Scripts } from "./sb3Preview";

export type PortfolioDocument = JSONContent;
export type ResolveAssetUrl = (assetId: string) => Promise<string | null>;

export interface PortfolioAsset {
  assetId: string;
  alt?: string;
  title?: string;
}

export interface PortfolioSelection {
  from: number;
  to: number;
  startLine: number;
  endLine: number;
  quotedText: string;
}

export interface PortfolioCommentRange {
  from: number;
  to: number;
  className?: string;
}

export type ExternalMedia =
  | { kind: "youtube"; src: string }
  | { kind: "vimeo"; src: string }
  | { kind: "video"; src: string };

export function sanitizeHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function sanitizeImageUrl(value: string): string | null {
  return sanitizeHttpsUrl(value);
}

function sanitizeResolvedAssetUrl(value: string): string | null {
  const https = sanitizeHttpsUrl(value);
  if (https) return https;
  try {
    const url = new URL(value.trim());
    const localHost = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    return url.protocol === "http:" && localHost && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function sanitizeExternalMediaUrl(value: string): ExternalMedia | null {
  const safe = sanitizeHttpsUrl(value);
  if (!safe) return null;

  const url = new URL(safe);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && /^[\w-]{6,}$/.test(id)
      ? { kind: "youtube", src: `https://www.youtube.com/watch?v=${id}` }
      : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    const id =
      url.searchParams.get("v") ??
      url.pathname.match(/^\/(?:embed|shorts)\/([\w-]{6,})/)?.[1] ??
      null;
    return id && /^[\w-]{6,}$/.test(id)
      ? { kind: "youtube", src: `https://www.youtube.com/watch?v=${id}` }
      : null;
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.match(/(?:^|\/)(\d+)(?:$|\/)/)?.[1];
    return id ? { kind: "vimeo", src: `https://player.vimeo.com/video/${id}` } : null;
  }

  return /\.(?:mp4|webm|ogv|ogg)(?:$)/i.test(url.pathname)
    ? { kind: "video", src: safe }
    : null;
}

function AssetImageView({ node }: NodeViewProps) {
  const assetId = String(node.attrs.assetId ?? "");
  const resolver = (node.type.spec as { resolveAssetUrl?: ResolveAssetUrl }).resolveAssetUrl;
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setSrc(null);
    setFailed(false);
    resolver?.(assetId)
      .then((value) => {
        if (!active) return;
        const safe = value ? sanitizeResolvedAssetUrl(value) : null;
        setSrc(safe);
        setFailed(!safe);
      })
      .catch((error) => {
        console.error("portfolio asset resolve failed", assetId, error);
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [assetId, resolver]);

  return (
    <NodeViewWrapper className="portfolio-asset" data-asset-id={assetId}>
      {src ? (
        <img src={src} alt={node.attrs.alt ?? ""} title={node.attrs.title ?? undefined} />
      ) : (
        <div className="portfolio-media-placeholder" role="status">
          {failed ? "이미지를 불러오지 못했습니다." : "이미지 불러오는 중…"}
        </div>
      )}
    </NodeViewWrapper>
  );
}

const assetMarkdown = createAtomBlockMarkdownSpec({
  nodeName: "portfolioAssetImage",
  name: "portfolio-asset",
  requiredAttributes: ["assetId"],
  allowedAttributes: ["assetId", "alt", "title"],
});

export const PortfolioAssetImage = Node.create<{ resolveAssetUrl?: ResolveAssetUrl }>({
  name: "portfolioAssetImage",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return { resolveAssetUrl: undefined };
  },

  addAttributes() {
    return {
      assetId: { default: null },
      alt: { default: "" },
      title: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "figure[data-portfolio-asset-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "figure",
      mergeAttributes({
        "data-portfolio-asset-id": HTMLAttributes.assetId,
        "data-alt": HTMLAttributes.alt || undefined,
        "data-title": HTMLAttributes.title || undefined,
      }),
    ];
  },

  parseMarkdown: assetMarkdown.parseMarkdown,
  markdownTokenizer: assetMarkdown.markdownTokenizer,
  renderMarkdown: assetMarkdown.renderMarkdown,

  addNodeView() {
    this.type.spec.resolveAssetUrl = this.options.resolveAssetUrl;
    return ReactNodeViewRenderer(AssetImageView);
  },
});

function formatBytes(size: number): string {
  if (!size) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 || value >= 10 ? 0 : 1)} ${units[unit]}`;
}

function AssetFileView({ node }: NodeViewProps) {
  const assetId = String(node.attrs.assetId ?? "");
  const fileName = String(node.attrs.fileName ?? "") || "첨부파일";
  const size = Number(node.attrs.size ?? 0);
  const resolver = (node.type.spec as { resolveAssetUrl?: ResolveAssetUrl }).resolveAssetUrl;
  const isScratch = isScratchFile(fileName);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [showBlocks, setShowBlocks] = useState(false);
  const [blockState, setBlockState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [blockError, setBlockError] = useState<string | null>(null);
  const blockHostRef = useRef<HTMLDivElement>(null);
  const blockClassRef = useRef(`sb3-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    let active = true;
    setUrl(null);
    setFailed(false);
    resolver?.(assetId)
      .then((value) => {
        if (!active) return;
        setUrl(value);
        setFailed(!value);
      })
      .catch((error) => {
        console.error("portfolio asset resolve failed", assetId, error);
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [assetId, resolver]);

  useEffect(() => {
    if (!showBlocks || !url || blockState !== "loading") return;
    let cancelled = false;
    (async () => {
      try {
        const [scripts, { default: scratchblocks }] = await Promise.all([
          loadSb3Scripts(url),
          import("scratchblocks"),
        ]);
        if (cancelled) return;
        const host = blockHostRef.current;
        if (host) {
          host.innerHTML = "";
          if (!scripts.length) {
            host.textContent = "표시할 블록 스크립트가 없습니다.";
          } else {
            for (const [index, script] of scripts.entries()) {
              const pre = document.createElement("pre");
              pre.className = `blocks portfolio-feedback-target ${blockClassRef.current}`;
              pre.dataset.assetId = assetId;
              pre.dataset.imageNumber = String(index + 1);
              pre.textContent = script.code;
              host.appendChild(pre);
            }
            scratchblocks.renderMatching(`.${blockClassRef.current}`, { style: "scratch3", scale: 0.7 });
          }
        }
        setBlockState("ready");
      } catch (error: unknown) {
        if (cancelled) return;
        setBlockError(error instanceof Error ? error.message : "블록을 불러오지 못했습니다.");
        setBlockState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showBlocks, url, blockState]);

  const toggleBlocks = () => {
    setShowBlocks((value) => !value);
    if (blockState === "idle") setBlockState("loading");
  };

  return (
    <NodeViewWrapper className="portfolio-file-wrap" data-asset-id={assetId}>
      <div className="portfolio-file">
        <span className="portfolio-file-icon" aria-hidden>
          <Paperclip />
        </span>
        <span className="portfolio-file-body">
          <span className="portfolio-file-name">{fileName}</span>
          {size > 0 && <span className="portfolio-file-meta">{formatBytes(size)}</span>}
        </span>
        {isScratch && url && (
          <button type="button" className="portfolio-file-action" onClick={toggleBlocks}>
            <Blocks aria-hidden /> {showBlocks ? "블록 숨기기" : "블록 보기"}
          </button>
        )}
        {url ? (
          <a
            className="portfolio-file-download"
            href={url}
            download={fileName}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => {
              event.preventDefault();
              fetch(url)
                .then((res) => res.blob())
                .then((blob) => {
                  const objectUrl = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = objectUrl;
                  link.download = fileName;
                  link.click();
                  URL.revokeObjectURL(objectUrl);
                })
                .catch(() => window.open(url, "_blank", "noopener,noreferrer"));
            }}
          >
            <Download aria-hidden /> 다운로드
          </a>
        ) : (
          <span className="portfolio-file-meta">{failed ? "불러오기 실패" : "불러오는 중…"}</span>
        )}
      </div>
      {isScratch && (
        <div className={`portfolio-file-blocks${showBlocks ? "" : " portfolio-hidden"}`}>
          {blockState === "loading" && <p className="portfolio-file-meta">블록 불러오는 중…</p>}
          {blockState === "error" && <p className="portfolio-file-meta">{blockError}</p>}
          <div ref={blockHostRef} className="portfolio-file-blocks-host" />
        </div>
      )}
    </NodeViewWrapper>
  );
}

const assetFileMarkdown = createAtomBlockMarkdownSpec({
  nodeName: "portfolioAssetFile",
  name: "portfolio-file",
  requiredAttributes: ["assetId"],
  allowedAttributes: ["assetId", "fileName", "mimeType", "size"],
});

export const PortfolioAssetFile = Node.create<{ resolveAssetUrl?: ResolveAssetUrl }>({
  name: "portfolioAssetFile",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return { resolveAssetUrl: undefined };
  },

  addAttributes() {
    return {
      assetId: { default: null },
      fileName: { default: "" },
      mimeType: { default: "" },
      size: { default: 0 },
    };
  },

  parseHTML() {
    return [{ tag: "figure[data-portfolio-file-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "figure",
      mergeAttributes({
        "data-portfolio-file-id": HTMLAttributes.assetId,
        "data-file-name": HTMLAttributes.fileName || undefined,
        "data-mime-type": HTMLAttributes.mimeType || undefined,
        "data-size": HTMLAttributes.size || undefined,
      }),
    ];
  },

  parseMarkdown: assetFileMarkdown.parseMarkdown,
  markdownTokenizer: assetFileMarkdown.markdownTokenizer,
  renderMarkdown: assetFileMarkdown.renderMarkdown,

  addNodeView() {
    this.type.spec.resolveAssetUrl = this.options.resolveAssetUrl;
    return ReactNodeViewRenderer(AssetFileView);
  },
});

function ExternalMediaView({ node }: NodeViewProps) {
  const media = sanitizeExternalMediaUrl(String(node.attrs.src ?? ""));
  if (!media || media.kind === "youtube") {
    return <NodeViewWrapper className="portfolio-media-placeholder">지원하지 않는 미디어입니다.</NodeViewWrapper>;
  }

  return (
    <NodeViewWrapper className="portfolio-media">
      {media.kind === "vimeo" ? (
        <iframe
          src={media.src}
          title={node.attrs.title || "Vimeo video"}
          allow="fullscreen; picture-in-picture"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <video src={media.src} title={node.attrs.title || undefined} controls preload="metadata" />
      )}
    </NodeViewWrapper>
  );
}

const mediaMarkdown = createAtomBlockMarkdownSpec({
  nodeName: "portfolioExternalMedia",
  name: "portfolio-media",
  requiredAttributes: ["src", "kind"],
  allowedAttributes: ["src", "kind", "title"],
});

export const PortfolioExternalMedia = Node.create({
  name: "portfolioExternalMedia",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      kind: { default: null },
      title: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-portfolio-media]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({
        "data-portfolio-media": HTMLAttributes.kind,
        "data-src": HTMLAttributes.src,
        "data-title": HTMLAttributes.title || undefined,
      }),
    ];
  },

  parseMarkdown: mediaMarkdown.parseMarkdown,
  markdownTokenizer: mediaMarkdown.markdownTokenizer,
  renderMarkdown: mediaMarkdown.renderMarkdown,

  addNodeView() {
    return ReactNodeViewRenderer(ExternalMediaView);
  },
});

const SafeImage = Image.extend({
  renderHTML({ HTMLAttributes }) {
    const src = sanitizeImageUrl(String(HTMLAttributes.src ?? ""));
    return src
      ? ["img", mergeAttributes(HTMLAttributes, { src })]
      : ["span", { "data-invalid-image": "true" }, "차단된 이미지"];
  },
});

const SafeLink = Link.extend({
  renderHTML({ HTMLAttributes }) {
    const href = sanitizeHttpsUrl(String(HTMLAttributes.href ?? ""));
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        href: href ?? undefined,
        rel: "noopener noreferrer nofollow",
        target: "_blank",
      }),
      0,
    ];
  },
});

export function createPortfolioExtensions(resolveAssetUrl?: ResolveAssetUrl): AnyExtension[] {
  return [
    StarterKit,
    SafeLink.configure({
      autolink: false,
      openOnClick: "whenNotEditable",
      defaultProtocol: "https",
      isAllowedUri: (url) => sanitizeHttpsUrl(url) !== null,
      HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
    }),
    SafeImage.configure({ allowBase64: false }),
    Youtube.configure({
      addPasteHandler: false,
      nocookie: true,
      controls: true,
      allowFullscreen: true,
    }),
    PortfolioAssetImage.configure({ resolveAssetUrl }),
    PortfolioAssetFile.configure({ resolveAssetUrl }),
    PortfolioExternalMedia,
    Markdown,
  ];
}

export function assertSafeDocument(node: JSONContent): void {
  if (node.type === "image" && !sanitizeImageUrl(String(node.attrs?.src ?? ""))) {
    throw new Error("이미지는 HTTPS URL만 사용할 수 있습니다.");
  }
  if (node.type === "youtube") {
    const media = sanitizeExternalMediaUrl(String(node.attrs?.src ?? ""));
    if (media?.kind !== "youtube") throw new Error("유효한 YouTube URL이 아닙니다.");
  }
  if (node.type === "portfolioExternalMedia") {
    const media = sanitizeExternalMediaUrl(String(node.attrs?.src ?? ""));
    if (!media || media.kind === "youtube" || media.kind !== node.attrs?.kind) {
      throw new Error("유효한 Vimeo 또는 직접 동영상 URL이 아닙니다.");
    }
  }
  if (
    (node.type === "portfolioAssetImage" || node.type === "portfolioAssetFile") &&
    !String(node.attrs?.assetId ?? "").trim()
  ) {
    throw new Error("포트폴리오 자산 ID가 필요합니다.");
  }
  for (const mark of node.marks ?? []) {
    if (mark.type === "link" && !sanitizeHttpsUrl(String(mark.attrs?.href ?? ""))) {
      throw new Error("링크는 HTTPS URL만 사용할 수 있습니다.");
    }
  }
  node.content?.forEach(assertSafeDocument);
}

export function parsePortfolioMarkdown(markdown: string): PortfolioDocument {
  const manager = new MarkdownManager({ extensions: createPortfolioExtensions() });
  const hasHtml = (tokens: unknown[]): boolean => tokens.some((token) => {
    if (!token || typeof token !== "object") return false;
    const value = token as { type?: string; tokens?: unknown[]; items?: Array<{ tokens?: unknown[] }> };
    return value.type === "html"
      || (value.tokens ? hasHtml(value.tokens) : false)
      || (value.items?.some((item) => item.tokens && hasHtml(item.tokens)) ?? false);
  });
  if (hasHtml(manager.instance.lexer(markdown) as unknown[])) {
    throw new Error("Markdown에 HTML을 포함할 수 없습니다.");
  }
  const document = manager.parse(markdown);
  assertSafeDocument(document);
  return document;
}

export function serializePortfolioMarkdown(document: PortfolioDocument): string {
  assertSafeDocument(document);
  return new MarkdownManager({ extensions: createPortfolioExtensions() }).serialize(document);
}

export function getPortfolioPlainText(document: PortfolioDocument): string {
  const read = (node: JSONContent): string => {
    if (node.type === "text") return node.text ?? "";
    const text = (node.content ?? []).map(read).join("");
    return ["paragraph", "heading", "blockquote", "listItem", "codeBlock"].includes(node.type ?? "")
      ? `${text}\n`
      : text;
  };
  return read(document).replace(/\n{3,}/g, "\n\n").trimEnd();
}

export function plainTextToDocument(value: string): PortfolioDocument {
  return {
    type: "doc",
    content: value.split("\n").map((line) => ({
      type: "paragraph",
      ...(line ? { content: [{ type: "text", text: line }] } : {}),
    })),
  };
}

export function normalizePortfolioSelection(
  document: { content: { size: number }; textBetween: (from: number, to: number, separator?: string) => string },
  from: number,
  to: number,
): PortfolioSelection {
  const min = 1;
  const max = document.content.size;
  const start = Math.max(min, Math.min(from, to, max));
  const end = Math.max(start, Math.min(Math.max(from, to), max));
  const beforeStart = document.textBetween(0, start, "\n");
  const beforeEnd = document.textBetween(0, end, "\n");
  return {
    from: start,
    to: end,
    startLine: beforeStart.split("\n").length,
    endLine: beforeEnd.split("\n").length,
    quotedText: document.textBetween(start, end, "\n"),
  };
}
