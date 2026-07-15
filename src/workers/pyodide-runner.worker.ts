/// <reference lib="webworker" />
// Pyodide 실행 워커 (module worker). CDN ESM 에서 pyodide 로드.
// 표준입력은 미리 주어진 stdin 문자열을 소비(블로킹 input() 없음 — SharedArrayBuffer 불필요).
// 무한루프는 메인 스레드가 worker.terminate() 로 중단(타임아웃).

const PYODIDE_VERSION = "0.26.4";
const BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

type InMsg = { type: "init" } | { type: "run"; id: number; code: string; stdin: string };
type OutMsg =
  | { type: "ready" }
  | { type: "stdout"; text: string }
  | { type: "stderr"; text: string }
  | { type: "result"; id: number; ok: boolean; error?: string };

let pyodide: any = null;
let loading: Promise<void> | null = null;

const post = (m: OutMsg) => (self as unknown as Worker).postMessage(m);

async function ensurePyodide() {
  if (pyodide) return;
  if (!loading) {
    loading = (async () => {
      const mod = await import(/* @vite-ignore */ `${BASE}pyodide.mjs`);
      pyodide = await mod.loadPyodide({ indexURL: BASE });
      pyodide.globals.set("_stdout_cb", (s: string) => post({ type: "stdout", text: s }));
      pyodide.globals.set("_stderr_cb", (s: string) => post({ type: "stderr", text: s }));
    })();
  }
  await loading;
}

const SETUP = `
import sys, io
class _W:
    def __init__(self, cb): self.cb = cb
    def write(self, s):
        self.cb(s)
        return len(s)
    def flush(self): pass

def _flowpy_setup(stdin_text):
    sys.stdout = _W(_stdout_cb)
    sys.stderr = _W(_stderr_cb)
    sys.stdin = io.StringIO(stdin_text)
`;

self.onmessage = async (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  if (msg.type === "init") {
    await ensurePyodide();
    post({ type: "ready" });
    return;
  }
  if (msg.type === "run") {
    try {
      await ensurePyodide();
      await pyodide.runPythonAsync(SETUP);
      pyodide.globals.get("_flowpy_setup")(msg.stdin ?? "");
      await pyodide.runPythonAsync(msg.code);
      post({ type: "result", id: msg.id, ok: true });
    } catch (err: any) {
      const text = String(err?.message ?? err);
      post({ type: "stderr", text });
      post({ type: "result", id: msg.id, ok: false, error: text });
    }
  }
};
