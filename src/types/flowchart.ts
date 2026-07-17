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

export interface NodeStyle {
  bg?: string;
  border?: string;
  text?: string;
}

export interface FlowNode {
  id: string;
  type: NodeType;
  label: string;
  /** 캔버스 좌표(캔버스 원본 저장 시 필수). DSL 파싱 직후엔 없을 수 있음(dagre 로 채움). */
  position?: { x: number; y: number };
  /** 배경/테두리/글자 색 (미지정 시 흰 배경·검정 테두리·검정 글자) */
  style?: NodeStyle;
  /** for 컨테이너 등 그룹 노드의 크기(px). 없으면 타입 기본 크기. */
  width?: number;
  height?: number;
  /** 이 노드를 감싸는 부모(for 컨테이너) id. position 은 부모 기준 상대좌표. */
  parentId?: string;
  /** def 본문/루프 본문 등 소속 표시용(옵션). 레이아웃/그룹핑 힌트. */
  scope?: string;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  /** 'true' | 'false' | 'loop' | 'done' 등 분기 라벨 */
  label?: string;
  sourceHandle?: string;
  targetHandle?: string;
  /** 간선 경로 종류. 반복문 본문 복귀는 전용 직각 경로(for-return)를 사용한다. */
  pathType?: "smoothstep" | "straight" | "bezier" | "for-return";
}

export interface FlowchartData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/** 캔버스 원본 저장 그래프(모든 노드에 position 존재). */
export type FlowGraph = FlowchartData;

/** 파싱 실패 시 반환 정보 */
export interface ParseError {
  line: number;
  message: string;
}

export interface ParseResult {
  data: FlowchartData;
  errors: ParseError[];
}
