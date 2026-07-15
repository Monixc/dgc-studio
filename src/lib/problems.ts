import { supabase } from "@/integrations/supabase/client";
import type { Problem } from "@/integrations/supabase/types";

export const PROBLEMS_KEY = ["problems"] as const;

/** 선생: 본인이 만든 문제 목록. */
export async function listMyProblems(userId: string): Promise<Problem[]> {
  const { data, error } = await supabase
    .from("problems")
    .select("*")
    .eq("created_by", userId)
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

export async function createProblem(userId: string): Promise<Problem> {
  const { data, error } = await supabase
    .from("problems")
    .insert({ title: "새 문제", created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data as Problem;
}

export type ProblemUpdate = Partial<
  Pick<Problem, "title" | "description" | "flowchart" | "starter_code" | "grading_tests" | "is_published" | "folder_id">
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
