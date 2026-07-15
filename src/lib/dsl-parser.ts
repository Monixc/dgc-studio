import type { FlowchartData, FlowNode, FlowEdge, NodeType, ParseError, ParseResult } from "@/types/flowchart";

/**
 * Flow-Py DSL v2 — Python 유사 들여쓰기 블록.
 *
 *   start
 *   input n
 *   if n > 0
 *       output "양수"
 *   elif n == 0
 *       output "영"
 *   else
 *       output "음수"
 *   for i in range(1, n+1)
 *       process total += i
 *   while x > 0
 *       process x -= 1
 *   def greet(name)
 *       output "hi " + name
 *   end
 *
 * 블록은 들여쓰기로 열고 dedent 로 닫는다(명시 end 키워드 불필요).
 * 인식 키워드: start end input output process call if elif else for while def.
 * 그 외 줄은 process 로 관대하게 처리(예: `total = 0`).
 */

const INDENT_TAB = "    "; // 탭 1개 = 스페이스 4

interface Line {
  indent: number;
  keyword: string;
  rest: string;
  line: number;
}

type Stmt =
  | { kind: "start"; line: number }
  | { kind: "end"; line: number }
  | { kind: "simple"; type: "input" | "output" | "process" | "call"; text: string; line: number }
  | { kind: "if"; branches: { cond: string; body: Stmt[]; line: number }[]; elseBody?: Stmt[]; line: number }
  | { kind: "for"; header: string; body: Stmt[]; line: number }
  | { kind: "while"; cond: string; body: Stmt[]; line: number }
  | { kind: "def"; sig: string; body: Stmt[]; line: number };

const COMPOUND = new Set(["if", "elif", "else", "for", "while", "def"]);

function lex(src: string): Line[] {
  const out: Line[] = [];
  src.split(/\r?\n/).forEach((raw, i) => {
    const expanded = raw.replace(/\t/g, INDENT_TAB);
    const trimmedStart = expanded.trimStart();
    if (!trimmedStart || trimmedStart.startsWith("#")) return; // 빈 줄·주석 줄 스킵
    const indent = expanded.length - trimmedStart.length;
    const m = trimmedStart.match(/^(\S+)\s*([\s\S]*)$/)!;
    out.push({ indent, keyword: m[1], rest: (m[2] || "").trim(), line: i + 1 });
  });
  return out;
}

/** parentIndent 보다 깊은 첫 줄부터 하나의 블록으로 파싱. 없으면 빈 body. */
function parseChild(lines: Line[], pos: number, parentIndent: number, errors: ParseError[]): { stmts: Stmt[]; pos: number } {
  if (pos >= lines.length || lines[pos].indent <= parentIndent) return { stmts: [], pos };
  return parseStatements(lines, pos, lines[pos].indent, errors);
}

function parseStatements(lines: Line[], start: number, indent: number, errors: ParseError[]): { stmts: Stmt[]; pos: number } {
  const stmts: Stmt[] = [];
  let pos = start;
  while (pos < lines.length) {
    const ln = lines[pos];
    if (ln.indent < indent) break; // dedent → 블록 종료
    if (ln.indent > indent) {
      errors.push({ line: ln.line, message: "예상치 못한 들여쓰기" });
      pos++;
      continue;
    }
    const kw = ln.keyword.toLowerCase();

    if (kw === "elif" || kw === "else") {
      errors.push({ line: ln.line, message: `'${kw}' 앞에 'if' 가 필요합니다` });
      pos++;
      continue;
    }

    if (kw === "if") {
      const branches: { cond: string; body: Stmt[]; line: number }[] = [];
      const child = parseChild(lines, pos + 1, indent, errors);
      branches.push({ cond: ln.rest, body: child.stmts, line: ln.line });
      pos = child.pos;
      while (pos < lines.length && lines[pos].indent === indent && lines[pos].keyword.toLowerCase() === "elif") {
        const e = lines[pos];
        const c = parseChild(lines, pos + 1, indent, errors);
        branches.push({ cond: e.rest, body: c.stmts, line: e.line });
        pos = c.pos;
      }
      let elseBody: Stmt[] | undefined;
      if (pos < lines.length && lines[pos].indent === indent && lines[pos].keyword.toLowerCase() === "else") {
        const c = parseChild(lines, pos + 1, indent, errors);
        elseBody = c.stmts;
        pos = c.pos;
      }
      stmts.push({ kind: "if", branches, elseBody, line: ln.line });
      continue;
    }

    if (kw === "for" || kw === "while" || kw === "def") {
      const c = parseChild(lines, pos + 1, indent, errors);
      if (kw === "for") stmts.push({ kind: "for", header: ln.rest, body: c.stmts, line: ln.line });
      else if (kw === "while") stmts.push({ kind: "while", cond: ln.rest, body: c.stmts, line: ln.line });
      else stmts.push({ kind: "def", sig: ln.rest, body: c.stmts, line: ln.line });
      pos = c.pos;
      continue;
    }

    if (kw === "start") stmts.push({ kind: "start", line: ln.line });
    else if (kw === "end") stmts.push({ kind: "end", line: ln.line });
    else if (kw === "input" || kw === "output" || kw === "call")
      stmts.push({ kind: "simple", type: kw, text: ln.rest, line: ln.line });
    else if (kw === "process") stmts.push({ kind: "simple", type: "process", text: ln.rest, line: ln.line });
    else stmts.push({ kind: "simple", type: "process", text: `${ln.keyword} ${ln.rest}`.trim(), line: ln.line });
    pos++;
  }
  return { stmts, pos };
}

