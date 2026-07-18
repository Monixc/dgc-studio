/** 블록 헤더 UI 렌더 — 메서드명이 보이도록 */

import type { BlockDef } from "./catalog";
import type { WorkspaceBlock } from "./types";

export type BlockUi =
  | { type: "print" }
  | { type: "input_kw"; nameSlot: string; promptSlot: string }
  | { type: "c_header"; keyword: string; condSlot?: string; extraSlots?: string[] }
  | { type: "assign"; left: string; right: string }
  | { type: "list_init" }
  | { type: "dict_init" }
  | { type: "tuple_init" }
  | { type: "dict_literal" }
  | { type: "operator"; op: string }
  | { type: "method"; target?: string; method: string; args: string[] }
  | { type: "store_method"; result: string; target?: string; method: string; args: string[] }
  | { type: "subscript_set"; key: string; value: string }
  | { type: "builtin"; fn: string; args: string[]; result: string }
  | { type: "join"; sep: string; items: string; result: string }
  | { type: "func_call"; nameSlot: string; argsSlot?: string }
  | { type: "keyword"; keyword: string }
  | { type: "return_kw"; valueSlot: string }
  | { type: "import_kw"; moduleSlot: string }
  | { type: "compare"; op: string; left: string; right?: string }
  | { type: "subscript_get"; result: string; target: string; index: string }
  | { type: "str_slice"; result: string; target: string; start: string; stop: string }
  | { type: "for_range_from"; varSlot: string; startSlot: string; stopSlot: string }
  | { type: "from_import"; moduleSlot: string; nameSlot: string }
  | { type: "del_sub"; target: string; index: string }
  | { type: "mod_call"; module: string; fn: string; args: string[]; result: string }
  | { type: "mod_void"; module: string; fn: string; args: string[] }
  | { type: "mod_const"; module: string; name: string; result: string }
  | { type: "import_module"; module: string }
  | { type: "from_import_const"; module: string; name: string }
  | { type: "void_builtin"; fn: string; args: string[] };

type SlotFn = (name: string, w?: number) => HTMLElement;
type EqFn = (text?: string) => HTMLElement;

function appendMethodCall(
  header: HTMLElement,
  slot: SlotFn,
  eq: EqFn,
  targetSlot: string,
  method: string,
  argSlots: string[],
  withTarget = true,
): void {
  if (withTarget) header.appendChild(slot(targetSlot));
  const open = document.createElement("span");
  open.className = "block-eq";
  open.textContent = `.${method}(`;
  header.appendChild(open);
  argSlots.forEach((arg, i) => {
    if (i > 0) {
      const comma = document.createElement("span");
      comma.className = "block-eq";
      comma.textContent = ", ";
      header.appendChild(comma);
    }
    header.appendChild(slot(arg));
  });
  const close = document.createElement("span");
  close.className = "block-eq";
  close.textContent = ")";
  header.appendChild(close);
}

