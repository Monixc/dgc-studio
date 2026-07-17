import {
  CATEGORIES,
  DIRECTED,
  NEIGHBORS,
  TEMPLATES,
  WORD_BY_ID,
  WORDS,
  articleFor,
  hasDirected,
  masteryTarget,
  sharesSemantic,
  verbForm,
  type Category,
  type SemanticType,
  type WordDef,
} from "./content";

export const SLOT_COUNT = 25;
export const SESSION_MS = 180_000;
export const REFILL_MS = 500;
export const RECENT_SPAWN_MS = 10_000;
export const MAX_SENTENCE_ATTEMPTS = 48;
export const MIN_COMPETITION_WORDS = 25;

export type LabPlayMode = "learning" | "competition";
export type Grade = "SSS" | "SS" | "S" | "A" | "B" | "C" | "D";

export interface Slot {
  id: string;
  wordId: string;
  word: string;
  refillAt: number | null;
}

export interface GameState {
  seed: number;
  mode: LabPlayMode;
  /** 허용 단어 id. null이면 전체 WORDS */
  poolIds: string[] | null;
  /** 학습 모드: 세션 시작 시점까지의 누적 정타 (DB 기준) */
  baselineMastery: Record<string, number>;
  startedAt: number;
  endsAt: number;
  slots: Slot[];
  dataset: string[];
  /** wordId → 이번 세션 정타 횟수 */
  sessionHits: Record<string, number>;
  recentInputs: string[];
  recentSpawns: Array<{ wordId: string; at: number }>;
  combo: number;
  comboCategory: Category | null;
  attempts: number;
  correctAttempts: number;
  lastAcquired: string[];
}

export interface ScoreBreakdown {
  accuracy: number;
  dataset: number;
  density: number;
  coverage: number;
  inference: number;
  total: number;
  grade: Grade;
}

export interface GeneratedSentence {
  text: string;
  templateId: string;
  valid: boolean;
  score: number;
}

export interface GraphEdge {
  fromId: string;
  toId: string;
  from: string;
  to: string;
  type: string;
  weight: number;
}

export interface SessionResult {
  mode: LabPlayMode;
  dataset: string[];
  datasetWords: string[];
  sessionHits: Record<string, number>;
  edges: GraphEdge[];
  density: number;
  coverage: number;
  accuracy: number;
  comboPeak: number;
  sentences: GeneratedSentence[];
  inferenceSuccess: number;
  score: ScoreBreakdown;
  elapsedMs: number;
  poolSize: number;
}

