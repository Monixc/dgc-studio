// 순서도 데이터 모델. DSL 파서가 생성하고, dagre 레이아웃이 좌표를 채운다.

export type NodeType =
  | "start"
  | "end"
  | "input"
  | "output"
  | "process"
  | "if" // 조건 마름모 (if / elif 각각 하나)
  | "for" // for 반복 헤더
  | "while" // while 조건 마름모
  | "def" // 함수 정의 시작
  | "call"; // 함수 호출

export interface FlowNode {
  id: string;
  type: NodeType;
  label: string;
  /** def 본문/루프 본문 등 소속 표시용(옵션). 레이아웃/그룹핑 힌트. */
  scope?: string;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  /** 'true' | 'false' | 'loop' | 'done' 등 분기 라벨 */
  label?: string;
}

export interface FlowchartData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/** 파싱 실패 시 반환 정보 */
export interface ParseError {
  line: number;
  message: string;
}

export interface ParseResult {
  data: FlowchartData;
  errors: ParseError[];
}
