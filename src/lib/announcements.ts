import { supabase } from "@/integrations/supabase/client";
import type { Announcement } from "@/integrations/supabase/types";

export const ANNOUNCEMENTS_KEY = ["announcements"] as const;

export async function listAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Announcement[];
}

export async function createAnnouncement(teacherId: string, fields: { title: string; body: string }): Promise<Announcement> {
  const { data, error } = await supabase
    .from("announcements")
    .insert({ created_by: teacherId, ...fields })
    .select()
    .single();
  if (error) throw error;
  return data as Announcement;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw error;
}
