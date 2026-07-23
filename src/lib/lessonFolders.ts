import { supabase } from "@/integrations/supabase/client";
import type { LessonFolder } from "@/integrations/supabase/types";

export const LESSON_FOLDERS_KEY = ["lesson-folders"] as const;

export async function listLessonFolders(userId: string): Promise<LessonFolder[]> {
  const { data, error } = await supabase
    .from("lesson_folders")
    .select("*")
    .eq("created_by", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as LessonFolder[];
}

export async function createLessonFolder(userId: string, name: string): Promise<LessonFolder> {
  const { data, error } = await supabase
    .from("lesson_folders")
    .insert({ name, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data as LessonFolder;
}

export async function renameLessonFolder(id: string, name: string): Promise<void> {
  const { error } = await supabase.from("lesson_folders").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteLessonFolder(id: string): Promise<void> {
  const { error } = await supabase.from("lesson_folders").delete().eq("id", id);
  if (error) throw error;
}
