import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/integrations/supabase/types";

export const CLASS_STUDENTS_KEY = ["class-students"] as const;

export async function listAllStudents(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "student")
    .order("display_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function listClassStudentIds(classId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("class_students")
    .select("student_id")
    .eq("class_id", classId);
  if (error) throw error;
  return (data ?? []).map((r) => r.student_id as string);
}

/** 반의 등록 학생을 studentIds 로 교체(diff 계산 후 insert/delete). */
export async function setClassStudents(classId: string, studentIds: string[]): Promise<void> {
  const current = await listClassStudentIds(classId);
  const currentSet = new Set(current);
  const nextSet = new Set(studentIds);

  const toAdd = studentIds.filter((id) => !currentSet.has(id));
  const toRemove = current.filter((id) => !nextSet.has(id));

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("class_students")
      .insert(toAdd.map((student_id) => ({ class_id: classId, student_id })));
    if (error) throw error;
  }
  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("class_students")
      .delete()
      .eq("class_id", classId)
      .in("student_id", toRemove);
    if (error) throw error;
  }
}
