import { supabase } from "@/integrations/supabase/client";
import type { AcademicEvent } from "@/integrations/supabase/types";

export const ACADEMIC_EVENTS_KEY = ["academic-events"] as const;

export async function listAcademicEvents(): Promise<AcademicEvent[]> {
  const { data, error } = await supabase.from("academic_events").select("*").order("date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AcademicEvent[];
}

export async function createAcademicEvent(
  teacherId: string,
  fields: { date: string; title: string; description?: string }
): Promise<AcademicEvent> {
  const { data, error } = await supabase
    .from("academic_events")
    .insert({ created_by: teacherId, description: "", ...fields })
    .select()
    .single();
  if (error) throw error;
  return data as AcademicEvent;
}

export async function deleteAcademicEvent(id: string): Promise<void> {
  const { error } = await supabase.from("academic_events").delete().eq("id", id);
  if (error) throw error;
}
