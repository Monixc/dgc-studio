// DB 행 타입 (손수 관리 — 스키마 변경 시 함께 갱신).

export type Role = "student" | "teacher";

export interface Profile {
  id: string;
  display_name: string;
  role: Role;
  created_at: string;
}

export interface StudentManagementNote {
  student_id: string;
  birth_date: string | null;
  notes: string;
  updated_by: string | null;
  updated_at: string;
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
  teacher_code: string;
  grading_tests: GradingTest[];
  is_published: boolean;
  created_by: string;
  folder_id: string | null;
  category: ProblemCategory;
  points: number;
  created_at: string;
  updated_at: string;
}

export interface ProblemFolder {
  id: string;
  name: string;
  created_by: string;
  parent_id: string | null;
  /** 대분류(자동생성 3개 폴더)만 값이 있음. 하위 폴더는 null(부모에서 상속). */
  category: ProblemCategory | null;
  color: string | null;
  created_at: string;
}

export interface ClassRow {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  /** 0=일요일 ~ 6=토요일. 매주 반복되는 수업 시간(30분 전 알림용), 미설정 시 null. */
  schedule_day_of_week: number | null;
  schedule_time: string | null;
}

export interface ClassProblem {
  class_id: string;
  problem_id: string;
  created_at: string;
}

export interface ClassStudent {
  class_id: string;
  student_id: string;
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

export interface SubmissionComment {
  id: string;
  submission_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface PointsLedgerEntry {
  id: string;
  student_id: string;
  amount: number;
  reason: string;
  problem_id: string | null;
  awarded_by: string | null;
  created_at: string;
}

export type TypingPracticeMode =
  | "practice"
  | "practice_english"
  | "practice_code"
  | "race_live"
  | "race_ghost"
  | "ai_learning"
  | "ai_competition";

export interface TypingPracticeLog {
  id: string;
  student_id: string;
  mode: TypingPracticeMode;
  taja: number;
  points: number;
  match_id: string | null;
  completed_at: string;
}

export interface MessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface AcademicEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  created_by: string;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  created_by: string;
  created_at: string;
}

export interface ShopItem {
  id: string;
  name: string;
  image_url: string;
  cost: number;
  stock: number;
  created_by: string;
  created_at: string;
}

export type ShopOrderStatus = "pending" | "approved" | "rejected";

export interface ShopOrder {
  id: string;
  item_id: string;
  student_id: string;
  status: ShopOrderStatus;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface Submission {
  id: string;
  problem_id: string;
  user_id: string;
  code: string;
  block_image: string | null;
  result: string;
  score: number;
  max_score: number;
  passed_tests: number;
  total_tests: number;
  grading_details: GradingDetail[];
  submitted_at: string;
}

export type TypingAiLabGrade = "SSS" | "SS" | "S" | "A" | "B" | "C" | "D";

export interface TypingAiLabResult {
  id: string;
  user_id: string;
  mode: "sprint" | "standard" | "research" | "learning" | "competition";
  elapsed_ms: number;
  accuracy: number;
  dataset_score: number;
  density_score: number;
  coverage_score: number;
  inference_score: number;
  total_score: number;
  grade: TypingAiLabGrade;
  dataset_size: number;
  dataset: string[];
  sentences: string[];
  created_at: string;
}

export interface TypingAiLabWordStat {
  user_id: string;
  word_id: string;
  correct_count: number;
  mastered_at: string | null;
  updated_at: string;
}

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface PortfolioDocument {
  id: string;
  student_id: string;
  title: string;
  content_json: JsonValue;
  content_text: string;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface PortfolioAsset {
  id: string;
  document_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface PortfolioSubmission {
  id: string;
  document_id: string;
  student_id: string;
  class_id: string;
  teacher_id: string;
  version: number;
  source_revision: number;
  title: string;
  content_json: JsonValue;
  content_text: string;
  submitted_at: string;
}

export interface PortfolioSubmissionAsset {
  submission_id: string;
  asset_id: string;
}

export type PortfolioCommentAnchorType = "document" | "range" | "asset";

export interface PortfolioComment {
  id: string;
  submission_id: string;
  author_id: string;
  body: string;
  anchor_type: PortfolioCommentAnchorType;
  start_position: number | null;
  end_position: number | null;
  start_line: number | null;
  end_line: number | null;
  quoted_text: string | null;
  asset_id: string | null;
  asset_index: number | null;
  created_at: string;
  updated_at: string;
}
