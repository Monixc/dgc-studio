import { supabase } from "@/integrations/supabase/client";
import type { Announcement, AnnouncementAttachment } from "@/integrations/supabase/types";

export const ANNOUNCEMENTS_KEY = ["announcements"] as const;
const ANNOUNCEMENT_ASSETS_BUCKET = "announcement-assets";

export async function listAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Announcement[];
}

export async function uploadAnnouncementAsset(file: File): Promise<AnnouncementAttachment> {
  const ext = file.name.split(".").pop();
  const path = `${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;
  const { error } = await supabase.storage.from(ANNOUNCEMENT_ASSETS_BUCKET).upload(path, file);
  if (error) throw error;
  const url = supabase.storage.from(ANNOUNCEMENT_ASSETS_BUCKET).getPublicUrl(path).data.publicUrl;
  return { url, name: file.name, mimeType: file.type || "application/octet-stream", kind: file.type.startsWith("image/") ? "image" : "file" };
}

export async function createAnnouncement(
  teacherId: string,
  fields: { title: string; body: string; attachments?: AnnouncementAttachment[] },
): Promise<Announcement> {
  const { data, error } = await supabase
    .from("announcements")
    .insert({ created_by: teacherId, attachments: [], ...fields })
    .select()
    .single();
  if (error) throw error;
  return data as Announcement;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw error;
}
