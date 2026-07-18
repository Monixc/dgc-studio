import type { WorkspaceBlock } from "./types";

export type CodeToBlocksResult =
  | { ok: true; blocks: WorkspaceBlock[] }
  | { ok: false; error: string; line?: number };

interface LineTok {
  indent: number;
  text: string;
  lineNo: number;
}

let uidSeq = 1;

export function resetReverseParseUids(start = 1): void {
  uidSeq = start;
}

function allocUid(): number {
  return uidSeq++;
}

function makeBlock(
  id: string,
  slots: Record<string, string> = {},
  body?: WorkspaceBlock[],
  elseBody?: WorkspaceBlock[],
): WorkspaceBlock {
  const block: WorkspaceBlock = { uid: allocUid(), id, slots };
  if (body !== undefined) block.body = body;
  if (elseBody !== undefined) block.elseBody = elseBody;
  return block;
}

function tokenizeLines(code: string): LineTok[] {
  return code
    .split(/\r?\n/)
    .map((raw, i) => {
      const m = raw.match(/^(\s*)(.*)$/);
      const spaces = m?.[1] ?? "";
      const indent = spaces.replace(/\t/g, "    ").length;
      const text = m?.[2] ?? "";
      return { indent, text, lineNo: i + 1 };
    })
    .filter((l) => l.text.trim() && !l.text.trim().startsWith("#"));
}

function findTopLevelOp(expr: string, op: string): number {
  let depth = 0;
  let inStr: "'" | '"' | null = null;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (inStr) {
      if (ch === inStr && expr[i - 1] !== "\\") inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      inStr = ch;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    else if (depth === 0 && expr.startsWith(op, i)) return i;
  }
  return -1;
}

function splitBinaryRhs(rhs: string): { a: string; op: string; b: string } | null {
  for (const op of ["**", "//", "+", "-", "*", "/", "%"]) {
    const idx = findTopLevelOp(rhs, op);
    if (idx > 0) {
      return {
        a: rhs.slice(0, idx).trim(),
        op,
        b: rhs.slice(idx + op.length).trim(),
      };
    }
  }
  return null;
}

const OP_BLOCK: Record<string, string> = {
  "+": "operator_add",
  "-": "operator_sub",
  "*": "operator_mul",
  "/": "operator_div",
  "//": "operator_floordiv",
  "%": "operator_mod",
  "**": "operator_pow",
};

