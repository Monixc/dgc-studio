import { supabase } from "@/integrations/supabase/client";
import type { Problem, ProblemCategory } from "@/integrations/supabase/types";

export const PROBLEMS_KEY = ["problems"] as const;

/** 선생: 전체 교사 공유 문제 목록(누가 만들었든 조회·수정·삭제 가능). userId는 캐시 키/게이팅용. */
export async function listMyProblems(_userId: string): Promise<Problem[]> {
  const { data, error } = await supabase
    .from("problems")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Problem[];
}

/** 학생: 발행된 문제 목록. */
export async function listPublishedProblems(): Promise<Problem[]> {
  const { data, error } = await supabase
    .from("problems")
    .select("*")
    .eq("is_published", true)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Problem[];
}

export async function getProblem(id: string): Promise<Problem | null> {
  const { data, error } = await supabase.from("problems").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Problem) ?? null;
}

export async function createProblem(
  userId: string,
  opts?: { category?: ProblemCategory; folderId?: string | null }
): Promise<Problem> {
  const { data, error } = await supabase
    .from("problems")
    .insert({
      title: "새 문제",
      created_by: userId,
      points: 20,
      ...(opts?.category ? { category: opts.category } : {}),
      ...(opts?.folderId !== undefined ? { folder_id: opts.folderId } : {}),
    })
    .select()
    .single();
  if (error) throw error;
  return data as Problem;
}

export type ProblemUpdate = Partial<
  Pick<Problem, "title" | "description" | "flowchart" | "starter_code" | "teacher_code" | "grading_tests" | "is_published" | "folder_id" | "category" | "points">
>;

export async function updateProblem(id: string, patch: ProblemUpdate): Promise<Problem> {
  const { data, error } = await supabase
    .from("problems")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Problem;
}

export async function deleteProblem(id: string): Promise<void> {
  const { error } = await supabase.from("problems").delete().eq("id", id);
  if (error) throw error;
}
