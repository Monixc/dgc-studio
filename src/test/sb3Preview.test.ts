import { afterEach, describe, expect, it, vi } from "vitest";
import { strToU8, zipSync } from "fflate";
import { isScratchFile, loadSb3Scripts } from "@/features/portfolio/sb3Preview";

function mockFetchZip(files: Record<string, Uint8Array>) {
  const bytes = zipSync(files);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, arrayBuffer: async () => bytes.slice().buffer })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("isScratchFile", () => {
  it("matches only .sb3", () => {
    expect(isScratchFile("game.sb3")).toBe(true);
    expect(isScratchFile("game.SB3")).toBe(true);
    expect(isScratchFile("game.sb2")).toBe(false);
    expect(isScratchFile("doc.pdf")).toBe(false);
  });
});

describe("loadSb3Scripts", () => {
  it("throws when project.json is missing", async () => {
    mockFetchZip({ "readme.txt": strToU8("hi") });
    await expect(loadSb3Scripts("blob:x")).rejects.toThrow(/project\.json/);
  });

  it("skips unparseable scripts instead of crashing", async () => {
    const project = { targets: [{ name: "Sprite1", blocks: { a: { topLevel: true, opcode: "bogus" } } }] };
    mockFetchZip({ "project.json": strToU8(JSON.stringify(project)) });
    await expect(loadSb3Scripts("blob:x")).resolves.toEqual([]);
  });

  it("converts a real top-level script to scratchblocks text", async () => {
    const project = {
      targets: [
        {
          name: "Sprite1",
          blocks: {
            a: { opcode: "event_whenflagclicked", next: "b", parent: null, topLevel: true, inputs: {}, fields: {}, shadow: false, x: 0, y: 0 },
            b: { opcode: "motion_movesteps", next: null, parent: "a", topLevel: false, inputs: { STEPS: [1, [4, "10"]] }, fields: {}, shadow: false },
          },
        },
      ],
    };
    mockFetchZip({ "project.json": strToU8(JSON.stringify(project)) });
    const scripts = await loadSb3Scripts("blob:x");
    expect(scripts).toHaveLength(1);
    expect(scripts[0].target).toBe("Sprite1");
    expect(scripts[0].code).toContain("move (10) steps");
  });

  it("ignores non-top-level blocks", async () => {
    const project = { targets: [{ name: "Sprite1", blocks: { a: { topLevel: false, opcode: "x" } } }] };
    mockFetchZip({ "project.json": strToU8(JSON.stringify(project)) });
    await expect(loadSb3Scripts("blob:x")).resolves.toEqual([]);
  });
});
