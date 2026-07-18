import { describe, expect, it } from "vitest";
import { diffLines } from "@/lib/textDiff";

describe("diffLines", () => {
  it("marks added, removed, and unchanged lines", () => {
    const ops = diffLines("a\nb\nc", "a\nx\nc");
    expect(ops).toEqual([
      { type: "same", text: "a" },
      { type: "remove", text: "b" },
      { type: "add", text: "x" },
      { type: "same", text: "c" },
    ]);
  });

  it("handles pure insertion and deletion", () => {
    expect(diffLines("", "new").filter((o) => o.type === "add")).toHaveLength(1);
    expect(diffLines("old", "").filter((o) => o.type === "remove")).toHaveLength(1);
  });

  it("is all-same for identical input", () => {
    expect(diffLines("a\nb", "a\nb").every((o) => o.type === "same")).toBe(true);
  });
});