function parseAssign(trimmed: string): WorkspaceBlock | null {
  const m = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
  if (!m) return null;
  const result = m[1];
  const rhs = m[2].trim();

  const bin = splitBinaryRhs(rhs);
  if (bin && OP_BLOCK[bin.op]) {
    return makeBlock(OP_BLOCK[bin.op], { result, a: bin.a, b: bin.b });
  }

  const builtins: Array<[RegExp, string, (cap: RegExpMatchArray) => Record<string, string> & { __id?: string }]> = [
    [/^input\((.*)\)$/, "input_stmt", (c) => ({ name: result, prompt: c[1].trim() })],
    [/^float\((.+)\)$/, "builtin_float", (c) => ({ result, value: c[1].trim() })],
    [/^bool\((.+)\)$/, "builtin_bool", (c) => ({ result, value: c[1].trim() })],
    [/^abs\((.+)\)$/, "builtin_abs", (c) => ({ result, value: c[1].trim() })],
    [/^ord\((.+)\)$/, "builtin_ord", (c) => ({ result, value: c[1].trim() })],
    [/^chr\((.+)\)$/, "builtin_chr", (c) => ({ result, value: c[1].trim() })],
    [/^type\((.+)\)$/, "builtin_type", (c) => ({ result, value: c[1].trim() })],
    [/^sum\((.+)\)$/, "builtin_sum", (c) => ({ result, value: c[1].trim() })],
    [/^sorted\((.+)\)$/, "builtin_sorted", (c) => ({ result, value: c[1].trim() })],
    [/^min\((.+),\s*(.+)\)$/, "builtin_min", (c) => ({ result, a: c[1].trim(), b: c[2].trim() })],
    [/^max\((.+),\s*(.+)\)$/, "builtin_max", (c) => ({ result, a: c[1].trim(), b: c[2].trim() })],
    [/^round\((.+),\s*(.+)\)$/, "builtin_round", (c) => ({ result, value: c[1].trim(), digits: c[2].trim() })],
    [/^round\((.+)\)$/, "builtin_round", (c) => ({ result, value: c[1].trim(), digits: "" })],
    [/^isinstance\((.+),\s*(.+)\)$/, "builtin_isinstance", (c) => ({ result, value: c[1].trim(), type_name: c[2].trim() })],
    [/^list\(range\((.+),\s*(.+)\)\)$/, "builtin_range_from", (c) => ({ result, start: c[1].trim(), stop: c[2].trim() })],
    [/^(\w+)\[([^:]*):([^\]]*)\]$/, "str_slice", (c) => ({ result, var: c[1], start: c[2].trim(), stop: c[3].trim() })],
    [/^(\w+)\[([^\]]+)\]$/, "subscript_get", (c) => ({ result, var: c[1], index: c[2].trim() })],
    [/^len\((.+)\)$/, "builtin_len", (c) => ({ result, var: c[1].trim() })],
    [/^int\((.+)\)$/, "builtin_int", (c) => ({ result, value: c[1].trim() })],
    [/^str\((.+)\)$/, "builtin_str", (c) => ({ result, value: c[1].trim() })],
    [/^list\(range\((.+)\)\)$/, "builtin_range", (c) => ({ result, stop: c[1].trim() })],
    [/^(\w+)\.startswith\((.+)\)$/, "str_startswith", (c) => ({ result, var: c[1], prefix: c[2].trim() })],
    [/^(\w+)\.endswith\((.+)\)$/, "str_endswith", (c) => ({ result, var: c[1], suffix: c[2].trim() })],
    [/^(\w+)\.find\((.+)\)$/, "str_find", (c) => ({ result, var: c[1], sub: c[2].trim() })],
    [/^(\w+)\.upper\(\)$/, "str_upper", (c) => ({ result, var: c[1] })],
    [/^(\w+)\.lower\(\)$/, "str_lower", (c) => ({ result, var: c[1] })],
    [/^(\w+)\.strip\(\)$/, "str_strip", (c) => ({ result, var: c[1] })],
    [/^(\w+)\.split\((.+)\)$/, "str_split", (c) => ({ result, var: c[1], sep: c[2].trim() })],
    [/^(.+)\.join\((\w+)\)$/, "str_join", (c) => ({ result, sep: c[1].trim(), var: c[2] })],
    [
      /^(\w+)\.replace\((.+),\s*(.+)\)$/,
      "str_replace",
      (c) => ({ result, var: c[1], old: c[2].trim(), new: c[3].trim() }),
    ],
    [/^(\w+)\.get\((.+),\s*(.+)\)$/, "dict_get", (c) => ({ result, var: c[1], key: c[2].trim(), default: c[3].trim() })],
    [/^(\w+)\.pop\(\)$/, "list_pop", (c) => ({ result, var: c[1] })],
    [
      /^(\w+)\.pop\((.+)\)$/,
      "__pop__",
      (c) => {
        const arg = c[2].trim();
        if (/^\d+$/.test(arg)) {
          return { __id: "list_pop_at", result, var: c[1], index: arg };
        }
        return { __id: "dict_pop", result, var: c[1], key: arg };
      },
    ],
    [/^list\((\w+)\.keys\(\)\)$/, "dict_keys", (c) => ({ result, var: c[1] })],
    [/^(\w+)\.index\((.+)\)$/, "list_index", (c) => ({ result, var: c[1], value: c[2].trim() })],
    [/^(\w+)\.count\((.+)\)$/, "list_count", (c) => ({ result, var: c[1], value: c[2].trim() })],
  ];
  for (const [re, id, slots] of builtins) {
    const cap = rhs.match(re);
    if (cap) {
      const s = slots(cap);
      const blockId = s.__id ?? id;
      const { __id: _, ...rest } = s;
      return makeBlock(blockId, rest);
    }
  }

  if (rhs === "{}") return makeBlock("dict_empty", { var: result, body: "{}" });
  if (rhs === "[]") return makeBlock("list_empty", { name: result, body: "[]" });
  if (rhs === "()") return makeBlock("tuple_init", { name: result, body: "()" });
  if (rhs.startsWith("[")) return makeBlock("list_empty", { name: result, body: rhs });
  if (rhs.startsWith("(")) return makeBlock("tuple_init", { name: result, body: rhs });
  if (rhs.startsWith("{")) return makeBlock("dict_set", { var: result, body: rhs });

  return makeBlock("var_set", { name: result, value: rhs });
}

