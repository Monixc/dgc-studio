import { BaseEdge, type EdgeProps } from "@xyflow/react";

/**
 * 반복문 본문의 마지막 노드에서 컨테이너 하단으로 돌아오는 간선.
 * 출발·도착 지점 사이 높이의 중앙까지 수직으로 이동한 뒤, 컨테이너의
 * 하단 연결점으로 수평/수직 이동해 분기선과 같은 직각 흐름을 만든다.
 * 여러 리턴선이 같은 지점(컨테이너 하단)으로 모일 때 겹치지 않도록,
 * 출발지가 멀수록 더 일찍(위쪽에서) 꺾어 서로 다른 높이에서 진행하게 한다.
 */
export function ForReturnEdge({ id, sourceX, sourceY, targetX, targetY, markerEnd, style }: EdgeProps) {
  const span = targetY - sourceY;
  const dx = Math.abs(targetX - sourceX);
  const bias = Math.min(0.35, dx / 300);
  const middleY = sourceY + span * (0.5 - bias);
  const path = `M ${sourceX},${sourceY} L ${sourceX},${middleY} L ${targetX},${middleY} L ${targetX},${targetY}`;

  return <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />;
}
