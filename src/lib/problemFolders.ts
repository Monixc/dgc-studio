import { supabase } from "@/integrations/supabase/client";
import type { ProblemFolder, ProblemCategory } from "@/integrations/supabase/types";

export const PROBLEM_FOLDERS_KEY = ["problem-folders"] as const;

export const DEFAULT_CATEGORY_FOLDERS: { category: ProblemCategory; name: string }[] = [
  { category: "flowchart", name: "순서도" },
  { category: "general", name: "파이썬" },
  { category: "block", name: "블럭코딩" },
];

export async function listFolders(userId: string): Promise<ProblemFolder[]> {
  const { data, error } = await supabase
    .from("problem_folders")
    .select("*")
    .eq("created_by", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProblemFolder[];
}

/** 대분류(순서도/파이썬/블럭코딩) 폴더가 없으면 생성해서 채워준다. */
export async function ensureDefaultFolders(userId: string, existing: ProblemFolder[]): Promise<ProblemFolder[]> {
  const missing = DEFAULT_CATEGORY_FOLDERS.filter(
    (d) => !existing.some((f) => f.category === d.category && f.parent_id === null)
  );
  if (missing.length === 0) return existing;
  const { data, error } = await supabase
    .from("problem_folders")
    .insert(missing.map((d) => ({ created_by: userId, name: d.name, category: d.category, parent_id: null })))
    .select();
  if (error) throw error;
  return [...existing, ...((data ?? []) as ProblemFolder[])];
}

export async function createFolder(userId: string, name: string, parentId: string | null = null): Promise<ProblemFolder> {
  const { data, error } = await supabase
    .from("problem_folders")
    .insert({ name, created_by: userId, parent_id: parentId })
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

/** folderId 부터 부모로 거슬러 올라가 가장 가까운 대분류의 category 를 찾는다. */
export function resolveFolderCategory(folderId: string | null, folders: ProblemFolder[]): ProblemCategory {
  let current = folders.find((f) => f.id === folderId);
  while (current) {
    if (current.category) return current.category;
    current = folders.find((f) => f.id === current!.parent_id);
  }
  return "flowchart";
}
