import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  ConnectionMode,
  addEdge,
  reconnectEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  MarkerType,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import { nodeTypes } from "./FlowNode";
import type { FlowGraph, NodeType } from "@/types/flowchart";
import type { FlowNodeData } from "@/lib/flow-layout";
import { toRFNodes, toRFEdges, fromRF, autoLayout, dslToGraph, newNodeId, newEdgeId, orderParentsFirst } from "@/lib/flow-graph";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { LayoutGrid, FileCode } from "lucide-react";

const PALETTE: { type: NodeType; label: string; defaultLabel: string }[] = [
  { type: "start", label: "시작", defaultLabel: "시작" },
  { type: "input", label: "입력", defaultLabel: "입력 x" },
  { type: "output", label: "출력", defaultLabel: "출력 x" },
  { type: "process", label: "처리", defaultLabel: "처리" },
  { type: "if", label: "조건", defaultLabel: "조건 ?" },
  { type: "for", label: "for", defaultLabel: "for i in range(n)" },
  { type: "while", label: "while", defaultLabel: "조건 ?" },
  { type: "def", label: "함수", defaultLabel: "func(x)" },
  { type: "call", label: "호출", defaultLabel: "func(x)" },
  { type: "end", label: "끝", defaultLabel: "끝" },
];

const DSL_HELP = `start / end · input/output/process · if/elif/else · for/while · def
들여쓰기로 블록. 가져오면 현재 순서도를 대체합니다.`;

interface Props {
  graph: FlowGraph;
  editable?: boolean;
  /** 이 값이 바뀌면 캔버스를 graph 로 리셋(문제 전환 등) */
  resetKey?: string;
  onChange?: (g: FlowGraph) => void;
}

