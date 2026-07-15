import { memo, useState, useEffect, useRef } from "react";
import { Handle, Position, NodeResizer, type NodeProps } from "@xyflow/react";
import type { NodeType } from "@/types/flowchart";
import type { FlowNodeData } from "@/lib/flow-layout";
import { cn } from "@/lib/utils";

export const NODE_SIZE: Record<NodeType, { w: number; h: number }> = {
  start: { w: 120, h: 48 },
  end: { w: 120, h: 48 },
  input: { w: 180, h: 56 },
  output: { w: 180, h: 56 },
  process: { w: 180, h: 56 },
  if: { w: 160, h: 90 },
  while: { w: 160, h: 90 },
  for: { w: 200, h: 60 },
  def: { w: 180, h: 56 },
  call: { w: 180, h: 56 },
};

const DEFAULT_BG = "#ffffff";
const DEFAULT_BORDER = "#111827";
const DEFAULT_TEXT = "#111827";

/** 타입별 SVG 도형. 컨테이너를 클립하지 않으므로 핸들이 잘리지 않는다. */
function Shape({ type, w, h, fill, stroke }: { type: NodeType; w: number; h: number; fill: string; stroke: string }) {
  const sw = 1.5;
  const p = sw;
  const common = { fill, stroke, strokeWidth: sw, strokeLinejoin: "round" as const };
  switch (type) {
    case "start":
    case "end":
      return <rect x={p} y={p} width={w - 2 * p} height={h - 2 * p} rx={(h - 2 * p) / 2} ry={(h - 2 * p) / 2} {...common} />;
    case "if":
    case "while":
      return <polygon points={`${w / 2},${p} ${w - p},${h / 2} ${w / 2},${h - p} ${p},${h / 2}`} {...common} />;
    case "input":
    case "output": {
      const s = 16;
      return <polygon points={`${s},${p} ${w - p},${p} ${w - s},${h - p} ${p},${h - p}`} {...common} />;
    }
    case "for": {
      const s = 16;
      return (
        <polygon
          points={`${s},${p} ${w - s},${p} ${w - p},${h / 2} ${w - s},${h - p} ${s},${h - p} ${p},${h / 2}`}
          {...common}
        />
      );
    }
    case "def":
      return (
        <>
          <rect x={p} y={p} width={w - 2 * p} height={h - 2 * p} rx={4} {...common} />
          <rect x={p + 5} y={p + 5} width={w - 2 * p - 10} height={h - 2 * p - 10} rx={2} fill="none" stroke={stroke} strokeWidth={sw} />
        </>
      );
    case "call":
      return (
        <>
          <rect x={p} y={p} width={w - 2 * p} height={h - 2 * p} rx={4} {...common} />
          <line x1={12} y1={p} x2={12} y2={h - p} stroke={stroke} strokeWidth={sw} />
          <line x1={w - 12} y1={p} x2={w - 12} y2={h - p} stroke={stroke} strokeWidth={sw} />
        </>
      );
    default:
      return <rect x={p} y={p} width={w - 2 * p} height={h - 2 * p} rx={4} {...common} />;
  }
}

const HANDLE_BASE =
  "!h-2.5 !w-2.5 !border !border-white !bg-primary opacity-0 transition-opacity duration-150 group-hover:opacity-100";

function FlowNodeInner({ id, data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const type = d.nodeType;
  const { w, h } = NODE_SIZE[type];
  const diamond = type === "if" || type === "while";
  const editable = !!d.onLabelChange;
  const bg = d.style?.bg || DEFAULT_BG;
  const border = d.style?.border || DEFAULT_BORDER;
  const text = d.style?.text || DEFAULT_TEXT;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(d.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(d.label), [d.label]);
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== d.label) d.onLabelChange?.(id, draft);
  };

  const labelInput = (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setDraft(d.label);
          setEditing(false);
        }
      }}
      className="nodrag rounded bg-white/90 px-1 text-center text-xs outline-none"
      style={{ color: text }}
    />
  );

  const handles = (
    <>
      <Handle id="top" type="target" position={Position.Top} className={HANDLE_BASE} isConnectable={editable} />
      <Handle id="left" type="target" position={Position.Left} className={HANDLE_BASE} isConnectable={editable} />
      <Handle id="bottom" type="source" position={Position.Bottom} className={HANDLE_BASE} isConnectable={editable} />
      <Handle id="right" type="source" position={Position.Right} className={HANDLE_BASE} isConnectable={editable} />
    </>
  );

  // for 컨테이너: 큰 사각형 안에 자식 노드를 감싼다 (v1 스타일)
  if (type === "for") {
    return (
      <div className="group relative h-full w-full" onDoubleClick={editable ? () => setEditing(true) : undefined}>
        {editable && <NodeResizer minWidth={180} minHeight={110} isVisible={!!selected} lineClassName="!border-primary" handleClassName="!bg-primary" />}
        <div
          className="absolute inset-0 rounded-lg border-2 border-dashed"
          style={{ borderColor: border, background: d.style?.bg || "rgba(139,92,246,0.06)" }}
        />
        <div className="absolute left-2 top-1 flex items-center gap-1 text-xs font-semibold" style={{ color: text }}>
          <span className="rounded bg-background/70 px-1">🔁</span>
          {editing ? labelInput : <span>{d.label}</span>}
        </div>
        {handles}
      </div>
    );
  }

  return (
    <div
      className="group relative"
      style={{ width: w, height: h }}
      title={d.label}
      onDoubleClick={editable ? () => setEditing(true) : undefined}
    >
      <svg width={w} height={h} className="absolute inset-0 block overflow-visible">
        <Shape type={type} w={w} h={h} fill={bg} stroke={border} />
      </svg>
      {selected && (
        <div className="pointer-events-none absolute -inset-1 rounded-md ring-2 ring-primary/60" />
      )}
      <div className={cn("absolute inset-0 flex items-center justify-center px-4 text-center", diamond && "px-6")}>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setDraft(d.label);
                setEditing(false);
              }
            }}
            className="nodrag w-full rounded bg-white/90 px-1 text-center text-xs outline-none"
            style={{ color: text }}
          />
        ) : (
          <span className="line-clamp-2 break-words text-xs font-medium" style={{ color: text }}>
            {d.label}
          </span>
        )}
      </div>
      <Handle id="top" type="target" position={Position.Top} className={HANDLE_BASE} isConnectable={editable} />
      <Handle id="left" type="target" position={Position.Left} className={HANDLE_BASE} isConnectable={editable} />
      <Handle id="bottom" type="source" position={Position.Bottom} className={HANDLE_BASE} isConnectable={editable} />
      <Handle id="right" type="source" position={Position.Right} className={HANDLE_BASE} isConnectable={editable} />
    </div>
  );
}

export const FlowNode = memo(FlowNodeInner);

export const nodeTypes = { flow: FlowNode };
