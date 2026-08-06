import { supabase } from "@/integrations/supabase/client";

export const BLOCK_TUTORIAL_PROGRESS_KEY = ["block-tutorial-progress"] as const;

export async function listCompletedMissionIds(studentId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("block_tutorial_progress")
    .select("mission_id")
    .eq("student_id", studentId);
  if (error) throw error;
  return (data ?? []).map((r) => r.mission_id as string);
}

export async function markMissionComplete(studentId: string, missionId: string): Promise<void> {
  const { error } = await supabase
    .from("block_tutorial_progress")
    .upsert({ student_id: studentId, mission_id: missionId }, { onConflict: "student_id,mission_id" });
  if (error) throw error;
}
