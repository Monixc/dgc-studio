import dagre from "@dagrejs/dagre";
import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { FlowGraph, FlowNode, FlowEdge, NodeType } from "@/types/flowchart";
import type { FlowchartPayload } from "@/integrations/supabase/types";
import { parseDsl } from "@/lib/dsl-parser";
import type { FlowNodeData } from "@/lib/flow-layout";
import { NODE_SIZE, nodeDims } from "@/components/flow/FlowNode";

/** 라벨이 길어 실제 렌더 크기가 커져도, 위치는 항상 기본 크기 기준 중심으로 고정(FlowNode의 중앙 정렬 렌더링과 짝을 이룸). */
function baseDim(type: NodeType): { w: number; h: number } {
  return NODE_SIZE[type];
}

/** if/while 분기선 방향. 타입별 기본 크기가 달라도 실제 중심이 같으면(단일 진행) 좌우로 안 꺾이고 곧게 내려가게. */
function branchHandle(
  s: { type: NodeType; position?: { x: number; y: number } },
  t: { type: NodeType; position?: { x: number; y: number } },
  label?: string
): "left" | "right" | "bottom" {
  if (!s.position || !t.position) return label === "참" || label === "반복" ? "left" : "right";
  const centerOf = (n: { type: NodeType; position: { x: number; y: number } }) => n.position.x + baseDim(n.type).w / 2;
  const dx = centerOf({ ...t, position: t.position }) - centerOf({ ...s, position: s.position });
  if (Math.abs(dx) < 4) return "bottom";
  return dx < 0 ? "left" : "right";
}

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

export function sizeFor(type: NodeType, label = ""): { w: number; h: number } {
  return nodeDims(type, label);
}

