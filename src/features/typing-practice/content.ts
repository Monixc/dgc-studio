/** Typing practice corpus loader — fetches `/typing-practice/index.json` + category chunks. */

export const PRACTICE_CATEGORIES = [
  "english",
  "python",
  "lua",
  "javascript",
  "html",
  "typescript",
  "sql",
  "react",
  "css",
  "shell",
] as const;

export type PracticeCategory = (typeof PRACTICE_CATEGORIES)[number];

export type ProseUnit = "sentence" | "paragraph";

export type PracticeDifficulty = "easy" | "medium" | "hard" | number;

export interface PracticeContentItem {
  id: string;
  category: PracticeCategory;
  title: string;
  text: string;
  difficulty: PracticeDifficulty;
  source: string;
  license: string;
  /** Prose only */
  author?: string;
  /** Prose only */
  unit?: ProseUnit;
}

export interface CategoryIndexEntry {
  count: number;
  chunks: string[];
}

export interface PracticeContentIndex {
  version: string | number;
  generatedAt?: string;
  categories: Partial<Record<PracticeCategory, CategoryIndexEntry>>;
}

export const CATEGORY_META: {
  id: PracticeCategory;
  label: string;
  icon: string;
  description: string;
  kind: "prose" | "code";
  language?: string;
  extension?: string;
}[] = [
  { id: "english", label: "영문", icon: "📖", description: "문학 문장·문단", kind: "prose" },
  { id: "python", label: "Python", icon: "🐍", description: "파이썬", kind: "code", language: "Python", extension: "py" },
  { id: "lua", label: "Lua", icon: "🌙", description: "Lua", kind: "code", language: "Lua", extension: "lua" },
  { id: "javascript", label: "JavaScript", icon: "⚡", description: "JS", kind: "code", language: "JavaScript", extension: "js" },
  { id: "html", label: "HTML", icon: "🌐", description: "마크업", kind: "code", language: "HTML", extension: "html" },
  { id: "typescript", label: "TypeScript", icon: "💠", description: "TS", kind: "code", language: "TypeScript", extension: "ts" },
  { id: "sql", label: "SQL", icon: "🗃️", description: "쿼리", kind: "code", language: "SQL", extension: "sql" },
  { id: "react", label: "React", icon: "⚛️", description: "TSX", kind: "code", language: "TSX", extension: "tsx" },
  { id: "css", label: "CSS", icon: "🎨", description: "스타일", kind: "code", language: "CSS", extension: "css" },
  { id: "shell", label: "Shell", icon: "💻", description: "셸", kind: "code", language: "Shell", extension: "sh" },
];

const BASE = "/typing-practice";
const RECENT_KEY = "flowpy:typing-practice:recent-ids";
const RECENT_LIMIT = 200;

/** Corpus JSON may use aliases (prose → english, react-tsx → react). */
const CORPUS_TO_UI: Record<string, PracticeCategory> = {
  english: "english",
  prose: "english",
  python: "python",
  lua: "lua",
  javascript: "javascript",
  html: "html",
  typescript: "typescript",
  sql: "sql",
  react: "react",
  "react-tsx": "react",
  css: "css",
  shell: "shell",
};

let indexCache: PracticeContentIndex | null = null;
let indexPromise: Promise<PracticeContentIndex> | null = null;
const chunkCache = new Map<string, PracticeContentItem[]>();
const categoryCache = new Map<string, PracticeContentItem[]>();
const categoryPromises = new Map<string, Promise<PracticeContentItem[]>>();

function mapCategory(value: unknown): PracticeCategory | null {
  if (typeof value !== "string") return null;
  return CORPUS_TO_UI[value] ?? null;
}

function isUnit(value: unknown): value is ProseUnit {
  return value === "sentence" || value === "paragraph";
}

function normalizeDifficulty(value: unknown): PracticeDifficulty {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === "easy" || value === "medium" || value === "hard") return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return "medium";
}

function normalizeSource(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const o = value as Record<string, unknown>;
  if (typeof o.url === "string" && o.url) return o.url;
  if (typeof o.name === "string" && typeof o.repository === "string") {
    return `${o.name} · ${o.repository}`;
  }
  if (typeof o.repository === "string") {
    const path = typeof o.path === "string" ? `/${o.path}` : "";
    return `${o.repository}${path}`;
  }
  if (typeof o.name === "string") return o.name;
  return "";
}

