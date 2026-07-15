import { useMemo } from "react";
import { parseDsl } from "@/lib/dsl-parser";
import { layoutFlowchart } from "@/lib/flow-layout";
import type { XYPosition } from "@xyflow/react";

/** DSL 문자열(+ 수동 좌표)을 React Flow nodes/edges 로 변환. */
export function useFlowchart(dsl: string, positions?: Record<string, XYPosition>) {
  return useMemo(() => {
    const { data, errors } = parseDsl(dsl);
    const { nodes, edges } = layoutFlowchart(data, positions);
    return { nodes, edges, errors, data };
  }, [dsl, positions]);
}
