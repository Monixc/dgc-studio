import dagre from "@dagrejs/dagre";
import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { FlowGraph, FlowNode, NodeType } from "@/types/flowchart";
import type { FlowchartPayload } from "@/integrations/supabase/types";
import { parseDsl } from "@/lib/dsl-parser";
import type { FlowNodeData } from "@/lib/flow-layout";

export function emptyGraph(): FlowGraph {
  return { nodes: [], edges: [] };
}

export function sizeFor(type: NodeType): { w: number; h: number } {
  switch (type) {
    case "if":
    case "while":
      return { w: 150, h: 90 };
    case "start":
    case "end":
      return { w: 110, h: 48 };
    case "for":
      return { w: 190, h: 56 };
    default:
      return { w: 180, h: 56 };
  }
}

const HANDLES = { source: ["bottom", "right"], target: ["top", "left"] };

/** dagre 로 좌표를 (재)계산한 새 그래프 반환. */
export function autoLayout(graph: FlowGraph): FlowGraph {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 44, ranksep: 60, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of graph.nodes) {
    const s = sizeFor(n.type);
    g.setNode(n.id, { width: s.w, height: s.h });
  }
  for (const e of graph.edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  const order = new Map(graph.nodes.map((n, i) => [n.id, i]));
  return {
    nodes: graph.nodes.map((n) => {
      const p = g.node(n.id);
      const s = sizeFor(n.type);
      return { ...n, position: { x: (p?.x ?? 0) - s.w / 2, y: (p?.y ?? 0) - s.h / 2 } };
    }),
    edges: graph.edges.map((e) => {
      const back = (order.get(e.source) ?? 0) > (order.get(e.target) ?? 0);
      return { ...e, sourceHandle: back ? "right" : "bottom", targetHandle: back ? "left" : "top" };
    }),
  };
}

/** DSL 텍스트 → 자동 배치된 캔버스 그래프. */
export function dslToGraph(dsl: string): FlowGraph {
  const { data } = parseDsl(dsl);
  return autoLayout({ nodes: data.nodes, edges: data.edges });
}

/** DB 저장 payload → 캔버스 그래프(구버전 dsl/positions 도 수용). */
export function normalizeStored(payload: FlowchartPayload | null | undefined): FlowGraph {
  if (!payload) return emptyGraph();
  if (payload.nodes && payload.nodes.length) {
    return { nodes: payload.nodes, edges: payload.edges ?? [] };
  }
  // 구버전: dsl 있으면 임포트
  if (payload.dsl) {
    const g = dslToGraph(payload.dsl);
    if (payload.positions) {
      g.nodes = g.nodes.map((n) => (payload.positions![n.id] ? { ...n, position: payload.positions![n.id] } : n));
    }
    return g;
  }
  return emptyGraph();
}

/** 캔버스 그래프 → React Flow 노드. editable 이면 라벨 편집 콜백 주입. */
export function toRFNodes(
  graph: FlowGraph,
  opts?: { onLabelChange?: (id: string, label: string) => void }
): Node[] {
  return graph.nodes.map((n) => ({
    id: n.id,
    type: "flow",
    position: n.position ?? { x: 0, y: 0 },
    data: { label: n.label, nodeType: n.type, onLabelChange: opts?.onLabelChange } satisfies FlowNodeData,
  }));
}

export function toRFEdges(graph: FlowGraph): Edge[] {
  return graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? "bottom",
    targetHandle: e.targetHandle ?? "top",
    label: e.label,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed },
    labelStyle: { fontSize: 11, fontWeight: 600 },
    labelBgStyle: { fill: "hsl(var(--background))" },
  }));
}

/** React Flow 상태 → 저장용 그래프. */
export function fromRF(nodes: Node[], edges: Edge[]): FlowGraph {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: (n.data as FlowNodeData).nodeType,
      label: (n.data as FlowNodeData).label,
      position: n.position,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: typeof e.label === "string" ? e.label : undefined,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
    })),
  };
}

let idc = 0;
export function newNodeId(type: NodeType): string {
  return `${type}_${Date.now().toString(36)}_${idc++}`;
}
export function newEdgeId(): string {
  return `e_${Date.now().toString(36)}_${idc++}`;
}
