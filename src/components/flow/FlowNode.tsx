import { memo, useState, useEffect, useRef } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { NodeType } from "@/types/flowchart";
import type { FlowNodeData } from "@/lib/flow-layout";
import { cn } from "@/lib/utils";

const COLORS: Record<NodeType, string> = {
  start: "bg-emerald-100 border-emerald-400 text-emerald-900",
  end: "bg-rose-100 border-rose-400 text-rose-900",
  input: "bg-sky-100 border-sky-400 text-sky-900",
  output: "bg-sky-100 border-sky-400 text-sky-900",
  process: "bg-slate-100 border-slate-400 text-slate-900",
  if: "bg-amber-100 border-amber-400 text-amber-900",
  while: "bg-amber-100 border-amber-400 text-amber-900",
  for: "bg-violet-100 border-violet-400 text-violet-900",
  def: "bg-indigo-100 border-indigo-500 text-indigo-900",
  call: "bg-teal-100 border-teal-400 text-teal-900",
};

function shapeClass(type: NodeType): string {
  switch (type) {
    case "start":
    case "end":
      return "rounded-full";
    case "if":
    case "while":
      return "[clip-path:polygon(50%_0,100%_50%,50%_100%,0_50%)]";
    case "for":
      return "[clip-path:polygon(14px_0,calc(100%-14px)_0,100%_50%,calc(100%-14px)_100%,14px_100%,0_50%)]";
    case "input":
    case "output":
      return "[clip-path:polygon(12px_0,100%_0,calc(100%-12px)_100%,0_100%)]";
    case "def":
      return "rounded-md border-double border-4";
    case "call":
      return "rounded-md border-l-4 border-r-4";
    default:
      return "rounded-md";
  }
}

const handleStyle = { width: 9, height: 9, background: "hsl(var(--primary))", border: "1px solid white" };

function FlowNodeInner({ id, data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const type = d.nodeType;
  const diamond = type === "if" || type === "while";
  const editable = !!d.onLabelChange;
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

  return (
    <div
      className={cn(
        "relative flex items-center justify-center border px-4 text-center text-xs font-medium shadow-sm",
        COLORS[type],
        shapeClass(type),
        selected && "ring-2 ring-primary ring-offset-1"
      )}
      style={{
        width: diamond ? 150 : type === "for" ? 190 : type === "start" || type === "end" ? 110 : 180,
        height: diamond ? 90 : 56,
      }}
      title={d.label}
      onDoubleClick={editable ? () => setEditing(true) : undefined}
    >
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
        />
      ) : (
        <span className={cn("line-clamp-2 break-words", diamond && "px-6")}>{d.label}</span>
      )}
      <Handle id="top" type="target" position={Position.Top} style={handleStyle} isConnectable={editable} />
      <Handle id="left" type="target" position={Position.Left} style={handleStyle} isConnectable={editable} />
      <Handle id="bottom" type="source" position={Position.Bottom} style={handleStyle} isConnectable={editable} />
      <Handle id="right" type="source" position={Position.Right} style={handleStyle} isConnectable={editable} />
    </div>
  );
}

export const FlowNode = memo(FlowNodeInner);

export const nodeTypes = { flow: FlowNode };
