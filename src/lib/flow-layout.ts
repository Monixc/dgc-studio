import dagre from "@dagrejs/dagre";
import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { FlowchartData, NodeType } from "@/types/flowchart";

export interface FlowNodeData {
  label: string;
  nodeType: NodeType;
  [key: string]: unknown;
}

type XY = { x: number; y: number };

function sizeFor(type: NodeType): { w: number; h: number } {
  switch (type) {
    case "if":
    case "while":
      return { w: 150, h: 90 }; // 마름모는 넉넉히
    case "start":
    case "end":
      return { w: 110, h: 48 };
    case "for":
      return { w: 190, h: 56 };
    default:
      return { w: 180, h: 56 };
  }
}

/**
 * DSL 파싱 결과를 dagre 로 top-down 배치해 React Flow nodes/edges 로 변환.
 * positions override 가 있으면 해당 노드는 수동 좌표 사용(선생 미세조정).
 * 되돌아가기(back) 간선은 우측 핸들로 라우팅해 본문 위 겹침을 줄인다.
 */
export function layoutFlowchart(data: FlowchartData, positions?: Record<string, XY>): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 44, ranksep: 60, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  const order = new Map(data.nodes.map((n, i) => [n.id, i]));
  for (const n of data.nodes) {
    const s = sizeFor(n.type);
    g.setNode(n.id, { width: s.w, height: s.h });
  }
  for (const e of data.edges) g.setEdge(e.source, e.target);
  dagre.layout(g);

  const nodes: Node[] = data.nodes.map((n) => {
    const p = g.node(n.id);
    const override = positions?.[n.id];
    return {
      id: n.id,
      type: "flow",
      position: override ?? { x: p.x - p.width / 2, y: p.y - p.height / 2 },
      data: { label: n.label, nodeType: n.type } satisfies FlowNodeData,
    };
  });

  const edges: Edge[] = data.edges.map((e) => {
    const back = (order.get(e.source) ?? 0) > (order.get(e.target) ?? 0);
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      type: "smoothstep",
      sourceHandle: back ? "rs" : "b",
      targetHandle: back ? "rt" : "t",
      markerEnd: { type: MarkerType.ArrowClosed },
      labelStyle: { fontSize: 11, fontWeight: 600 },
      labelBgStyle: { fill: "hsl(var(--background))" },
    };
  });

  return { nodes, edges };
}
