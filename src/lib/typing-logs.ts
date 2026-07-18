import { supabase } from "@/integrations/supabase/client";
import type {
  TypingPracticeLog,
  TypingPracticeMode,
} from "@/integrations/supabase/types";

export const TYPING_MODE_LABEL: Record<TypingPracticeMode, string> = {
  practice: "일반 연습",
  practice_english: "일반 영타",
  practice_code: "코드 타자 연습",
  race_live: "라이브 레이싱",
  race_ghost: "고스트 레이싱",
  ai_learning: "AI 연구소 개인 학습",
  ai_competition: "AI 연구소 실시간 경쟁",
};

export interface TypingPracticeLogView extends TypingPracticeLog {
  student_name: string;
}

export async function saveTypingPracticeLog(
  mode: TypingPracticeMode,
  taja: number,
  won = false,
  matchId?: string,
): Promise<number> {
  const { data, error } = await supabase.rpc("complete_typing_practice", {
    p_mode: mode,
    p_taja: Math.max(0, Math.round(taja)),
    p_won: won,
    p_match_id: matchId ?? null,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function listTypingPracticeLogs(limit = 100): Promise<TypingPracticeLogView[]> {
  const { data, error } = await supabase
    .from("typing_practice_logs")
    .select("*")
    .order("completed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const logs = (data ?? []) as TypingPracticeLog[];
  const ids = [...new Set(logs.map((log) => log.student_id))];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);
    for (const profile of profiles ?? []) {
      names.set(profile.id as string, (profile.display_name as string) || "학생");
    }
  }

  return logs.map((log) => ({
    ...log,
    student_name: names.get(log.student_id) ?? "학생",
  }));
}
