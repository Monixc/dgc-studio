import { supabase } from "@/integrations/supabase/client";
import type { TypingAiLabResult } from "@/integrations/supabase/types";
import type { SessionResult } from "@/features/typing-ai-lab/game";
import { masteryTarget, WORD_BY_ID } from "@/features/typing-ai-lab/content";

export const TYPING_AI_LAB_RANKING_KEY = ["typing-ai-lab-ranking"] as const;
export const TYPING_AI_LAB_STATS_KEY = ["typing-ai-lab-stats"] as const;

export interface TypingAiLabRankingRow {
  id: string;
  user_id: string;
  display_name: string;
  total_score: number;
  grade: string;
  dataset_size: number;
  created_at: string;
  isMe?: boolean;
}

export interface WordStatRow {
  word_id: string;
  correct_count: number;
  mastered_at: string | null;
}

export interface ApplyHitsRow {
  word_id: string;
  correct_count: number;
  newly_mastered: boolean;
}

export interface MatchRow {
  id: string;
  status: "countdown" | "playing" | "finished" | "abandoned";
  seed: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface MatchPlayerRow {
  match_id: string;
  user_id: string;
  display_name: string;
  pool_ids: string[];
  total_score: number | null;
  grade: string | null;
  dataset_size: number | null;
  forfeit: boolean;
}

export async function saveTypingAiLabResult(
  userId: string,
  result: SessionResult,
): Promise<TypingAiLabResult> {
  const row = {
    user_id: userId,
    mode: result.mode === "competition" ? "competition" : "learning",
    elapsed_ms: result.elapsedMs,
    accuracy: result.score.accuracy,
    dataset_score: result.score.dataset,
    density_score: result.score.density,
    coverage_score: result.score.coverage,
    inference_score: result.score.inference,
    total_score: result.score.total,
    grade: result.score.grade,
    dataset_size: result.dataset.length,
    dataset: result.datasetWords,
    sentences: result.sentences.map((s) => s.text),
  };

  const { data, error } = await supabase
    .from("typing_ai_lab_results")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as TypingAiLabResult;
}

export async function listTypingAiLabRanking(limit = 20): Promise<TypingAiLabRankingRow[]> {
  const { data, error } = await supabase
    .from("typing_ai_lab_results")
    .select("id, user_id, total_score, grade, dataset_size, created_at")
    .eq("mode", "competition")
    .order("total_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    id: string;
    user_id: string;
    total_score: number;
    grade: string;
    dataset_size: number;
    created_at: string;
  }>;

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const names = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      names.set((p as { id: string; display_name: string }).id, (p as { display_name: string }).display_name);
    }
  }

  return rows.map((r) => ({
    ...r,
    display_name: names.get(r.user_id) ?? "연구자",
  }));
}

export async function listWordStats(userId: string): Promise<WordStatRow[]> {
  const { data, error } = await supabase
    .from("typing_ai_lab_word_stats")
    .select("word_id, correct_count, mastered_at")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as WordStatRow[];
}

export async function applySessionHits(
  hits: Record<string, number>,
): Promise<ApplyHitsRow[]> {
  const targets: Record<string, number> = {};
  for (const id of Object.keys(hits)) {
    const w = WORD_BY_ID[id];
    targets[id] = masteryTarget(w?.difficulty ?? 1);
  }
  const { data, error } = await supabase.rpc("typing_ai_lab_apply_hits", {
    p_hits: hits,
    p_targets: targets,
  });
  if (error) throw error;
  return (data ?? []) as ApplyHitsRow[];
}

export async function quickMatch(displayName: string, poolIds: string[]) {
  const { data, error } = await supabase.rpc("typing_ai_lab_quick_match", {
    p_display_name: displayName,
    p_pool_ids: poolIds,
  });
  if (error) throw error;
  return data as { status: "queued" | "matched"; match_id?: string; seed?: number };
}

export async function cancelQueue() {
  const { error } = await supabase.rpc("typing_ai_lab_cancel_queue");
  if (error) throw error;
}

export async function startMatch(matchId: string) {
  const { error } = await supabase.rpc("typing_ai_lab_start_match", { p_match_id: matchId });
  if (error) throw error;
}

export async function finishMatch(
  matchId: string,
  args: {
    totalScore: number;
    grade: string;
    datasetSize: number;
    resultId?: string | null;
    forfeit?: boolean;
  },
) {
  const { error } = await supabase.rpc("typing_ai_lab_finish_match", {
    p_match_id: matchId,
    p_total_score: args.totalScore,
    p_grade: args.grade,
    p_dataset_size: args.datasetSize,
    p_result_id: args.resultId ?? null,
    p_forfeit: args.forfeit ?? false,
  });
  if (error) throw error;
}

export async function forfeitMatch(matchId: string) {
  const { error } = await supabase.rpc("typing_ai_lab_forfeit_match", { p_match_id: matchId });
  if (error) throw error;
}

export async function getMatch(matchId: string): Promise<{
  match: MatchRow;
  players: MatchPlayerRow[];
}> {
  const { data: match, error } = await supabase
    .from("typing_ai_lab_matches")
    .select("*")
    .eq("id", matchId)
    .single();
  if (error) throw error;
  const { data: players, error: pErr } = await supabase
    .from("typing_ai_lab_match_players")
    .select("*")
    .eq("match_id", matchId);
  if (pErr) throw pErr;
  return {
    match: match as MatchRow,
    players: (players ?? []).map((p) => ({
      ...(p as MatchPlayerRow),
      pool_ids: Array.isArray((p as MatchPlayerRow).pool_ids)
        ? (p as MatchPlayerRow).pool_ids
        : [],
    })),
  };
}

/** 내 활성 매치 조회 (재접속) */
export async function findActiveMatch(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("typing_ai_lab_match_players")
    .select("match_id, typing_ai_lab_matches!inner(status)")
    .eq("user_id", userId)
    .in("typing_ai_lab_matches.status", ["countdown", "playing"])
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as { match_id: string } | null)?.match_id ?? null;
}