export function renderBlockHeader(
  block: WorkspaceBlock,
  def: BlockDef,
  header: HTMLElement,
  slot: SlotFn,
  eq: EqFn,
  mode: "full" | "expr" = "full",
): void {
  const ui = def.ui;
  const target = ui.type === "method" || ui.type === "store_method" ? (ui.target ?? "var") : "var";
  const asExpr = mode === "expr";

  switch (ui.type) {
    case "print": {
      const lbl = document.createElement("span");
      lbl.className = "block-label";
      lbl.textContent = "print";
      header.appendChild(lbl);
      header.appendChild(slot("value", 180));
      break;
    }
    case "input_kw": {
      header.appendChild(slot(ui.nameSlot));
      header.appendChild(eq("="));
      const kw = document.createElement("span");
      kw.className = "block-label";
      kw.textContent = "input";
      header.appendChild(kw);
      header.appendChild(eq("("));
      header.appendChild(slot(ui.promptSlot, 140));
      header.appendChild(eq(")"));
      break;
    }
    case "c_header": {
      const kw = document.createElement("span");
      kw.className = "block-label";
      kw.textContent = ui.keyword;
      header.appendChild(kw);
      if (ui.condSlot) {
        const condDef = def.slots.find((s) => s.name === ui.condSlot);
        header.appendChild(slot(ui.condSlot, condDef?.width ?? 160));
      }
      for (const name of ui.extraSlots ?? []) {
        const sdef = def.slots.find((s) => s.name === name);
        header.appendChild(slot(name, sdef?.width ?? 48));
      }
      break;
    }
    case "assign": {
      header.appendChild(slot(ui.left));
      header.appendChild(eq());
      header.appendChild(slot(ui.right, 120));
      break;
    }
    case "list_init": {
      header.appendChild(slot("name", 72));
      header.appendChild(eq());
      const body = def.slots.find((s) => s.name === "body");
      if (body) header.appendChild(slot("body", body.width ?? 160));
      else {
        const empty = document.createElement("span");
        empty.className = "block-eq";
        empty.textContent = "[]";
        header.appendChild(empty);
      }
      break;
    }
    case "dict_init": {
      header.appendChild(slot("var", 72));
      header.appendChild(eq());
      const body = def.slots.find((s) => s.name === "body");
      if (body) header.appendChild(slot("body", body.width ?? 160));
      else {
        const empty = document.createElement("span");
        empty.className = "block-eq";
        empty.textContent = "{}";
        header.appendChild(empty);
      }
      break;
    }
    case "tuple_init": {
      header.appendChild(slot("name", 72));
      header.appendChild(eq());
      const body = def.slots.find((s) => s.name === "body");
      if (body) header.appendChild(slot("body", body.width ?? 120));
      else {
        const empty = document.createElement("span");
        empty.className = "block-eq";
        empty.textContent = "()";
        header.appendChild(empty);
      }
      break;
    }
    case "dict_literal":
      header.appendChild(slot("var"));
      header.appendChild(eq());
      header.appendChild(slot("body", 200));
      break;
    case "operator":
      if (!asExpr) header.appendChild(slot("result"));
      if (!asExpr) header.appendChild(eq());
      header.appendChild(slot("a"));
      {
        const op = document.createElement("span");
        op.className = "block-op";
        op.textContent = ui.op;
        header.appendChild(op);
      }
      header.appendChild(slot("b"));
      break;
    case "method":
      appendMethodCall(header, slot, eq, target, ui.method, ui.args);
      break;
    case "store_method":
      if (!asExpr) header.appendChild(slot(ui.result));
      if (!asExpr) header.appendChild(eq());
      appendMethodCall(header, slot, eq, target, ui.method, ui.args);
      break;
    case "subscript_set":
      header.appendChild(slot("var"));
      header.appendChild(eq("["));
      header.appendChild(slot(ui.key));
      header.appendChild(eq("]"));
      header.appendChild(eq("="));
      header.appendChild(slot(ui.value, 100));
      break;
    case "subscript_get":
      if (!asExpr) header.appendChild(slot(ui.result));
      if (!asExpr) header.appendChild(eq("="));
      header.appendChild(slot(ui.target));
      header.appendChild(eq("["));
      header.appendChild(slot(ui.index, 40));
      header.appendChild(eq("]"));
      break;
    case "str_slice":
      if (!asExpr) header.appendChild(slot(ui.result));
      if (!asExpr) header.appendChild(eq("="));
      header.appendChild(slot(ui.target));
      header.appendChild(eq("["));
      header.appendChild(slot(ui.start, 36));
      header.appendChild(eq(":"));
      header.appendChild(slot(ui.stop, 36));
      header.appendChild(eq("]"));
      break;
    case "for_range_from": {
      const lbl = document.createElement("span");
      lbl.className = "block-label";
      lbl.textContent = "for";
      header.appendChild(lbl);
      header.appendChild(slot(ui.varSlot, 40));
      const inLbl = document.createElement("span");
      inLbl.className = "block-eq";
      inLbl.textContent = " in range(";
      header.appendChild(inLbl);
      header.appendChild(slot(ui.startSlot, 40));
      const comma = document.createElement("span");
      comma.className = "block-eq";
      comma.textContent = ", ";
      header.appendChild(comma);
      header.appendChild(slot(ui.stopSlot, 40));
      const close = document.createElement("span");
      close.className = "block-eq";
      close.textContent = ")";
      header.appendChild(close);
      break;
    }
    case "from_import": {
      const kw = document.createElement("span");
      kw.className = "block-label";
      kw.textContent = "from";
      header.appendChild(kw);
      header.appendChild(slot(ui.moduleSlot, 80));
      const imp = document.createElement("span");
      imp.className = "block-label";
      imp.textContent = "import";
      header.appendChild(imp);
      header.appendChild(slot(ui.nameSlot, 80));
      break;
    }
    case "del_sub": {
      const kw = document.createElement("span");
      kw.className = "block-label";
      kw.textContent = "del";
      header.appendChild(kw);
      header.appendChild(slot(ui.target));
      header.appendChild(eq("["));
      header.appendChild(slot(ui.index, 40));
      header.appendChild(eq("]"));
      break;
    }
    case "import_module": {
      const kw = document.createElement("span");
      kw.className = "block-label";
      kw.textContent = "import";
      header.appendChild(kw);
      const mod = document.createElement("span");
      mod.className = "block-eq";
      mod.textContent = ui.module;
      header.appendChild(mod);
      break;
    }
    case "from_import_const": {
      const kw = document.createElement("span");
      kw.className = "block-label";
      kw.textContent = "from";
      header.appendChild(kw);
      const mod = document.createElement("span");
      mod.className = "block-eq";
      mod.textContent = `${ui.module} import ${ui.name}`;
      header.appendChild(mod);
      break;
    }
    case "mod_call":
      if (!asExpr) header.appendChild(slot(ui.result));
      if (!asExpr) header.appendChild(eq("="));
      {
        const mod = document.createElement("span");
        mod.className = "block-label";
        mod.textContent = `${ui.module}.${ui.fn}`;
        header.appendChild(mod);
      }
      header.appendChild(eq("("));
      ui.args.forEach((arg, i) => {
        if (i > 0) {
          const comma = document.createElement("span");
          comma.className = "block-eq";
          comma.textContent = ", ";
          header.appendChild(comma);
        }
        header.appendChild(slot(arg));
      });
      header.appendChild(eq(")"));
      break;
    case "mod_void": {
      const mod = document.createElement("span");
      mod.className = "block-label";
      mod.textContent = `${ui.module}.${ui.fn}`;
      header.appendChild(mod);
      header.appendChild(eq("("));
      ui.args.forEach((arg, i) => {
        if (i > 0) {
          const comma = document.createElement("span");
          comma.className = "block-eq";
          comma.textContent = ", ";
          header.appendChild(comma);
        }
        header.appendChild(slot(arg));
      });
      header.appendChild(eq(")"));
      break;
    }
    case "mod_const":
      if (!asExpr) header.appendChild(slot(ui.result));
      if (!asExpr) header.appendChild(eq("="));
      {
        const mod = document.createElement("span");
        mod.className = "block-label";
        mod.textContent = `${ui.module}.${ui.name}`;
        header.appendChild(mod);
      }
      break;
    case "void_builtin": {
      const fn = document.createElement("span");
      fn.className = "block-label";
      fn.textContent = ui.fn;
      header.appendChild(fn);
      header.appendChild(eq("("));
      ui.args.forEach((arg, i) => {
        if (i > 0) {
          const comma = document.createElement("span");
          comma.className = "block-eq";
          comma.textContent = ", ";
          header.appendChild(comma);
        }
        header.appendChild(slot(arg));
      });
      header.appendChild(eq(")"));
      break;
    }
    case "builtin":
      if (!asExpr) header.appendChild(slot(ui.result));
      if (!asExpr) header.appendChild(eq("="));
      {
        const fn = document.createElement("span");
        fn.className = "block-label";
        fn.textContent = ui.fn;
        header.appendChild(fn);
      }
      header.appendChild(eq("("));
      ui.args.forEach((arg, i) => {
        if (i > 0) {
          const comma = document.createElement("span");
          comma.className = "block-eq";
          comma.textContent = ", ";
          header.appendChild(comma);
        }
        header.appendChild(slot(arg));
      });
      header.appendChild(eq(")"));
      break;
    case "join":
      if (!asExpr) header.appendChild(slot(ui.result));
      if (!asExpr) header.appendChild(eq("="));
      header.appendChild(slot(ui.sep));
      header.appendChild(eq(".join("));
      header.appendChild(slot(ui.items));
      header.appendChild(eq(")"));
      break;
    case "func_call": {
      header.appendChild(slot(ui.nameSlot, 88));
      const open = document.createElement("span");
      open.className = "block-eq";
      open.textContent = "(";
      header.appendChild(open);
      if (ui.argsSlot) header.appendChild(slot(ui.argsSlot, 120));
      const close = document.createElement("span");
      close.className = "block-eq";
      close.textContent = ")";
      header.appendChild(close);
      break;
    }
    case "keyword": {
      const kw = document.createElement("span");
      kw.className = "block-label";
      kw.textContent = ui.keyword;
      header.appendChild(kw);
      break;
    }
    case "return_kw": {
      const kw = document.createElement("span");
      kw.className = "block-label";
      kw.textContent = "return";
      header.appendChild(kw);
      header.appendChild(slot(ui.valueSlot, 80));
      break;
    }
    case "import_kw": {
      const kw = document.createElement("span");
      kw.className = "block-label";
      kw.textContent = "import";
      header.appendChild(kw);
      header.appendChild(slot(ui.moduleSlot, 100));
      break;
    }
    case "compare": {
      if (ui.op === "not") {
        const op = document.createElement("span");
        op.className = "block-op";
        op.textContent = "not";
        header.appendChild(op);
        header.appendChild(slot(ui.left, 100));
        break;
      }
      header.appendChild(slot(ui.left, 72));
      const op = document.createElement("span");
      op.className = "block-op";
      op.textContent = ui.op;
      header.appendChild(op);
      if (ui.right) header.appendChild(slot(ui.right, 72));
      break;
    }
    default:
      for (const s of def.slots) header.appendChild(slot(s.name, s.width));
  }
}