function parseMethodCall(trimmed: string): WorkspaceBlock | null {
  const methods: Array<[RegExp, string, (cap: RegExpMatchArray) => Record<string, string>]> = [
    [/^(\w+)\.append\((.+)\)$/, "list_append", (c) => ({ var: c[1], value: c[2].trim() })],
    [/^(\w+)\.insert\((.+),\s*(.+)\)$/, "list_insert", (c) => ({ var: c[1], index: c[2].trim(), value: c[3].trim() })],
    [/^(\w+)\.extend\((.+)\)$/, "list_extend", (c) => ({ var: c[1], other: c[2].trim() })],
    [/^(\w+)\.remove\((.+)\)$/, "list_remove", (c) => ({ var: c[1], value: c[2].trim() })],
    [/^(\w+)\[([^\]]+)\]\s*=\s*(.+)$/, "dict_set_item", (c) => ({ var: c[1], key: c[2].trim(), value: c[3].trim() })],
    [/^(\w+)\.update\((.+)\)$/, "dict_update", (c) => ({ var: c[1], other: c[2].trim() })],
    [/^(\w+)\.clear\(\)$/, "dict_clear", (c) => ({ var: c[1] })],
    [/^(\w+)\.sort\(\)$/, "list_sort", (c) => ({ var: c[1] })],
    [/^(\w+)\.reverse\(\)$/, "list_reverse", (c) => ({ var: c[1] })],
  ];
  for (const [re, id, slots] of methods) {
    const cap = trimmed.match(re);
    if (cap) return makeBlock(id, slots(cap));
  }
  return null;
}

function parseStatement(trimmed: string): WorkspaceBlock | null {
  if (trimmed === "pass") return makeBlock("pass_stmt", {});

  const printM = trimmed.match(/^print\((.*)\)\s*$/);
  if (printM) return makeBlock("print", { value: printM[1].trim() });

  if (trimmed === "break") return makeBlock("break_loop", {});

  const importM = trimmed.match(/^import\s+(\w+)\s*$/);
  if (importM) return makeBlock("import_stmt", { module: importM[1] });

  const retM = trimmed.match(/^return\s+(.+)$/);
  if (retM) return makeBlock("func_return", { value: retM[1].trim() });

  const callM = trimmed.match(/^(\w+)\((.*)\)\s*$/);
  if (callM) return makeBlock("func_call", { name: callM[1], args: callM[2].trim() });

  const assign = parseAssign(trimmed);
  if (assign) return assign;

  return parseMethodCall(trimmed);
}

