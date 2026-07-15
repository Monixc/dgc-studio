import { useEffect, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type XYPosition,
} from "@xyflow/react";
import { nodeTypes } from "./FlowNode";
import { useFlowchart } from "@/hooks/useFlowchart";

interface Props {
  dsl: string;
  positions?: Record<string, XYPosition>;
  readOnly?: boolean;
  /** 선생이 노드를 드래그해 배치를 바꾸면 호출 */
  onPositionsChange?: (positions: Record<string, XYPosition>) => void;
}

export default function FlowchartPanel({ dsl, positions, readOnly, onPositionsChange }: Props) {
  const { nodes: laid, edges: laidEdges, errors } = useFlowchart(dsl, positions);
  const [nodes, setNodes, onNodesChange] = useNodesState(laid);
  const [edges, setEdges] = useEdgesState(laidEdges);

  // DSL/좌표가 바뀌면 재배치
  useEffect(() => setNodes(laid), [laid, setNodes]);
  useEffect(() => setEdges(laidEdges), [laidEdges, setEdges]);

  const handleDragStop = useCallback(() => {
    if (!onPositionsChange) return;
    setNodes((cur) => {
      const map: Record<string, XYPosition> = {};
      cur.forEach((n: Node) => (map[n.id] = n.position));
      onPositionsChange(map);
      return cur;
    });
  }, [onPositionsChange, setNodes]);

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={readOnly ? undefined : handleDragStop}
        nodesDraggable={!readOnly}
        nodesConnectable={false}
        elementsSelectable={!readOnly}
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
      {errors.length > 0 && (
        <div className="absolute bottom-2 left-2 right-2 max-h-24 overflow-auto rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
          {errors.map((e, i) => (
            <div key={i}>
              {e.line}행: {e.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
