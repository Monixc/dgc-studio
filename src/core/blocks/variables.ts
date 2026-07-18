import type { BlockSpec, WorkspaceBlock } from "./types";
import { getBlockDef } from "./catalog";

export const VAR_COLOR = "#e87830";

export function isValidVarName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name.trim());
}

export function normalizeVarName(name: string): string {
  return name.trim().replace(/\s+/g, "_");
}

function addFromSlots(spec: BlockSpec, set: Set<string>) {
  const def = getBlockDef(spec.id);
  if (!def) return;
  for (const slot of def.slots) {
    if (slot.kind === "var" && spec.slots?.[slot.name]) {
      const v = String(spec.slots[slot.name]);
      if (isValidVarName(v)) set.add(v);
    }
  }
  if (spec.id === "var_set" && spec.slots?.name) {
    const v = String(spec.slots.name);
    if (isValidVarName(v)) set.add(v);
  }
}

export function collectInitialVariables(
  specs: BlockSpec[],
  env?: Record<string, unknown>,
): string[] {
  const set = new Set<string>();
  const walk = (s: BlockSpec) => {
    addFromSlots(s, set);
    s.body?.forEach(walk);
    (s.else_body ?? s.elseBody)?.forEach(walk);
  };
  specs.forEach(walk);
  if (env) {
    for (const k of Object.keys(env)) {
      if (isValidVarName(k)) set.add(k);
    }
  }
  return [...set].sort();
}

export function collectVariablesFromBlocks(blocks: WorkspaceBlock[]): string[] {
  const set = new Set<string>();
  const walk = (list: WorkspaceBlock[]) => {
    for (const block of list) {
      const def = getBlockDef(block.id);
      if (def) {
        for (const slot of def.slots) {
          if (slot.kind === "var" && block.slots[slot.name]) {
            const v = String(block.slots[slot.name]);
            if (isValidVarName(v)) set.add(v);
          }
        }
      }
      if (block.body?.length) walk(block.body);
      if (block.elseBody?.length) walk(block.elseBody);
    }
  };
  walk(blocks);
  return [...set].sort();
}

export function puzzleUsesVariables(paletteIds: string[]): boolean {
  return paletteIds.some((id) => {
    const def = getBlockDef(id);
    return def?.slots.some((s) => s.kind === "var");
  });
}
