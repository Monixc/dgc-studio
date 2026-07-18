/** 스크래치/엔트리식 블록 작업대 — 드래그 앤 드롭 + 변수 */

import { blocksToCode } from "@/core/blocks/codegen";
import { renderBlockHeader } from "@/core/blocks/blockUi";
import {
  blockFromSpec,
  createBlockInstance,
  getBlockDef,
  isExprNestBlock,
  isReporterBlock,
  paletteByCategory,
  type BlockSpec,
  type SlotDef,
} from "@/core/blocks/catalog";
import type { WorkspaceBlock } from "@/core/blocks/types";
import {
  VAR_COLOR,
  collectInitialVariables,
  collectVariablesFromBlocks,
  isValidVarName,
  normalizeVarName,
} from "@/core/blocks/variables";
import {
  FUNC_COLOR,
  PARAM_COLOR,
  collectDefinedFunctions,
  collectFuncNames,
  formatCallArgsHint,
  formatFuncLabel,
  isParamInScope,
  isValidFuncName,
  normalizeFuncName,
  type DefinedFunction,
} from "@/core/blocks/functions";
let nextUid = 1;
const allocUid = () => nextUid++;

export function resetBlockUids(start = 1): void {
  nextUid = start;
}

export function specsToBlocks(specs: BlockSpec[]): WorkspaceBlock[] {
  return specs.map((s) => blockFromSpec(s, allocUid));
}

export interface BlockWorkspaceOptions {
  initialVariables?: string[];
  starterSpecs?: BlockSpec[];
}

export interface BlockWorkspaceHandle {
  getBlocks(): WorkspaceBlock[];
  getVariables(): string[];
  reset(specs: BlockSpec[]): void;
  setBlocks(blocks: WorkspaceBlock[]): void;
  render(): void;
}

type ListKey = string;

interface DragState {
  kind: "workspace" | "palette" | "var_chip" | "func_chip" | "param_chip";
  uid?: number;
  paletteId?: string;
  presetSlots?: Record<string, string>;
  varName?: string;
  funcName?: string;
  funcParams?: string[];
  paramName?: string;
  paramOwnerFunc?: string;
  ghost: HTMLElement;
  sourceEl: HTMLElement;
}

