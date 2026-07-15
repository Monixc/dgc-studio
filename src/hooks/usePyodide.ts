import { useCallback, useEffect, useRef, useState } from "react";

export interface RunOptions {
  stdin?: string;
  timeoutMs?: number;
  onStdout?: (text: string) => void;
  onStderr?: (text: string) => void;
}

export interface RunResult {
  ok: boolean;
  output: string;
  error?: string;
  timedOut?: boolean;
}

interface RunState {
  id: number;
  resolve: (r: RunResult) => void;
  output: string;
  onStdout?: (t: string) => void;
  onStderr?: (t: string) => void;
  timer: ReturnType<typeof setTimeout>;
}

const DEFAULT_TIMEOUT = 5000;

export function usePyodide() {
  const workerRef = useRef<Worker | null>(null);
  const runRef = useRef<RunState | null>(null);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);

  const createWorker = useCallback(() => {
    const w = new Worker(new URL("../workers/pyodide-runner.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === "ready") {
        setReady(true);
        return;
      }
      const st = runRef.current;
      if (!st) return;
      if (m.type === "stdout") {
        st.output += m.text;
        st.onStdout?.(m.text);
      } else if (m.type === "stderr") {
        st.output += m.text;
        st.onStderr?.(m.text);
      } else if (m.type === "result" && m.id === st.id) {
        clearTimeout(st.timer);
        runRef.current = null;
        setRunning(false);
        st.resolve({ ok: m.ok, output: st.output, error: m.error });
      }
    };
    workerRef.current = w;
    w.postMessage({ type: "init" });
    return w;
  }, []);

  useEffect(() => {
    const w = createWorker();
    return () => w.terminate();
  }, [createWorker]);

  /** 타임아웃/중단: 워커를 종료하고 새로 띄운다. 진행 중 run 은 결과로 정리. */
  const killAndRestart = useCallback(
    (result: RunResult) => {
      workerRef.current?.terminate();
      setReady(false);
      const st = runRef.current;
      runRef.current = null;
      setRunning(false);
      createWorker();
      st?.resolve({ ...result, output: st.output });
    },
    [createWorker]
  );

  const run = useCallback(
    (code: string, opts: RunOptions = {}): Promise<RunResult> =>
      new Promise((resolve) => {
        if (!workerRef.current) createWorker();
        const w = workerRef.current!;
        const id = Date.now() + Math.random();
        const timer = setTimeout(
          () => killAndRestart({ ok: false, output: "", error: "실행 시간 초과 (무한 루프 의심)", timedOut: true }),
          opts.timeoutMs ?? DEFAULT_TIMEOUT
        );
        runRef.current = { id, resolve, output: "", onStdout: opts.onStdout, onStderr: opts.onStderr, timer };
        setRunning(true);
        w.postMessage({ type: "run", id, code, stdin: opts.stdin ?? "" });
      }),
    [createWorker, killAndRestart]
  );

  const stop = useCallback(() => {
    if (runRef.current) killAndRestart({ ok: false, output: "", error: "사용자가 중단함" });
  }, [killAndRestart]);

  return { ready, running, run, stop };
}