function CanvasInner({ graph, editable, resetKey, onChange }: Props) {
  const rf = useReactFlow();
  const wrapRef = useRef<HTMLDivElement>(null);
  const setNodesRef = useRef<ReturnType<typeof useNodesState>[1] | null>(null);

  const onLabelChange = useCallback((id: string, label: string) => {
    setNodesRef.current?.((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)));
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState(
    toRFNodes(graph, editable ? { onLabelChange } : undefined)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(toRFEdges(graph));
  setNodesRef.current = setNodes;

  // 문제 전환 시 리셋
  useEffect(() => {
    setNodes(toRFNodes(graph, editable ? { onLabelChange } : undefined));
    setEdges(toRFEdges(graph));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // 변경 디바운스 후 상위로 전파
  const firstRun = useRef(true);
  useEffect(() => {
    if (!onChange) return;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = setTimeout(() => onChange(fromRF(nodes, edges)), 300);
    return () => clearTimeout(t);
  }, [nodes, edges, onChange]);

  const onConnect = useCallback(
    (c: Connection) => {
      // for 컨테이너가 끼면 직선(꺾임 없이), 아니면 smoothstep
      const isFor = (id: string | null) =>
        (nodes.find((n) => n.id === id)?.data as FlowNodeData | undefined)?.nodeType === "for";
      const type = isFor(c.source) || isFor(c.target) ? "straight" : "smoothstep";
      setEdges((eds) => addEdge({ ...c, id: newEdgeId(), type, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
    },
    [setEdges, nodes]
  );

  // 이미 그은 선의 끝점을 떼서 다른 핸들로 재연결
  const onReconnect = useCallback(
    (oldEdge: Edge, newConn: Connection) => setEdges((eds) => reconnectEdge(oldEdge, newConn, eds)),
    [setEdges]
  );

  const addNode = (type: NodeType, defaultLabel: string) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    const pos = rect
      ? rf.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 3 })
      : { x: 200, y: 120 };
    const node: Node = {
      id: newNodeId(type),
      type: "flow",
      position: pos,
      data: { label: defaultLabel, nodeType: type, onLabelChange } satisfies FlowNodeData,
    };
    if (type === "for") node.style = { width: 260, height: 160 };
    // for 컨테이너는 다른 노드보다 먼저 와야 함
    setNodes((ns) => (type === "for" ? [node, ...ns] : [...ns, node]));
  };

  // 드래그 종료: for 컨테이너와 겹치면 자식으로, 밖으로 나가면 분리 (for 중첩 지원)
  const onNodeDragStop = useCallback(
    (_: unknown, dragged: Node) => {
      if (!editable) return;
      const cur = rf.getNodes();
      const byId = new Map(cur.map((n) => [n.id, n]));
      const absPos = (id: string): { x: number; y: number } => {
        let n = byId.get(id);
        let x = 0;
        let y = 0;
        while (n) {
          x += n.position.x;
          y += n.position.y;
          n = n.parentId ? byId.get(n.parentId) : undefined;
        }
        return { x, y };
      };
      const isDescendantOf = (nodeId: string, ancestorId: string): boolean => {
        let p = byId.get(nodeId)?.parentId;
        while (p) {
          if (p === ancestorId) return true;
          p = byId.get(p)?.parentId;
        }
        return false;
      };
      const depth = (id: string): number => {
        let d = 0;
        let p = byId.get(id)?.parentId;
        while (p) {
          d++;
          p = byId.get(p)?.parentId;
        }
        return d;
      };

      // 겹치는 for 컨테이너 중 가장 안쪽. 자기 자신·자손 제외(순환 방지).
      const overlap = rf
        .getIntersectingNodes(dragged)
        .filter(
          (n) =>
            (n.data as FlowNodeData).nodeType === "for" && n.id !== dragged.id && !isDescendantOf(n.id, dragged.id)
        );
      const target = overlap.sort((a, b) => depth(b.id) - depth(a.id))[0] ?? null;
      const abs = absPos(dragged.id);

      setNodes((ns) => {
        let next: Node[] | null = null;
        if (target && target.id !== dragged.parentId) {
          const tAbs = absPos(target.id);
          const draggedIsFor = (dragged.data as FlowNodeData).nodeType === "for";
          // 중첩되는 for 는 부모 안에 맞게 축소, 부모는 필요 시 확대
          let childPos = { x: abs.x - tAbs.x, y: abs.y - tAbs.y };
          let childStyle: { width: number; height: number } | null = null;
          let parentStyle: { width: number; height: number } | null = null;
          if (draggedIsFor) {
            const PAD = 16;
            const HEADER = 24;
            const tNode = byId.get(target.id)!;
            const pW = (tNode.style?.width as number) ?? 260;
            const pH = (tNode.style?.height as number) ?? 160;
            const dW = (dragged.style?.width as number) ?? 260;
            const dH = (dragged.style?.height as number) ?? 160;
            const innerW = Math.max(160, Math.min(dW, pW - 2 * PAD));
            const innerH = Math.max(100, Math.min(dH, pH - PAD - HEADER));
            childStyle = { width: innerW, height: innerH };
            childPos = { x: PAD, y: HEADER };
            const needW = innerW + 2 * PAD;
            const needH = innerH + PAD + HEADER;
            if (needW > pW || needH > pH) parentStyle = { width: Math.max(pW, needW), height: Math.max(pH, needH) };
          }
          next = ns.map((n) => {
            if (n.id === dragged.id)
              return { ...n, parentId: target.id, extent: undefined, position: childPos, ...(childStyle ? { style: { ...n.style, ...childStyle } } : {}) };
            if (parentStyle && n.id === target.id) return { ...n, style: { ...n.style, ...parentStyle } };
            return n;
          });
        } else if (!target && dragged.parentId) {
          next = ns.map((n) => (n.id === dragged.id ? { ...n, parentId: undefined, extent: undefined, position: abs } : n));
        }
        return next ? orderParentsFirst(next) : ns;
      });
    },
    [editable, setNodes, rf]
  );

  // for 컨테이너 삭제 시 직속 자식을 절대좌표로 분리(고아 parentId 방지, 중첩 대응)
  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      const deletedIds = new Set(deleted.map((n) => n.id));
      if (!deleted.some((n) => (n.data as FlowNodeData).nodeType === "for")) return;
      setNodes((prev) => {
        const byId = new Map(prev.map((n) => [n.id, n]));
        const absPos = (n: Node) => {
          let x = n.position.x;
          let y = n.position.y;
          let p = n.parentId;
          while (p) {
            const par = byId.get(p);
            if (!par) break;
            x += par.position.x;
            y += par.position.y;
            p = par.parentId;
          }
          return { x, y };
        };
        return prev.map((n) =>
          n.parentId && deletedIds.has(n.parentId)
            ? { ...n, parentId: undefined, extent: undefined, position: absPos(n) }
            : n
        );
      });
    },
    [setNodes]
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const onSelectionChange = useCallback(
    ({ nodes: sel }: { nodes: Node[] }) => setSelectedId(sel.length === 1 ? sel[0].id : null),
    []
  );
  const updateStyle = (patch: { bg?: string; border?: string; text?: string }) => {
    if (!selectedId) return;
    setNodes((ns) =>
      ns.map((n) =>
        n.id === selectedId ? { ...n, data: { ...n.data, style: { ...(n.data as FlowNodeData).style, ...patch } } } : n
      )
    );
  };
  const selectedStyle = (nodes.find((n) => n.id === selectedId)?.data as FlowNodeData | undefined)?.style;

  const onEdgeDoubleClick = useCallback(
    (_: unknown, edge: Edge) => {
      if (!editable) return;
      const label = window.prompt("간선 라벨 (예: 참 / 거짓)", typeof edge.label === "string" ? edge.label : "");
      if (label === null) return;
      setEdges((eds) => eds.map((e) => (e.id === edge.id ? { ...e, label } : e)));
    },
    [editable, setEdges]
  );

  const doAutoLayout = () => {
    const g = autoLayout(fromRF(nodes, edges));
    setNodes(toRFNodes(g, editable ? { onLabelChange } : undefined));
    setEdges(toRFEdges(g));
  };

  const importDsl = (text: string) => {
    const g = dslToGraph(text);
    setNodes(toRFNodes(g, editable ? { onLabelChange } : undefined));
    setEdges(toRFEdges(g));
  };

  return (
    <div className="relative h-full w-full" ref={wrapRef}>
      {editable && (
        <div className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap gap-1 rounded-lg border bg-background/95 p-1 shadow-sm">
          {PALETTE.map((p) => (
            <Button key={p.type} size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => addNode(p.type, p.defaultLabel)}>
              + {p.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={doAutoLayout} title="자동 정렬">
            <LayoutGrid className="size-3.5" /> 정렬
          </Button>
          <DslImportDialog onImport={importDsl} />
        </div>
      )}
      {editable && selectedId && (
        <div className="absolute right-2 top-2 z-10 flex items-center gap-3 rounded-lg border bg-background/95 px-3 py-2 shadow-sm">
          <ColorField label="배경" value={selectedStyle?.bg || "#ffffff"} onChange={(v) => updateStyle({ bg: v })} />
          <ColorField label="테두리" value={selectedStyle?.border || "#111827"} onChange={(v) => updateStyle({ border: v })} />
          <ColorField label="글자" value={selectedStyle?.text || "#111827"} onChange={(v) => updateStyle({ text: v })} />
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => updateStyle({ bg: undefined, border: undefined, text: undefined })}>
            기본값
          </Button>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={editable ? onConnect : undefined}
        onReconnect={editable ? onReconnect : undefined}
        edgesReconnectable={editable}
        onSelectionChange={onSelectionChange}
        onNodeDragStop={editable ? onNodeDragStop : undefined}
        onNodesDelete={editable ? onNodesDelete : undefined}
        onEdgeDoubleClick={onEdgeDoubleClick}
        nodesDraggable={editable}
        nodesConnectable={editable}
        elementsSelectable={editable}
        deleteKeyCode={editable ? ["Backspace", "Delete"] : null}
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
      {editable && (
        <div className="absolute bottom-2 left-2 z-10 rounded bg-background/90 px-2 py-1 text-[11px] text-muted-foreground shadow-sm">
          더블클릭: 노드 라벨/간선 라벨 편집 · 핸들 드래그: 연결 · Delete: 삭제
        </div>
      )}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-1 text-xs text-muted-foreground">
      {label}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-6 w-6 cursor-pointer rounded border" />
    </label>
  );
}

function DslImportDialog({ onImport }: { onImport: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" title="DSL 가져오기">
          <FileCode className="size-3.5" /> DSL
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>DSL 가져오기</DialogTitle>
        </DialogHeader>
        <p className="whitespace-pre-wrap text-xs text-muted-foreground">{DSL_HELP}</p>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} className="h-64 font-mono text-xs" placeholder={"start\ninput n\nfor i in range(1, n+1)\n    process total += i\noutput total\nend"} />
        <DialogClose asChild>
          <Button onClick={() => onImport(text)} disabled={!text.trim()}>
            현재 순서도로 가져오기
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

export default function FlowchartCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
