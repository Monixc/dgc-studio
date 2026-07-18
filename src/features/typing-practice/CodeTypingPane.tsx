import { cn } from "@/lib/utils";
import { FileCode2, X } from "lucide-react";

type CharStatus = "correct" | "incorrect" | "pending";

interface Props {
  text: string;
  fileName: string;
  language: string;
  typedLength: number;
  statuses: readonly CharStatus[];
  inputRef: React.RefObject<HTMLTextAreaElement>;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
  hint?: string;
  source?: string;
  license?: string;
}

export default function CodeTypingPane({
  text,
  fileName,
  language,
  typedLength,
  statuses,
  inputRef,
  onKeyDown,
  disabled,
  hint,
  source,
  license,
}: Props) {
  const lines = text.split("\n");
  const lineCount = lines.length;
  const gutterWidth = String(lineCount).length;
  const typedLines = text.slice(0, typedLength).split("\n");
  const cursorLine = typedLines.length;
  const cursorColumn = (typedLines.at(-1)?.length ?? 0) + 1;

  let offset = 0;

  return (
    <section
      className="relative cursor-text overflow-hidden rounded-xl border border-zinc-700/80 bg-[#0d1117] text-zinc-100 shadow-sm"
      onClick={() => !disabled && inputRef.current?.focus()}
    >
      {/* Window title bar */}
      <div className="relative flex h-9 items-center border-b border-zinc-800 bg-[#161b22] px-3">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-[#ff5f56]" />
          <span className="size-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="size-2.5 rounded-full bg-[#27c93f]" />
        </div>
        <span className="pointer-events-none absolute inset-x-24 truncate text-center text-[11px] text-zinc-500">
          typing-practice — {language}
        </span>
        <span className="ml-auto hidden shrink-0 text-[10px] text-zinc-500 sm:inline">{hint}</span>
      </div>

      {/* Editor tabs */}
      <div className="flex h-10 items-end overflow-x-auto border-b border-zinc-800 bg-[#0b0f14]">
        <div className="flex h-full min-w-0 items-center gap-2 border-t-2 border-t-sky-500 bg-[#0d1117] px-3 text-xs text-zinc-200">
          <FileCode2 className="size-4 shrink-0 text-sky-400" />
          <span className="max-w-[13rem] truncate sm:max-w-sm">{fileName}</span>
          <X className="size-3.5 shrink-0 text-zinc-600" aria-hidden />
        </div>
        <span className="ml-auto hidden h-full items-center px-3 text-[10px] uppercase tracking-wider text-zinc-600 sm:flex">
          {language}
        </span>
      </div>

      {/* Editor body */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full px-0 py-3 font-mono text-[13px] leading-6 sm:text-sm sm:leading-7">
          {lines.map((line, lineIndex) => {
            const lineStart = offset;
            const lineChars = line.length;
            const nodes: React.ReactNode[] = [];

            for (let i = 0; i <= lineChars; i++) {
              const globalIndex = lineStart + i;
              const isEOL = i === lineChars;
              const char = isEOL ? (lineIndex < lines.length - 1 ? "\n" : null) : line[i]!;
              if (char === null) continue;

              const status = statuses[globalIndex] ?? "pending";
              const isCursor = globalIndex === typedLength && !disabled;

              nodes.push(
                <span
                  key={`${lineIndex}-${i}`}
                  className={cn(
                    "relative",
                    status === "correct" && "text-emerald-400",
                    status === "incorrect" && "bg-red-500/30 text-red-300",
                    status === "pending" && "text-zinc-500",
                    isCursor && "rounded-sm bg-sky-500/25 text-zinc-200",
                  )}
                >
                  {char === "\n" ? (
                    <span className="select-none text-zinc-700">↵</span>
                  ) : char === " " ? (
                    "\u00A0"
                  ) : char === "\t" ? (
                    <span className="inline-block w-8">{"\u00A0".repeat(2)}</span>
                  ) : (
                    char
                  )}
                  {isCursor && (
                    <span className="absolute bottom-0 left-0 h-0.5 w-full animate-pulse bg-sky-400" />
                  )}
                </span>,
              );
            }

            offset += lineChars + (lineIndex < lines.length - 1 ? 1 : 0);

            return (
              <div
                key={lineIndex}
                className={cn(
                  "flex min-h-[1.75rem]",
                  typedLength >= lineStart && typedLength <= lineStart + lineChars
                    && "bg-sky-500/[0.06]",
                )}
              >
                <span
                  className="sticky left-0 select-none bg-[#0d1117] px-3 text-right text-zinc-600"
                  style={{ minWidth: `${gutterWidth + 2}ch` }}
                >
                  {lineIndex + 1}
                </span>
                <span className="flex-1 whitespace-pre pr-4">{nodes}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="h-1 bg-zinc-900">
        <div
          className="h-full bg-sky-500 transition-[width]"
          style={{ width: `${text.length ? (typedLength / text.length) * 100 : 0}%` }}
        />
      </div>

      <div className="flex h-6 items-center gap-3 bg-sky-700 px-3 text-[10px] text-sky-50">
        <span className="truncate" title={source}>
          {license || "code"}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <span>Ln {cursorLine}, Col {cursorColumn}</span>
          <span>{language}</span>
          <span>{typedLength}/{text.length}</span>
        </div>
      </div>

      <textarea
        ref={inputRef}
        value=""
        aria-label="코드 타자 입력"
        autoFocus
        disabled={disabled}
        onChange={() => undefined}
        onKeyDown={onKeyDown}
        onPaste={(e) => e.preventDefault()}
        className="absolute size-px opacity-0"
      />
    </section>
  );
}
