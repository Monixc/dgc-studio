import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  WORDS,
  articleFor,
  hasDirected,
  hydrateLexicon,
  masteryTarget,
  verbForm,
  WORD_BY_ID,
  type RelationDef,
  type WordDef,
} from "@/features/typing-ai-lab/content";
import {
  learningPoolIds,
  unlockedBand,
  UNLOCK_ABS,
  UNLOCK_RATIO,
} from "@/features/typing-ai-lab/progression";
import { filterCatalogWords } from "@/features/typing-ai-lab/LexiconCatalog";
import {
  computeScore,
  createGame,
  createRng,
  finishSession,
  generateSentences,
  gradeFromTotal,
  graphMetrics,
  pickWord,
  refillSlots,
  spawnWeight,
  submitInput,
  tryBuildSentence,
} from "@/features/typing-ai-lab/game";

function loadPublicLexicon(maxDifficulty = 5) {
  const root = resolve(process.cwd(), "public/typing-ai-lab");
  const words: WordDef[] = [];
  const relations: RelationDef[] = [];
  for (let d = 1; d <= maxDifficulty; d++) {
    words.push(
      ...JSON.parse(readFileSync(resolve(root, `words-d${d}.json`), "utf8")),
    );
    relations.push(
      ...JSON.parse(readFileSync(resolve(root, `relations-d${d}.json`), "utf8")),
    );
  }
  hydrateLexicon(words, relations);
}

beforeAll(() => {
  loadPublicLexicon(5);
});

describe("lexicon dataset", () => {
  it("has 5000+ unique surfaces with required fields", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), "public/typing-ai-lab/manifest.json"), "utf8"),
    );
    expect(manifest.wordCount).toBeGreaterThanOrEqual(5000);
    expect(WORDS.length).toBeGreaterThanOrEqual(5000);
    const surfaces = new Set(WORDS.map((w) => w.word));
    expect(surfaces.size).toBeGreaterThanOrEqual(5000);
    for (const w of WORDS.slice(0, 200)) {
      expect(w.id && w.word && w.meaningKo).toBeTruthy();
      expect(w.pos).toMatch(/^(noun|verb|adj)$/);
      expect(w.difficulty).toBeGreaterThanOrEqual(1);
      expect(w.difficulty).toBeLessThanOrEqual(5);
    }
    expect(WORD_BY_ID.eat?.frame).toBeTruthy();
  });

  it("contains clean Korean dictionary forms", () => {
    for (const word of WORDS) {
      expect(word.meaningKo).toMatch(/[가-힣]/);
      expect(word.meaningKo).not.toMatch(/[A-Za-z0-9[\]{}()<>/^~…]/);
      if (word.pos === "verb") expect(word.meaningKo.endsWith("다")).toBe(true);
    }
    expect(WORD_BY_ID.know?.meaningKo).toBe("알다");
    expect(WORD_BY_ID.want?.meaningKo).toBe("원하다");
    expect(WORD_BY_ID.green?.meaningKo).toBe("초록색");
    expect(WORD_BY_ID.fire?.meaningKo).toBe("불");
  });

  it("keeps 1400+ verbs with coverage in every difficulty band", () => {
    const verbs = WORDS.filter((word) => word.pos === "verb");
    expect(verbs.length).toBeGreaterThanOrEqual(1400);
    for (let difficulty = 1; difficulty <= 5; difficulty++) {
      expect(
        verbs.filter((word) => word.difficulty === difficulty).length,
      ).toBeGreaterThanOrEqual(200);
    }
  });

  it("keeps verified biological names", () => {
    expect(WORD_BY_ID.amberjack?.meaningKo).toBe("잿방어");
    expect(WORD_BY_ID.tuna?.meaningKo).toBe("참치");
    expect(WORD_BY_ID.seal?.meaningKo).toBe("물범");
    expect(WORD_BY_ID.coral?.meaningKo).toBe("산호");
    expect(WORD_BY_ID.bass?.meaningKo).toBe("농어");
    expect(WORD_BY_ID.salmon?.meaningKo).toBe("연어");
  });
});

