import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { NodeType } from "@/types/flowchart";
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

/** 타입별 도형 컨테이너 클래스 (배경/테두리 형태) */
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

const handleStyle = { width: 8, height: 8, background: "hsl(var(--muted-foreground))", border: "none" };

function FlowNodeInner({ data, selected }: NodeProps) {
  const type = data.nodeType as NodeType;
  const label = data.label as string;
  const diamond = type === "if" || type === "while";
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
      title={label}
    >
      <span className={cn("line-clamp-2 break-words", diamond && "px-6")}>{label}</span>
      <Handle id="t" type="target" position={Position.Top} style={handleStyle} />
      <Handle id="b" type="source" position={Position.Bottom} style={handleStyle} />
      <Handle id="rs" type="source" position={Position.Right} style={{ ...handleStyle, top: "60%" }} />
      <Handle id="rt" type="target" position={Position.Right} style={{ ...handleStyle, top: "40%" }} />
    </div>
  );
}

export const FlowNode = memo(FlowNodeInner);

export const nodeTypes = { flow: FlowNode };
