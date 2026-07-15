// DB 행 타입 (손수 관리 — 스키마 변경 시 함께 갱신).

export type Role = "student" | "teacher";

export interface Profile {
  id: string;
  display_name: string;
  role: Role;
  created_at: string;
}

import type { FlowNode, FlowEdge } from "@/types/flowchart";

// 캔버스 원본: nodes/edges 저장. 구버전 {dsl, positions} 도 로더에서 수용.
export interface FlowchartPayload {
  nodes?: FlowNode[];
  edges?: FlowEdge[];
  /** 구버전/DSL 임포트용 (선택) */
  dsl?: string;
  positions?: Record<string, { x: number; y: number }>;
}

export interface GradingTest {
  id: string;
  title: string;
  input: string;
  expectedOutput: string;
  points: number;
}

export type ProblemCategory = "flowchart" | "general" | "block";

export const PROBLEM_CATEGORY_LABEL: Record<ProblemCategory, string> = {
  flowchart: "순서도",
  general: "파이썬 일반",
  block: "블럭코딩",
};

export interface Problem {
  id: string;
  title: string;
  description: string;
  flowchart: FlowchartPayload;
  starter_code: string;
  grading_tests: GradingTest[];
  is_published: boolean;
  created_by: string;
  folder_id: string | null;
  category: ProblemCategory;
  created_at: string;
  updated_at: string;
}

export interface ProblemFolder {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface ClassRow {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface ClassProblem {
  class_id: string;
  problem_id: string;
  created_at: string;
}

export interface GradingDetail {
  caseId: string;
  title: string;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  points: number;
}

export interface Submission {
  id: string;
  problem_id: string;
  user_id: string;
  code: string;
  result: string;
  score: number;
  max_score: number;
  passed_tests: number;
  total_tests: number;
  grading_details: GradingDetail[];
  submitted_at: string;
}
