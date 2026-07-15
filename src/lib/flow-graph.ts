import dagre from "@dagrejs/dagre";
import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { FlowGraph, FlowNode, FlowEdge, NodeType } from "@/types/flowchart";
import type { FlowchartPayload } from "@/integrations/supabase/types";
import { parseDsl } from "@/lib/dsl-parser";
import type { FlowNodeData } from "@/lib/flow-layout";
import { NODE_SIZE } from "@/components/flow/FlowNode";

export function emptyGraph(): FlowGraph {
  return { nodes: [], edges: [] };
}

/** 부모가 자식보다 먼저 오도록 위상 정렬(중첩 깊이 무관). React Flow parent 노드 요구사항. */
export function orderParentsFirst<T extends { id: string; parentId?: string }>(nodes: T[]): T[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const done = new Set<string>();
  const out: T[] = [];
  const visit = (n: T) => {
    if (done.has(n.id)) return;
    const parent = n.parentId ? byId.get(n.parentId) : undefined;
    if (parent) visit(parent);
    done.add(n.id);
    out.push(n);
  };
  nodes.forEach(visit);
  return out;
}

export function sizeFor(type: NodeType): { w: number; h: number } {
  return NODE_SIZE[type];
}

/** dagre 로 좌표를 (재)계산한 새 그래프 반환. 간선이 없으면 세로로 나란히 쌓는다. */
export function autoLayout(graph: FlowGraph): FlowGraph {
  if (graph.edges.length === 0) {
    let y = 20;
    return {
      nodes: graph.nodes.map((n) => {
        const s = sizeFor(n.type);
        const node = { ...n, position: { x: 40, y } };
        y += s.h + 40;
        return node;
      }),
      edges: [],
    };
  }
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

/**
 * DSL 텍스트 → 캔버스 그래프. for 루프는 컨테이너로 중첩(본문 노드를 감싸고
 * 상단→첫 블록, 마지막 블록→하단을 직선으로 연결). 나머지는 dagre 세로 배치.
 */
export function dslToGraph(dsl: string): FlowGraph {
  const { data } = parseDsl(dsl);
  const nodes: FlowNode[] = data.nodes.map((n) => ({ ...n }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const order = new Map(nodes.map((n, i) => [n.id, i]));
  const forIds = new Set(nodes.filter((n) => n.type === "for").map((n) => n.id));

  const PAD = 20;
  const HEADER = 30;
  const GAP = 36;

  // 컨테이너 소속(scope=for id) → parentId
  const childrenOf = new Map<string, FlowNode[]>();
  for (const n of nodes) {
    if (n.scope && forIds.has(n.scope)) {
      n.parentId = n.scope;
      if (!childrenOf.has(n.scope)) childrenOf.set(n.scope, []);
      childrenOf.get(n.scope)!.push(n);
    }
  }

  // 컨테이너 재귀 크기/배치(자식 세로 스택)
  const sizeContainer = (forId: string): { w: number; h: number } => {
    const kids = (childrenOf.get(forId) ?? []).sort((a, b) => (order.get(a.id)! - order.get(b.id)!));
    let y = HEADER;
    let maxW = 160;
    for (const k of kids) {
      let kw: number;
      let kh: number;
      if (k.type === "for") {
        const s = sizeContainer(k.id);
        kw = s.w;
        kh = s.h;
      } else {
        const s = NODE_SIZE[k.type];
        kw = s.w;
        kh = s.h;
      }
      k.position = { x: PAD, y };
      y += kh + GAP;
      maxW = Math.max(maxW, kw);
    }
    const w = maxW + 2 * PAD;
    const h = Math.max(120, y - GAP + PAD);
    const f = byId.get(forId)!;
    f.width = w;
    f.height = h;
    return { w, h };
  };
  for (const id of forIds) if (!byId.get(id)!.parentId) sizeContainer(id);
  for (const id of forIds) if (byId.get(id)!.width == null) sizeContainer(id);

  // 최상위 노드 dagre 배치(컨테이너는 계산된 크기로)
  const dimOf = (n: FlowNode) => (n.type === "for" ? { w: n.width ?? 260, h: n.height ?? 160 } : NODE_SIZE[n.type]);
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 44, ranksep: 60, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  const top = nodes.filter((n) => !n.parentId);
  for (const n of top) {
    const d = dimOf(n);
    g.setNode(n.id, { width: d.w, height: d.h });
  }
  for (const e of data.edges) {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (s && t && !s.parentId && !t.parentId) g.setEdge(e.source, e.target);
  }
  dagre.layout(g);
  for (const n of top) {
    const p = g.node(n.id);
    const d = dimOf(n);
    n.position = { x: (p?.x ?? 0) - d.w / 2, y: (p?.y ?? 0) - d.h / 2 };
  }

  // 간선: for 관련은 직선 + 상단/하단만, 나머지는 smoothstep
  const edges: FlowEdge[] = data.edges.map((e) => {
    const s = byId.get(e.source)!;
    const t = byId.get(e.target)!;
    const base = { id: e.id, source: e.source, target: e.target };
    // 컨테이너 → 첫 본문 블록(진입): 상단에서 상단으로 직선
    if (s.type === "for" && t.parentId === s.id)
      return { ...base, pathType: "straight" as const, sourceHandle: "top", targetHandle: "top" };
    // 마지막 본문 블록 → 컨테이너(복귀): 하단에서 하단으로 직선
    if (t.type === "for" && s.parentId === t.id)
      return { ...base, pathType: "straight" as const, sourceHandle: "bottom", targetHandle: "bottom" };
    // 컨테이너 → 다음(루프 종료): 하단→상단 직선
    if (s.type === "for")
      return { ...base, pathType: "straight" as const, sourceHandle: "bottom", targetHandle: "top" };
    // 밖 → 컨테이너 진입: 하단→상단 직선
    if (t.type === "for") return { ...base, pathType: "straight" as const, sourceHandle: "bottom", targetHandle: "top" };
    // 일반: 되돌아가기면 우측, 아니면 하단→상단
    const back = (order.get(e.source) ?? 0) > (order.get(e.target) ?? 0);
    return { ...base, label: e.label, sourceHandle: back ? "right" : "bottom", targetHandle: back ? "left" : "top" };
  });

  return { nodes, edges };
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
  // 부모(for 컨테이너)가 자식보다 먼저 오도록 위상 정렬 (React Flow 요구사항, 중첩 지원)
  const ordered = orderParentsFirst(graph.nodes);
  return ordered.map((n) => {
    const node: Node = {
      id: n.id,
      type: "flow",
      position: n.position ?? { x: 0, y: 0 },
      data: { label: n.label, nodeType: n.type, style: n.style, onLabelChange: opts?.onLabelChange } satisfies FlowNodeData,
    };
    if (n.type === "for") node.style = { width: n.width ?? 260, height: n.height ?? 160 };
    // parentId 로 그룹 소속만 지정(extent 미지정 → 밖으로 드래그해 분리 가능)
    if (n.parentId) node.parentId = n.parentId;
    return node;
  });
}

export function toRFEdges(graph: FlowGraph): Edge[] {
  return graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? "bottom",
    targetHandle: e.targetHandle ?? "top",
    label: e.label,
    type: e.pathType ?? "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed },
    labelStyle: { fontSize: 11, fontWeight: 600 },
    labelBgStyle: { fill: "hsl(var(--background))" },
  }));
}

/** React Flow 상태 → 저장용 그래프. */
export function fromRF(nodes: Node[], edges: Edge[]): FlowGraph {
  return {
    nodes: nodes.map((n) => {
      const d = n.data as FlowNodeData;
      const anyN = n as unknown as { measured?: { width?: number; height?: number }; width?: number; height?: number };
      const w = (n.style?.width as number) ?? anyN.width ?? anyN.measured?.width;
      const h = (n.style?.height as number) ?? anyN.height ?? anyN.measured?.height;
      return {
        id: n.id,
        type: d.nodeType,
        label: d.label,
        style: d.style,
        position: n.position,
        parentId: n.parentId,
        ...(d.nodeType === "for" ? { width: w, height: h } : {}),
      };
    }),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: typeof e.label === "string" ? e.label : undefined,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
      pathType: (e.type as "smoothstep" | "straight" | "bezier" | undefined) ?? undefined,
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
