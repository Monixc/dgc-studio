import { supabase } from "@/integrations/supabase/client";
import type { MessageRow, Profile } from "@/integrations/supabase/types";

export const MESSAGES_KEY = ["messages"] as const;

export async function listAllTeachers(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "teacher")
    .order("display_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Profile[];
}

/** 내가 보낸/받은 쪽지 전체(최신순), 상대방 이름 포함. */
export async function listMyMessages(userId: string): Promise<(MessageRow & { counterpart_name: string })[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as MessageRow[];
  const ids = [...new Set(rows.map((r) => (r.sender_id === userId ? r.recipient_id : r.sender_id)))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
    (profs ?? []).forEach((p: any) => names.set(p.id, p.display_name));
  }
  return rows.map((r) => ({
    ...r,
    counterpart_name: names.get(r.sender_id === userId ? r.recipient_id : r.sender_id) ?? "알 수 없음",
  }));
}

export async function sendMessage(senderId: string, recipientId: string, body: string): Promise<void> {
  const { error } = await supabase.from("messages").insert({ sender_id: senderId, recipient_id: recipientId, body });
  if (error) throw error;
}
