import { describe, expect, it } from "vitest";
import {
  getPortfolioPlainText,
  normalizePortfolioSelection,
  parsePortfolioMarkdown,
  sanitizeExternalMediaUrl,
  sanitizeHttpsUrl,
  serializePortfolioMarkdown,
  type PortfolioDocument,
} from "@/features/portfolio/portfolio";

describe("portfolio content", () => {
  it("accepts only credential-free HTTPS links", () => {
    expect(sanitizeHttpsUrl("https://example.com/learn")).toBe("https://example.com/learn");
    expect(sanitizeHttpsUrl("http://example.com")).toBeNull();
    expect(sanitizeHttpsUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeHttpsUrl("https://user:secret@example.com")).toBeNull();
  });

  it("recognizes supported video links", () => {
    expect(sanitizeExternalMediaUrl("https://youtu.be/dQw4w9WgXcQ")?.kind).toBe("youtube");
    expect(sanitizeExternalMediaUrl("https://vimeo.com/123456")?.kind).toBe("vimeo");
    expect(sanitizeExternalMediaUrl("https://cdn.example.com/lesson.webm")?.kind).toBe("video");
    expect(sanitizeExternalMediaUrl("https://example.com/page")).toBeNull();
  });

  it("imports and exports Markdown without raw HTML", () => {
    const document = parsePortfolioMarkdown("# 학습 기록\n\n- 첫 번째\n- 두 번째");
    expect(getPortfolioPlainText(document)).toContain("학습 기록");
    expect(serializePortfolioMarkdown(document)).toContain("# 학습 기록");
    expect(() => parsePortfolioMarkdown("<script>alert(1)</script>")).toThrow();
  });

  it("extracts readable plain text from a rich document", () => {
    const document: PortfolioDocument = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "오늘 배운 것" }] },
        { type: "paragraph", content: [{ type: "text", text: "반복문을 연습했다." }] },
      ],
    };
    expect(getPortfolioPlainText(document)).toBe("오늘 배운 것\n반복문을 연습했다.");
  });

  it("normalizes reverse selections and derives line numbers", () => {
    const text = "첫 줄\n둘째 줄\n셋째 줄";
    const selection = normalizePortfolioSelection({
      content: { size: text.length },
      textBetween: (from, to) => text.slice(from, to),
    }, 10, 3);

    expect(selection.from).toBe(3);
    expect(selection.to).toBe(10);
    expect(selection.startLine).toBe(1);
    expect(selection.endLine).toBe(3);
  });
});
