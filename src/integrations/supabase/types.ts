// DB 행 타입 (손수 관리 — 스키마 변경 시 함께 갱신).

export type Role = "student" | "teacher";

export interface Profile {
  id: string;
  display_name: string;
  role: Role;
  created_at: string;
}

export interface FlowchartPayload {
  dsl: string;
  positions?: Record<string, { x: number; y: number }>;
}

export interface GradingTest {
  id: string;
  title: string;
  input: string;
  expectedOutput: string;
  points: number;
}

export interface Problem {
  id: string;
  title: string;
  description: string;
  flowchart: FlowchartPayload;
  starter_code: string;
  grading_tests: GradingTest[];
  is_published: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
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