const SIMPLE_FALLBACK: Record<string, string> = {
  input: "입력",
  output: "출력",
  process: "처리",
  call: "호출",
};

type Pending = { from: string; label?: string };

function generate(stmts: Stmt[]): FlowchartData {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  let nc = 0;
  let ec = 0;

  const addNode = (type: NodeType, label: string, scope?: string): string => {
    const id = `${type}_${nc++}`;
    nodes.push({ id, type, label, scope });
    return id;
  };
  const connect = (pending: Pending[], target: string) => {
    for (const p of pending) edges.push({ id: `e_${ec++}`, source: p.from, target, label: p.label });
  };

  function emitSeq(seq: Stmt[], pending: Pending[], scope?: string): Pending[] {
    let cur = pending;
    for (const s of seq) cur = emitStmt(s, cur, scope);
    return cur;
  }

  function emitStmt(s: Stmt, pending: Pending[], scope?: string): Pending[] {
    switch (s.kind) {
      case "start": {
        const id = addNode("start", "시작", scope);
        connect(pending, id);
        return [{ from: id }];
      }
      case "end": {
        const id = addNode("end", "끝", scope);
        connect(pending, id);
        return [];
      }
      case "simple": {
        const id = addNode(s.type, s.text || SIMPLE_FALLBACK[s.type], scope);
        connect(pending, id);
        return [{ from: id }];
      }
      case "for": {
        const id = addNode("for", s.header || "for", scope);
        connect(pending, id);
        const bodyExit = emitSeq(s.body, [{ from: id, label: "반복" }], scope);
        connect(bodyExit, id); // 되돌아가기
        return [{ from: id, label: "종료" }];
      }
      case "while": {
        const id = addNode("while", s.cond || "while", scope);
        connect(pending, id);
        const bodyExit = emitSeq(s.body, [{ from: id, label: "참" }], scope);
        connect(bodyExit, id);
        return [{ from: id, label: "거짓" }];
      }
      case "if": {
        let outs: Pending[] = [];
        let inbound = pending; // 현재 마름모로 들어오는 간선
        for (const br of s.branches) {
          const id = addNode("if", br.cond || "if", scope);
          connect(inbound, id);
          outs = outs.concat(emitSeq(br.body, [{ from: id, label: "참" }], scope));
          inbound = [{ from: id, label: "거짓" }]; // 거짓 → 다음 elif/else
        }
        if (s.elseBody) outs = outs.concat(emitSeq(s.elseBody, inbound, scope));
        else outs = outs.concat(inbound); // else 없으면 마지막 거짓이 흘러나감
        return outs;
      }
      case "def": {
        // 함수 정의는 독립 서브그래프. 메인 흐름(pending)은 통과.
        const fnScope = `def:${s.sig}`;
        const id = addNode("def", s.sig || "def", fnScope);
        emitSeq(s.body, [{ from: id }], fnScope);
        return pending;
      }
    }
  }

  emitSeq(stmts, []);
  return { nodes, edges };
}

export function parseDsl(src: string): ParseResult {
  const errors: ParseError[] = [];
  const lines = lex(src);
  if (lines.length && lines[0].indent !== 0) {
    errors.push({ line: lines[0].line, message: "첫 줄은 들여쓰기 없이 시작해야 합니다" });
  }
  const { stmts } = parseStatements(lines, 0, 0, errors);
  return { data: generate(stmts), errors };
}
