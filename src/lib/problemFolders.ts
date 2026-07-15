import { supabase } from "@/integrations/supabase/client";
import type { ProblemFolder } from "@/integrations/supabase/types";

export const PROBLEM_FOLDERS_KEY = ["problem-folders"] as const;

export async function listFolders(userId: string): Promise<ProblemFolder[]> {
  const { data, error } = await supabase
    .from("problem_folders")
    .select("*")
    .eq("created_by", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProblemFolder[];
}

export async function createFolder(userId: string, name: string): Promise<ProblemFolder> {
  const { data, error } = await supabase
    .from("problem_folders")
    .insert({ name, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data as ProblemFolder;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const { error } = await supabase.from("problem_folders").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteFolder(id: string): Promise<void> {
  const { error } = await supabase.from("problem_folders").delete().eq("id", id);
  if (error) throw error;
}
