import { supabase } from "@/integrations/supabase/client";
import type { Submission } from "@/integrations/supabase/types";
import type { GradingSummary } from "@/lib/grading";

const BLOCK_IMAGE_PREFIX = "flow-py:block-image:";

function serializeResult(summary: GradingSummary, blockImage?: string): string {
  const text = summary.details.map((detail) => `${detail.title}: ${detail.passed ? "통과" : "실패"}`).join("\n");
  return blockImage
    ? `${BLOCK_IMAGE_PREFIX}${JSON.stringify({ text, blockImage })}`
    : text;
}

export function hydrateSubmission<T extends Submission>(submission: T): T {
  if (!submission.result.startsWith(BLOCK_IMAGE_PREFIX)) {
    return { ...submission, block_image: submission.block_image ?? null };
  }
  try {
    const stored = JSON.parse(submission.result.slice(BLOCK_IMAGE_PREFIX.length)) as {
      text?: string;
      blockImage?: string;
    };
    return {
      ...submission,
      result: stored.text ?? "",
      block_image: stored.blockImage ?? null,
    };
  } catch {
    return { ...submission, block_image: null };
  }
}

export async function submitSolution(params: {
  problemId: string;
  userId: string;
  code: string;
  blockImage?: string;
  summary: GradingSummary;
}): Promise<Submission> {
  const { problemId, userId, code, blockImage, summary } = params;
  const { data, error } = await supabase
    .from("submissions")
    .insert({
      problem_id: problemId,
      user_id: userId,
      code,
      result: serializeResult(summary, blockImage),
      score: summary.score,
      max_score: summary.maxScore,
      passed_tests: summary.passed,
      total_tests: summary.total,
      grading_details: summary.details,
    })
    .select()
    .single();
  if (error) throw error;
  return hydrateSubmission(data as Submission);
}

/** 학생 본인의 제출 목록(최신순). problemId 지정 시 해당 문제만. */
export async function listMySubmissions(userId: string, problemId?: string): Promise<Submission[]> {
  let q = supabase.from("submissions").select("*").eq("user_id", userId).order("submitted_at", { ascending: false });
  if (problemId) q = q.eq("problem_id", problemId);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as Submission[]).map(hydrateSubmission);
}

/** 선생: 본인 문제에 달린 최근 제출(학생 이름 포함). RLS 로 접근 가능한 것만 반환. */
export async function listRecentSubmissions(limit = 8): Promise<(Submission & { student_name: string })[]> {
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .order("submitted_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = ((data ?? []) as Submission[]).map(hydrateSubmission);
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
    (profs ?? []).forEach((p: any) => names.set(p.id, p.display_name));
  }
  return rows.map((r) => ({ ...r, student_name: names.get(r.user_id) ?? "학생" }));
}

/** 선생: 본인 문제에 달린 모든 제출(학생 이름 포함). RLS 로 본인 문제만 반환. */
export async function listProblemSubmissions(problemId: string): Promise<(Submission & { student_name: string })[]> {
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("problem_id", problemId)
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  const rows = ((data ?? []) as Submission[]).map(hydrateSubmission);
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
    (profs ?? []).forEach((p: any) => names.set(p.id, p.display_name));
  }
  return rows.map((r) => ({ ...r, student_name: names.get(r.user_id) ?? "학생" }));
}
