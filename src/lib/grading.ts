import type { GradingTest, GradingDetail } from "@/integrations/supabase/types";

/** 출력 비교용 정규화: CRLF 통일, 각 줄 우측 공백 제거, 전체 트림. */
export function normalizeOutput(text: string): string {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .trim();
}

export function makeEmptyTest(): GradingTest {
  return {
    id: crypto.randomUUID(),
    title: "새 테스트",
    input: "",
    expectedOutput: "",
    points: 100,
  };
}

export function toPositivePoints(value: unknown, fallback = 1): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.round(n);
}

export interface GradingSummary {
  details: GradingDetail[];
  score: number;
  maxScore: number;
  passed: number;
  total: number;
}

/** 각 테스트의 실제 출력 배열을 기대 출력과 비교해 채점 요약 생성. */
export function buildGradingSummary(tests: GradingTest[], actualOutputs: string[]): GradingSummary {
  let score = 0;
  let maxScore = 0;
  let passed = 0;
  const details: GradingDetail[] = tests.map((tc, i) => {
    const points = toPositivePoints(tc.points);
    const actualOutput = actualOutputs[i] ?? "";
    const ok = normalizeOutput(actualOutput) === normalizeOutput(tc.expectedOutput);
    maxScore += points;
    if (ok) {
      score += points;
      passed += 1;
    }
    return {
      caseId: tc.id,
      title: tc.title,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      actualOutput,
      passed: ok,
      points,
    };
  });
  return { details, score, maxScore, passed, total: tests.length };
}
