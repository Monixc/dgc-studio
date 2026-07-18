import { describe, expect, it } from "vitest";
import { dailyTypingBests } from "@/lib/studentTypingAnalytics";
import type { TypingPracticeLog, TypingPracticeMode } from "@/integrations/supabase/types";

function log(
  id: string,
  mode: TypingPracticeMode,
  taja: number,
  completedAt: string,
): TypingPracticeLog {
  return {
    id,
    student_id: "student-1",
    mode,
    taja,
    points: 0,
    match_id: null,
    completed_at: completedAt,
  };
}

describe("dailyTypingBests", () => {
  it("keeps the daily maximum across all practice modes", () => {
    const today = new Date(2026, 6, 18, 12);
    const result = dailyTypingBests([
      log("1", "practice_english", 220, new Date(2026, 6, 18, 9).toISOString()),
      log("2", "race_live", 410, new Date(2026, 6, 18, 13).toISOString()),
      log("3", "practice_code", 330, new Date(2026, 6, 18, 18).toISOString()),
    ], 3, today);

    expect(result.at(-1)).toMatchObject({ taja: 410, mode: "race_live" });
  });

  it("fills dates without records with zero", () => {
    const today = new Date(2026, 6, 18, 12);
    const result = dailyTypingBests([
      log("1", "ai_learning", 280, new Date(2026, 6, 17, 10).toISOString()),
    ], 3, today);

    expect(result.map((day) => day.taja)).toEqual([0, 280, 0]);
  });
});
