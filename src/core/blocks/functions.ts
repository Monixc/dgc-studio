import type { WorkspaceBlock } from "./types";
import { getBlockDef } from "./catalog";
import { isValidVarName, normalizeVarName } from "./variables";

export const FUNC_COLOR = "#6868c8";
export const PARAM_COLOR = "#8898d8";

export interface ParamSpec {
  name: string;
  variadic: boolean;
}

export interface DefinedFunction {
  name: string;
  paramSpecs: ParamSpec[];
}

export function isValidFuncName(name: string): boolean {
  return isValidVarName(name);
}

export function normalizeFuncName(name: string): string {
  return normalizeVarName(name);
}

/** "hp, *args" → [{ name: "hp" }, { name: "args", variadic: true }] */
export function parseParamSpecs(raw: string): ParamSpec[] {
  if (!raw.trim()) return [];
  const specs: ParamSpec[] = [];
  let seenVariadic = false;
  for (const part of raw.split(",")) {
    let trimmed = part.trim();
    if (!trimmed) continue;
    if (seenVariadic) break;
    let variadic = false;
    if (trimmed.startsWith("*")) {
      variadic = true;
      seenVariadic = true;
      trimmed = trimmed.slice(1).trim();
    }
    const name = normalizeFuncName(trimmed);
    if (isValidFuncName(name)) specs.push({ name, variadic });
  }
  return specs;
}

/** def 매개변수 이름 목록 (가변 포함) */
export function parseParamNames(raw: string): string[] {
  return parseParamSpecs(raw).map((s) => s.name);
}

export function formatParamsSignature(specs: ParamSpec[]): string {
  return specs.map((s) => (s.variadic ? `*${s.name}` : s.name)).join(", ");
}

export function formatParamNames(names: string[]): string {
  return names.join(", ");
}

export function formatFuncLabel(name: string, specs: ParamSpec[]): string {
  const sig = formatParamsSignature(specs);
  return sig ? `${name}(${sig})` : `${name}()`;
}

export function collectDefinedFunctions(blocks: WorkspaceBlock[]): DefinedFunction[] {
  const byName = new Map<string, DefinedFunction>();
  const walk = (items: WorkspaceBlock[]) => {
    for (const b of items) {
      if (b.id === "def_func") {
        const name = normalizeFuncName(b.slots.name ?? "");
        if (name && isValidFuncName(name)) {
          byName.set(name, {
            name,
            paramSpecs: parseParamSpecs(b.slots.params ?? ""),
          });
        }
      }
      if (b.body?.length) walk(b.body);
      if (b.elseBody?.length) walk(b.elseBody);
    }
  };
  walk(blocks);
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function collectFuncNames(blocks: WorkspaceBlock[]): string[] {
  return collectDefinedFunctions(blocks).map((f) => f.name);
}

export function findDefinedFunction(
  blocks: WorkspaceBlock[],
  name: string,
): DefinedFunction | undefined {
  const n = normalizeFuncName(name);
  return collectDefinedFunctions(blocks).find((f) => f.name === n);
}

export function puzzleUsesFunctions(paletteIds: string[]): boolean {
  return paletteIds.some((id) => {
    const def = getBlockDef(id);
    return def?.slots.some((s) => s.kind === "func");
  });
}

/** blockUid가 속한 가장 가까운 def_func 블록 */
export function findEnclosingDefFunc(
  blocks: WorkspaceBlock[],
  targetUid: number,
): WorkspaceBlock | null {
  let found: WorkspaceBlock | null = null;
  const walk = (list: WorkspaceBlock[], ancestors: WorkspaceBlock[]): boolean => {
    for (const b of list) {
      if (b.uid === targetUid) {
        for (let i = ancestors.length - 1; i >= 0; i--) {
          if (ancestors[i].id === "def_func") {
            found = ancestors[i];
            return true;
          }
        }
        return true;
      }
      if (b.body?.length && walk(b.body, [...ancestors, b])) return true;
      if (b.elseBody?.length && walk(b.elseBody, [...ancestors, b])) return true;
    }
    return false;
  };
  walk(blocks, []);
  return found;
}

/** 슬롯이 속한 def 본문 안에서 매개변수 이름인지 */
export function isParamInScope(
  blocks: WorkspaceBlock[],
  blockUid: number,
  paramName: string,
  ownerFunc?: string,
): boolean {
  const def = findEnclosingDefFunc(blocks, blockUid);
  if (!def) return false;
  const funcName = normalizeFuncName(def.slots.name ?? "");
  if (ownerFunc && funcName !== normalizeFuncName(ownerFunc)) return false;
  return parseParamNames(def.slots.params ?? "").includes(normalizeFuncName(paramName));
}

/** 함수 호출 인수 힌트 — 가변 매개변수면 "…" 표시 */
export function formatCallArgsHint(specs: ParamSpec[]): string {
  if (!specs.length) return "";
  const parts = specs.map((s) => (s.variadic ? `*${s.name}…` : s.name));
  return parts.join(", ");
}
