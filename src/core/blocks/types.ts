/** 작업대 블록 트리 — Python BlockInstance 와 동일 구조 */

export interface WorkspaceBlock {
  uid: number;
  id: string;
  slots: Record<string, string>;
  /** bool/expr 슬롯에 끼운 reporter(연산) 블록 */
  nestedSlots?: Record<string, WorkspaceBlock>;
  body?: WorkspaceBlock[];
  elseBody?: WorkspaceBlock[];
}

export interface BlockSpec {
  id: string;
  slots?: Record<string, string>;
  body?: BlockSpec[];
  else_body?: BlockSpec[];
  elseBody?: BlockSpec[];
}

export interface BlockScript {
  blocks: WorkspaceBlock[];
}
