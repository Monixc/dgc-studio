import { useMemo, useState } from "react";
import { WORD_BY_ID } from "./content";
import type { GraphEdge } from "./game";

const CAT_COLOR: Record<string, string> = {
  human: "#34d399",
  education: "#60a5fa",
  technology: "#a78bfa",
  nature: "#4ade80",
  place: "#fbbf24",
  object: "#94a3b8",
  animal: "#fb7185",
  action: "#f472b6",
};

const WIDTH = 900;
const HEIGHT = 480;
const PADDING = 28;

interface GraphNode {
  id: string;
  x: number;
  y: number;
  degree: number;
  color: string;
}

/** 외부 의존성 없이 결정적으로 계산하는 작은 force-directed layout. */
function layoutNodes(ids: string[], edges: GraphEdge[]): GraphNode[] {
  const index = new Map(ids.map((id, i) => [id, i]));
  const degree = new Map(ids.map((id) => [id, 0]));
  const validEdges = edges.filter((e) => index.has(e.fromId) && index.has(e.toId));
  for (const edge of validEdges) {
    degree.set(edge.fromId, (degree.get(edge.fromId) ?? 0) + 1);
    degree.set(edge.toId, (degree.get(edge.toId) ?? 0) + 1);
  }

  // golden-angle spiral로 겹치지 않는 초기 좌표를 만든다.
  const nodes = ids.map((id, i) => {
    const angle = i * 2.399963;
    const radius = 18 * Math.sqrt(i + 1);
    const word = WORD_BY_ID[id]!;
    return {
      id,
      x: WIDTH / 2 + Math.cos(angle) * radius,
      y: HEIGHT / 2 + Math.sin(angle) * radius,
      degree: degree.get(id) ?? 0,
      color: CAT_COLOR[word?.categories[0] ?? "object"] ?? "#71717a",
    };
  });

  const edgePairs = validEdges.map((edge) => [
    index.get(edge.fromId)!,
    index.get(edge.toId)!,
  ] as const);

  // repulsion + spring + center gravity. 결과만 계산하므로 애니메이션 흔들림이 없다.
  for (let iteration = 0; iteration < 90; iteration++) {
    const fx = new Array(nodes.length).fill(0);
    const fy = new Array(nodes.length).fill(0);

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j]!.x - nodes[i]!.x;
        const dy = nodes[j]!.y - nodes[i]!.y;
        const distanceSq = Math.max(64, dx * dx + dy * dy);
        const distance = Math.sqrt(distanceSq);
        const force = 920 / distanceSq;
        const ux = dx / distance;
        const uy = dy / distance;
        fx[i] -= ux * force;
        fy[i] -= uy * force;
        fx[j] += ux * force;
        fy[j] += uy * force;
      }
    }

    for (const [a, b] of edgePairs) {
      const dx = nodes[b]!.x - nodes[a]!.x;
      const dy = nodes[b]!.y - nodes[a]!.y;
      const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const force = (distance - 62) * 0.012;
      const ux = dx / distance;
      const uy = dy / distance;
      fx[a] += ux * force;
      fy[a] += uy * force;
      fx[b] -= ux * force;
      fy[b] -= uy * force;
    }

    const cooling = 1 - iteration / 110;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]!;
      fx[i] += (WIDTH / 2 - node.x) * 0.002;
      fy[i] += (HEIGHT / 2 - node.y) * 0.002;
      node.x = Math.min(WIDTH - PADDING, Math.max(PADDING, node.x + fx[i] * cooling));
      node.y = Math.min(HEIGHT - PADDING, Math.max(PADDING, node.y + fy[i] * cooling));
    }
  }

  return nodes;
}

export default function KnowledgeGraph({
  ids,
  edges,
}: {
  ids: string[];
  edges: GraphEdge[];
}) {
  const [active, setActive] = useState<string | null>(null);
  const nodes = useMemo(() => layoutNodes(ids, edges), [ids, edges]);
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const neighborIds = useMemo(() => {
    if (!active) return null;
    const set = new Set<string>([active]);
    for (const e of edges) {
      if (e.fromId === active) set.add(e.toId);
      if (e.toId === active) set.add(e.fromId);
    }
    return set;
  }, [active, edges]);

  if (ids.length === 0) {
    return <p className="text-sm text-zinc-500">노드 없음</p>;
  }

  return (
    <div className="relative h-80 w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="size-full"
        role="img"
        aria-label="단어 지식 그래프"
        onClick={() => setActive(null)}
      >
        <defs>
          <radialGradient id="graph-bg">
            <stop offset="0%" stopColor="#18181b" />
            <stop offset="100%" stopColor="#09090b" />
          </radialGradient>
          <filter id="node-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill="url(#graph-bg)" />

        <g>
          {edges.map((edge, index) => {
            const from = byId.get(edge.fromId);
            const to = byId.get(edge.toId);
            if (!from || !to) return null;
            const highlighted = active === edge.fromId || active === edge.toId;
            const dimmed = neighborIds && !highlighted;
            return (
              <line
                key={`${edge.fromId}-${edge.toId}-${index}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={highlighted ? "#a7f3d0" : "#52525b"}
                strokeWidth={highlighted ? 1.8 : 0.65}
                strokeOpacity={dimmed ? 0.08 : highlighted ? 0.9 : 0.26}
              />
            );
          })}
        </g>

        <g>
          {nodes.map((node) => {
            const word = WORD_BY_ID[node.id]!;
            const selected = active === node.id;
            const dimmed = neighborIds && !neighborIds.has(node.id);
            const radius = Math.min(8, 3.2 + Math.sqrt(node.degree) * 0.9);
            return (
              <g
                key={node.id}
                role="button"
                tabIndex={0}
                aria-label={`${word.word}, ${word.meaningKo}`}
                transform={`translate(${node.x} ${node.y})`}
                onClick={(event) => {
                  event.stopPropagation();
                  setActive((current) => current === node.id ? null : node.id);
                }}
                onMouseEnter={() => setActive(node.id)}
                onMouseLeave={() => setActive(null)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActive((current) => current === node.id ? null : node.id);
                  }
                }}
                className="cursor-pointer outline-none"
                opacity={dimmed ? 0.18 : 1}
              >
                <circle
                  r={selected ? radius + 2.5 : radius}
                  fill={node.color}
                  stroke={selected ? "#ffffff" : "transparent"}
                  strokeWidth={1.2}
                  filter={selected ? "url(#node-glow)" : undefined}
                />
                {selected && (
                  <>
                    <rect
                      x={10}
                      y={-18}
                      width={Math.max(74, word.word.length * 8 + 22)}
                      height={36}
                      rx={6}
                      fill="#18181b"
                      stroke="#3f3f46"
                    />
                    <text x={18} y={-3} fill="#fafafa" fontSize={12} fontWeight={600}>
                      {word.word}
                    </text>
                    <text x={18} y={11} fill="#a1a1aa" fontSize={9}>
                      {word.meaningKo}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <p className="pointer-events-none absolute bottom-2 left-3 text-[10px] text-zinc-600">
        점을 선택하면 단어와 연결을 확인할 수 있습니다
      </p>
    </div>
  );
}
