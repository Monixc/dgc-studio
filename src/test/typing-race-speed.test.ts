import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TypingSession } from "@tajarace/core";
import { createContentProvider } from "@tajarace/content";
import {
  createRealtimeRaceController,
  DEFAULT_RACE_LAPS,
  RACE_DISTANCE_CHARS,
  rankParticipants,
  type RaceParticipant,
} from "@tajarace/racing";
import { createMemoryStorageAdapter } from "@tajarace/storage";
import { SmoothProgressTracker } from "@/vendor/tajarace/racing/smooth-progress";

describe("SmoothProgressTracker race speed", () => {
  const text = "the quick brown fox jumps over the lazy dog while typing fast improves accuracy and speed";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function simulate(mode: "correct" | "typo") {
    const session = new TypingSession({ text });
    const smooth = new SmoothProgressTracker();
    let lastKeyCorrect: boolean | null = null;
    session.start();
    smooth.reset();
    session.subscribe((event) => {
      if (event.type !== "keystroke") return;
      lastKeyCorrect = event.correct;
      if (event.correct) {
        const stats = session.getStats();
        const instantWpm = stats.elapsedMs > 0
          ? stats.wpm
          : Math.round((stats.correctChars / 5) / (50 / 60000));
        smooth.setTargetFromWpm(Math.max(stats.wpm, instantWpm));
      } else {
        smooth.applyPenalty();
      }
    });

    let cursor = 0;
    for (let t = 0; t < 3000; t += 50) {
      vi.setSystemTime(Date.now() + 50);
      if (t % 150 === 0 && cursor < 24) {
        // avoid accidental correct 'x' matches in fox/text during typo mode
        session.handleInput(mode === "correct" ? text[cursor]! : "#");
        cursor += 1;
      }
      const stats = session.getStats();
      if (lastKeyCorrect && stats.wpm > 0) smooth.setTargetFromWpm(stats.wpm);
      smooth.tick(50, text.length);
    }
    return { progress: smooth.getProgress(), speed: smooth.getSpeed() };
  }

  it("moves faster with correct typing than with typos", () => {
    const correct = simulate("correct");
    const typo = simulate("typo");
    expect(correct.progress).toBeGreaterThan(typo.progress * 1.5);
    expect(correct.speed).toBeGreaterThan(typo.speed);
  });

  it("builds a rolling snippet stream independent of race distance", () => {
    const content = createContentProvider([{
      id: "race",
      category: "english",
      title: "Race",
      text: "abc",
      difficulty: "easy",
    }]);
    const controller = createRealtimeRaceController({
      contentProvider: content,
      storage: createMemoryStorageAdapter(),
      myId: "me",
      myName: "나",
    });

    expect(DEFAULT_RACE_LAPS).toBe(3);
    expect(controller.getState().text.startsWith("abc abc abc")).toBe(true);
    expect(controller.getState().text.length).toBeGreaterThan(RACE_DISTANCE_CHARS);
    expect(controller.getState().snippetEnds.slice(0, 3)).toEqual([3, 7, 11]);
    controller.destroy();
  });

  it("waits for the active snippet after every racer reaches the finish line", () => {
    const controller = createRealtimeRaceController({
      contentProvider: createContentProvider([{
        id: "race",
        category: "english",
        title: "Race",
        text: "abc",
        difficulty: "easy",
      }]),
      storage: createMemoryStorageAdapter(),
      myId: "me",
      myName: "나",
    });

    controller.joinLobby();
    controller.setReady(true);
    controller.startRace();
    vi.advanceTimersByTime(3_000);
    vi.advanceTimersByTime(181_000);
    expect(controller.getState().status).toBe("racing");

    controller.handleInput("a");
    controller.handleInput("b");
    expect(controller.getState().status).toBe("racing");
    controller.handleInput("c");
    expect(controller.getState().status).toBe("finished");
    controller.destroy();
  });

  it("ranks finished racers by their actual finish time", () => {
    const racer = (id: string, finishedAt: number): RaceParticipant => ({
      id,
      name: id,
      progress: 1,
      wpm: 60,
      speed: 0.5,
      rank: 0,
      isReady: true,
      isFinished: true,
      finishedAt,
    });

    const ranked = rankParticipants([
      racer("me", 9_000),
      racer("bot-1", 7_000),
      racer("bot-2", 8_000),
    ]);
    expect(ranked.map(({ id, rank }) => [id, rank])).toEqual([
      ["bot-1", 1],
      ["bot-2", 2],
      ["me", 3],
    ]);
  });
});
