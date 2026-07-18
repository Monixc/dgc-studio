import { supabase } from "@/integrations/supabase/client";
import type { ClassRow, Problem } from "@/integrations/supabase/types";

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

export async function updateClassSchedule(
  id: string,
  schedule: { schedule_day_of_week: number | null; schedule_time: string | null },
): Promise<void> {
  const { error } = await supabase.from("classes").update(schedule).eq("id", id);
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

/** 학생: 본인이 속한 반에 배정된 문제 전체(중복 제거). */
/** 학생 기준, 해당 문제가 배정된 반 이름들(본인 소속 반 한정, 중복 제거). */
export async function getAssignedClassNames(studentId: string, problemId: string): Promise<string[]> {
  const { data: cs, error: csErr } = await supabase
    .from("class_students")
    .select("class_id")
    .eq("student_id", studentId);
  if (csErr) throw csErr;
  const classIds = [...new Set((cs ?? []).map((r) => r.class_id as string))];
  if (classIds.length === 0) return [];

  const { data, error } = await supabase
    .from("class_problems")
    .select("classes(name)")
    .eq("problem_id", problemId)
    .in("class_id", classIds);
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => (r.classes as { name: string } | null)?.name).filter(Boolean) as string[])];
}

export async function listAssignedProblems(studentId: string): Promise<Problem[]> {
  const { data: cs, error: csErr } = await supabase
    .from("class_students")
    .select("class_id")
    .eq("student_id", studentId);
  if (csErr) throw csErr;
  const classIds = [...new Set((cs ?? []).map((r) => r.class_id as string))];
  if (classIds.length === 0) return [];

  const { data: cp, error: cpErr } = await supabase
    .from("class_problems")
    .select("problem_id")
    .in("class_id", classIds);
  if (cpErr) throw cpErr;
  const problemIds = [...new Set((cp ?? []).map((r) => r.problem_id as string))];
  if (problemIds.length === 0) return [];

  const { data: probs, error: pErr } = await supabase.from("problems").select("*").in("id", problemIds);
  if (pErr) throw pErr;
  return (probs ?? []) as Problem[];
}