/** dagre 로 좌표를 (재)계산한 새 그래프 반환. 간선이 없으면 세로로 나란히 쌓는다. */
export function autoLayout(graph: FlowGraph): FlowGraph {
  if (graph.edges.length === 0) {
    let y = 20;
    return {
      nodes: graph.nodes.map((n) => {
        const s = sizeFor(n.type, n.label);
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
    const s = sizeFor(n.type, n.label);
    g.setNode(n.id, { width: s.w, height: s.h });
  }
  for (const e of graph.edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  const order = new Map(graph.nodes.map((n, i) => [n.id, i]));
  const nodes = graph.nodes.map((n) => {
    const p = g.node(n.id);
    const b = baseDim(n.type);
    return { ...n, position: { x: (p?.x ?? 0) - b.w / 2, y: (p?.y ?? 0) - b.h / 2 } };
  });
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  return {
    nodes,
    edges: graph.edges.map((e) => {
      const s = nodesById.get(e.source);
      const t = nodesById.get(e.target);
      if (s && t && (s.type === "if" || s.type === "while")) {
        return { ...e, sourceHandle: branchHandle(s, t, e.label), targetHandle: "top" };
      }
      const back = (order.get(e.source) ?? 0) > (order.get(e.target) ?? 0);
      return { ...e, sourceHandle: back ? "right" : "bottom", targetHandle: back ? "left" : "top" };
    }),
  };
}

/**
 * DSL 텍스트 → 캔버스 그래프. for 루프는 컨테이너로 중첩(본문 노드를 감싸고
 * 상단→첫 블록은 수직으로, 마지막 블록→하단은 직각 경로로 연결). 나머지는 dagre 세로 배치.
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

  // 컨테이너 재귀 크기/배치(자식 dagre 배치)
  const sizeContainer = (forId: string): { w: number; h: number } => {
    const kids = (childrenOf.get(forId) ?? []).sort((a, b) => (order.get(a.id)! - order.get(b.id)!));
    if (kids.length === 0) {
      const w = 180;
      const h = 120;
      const f = byId.get(forId)!;
      f.width = w;
      f.height = h;
      return { w, h };
    }

    // 1. 자식 중 'for' 컨테이너가 있으면 먼저 재귀적으로 크기를 계산
    for (const k of kids) {
      if (k.type === "for") {
        sizeContainer(k.id);
      }
    }

    // 2. dagre 그래프 구성
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "TB", nodesep: 44, ranksep: 40, marginx: PAD, marginy: PAD });
    g.setDefaultEdgeLabel(() => ({}));

    // 자식 노드 추가
    const kidsSet = new Set(kids.map((k) => k.id));
    for (const k of kids) {
      const w = k.type === "for" ? (k.width ?? 200) : nodeDims(k.type, k.label).w;
      const h = k.type === "for" ? (k.height ?? 60) : nodeDims(k.type, k.label).h;
      g.setNode(k.id, { width: w, height: h });
    }

    // 자식 간의 간선 추가. else 없는 if/while의 "거짓"(그대로 통과) 간선은 dagre 랭킹에서 제외 —
    // "참" 갈래가 곁가지처럼 별도 칸으로 밀려나 본선(if→다음)과 중심이 어긋나는 것을 막는다.
    // (간선 자체는 edges 배열에 그대로 남아 시각적으로는 계속 그려짐)
    for (const e of data.edges) {
      if (!kidsSet.has(e.source) || !kidsSet.has(e.target)) continue;
      const s = byId.get(e.source);
      if (e.label === "거짓" && (s?.type === "if" || s?.type === "while")) {
        const hasTrueBranch = data.edges.some((o) => o.source === e.source && o.label === "참");
        if (hasTrueBranch) continue;
      }
      g.setEdge(e.source, e.target);
    }

    // dagre 레이아웃 실행
    dagre.layout(g);

    // 3. 배치 좌표를 바탕으로 노드 위치 설정 및 컨테이너 크기 결정
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const k of kids) {
      const p = g.node(k.id);
      if (!p) continue;
      const w = k.type === "for" ? (k.width ?? 200) : nodeDims(k.type, k.label).w;
      const h = k.type === "for" ? (k.height ?? 60) : nodeDims(k.type, k.label).h;
      const x = p.x - w / 2;
      const y = p.y - h / 2;

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + w);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + h);
    }

    const contentW = maxX - minX;
    const contentH = maxY - minY;

    const offsetX = PAD - minX;
    const offsetY = HEADER + PAD - minY;

    for (const k of kids) {
      const p = g.node(k.id);
      if (p) {
        const w = k.type === "for" ? (k.width ?? 200) : baseDim(k.type).w;
        const h = k.type === "for" ? (k.height ?? 60) : baseDim(k.type).h;
        k.position = {
          x: p.x - w / 2 + offsetX,
          y: p.y - h / 2 + offsetY,
        };
      } else {
        k.position = { x: PAD, y: HEADER + PAD };
      }
    }

    const w = Math.max(180, contentW + 2 * PAD);
    const h = Math.max(110, contentH + HEADER + 2 * PAD);
    const f = byId.get(forId)!;
    f.width = w;
    f.height = h;
    return { w, h };
  };
  for (const id of forIds) if (!byId.get(id)!.parentId) sizeContainer(id);
  for (const id of forIds) if (byId.get(id)!.width == null) sizeContainer(id);

  // 최상위 노드 dagre 배치(컨테이너는 계산된 크기로). 간격 계산엔 실제(라벨 반영) 크기, 위치 중심엔 기본 크기 사용.
  const spacingDimOf = (n: FlowNode) => (n.type === "for" ? { w: n.width ?? 260, h: n.height ?? 160 } : nodeDims(n.type, n.label));
  const posDimOf = (n: FlowNode) => (n.type === "for" ? { w: n.width ?? 260, h: n.height ?? 160 } : baseDim(n.type));
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 44, ranksep: 60, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  const top = nodes.filter((n) => !n.parentId);
  for (const n of top) {
    const d = spacingDimOf(n);
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
    const d = posDimOf(n);
    n.position = { x: (p?.x ?? 0) - d.w / 2, y: (p?.y ?? 0) - d.h / 2 };
  }

  // def(함수)는 메인 흐름과 이어지지 않은 독립 서브그래프라 dagre가 같은 자리에 겹쳐 배치할 수 있다 →
  // 연결 성분별로 나눠, 메인(=start 포함) 흐름 오른쪽에 나란히 재배치.
  {
    const topIds = new Set(top.map((n) => n.id));
    const adj = new Map<string, string[]>(top.map((n) => [n.id, [] as string[]]));
    for (const e of data.edges) {
      if (topIds.has(e.source) && topIds.has(e.target)) {
        adj.get(e.source)!.push(e.target);
        adj.get(e.target)!.push(e.source);
      }
    }
    const topById = new Map(top.map((n) => [n.id, n]));
    const seen = new Set<string>();
    const components: FlowNode[][] = [];
    for (const n of top) {
      if (seen.has(n.id)) continue;
      const comp: FlowNode[] = [];
      const stack = [n.id];
      seen.add(n.id);
      while (stack.length) {
        const cur = stack.pop()!;
        comp.push(topById.get(cur)!);
        for (const nb of adj.get(cur) ?? []) if (!seen.has(nb)) { seen.add(nb); stack.push(nb); }
      }
      components.push(comp);
    }
    if (components.length > 1) {
      components.sort((a, b) => {
        const aMain = a.some((x) => x.type === "start") ? 1 : 0;
        const bMain = b.some((x) => x.type === "start") ? 1 : 0;
        if (aMain !== bMain) return bMain - aMain;
        return b.length - a.length;
      });
      const COMP_GAP = 60;
      // 실제 렌더 크기(nodeDims)는 기본 크기 중심으로 좌우/상하 대칭 확장되므로(FlowNode transform),
      // 경계는 position+기본크기/2 를 중심 삼아 실제 크기의 절반만큼 계산해야 정확하다.
      const bboxOf = (comp: FlowNode[]) => {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const nd of comp) {
          const base = posDimOf(nd);
          const actual = spacingDimOf(nd);
          const cx = nd.position!.x + base.w / 2;
          const cy = nd.position!.y + base.h / 2;
          minX = Math.min(minX, cx - actual.w / 2);
          maxX = Math.max(maxX, cx + actual.w / 2);
          minY = Math.min(minY, cy - actual.h / 2);
          maxY = Math.max(maxY, cy + actual.h / 2);
        }
        return { minX, maxX, minY, maxY };
      };
      let cursorX = bboxOf(components[0]).maxX + COMP_GAP;
      for (let i = 1; i < components.length; i++) {
        const box = bboxOf(components[i]);
        const dx = cursorX - box.minX;
        const dy = 20 - box.minY;
        for (const nd of components[i]) nd.position = { x: nd.position!.x + dx, y: nd.position!.y + dy };
        cursorX += box.maxX - box.minX + COMP_GAP;
      }
    }
  }

  // 간선: for 진입은 수직, 본문 복귀는 전용 직각 경로, 나머지는 smoothstep
  const edges: FlowEdge[] = data.edges.map((e) => {
    const s = byId.get(e.source)!;
    const t = byId.get(e.target)!;
    const base = { id: e.id, source: e.source, target: e.target };
    // 컨테이너 → 첫 본문 블록(진입): 첫 노드 중심에 맞춘 상단에서 수직 진입
    if (s.type === "for" && t.parentId === s.id)
      return { ...base, pathType: "straight" as const, sourceHandle: "top-entry", targetHandle: "top" };
    // 마지막 본문 블록 → 컨테이너(복귀): 세 구간 직각 경로
    if (t.type === "for" && s.parentId === t.id)
      return { ...base, pathType: "for-return" as const, sourceHandle: "bottom", targetHandle: "bottom" };
    // 컨테이너 → 다음(루프 종료): 하단→상단 직선
    if (s.type === "for")
      return { ...base, pathType: "straight" as const, sourceHandle: "bottom", targetHandle: "top" };
    // 밖 → 컨테이너 진입: 하단→상단 직선
    if (t.type === "for") return { ...base, pathType: "straight" as const, sourceHandle: "bottom", targetHandle: "top" };
    // if 또는 while 분기 처리: 좌우로 분기하도록 설정
    if (s.type === "if" || s.type === "while") {
      return { ...base, label: e.label, sourceHandle: branchHandle(s, t, e.label), targetHandle: "top" };
    }

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
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const entryChildByForId = new Map<string, FlowNode>();
  for (const e of graph.edges) {
    const source = byId.get(e.source);
    const target = byId.get(e.target);
    if (source?.type === "for" && target?.parentId === source.id && !entryChildByForId.has(source.id)) {
      entryChildByForId.set(source.id, target);
    }
  }

  return ordered.map((n) => {
    const entryChild = n.type === "for" ? entryChildByForId.get(n.id) : undefined;
    const entryWidth = entryChild ? (entryChild.type === "for" ? entryChild.width ?? 260 : baseDim(entryChild.type).w) : 0;
    const forEntryX = entryChild?.position ? entryChild.position.x + entryWidth / 2 : undefined;
    const node: Node = {
      id: n.id,
      type: "flow",
      position: n.position ?? { x: 0, y: 0 },
      data: { label: n.label, nodeType: n.type, style: n.style, forEntryX, onLabelChange: opts?.onLabelChange } satisfies FlowNodeData,
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
    labelBgStyle: { fill: "var(--background)" },
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
      pathType: (e.type as "smoothstep" | "straight" | "bezier" | "for-return" | undefined) ?? undefined,
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
