import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  addEdge,
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
import { toRFNodes, toRFEdges, fromRF, autoLayout, dslToGraph, newNodeId, newEdgeId } from "@/lib/flow-graph";
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
    (c: Connection) =>
      setEdges((eds) =>
        addEdge(
          { ...c, id: newEdgeId(), type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed } },
          eds
        )
      ),
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
    setNodes((ns) => [...ns, node]);
  };

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
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={editable ? onConnect : undefined}
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
