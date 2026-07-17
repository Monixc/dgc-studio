import { describe, expect, it } from "vitest";
import {
  calculateTypingResult,
  mergeTypingRanking,
  remainingLineIndent,
  wpmToTaja,
} from "@/lib/typing";

describe("calculateTypingResult", () => {
  it("calculates 타수 (chars/min) and accuracy from a timed session", () => {
    // 250정타 / 1분 = 250타 (한컴타자 스타일 분당 글자 수)
    expect(calculateTypingResult(250, 300, 60_000, 3)).toEqual({
      taja: 250,
      accuracy: 83,
      completed: 3,
    });
  });

  it("converts WPM to 타수 for race display", () => {
    expect(wpmToTaja(40)).toBe(200);
    expect(wpmToTaja(85)).toBe(425);
  });

  it("keeps each user's best 타수 and sorts descending", () => {
    expect(mergeTypingRanking([
      { id: "me", name: "나", taja: 200 },
      { id: "other", name: "상대", taja: 300 },
      { id: "me", name: "나", taja: 350 },
    ]).map(({ id, taja }) => [id, taja])).toEqual([
      ["me", 350],
      ["other", 300],
    ]);
  });
});

describe("remainingLineIndent", () => {
  it("consumes full space indent at line start with one Tab", () => {
    const text = "def greet(name):\n    return name";
    expect(remainingLineIndent(text, text.indexOf("    "))).toBe("    ");
  });

  it("consumes remaining indent when partially typed", () => {
    const text = "def greet(name):\n    return name";
    const indentStart = text.indexOf("    ");
    expect(remainingLineIndent(text, indentStart + 2)).toBe("  ");
  });

  it("consumes multiple tabs as one indent block", () => {
    const text = "def outer():\n\t\treturn 1";
    expect(remainingLineIndent(text, text.indexOf("\t\t"))).toBe("\t\t");
  });

  it("does not skip mid-line spaces", () => {
    const text = "print(a, b)";
    expect(remainingLineIndent(text, text.indexOf(" b"))).toBe("");
  });
});
