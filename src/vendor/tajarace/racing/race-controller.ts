import { TypingSession, type TypingEvent, type TypingStats } from '@tajarace/core';
import type { ContentProvider } from '@tajarace/content';
import {
  calculateRacePoints,
  type KeystrokeSnapshot,
  type StorageAdapter,
  type TypingRecord,
} from '@tajarace/storage';
import { SmoothProgressTracker } from './smooth-progress.js';
import {
  RACE_DISTANCE_CHARS,
  interpolateGhostProgress,
  rankParticipants,
  updateParticipantFromStats,
  type RaceEvent,
  type RaceEventListener,
  type RaceParticipant,
  type RaceState,
} from './types.js';

const RACE_TICK_MS = 50;
const RACE_SNIPPET_BUFFER = 100;

function buildSnippetStream(texts: string[]): { text: string; snippetEnds: number[] } {
  const snippets = Array.from(
    { length: RACE_SNIPPET_BUFFER },
    (_, index) => texts[index % texts.length]!,
  );
  const snippetEnds: number[] = [];
  let cursor = 0;
  for (const snippet of snippets) {
    cursor += snippet.length;
    snippetEnds.push(cursor);
    cursor += 1;
  }
  return { text: snippets.join(' '), snippetEnds };
}

export interface RealtimeRaceOptions {
  contentProvider: ContentProvider;
  storage: StorageAdapter;
  myId: string;
  myName: string;
  /** AI/봇 참가자 (데모용) */
  botParticipants?: Array<{ id: string; name: string; targetWpm: number }>;
}

