import { getBlockDef, isExprNestBlock, isReporterBlock } from "./catalog";
import type { BlockDef } from "./catalog";
import { formatParamsSignature, parseParamSpecs } from "./functions";
import type { BlockScript, WorkspaceBlock } from "./types";

export type { BlockScript } from "./types";

export function blocksToCode(script: BlockScript): string {
  const lines = emitBlocks(script.blocks, 0);
  return lines.join("\n") + (lines.length ? "\n" : "");
}

function pyOperator(op: string): string {
  if (op === "×") return "*";
  if (op === "÷") return "/";
  return op;
}

function slotToExpr(block: WorkspaceBlock, slotName: string): string {
  const nested = block.nestedSlots?.[slotName];
  if (nested) return emitReporterExpr(nested);
  const text = block.slots[slotName]?.trim();
  if (text) return text;
  const def = getBlockDef(block.id);
  return def?.slots.find((s) => s.name === slotName)?.default ?? "";
}

function emitReporterExpr(block: WorkspaceBlock): string {
  const d = getBlockDef(block.id);
  if (!d || !isExprNestBlock(block.id)) return "None";

  const ui = d.ui;

  if (ui.type === "compare") {
    if (ui.op === "not") {
      return `not ${slotToExpr(block, ui.left)}`;
    }
    const a = slotToExpr(block, ui.left);
    const b = ui.right ? slotToExpr(block, ui.right) : "";
    return `${a} ${ui.op} ${b}`;
  }

  if (ui.type === "operator") {
    return `${slotToExpr(block, "a")} ${pyOperator(ui.op)} ${slotToExpr(block, "b")}`;
  }

  if (ui.type === "builtin") {
    const args = ui.args
      .map((a) => slotToExpr(block, a))
      .filter((a, i) => a !== "" || ui.fn !== "round" || i === 0);
    if (ui.fn === "round" && args.length === 2 && !block.slots.digits?.trim() && !block.nestedSlots?.digits) {
      return `round(${args[0]})`;
    }
    return `${ui.fn}(${args.join(", ")})`;
  }

  if (ui.type === "store_method") {
    const targetSlot = ui.target ?? "var";
    const target = slotToExpr(block, targetSlot);
    const args = ui.args.map((a) => slotToExpr(block, a));
    if (ui.method === "keys") return `list(${target}.keys())`;
    if (ui.method === "values") return `list(${target}.values())`;
    if (ui.method === "items") return `list(${target}.items())`;
    return `${target}.${ui.method}(${args.join(", ")})`;
  }

  if (ui.type === "join") {
    return `${slotToExpr(block, ui.sep)}.join(${slotToExpr(block, ui.items)})`;
  }

  if (ui.type === "subscript_get") {
    return `${slotToExpr(block, ui.target)}[${slotToExpr(block, ui.index)}]`;
  }

  if (ui.type === "str_slice") {
    const target = slotToExpr(block, ui.target);
    const start = slotToExpr(block, ui.start);
    const stopText = block.slots.stop?.trim();
    const stopNested = block.nestedSlots?.stop;
    if (stopText || stopNested) {
      return `${target}[${start}:${slotToExpr(block, ui.stop)}]`;
    }
    return `${target}[${start}:]`;
  }

  if (ui.type === "func_call") {
    const name = block.slots.name ?? "func";
    const args = block.slots.args?.trim();
    return args ? `${name}(${args})` : `${name}()`;
  }

  if (ui.type === "mod_call") {
    const args = ui.args.map((a) => slotToExpr(block, a));
    return `${ui.module}.${ui.fn}(${args.join(", ")})`;
  }

  if (ui.type === "mod_const") {
    return `${ui.module}.${ui.name}`;
  }

  return "None";
}

function applyBlockTemplate(block: WorkspaceBlock, def: BlockDef): string {
  return def.code.replace(/\{(\w+)\}/g, (_, key) => slotToExpr(block, key));
}

function condExpr(block: WorkspaceBlock): string {
  const nested = block.nestedSlots?.cond;
  if (nested) return emitReporterExpr(nested);
  const text = block.slots.cond?.trim();
  return text || "True";
}

function emitBlocks(blocks: WorkspaceBlock[], indent: number): string[] {
  const lines: string[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.id === "if" || block.id === "if_else") {
      const chain = emitIfChain(blocks, i, indent);
      lines.push(...chain.lines);
      i = chain.nextIndex - 1;
      continue;
    }
    lines.push(...emitOne(block, indent));
  }
  return lines;
}

function emitIfChain(
  blocks: WorkspaceBlock[],
  start: number,
  indent: number,
): { lines: string[]; nextIndex: number } {
  const pad = "    ".repeat(indent);
  const first = blocks[start];
  const lines: string[] = [`${pad}if ${condExpr(first)}:`];
  lines.push(...emitBlocks(first.body ?? [], indent + 1));

  let i = start + 1;
  while (i < blocks.length && blocks[i].id === "elif") {
    const elifBlock = blocks[i];
    lines.push(`${pad}elif ${condExpr(elifBlock)}:`);
    lines.push(...emitBlocks(elifBlock.body ?? [], indent + 1));
    i++;
  }

  if (first.id === "if_else" && first.elseBody?.length) {
    lines.push(`${pad}else:`);
    lines.push(...emitBlocks(first.elseBody, indent + 1));
  } else if (i < blocks.length && blocks[i].id === "else") {
    lines.push(`${pad}else:`);
    lines.push(...emitBlocks(blocks[i].body ?? [], indent + 1));
    i++;
  }

  return { lines, nextIndex: i };
}

