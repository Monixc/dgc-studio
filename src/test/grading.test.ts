import { describe, it, expect } from "vitest";
import { normalizeOutput, buildGradingSummary, toPositivePoints } from "@/lib/grading";
import type { GradingTest } from "@/integrations/supabase/types";

describe("normalizeOutput", () => {
  it("CRLF/후행공백/앞뒤공백 정규화", () => {
    expect(normalizeOutput("a  \r\nb \n")).toBe("a\nb");
  });
});

describe("toPositivePoints", () => {
  it("음수/0/NaN 은 기본값", () => {
    expect(toPositivePoints(-1)).toBe(1);
    expect(toPositivePoints(0)).toBe(1);
    expect(toPositivePoints("x")).toBe(1);
    expect(toPositivePoints(3)).toBe(3);
  });
});

const tests: GradingTest[] = [
  { id: "a", title: "t1", input: "", expectedOutput: "3", points: 2 },
  { id: "b", title: "t2", input: "", expectedOutput: "hello", points: 1 },
];

describe("buildGradingSummary", () => {
  it("부분 정답 점수 합산", () => {
    const s = buildGradingSummary(tests, ["3\n", "world"]);
    expect(s.passed).toBe(1);
    expect(s.total).toBe(2);
    expect(s.score).toBe(2);
    expect(s.maxScore).toBe(3);
    expect(s.details[0].passed).toBe(true);
    expect(s.details[1].passed).toBe(false);
  });

  it("출력 개수 부족해도 안전", () => {
    const s = buildGradingSummary(tests, []);
    expect(s.score).toBe(0);
    expect(s.details).toHaveLength(2);
  });
});
