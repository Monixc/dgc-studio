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

/** 학생이 속한 반을 담당하는 선생님만 쪽지 수신자로 반환한다. */
export async function listStudentTeachers(studentId: string): Promise<Profile[]> {
  const { data: memberships, error: membershipsError } = await supabase
    .from("class_students")
    .select("class_id")
    .eq("student_id", studentId);
  if (membershipsError) throw membershipsError;
  const classIds = [...new Set((memberships ?? []).map((row) => row.class_id as string))];
  if (!classIds.length) return [];

  const { data: classes, error: classesError } = await supabase.from("classes").select("created_by").in("id", classIds);
  if (classesError) throw classesError;
  const teacherIds = [...new Set((classes ?? []).map((row) => row.created_by as string))];
  if (!teacherIds.length) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "teacher")
    .in("id", teacherIds)
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

/** 상대가 나에게 보낸 미읽음 쪽지를 읽음 처리(스레드 열람 시). */
export async function markMessagesRead(userId: string, counterpartId: string): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", userId)
    .eq("sender_id", counterpartId)
    .is("read_at", null);
  if (error) throw error;
}

export async function sendMessage(senderId: string, recipientId: string, body: string): Promise<MessageRow> {
  const { data, error } = await supabase
    .from("messages")
    .insert({ sender_id: senderId, recipient_id: recipientId, body })
    .select()
    .single();
  if (error) throw error;
  return data as MessageRow;
}