function emitOne(block: WorkspaceBlock, indent: number): string[] {
  const pad = "    ".repeat(indent);
  const d = getBlockDef(block.id);
  if (!d) return [`${pad}# ${block.id}`];

  if (isReporterBlock(block.id)) return [];

  if (d.shape === "c_block") {
    if (d.id === "for_range") {
      const v = block.slots.var ?? "i";
      const stop = slotToExpr(block, "stop");
      const lines = [`${pad}for ${v} in range(${stop}):`];
      const body = emitBlocks(block.body ?? [], indent + 1);
      lines.push(...(body.length ? body : [`${"    ".repeat(indent + 1)}pass`]));
      return lines;
    }

    if (d.id === "for_range_from") {
      const v = block.slots.var ?? "i";
      const start = slotToExpr(block, "start");
      const stop = slotToExpr(block, "stop");
      const lines = [`${pad}for ${v} in range(${start}, ${stop}):`];
      const body = emitBlocks(block.body ?? [], indent + 1);
      lines.push(...(body.length ? body : [`${"    ".repeat(indent + 1)}pass`]));
      return lines;
    }

    if (d.id === "def_func") {
      const name = block.slots.name ?? "func";
      const sig = formatParamsSignature(parseParamSpecs(block.slots.params ?? ""));
      const lines = [`${pad}def ${name}(${sig}):`];
      const body = emitBlocks(block.body ?? [], indent + 1);
      lines.push(...(body.length ? body : [`${"    ".repeat(indent + 1)}pass`]));
      return lines;
    }

    if (d.id === "while_loop") {
      const lines = [`${pad}while ${condExpr(block)}:`];
      const body = emitBlocks(block.body ?? [], indent + 1);
      lines.push(...(body.length ? body : [`${"    ".repeat(indent + 1)}pass`]));
      return lines;
    }

    if (d.id === "elif" || d.id === "else") {
      const kw = d.id === "else" ? "else" : `elif ${condExpr(block)}`;
      const lines = [`${pad}${kw}:`];
      const body = emitBlocks(block.body ?? [], indent + 1);
      lines.push(...(body.length ? body : [`${"    ".repeat(indent + 1)}pass`]));
      return lines;
    }

    const kw = d.id === "while_loop" ? "while" : "if";
    const lines = [`${pad}${kw} ${condExpr(block)}:`];
    const body = emitBlocks(block.body ?? [], indent + 1);
    lines.push(...(body.length ? body : [`${"    ".repeat(indent + 1)}pass`]));
    if (d.hasElse || d.id === "if_else") {
      lines.push(`${pad}else:`);
      const elseBody = emitBlocks(block.elseBody ?? [], indent + 1);
      lines.push(...(elseBody.length ? elseBody : [`${"    ".repeat(indent + 1)}pass`]));
    }
    return lines;
  }

  if (!d.code || d.code.startsWith("#")) return [];

  if (d.id === "print") {
    return [`${pad}print(${slotToExpr(block, "value")})`];
  }
  if (d.id === "func_return") {
    return [`${pad}return ${slotToExpr(block, "value")}`];
  }
  if (d.id === "input_stmt") {
    const name = block.slots.name ?? "answer";
    const prompt = block.slots.prompt?.trim() || block.nestedSlots?.prompt;
    const promptExpr = prompt
      ? (block.nestedSlots?.prompt ? emitReporterExpr(block.nestedSlots.prompt) : block.slots.prompt?.trim())
      : "";
    const call = promptExpr ? `input(${promptExpr})` : "input()";
    return [`${pad}${name} = ${call}`];
  }
  if (d.id === "builtin_round") {
    const result = block.slots.result ?? "rounded";
    const value = slotToExpr(block, "value");
    const digits = block.slots.digits?.trim() || block.nestedSlots?.digits;
    const call = digits
      ? `round(${value}, ${block.nestedSlots?.digits ? emitReporterExpr(block.nestedSlots.digits) : block.slots.digits?.trim()})`
      : `round(${value})`;
    return [`${pad}${result} = ${call}`];
  }
  if (d.id === "str_slice") {
    const result = block.slots.result ?? "part";
    const v = slotToExpr(block, "var");
    const start = slotToExpr(block, "start");
    const stopText = block.slots.stop?.trim();
    const stopNested = block.nestedSlots?.stop;
    const slice = stopText || stopNested ? `${v}[${start}:${slotToExpr(block, "stop")}]` : `${v}[${start}:]`;
    return [`${pad}${result} = ${slice}`];
  }

  if (d.id === "misc_assert") {
    return [`${pad}assert ${condExpr(block)}`];
  }

  return [`${pad}${applyBlockTemplate(block, d)}`];
}