describe("progression unlock", () => {
  it("starts new users at band 1", () => {
    expect(unlockedBand({})).toBe(1);
  });

  it("unlocks the next band after absolute or ratio mastery", () => {
    const band1 = WORDS.filter((w) => w.difficulty === 1);
    expect(band1.length).toBeGreaterThan(0);
    const need = Math.min(UNLOCK_ABS, Math.ceil(band1.length * UNLOCK_RATIO));
    const mastery: Record<string, number> = {};
    for (const w of band1.slice(0, need)) {
      mastery[w.id] = masteryTarget(w.difficulty);
    }
    expect(unlockedBand(mastery)).toBeGreaterThanOrEqual(2);
  });

  it("excludes mastered words from the learning pool", () => {
    const sample = WORDS.filter((w) => w.difficulty === 1).slice(0, 10);
    const mastery: Record<string, number> = {};
    for (const w of sample.slice(0, 5)) {
      mastery[w.id] = masteryTarget(w.difficulty);
    }
    const pool = new Set(learningPoolIds(mastery));
    for (const w of sample.slice(0, 5)) expect(pool.has(w.id)).toBe(false);
    for (const w of sample.slice(5)) expect(pool.has(w.id)).toBe(true);
    expect([...pool].every((id) => (WORD_BY_ID[id]?.difficulty ?? 99) <= 1)).toBe(true);
  });
});

describe("lexicon catalog filters", () => {
  it("filters acquired, mastered, difficulty, and search", () => {
    const sample = WORDS.filter((word) => word.difficulty === 1).slice(0, 3);
    const mastery = {
      [sample[0]!.id]: 1,
      [sample[1]!.id]: masteryTarget(sample[1]!.difficulty),
    };
    const base = { query: "", difficulty: null, pos: null };
    expect(
      filterCatalogWords(sample, mastery, { ...base, status: "acquired" }),
    ).toHaveLength(2);
    expect(
      filterCatalogWords(sample, mastery, { ...base, status: "mastered" }),
    ).toEqual([sample[1]]);
    expect(
      filterCatalogWords(sample, mastery, { ...base, status: "unacquired" }),
    ).toEqual([sample[2]]);
    expect(
      filterCatalogWords(sample, mastery, {
        ...base,
        query: sample[0]!.meaningKo,
        status: "all",
      }),
    ).toContain(sample[0]);
  });
});

