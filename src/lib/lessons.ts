import { supabase } from "@/integrations/supabase/client";
import type { Lesson } from "@/integrations/supabase/types";

export const LESSONS_KEY = ["lessons"] as const;

export type NewLesson = Pick<
  Lesson,
  "title" | "content_type" | "content" | "code_practice" | "starter_code" | "folder_id"
>;

export async function listLessons(userId: string): Promise<Lesson[]> {
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("created_by", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Lesson[];
}

export async function getLesson(id: string): Promise<Lesson> {
  const { data, error } = await supabase.from("lessons").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Lesson;
}

export async function createLesson(userId: string, input: Partial<NewLesson>): Promise<Lesson> {
  const { data, error } = await supabase
    .from("lessons")
    .insert({
      title: input.title ?? "새 교안",
      content_type: input.content_type ?? "md",
      content: input.content ?? "",
      code_practice: input.code_practice ?? false,
      starter_code: input.starter_code ?? "",
      folder_id: input.folder_id ?? null,
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Lesson;
}

export async function updateLesson(id: string, patch: Partial<NewLesson>): Promise<void> {
  const { error } = await supabase
    .from("lessons")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteLesson(id: string): Promise<void> {
  const { error } = await supabase.from("lessons").delete().eq("id", id);
  if (error) throw error;
}

export async function listClassLessonIds(classId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("class_lessons")
    .select("lesson_id")
    .eq("class_id", classId);
  if (error) throw error;
  return (data ?? []).map((r) => r.lesson_id as string);
}

/** 반의 배정 교안 목록을 lessonIds 로 교체(diff 후 insert/delete). setClassProblems 패턴. */
export async function setClassLessons(classId: string, lessonIds: string[]): Promise<void> {
  const current = await listClassLessonIds(classId);
  const currentSet = new Set(current);
  const nextSet = new Set(lessonIds);
  const toAdd = lessonIds.filter((id) => !currentSet.has(id));
  const toRemove = current.filter((id) => !nextSet.has(id));

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("class_lessons")
      .insert(toAdd.map((lesson_id) => ({ class_id: classId, lesson_id })));
    if (error) throw error;
  }
  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("class_lessons")
      .delete()
      .eq("class_id", classId)
      .in("lesson_id", toRemove);
    if (error) throw error;
  }
}

/** 학생: 본인이 속한 반에 배정된 교안 전체(중복 제거). listAssignedProblems 패턴. */
export async function listAssignedLessons(studentId: string): Promise<Lesson[]> {
  const { data: cs, error: csErr } = await supabase
    .from("class_students")
    .select("class_id")
    .eq("student_id", studentId);
  if (csErr) throw csErr;
  const classIds = [...new Set((cs ?? []).map((r) => r.class_id as string))];
  if (classIds.length === 0) return [];

  const { data: cl, error: clErr } = await supabase
    .from("class_lessons")
    .select("lesson_id")
    .in("class_id", classIds);
  if (clErr) throw clErr;
  const lessonIds = [...new Set((cl ?? []).map((r) => r.lesson_id as string))];
  if (lessonIds.length === 0) return [];

  const { data: lessons, error: lErr } = await supabase.from("lessons").select("*").in("id", lessonIds);
  if (lErr) throw lErr;
  return (lessons ?? []) as Lesson[];
}
