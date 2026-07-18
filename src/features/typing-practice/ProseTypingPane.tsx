import { cn } from "@/lib/utils";

type CharStatus = "correct" | "incorrect" | "pending";

interface Props {
  text: string;
  title: string;
  author?: string;
  source?: string;
  typedLength: number;
  statuses: readonly CharStatus[];
  inputRef: React.RefObject<HTMLTextAreaElement>;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
  hint?: string;
}

function lineIndexAt(text: string, index: number): number {
  let line = 0;
  const end = Math.min(index, text.length);
  for (let i = 0; i < end; i++) {
    if (text[i] === "\n") line += 1;
  }
  return line;
}

export default function ProseTypingPane({
  text,
  title,
  author,
  source,
  typedLength,
  statuses,
  inputRef,
  onKeyDown,
  disabled,
  hint,
}: Props) {
  const chars = [...text];
  const currentLine = lineIndexAt(text, typedLength);
  let line = 0;

  return (
    <section
      className="relative cursor-text overflow-hidden rounded-2xl border border-amber-900/15 bg-[#f6f0e4] shadow-sm dark:border-amber-200/10 dark:bg-[#1a1712]"
      onClick={() => !disabled && inputRef.current?.focus()}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-amber-900/10 to-transparent dark:from-black/30 sm:w-10"
        aria-hidden
      />
      <div className="relative px-5 py-5 sm:px-10 sm:py-8 md:px-14">
        <header className="mb-5 border-b border-amber-900/10 pb-4 text-center dark:border-amber-100/10">
          <p className="font-serif text-lg font-semibold tracking-tight text-amber-950 dark:text-amber-50 sm:text-xl">
            {title}
          </p>
          {author && (
            <p className="mt-1 font-serif text-sm italic text-amber-900/60 dark:text-amber-100/50">
              {author}
            </p>
          )}
          <p className="mt-2 text-[11px] tracking-wide text-amber-900/45 dark:text-amber-100/35">
            {hint ?? "읽으며 입력하세요"}
          </p>
        </header>

        <div className="mx-auto max-w-3xl whitespace-pre-wrap break-words font-serif text-base leading-8 text-amber-950/90 dark:text-amber-50/85 sm:text-lg sm:leading-9">
          {chars.map((char, index) => {
            const status = statuses[index] ?? "pending";
            const isCursor = index === typedLength && !disabled;
            const onCurrentLine = line === currentLine;
            const node = (
              <span
                key={index}
                className={cn(
                  "relative transition-colors",
                  onCurrentLine ? "opacity-100" : "opacity-45",
                  status === "correct" && "text-emerald-700 dark:text-emerald-400",
                  status === "incorrect" && "bg-red-500/20 text-red-700 dark:text-red-400",
                  status === "pending" && onCurrentLine && "text-amber-950 dark:text-amber-50",
                  status === "pending" && !onCurrentLine && "text-amber-900/50 dark:text-amber-100/40",
                  isCursor && "rounded-[2px] bg-amber-800/15 dark:bg-amber-200/20",
                )}
              >
                {char === "\n" ? (
                  <>
                    <span className="select-none text-amber-900/25 dark:text-amber-100/20">↵</span>
                    <br />
                  </>
                ) : char}
                {isCursor && (
                  <span className="absolute bottom-0 left-0 h-0.5 w-full animate-pulse bg-amber-800 dark:bg-amber-200" />
                )}
              </span>
            );
            if (char === "\n") line += 1;
            return node;
          })}
        </div>

        <footer className="mt-6 flex items-center justify-between gap-3 border-t border-amber-900/10 pt-3 text-[10px] text-amber-900/40 dark:border-amber-100/10 dark:text-amber-100/30">
          <span className="truncate">{source || "Public domain literature"}</span>
          <span className="shrink-0 font-mono">
            {typedLength}/{text.length}
          </span>
        </footer>
      </div>

      <textarea
        ref={inputRef}
        value=""
        aria-label="영문 타자 입력"
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
