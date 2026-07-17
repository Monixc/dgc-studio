import { supabase } from "@/integrations/supabase/client";

export const POINTS_KEY = ["points"] as const;

export async function awardPoints(teacherId: string, studentId: string, amount: number, reason: string): Promise<void> {
  const { error } = await supabase
    .from("points_ledger")
    .insert({ student_id: studentId, amount, reason, awarded_by: teacherId });
  if (error) throw error;
}

/**
 * 문제 최초 정답 시 포인트 1회 지급.
 * 이미 해당 problem_id 로 지급 이력이 있으면 무시한다.
 */
export async function awardProblemPoints(studentId: string, problemId: string, amount: number): Promise<boolean> {
  // 이미 이 문제로 포인트를 받았는지 확인
  const { data: existing } = await supabase
    .from("points_ledger")
    .select("id")
    .eq("student_id", studentId)
    .eq("problem_id", problemId)
    .limit(1);
  if (existing && existing.length > 0) return false; // 이미 지급됨

  const { error } = await supabase
    .from("points_ledger")
    .insert({ student_id: studentId, amount, reason: "문제 풀이", problem_id: problemId });
  if (error) throw error;
  return true; // 새로 지급됨
}

/** 학생이 포인트를 획득한 문제 ID 목록. */
export async function listEarnedProblemIds(studentId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("points_ledger")
    .select("problem_id")
    .eq("student_id", studentId)
    .not("problem_id", "is", null);
  if (error) throw error;
  return new Set((data ?? []).map((r: any) => r.problem_id as string));
}

/** 학생별 누적 포인트. 랭킹 정렬은 호출측에서. */
export async function listPointsRanking(): Promise<{ studentId: string; total: number }[]> {
  const { data, error } = await supabase.from("points_ledger").select("student_id, amount");
  if (error) throw error;
  const totals = new Map<string, number>();
  (data ?? []).forEach((r: any) => totals.set(r.student_id, (totals.get(r.student_id) ?? 0) + r.amount));
  return [...totals].map(([studentId, total]) => ({ studentId, total }));
}