function parseIfChain(
  lines: LineTok[],
  start: number,
  baseIndent: number,
): { blocks: WorkspaceBlock[]; next: number } {
  const first = lines[start];
  const ifCond = first.text.trim().match(/^if\s+(.+):\s*$/)![1];
  const bodyResult = parseBlockList(lines, start + 1, baseIndent + 4);

  let i = bodyResult.next;
  const elifBlocks: WorkspaceBlock[] = [];
  let sawElif = false;

  while (i < lines.length && lines[i].indent === baseIndent) {
    const elifM = lines[i].text.trim().match(/^elif\s+(.+):\s*$/);
    if (!elifM) break;
    sawElif = true;
    const elifBody = parseBlockList(lines, i + 1, baseIndent + 4);
    elifBlocks.push(makeBlock("elif", { cond: elifM[1] }, elifBody.blocks));
    i = elifBody.next;
  }

  let elseBody: WorkspaceBlock[] | undefined;
  if (i < lines.length && lines[i].indent === baseIndent && lines[i].text.trim() === "else:") {
    const elseResult = parseBlockList(lines, i + 1, baseIndent + 4);
    elseBody = elseResult.blocks;
    i = elseResult.next;
  }

  if (!sawElif && elseBody !== undefined) {
    return {
      blocks: [makeBlock("if_else", { cond: ifCond }, bodyResult.blocks, elseBody)],
      next: i,
    };
  }

  const blocks: WorkspaceBlock[] = [makeBlock("if", { cond: ifCond }, bodyResult.blocks)];
  blocks.push(...elifBlocks);
  if (elseBody !== undefined) {
    blocks.push(makeBlock("else", {}, elseBody));
  }
  return { blocks, next: i };
}

function parseBlockList(
  lines: LineTok[],
  start: number,
  baseIndent: number,
): { blocks: WorkspaceBlock[]; next: number } {
  const blocks: WorkspaceBlock[] = [];
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    if (line.indent < baseIndent) break;
    if (line.indent > baseIndent) {
      throw new Error(`${line.lineNo}행: 들여쓰기가 맞지 않아요`);
    }

    const trimmed = line.text.trim();

    const ifM = trimmed.match(/^if\s+(.+):\s*$/);
    if (ifM) {
      const chain = parseIfChain(lines, i, baseIndent);
      blocks.push(...chain.blocks);
      i = chain.next;
      continue;
    }

    const forM = trimmed.match(/^for\s+(\w+)\s+in\s+range\((.+)\)\s*:$/);
    if (forM) {
      const body = parseBlockList(lines, i + 1, baseIndent + 4);
      const rangeArgs = forM[2].split(",").map((s) => s.trim());
      if (rangeArgs.length >= 2) {
        blocks.push(
          makeBlock("for_range_from", { var: forM[1], start: rangeArgs[0], stop: rangeArgs[1] }, body.blocks),
        );
      } else {
        blocks.push(makeBlock("for_range", { var: forM[1], stop: rangeArgs[0] }, body.blocks));
      }
      i = body.next;
      continue;
    }

    const whileM = trimmed.match(/^while\s+(.+):\s*$/);
    if (whileM) {
      const body = parseBlockList(lines, i + 1, baseIndent + 4);
      blocks.push(makeBlock("while_loop", { cond: whileM[1] }, body.blocks));
      i = body.next;
      continue;
    }

    const defM = trimmed.match(/^def\s+(\w+)\s*\(([^)]*)\)\s*:$/);
    if (defM) {
      const body = parseBlockList(lines, i + 1, baseIndent + 4);
      blocks.push(makeBlock("def_func", { name: defM[1], params: defM[2].trim() }, body.blocks));
      i = body.next;
      continue;
    }

    const stmt = parseStatement(trimmed);
    if (!stmt) {
      i++;
      continue;
    }
    blocks.push(stmt);
    i++;
  }

  return { blocks, next: i };
}

/** Python 소스(부분집합) → 블록 작업대 트리 */
export function codeToBlocks(code: string): CodeToBlocksResult {
  try {
    resetReverseParseUids(1);
    const lines = tokenizeLines(code);
    if (!lines.length) return { ok: true, blocks: [] };

    const { blocks, next } = parseBlockList(lines, 0, 0);
    if (next < lines.length) {
      const rest = lines[next];
      return {
        ok: false,
        error: `지원하지 않는 문법 (${rest.lineNo}행): ${rest.text.trim()}`,
        line: rest.lineNo,
      };
    }
    return { ok: true, blocks };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