export interface RealtimeRaceController {
  getState(): RaceState;
  getSession(): TypingSession | null;
  joinLobby(): void;
  setReady(ready: boolean): void;
  startRace(): void;
  handleInput(char: string): void;
  handleBackspace(): void;
  subscribe(listener: RaceEventListener): () => void;
  destroy(): void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createRealtimeRaceController(
  options: RealtimeRaceOptions,
): RealtimeRaceController {
  const { contentProvider, storage, myId, myName, botParticipants = [] } = options;

  const content = contentProvider.getRandom('english');
  const pool = contentProvider.getByCategory('english');
  const startIndex = Math.max(0, pool.findIndex((item) => item.id === content.id));
  const orderedTexts = [...pool.slice(startIndex), ...pool.slice(0, startIndex)].map((item) => item.text);
  const { text: raceText, snippetEnds } = buildSnippetStream(orderedTexts);
  let session: TypingSession | null = null;
  let countdownTimer: ReturnType<typeof setInterval> | null = null;
  let raceTimer: ReturnType<typeof setInterval> | null = null;
  let raceElapsedMs = 0;
  let lastKeyCorrect: boolean | null = null;
  let raceComplete = false;
  const smoothProgress = new SmoothProgressTracker();
  const listeners = new Set<RaceEventListener>();

  const bots: Array<{
    id: string;
    name: string;
    targetWpm: number;
    progress: number;
    wpm: number;
    isFinished: boolean;
    elapsedMs: number;
    finishedAt?: number;
  }> = botParticipants.map((b) => ({
    ...b,
    progress: 0,
    wpm: 0,
    isFinished: false,
    elapsedMs: 0,
  }));

  let state: RaceState = {
    mode: 'realtime',
    status: 'waiting',
    text: raceText,
    snippetEnds,
    contentId: content.id,
    participants: [
      { id: myId, name: myName, progress: 0, wpm: 0, speed: 0, rank: 1, isReady: false, isFinished: false },
      ...bots.map((b, i) => ({
        id: b.id,
        name: b.name,
        progress: 0,
        wpm: 0,
        speed: 0,
        rank: i + 2,
        isReady: true,
        isFinished: false,
      })),
    ],
    countdown: 3,
    myParticipantId: myId,
    winnerId: null,
  };

  function emit(event: RaceEvent): void {
    for (const listener of listeners) {
      listener(event);
    }
  }

  function emitLobbyUpdate(): void {
    emit({ type: 'lobby-update', state });
  }

  function buildParticipants(myStats?: TypingStats): RaceParticipant[] {
    const myP = state.participants.find((p) => p.id === myId)!;
    const updatedFromStats = myStats
      ? {
          ...updateParticipantFromStats(myP, myStats, smoothProgress.getProgress()),
          speed: smoothProgress.getSpeed(),
        }
      : myP;
    const updatedMy = {
      ...updatedFromStats,
      finishedAt: myP.finishedAt ??
        (updatedFromStats.isFinished ? raceElapsedMs : undefined),
    };

    const botPs: RaceParticipant[] = bots.map((b) => ({
      id: b.id,
      name: b.name,
      progress: b.progress,
      wpm: b.wpm,
      speed: b.wpm / 120,
      rank: 0,
      isReady: true,
      isFinished: b.isFinished,
      finishedAt: b.finishedAt,
    }));

    return rankParticipants([updatedMy, ...botPs]);
  }

  function bindSessionEvents(): void {
    session!.subscribe((event: TypingEvent) => {
      if (event.type === 'keystroke') {
        lastKeyCorrect = event.correct;
        if (event.correct) {
          // elapsedMs가 0이면 WPM=0이 되어 속도가 최저에 고정됨 → 즉시 페이스도 반영
          const stats = session!.getStats();
          const instantWpm = stats.elapsedMs > 0
            ? stats.wpm
            : Math.round((stats.correctChars / 5) / (RACE_TICK_MS / 60000));
          smoothProgress.setTargetFromWpm(Math.max(stats.wpm, instantWpm));
        } else {
          smoothProgress.applyPenalty();
        }
      } else if (event.type === 'backspace') {
        lastKeyCorrect = false;
        smoothProgress.applyPenalty();
      } else if (event.type === 'finish') {
        if (raceComplete) finishRace(state.participants);
      }
    });
  }

  function tickRace(): void {
    if (state.status !== 'racing') return;

    raceElapsedMs += RACE_TICK_MS;

    for (const bot of bots) {
      if (bot.isFinished) continue;
      bot.elapsedMs += RACE_TICK_MS;
      const charsPerMin = bot.targetWpm * 5;
      const charsPerMs = charsPerMin / 60000;
      const charAdvance = charsPerMs * RACE_TICK_MS;
      bot.progress = Math.min(1, bot.progress + charAdvance / RACE_DISTANCE_CHARS);
      bot.wpm = bot.targetWpm + Math.sin(bot.elapsedMs / 500) * 5;
      if (bot.progress >= 1) {
        bot.isFinished = true;
        bot.finishedAt ??= bot.elapsedMs;
      }
    }

    const stats = session?.getStats();
    // 정타 중에는 매 틱 평균 WPM을 추적. 오타 후에는 다음 정타까지 최저속 유지.
    if (lastKeyCorrect && stats && stats.wpm > 0) {
      smoothProgress.setTargetFromWpm(stats.wpm);
    }
    smoothProgress.tick(RACE_TICK_MS, RACE_DISTANCE_CHARS);

    const participants = buildParticipants(stats);
    state = { ...state, participants };
    emit({ type: 'position-update', participants });

    if (!raceComplete && participants.every((participant) => participant.isFinished)) {
      raceComplete = true;
      if (snippetEnds.includes(session?.getCursorIndex() ?? -1)) finishRace(participants);
    }
  }

  function startRaceLoop(): void {
    raceElapsedMs = 0;
    lastKeyCorrect = null;
    raceComplete = false;
    smoothProgress.reset();
    raceTimer = setInterval(tickRace, RACE_TICK_MS);
  }

  function finishRace(participants: RaceParticipant[]): void {
    if (state.status !== 'racing') return;
    state = { ...state, status: 'finished', participants, winnerId: participants[0]?.id ?? null };

    const pointsMap: Record<string, number> = {};
    const total = participants.length;

    for (const p of participants) {
      const pts = calculateRacePoints(p.rank, total);
      pointsMap[p.id] = pts;
      if (!p.isGhost) {
        void storage.saveRaceResult({
          id: generateId(),
          userId: p.id,
          mode: 'realtime',
          rank: p.rank,
          wpm: p.wpm,
          accuracy: p.stats?.accuracy ?? 100,
          pointsEarned: pts,
          createdAt: Date.now(),
        });
        void storage.addPoints(p.id, pts);
      }
    }

    emit({ type: 'race-finish', rankings: participants, pointsMap });
    cleanup();
  }

  function cleanup(): void {
    if (countdownTimer) clearInterval(countdownTimer);
    if (raceTimer) clearInterval(raceTimer);
    countdownTimer = raceTimer = null;
  }

  return {
    getState: () => state,
    getSession: () => session,

    joinLobby() {
      emitLobbyUpdate();
    },

    setReady(ready: boolean) {
      state = {
        ...state,
        participants: state.participants.map((p) =>
          p.id === myId ? { ...p, isReady: ready } : p,
        ),
      };
      emitLobbyUpdate();
    },

    startRace() {
      const allReady = state.participants.every((p) => p.isReady);
      if (!allReady) return;

      state = { ...state, status: 'countdown', countdown: 3 };
      emitLobbyUpdate();

      countdownTimer = setInterval(() => {
        state = { ...state, countdown: state.countdown - 1 };
        emit({ type: 'countdown', seconds: state.countdown });

        if (state.countdown <= 0) {
          if (countdownTimer) clearInterval(countdownTimer);
          countdownTimer = null;

          session = new TypingSession({ text: raceText });
          state = { ...state, status: 'racing' };

          bindSessionEvents();

          emit({ type: 'race-start' });
          startRaceLoop();
        }
      }, 1000);
    },

    handleInput(char: string) {
      const meFinished = state.participants.find((participant) => participant.id === myId)?.isFinished;
      if (meFinished && snippetEnds.includes(session?.getCursorIndex() ?? -1)) return;

      session?.handleInput(char);
      const cursor = session?.getCursorIndex() ?? -1;
      if (!snippetEnds.includes(cursor)) return;
      if (raceComplete) finishRace(state.participants);
      else if (!meFinished) session?.handleInput(' ');
    },

    handleBackspace() {
      const meFinished = state.participants.find((participant) => participant.id === myId)?.isFinished;
      if (meFinished && snippetEnds.includes(session?.getCursorIndex() ?? -1)) return;
      session?.handleBackspace();
    },

    subscribe(listener: RaceEventListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    destroy() {
      cleanup();
      listeners.clear();
    },
  };
}

export interface GhostRaceOptions {
  storage: StorageAdapter;
  myId: string;
  myName: string;
  ghostUserId: string;
  contentId: string;
  text: string;
  snippetEnds: number[];
  ghostTimeline: KeystrokeSnapshot[];
  ghostRecord: TypingRecord;
}

export interface GhostRaceController {
  getState(): RaceState;
  getSession(): TypingSession | null;
  startRace(): void;
  handleInput(char: string): void;
  handleBackspace(): void;
  subscribe(listener: RaceEventListener): () => void;
  destroy(): void;
}

export function createGhostRaceController(options: GhostRaceOptions): GhostRaceController {
  const { storage, myId, myName, ghostUserId, contentId, text, snippetEnds, ghostTimeline, ghostRecord } =
    options;

  let session: TypingSession | null = null;
  let ghostTimer: ReturnType<typeof setInterval> | null = null;
  let raceStartTime = 0;
  let lastKeyCorrect: boolean | null = null;
  let raceComplete = false;
  const smoothProgress = new SmoothProgressTracker();
  const listeners = new Set<RaceEventListener>();

  let state: RaceState = {
    mode: 'ghost',
    status: 'waiting',
    text,
    snippetEnds,
    contentId,
    participants: [
      { id: myId, name: myName, progress: 0, wpm: 0, speed: 0, rank: 1, isReady: true, isFinished: false },
      {
        id: ghostUserId,
        name: `👻 ${ghostRecord.userId}`,
        progress: 0,
        wpm: ghostRecord.wpm,
        speed: ghostRecord.wpm / 120,
        rank: 2,
        isReady: true,
        isGhost: true,
        isFinished: false,
      },
    ],
    countdown: 3,
    myParticipantId: myId,
    winnerId: null,
  };

  function emit(event: RaceEvent): void {
    for (const listener of listeners) {
      listener(event);
    }
  }

  function bindSessionEvents(): void {
    session!.subscribe((event: TypingEvent) => {
      if (event.type === 'keystroke') {
        lastKeyCorrect = event.correct;
        if (event.correct) {
          const stats = session!.getStats();
          const instantWpm = stats.elapsedMs > 0
            ? stats.wpm
            : Math.round((stats.correctChars / 5) / (RACE_TICK_MS / 60000));
          smoothProgress.setTargetFromWpm(Math.max(stats.wpm, instantWpm));
        } else {
          smoothProgress.applyPenalty();
        }
      } else if (event.type === 'backspace') {
        lastKeyCorrect = false;
        smoothProgress.applyPenalty();
      } else if (event.type === 'finish') {
        if (raceComplete) finishRace(state.participants);
      }
    });
  }

  function updateGhost(): void {
    if (state.status !== 'racing') return;
    const elapsed = Date.now() - raceStartTime;
    const ghost = interpolateGhostProgress(ghostTimeline, elapsed);

    const myStats = session?.getStats();
    if (lastKeyCorrect && myStats && myStats.wpm > 0) {
      smoothProgress.setTargetFromWpm(myStats.wpm);
    }
    smoothProgress.tick(RACE_TICK_MS, RACE_DISTANCE_CHARS);

    const previousMy = state.participants.find((p) => p.id === myId)!;
    const updatedMy = updateParticipantFromStats(
        previousMy,
        myStats ?? { wpm: 0, rawWpm: 0, accuracy: 100, correctChars: 0, incorrectChars: 0, totalTyped: 0, elapsedMs: elapsed, progress: 0 },
        smoothProgress.getProgress(),
      );
    const myP = {
      ...updatedMy,
      speed: smoothProgress.getSpeed(),
      finishedAt: previousMy.finishedAt ?? (updatedMy.isFinished ? elapsed : undefined),
    };

    const previousGhost = state.participants.find((p) => p.id === ghostUserId)!;
    const ghostFinished = ghost.progress >= 1;
    const ghostP: RaceParticipant = {
      ...previousGhost,
      progress: ghost.progress,
      wpm: ghost.wpm,
      speed: ghost.wpm / 120,
      isFinished: ghostFinished,
      finishedAt: previousGhost.finishedAt ?? (ghostFinished ? elapsed : undefined),
    };

    const participants = rankParticipants([myP, ghostP]);
    state = { ...state, participants };
    emit({ type: 'position-update', participants });

    if (!raceComplete && participants.every((participant) => participant.isFinished)) {
      raceComplete = true;
      if (snippetEnds.includes(session?.getCursorIndex() ?? -1)) finishRace(participants);
    }
  }

  function finishRace(participants: RaceParticipant[]): void {
    state = { ...state, status: 'finished', participants, winnerId: participants[0]?.id ?? null };

    const pointsMap: Record<string, number> = {};
    const myRank = participants.find((p) => p.id === myId)?.rank ?? 2;
    const pts = myRank === 1 ? 50 : 20;
    pointsMap[myId] = pts;

    void storage.saveRaceResult({
      id: generateId(),
      userId: myId,
      mode: 'ghost',
      rank: myRank,
      wpm: participants.find((p) => p.id === myId)?.wpm ?? 0,
      accuracy: participants.find((p) => p.id === myId)?.stats?.accuracy ?? 100,
      pointsEarned: pts,
      createdAt: Date.now(),
    });
    void storage.addPoints(myId, pts);

    emit({ type: 'race-finish', rankings: participants, pointsMap });
    if (ghostTimer) clearInterval(ghostTimer);
  }

  return {
    getState: () => state,
    getSession: () => session,

    startRace() {
      let countdown = 3;
      state = { ...state, status: 'countdown', countdown };
      emit({ type: 'lobby-update', state });

      const countdownInterval = setInterval(() => {
        countdown--;
        state = { ...state, countdown };
        emit({ type: 'countdown', seconds: countdown });

        if (countdown <= 0) {
          clearInterval(countdownInterval);
          session = new TypingSession({ text });
          raceStartTime = Date.now();
          state = { ...state, status: 'racing' };

          lastKeyCorrect = null;
          raceComplete = false;
          smoothProgress.reset();
          bindSessionEvents();

          ghostTimer = setInterval(updateGhost, RACE_TICK_MS);
          emit({ type: 'race-start' });
        }
      }, 1000);
    },

    handleInput(char: string) {
      const meFinished = state.participants.find((participant) => participant.id === myId)?.isFinished;
      if (meFinished && snippetEnds.includes(session?.getCursorIndex() ?? -1)) return;

      session?.handleInput(char);
      const cursor = session?.getCursorIndex() ?? -1;
      if (!snippetEnds.includes(cursor)) return;
      if (raceComplete) finishRace(state.participants);
      else if (!meFinished) session?.handleInput(' ');
    },

    handleBackspace() {
      const meFinished = state.participants.find((participant) => participant.id === myId)?.isFinished;
      if (meFinished && snippetEnds.includes(session?.getCursorIndex() ?? -1)) return;
      session?.handleBackspace();
    },

    subscribe(listener: RaceEventListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    destroy() {
      if (ghostTimer) clearInterval(ghostTimer);
      listeners.clear();
    },
  };
}