export function mountBlockWorkspace(
  workspaceEl: HTMLElement,
  paletteEl: HTMLElement,
  initial: WorkspaceBlock[],
  onChange: () => void,
  options: BlockWorkspaceOptions = {},
): BlockWorkspaceHandle {
  let blocks = initial;
  let variables = [...(options.initialVariables ?? [])];
  let definedFunctions: DefinedFunction[] = [];
  const starterSpecs = options.starterSpecs ?? [];
  const showVariables = true;
  let activePaletteCategory = "print";

  const listRegistry = new Map<ListKey, WorkspaceBlock[]>();
  let drag: DragState | null = null;
  let activeGap: HTMLElement | null = null;
  let activeExprDrop: HTMLElement | null = null;
  let suppressPaletteClick = false;
  let dragPointerId: number | null = null;

  const notify = () => onChange();

  const fullRender = () => {
    syncFunctionList();
    renderPalette();
    render();
  };

  const syncVariableList = () => {
    const merged = new Set([...variables, ...collectVariablesFromBlocks(blocks)]);
    variables = [...merged].sort();
  };

  const syncFunctionList = () => {
    definedFunctions = collectDefinedFunctions(blocks);
  };

  const walkBlock = (block: WorkspaceBlock, uid: number): WorkspaceBlock | null => {
    if (block.uid === uid) return block;
    for (const nested of Object.values(block.nestedSlots ?? {})) {
      const hit = walkBlock(nested, uid);
      if (hit) return hit;
    }
    for (const child of [...(block.body ?? []), ...(block.elseBody ?? [])]) {
      const hit = walkBlock(child, uid);
      if (hit) return hit;
    }
    return null;
  };

  const findInTree = (
    list: WorkspaceBlock[],
    uid: number,
  ): { list: WorkspaceBlock[]; index: number } | null => {
    for (let i = 0; i < list.length; i++) {
      if (list[i].uid === uid) return { list, index: i };
      const b = list[i];
      if (b.body) {
        const inBody = findInTree(b.body, uid);
        if (inBody) return inBody;
      }
      if (b.elseBody) {
        const inElse = findInTree(b.elseBody, uid);
        if (inElse) return inElse;
      }
    }
    return null;
  };

  const findBlock = (uid: number): WorkspaceBlock | null => {
    for (const b of blocks) {
      const hit = walkBlock(b, uid);
      if (hit) return hit;
    }
    return null;
  };

  const findBlockParentSlot = (
    uid: number,
  ): { parent: WorkspaceBlock; slotName: string } | null => {
    const walk = (block: WorkspaceBlock): { parent: WorkspaceBlock; slotName: string } | null => {
      for (const [slotName, nested] of Object.entries(block.nestedSlots ?? {})) {
        if (nested.uid === uid) return { parent: block, slotName };
        const deep = walk(nested);
        if (deep) return deep;
      }
      for (const child of [...(block.body ?? []), ...(block.elseBody ?? [])]) {
        const deep = walk(child);
        if (deep) return deep;
      }
      return null;
    };
    for (const b of blocks) {
      const hit = walk(b);
      if (hit) return hit;
    }
    return null;
  };

  const containsUid = (block: WorkspaceBlock | undefined, uid: number): boolean => {
    if (!block) return false;
    if (block.uid === uid) return true;
    for (const nested of Object.values(block.nestedSlots ?? {})) {
      if (containsUid(nested, uid)) return true;
    }
    for (const child of [...(block.body ?? []), ...(block.elseBody ?? [])]) {
      if (containsUid(child, uid)) return true;
    }
    return false;
  };

  const acceptsVarChip = (target: HTMLElement): boolean => {
    const kind = target.dataset.slotKind;
    return kind === "expr" || kind === "bool" || kind === "var";
  };

  const acceptsFuncChip = (target: HTMLElement): boolean => {
    if (target.dataset.slotKind !== "func") return false;
    const uid = Number(target.dataset.blockUid);
    const block = findBlock(uid);
    return block?.id === "func_call";
  };

  const acceptsParamChip = (target: HTMLElement, paramName: string, ownerFunc: string): boolean => {
    const kind = target.dataset.slotKind;
    if (kind !== "expr" && kind !== "bool" && kind !== "var") return false;
    const uid = Number(target.dataset.blockUid);
    return isParamInScope(blocks, uid, paramName, ownerFunc);
  };

  const acceptsExprNest = (target: HTMLElement): boolean => {
    const kind = target.dataset.slotKind;
    return kind === "expr" || kind === "bool";
  };

  const zoneOwnerUid = (listKey: ListKey): number | null => {
    if (listKey === "root") return null;
    const n = Number(listKey.split(":")[0]);
    return Number.isFinite(n) ? n : null;
  };

  const isInvalidDrop = (listKey: ListKey, dragState: DragState): boolean => {
    if (dragState.kind === "palette") {
      const id = dragState.paletteId!;
      if (isReporterBlock(id)) return true;
      return false;
    }
    if (dragState.kind !== "workspace") return false;
    const uid = dragState.uid!;
    const block = findBlock(uid);
    if (!block) return true;
    if (isReporterBlock(block.id)) return true;
    const owner = zoneOwnerUid(listKey);
    if (owner === uid) return true;
    if (owner !== null && containsUid(block, owner)) return true;
    return false;
  };

  const clearDropHighlight = () => {
    activeGap?.classList.remove("drop-gap-active");
    activeGap = null;
  };

  const clearExprDropHighlight = () => {
    activeExprDrop?.classList.remove("expr-drop-active");
    activeExprDrop = null;
  };

  const endDrag = () => {
    if (!drag) return;
    if (dragPointerId !== null) {
      try {
        drag.sourceEl.releasePointerCapture(dragPointerId);
      } catch {
        /* 이미 해제됨 */
      }
      dragPointerId = null;
    }
    drag.sourceEl.classList.remove("block-dragging", "var-chip-dragging");
    drag.ghost.remove();
    drag = null;
    clearDropHighlight();
    clearExprDropHighlight();
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.body.classList.remove("block-dnd-active");
  };

  const performNestedSlotDrop = (target: HTMLElement, blockId: string) => {
    const uid = Number(target.dataset.blockUid);
    const slotName = target.dataset.slotName ?? "";
    const block = findBlock(uid);
    if (!block) return;
    const inst = createBlockInstance(blockId, { empty: true });
    const nested: WorkspaceBlock = {
      uid: allocUid(),
      id: inst.id,
      slots: { ...inst.slots },
    };
    if (!block.nestedSlots) block.nestedSlots = {};
    block.nestedSlots[slotName] = nested;
    block.slots[slotName] = "";
    fullRender();
    notify();
  };

  const performWorkspaceNestedSlotDrop = (target: HTMLElement, dragUid: number) => {
    const hostUid = Number(target.dataset.blockUid);
    const slotName = target.dataset.slotName ?? "";
    const host = findBlock(hostUid);
    if (!host) return;

    const from = findInTree(blocks, dragUid);
    let dragged: WorkspaceBlock | null = null;

    if (from) {
      dragged = from.list[from.index];
      if (!isExprNestBlock(dragged.id)) return;
      from.list.splice(from.index, 1);
    } else {
      const nested = findBlockParentSlot(dragUid);
      if (!nested) return;
      dragged = nested.parent.nestedSlots?.[nested.slotName] ?? null;
      if (!dragged || !isExprNestBlock(dragged.id)) return;
      delete nested.parent.nestedSlots![nested.slotName];
      if (!Object.keys(nested.parent.nestedSlots!).length) nested.parent.nestedSlots = undefined;
    }

    if (!host.nestedSlots) host.nestedSlots = {};
    host.nestedSlots[slotName] = dragged;
    host.slots[slotName] = "";
    syncVariableList();
    fullRender();
    notify();
  };

  const performDrop = (listKey: ListKey, index: number) => {
    if (!drag || (drag.kind !== "workspace" && drag.kind !== "palette")) return;
    if (isInvalidDrop(listKey, drag)) return;
    const target = listRegistry.get(listKey);
    if (!target) return;

    if (drag.kind === "palette") suppressPaletteClick = true;

    if (drag.kind === "palette") {
      const inst = createBlockInstance(drag.paletteId!, { empty: true });
      const block: WorkspaceBlock = {
        uid: allocUid(),
        id: inst.id,
        slots: { ...inst.slots, ...(drag.presetSlots ?? {}) },
        body: inst.body,
        elseBody: inst.elseBody,
      };
      target.splice(index, 0, block);
    } else {
      const from = findInTree(blocks, drag.uid!);
      if (!from) return;
      const [item] = from.list.splice(from.index, 1);
      let at = index;
      if (from.list === target && from.index < index) at--;
      target.splice(at, 0, item);
    }
    syncVariableList();
    endDrag();
    fullRender();
    notify();
  };

  const gapAtPoint = (x: number, y: number): HTMLElement | null => {
    const el = document.elementFromPoint(x, y);
    return el?.closest<HTMLElement>(".drop-gap") ?? null;
  };

  const slotDropAtPoint = (x: number, y: number): HTMLElement | null => {
    const el = document.elementFromPoint(x, y);
    return el?.closest<HTMLElement>(".slot-drop-target") ?? null;
  };

  const isVarReference = (value: string): boolean => {
    const v = value.trim();
    return v.length > 0 && isValidVarName(v) && variables.includes(v);
  };

  const isFuncReference = (value: string): boolean => {
    const v = normalizeFuncName(value);
    return v.length > 0 && isValidFuncName(v) && collectFuncNames(blocks).includes(v);
  };

  const isParamReference = (value: string, blockUid: number): boolean => {
    const v = normalizeFuncName(value);
    if (!v || !isValidFuncName(v)) return false;
    return isParamInScope(blocks, blockUid, v);
  };

  const applyVarToSlot = (target: HTMLElement, varName: string) => {
    const uid = Number(target.dataset.blockUid);
    const slotName = target.dataset.slotName ?? "";
    const block = findBlock(uid);
    if (!block) return;
    block.slots[slotName] = varName;
    fullRender();
    notify();
  };

  const applyFuncToSlot = (target: HTMLElement, funcName: string) => {
    const uid = Number(target.dataset.blockUid);
    const slotName = target.dataset.slotName ?? "";
    const block = findBlock(uid);
    if (!block) return;
    block.slots[slotName] = funcName;
    syncFunctionList();
    fullRender();
    notify();
  };

  const appendSlotFuncChip = (
    wrap: HTMLElement,
    block: WorkspaceBlock,
    slotName: string,
    funcName: string,
  ) => {
    wrap.classList.add("slot-has-chip");
    wrap.innerHTML = "";
    const chip = document.createElement("span");
    chip.className = "slot-func-chip";
    chip.textContent = funcName;
    chip.title = "함수 블록";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "slot-func-chip-clear";
    clear.title = "지우기";
    clear.textContent = "×";
    clear.addEventListener("click", (e) => {
      e.stopPropagation();
      block.slots[slotName] = "";
      syncFunctionList();
      fullRender();
      notify();
    });
    clear.addEventListener("pointerdown", (e) => e.stopPropagation());
    wrap.append(chip, clear);
  };

  const appendSlotParamChip = (
    wrap: HTMLElement,
    block: WorkspaceBlock,
    slotName: string,
    paramName: string,
  ) => {
    wrap.classList.add("slot-has-chip");
    wrap.innerHTML = "";
    const chip = document.createElement("span");
    chip.className = "slot-param-chip";
    chip.textContent = paramName;
    chip.title = "매개변수 블록";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "slot-param-chip-clear";
    clear.title = "지우기";
    clear.textContent = "×";
    clear.addEventListener("click", (e) => {
      e.stopPropagation();
      block.slots[slotName] = "";
      fullRender();
      notify();
    });
    clear.addEventListener("pointerdown", (e) => e.stopPropagation());
    wrap.append(chip, clear);
  };

  const appendSlotVarChip = (
    wrap: HTMLElement,
    block: WorkspaceBlock,
    slotName: string,
    varName: string,
  ) => {
    wrap.classList.add("slot-has-chip");
    wrap.innerHTML = "";
    const chip = document.createElement("span");
    chip.className = "slot-var-chip";
    chip.textContent = varName;
    chip.title = "변수 블록";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "slot-var-chip-clear";
    clear.title = "지우기";
    clear.textContent = "×";
    clear.addEventListener("click", (e) => {
      e.stopPropagation();
      block.slots[slotName] = "";
      fullRender();
      notify();
    });
    clear.addEventListener("pointerdown", (e) => e.stopPropagation());
    wrap.append(chip, clear);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!drag) return;
    drag.ghost.style.left = `${e.clientX + 12}px`;
    drag.ghost.style.top = `${e.clientY + 8}px`;

    if (drag.kind === "var_chip") {
      clearExprDropHighlight();
      clearDropHighlight();
      const target = slotDropAtPoint(e.clientX, e.clientY);
      if (target && acceptsVarChip(target)) {
        target.classList.add("expr-drop-active");
        activeExprDrop = target;
      }
      return;
    }

    if (drag.kind === "param_chip") {
      clearDropHighlight();
      const target = slotDropAtPoint(e.clientX, e.clientY);
      if (
        target
        && drag.paramName
        && drag.paramOwnerFunc
        && acceptsParamChip(target, drag.paramName, drag.paramOwnerFunc)
      ) {
        target.classList.add("expr-drop-active");
        activeExprDrop = target;
      } else {
        clearExprDropHighlight();
      }
      return;
    }

    if (drag.kind === "func_chip") {
      clearExprDropHighlight();
      const slotTarget = slotDropAtPoint(e.clientX, e.clientY);
      if (slotTarget && acceptsFuncChip(slotTarget)) {
        slotTarget.classList.add("expr-drop-active");
        activeExprDrop = slotTarget;
        clearDropHighlight();
        return;
      }
      clearDropHighlight();
      const gap = gapAtPoint(e.clientX, e.clientY);
      if (gap) {
        gap.classList.add("drop-gap-active");
        activeGap = gap;
      }
      return;
    }

    if (drag.kind === "palette" && isExprNestBlock(drag.paletteId!)) {
      clearDropHighlight();
      clearExprDropHighlight();
      const target = slotDropAtPoint(e.clientX, e.clientY);
      if (target && acceptsExprNest(target)) {
        target.classList.add("expr-drop-active");
        activeExprDrop = target;
      }
      return;
    }

    if (drag.kind === "workspace") {
      const block = findBlock(drag.uid!);
      if (block && isExprNestBlock(block.id)) {
        clearDropHighlight();
        clearExprDropHighlight();
        const target = slotDropAtPoint(e.clientX, e.clientY);
        if (target && acceptsExprNest(target)) {
          target.classList.add("expr-drop-active");
          activeExprDrop = target;
          return;
        }
      }
    }

    clearExprDropHighlight();
    clearDropHighlight();
    const gap = gapAtPoint(e.clientX, e.clientY);
    if (!gap) return;
    const listKey = gap.dataset.listKey!;
    if (isInvalidDrop(listKey, drag)) return;
    gap.classList.add("drop-gap-active");
    activeGap = gap;
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!drag) return;

    if (drag.kind === "var_chip") {
      drag.ghost.style.visibility = "hidden";
      const target = slotDropAtPoint(e.clientX, e.clientY);
      drag.ghost.style.visibility = "";
      if (target && drag.varName && acceptsVarChip(target)) applyVarToSlot(target, drag.varName);
      endDrag();
      return;
    }

    if (drag.kind === "param_chip") {
      drag.ghost.style.visibility = "hidden";
      const target = slotDropAtPoint(e.clientX, e.clientY);
      drag.ghost.style.visibility = "";
      if (
        target
        && drag.paramName
        && drag.paramOwnerFunc
        && acceptsParamChip(target, drag.paramName, drag.paramOwnerFunc)
      ) {
        applyVarToSlot(target, drag.paramName);
      }
      endDrag();
      return;
    }

    if (drag.kind === "func_chip") {
      drag.ghost.style.visibility = "hidden";
      const slotTarget = slotDropAtPoint(e.clientX, e.clientY);
      drag.ghost.style.visibility = "";
      if (slotTarget && drag.funcName && acceptsFuncChip(slotTarget)) {
        applyFuncToSlot(slotTarget, drag.funcName);
        endDrag();
        return;
      }
      if (drag.funcName) {
        drag.ghost.style.visibility = "hidden";
        const gap = gapAtPoint(e.clientX, e.clientY);
        drag.ghost.style.visibility = "";
        if (gap) {
          const listKey = gap.dataset.listKey!;
          const target = listRegistry.get(listKey);
          if (target) {
            target.splice(Number(gap.dataset.index ?? 0), 0, createFuncCallBlock(drag.funcName));
            syncVariableList();
            syncFunctionList();
            fullRender();
            notify();
          }
        }
      }
      endDrag();
      return;
    }

    if (drag.kind === "palette" && isExprNestBlock(drag.paletteId!)) {
      drag.ghost.style.visibility = "hidden";
      const target = slotDropAtPoint(e.clientX, e.clientY);
      drag.ghost.style.visibility = "";
      if (target && acceptsExprNest(target)) {
        performNestedSlotDrop(target, drag.paletteId!);
        endDrag();
        return;
      }
      if (isReporterBlock(drag.paletteId!)) {
        endDrag();
        return;
      }
    }

    if (drag.kind === "workspace") {
      drag.ghost.style.visibility = "hidden";
      const target = slotDropAtPoint(e.clientX, e.clientY);
      drag.ghost.style.visibility = "";
      if (target && acceptsExprNest(target)) {
        const block = findBlock(drag.uid!);
        if (block && isExprNestBlock(block.id)) {
          performWorkspaceNestedSlotDrop(target, drag.uid!);
          endDrag();
          return;
        }
      }
    }

    drag.ghost.style.visibility = "hidden";
    const gap = gapAtPoint(e.clientX, e.clientY);
    drag.ghost.style.visibility = "";
    if (gap) {
      const listKey = gap.dataset.listKey!;
      if (!isInvalidDrop(listKey, drag)) {
        performDrop(listKey, Number(gap.dataset.index ?? 0));
        return;
      }
    }
    endDrag();
  };

  const startDrag = (
    kind: DragState["kind"],
    sourceEl: HTMLElement,
    label: string,
    color: string,
    meta: {
      uid?: number;
      paletteId?: string;
      varName?: string;
      funcName?: string;
      funcParams?: string[];
      paramName?: string;
      paramOwnerFunc?: string;
      presetSlots?: Record<string, string>;
    },
    e?: PointerEvent,
  ) => {
    endDrag();
    const ghost = document.createElement("div");
    ghost.className =
      kind === "var_chip" ? "drag-ghost var-ghost"
        : kind === "func_chip" ? "drag-ghost func-ghost"
          : kind === "param_chip" ? "drag-ghost param-ghost"
            : "drag-ghost";
    ghost.textContent = label;
    ghost.style.setProperty("--block-color", color);
    document.body.appendChild(ghost);
    if (e) {
      ghost.style.left = `${e.clientX + 12}px`;
      ghost.style.top = `${e.clientY + 8}px`;
    }

    sourceEl.classList.add(
      kind === "var_chip" ? "var-chip-dragging"
        : kind === "func_chip" ? "func-chip-dragging"
          : kind === "param_chip" ? "param-chip-dragging"
            : "block-dragging",
    );
    drag = { kind, ghost, sourceEl, ...meta };
    document.body.classList.add("block-dnd-active");
    if (e?.pointerId !== undefined) {
      try {
        sourceEl.setPointerCapture(e.pointerId);
        dragPointerId = e.pointerId;
      } catch {
        dragPointerId = null;
      }
    }
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  };

  const bindBlockDrag = (
    dragEl: HTMLElement,
    visualEl: HTMLElement,
    label: string,
    color: string,
    meta: { uid: number },
  ) => {
    dragEl.addEventListener("pointerdown", (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, select, textarea, button")) return;
      if (t.closest(".block-slot, .expr-slot-wrap, .block-var-select, .block-c-zone, .block-c-nest, .drop-gap")) {
        return;
      }
      e.preventDefault();
      startDrag("workspace", visualEl, label, color, meta, e);
    });
  };

  const makeDragHandle = (
    sourceEl: HTMLElement,
    label: string,
    color: string,
    meta: { uid?: number; paletteId?: string; presetSlots?: Record<string, string> },
  ) => {
    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "block-drag-handle";
    handle.title = "드래그해서 이동";
    handle.innerHTML = `<span class="handle-dots"></span>`;
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      startDrag(meta.uid !== undefined ? "workspace" : "palette", sourceEl, label, color, meta, e);
    });
    return handle;
  };

  const makeDeleteBtn = (list: WorkspaceBlock[], idx: number) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "block-delete-btn";
    btn.title = "삭제";
    btn.textContent = "×";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      list.splice(idx, 1);
      syncVariableList();
      syncFunctionList();
      fullRender();
      notify();
    });
    return btn;
  };

  const makeDropGap = (listKey: ListKey, index: number, expanded = false) => {
    const gap = document.createElement("div");
    gap.className = `drop-gap${expanded ? " drop-gap-expanded" : ""}`;
    gap.dataset.listKey = listKey;
    gap.dataset.index = String(index);
    gap.title = "여기에 놓기";
    return gap;
  };

  const fillVarSelect = (sel: HTMLSelectElement, current: string) => {
    sel.innerHTML = "";
    if (!current) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "변수 만들기…";
      sel.appendChild(opt);
    }
    for (const v of variables) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    }
    if (current && !variables.includes(current)) {
      const opt = document.createElement("option");
      opt.value = current;
      opt.textContent = current;
      sel.appendChild(opt);
    }
    // 슬롯을 직접 고르지 않았으면 다른 변수로 몰래 채우지 않고 빈 채로 둔다
    sel.value = current || "";
  };

  const fillFuncSelect = (sel: HTMLSelectElement, current: string) => {
    sel.innerHTML = "";
    if (!definedFunctions.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "함수 만들기…";
      sel.appendChild(opt);
    } else {
      for (const fn of definedFunctions) {
        const opt = document.createElement("option");
        opt.value = fn.name;
        opt.textContent = formatFuncLabel(fn.name, fn.paramSpecs);
        sel.appendChild(opt);
      }
    }
    if (current && !definedFunctions.some((f) => f.name === current)) {
      const opt = document.createElement("option");
      opt.value = current;
      opt.textContent = current;
      sel.appendChild(opt);
    }
    sel.value = current || definedFunctions[0]?.name || "";
  };

  const createFuncCallBlock = (name: string): WorkspaceBlock => {
    const inst = createBlockInstance("func_call", { empty: true });
    return {
      uid: allocUid(),
      id: inst.id,
      slots: { ...inst.slots, name },
      body: inst.body,
      elseBody: inst.elseBody,
    };
  };

  const clearNestedSlot = (block: WorkspaceBlock, slotName: string) => {
    if (block.nestedSlots?.[slotName]) {
      delete block.nestedSlots[slotName];
      if (!Object.keys(block.nestedSlots).length) block.nestedSlots = undefined;
    }
    block.slots[slotName] = "";
    fullRender();
    notify();
  };

  const renderNestedInSlot = (
    parent: WorkspaceBlock,
    slotName: string,
    nested: WorkspaceBlock,
    wrap: HTMLElement,
  ) => {
    const def = getBlockDef(nested.id);
    if (!def) return;
    wrap.classList.add("slot-has-reporter");
    wrap.innerHTML = "";
    const chip = document.createElement("div");
    chip.className = `slot-reporter-block${isReporterBlock(nested.id) ? "" : " slot-nested-stack"}`;
    chip.style.setProperty("--block-color", def.color);
    const inner = document.createElement("div");
    inner.className = "slot-reporter-inner";
    const slot = (name: string, w?: number) => {
      const s = def.slots.find((x) => x.name === name)!;
      return makeSlotWidget(nested, s, w);
    };
    const eq = (text = "=") => {
      const s = document.createElement("span");
      s.className = "block-eq";
      s.textContent = text;
      return s;
    };
    const headerMode = isReporterBlock(nested.id) ? "full" : "expr";
    renderBlockHeader(nested, def, inner, slot, eq, headerMode);
    chip.appendChild(inner);
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "slot-reporter-clear";
    clear.title = "끼운 블록 제거";
    clear.textContent = "×";
    clear.addEventListener("click", (e) => {
      e.stopPropagation();
      clearNestedSlot(parent, slotName);
    });
    clear.addEventListener("pointerdown", (e) => e.stopPropagation());
    wrap.append(chip, clear);
  };

  const makeSlotWidget = (
    block: WorkspaceBlock,
    slot: SlotDef,
    width?: number,
  ): HTMLElement => {
    const nested = block.nestedSlots?.[slot.name];
    const wrap = document.createElement("div");
    wrap.className =
      slot.kind === "var" ? "var-slot-wrap slot-drop-target"
        : slot.kind === "func" ? "func-slot-wrap slot-drop-target"
          : slot.kind === "params" || slot.kind === "args" ? "text-slot-wrap slot-drop-target"
            : "expr-slot-wrap slot-drop-target";
    wrap.dataset.blockUid = String(block.uid);
    wrap.dataset.slotName = slot.name;
    wrap.dataset.slotKind = slot.kind;

    if (nested && isExprNestBlock(nested.id)) {
      renderNestedInSlot(block, slot.name, nested, wrap);
      return wrap;
    }

    const current = (block.slots[slot.name] ?? "").trim();

    if (slot.kind === "func") {
      const isDefName = block.id === "def_func" && slot.name === "name";
      if (!isDefName && current && isFuncReference(current)) {
        appendSlotFuncChip(wrap, block, slot.name, current);
        return wrap;
      }
      if (isDefName) {
        const inp = document.createElement("input");
        inp.className = "block-slot block-func-slot";
        inp.value = block.slots[slot.name] ?? "";
        inp.style.width = `${width ?? slot.width ?? 88}px`;
        inp.placeholder = "함수 이름";
        inp.spellcheck = false;
        inp.addEventListener("input", () => {
          block.slots[slot.name] = inp.value;
          notify();
        });
        inp.addEventListener("blur", () => {
          block.slots[slot.name] = normalizeFuncName(block.slots[slot.name] ?? "");
          syncFunctionList();
          fullRender();
          notify();
        });
        inp.addEventListener("pointerdown", (e) => e.stopPropagation());
        wrap.appendChild(inp);
        return wrap;
      }
      wrap.classList.add("func-slot-needs-func");
      const hint = document.createElement("span");
      hint.className = "func-slot-empty";
      hint.textContent = "함수";
      wrap.appendChild(hint);
      if (definedFunctions.length) {
        const sel = document.createElement("select");
        sel.className = "block-slot block-func-select func-slot-select-fallback";
        sel.style.width = `${width ?? slot.width ?? 88}px`;
        fillFuncSelect(sel, current);
        sel.addEventListener("change", () => {
          block.slots[slot.name] = sel.value;
          fullRender();
          notify();
        });
        sel.addEventListener("pointerdown", (e) => e.stopPropagation());
        wrap.appendChild(sel);
      }
      return wrap;
    }

    if (slot.kind === "params") {
      const inp = document.createElement("input");
      inp.className = "block-slot block-params-slot";
      inp.value = block.slots[slot.name] ?? "";
      inp.style.width = `${width ?? slot.width ?? 120}px`;
      inp.placeholder = "매개변수 (예: hp, *args)";
      inp.spellcheck = false;
      inp.addEventListener("input", () => {
        block.slots[slot.name] = inp.value;
        notify();
      });
      inp.addEventListener("blur", () => {
        syncFunctionList();
        fullRender();
        notify();
      });
      inp.addEventListener("pointerdown", (e) => e.stopPropagation());
      wrap.appendChild(inp);
      return wrap;
    }

    if (slot.kind === "args") {
      const fnName = normalizeFuncName(block.slots.name ?? "");
      const fnDef = definedFunctions.find((f) => f.name === fnName);
      const inp = document.createElement("input");
      inp.className = "block-slot block-args-slot";
      inp.value = block.slots[slot.name] ?? "";
      inp.style.width = `${width ?? slot.width ?? 120}px`;
      inp.placeholder = fnDef?.paramSpecs.length
        ? `인수 (예: ${formatCallArgsHint(fnDef.paramSpecs)})`
        : "인수 (선택)";
      inp.spellcheck = false;
      inp.addEventListener("input", () => {
        block.slots[slot.name] = inp.value;
        notify();
      });
      inp.addEventListener("pointerdown", (e) => e.stopPropagation());
      wrap.appendChild(inp);
      return wrap;
    }

    if (slot.kind === "var") {
      if (current && isParamReference(current, block.uid)) {
        appendSlotParamChip(wrap, block, slot.name, current);
        return wrap;
      }
      if (current && isVarReference(current)) {
        appendSlotVarChip(wrap, block, slot.name, current);
        return wrap;
      }
      wrap.classList.add("var-slot-needs-var");
      const hint = document.createElement("span");
      hint.className = "var-slot-empty";
      hint.textContent = "변수";
      wrap.appendChild(hint);
      if (block.id !== "var_set" || slot.name !== "name") {
        const sel = document.createElement("select");
        sel.className = "block-slot block-var-select var-slot-select-fallback";
        sel.style.width = `${width ?? slot.width ?? 88}px`;
        fillVarSelect(sel, current);
        sel.addEventListener("change", () => {
          block.slots[slot.name] = sel.value;
          fullRender();
          notify();
        });
        sel.addEventListener("pointerdown", (e) => e.stopPropagation());
        wrap.appendChild(sel);
      }
      return wrap;
    }

    if (isParamReference(current, block.uid)) {
      appendSlotParamChip(wrap, block, slot.name, current);
      return wrap;
    }

    if (isVarReference(current)) {
      appendSlotVarChip(wrap, block, slot.name, current);
      return wrap;
    }

    const inp = document.createElement("input");
    inp.className = `block-slot${slot.kind === "bool" ? " block-bool-slot" : ""}`;
    inp.value = block.slots[slot.name] ?? "";
    inp.style.width = `${width ?? slot.width ?? 80}px`;
    inp.style.minWidth = `${Math.min(width ?? slot.width ?? 80, 120)}px`;
    inp.placeholder = slot.kind === "bool" ? "조건" : slot.kind === "expr" ? "값·변수·블록" : "";
    inp.addEventListener("input", () => {
      block.slots[slot.name] = inp.value;
      notify();
    });
    inp.addEventListener("blur", () => {
      if (isParamReference(inp.value, block.uid) || isVarReference(inp.value)) fullRender();
    });
    inp.addEventListener("pointerdown", (e) => e.stopPropagation());
    wrap.appendChild(inp);
    return wrap;
  };

  const addToList = (list: WorkspaceBlock[], id: string) => {
    if (isReporterBlock(id)) return;
    const inst = createBlockInstance(id, { empty: true });
    const block: WorkspaceBlock = {
      uid: allocUid(),
      id: inst.id,
      slots: { ...inst.slots },
      body: inst.body,
      elseBody: inst.elseBody,
    };
    list.push(block);
    syncVariableList();
    fullRender();
    notify();
  };

  const addFuncCall = (name: string) => {
    blocks.push(createFuncCallBlock(name));
    syncVariableList();
    syncFunctionList();
    fullRender();
    notify();
  };

  const addDefFunc = (name: string, params = "") => {
    const inst = createBlockInstance("def_func", { empty: true });
    const block: WorkspaceBlock = {
      uid: allocUid(),
      id: inst.id,
      slots: { ...inst.slots, name, params },
      body: inst.body ?? [],
      elseBody: inst.elseBody,
    };
    blocks.push(block);
    syncVariableList();
    syncFunctionList();
    fullRender();
    notify();
  };

  const addVariable = (raw: string): boolean => {
    const name = normalizeVarName(raw);
    if (!isValidVarName(name)) return false;
    if (!variables.includes(name)) variables.push(name);
    variables.sort();
    fullRender();
    notify();
    return true;
  };

  const renderVariablesPanel = (container: HTMLElement) => {
    if (!showVariables) return;

    const sec = document.createElement("div");
    sec.className = "palette-section variables-section";
    sec.dataset.category = "variable";
    sec.style.setProperty("--cat-color", VAR_COLOR);

    const canVarSet = !!getBlockDef("var_set");
    const canInput = !!getBlockDef("input_stmt");

    const makeBtn = document.createElement("button");
    makeBtn.type = "button";
    makeBtn.className = "make-var-btn";
    makeBtn.textContent = "+ 변수 만들기";
    sec.appendChild(makeBtn);

    const form = document.createElement("div");
    form.className = "make-var-form";
    form.hidden = true;
    const inp = document.createElement("input");
    inp.className = "make-var-input";
    inp.placeholder = "예: name, hp";
    inp.spellcheck = false;
    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "make-var-ok";
    okBtn.textContent = "저장";
    form.append(inp, okBtn);
    sec.appendChild(form);

    const submitVar = () => {
      if (addVariable(inp.value)) {
        inp.value = "";
        form.hidden = true;
      } else {
        inp.classList.add("make-var-error");
        setTimeout(() => inp.classList.remove("make-var-error"), 600);
      }
    };

    makeBtn.addEventListener("click", () => {
      form.hidden = !form.hidden;
      if (!form.hidden) inp.focus();
    });
    okBtn.addEventListener("click", submitVar);
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitVar();
      if (e.key === "Escape") form.hidden = true;
    });

    if (canVarSet) {
      const assignTitle = document.createElement("div");
      assignTitle.className = "palette-section-title";
      assignTitle.textContent = "변수 값 정하기";
      sec.appendChild(assignTitle);
      appendPaletteBlock(sec, "var_set");
      const assignHint = document.createElement("div");
      assignHint.className = "var-chips-empty";
      assignHint.textContent = "아래 변수 칩을 블록 왼쪽 칸에 끼우세요";
      sec.appendChild(assignHint);
    }

    if (canInput) {
      const inputTitle = document.createElement("div");
      inputTitle.className = "palette-section-title";
      inputTitle.textContent = "입력 받기";
      sec.appendChild(inputTitle);
      appendPaletteBlock(sec, "input_stmt");
    }

    const chipTitle = document.createElement("div");
    chipTitle.className = "palette-section-title";
    chipTitle.textContent = "내 변수";
    sec.appendChild(chipTitle);

    const chips = document.createElement("div");
    chips.className = "var-chips";
    if (!variables.length) {
      const hint = document.createElement("div");
      hint.className = "var-chips-empty";
      hint.textContent = "변수를 만들면 칩이 생겨요";
      chips.appendChild(hint);
    } else {
      for (const v of variables) {
        const chip = document.createElement("div");
        chip.className = "var-chip";
        chip.textContent = v;
        chip.title = `${v} — 값 칸에 드래그`;
        chip.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          startDrag("var_chip", chip, v, VAR_COLOR, { varName: v }, e);
        });
        chips.appendChild(chip);
      }
    }
    sec.appendChild(chips);
    container.appendChild(sec);
  };

  const paletteCategoryLabel = (): string => {
    if (activePaletteCategory === "variable") return "변수";
    if (activePaletteCategory === "my_blocks") return "내 블록";
    return paletteByCategory().find((c) => c.id === activePaletteCategory)?.label ?? "블록";
  };

  const renderMyBlocksPanel = (container: HTMLElement) => {
    const sec = document.createElement("div");
    sec.className = "palette-section my-blocks-section";
    sec.style.setProperty("--cat-color", "#c850c8");

    if (getBlockDef("def_func")) {
      const makeBtn = document.createElement("button");
      makeBtn.type = "button";
      makeBtn.className = "make-var-btn make-block-btn";
      makeBtn.textContent = "+ 함수 만들기";
      sec.appendChild(makeBtn);

      const form = document.createElement("div");
      form.className = "make-var-form make-func-form";
      form.hidden = true;
      const nameInp = document.createElement("input");
      nameInp.className = "make-var-input";
      nameInp.placeholder = "함수 이름 (예: heal)";
      nameInp.spellcheck = false;
      const paramsInp = document.createElement("input");
      paramsInp.className = "make-var-input make-func-params-input";
      paramsInp.placeholder = "매개변수 (선택, 예: hp, *args)";
      paramsInp.spellcheck = false;
      const okBtn = document.createElement("button");
      okBtn.type = "button";
      okBtn.className = "make-var-ok";
      okBtn.textContent = "만들기";
      form.append(nameInp, paramsInp, okBtn);
      sec.appendChild(form);

      const submitProc = () => {
        const name = normalizeFuncName(nameInp.value);
        if (!isValidFuncName(name)) {
          nameInp.classList.add("make-var-error");
          setTimeout(() => nameInp.classList.remove("make-var-error"), 600);
          return;
        }
        addDefFunc(name, paramsInp.value.trim());
        nameInp.value = "";
        paramsInp.value = "";
        form.hidden = true;
      };

      makeBtn.addEventListener("click", () => {
        form.hidden = !form.hidden;
        if (!form.hidden) nameInp.focus();
      });
      okBtn.addEventListener("click", submitProc);
      nameInp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submitProc();
        if (e.key === "Escape") form.hidden = true;
      });
      paramsInp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submitProc();
        if (e.key === "Escape") form.hidden = true;
      });
    }

    const chipTitle = document.createElement("div");
    chipTitle.className = "palette-section-title";
    chipTitle.textContent = "내 함수";
    sec.appendChild(chipTitle);

    const chips = document.createElement("div");
    chips.className = "func-chips";
    if (!definedFunctions.length) {
      const hint = document.createElement("div");
      hint.className = "var-chips-empty";
      hint.textContent = "함수를 정의하면 칩이 생겨요";
      chips.appendChild(hint);
    } else {
      for (const fn of definedFunctions) {
        const label = formatFuncLabel(fn.name, fn.paramSpecs);
        const chip = document.createElement("div");
        chip.className = "func-chip";
        chip.textContent = fn.name;
        chip.title = `${label} — 함수 칸·작업 영역에 드래그`;
        chip.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          startDrag("func_chip", chip, label, FUNC_COLOR, {
            funcName: fn.name,
            funcParams: fn.paramSpecs.map((s) => s.name),
          }, e);
        });
        chip.addEventListener("click", () => {
          addFuncCall(fn.name);
        });
        chips.appendChild(chip);
      }
    }
    sec.appendChild(chips);

    const funcsWithParams = definedFunctions.filter((fn) => fn.paramSpecs.length > 0);
    if (funcsWithParams.length) {
      const paramTitle = document.createElement("div");
      paramTitle.className = "palette-section-title";
      paramTitle.textContent = "매개변수";
      sec.appendChild(paramTitle);

      for (const fn of funcsWithParams) {
        const group = document.createElement("div");
        group.className = "param-chip-group";

        const groupLabel = document.createElement("div");
        groupLabel.className = "param-chip-group-label";
        groupLabel.textContent = fn.name;
        group.appendChild(groupLabel);

        const paramRow = document.createElement("div");
        paramRow.className = "param-chips";
        for (const spec of fn.paramSpecs) {
          const chip = document.createElement("div");
          chip.className = `param-chip${spec.variadic ? " param-chip-variadic" : ""}`;
          chip.textContent = spec.variadic ? `*${spec.name}` : spec.name;
          chip.title = `${fn.name}의 매개변수 — 함수 본문 값 칸에 드래그`;
          chip.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            startDrag("param_chip", chip, spec.variadic ? `*${spec.name}` : spec.name, PARAM_COLOR, {
              paramName: spec.name,
              paramOwnerFunc: fn.name,
            }, e);
          });
          paramRow.appendChild(chip);
        }
        group.appendChild(paramRow);
        sec.appendChild(group);
      }

      const paramHint = document.createElement("div");
      paramHint.className = "var-chips-empty";
      paramHint.textContent = "매개변수 칩은 해당 함수 본문 안에서만 쓸 수 있어요";
      sec.appendChild(paramHint);
    }

    const callTitle = document.createElement("div");
    callTitle.className = "palette-section-title";
    callTitle.textContent = "호출 블록";
    sec.appendChild(callTitle);

    const list = document.createElement("div");
    list.className = "my-blocks-list";
    if (!definedFunctions.length) {
      const hint = document.createElement("div");
      hint.className = "var-chips-empty";
      hint.textContent = "함수를 정의하면 호출 블록이 여기에 생겨요";
      list.appendChild(hint);
    } else {
      for (const fn of definedFunctions) {
        const label = formatFuncLabel(fn.name, fn.paramSpecs);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "palette-btn palette-draggable";
        btn.style.setProperty("--block-color", FUNC_COLOR);
        btn.appendChild(
          makeDragHandle(btn, label, FUNC_COLOR, {
            paletteId: "func_call",
            presetSlots: { name: fn.name },
          }),
        );
        const lbl = document.createElement("span");
        lbl.textContent = label;
        btn.appendChild(lbl);
        btn.addEventListener("pointerdown", (e) => {
          if ((e.target as HTMLElement).closest(".block-drag-handle")) return;
          e.preventDefault();
          startDrag("palette", btn, label, FUNC_COLOR, {
            paletteId: "func_call",
            presetSlots: { name: fn.name },
          }, e);
        });
        btn.addEventListener("click", (e) => {
          if (suppressPaletteClick) {
            suppressPaletteClick = false;
            return;
          }
          if ((e.target as HTMLElement).closest(".block-drag-handle")) return;
          addFuncCall(fn.name);
        });
        list.appendChild(btn);
      }
    }
    sec.appendChild(list);
    container.appendChild(sec);
  };

  const renderCategorySidebar = () => {
    const sidebar = paletteEl.closest(".poke-palette-dock")?.querySelector<HTMLElement>("#palette-sidebar");
    if (!sidebar) return;

    const items = [
      { id: "my_blocks", label: "내 블록", color: "#c850c8" },
      { id: "variable", label: "변수", color: VAR_COLOR },
      ...paletteByCategory()
        .filter((c) => c.id !== "variable" && c.id !== "my_blocks")
        .map((c) => ({ id: c.id, label: c.label, color: c.color })),
    ];

    sidebar.innerHTML = "";
    for (const item of items) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `palette-cat-btn${activePaletteCategory === item.id ? " active" : ""}`;
      btn.style.setProperty("--cat-color", item.color);
      btn.dataset.category = item.id;
      btn.title = item.label;
      btn.innerHTML = `<span class="palette-cat-bar"></span><span class="palette-cat-text">${item.label}</span>`;
      btn.addEventListener("click", () => {
        if (activePaletteCategory === item.id) return;
        activePaletteCategory = item.id;
        fullRender();
      });
      sidebar.appendChild(btn);
    }
  };

  const appendPaletteReporter = (container: HTMLElement, id: string) => {
    const def = getBlockDef(id);
    if (!def) return;
    const inst = createBlockInstance(id, { empty: true });
    const preview: WorkspaceBlock = { uid: 0, id: inst.id, slots: { ...inst.slots } };
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "palette-btn palette-draggable palette-reporter";
    btn.style.setProperty("--block-color", def.color);
    btn.dataset.paletteId = id;
    btn.title = isReporterBlock(id) ? "값·조건 칸에 드래그" : def.label;
    btn.appendChild(makeDragHandle(btn, def.label, def.color, { paletteId: id }));
    const previewEl = document.createElement("div");
    previewEl.className = "palette-reporter-preview";
    buildStackHeader(preview, def, previewEl);
    btn.appendChild(previewEl);
    btn.addEventListener("pointerdown", (e) => {
      if ((e.target as HTMLElement).closest(".block-drag-handle")) return;
      e.preventDefault();
      startDrag("palette", btn, def.label, def.color, { paletteId: id }, e);
    });
    container.appendChild(btn);
  };

  const appendPaletteBlock = (container: HTMLElement, id: string) => {
    const def = getBlockDef(id);
    if (!def) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "palette-btn palette-draggable";
    btn.style.setProperty("--block-color", def.color);
    btn.dataset.paletteId = id;
    btn.title = isExprNestBlock(id) ? `${def.label} — 작업대 또는 값 칸에 드래그` : def.label;
    btn.appendChild(makeDragHandle(btn, def.label, def.color, { paletteId: id }));
    const lbl = document.createElement("span");
    lbl.textContent = def.label;
    btn.appendChild(lbl);
    btn.addEventListener("pointerdown", (e) => {
      if ((e.target as HTMLElement).closest(".block-drag-handle")) return;
      e.preventDefault();
      startDrag("palette", btn, def.label, def.color, { paletteId: id }, e);
    });
    btn.addEventListener("click", (e) => {
      if (suppressPaletteClick) {
        suppressPaletteClick = false;
        return;
      }
      if ((e.target as HTMLElement).closest(".block-drag-handle")) return;
      addToList(blocks, id);
    });
    container.appendChild(btn);
  };

  const buildStackHeader = (
    block: WorkspaceBlock,
    def: NonNullable<ReturnType<typeof getBlockDef>>,
    header: HTMLElement,
  ) => {
    const slot = (name: string, w?: number) => {
      const s = def.slots.find((x) => x.name === name)!;
      return makeSlotWidget(block, s, w);
    };
    const eq = (text = "=") => {
      const s = document.createElement("span");
      s.className = "block-eq";
      s.textContent = text;
      return s;
    };
    renderBlockHeader(block, def, header, slot, eq);
  };

  const renderBlockList = (
    list: WorkspaceBlock[],
    container: HTMLElement,
    listKey: ListKey,
    emptyHint: string,
  ) => {
    listRegistry.set(listKey, list);
    container.classList.add("drop-list");
    container.innerHTML = "";

    if (!list.length) {
      const emptyWrap = document.createElement("div");
      emptyWrap.className = "nest-empty-wrap";
      emptyWrap.appendChild(makeDropGap(listKey, 0, true));
      const empty = document.createElement("div");
      empty.className = "nest-empty";
      empty.textContent = emptyHint;
      emptyWrap.appendChild(empty);
      container.appendChild(emptyWrap);
      return;
    }

    container.appendChild(makeDropGap(listKey, 0));
    for (let i = 0; i < list.length; i++) {
      renderOneBlock(list, i, container, listKey);
      container.appendChild(makeDropGap(listKey, i + 1));
    }
  };

  const renderOneBlock = (list: WorkspaceBlock[], idx: number, container: HTMLElement, listKey: ListKey) => {
    const block = list[idx];
    const def = getBlockDef(block.id);
    if (!def) return;

    if (def.shape === "c_block") {
      const wrap = document.createElement("div");
      wrap.className = "block-c block-draggable";
      wrap.style.setProperty("--block-color", def.color);
      wrap.dataset.uid = String(block.uid);

      const header = document.createElement("div");
      header.className = "block-c-header";
      header.appendChild(makeDragHandle(wrap, def.label, def.color, { uid: block.uid }));

      if (def.id === "for_range") {
        const lbl = document.createElement("span");
        lbl.className = "block-label";
        lbl.textContent = "for";
        header.appendChild(lbl);
        const varSlot = def.slots.find((s) => s.name === "var")!;
        const stopSlot = def.slots.find((s) => s.name === "stop")!;
        header.appendChild(makeSlotWidget(block, varSlot, varSlot.width ?? 40));
        const inLbl = document.createElement("span");
        inLbl.className = "block-eq";
        inLbl.textContent = " in range(";
        header.appendChild(inLbl);
        header.appendChild(makeSlotWidget(block, stopSlot, stopSlot.width ?? 40));
        const close = document.createElement("span");
        close.className = "block-eq";
        close.textContent = ")";
        header.appendChild(close);
      } else if (def.id === "for_range_from") {
        const lbl = document.createElement("span");
        lbl.className = "block-label";
        lbl.textContent = "for";
        header.appendChild(lbl);
        const varSlot = def.slots.find((s) => s.name === "var")!;
        const startSlot = def.slots.find((s) => s.name === "start")!;
        const stopSlot = def.slots.find((s) => s.name === "stop")!;
        header.appendChild(makeSlotWidget(block, varSlot, varSlot.width ?? 40));
        const inLbl = document.createElement("span");
        inLbl.className = "block-eq";
        inLbl.textContent = " in range(";
        header.appendChild(inLbl);
        header.appendChild(makeSlotWidget(block, startSlot, startSlot.width ?? 40));
        const comma = document.createElement("span");
        comma.className = "block-eq";
        comma.textContent = ", ";
        header.appendChild(comma);
        header.appendChild(makeSlotWidget(block, stopSlot, stopSlot.width ?? 40));
        const close = document.createElement("span");
        close.className = "block-eq";
        close.textContent = ")";
        header.appendChild(close);
      } else if (def.id === "def_func") {
        const lbl = document.createElement("span");
        lbl.className = "block-label";
        lbl.textContent = "def";
        header.appendChild(lbl);
        const nameSlot = def.slots.find((s) => s.name === "name")!;
        header.appendChild(makeSlotWidget(block, nameSlot, nameSlot.width ?? 88));
        const open = document.createElement("span");
        open.className = "block-eq";
        open.textContent = "(";
        header.appendChild(open);
        const paramsSlot = def.slots.find((s) => s.name === "params")!;
        header.appendChild(makeSlotWidget(block, paramsSlot, paramsSlot.width ?? 120));
        const close = document.createElement("span");
        close.className = "block-eq";
        close.textContent = ")";
        header.appendChild(close);
      } else if (def.id === "else") {
        const lbl = document.createElement("span");
        lbl.className = "block-label";
        lbl.textContent = "else";
        header.appendChild(lbl);
      } else {
        const lbl = document.createElement("span");
        lbl.className = "block-label";
        lbl.textContent =
          def.id === "while_loop" ? "while"
            : def.id === "elif" ? "elif"
              : "if";
        header.appendChild(lbl);
        const condSlot = def.slots.find((s) => s.name === "cond");
        if (condSlot) header.appendChild(makeSlotWidget(block, condSlot, condSlot.width ?? 180));
      }

      header.appendChild(makeDeleteBtn(list, idx));
      wrap.appendChild(header);
      bindBlockDrag(header, wrap, def.label, def.color, { uid: block.uid });

      if (!block.body) block.body = [];
      const bodyZone = document.createElement("div");
      bodyZone.className = "block-c-zone";
      const bodyNest = document.createElement("div");
      bodyNest.className = "block-c-nest";
      renderBlockList(block.body, bodyNest, `${block.uid}:body`, "왼쪽 메뉴에서 블록을 끌어다 놓으세요");
      bodyZone.appendChild(bodyNest);
      wrap.appendChild(bodyZone);

      if (def.hasElse) {
        if (!block.elseBody) block.elseBody = [];
        const elseLbl = document.createElement("div");
        elseLbl.className = "block-c-else-label";
        elseLbl.textContent = "아니면";
        wrap.appendChild(elseLbl);

        const elseZone = document.createElement("div");
        elseZone.className = "block-c-zone block-c-zone-else";
        const elseNest = document.createElement("div");
        elseNest.className = "block-c-nest";
        renderBlockList(block.elseBody, elseNest, `${block.uid}:else`, "아니면 실행할 블록을 메뉴에서 끌어오세요");
        elseZone.appendChild(elseNest);
        wrap.appendChild(elseZone);
      }

      container.appendChild(wrap);
      return;
    }

    const row = document.createElement("div");
    row.className = "block-row block-draggable";
    row.style.setProperty("--block-color", def.color);
    row.dataset.uid = String(block.uid);
    row.appendChild(makeDragHandle(row, def.label, def.color, { uid: block.uid }));
    buildStackHeader(block, def, row);
    row.appendChild(makeDeleteBtn(list, idx));
    bindBlockDrag(row, row, def.label, def.color, { uid: block.uid });
    container.appendChild(row);
  };

  const render = () => {
    listRegistry.clear();
    workspaceEl.innerHTML = "";
    if (!blocks.length) {
      const empty = document.createElement("div");
      empty.className = "workspace-empty-wrap";
      listRegistry.set("root", blocks);
      empty.appendChild(makeDropGap("root", 0, true));
      const hint = document.createElement("div");
      hint.className = "workspace-empty";
      hint.textContent = "왼쪽 블록 메뉴에서 끌어다 놓거나, 클릭해서 추가하세요";
      empty.appendChild(hint);
      workspaceEl.appendChild(empty);
      return;
    }
    renderBlockList(blocks, workspaceEl, "root", "");
  };

  const renderPalette = () => {
    paletteEl.innerHTML = "";
    renderCategorySidebar();

    const labelEl = paletteEl
      .closest(".poke-palette-dock")
      ?.querySelector<HTMLElement>("#palette-category-label");
    if (labelEl) labelEl.textContent = paletteCategoryLabel();

    if (activePaletteCategory === "variable") {
      renderVariablesPanel(paletteEl);
      return;
    }

    if (activePaletteCategory === "my_blocks") {
      renderMyBlocksPanel(paletteEl);
      return;
    }

    const cat = paletteByCategory().find((c) => c.id === activePaletteCategory);
    if (!cat) {
      activePaletteCategory = "print";
      return renderPalette();
    }

    const sec = document.createElement("div");
    sec.className = "palette-section palette-section-active";
    sec.dataset.category = cat.id;
    sec.style.setProperty("--cat-color", cat.color);
    for (const id of cat.ids) {
      if (isReporterBlock(id)) appendPaletteReporter(sec, id);
      else appendPaletteBlock(sec, id);
    }
    paletteEl.appendChild(sec);
  };

  const reassignBlock = (b: WorkspaceBlock): WorkspaceBlock => ({
    ...b,
    uid: allocUid(),
    nestedSlots: b.nestedSlots
      ? Object.fromEntries(Object.entries(b.nestedSlots).map(([k, v]) => [k, reassignBlock(v)]))
      : undefined,
    body: b.body?.map(reassignBlock),
    elseBody: b.elseBody?.map(reassignBlock),
  });

  const reassignUids = (src: WorkspaceBlock[]): WorkspaceBlock[] => src.map(reassignBlock);

  syncVariableList();
  fullRender();

  return {
    getBlocks: () => blocks,
    getVariables: () => [...variables],
    reset(specs: BlockSpec[]) {
      resetBlockUids(1);
      blocks = specsToBlocks(specs);
      variables = collectInitialVariables(specs, undefined);
      if (options.initialVariables?.length) {
        variables = [...new Set([...variables, ...options.initialVariables])].sort();
      }
      syncVariableList();
      fullRender();
      notify();
    },
    setBlocks(newBlocks: WorkspaceBlock[]) {
      resetBlockUids(1);
      blocks = reassignUids(newBlocks);
      syncVariableList();
      fullRender();
      notify();
    },
    render: fullRender,
  };
}

export { blocksToCode };
