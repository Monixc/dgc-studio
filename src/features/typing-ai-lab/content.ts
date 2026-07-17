export type Pos = "noun" | "verb" | "adj";
export type Category =
  | "human"
  | "education"
  | "technology"
  | "nature"
  | "place"
  | "object"
  | "animal"
  | "action";

export type SemanticType =
  | "person"
  | "animate"
  | "animal"
  | "food"
  | "readable"
  | "writable"
  | "buildable"
  | "place"
  | "topic"
  | "artifact"
  | "nature_thing"
  | "action";

export type RelationType =
  | "RelatedTo"
  | "IsA"
  | "PartOf"
  | "CapableOf"
  | "AtLocation"
  | "ActsOn"
  | "Describes";

export interface WordDef {
  id: string;
  word: string;
  pos: Pos;
  categories: Category[];
  meaningKo: string;
  semanticTypes: SemanticType[];
  difficulty: number;
  frequency: number;
  countability: "count" | "mass" | "both";
  number: "singular" | "plural" | "invariant";
  forms?: { plural?: string; thirdPersonSingular?: string };
  frame?: {
    subjects: SemanticType[];
    objects?: SemanticType[] | null;
    locations?: SemanticType[] | null;
  };
}

export interface RelationDef {
  from: string;
  to: string;
  type: RelationType;
  weight: number;
}

export interface TemplateDef {
  id: string;
  kind: "svo" | "sv_loc" | "adj_noun" | "sv";
  score: number;
}

export interface LexiconManifest {
  version: string;
  generatedAt: string;
  minWords: number;
  wordCount: number;
  relationCount: number;
  uniqueSurfaces: number;
  posCounts: Record<string, number>;
  difficultyCounts: Record<string, number>;
  chunks: { words: string[]; relations: string[] };
  sources: string[];
  curatedWordCount: number;
  curatedFrameCount: number;
}

export const CATEGORIES: Category[] = [
  "human",
  "education",
  "technology",
  "nature",
  "place",
  "object",
  "animal",
  "action",
];

/** Curated sentence templates only — auto verbs never invent frames. */
export const TEMPLATES: TemplateDef[] = [
  { id: "svo", kind: "svo", score: 10 },
  { id: "sv_loc", kind: "sv_loc", score: 9 },
  { id: "sv", kind: "sv", score: 6 },
  { id: "adj_noun", kind: "adj_noun", score: 5 },
];

const LEXICON_BASE = "/typing-ai-lab";

export let WORDS: WordDef[] = [];
export let RELATIONS: RelationDef[] = [];
export let WORD_BY_ID: Record<string, WordDef> = {};
export let NEIGHBORS = new Map<string, Map<string, number>>();
export let DIRECTED = new Map<string, Array<{ to: string; type: RelationType; weight: number }>>();

let loadedBand = 0;
let loadPromise: Promise<void> | null = null;
let manifestCache: LexiconManifest | null = null;

function rebuildIndexes(words: WordDef[], relations: RelationDef[]): void {
  WORDS = words;
  RELATIONS = relations;
  WORD_BY_ID = Object.fromEntries(words.map((w) => [w.id, w]));

  const neighbors = new Map<string, Map<string, number>>();
  const add = (a: string, b: string, w: number) => {
    if (!neighbors.has(a)) neighbors.set(a, new Map());
    const cur = neighbors.get(a)!;
    cur.set(b, Math.max(cur.get(b) ?? 0, w));
  };
  for (const r of relations) {
    add(r.from, r.to, r.weight);
    add(r.to, r.from, r.weight);
  }
  NEIGHBORS = neighbors;

  const directed = new Map<string, Array<{ to: string; type: RelationType; weight: number }>>();
  for (const r of relations) {
    if (!directed.has(r.from)) directed.set(r.from, []);
    directed.get(r.from)!.push({ to: r.to, type: r.type, weight: r.weight });
  }
  DIRECTED = directed;
}

/** Sync hydrate for tests / offline seed. Dedupes by id. */
export function hydrateLexicon(words: WordDef[], relations: RelationDef[]): void {
  const byId = new Map<string, WordDef>();
  for (const w of words) byId.set(w.id, w);
  const mergedWords = [...byId.values()];
  const idSet = new Set(mergedWords.map((w) => w.id));
  const relKeys = new Set<string>();
  const mergedRels: RelationDef[] = [];
  for (const r of relations) {
    if (!idSet.has(r.from) || !idSet.has(r.to)) continue;
    const key = `${r.from}|${r.to}|${r.type}`;
    if (relKeys.has(key)) continue;
    relKeys.add(key);
    mergedRels.push(r);
  }
  rebuildIndexes(mergedWords, mergedRels);
  loadedBand = Math.max(
    loadedBand,
    ...mergedWords.map((w) => w.difficulty),
    0,
  );
}

