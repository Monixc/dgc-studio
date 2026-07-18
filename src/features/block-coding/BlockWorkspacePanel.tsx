import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { toPng } from "html-to-image";
import { mountBlockWorkspace, resetBlockUids, type BlockWorkspaceHandle } from "./BlockWorkspace";
import { blocksToCode } from "@/core/blocks/codegen";
import { codeToBlocks, resetReverseParseUids } from "@/core/blocks/reverseParse";
import type { WorkspaceBlock } from "@/core/blocks/types";
import "./block-workspace.css";

function parseToBlocks(code: string): WorkspaceBlock[] {
  resetReverseParseUids(1);
  if (!code.trim()) return [];
  // strictNullChecks 가 꺼져 있어 discriminated union 자동 좁히기가 동작하지 않음 — 캐스팅으로 우회
  const result = codeToBlocks(code) as { ok: boolean; blocks?: WorkspaceBlock[]; error?: string };
  return result.ok ? result.blocks ?? [] : [];
}

function maxUid(blocks: WorkspaceBlock[]): number {
  let max = 0;
  const walk = (list: WorkspaceBlock[]) => {
    for (const b of list) {
      if (b.uid > max) max = b.uid;
      if (b.body) walk(b.body);
      if (b.elseBody) walk(b.elseBody);
    }
  };
  walk(blocks);
  return max;
}

export interface BlockWorkspacePanelHandle {
  resetToStarter(): void;
  captureImage(): Promise<string>;
}

interface Props {
  /** 초기화 시 되돌아갈 원본 시작 코드 */
  starterCode: string;
  /** 작업대를 처음 그릴 때 불러올 코드(임시저장 또는 시작 코드) */
  initialCode: string;
  onCodeChange: (code: string) => void;
}

/** pokepy 블록 작업대(mountBlockWorkspace) 를 그대로 감싸는 React 래퍼 */
const BlockWorkspacePanel = forwardRef<BlockWorkspacePanelHandle, Props>(function BlockWorkspacePanel(
  { starterCode, initialCode, onCodeChange },
  ref,
) {
  const paletteRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLPreElement>(null);
  const handleRef = useRef<BlockWorkspaceHandle | null>(null);

  useEffect(() => {
    if (!paletteRef.current || !workspaceRef.current) return;
    const blocks = parseToBlocks(initialCode);
    resetBlockUids(maxUid(blocks) + 1);
    const handle = mountBlockWorkspace(workspaceRef.current, paletteRef.current, blocks, () => {
      const code = blocksToCode({ blocks: handle.getBlocks() });
      if (previewRef.current) previewRef.current.textContent = code;
      onCodeChange(code);
    });
    handleRef.current = handle;
    if (previewRef.current) previewRef.current.textContent = blocksToCode({ blocks: handle.getBlocks() });
    // 문제 전환 시 컴포넌트를 key로 언마운트/재마운트하므로 최초 1회만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      async captureImage() {
        const workspace = workspaceRef.current;
        if (!workspace) return "";
        const width = workspace.scrollWidth;
        const height = workspace.scrollHeight;
        return toPng(workspace, {
          backgroundColor: "#f8fafc",
          pixelRatio: 1,
          width,
          height,
          style: {
            width: `${width}px`,
            height: `${height}px`,
            maxHeight: "none",
            overflow: "visible",
          },
        });
      },
      resetToStarter() {
        const blocks = parseToBlocks(starterCode);
        handleRef.current?.setBlocks(blocks);
        const code = blocksToCode({ blocks });
        if (previewRef.current) previewRef.current.textContent = code;
        onCodeChange(code);
      },
    }),
    [starterCode, onCodeChange],
  );

  return (
    <div className="block-workspace-root flex h-full flex-col gap-2 overflow-hidden p-2 text-sm">
      <div className="poke-code-layout min-h-0 flex-1">
        <div className="poke-palette-dock">
          <div className="poke-panel-label palette-sidebar-header" aria-hidden="true">
            &#8203;
          </div>
          <nav className="palette-category-sidebar" id="palette-sidebar" aria-label="블록 카테고리" />
          <div className="poke-code-panel poke-palette-panel">
            <div className="poke-panel-label" id="palette-category-label">
              동작
            </div>
            <div className="block-palette-wrap">
              <div className="block-palette" ref={paletteRef} />
            </div>
          </div>
        </div>
        <div className="poke-code-panel poke-workspace-panel">
          <div className="poke-panel-label">작업 영역</div>
          <div className="block-workspace-wrap">
            <div className="block-workspace" ref={workspaceRef} />
          </div>
        </div>
        <div className="poke-code-panel poke-preview-panel">
          <div className="poke-panel-label">Python 미리보기</div>
          <div className="code-preview-wrap">
            <pre className="code-preview" ref={previewRef} />
          </div>
        </div>
      </div>
    </div>
  );
});

export default BlockWorkspacePanel;
