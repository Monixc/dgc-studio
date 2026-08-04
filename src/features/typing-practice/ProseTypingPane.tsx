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
      className="relative flex min-h-[55vh] cursor-text flex-col overflow-hidden rounded-none border bg-card shadow-none"
      onClick={() => !disabled && inputRef.current?.focus()}
    >
      <div className="relative flex flex-1 flex-col px-5 py-5 sm:px-10 sm:py-8 md:px-14">
        <header className="mb-5 border-b pb-4 text-center">
          <p className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {title}
          </p>
          {author && (
            <p className="mt-1 text-sm italic text-muted-foreground">
              {author}
            </p>
          )}
          <p className="mt-2 text-[11px] tracking-wide text-muted-foreground">
            {hint ?? "읽으며 입력하세요"}
          </p>
        </header>

        <div className="mx-auto flex max-w-3xl flex-1 items-center">
          <div className="whitespace-pre-wrap break-words text-base leading-8 text-foreground/90 sm:text-lg sm:leading-9">
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
                    status === "pending" && onCurrentLine && "text-foreground",
                    status === "pending" && !onCurrentLine && "text-muted-foreground",
                    isCursor && "rounded-[2px] bg-accent",
                  )}
                >
                  {char === "\n" ? (
                    <>
                      <span className="select-none text-muted-foreground/50">↵</span>
                      <br />
                    </>
                  ) : char}
                  {isCursor && (
                    <span className="absolute bottom-0 left-0 h-0.5 w-full animate-pulse bg-primary" />
                  )}
                </span>
              );
              if (char === "\n") line += 1;
              return node;
            })}
          </div>
        </div>

        <footer className="mt-6 flex items-center justify-between gap-3 border-t pt-3 text-[10px] text-muted-foreground">
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