function parseItem(raw: unknown): PracticeContentItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id) return null;
  const category = mapCategory(o.category);
  if (!category) return null;
  if (typeof o.title !== "string" || typeof o.text !== "string") return null;
  if (!o.text.length) return null;
  const item: PracticeContentItem = {
    id: o.id,
    category,
    title: o.title,
    text: o.text,
    difficulty: normalizeDifficulty(o.difficulty),
    source: normalizeSource(o.source),
    license: typeof o.license === "string" ? o.license : "",
  };
  if (typeof o.author === "string") item.author = o.author;
  if (isUnit(o.unit)) item.unit = o.unit;
  return item;
}

function parseChunkPayload(data: unknown): PracticeContentItem[] {
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)
      ? (data as { items: unknown[] }).items
      : null;
  if (!list) throw new Error("chunk must be an array or { items: [] }");
  const items: PracticeContentItem[] = [];
  for (const row of list) {
    const item = parseItem(row);
    if (item) items.push(item);
  }
  return items;
}

function readChunks(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const e = value as Record<string, unknown>;
  return Array.isArray(e.chunks)
    ? e.chunks.filter((c): c is string => typeof c === "string" && c.length > 0)
    : [];
}

function normalizeIndex(data: unknown): PracticeContentIndex {
  if (!data || typeof data !== "object") throw new Error("invalid index.json");
  const root = data as Record<string, unknown>;
  const categories: PracticeContentIndex["categories"] = {};

  const rawCats = root.categories;
  if (Array.isArray(rawCats)) {
    for (const entry of rawCats) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      const id = mapCategory(e.id) ?? mapCategory(e.category);
      if (!id) continue;
      const chunks = readChunks(e);
      const prev = categories[id];
      categories[id] = {
        count: (prev?.count ?? 0) + (typeof e.count === "number" ? e.count : chunks.length),
        chunks: [...(prev?.chunks ?? []), ...chunks],
      };
    }
  } else if (rawCats && typeof rawCats === "object") {
    for (const [key, value] of Object.entries(rawCats)) {
      const id = mapCategory(key);
      if (!id || !value || typeof value !== "object") continue;
      const e = value as Record<string, unknown>;
      const chunks = readChunks(e);
      const prev = categories[id];
      categories[id] = {
        count: (prev?.count ?? 0) + (typeof e.count === "number" ? e.count : chunks.length),
        chunks: [...(prev?.chunks ?? []), ...chunks],
      };
    }
  }

  if (Object.keys(categories).length === 0) throw new Error("index.json has no categories");

  return {
    version: (root.schema_version as string | number)
      ?? (root.version as string | number)
      ?? 1,
    generatedAt: typeof root.generatedAt === "string" ? root.generatedAt : undefined,
    categories,
  };
}

async function fetchJson(path: string): Promise<unknown> {
  const url = path.startsWith("http") || path.startsWith("/")
    ? path
    : `${BASE}/${path.replace(/^\.\//, "")}`;
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`fetch failed: ${url} (${res.status})`);
  return res.json();
}

export async function loadPracticeIndex(force = false): Promise<PracticeContentIndex> {
  if (!force && indexCache) return indexCache;
  if (!force && indexPromise) return indexPromise;
  if (force) {
    indexCache = null;
    indexPromise = null;
  }

  indexPromise = (async () => {
    const data = await fetchJson(`${BASE}/index.json`);
    indexCache = normalizeIndex(data);
    return indexCache;
  })();

  try {
    return await indexPromise;
  } finally {
    indexPromise = null;
  }
}

