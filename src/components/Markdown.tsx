import { marked } from "marked";
import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";

// 마크다운(교사 작성) 렌더. marked로 HTML 변환 후 DOMPurify로 정화.
export function Markdown({ children, className }: { children: string; className?: string }) {
  const html = DOMPurify.sanitize(marked.parse(children, { async: false }) as string);
  return (
    <div
      className={cn(
        "text-sm leading-relaxed break-words",
        "[&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_h3]:font-semibold",
        "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em]",
        "[&_pre]:my-2 [&_pre]:overflow-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_strong]:font-semibold [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
