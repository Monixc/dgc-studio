import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ShuffleBag,
  filterByUnit,
  loadCategoryItems,
  loadPracticeIndex,
  loadRecentIds,
  pushRecentId,
  resetPracticeContentCache,
  shuffleInPlace,
  type PracticeContentItem,
} from "@/features/typing-practice/content";

function item(
  partial: Partial<PracticeContentItem> & Pick<PracticeContentItem, "id" | "category" | "text">,
): PracticeContentItem {
  return {
    title: partial.title ?? partial.id,
    difficulty: partial.difficulty ?? 1,
    source: partial.source ?? "test",
    license: partial.license ?? "MIT",
    ...partial,
  };
}

function installMemoryStorage() {
  const store = new Map<string, string>();
  const memory: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, String(value));
    },
  };
  vi.stubGlobal("localStorage", memory);
  return memory;
}

describe("shuffleInPlace", () => {
  it("permutes with a deterministic RNG", () => {
    let i = 0;
    const seq = [0.9, 0.1, 0.5];
    const arr = [1, 2, 3, 4];
    shuffleInPlace(arr, () => seq[i++] ?? 0);
    expect(arr).toHaveLength(4);
    expect(new Set(arr)).toEqual(new Set([1, 2, 3, 4]));
  });
});

describe("filterByUnit", () => {
  const pool = [
    item({ id: "s1", category: "english", text: "Hello.", unit: "sentence" }),
    item({ id: "p1", category: "english", text: "Longer paragraph.", unit: "paragraph" }),
  ];

  it("filters sentence / paragraph", () => {
    expect(filterByUnit(pool, "sentence").map((x) => x.id)).toEqual(["s1"]);
    expect(filterByUnit(pool, "paragraph").map((x) => x.id)).toEqual(["p1"]);
    expect(filterByUnit(pool, "all")).toHaveLength(2);
  });

  it("falls back to full pool when unit has no matches", () => {
    expect(filterByUnit(pool, "sentence")).toHaveLength(1);
    const onlySentence = [pool[0]!];
    expect(filterByUnit(onlySentence, "paragraph")).toEqual(onlySentence);
  });
});

describe("recent ids + ShuffleBag", () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("caps recent ids at 200", () => {
    for (let i = 0; i < 250; i++) pushRecentId(`id-${i}`);
    const recent = loadRecentIds();
    expect(recent).toHaveLength(200);
    expect(recent[0]).toBe("id-50");
    expect(recent[recent.length - 1]).toBe("id-249");
  });

  it("does not re-expose until pool is exhausted", () => {
    const bag = new ShuffleBag();
    const pool = [1, 2, 3].map((n) => item({ id: `a${n}`, category: "python", text: `x${n}` }));
    bag.setPool(pool);
    const seen = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const next = bag.next();
      expect(next).toBeTruthy();
      expect(seen.has(next!.id)).toBe(false);
      seen.add(next!.id);
    }
    expect(seen.size).toBe(3);
    expect(bag.next()).toBeTruthy();
  });

  it("prefers items outside recent window on refill", () => {
    pushRecentId("a1");
    pushRecentId("a2");
    const bag = new ShuffleBag();
    bag.setPool([
      item({ id: "a1", category: "python", text: "1" }),
      item({ id: "a2", category: "python", text: "2" }),
      item({ id: "a3", category: "python", text: "3" }),
    ]);
    expect(bag.next()?.id).toBe("a3");
  });
});

describe("loadPracticeIndex / loadCategoryItems", () => {
  beforeEach(() => {
    resetPracticeContentCache();
    installMemoryStorage();
  });

  afterEach(() => {
    resetPracticeContentCache();
    vi.unstubAllGlobals();
  });

  it("loads index and category chunks lazily", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/typing-practice/index.json")) {
        return {
          ok: true,
          json: async () => ({
            schema_version: 1,
            categories: {
              python: { count: 2, chunks: ["chunks/python-001.json"] },
              prose: { count: 1, chunks: ["chunks/prose-001.json"] },
              "react-tsx": { count: 1, chunks: ["chunks/react-tsx-001.json"] },
            },
          }),
        };
      }
      if (url.includes("python-001")) {
        return {
          ok: true,
          json: async () => ({
            category: "python",
            items: [
              {
                id: "py-1",
                category: "python",
                title: "Hi",
                text: "print(1)",
                difficulty: "easy",
                source: {
                  repository: "pallets/flask",
                  commit: "a".repeat(40),
                  path: "src/flask/app.py",
                  url: "https://github.com/pallets/flask",
                },
                license: "MIT",
              },
              {
                id: "py-2",
                category: "python",
                title: "Hi2",
                text: "print(2)",
                difficulty: "medium",
                source: "https://example.com",
                license: "MIT",
              },
            ],
          }),
        };
      }
      if (url.includes("prose-001")) {
        return {
          ok: true,
          json: async () => ({
            category: "prose",
            items: [
              {
                id: "en-1",
                category: "prose",
                title: "Book",
                text: "It was a dark night.",
                difficulty: "medium",
                source: { name: "Project Gutenberg", url: "https://gutenberg.org", ebook_id: 11 },
                license: "Public Domain",
                author: "Anon",
                unit: "sentence",
              },
            ],
          }),
        };
      }
      if (url.includes("react-tsx-001")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: "rx-1",
                category: "react-tsx",
                title: "Comp",
                text: "export const A = () => null;",
                difficulty: "easy",
                source: { repository: "facebook/react", commit: "b".repeat(40), path: "a.tsx", url: "https://x" },
                license: "MIT",
              },
            ],
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const index = await loadPracticeIndex();
    expect(index.categories.python?.chunks).toEqual(["chunks/python-001.json"]);
    expect(index.categories.english?.chunks).toEqual(["chunks/prose-001.json"]);
    expect(index.categories.react?.chunks).toEqual(["chunks/react-tsx-001.json"]);

    const py = await loadCategoryItems("python");
    expect(py).toHaveLength(2);
    expect(py[0]?.source).toContain("github.com/pallets/flask");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const pyAgain = await loadCategoryItems("python");
    expect(pyAgain).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const en = await loadCategoryItems("english");
    expect(en[0]?.category).toBe("english");
    expect(en[0]?.author).toBe("Anon");
    expect(en[0]?.unit).toBe("sentence");
    expect(en[0]?.source).toBe("https://gutenberg.org");
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const rx = await loadCategoryItems("react");
    expect(rx[0]?.category).toBe("react");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("rejects missing category chunks", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ version: 1, categories: { python: { count: 0, chunks: [] } } }),
    })));
    await expect(loadCategoryItems("python")).rejects.toThrow(/no chunks/);
  });
});
