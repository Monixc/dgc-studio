import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import Editor from "@monaco-editor/react";
import { Play, Square } from "lucide-react";
import type { RunOptions, RunResult } from "@/hooks/usePyodide";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ConsoleLine {
  kind: "out" | "err";
  text: string;
}

interface Props {
  code: string;
  onCodeChange: (v: string) => void;
  readOnly?: boolean;
  running: boolean;
  run: (code: string, opts?: RunOptions) => Promise<RunResult>;
  stop: () => void;
  /** 하단 액션 영역(제출 버튼 등) */
  footer?: ReactNode;
  /** 실행 완료 시 콘솔 라인 전달(라이브 뷰 브로드캐스트 등) */
  onResult?: (lines: ConsoleLine[]) => void;
  /** 기본 Monaco 에디터 대신 렌더할 커스텀 에디터(블록 코딩 작업대 등) */
  editor?: ReactNode;
}

export default function EditorPanel({ code, onCodeChange, readOnly, running, run, stop, footer, onResult, editor }: Props) {
  const [stdin, setStdin] = useState("");
  const [lines, setLines] = useState<ConsoleLine[]>([]);

  async function handleRun() {
    // input() 호출이 있는데 stdin 이 비면 파이썬 오류 대신 안내
    if (/\binput\s*\(/.test(code) && stdin.trim() === "") {
      toast.warning("입력값을 먼저 넣고 실행해주세요.");
      const warn: ConsoleLine[] = [{ kind: "err", text: '입력값이 필요합니다. 왼쪽 "입력 (stdin)" 칸에 값을 넣고 실행하세요.' }];
      setLines(warn);
      return;
    }
    setLines([]);
    const collected: ConsoleLine[] = [];
    const append = (kind: ConsoleLine["kind"], text: string) => {
      collected.push({ kind, text });
      setLines((l) => [...l, { kind, text }]);
    };
    const res = await run(code, {
      stdin,
      timeoutMs: 5000,
      onStdout: (t) => append("out", t),
      onStderr: (t) => append("err", t),
    });
    // 일반 에러는 워커가 stderr 로 이미 스트리밍함. 타임아웃/중단만 별도 표기.
    if (res.timedOut) append("err", res.error ?? "");
    onResult?.(collected);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b p-2">
        <div className="mr-1 flex gap-1.5">
          <span className="size-2.5 rounded-full bg-red-400" />
          <span className="size-2.5 rounded-full bg-yellow-400" />
          <span className="size-2.5 rounded-full bg-green-400" />
        </div>
        <Button size="sm" onClick={handleRun} disabled={running}>
          <Play /> 실행
        </Button>
        <Button size="sm" variant="outline" onClick={stop} disabled={!running}>
          <Square /> 중단
        </Button>
        {running && <span className="text-xs text-muted-foreground">실행 중…</span>}
        <div className="ml-auto flex gap-2">{footer}</div>
      </div>

      <div className="min-h-0 flex-1">
        {editor ?? (
          <Editor
            language="python"
            value={code}
            onChange={(v) => onCodeChange(v ?? "")}
            options={{ readOnly, minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false, padding: { top: 8 } }}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-px border-t bg-border" style={{ height: 180 }}>
        <div className="flex flex-col bg-background">
          <div className="border-b px-2 py-1 text-xs font-semibold text-muted-foreground">입력 (stdin)</div>
          <textarea
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            placeholder="input() 이 읽을 값을 줄 단위로 입력"
            className="flex-1 resize-none bg-background p-2 font-mono text-xs outline-none"
          />
        </div>
        <div className="flex min-h-0 flex-col bg-background">
          <div className="border-b px-2 py-1 text-xs font-semibold text-muted-foreground">출력</div>
          <pre className="min-h-0 flex-1 overflow-auto p-2 font-mono text-xs">
            {lines.length === 0 ? (
              <span className="text-muted-foreground">실행 결과가 여기에 표시됩니다.</span>
            ) : (
              lines.map((l, i) => (
                <span key={i} className={cn(l.kind === "err" && "text-destructive")}>
                  {l.text}
                </span>
              ))
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}
