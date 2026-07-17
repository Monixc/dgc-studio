import type { NodeType, NodeStyle } from "@/types/flowchart";

/** React Flow 커스텀 노드(type: "flow")에 실리는 data. */
export interface FlowNodeData {
  label: string;
  nodeType: NodeType;
  style?: NodeStyle;
  /** 첫 반복 본문 노드 중심에 맞춘 for 컨테이너 상단 연결점의 x 좌표. */
  forEntryX?: number;
  /** 편집 모드에서 라벨 인라인 수정 콜백 */
  onLabelChange?: (id: string, label: string) => void;
  [key: string]: unknown;
}
