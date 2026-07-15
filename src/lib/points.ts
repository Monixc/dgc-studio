import { supabase } from "@/integrations/supabase/client";

export const POINTS_KEY = ["points"] as const;

export async function awardPoints(teacherId: string, studentId: string, amount: number, reason: string): Promise<void> {
  const { error } = await supabase
    .from("points_ledger")
    .insert({ student_id: studentId, amount, reason, awarded_by: teacherId });
  if (error) throw error;
}

/** 학생별 누적 포인트. 랭킹 정렬은 호출측에서. */
export async function listPointsRanking(): Promise<{ studentId: string; total: number }[]> {
  const { data, error } = await supabase.from("points_ledger").select("student_id, amount");
  if (error) throw error;
  const totals = new Map<string, number>();
  (data ?? []).forEach((r: any) => totals.set(r.student_id, (totals.get(r.student_id) ?? 0) + r.amount));
  return [...totals].map(([studentId, total]) => ({ studentId, total }));
}
