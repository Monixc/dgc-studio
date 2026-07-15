import { supabase } from "@/integrations/supabase/client";
import type { ClassRow } from "@/integrations/supabase/types";

export const CLASSES_KEY = ["classes"] as const;

export async function listClasses(userId: string): Promise<ClassRow[]> {
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .eq("created_by", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ClassRow[];
}

export async function createClass(userId: string, name: string): Promise<ClassRow> {
  const { data, error } = await supabase
    .from("classes")
    .insert({ name, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data as ClassRow;
}

export async function renameClass(id: string, name: string): Promise<void> {
  const { error } = await supabase.from("classes").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteClass(id: string): Promise<void> {
  const { error } = await supabase.from("classes").delete().eq("id", id);
  if (error) throw error;
}

export async function listClassProblemIds(classId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("class_problems")
    .select("problem_id")
    .eq("class_id", classId);
  if (error) throw error;
  return (data ?? []).map((r) => r.problem_id as string);
}

/** 반의 배정 문제 목록을 problemIds 로 교체(diff 계산 후 insert/delete). */
export async function setClassProblems(classId: string, problemIds: string[]): Promise<void> {
  const current = await listClassProblemIds(classId);
  const currentSet = new Set(current);
  const nextSet = new Set(problemIds);

  const toAdd = problemIds.filter((id) => !currentSet.has(id));
  const toRemove = current.filter((id) => !nextSet.has(id));

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("class_problems")
      .insert(toAdd.map((problem_id) => ({ class_id: classId, problem_id })));
    if (error) throw error;
  }
  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("class_problems")
      .delete()
      .eq("class_id", classId)
      .in("problem_id", toRemove);
    if (error) throw error;
  }
}