async function loadChunk(relPath: string): Promise<PracticeContentItem[]> {
  const key = relPath.replace(/^\.\//, "");
  const cached = chunkCache.get(key);
  if (cached) return cached;

  const path = key.startsWith("chunks/") || key.includes("/")
    ? `${BASE}/${key}`
    : `${BASE}/chunks/${key}`;
  const data = await fetchJson(path);
  const items = parseChunkPayload(data);
  chunkCache.set(key, items);
  return items;
}

/** Lazy-load all chunks for one category (cached). */
export async function loadCategoryItems(
  category: PracticeCategory,
  force = false,
): Promise<PracticeContentItem[]> {
  if (!force) {
    const cached = categoryCache.get(category);
    if (cached) return cached;
    const pending = categoryPromises.get(category);
    if (pending) return pending;
  } else {
    categoryCache.delete(category);
    categoryPromises.delete(category);
  }

  const promise = (async () => {
    const index = await loadPracticeIndex(force);
    const entry = index.categories[category];
    if (!entry || entry.chunks.length === 0) {
      throw new Error(`no chunks for category: ${category}`);
    }
    if (force) {
      for (const rel of entry.chunks) chunkCache.delete(rel.replace(/^\.\//, ""));
    }
    const parts = await Promise.all(entry.chunks.map((c) => loadChunk(c)));
    const byId = new Map<string, PracticeContentItem>();
    for (const part of parts) {
      for (const item of part) {
        if (item.category !== category) continue;
        byId.set(item.id, item);
      }
    }
    const items = [...byId.values()];
    if (items.length === 0) throw new Error(`empty category: ${category}`);
    categoryCache.set(category, items);
    return items;
  })();

  categoryPromises.set(category, promise);
  try {
    return await promise;
  } finally {
    categoryPromises.delete(category);
  }
}

export function filterByUnit(
  items: PracticeContentItem[],
  unit: ProseUnit | "all",
): PracticeContentItem[] {
  if (unit === "all") return items;
  const matched = items.filter((item) => item.unit === unit);
  return matched.length > 0 ? matched : items;
}

export function loadRecentIds(): string[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter((id): id is string => typeof id === "string").slice(-RECENT_LIMIT);
  } catch {
    return [];
  }
}

export function pushRecentId(id: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    const next = [...loadRecentIds().filter((x) => x !== id), id].slice(-RECENT_LIMIT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}

/** Fisher–Yates shuffle (mutates copy). */
export function shuffleInPlace<T>(arr: T[], random: () => number = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Shuffle bag: no re-draw until pool exhausted.
 * Prefers items outside the recent-200 window when rebuilding.
 */
export class ShuffleBag {
  private pool: PracticeContentItem[] = [];
  private bag: PracticeContentItem[] = [];

  setPool(items: PracticeContentItem[]): void {
    this.pool = items;
    this.bag = [];
    this.refill();
  }

  size(): number {
    return this.pool.length;
  }

  remaining(): number {
    return this.bag.length;
  }

  private refill(): void {
    if (this.pool.length === 0) {
      this.bag = [];
      return;
    }
    const recent = new Set(loadRecentIds());
    let candidates = this.pool.filter((item) => !recent.has(item.id));
    if (candidates.length === 0) candidates = [...this.pool];
    this.bag = shuffleInPlace([...candidates]);
  }

  /** Peek next without consuming (refills if needed). */
  peek(): PracticeContentItem | null {
    if (this.bag.length === 0) this.refill();
    return this.bag[this.bag.length - 1] ?? null;
  }

  /** Draw next item and record it in recent history. */
  next(): PracticeContentItem | null {
    if (this.bag.length === 0) this.refill();
    const item = this.bag.pop() ?? null;
    if (item) pushRecentId(item.id);
    return item;
  }

  /** Replace current head after a soft skip without marking complete (rare). */
  skip(): PracticeContentItem | null {
    if (this.bag.length === 0) this.refill();
    this.bag.pop();
    return this.peek();
  }
}

/** Test / HMR reset. */
export function resetPracticeContentCache(): void {
  indexCache = null;
  indexPromise = null;
  chunkCache.clear();
  categoryCache.clear();
  categoryPromises.clear();
}

export function isCodeCategory(category: PracticeCategory): boolean {
  return category !== "english";
}

export function categoryFileName(item: PracticeContentItem): string {
  const meta = CATEGORY_META.find((c) => c.id === item.category);
  const ext = meta?.extension ?? "txt";
  const sourcePath = item.title.includes(": ")
    ? item.title.slice(item.title.indexOf(": ") + 2)
    : "";
  const originalName = sourcePath.split("/").pop()?.trim();
  if (originalName && /^[a-zA-Z0-9_.-]+$/.test(originalName)) {
    return originalName.includes(".") ? originalName : `${originalName}.${ext}`;
  }
  const base = item.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "snippet";
  return `${base}.${ext}`;
}