export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPick<T>(items: T[], weights: number[], rng: () => number): T | null {
  let sum = 0;
  for (const w of weights) sum += Math.max(0, w);
  if (sum <= 0 || items.length === 0) return null;
  let r = rng() * sum;
  for (let i = 0; i < items.length; i++) {
    r -= Math.max(0, weights[i]!);
    if (r <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

function poolWords(poolIds: string[] | null): WordDef[] {
  if (!poolIds) return WORDS;
  return poolIds.map((id) => WORD_BY_ID[id]).filter(Boolean) as WordDef[];
}

function underrepresentedBonus(dataset: string[]): Map<Category, number> {
  const counts = new Map<Category, number>();
  for (const c of CATEGORIES) counts.set(c, 0);
  for (const id of dataset) {
    for (const c of WORD_BY_ID[id]?.categories ?? []) {
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  const max = Math.max(1, ...counts.values());
  const bonus = new Map<Category, number>();
  for (const c of CATEGORIES) bonus.set(c, (max - (counts.get(c) ?? 0)) / max);
  return bonus;
}

function onScreenTexts(slots: Slot[]): Set<string> {
  return new Set(
    slots.filter((s) => s.refillAt === null && s.word).map((s) => s.word.toLowerCase()),
  );
}

export function spawnWeight(
  candidate: WordDef,
  state: Pick<GameState, "dataset" | "recentInputs" | "recentSpawns" | "combo" | "comboCategory" | "mode" | "sessionHits">,
  now: number,
  onScreenIds: Set<string>,
  onScreenWordTexts: Set<string>,
  masteryCounts?: Record<string, number>,
): number {
  if (onScreenIds.has(candidate.id)) return 0;
  // 동형어: 같은 표면형이 이미 화면에 있으면 제외
  if (onScreenWordTexts.has(candidate.word.toLowerCase())) return 0;

  const B = candidate.frequency;
  const D = 1 / candidate.difficulty;
  let S = 0;
  for (const id of state.dataset) {
    const w = NEIGHBORS.get(id)?.get(candidate.id) ?? 0;
    if (w > 0) S += w;
  }
  S = Math.min(5, S);

  let C = 0;
  const catBonus = underrepresentedBonus(state.dataset);
  for (const c of candidate.categories) {
    C += (catBonus.get(c) ?? 0) * 1.5;
    if (state.comboCategory === c && state.combo > 0) C += Math.min(3, state.combo * 0.4);
  }

  let R = 0;
  for (const id of state.recentInputs.slice(-10)) {
    const w = NEIGHBORS.get(id)?.get(candidate.id) ?? 0;
    if (w > 0) R += w * 0.8;
  }

  let P = 0;
  if (state.dataset.includes(candidate.id)) P += 4;
  for (const s of state.recentSpawns) {
    if (s.wordId === candidate.id && now - s.at < RECENT_SPAWN_MS) P += 3;
  }

  // 학습 모드: 숙련 완료 제외 + 진행중/신규 가중
  let novelty = 0;
  if (state.mode === "learning" && masteryCounts) {
    const count = masteryCounts[candidate.id] ?? 0;
    const target = masteryTarget(candidate.difficulty);
    if (count >= target) return 0;
    if (count > 0) novelty += 2.5; // 진행 중
    else novelty += 1.2; // 처음 보는 단어
  }

  return Math.max(0, B * D + S + C + R - P + novelty);
}

export function pickWord(
  state: Pick<GameState, "dataset" | "recentInputs" | "recentSpawns" | "combo" | "comboCategory" | "mode" | "sessionHits" | "poolIds" | "slots">,
  onScreenIds: Set<string>,
  now: number,
  rng: () => number,
  masteryCounts?: Record<string, number>,
): WordDef {
  const pool = poolWords(state.poolIds);
  const texts = onScreenTexts(state.slots);
  for (const id of onScreenIds) {
    const w = WORD_BY_ID[id]?.word.toLowerCase();
    if (w) texts.add(w);
  }
  const weights = pool.map((w) => spawnWeight(w, state, now, onScreenIds, texts, masteryCounts));
  const picked = weightedPick(pool, weights, rng);
  if (picked) return picked;
  const free = pool.filter((w) => {
    if (onScreenIds.has(w.id) || texts.has(w.word.toLowerCase())) return false;
    if (state.mode === "learning" && masteryCounts) {
      const count = masteryCounts[w.id] ?? 0;
      if (count >= masteryTarget(w.difficulty)) return false;
    }
    return true;
  });
  if (free.length > 0) return free[Math.floor(rng() * free.length)]!;
  // 숙련 완료는 fallback에서도 절대 재등장하지 않음
  const nonMastered = pool.filter((w) => {
    if (onScreenIds.has(w.id)) return false;
    if (state.mode === "learning" && masteryCounts) {
      return (masteryCounts[w.id] ?? 0) < masteryTarget(w.difficulty);
    }
    return true;
  });
  if (nonMastered.length > 0) {
    return nonMastered[Math.floor(rng() * nonMastered.length)]!;
  }
  // pool 고갈 시: 학습이면 빈 슬롯 방지용으로 미숙련 전역 fallback
  if (state.mode === "learning" && masteryCounts) {
    const global = WORDS.filter(
      (w) =>
        !onScreenIds.has(w.id) &&
        (masteryCounts[w.id] ?? 0) < masteryTarget(w.difficulty),
    );
    if (global.length > 0) return global[Math.floor(rng() * global.length)]!;
  }
  return pool.find((w) => !onScreenIds.has(w.id)) ?? WORDS[0]!;
}

export interface CreateGameOptions {
  seed: number;
  mode?: LabPlayMode;
  poolIds?: string[] | null;
  now?: number;
  masteryCounts?: Record<string, number>;
}

export function createGame(opts: CreateGameOptions | number, nowArg?: number): GameState {
  // 하위호환: createGame(seed, now)
  const options: CreateGameOptions =
    typeof opts === "number" ? { seed: opts, now: nowArg } : opts;
  const seed = options.seed;
  const now = options.now ?? Date.now();
  const mode = options.mode ?? "learning";
  const poolIds = options.poolIds ?? null;
  const masteryCounts = options.masteryCounts;
  const rng = createRng(seed);
  const slots: Slot[] = [];
  const onScreen = new Set<string>();
  const recentSpawns: Array<{ wordId: string; at: number }> = [];

  const draft: GameState = {
    seed,
    mode,
    poolIds,
    baselineMastery: masteryCounts ?? {},
    startedAt: now,
    endsAt: now + SESSION_MS,
    slots,
    dataset: [],
    sessionHits: {},
    recentInputs: [],
    recentSpawns,
    combo: 0,
    comboCategory: null,
    attempts: 0,
    correctAttempts: 0,
    lastAcquired: [],
  };

  for (let i = 0; i < SLOT_COUNT; i++) {
    const word = pickWord(draft, onScreen, now, rng, masteryCounts);
    onScreen.add(word.id);
    recentSpawns.push({ wordId: word.id, at: now });
    slots.push({ id: `slot-${i}`, wordId: word.id, word: word.word, refillAt: null });
  }

  return { ...draft, slots: [...slots], recentSpawns: [...recentSpawns] };
}

export function remainingMs(state: GameState, now: number): number {
  return Math.max(0, state.endsAt - now);
}

export function accuracyPct(state: GameState): number {
  if (state.attempts === 0) return 100;
  return Math.round((state.correctAttempts / state.attempts) * 100);
}

export function graphMetrics(dataset: string[]): {
  density: number;
  coverage: number;
  edges: GraphEdge[];
} {
  const unique = [...new Set(dataset)];
  const n = unique.length;
  const edges: GraphEdge[] = [];
  if (n < 2) {
    const cats = new Set(unique.flatMap((id) => WORD_BY_ID[id]?.categories ?? []));
    return { density: 0, coverage: cats.size / CATEGORIES.length, edges };
  }

  // density용 무방향 unique pairs + 결과 표시용 방향 간선
  const undirected = new Set<string>();
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = unique[i]!;
      const b = unique[j]!;
      const w = NEIGHBORS.get(a)?.get(b);
      if (w && w > 0) {
        undirected.add(`${a}|${b}`);
        // 방향 간선: DIRECTED에서 양쪽 탐색은 game에서 import 없이 NEIGHBORS만 — 타입은 RelatedTo로
        edges.push({
          fromId: a,
          toId: b,
          from: WORD_BY_ID[a]!.word,
          to: WORD_BY_ID[b]!.word,
          type: "RelatedTo",
          weight: w,
        });
      }
    }
  }
  const possible = (n * (n - 1)) / 2;
  const density = possible > 0 ? undirected.size / possible : 0;
  const cats = new Set(unique.flatMap((id) => WORD_BY_ID[id]?.categories ?? []));
  return { density, coverage: cats.size / CATEGORIES.length, edges };
}

export function submitInput(
  state: GameState,
  raw: string,
  now: number,
  _rng: () => number,
): { state: GameState; matched: boolean; wordId: string | null } {
  const typed = raw.trim().toLowerCase();
  if (!typed) return { state, matched: false, wordId: null };

  const attempts = state.attempts + 1;
  const matchIdx = state.slots.findIndex(
    (s) => s.refillAt === null && s.word.toLowerCase() === typed,
  );

  if (matchIdx < 0) {
    return {
      state: { ...state, attempts, combo: 0, comboCategory: null },
      matched: false,
      wordId: null,
    };
  }

  const slot = state.slots[matchIdx]!;
  const word = WORD_BY_ID[slot.wordId]!;
  const sessionHits = {
    ...state.sessionHits,
    [slot.wordId]: (state.sessionHits[slot.wordId] ?? 0) + 1,
  };

  // 학습: 목표 횟수(난이도+2, 3~7) 도달 시에만 dataset(획득)에 편입
  // 경쟁: 정타 1회면 즉시 획득
  let dataset = state.dataset;
  let lastAcquired = state.lastAcquired;
  const already = dataset.includes(slot.wordId);
  if (!already) {
    if (state.mode === "learning") {
      const total =
        (state.baselineMastery[slot.wordId] ?? 0) + sessionHits[slot.wordId]!;
      if (total >= masteryTarget(word.difficulty)) {
        dataset = [...dataset, slot.wordId];
        lastAcquired = [word.word, ...lastAcquired].slice(0, 8);
      }
    } else {
      dataset = [...dataset, slot.wordId];
      lastAcquired = [word.word, ...lastAcquired].slice(0, 8);
    }
  }

  let combo = state.combo;
  let comboCategory = state.comboCategory;
  const primary = word.categories[0] ?? null;
  if (primary && primary === comboCategory) combo += 1;
  else {
    combo = 1;
    comboCategory = primary;
  }

  const slots = state.slots.map((s, i) =>
    i === matchIdx ? { ...s, refillAt: now + REFILL_MS, wordId: "", word: "" } : s,
  );

  return {
    state: {
      ...state,
      attempts,
      correctAttempts: state.correctAttempts + 1,
      dataset,
      sessionHits,
      recentInputs: [...state.recentInputs, slot.wordId].slice(-10),
      combo,
      comboCategory,
      slots,
      lastAcquired,
    },
    matched: true,
    wordId: slot.wordId,
  };
}

export function refillSlots(
  state: GameState,
  now: number,
  rng: () => number,
  masteryCounts?: Record<string, number>,
): GameState {
  const onScreen = new Set(
    state.slots.filter((s) => s.refillAt === null && s.wordId).map((s) => s.wordId),
  );
  let changed = false;
  const recentSpawns = [...state.recentSpawns];
  const slots = state.slots.map((s) => {
    if (s.refillAt === null || s.refillAt > now) return s;
    const word = pickWord({ ...state, slots: state.slots }, onScreen, now, rng, masteryCounts);
    onScreen.add(word.id);
    recentSpawns.push({ wordId: word.id, at: now });
    changed = true;
    return { ...s, wordId: word.id, word: word.word, refillAt: null };
  });
  if (!changed) return state;
  return {
    ...state,
    slots,
    recentSpawns: recentSpawns.filter((s) => now - s.at < RECENT_SPAWN_MS * 2),
  };
}

function matchesTypes(word: WordDef, types: SemanticType[] | null | undefined): boolean {
  if (!types || types.length === 0) return true;
  return sharesSemantic(word, types);
}

function renderNP(word: WordDef, withArticle: boolean): string {
  if (!withArticle) return word.word;
  const art = articleFor(word);
  return art ? `${art} ${word.word}` : word.word;
}

export function tryBuildSentence(
  dataset: string[],
  templateId: string,
  rng: () => number,
): GeneratedSentence | null {
  const words = dataset.map((id) => WORD_BY_ID[id]).filter(Boolean) as WordDef[];
  const verbs = words.filter((w) => w.pos === "verb" && w.frame);
  const nouns = words.filter((w) => w.pos === "noun");
  const adjs = words.filter((w) => w.pos === "adj");

  if (templateId === "adj_noun") {
    if (adjs.length === 0 || nouns.length === 0) return null;
    const shuffledAdj = [...adjs].sort(() => rng() - 0.5);
    for (const adj of shuffledAdj) {
      const cands = nouns.filter(
        (n) =>
          matchesTypes(n, adj.semanticTypes) &&
          hasDirected(adj.id, n.id, "Describes"),
      );
      if (cands.length === 0) continue;
      const noun = cands[Math.floor(rng() * cands.length)]!;
      const art = articleFor(noun);
      const text = art ? `${art} ${adj.word} ${noun.word}` : `${adj.word} ${noun.word}`;
      return { text, templateId, valid: true, score: 5 };
    }
    return null;
  }

  if (verbs.length === 0) return null;
  const verb = verbs[Math.floor(rng() * verbs.length)]!;
  const frame = verb.frame!;
  const subjects = nouns.filter(
    (n) =>
      matchesTypes(n, frame.subjects) &&
      hasDirected(n.id, verb.id, "CapableOf"),
  );
  if (subjects.length === 0) return null;
  const subject = subjects[Math.floor(rng() * subjects.length)]!;
  const vForm = verbForm(verb, subject);

  if (templateId === "sv") {
    return {
      text: `the ${subject.word} ${vForm}`,
      templateId,
      valid: true,
      score: 6,
    };
  }

  if (templateId === "sv_loc") {
    const locs = frame.locations;
    if (!locs || locs.length === 0) return null;
    const places = nouns.filter(
      (n) =>
        n.id !== subject.id &&
        matchesTypes(n, locs) &&
        hasDirected(subject.id, n.id, "AtLocation"),
    );
    if (places.length === 0) return null;
    const place = places[Math.floor(rng() * places.length)]!;
    // in/at: place nouns use "in the" for open places, "at the" for buildings — simple heuristic
    const prep = ["park", "forest", "ocean", "river", "lake", "garden", "field", "pool", "beach"].includes(place.word)
      ? "in"
      : "at";
    return {
      text: `the ${subject.word} ${vForm} ${prep} the ${place.word}`,
      templateId,
      valid: true,
      score: 9,
    };
  }

  if (templateId === "svo") {
    const objs = frame.objects;
    if (!objs || objs.length === 0) return null;
    const objects = nouns.filter(
      (n) =>
        n.id !== subject.id &&
        matchesTypes(n, objs) &&
        hasDirected(verb.id, n.id, "ActsOn"),
    );
    if (objects.length === 0) return null;
    const object = objects[Math.floor(rng() * objects.length)]!;
    const objPhrase = renderNP(object, true);
    return {
      text: `the ${subject.word} ${vForm} ${objPhrase}`.replace(/  +/g, " ").trim(),
      templateId,
      valid: true,
      score: 10,
    };
  }

  return null;
}

export function generateSentences(
  dataset: string[],
  rng: () => number,
  maxAttempts = MAX_SENTENCE_ATTEMPTS,
): { sentences: GeneratedSentence[]; attempts: number; successRate: number } {
  if (dataset.length === 0) {
    return { sentences: [], attempts: 0, successRate: 0 };
  }

  const hasVerb = dataset.some((id) => WORD_BY_ID[id]?.pos === "verb");
  const pool = hasVerb
    ? TEMPLATES
    : TEMPLATES.filter((t) => t.kind === "adj_noun");

  const sentences: GeneratedSentence[] = [];
  const seen = new Set<string>();
  let attempts = 0;
  let successes = 0;

  while (attempts < maxAttempts && sentences.length < 12) {
    attempts += 1;
    const template = pool[Math.floor(rng() * pool.length)]!;
    const built = tryBuildSentence(dataset, template.id, rng);
    if (!built) continue;
    if (seen.has(built.text)) continue;
    // 최종 검증: eat+park 같은 잔여 비문 차단
    if (!validateSentenceText(built, dataset)) continue;
    seen.add(built.text);
    successes += 1;
    sentences.push(built);
  }

  return {
    sentences,
    attempts,
    successRate: attempts > 0 ? successes / attempts : 0,
  };
}

/** 생성 문장 사후 검증 (회귀 테스트용 export) */
export function validateSentenceText(s: GeneratedSentence, dataset: string[]): boolean {
  // tryBuildSentence가 이미 제약을 통과했으므로 true.
  // 추가 안전망: Dataset에 없는 content word가 끼지 않았는지 확인
  const ids = new Set(dataset);
  const known = new Set(
    [...ids].map((id) => WORD_BY_ID[id]?.word.toLowerCase()).filter(Boolean) as string[],
  );
  const grammar = new Set(["the", "a", "an", "in", "at", "on", "to", "of"]);
  const tokens = s.text.toLowerCase().split(/\s+/);
  for (const tok of tokens) {
    if (grammar.has(tok)) continue;
    // 동사 활용형: forms.thirdPersonSingular 허용
    const matchBase = [...ids].some((id) => {
      const w = WORD_BY_ID[id]!;
      return (
        w.word.toLowerCase() === tok ||
        w.forms?.thirdPersonSingular?.toLowerCase() === tok ||
        w.forms?.plural?.toLowerCase() === tok
      );
    });
    if (!matchBase && !known.has(tok)) return false;
  }
  return true;
}

export function gradeFromTotal(total: number): Grade {
  if (total >= 95) return "SSS";
  if (total >= 90) return "SS";
  if (total >= 80) return "S";
  if (total >= 70) return "A";
  if (total >= 60) return "B";
  if (total >= 50) return "C";
  return "D";
}

export function computeScore(args: {
  accuracy: number;
  datasetSize: number;
  density: number;
  coverage: number;
  inference: number;
  /** 경쟁: 개인 풀 크기 기준 정규화. 없으면 40단어=100 */
  poolSize?: number;
}): ScoreBreakdown {
  const denom = Math.max(10, args.poolSize ?? 40);
  const datasetScore = Math.min(100, (args.datasetSize / denom) * 100);
  const densityScore = Math.min(100, args.density * 100);
  const coverageScore = Math.min(100, args.coverage * 100);
  const inferenceScore = Math.min(100, args.inference * 100);
  const accuracyScore = Math.min(100, args.accuracy);

  const total =
    accuracyScore * 0.2 +
    datasetScore * 0.2 +
    densityScore * 0.25 +
    coverageScore * 0.15 +
    inferenceScore * 0.2;

  const rounded = Math.round(total * 10) / 10;
  return {
    accuracy: Math.round(accuracyScore * 10) / 10,
    dataset: Math.round(datasetScore * 10) / 10,
    density: Math.round(densityScore * 10) / 10,
    coverage: Math.round(coverageScore * 10) / 10,
    inference: Math.round(inferenceScore * 10) / 10,
    total: rounded,
    grade: gradeFromTotal(rounded),
  };
}

export function finishSession(state: GameState, now = Date.now()): SessionResult {
  const accuracy = accuracyPct(state);
  const poolSize = state.poolIds?.length ?? 40;
  const elapsedMs = Math.min(SESSION_MS, now - state.startedAt);

  // 학습 모드: 문장·그래프 생략, 획득 단어만
  if (state.mode === "learning") {
    const score = computeScore({
      accuracy,
      datasetSize: state.dataset.length,
      density: 0,
      coverage: 0,
      inference: 0,
    });
    return {
      mode: state.mode,
      dataset: state.dataset,
      datasetWords: state.dataset.map((id) => WORD_BY_ID[id]!.word),
      sessionHits: state.sessionHits,
      edges: [],
      density: 0,
      coverage: 0,
      accuracy,
      comboPeak: state.combo,
      sentences: [],
      inferenceSuccess: 0,
      score,
      elapsedMs,
      poolSize,
    };
  }

  const rng = createRng(state.seed ^ 0x9e3779b9);
  const { density, coverage, edges: undirectedEdges } = graphMetrics(state.dataset);
  const edgeList: GraphEdge[] = [];
  const set = new Set(state.dataset);
  for (const from of state.dataset) {
    for (const e of DIRECTED.get(from) ?? []) {
      if (!set.has(e.to)) continue;
      edgeList.push({
        fromId: from,
        toId: e.to,
        from: WORD_BY_ID[from]!.word,
        to: WORD_BY_ID[e.to]!.word,
        type: e.type,
        weight: e.weight,
      });
    }
  }
  const edges = edgeList.length > 0 ? edgeList : undirectedEdges;
  const { sentences, successRate } = generateSentences(state.dataset, rng);
  const score = computeScore({
    accuracy,
    datasetSize: state.dataset.length,
    density,
    coverage,
    inference: successRate,
    poolSize,
  });

  return {
    mode: state.mode,
    dataset: state.dataset,
    datasetWords: state.dataset.map((id) => WORD_BY_ID[id]!.word),
    sessionHits: state.sessionHits,
    edges,
    density,
    coverage,
    accuracy,
    comboPeak: state.combo,
    sentences,
    inferenceSuccess: successRate,
    score,
    elapsedMs,
    poolSize,
  };
}

export { masteryTarget };
