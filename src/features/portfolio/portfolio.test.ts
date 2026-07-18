import { describe, expect, it } from "vitest";
import {
  getPortfolioPlainText,
  parsePortfolioMarkdown,
  plainTextToDocument,
  sanitizeExternalMediaUrl,
  sanitizeHttpsUrl,
  serializePortfolioMarkdown,
} from "./portfolio";

describe("portfolio editor utilities", () => {
  it("accepts only credential-free HTTPS URLs", () => {
    expect(sanitizeHttpsUrl("https://example.com/path")).toBe("https://example.com/path");
    expect(sanitizeHttpsUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeHttpsUrl("https://user:secret@example.com")).toBeNull();
  });

  it("normalizes supported media and rejects arbitrary URLs", () => {
    expect(sanitizeExternalMediaUrl("https://youtu.be/dQw4w9WgXcQ")).toEqual({
      kind: "youtube",
      src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
    expect(sanitizeExternalMediaUrl("https://vimeo.com/123456")).toEqual({
      kind: "vimeo",
      src: "https://player.vimeo.com/video/123456",
    });
    expect(sanitizeExternalMediaUrl("https://example.com/watch")).toBeNull();
  });

  it("rejects HTML and round-trips asset IDs without signed URLs", () => {
    expect(() => parsePortfolioMarkdown("<script>alert(1)</script>")).toThrow();
    const markdown = ':::portfolio-asset {assetId="asset-1" alt="drawing"} :::';
    const document = parsePortfolioMarkdown(markdown);
    expect(document.content?.[0].attrs?.assetId).toBe("asset-1");
    expect(serializePortfolioMarkdown(document)).toContain('assetId="asset-1"');
    expect(serializePortfolioMarkdown(document)).not.toContain("https://");
  });

  it("round-trips plain text lines", () => {
    expect(getPortfolioPlainText(plainTextToDocument("첫 줄\n\n셋째 줄"))).toBe("첫 줄\n\n셋째 줄");
  });
});