export function lexiconLoadedBand(): number {
  return loadedBand;
}

export function getLexiconManifest(): LexiconManifest | null {
  return manifestCache;
}

export function isLexiconReady(maxDifficulty = 1): boolean {
  return loadedBand >= maxDifficulty && WORDS.length > 0;
}

async function fetchJson<T>(path: string, cacheKey: string): Promise<T> {
  const res = await fetch(`${LEXICON_BASE}/${path}?v=${encodeURIComponent(cacheKey)}`, {
    cache: "no-cache",
  });
  if (!res.ok) throw new Error(`lexicon fetch failed: ${path} (${res.status})`);
  return res.json() as Promise<T>;
}

/**
 * Load words/relations for difficulties 1..maxDifficulty (inclusive).
 * Idempotent: only fetches missing higher bands.
 */
export async function ensureLexicon(maxDifficulty: number): Promise<LexiconManifest> {
  const band = Math.max(1, Math.min(5, Math.floor(maxDifficulty)));
  if (loadedBand >= band && manifestCache) return manifestCache;

  if (loadPromise) {
    await loadPromise;
    if (loadedBand >= band && manifestCache) return manifestCache;
  }

  loadPromise = (async () => {
    if (!manifestCache) {
      manifestCache = await fetchJson<LexiconManifest>("manifest.json", "manifest");
    }
    const cacheKey = `${manifestCache.version}-${manifestCache.generatedAt}`;
    const nextWords = [...WORDS];
    const nextRels = [...RELATIONS];
    const seenIds = new Set(nextWords.map((w) => w.id));
    const seenRel = new Set(nextRels.map((r) => `${r.from}|${r.to}|${r.type}`));

    for (let d = loadedBand + 1; d <= band; d++) {
      const words = await fetchJson<WordDef[]>(`words-d${d}.json`, cacheKey);
      const rels = await fetchJson<RelationDef[]>(`relations-d${d}.json`, cacheKey);
      for (const w of words) {
        if (seenIds.has(w.id)) continue;
        seenIds.add(w.id);
        nextWords.push(w);
      }
      for (const r of rels) {
        const key = `${r.from}|${r.to}|${r.type}`;
        if (seenRel.has(key)) continue;
        seenRel.add(key);
        nextRels.push(r);
      }
    }

    // Drop dangling edges until both endpoints are loaded
    const idSet = new Set(nextWords.map((w) => w.id));
    const filteredRels = nextRels.filter((r) => idSet.has(r.from) && idSet.has(r.to));
    rebuildIndexes(nextWords, filteredRels);
    loadedBand = band;
  })();

  try {
    await loadPromise;
  } finally {
    loadPromise = null;
  }

  if (!manifestCache) throw new Error("lexicon manifest missing");
  return manifestCache;
}

/** Reset store (tests). */
export function resetLexicon(): void {
  rebuildIndexes([], []);
  loadedBand = 0;
  loadPromise = null;
  manifestCache = null;
}

export function areRelated(a: string, b: string): boolean {
  return (NEIGHBORS.get(a)?.has(b) ?? false) || a === b;
}

export function hasDirected(from: string, to: string, type: RelationType): boolean {
  return (DIRECTED.get(from) ?? []).some((e) => e.to === to && e.type === type);
}

export function relationWeight(a: string, b: string): number {
  return NEIGHBORS.get(a)?.get(b) ?? 0;
}

export function masteryTarget(difficulty: number): number {
  return Math.min(7, Math.max(3, difficulty + 2));
}

export function articleFor(word: WordDef): "" | "a" | "an" {
  if (word.countability === "mass") return "";
  if (word.number === "plural") return "";
  const w = word.word.toLowerCase();
  if (["hour", "honest", "honor"].includes(w)) return "an";
  if (["university", "unique", "european", "one"].includes(w)) return "a";
  return ["a", "e", "i", "o", "u"].includes(w[0]!) ? "an" : "a";
}

export function verbForm(verb: WordDef, subject: WordDef): string {
  const useThird =
    subject.number === "singular" ||
    (subject.number === "invariant" && !["fish", "sheep"].includes(subject.word));
  if (useThird) return verb.forms?.thirdPersonSingular ?? `${verb.word}s`;
  return verb.word;
}

export function sharesSemantic(word: WordDef, types: SemanticType[]): boolean {
  return word.semanticTypes.some((t) => types.includes(t));
}