describe("typing-ai-lab spawn", () => {
  it("reproduces the same initial board for the same seed", () => {
    const a = createGame({ seed: 42, now: 1_000_000 });
    const b = createGame({ seed: 42, now: 1_000_000 });
    expect(a.slots.map((s) => s.wordId)).toEqual(b.slots.map((s) => s.wordId));
    expect(a.slots).toHaveLength(25);
  });

  it("penalizes words already on screen and in dataset", () => {
    const now = 1_000_000;
    const state = {
      dataset: ["teacher"],
      recentInputs: ["teacher"],
      recentSpawns: [{ wordId: "student", at: now }],
      combo: 2,
      comboCategory: "human" as const,
      mode: "learning" as const,
      sessionHits: {},
    };
    const onScreen = new Set(["teacher"]);
    const texts = new Set(["teacher"]);
    const teacher = WORDS.find((w) => w.id === "teacher")!;
    const student = WORDS.find((w) => w.id === "student")!;
    expect(spawnWeight(teacher, state, now, onScreen, texts)).toBe(0);
    expect(spawnWeight(student, state, now, onScreen, texts)).toBeLessThan(
      spawnWeight(student, { ...state, recentSpawns: [] }, now, onScreen, texts),
    );
  });

  it("pickWord never returns an on-screen id when alternatives exist", () => {
    const rng = createRng(7);
    const pool = WORDS.slice(0, 80);
    const onScreen = new Set(pool.slice(0, pool.length - 5).map((w) => w.id));
    const state = createGame({
      seed: 1,
      now: 0,
      poolIds: pool.map((w) => w.id),
    });
    state.slots = [];
    for (let i = 0; i < 20; i++) {
      const w = pickWord(state, onScreen, 0, rng);
      expect(onScreen.has(w.id)).toBe(false);
    }
  });

  it("does not place two slots with the same surface form", () => {
    const game = createGame({ seed: 99, now: 1 });
    const texts = game.slots.map((s) => s.word.toLowerCase());
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("excludes mastered words from learning spawn and fallback", () => {
    const now = 1_000_000;
    const pool = WORDS.filter((w) => w.difficulty === 1).slice(0, 40);
    const mastery: Record<string, number> = {};
    for (const w of pool.slice(0, 35)) {
      mastery[w.id] = masteryTarget(w.difficulty);
    }
    const state = createGame({
      seed: 3,
      now,
      mode: "learning",
      poolIds: pool.map((w) => w.id),
      masteryCounts: mastery,
    });
    for (const slot of state.slots) {
      expect(mastery[slot.wordId] ?? 0).toBeLessThan(
        masteryTarget(WORD_BY_ID[slot.wordId]!.difficulty),
      );
    }
    const teacher = WORDS.find((w) => w.id === "teacher")!;
    const target = masteryTarget(teacher.difficulty);
    expect(
      spawnWeight(
        teacher,
        {
          dataset: [],
          recentInputs: [],
          recentSpawns: [],
          combo: 0,
          comboCategory: null,
          mode: "learning",
          sessionHits: {},
        },
        now,
        new Set(),
        new Set(),
        { teacher: target },
      ),
    ).toBe(0);
  });

  it("avoids pool exhaustion when most words are mastered", () => {
    const pool = WORDS.filter((w) => w.difficulty === 1).slice(0, 30);
    const mastery: Record<string, number> = {};
    for (const w of pool.slice(0, 28)) {
      mastery[w.id] = masteryTarget(w.difficulty);
    }
    const game = createGame({
      seed: 17,
      now: 1,
      mode: "learning",
      poolIds: pool.map((w) => w.id),
      masteryCounts: mastery,
    });
    expect(game.slots).toHaveLength(25);
    for (const slot of game.slots) {
      const def = WORD_BY_ID[slot.wordId]!;
      expect(mastery[slot.wordId] ?? 0).toBeLessThan(masteryTarget(def.difficulty));
    }
  });
});

describe("typing-ai-lab input + graph", () => {
  it("adds unique words to dataset and refills after delay", () => {
    const now = 2_000_000;
    const initial = createGame({ seed: 99, now, mode: "competition" });
    const target = initial.slots[0]!;
    const rng = createRng(99);

    const miss = submitInput(initial, "zzzz-not-a-word", now, rng);
    expect(miss.matched).toBe(false);
    expect(miss.state.dataset).toHaveLength(0);

    const hit = submitInput(miss.state, target.word, now, rng);
    expect(hit.matched).toBe(true);
    expect(hit.state.dataset).toContain(target.wordId);
    expect(hit.state.sessionHits[target.wordId]).toBe(1);
    expect(hit.state.slots[0]!.refillAt).toBe(now + 500);

    const filled = refillSlots(hit.state, now + 500, rng);
    expect(filled.slots[0]!.refillAt).toBeNull();
    expect(filled.slots[0]!.word.length).toBeGreaterThan(0);
  });

  it("learning mode acquires only after mastery target hits", () => {
    const now = 4_000_000;
    let state = createGame({ seed: 5, now, mode: "learning", masteryCounts: {} });
    const slot = state.slots[0]!;
    const word = WORD_BY_ID[slot.wordId]!;
    const need = masteryTarget(word.difficulty);
    const rng = createRng(5);

    for (let i = 0; i < need - 1; i++) {
      state = {
        ...state,
        slots: state.slots.map((s, idx) =>
          idx === 0 ? { ...s, wordId: slot.wordId, word: slot.word, refillAt: null } : s,
        ),
      };
      const r = submitInput(state, slot.word, now + i, rng);
      state = r.state;
      expect(state.dataset.includes(slot.wordId)).toBe(false);
      expect(state.sessionHits[slot.wordId]).toBe(i + 1);
    }

    state = {
      ...state,
      slots: state.slots.map((s, idx) =>
        idx === 0 ? { ...s, wordId: slot.wordId, word: slot.word, refillAt: null } : s,
      ),
    };
    const finalHit = submitInput(state, slot.word, now + need, rng);
    expect(finalHit.state.sessionHits[slot.wordId]).toBe(need);
    expect(finalHit.state.dataset).toContain(slot.wordId);
  });

  it("computes density and coverage from relations", () => {
    const linked = graphMetrics(["teacher", "student", "school"]);
    expect(linked.edges.length).toBeGreaterThan(0);
    expect(linked.density).toBeGreaterThan(0);
    expect(linked.coverage).toBeGreaterThan(0);
  });
});

describe("typing-ai-lab sentences", () => {
  it("rejects eat + park and allows eat + apple", () => {
    expect(hasDirected("eat", "park", "ActsOn")).toBe(false);
    expect(hasDirected("eat", "apple", "ActsOn")).toBe(true);
    expect(hasDirected("child", "park", "AtLocation")).toBe(true);

    const bad = tryBuildSentence(["child", "eat", "park"], "svo", createRng(1));
    expect(bad).toBeNull();

    const good = tryBuildSentence(["child", "eat", "apple"], "svo", createRng(1));
    expect(good).not.toBeNull();
    expect(good!.text).toMatch(/eats/);
    expect(good!.text).toMatch(/apple/);
    expect(good!.text).not.toMatch(/park/);
  });

  it("requires verb from dataset and uses a/an correctly", () => {
    expect(articleFor(WORD_BY_ID.apple!)).toBe("an");
    expect(articleFor(WORD_BY_ID.park!)).toBe("a");
    expect(articleFor(WORD_BY_ID.water!)).toBe("");
    expect(verbForm(WORD_BY_ID.eat!, WORD_BY_ID.child!)).toBe("eats");

    const noVerb = generateSentences(["teacher", "student", "school", "smart"], createRng(5), 40);
    for (const s of noVerb.sentences) {
      expect(s.templateId).toBe("adj_noun");
    }
  });

  it("does not use AtLocation as object justification for SVO", () => {
    const s = tryBuildSentence(["child", "eat", "park", "run"], "svo", createRng(3));
    expect(s).toBeNull();
  });

  it("generates valid sentences from a related dataset", () => {
    const { sentences, attempts, successRate } = generateSentences(
      ["teacher", "student", "book", "school", "read", "teach", "library", "learn"],
      createRng(123),
      40,
    );
    expect(attempts).toBeGreaterThan(0);
    expect(successRate).toBeGreaterThan(0);
    expect(sentences.length).toBeGreaterThan(0);
    for (const s of sentences) {
      expect(s.text).not.toMatch(/eats (a|an) park/);
      expect(s.valid).toBe(true);
    }
  });

  it("returns empty generation for empty dataset", () => {
    const out = generateSentences([], createRng(1));
    expect(out.sentences).toHaveLength(0);
  });
});

describe("typing-ai-lab score + mastery", () => {
  it("scores and grades with PRD weights", () => {
    const score = computeScore({
      accuracy: 100,
      datasetSize: 40,
      density: 1,
      coverage: 1,
      inference: 1,
    });
    expect(score.total).toBe(100);
    expect(score.grade).toBe("SSS");
    expect(gradeFromTotal(85)).toBe("S");
  });

  it("normalizes dataset score by pool size in competition", () => {
    const a = computeScore({ accuracy: 100, datasetSize: 10, density: 0, coverage: 0, inference: 0, poolSize: 20 });
    const b = computeScore({ accuracy: 100, datasetSize: 10, density: 0, coverage: 0, inference: 0, poolSize: 40 });
    expect(a.dataset).toBeGreaterThan(b.dataset);
  });

  it("uses adaptive mastery targets 3~7", () => {
    expect(masteryTarget(1)).toBe(3);
    expect(masteryTarget(3)).toBe(5);
    expect(masteryTarget(5)).toBe(7);
  });

  it("finishes a short session into a report", () => {
    let state = createGame({ seed: 11, now: 3_000_000, mode: "competition" });
    const rng = createRng(11);
    for (const slot of state.slots.slice(0, 5)) {
      const r = submitInput(state, slot.word, 3_000_000, rng);
      state = r.state;
    }
    const report = finishSession(state, 3_000_000 + 10_000);
    expect(report.dataset.length).toBeGreaterThan(0);
    expect(report.edges.every((e) => e.fromId && e.toId)).toBe(true);
    expect(report.elapsedMs).toBe(10_000);
  });
});
