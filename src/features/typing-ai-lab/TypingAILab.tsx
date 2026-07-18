import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Beaker, BookOpen, Brain, ChevronRight, Radio,
  RotateCcw, Swords, Target, Timer, Trophy, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TypingPracticeMode } from "@/integrations/supabase/types";
import {
  applySessionHits,
  listTypingAiLabRanking,
  listWordStats,
  saveTypingAiLabResult,
  type TypingAiLabRankingRow,
} from "@/lib/typing-ai-lab";
import { WORDS, WORD_BY_ID, ensureLexicon, isLexiconReady, lexiconLoadedBand, masteryTarget } from "./content";
import KnowledgeGraph from "./KnowledgeGraph";
import LexiconCatalog from "./LexiconCatalog";
import {
  MAX_BAND,
  learningPoolIds,
  progressionSnapshot,
  requiredBandForIds,
  unlockedBand,
} from "./progression";
import { useTypingAiCompetition } from "./useTypingAiCompetition";
import {
  MIN_COMPETITION_WORDS,
  SESSION_MS,
  accuracyPct,
  createGame,
  createRng,
  finishSession,
  generateSentences,
  graphMetrics,
  refillSlots,
  remainingMs,
  submitInput,
  type GameState,
  type LabPlayMode,
  type SessionResult,
  type Slot,
} from "./game";

type Phase =
  | "menu"
  | "ready"
  | "countdown"
  | "playing"
  | "training"
  | "result"
  | "ranking"
  | "lexicon"
  | "matchmaking";

const masteryStorageKey = (userId: string) => `flowpy:typing-ai-lab-mastery:${userId}`;

function loadLocalMastery(userId: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(masteryStorageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalMastery(userId: string, mastery: Record<string, number>) {
  localStorage.setItem(masteryStorageKey(userId), JSON.stringify(mastery));
}

function applyHitsLocally(
  previous: Record<string, number>,
  hits: Record<string, number>,
): { next: Record<string, number>; newlyMastered: string[] } {
  const next = { ...previous };
  const newlyMastered: string[] = [];
  for (const [id, add] of Object.entries(hits)) {
    const before = next[id] ?? 0;
    const after = before + add;
    next[id] = after;
    const target = masteryTarget(WORD_BY_ID[id]?.difficulty ?? 1);
    if (before < target && after >= target) newlyMastered.push(id);
  }
  return { next, newlyMastered };
}

function labSessionTaja(result: SessionResult): number {
  const correctChars = Object.entries(result.sessionHits).reduce(
    (total, [id, hits]) => total + (WORD_BY_ID[id]?.word.length ?? 0) * hits,
    0,
  );
  const minutes = result.elapsedMs / 60_000;
  return minutes > 0 ? Math.round(correctChars / minutes) : 0;
}

export default function TypingAILab({
  userId,
  displayName,
  onExit,
  onComplete,
}: {
  userId: string;
  displayName: string;
  onExit: () => void;
  onComplete?: (
    mode: TypingPracticeMode,
    taja: number,
    won?: boolean,
    matchId?: string,
  ) => void;
}) {
  const [phase, setPhase] = useState<Phase>("menu");
  const [playMode, setPlayMode] = useState<LabPlayMode>("learning");
  const [seed, setSeed] = useState(() => Date.now() & 0xffffffff);
  const [game, setGame] = useState<GameState | null>(null);
  const [input, setInput] = useState("");
  const [now, setNow] = useState(Date.now());
  const [countdown, setCountdown] = useState(3);
  const [trainingStep, setTrainingStep] = useState(0);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ranking, setRanking] = useState<TypingAiLabRankingRow[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [mastery, setMastery] = useState<Record<string, number>>({});
  const [masteredIds, setMasteredIds] = useState<string[]>([]);
  const [newlyMastered, setNewlyMastered] = useState<string[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [lexiconStatus, setLexiconStatus] = useState<"loading" | "ready" | "error">("loading");
  const [lexiconError, setLexiconError] = useState<string | null>(null);
  const [lexiconVersion, setLexiconVersion] = useState(0);
  const [exitConfirm, setExitConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rngRef = useRef<() => number>(() => Math.random());
  const finishedRef = useRef(false);
  const savedRef = useRef(false);
  const progressTick = useRef(0);
  const masteryRef = useRef(mastery);
  masteryRef.current = mastery;
  const competitionPoolIds = useMemo(() => {
    if (masteredIds.length >= MIN_COMPETITION_WORDS) return masteredIds;
    return learningPoolIds(mastery);
  }, [masteredIds, mastery]);

  const competition = useTypingAiCompetition({
    userId,
    displayName,
    poolIds: competitionPoolIds,
  });

  const progress = useMemo(() => {
    void lexiconVersion;
    return progressionSnapshot(mastery);
  }, [mastery, lexiconVersion]);

  const refreshStats = useCallback(async () => {
    setStatsLoading(true);
    const local = loadLocalMastery(userId);
    try {
      const rows = await listWordStats(userId);
      const counts: Record<string, number> = { ...local };
      const mastered: string[] = [];
      for (const r of rows) {
        counts[r.word_id] = Math.max(counts[r.word_id] ?? 0, r.correct_count);
        if (r.mastered_at || counts[r.word_id]! >= masteryTarget(WORD_BY_ID[r.word_id]?.difficulty ?? 1)) {
          mastered.push(r.word_id);
        }
      }
      for (const [id, count] of Object.entries(counts)) {
        if (count >= masteryTarget(WORD_BY_ID[id]?.difficulty ?? 1) && !mastered.includes(id)) {
          mastered.push(id);
        }
      }
      saveLocalMastery(userId, counts);
      setMastery(counts);
      setMasteredIds(mastered);
    } catch {
      const mastered = Object.entries(local)
        .filter(([id, count]) => count >= masteryTarget(WORD_BY_ID[id]?.difficulty ?? 1))
        .map(([id]) => id);
      setMastery(local);
      setMasteredIds(mastered);
    } finally {
      setStatsLoading(false);
    }
  }, [userId]);

  const loadLexiconForProgress = useCallback(async (masteryMap: Record<string, number>) => {
    if (lexiconLoadedBand() === 0) setLexiconStatus("loading");
    setLexiconError(null);
    try {
      for (let i = 0; i < MAX_BAND; i++) {
        const band = unlockedBand(masteryMap);
        await ensureLexicon(band);
        if (unlockedBand(masteryMap) <= lexiconLoadedBand()) break;
      }
      setLexiconVersion((v) => v + 1);
      setLexiconStatus("ready");
    } catch (e) {
      setLexiconStatus("error");
      setLexiconError(e instanceof Error ? e.message : "사전 로드 실패");
    }
  }, []);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    if (statsLoading) return;
    void loadLexiconForProgress(mastery);
    // mastery identity changes often; unlock band is what matters for reload
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reload when unlock band or stats gate changes
  }, [statsLoading, progress.unlockedBand, loadLexiconForProgress]);

  const resetRun = useCallback(() => {
    finishedRef.current = false;
    savedRef.current = false;
    setSeed((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
    setGame(null);
    setInput("");
    setResult(null);
    setSaveError(null);
    setNewlyMastered([]);
    setTrainingStep(0);
    setCountdown(3);
    setExitConfirm(false);
    setPhase("menu");
  }, []);

  const backToMenu = useCallback(() => {
    if (playMode === "competition") void competition.leave();
    resetRun();
  }, [playMode, competition, resetRun]);

  const confirmExit = useCallback(() => {
    setExitConfirm(false);
    backToMenu();
  }, [backToMenu]);

  const learningMasteryCounts = useMemo(() => {
    if (!game || game.mode !== "learning") return mastery;
    const merged = { ...mastery };
    for (const [id, hits] of Object.entries(game.sessionHits)) {
      merged[id] = (merged[id] ?? 0) + hits;
    }
    return merged;
  }, [game, mastery]);

  const startLearning = async () => {
    if (lexiconStatus !== "ready") return;
    setPlayMode("learning");
    finishedRef.current = false;
    savedRef.current = false;
    const band = unlockedBand(mastery);
    try {
      await ensureLexicon(band);
    } catch (e) {
      setLexiconStatus("error");
      setLexiconError(e instanceof Error ? e.message : "사전 로드 실패");
      return;
    }
    if (!isLexiconReady(band)) return;
    rngRef.current = createRng(seed);
    const pool = learningPoolIds(mastery);
    const g = createGame({
      seed,
      mode: "learning",
      poolIds: pool.length > 0 ? pool : null,
      now: Date.now(),
      masteryCounts: mastery,
    });
    setGame(g);
    setInput("");
    setResult(null);
    setNewlyMastered([]);
    setCountdown(3);
    setPhase("countdown");
  };

  const startCompetitionPlay = useCallback(
    async (matchSeed: number, poolIds: string[]) => {
      finishedRef.current = false;
      savedRef.current = false;
      setPlayMode("competition");
      setSeed(matchSeed >>> 0);
      const needBand = requiredBandForIds(poolIds);
      try {
        await ensureLexicon(needBand);
      } catch (e) {
        setLexiconStatus("error");
        setLexiconError(e instanceof Error ? e.message : "사전 로드 실패");
        setPhase("menu");
        return;
      }
      rngRef.current = createRng(matchSeed >>> 0);
      const g = createGame({
        seed: matchSeed >>> 0,
        mode: "competition",
        poolIds,
        now: Date.now(),
      });
      setGame(g);
      setInput("");
      setResult(null);
      setCountdown(3);
      setPhase("countdown");
      void competition.beginPlay();
    },
    [competition],
  );

  useEffect(() => {
    if (phase !== "matchmaking") return;
    if (competition.phase === "countdown" && competition.match) {
      const pool =
        competition.myPool.length >= MIN_COMPETITION_WORDS
          ? competition.myPool
          : competitionPoolIds;
      void startCompetitionPlay(Number(competition.match.seed), pool);
    }
    if (competition.phase === "abandoned") {
      setPhase("menu");
    }
  }, [competition.phase, competition.match, competition.myPool, competitionPoolIds, phase, startCompetitionPlay]);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      const t = Date.now();
      setGame((prev) => (prev ? { ...prev, startedAt: t, endsAt: t + SESSION_MS } : prev));
      setNow(t);
      setPhase("playing");
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 700);
    return () => window.clearTimeout(t);
  }, [phase, countdown]);

  useEffect(() => {
    if (phase !== "playing") return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      setGame((prev) => (prev ? refillSlots(prev, t, rngRef.current, learningMasteryCounts) : prev));
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, seed, learningMasteryCounts]);

  useEffect(() => {
    if (phase === "playing") inputRef.current?.focus();
  }, [phase]);

  const endPlay = useCallback((state: GameState) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (state.mode === "competition") competition.stopSimulation();
    const session = finishSession(state);
    if (!competition.isTestMatch) {
      onComplete?.(
        state.mode === "learning" ? "ai_learning" : "ai_competition",
        labSessionTaja(session),
        false,
        state.mode === "competition" ? competition.match?.id : undefined,
      );
    }
    setResult(session);
    if (state.mode === "learning") {
      setPhase("result");
      return;
    }
    setTrainingStep(0);
    setPhase("training");
  }, [competition, onComplete]);

  useEffect(() => {
    if (phase !== "playing" || !game) return;
    if (remainingMs(game, now) <= 0) endPlay(game);
  }, [phase, game, now, endPlay]);

  useEffect(() => {
    if (phase !== "training") return;
    if (trainingStep >= 3) {
      const t = window.setTimeout(() => setPhase("result"), 400);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setTrainingStep((s) => s + 1), 650);
    return () => window.clearTimeout(t);
  }, [phase, trainingStep]);

  useEffect(() => {
    if (phase !== "result" || !result || savedRef.current) return;
    let cancelled = false;
    setSaving(true);
    void (async () => {
      try {
        if (result.mode === "competition" && competition.isTestMatch) {
          // 봇(TEST-07) 대전도 학생 본인 기록이므로 경쟁 랭킹에 저장한다.
          try {
            await saveTypingAiLabResult(userId, result);
          } catch {
            // 저장 실패해도 게임 종료 처리는 진행
          }
          await competition.complete({
            totalScore: result.score.total,
            grade: result.score.grade,
            datasetSize: result.dataset.length,
          });
          if (!cancelled) {
            savedRef.current = true;
            setSaveError("saved");
          }
          return;
        }
        if (result.mode === "learning") {
          const localApplied = applyHitsLocally(masteryRef.current, result.sessionHits);
          saveLocalMastery(userId, localApplied.next);
          if (!cancelled) {
            setMastery(localApplied.next);
            setMasteredIds((prev) => [...new Set([...prev, ...localApplied.newlyMastered])]);
            setNewlyMastered(localApplied.newlyMastered);
          }
          try {
            const applied = await applySessionHits(result.sessionHits);
            if (!cancelled) {
              setNewlyMastered(
                applied.filter((r) => r.newly_mastered).map((r) => r.word_id),
              );
              await refreshStats();
            }
          } catch {
            // DB 실패해도 로컬 누적은 유지
          }
        }
        try {
          const saved = await saveTypingAiLabResult(userId, result);
          if (result.mode === "competition" && competition.match) {
            await competition.complete({
              totalScore: result.score.total,
              grade: result.score.grade,
              datasetSize: result.dataset.length,
              resultId: saved.id,
            });
          }
        } catch {
          if (result.mode === "competition") throw new Error("경쟁 결과 저장 실패");
        }
        if (!cancelled) {
          savedRef.current = true;
          setSaveError("saved");
        }
      } catch (err) {
        if (!cancelled) setSaveError(err instanceof Error ? err.message : "저장 실패");
      } finally {
        if (!cancelled) setSaving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, result, userId, refreshStats, competition]);

  useEffect(() => {
    if (phase !== "playing" || playMode !== "competition" || !game) return;
    progressTick.current += 1;
    if (progressTick.current % 5 !== 0) return;
    const { density, coverage } = graphMetrics(game.dataset);
    const preview =
      accuracyPct(game) * 0.2 +
      Math.min(100, (game.dataset.length / Math.max(10, game.poolIds?.length ?? 40)) * 100) * 0.2 +
      density * 100 * 0.25 +
      coverage * 100 * 0.15;
    competition.broadcastProgress({
      datasetSize: game.dataset.length,
      accuracy: accuracyPct(game),
      totalPreview: Math.round(preview * 10) / 10,
    });
  }, [game, phase, playMode, competition]);

  const retryCompetition = useCallback(async () => {
    const wasTest = competition.isTestMatch;
    finishedRef.current = false;
    savedRef.current = false;
    setResult(null);
    setSaveError(null);
    setTrainingStep(0);
    setGame(null);
    setInput("");
    setExitConfirm(false);
    await competition.leave();
    setPhase("matchmaking");
    if (wasTest) await competition.startTestMatch();
    else await competition.joinQueue();
  }, [competition]);

  const opponentSentences = useMemo(() => {
    if (!result || result.mode !== "competition" || !competition.opponent) return [];
    const pool =
      competition.myPool.length >= MIN_COMPETITION_WORDS
        ? competition.myPool
        : competitionPoolIds;
    if (pool.length === 0) return [];
    const rng = createRng(((competition.match?.seed ?? seed) ^ 0x9e3779b9) >>> 0);
    const n = Math.min(pool.length, Math.max(3, competition.opponent.datasetSize));
    const ids = [...pool];
    for (let i = ids.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    }
    return generateSentences(ids.slice(0, n), rng).sentences.slice(0, 5);
  }, [result, competition.opponent, competition.myPool, competition.match?.seed, competitionPoolIds, seed]);

  const loadRanking = async () => {
    setRankingLoading(true);
    setPhase("ranking");
    try {
      const rows = await listTypingAiLabRanking(20);
      setRanking(rows.map((r) => ({ ...r, isMe: r.user_id === userId })));
    } catch {
      setRanking([]);
    } finally {
      setRankingLoading(false);
    }
  };

  const openLexicon = async () => {
    setLexiconStatus("loading");
    setLexiconError(null);
    try {
      await ensureLexicon(MAX_BAND);
      setLexiconVersion((value) => value + 1);
      setLexiconStatus("ready");
      setPhase("lexicon");
    } catch (error) {
      setLexiconStatus("error");
      setLexiconError(error instanceof Error ? error.message : "사전 로드 실패");
    }
  };

  const onSubmitWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!game || phase !== "playing") return;
    const t = Date.now();
    const { state } = submitInput(game, input, t, rngRef.current);
    const counts =
      state.mode === "learning"
        ? Object.fromEntries(
            [
              ...Object.keys(mastery),
              ...Object.keys(state.sessionHits),
            ].map((id) => [id, (mastery[id] ?? 0) + (state.sessionHits[id] ?? 0)]),
          )
        : mastery;
    setGame(refillSlots(state, t, rngRef.current, counts));
    setInput("");
  };

  const live = useMemo(() => {
    if (!game) return null;
    const { density, coverage } = graphMetrics(game.dataset);
    return {
      remain: remainingMs(game, now),
      accuracy: accuracyPct(game),
      density,
      coverage,
      size: game.dataset.length,
    };
  }, [game, now]);

  const statusLabel =
    phase === "menu" ? "STANDBY"
      : phase === "matchmaking" ? "MATCHMAKING"
        : phase === "countdown" ? "COUNTDOWN"
          : phase === "playing" ? "LIVE"
            : phase === "training" ? "TRAINING"
              : phase === "result" ? "REPORT"
                : phase === "ranking" ? "LEADERBOARD"
                  : phase === "lexicon" ? "CODEX"
                    : "READY";

  /* ── Menu ── */
  if (phase === "menu") {
    const lexiconBusy = lexiconStatus !== "ready" || statsLoading;
    const canCompete = !lexiconBusy;
    return (
      <Shell onExit={onExit} status={statusLabel} title="AI TYPING LAB">
        <div className="mx-auto flex min-h-[calc(100vh-72px)] max-w-5xl flex-col justify-center gap-5 px-4 py-8">
          <header className="text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-[10px] font-black tracking-[0.35em] text-cyan-200">
              <span className="size-1.5 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]" />
              RESEARCH UNIT ONLINE
            </div>
            <h1 className="-skew-x-6 text-4xl font-black italic tracking-tighter text-white drop-shadow-[0_0_24px_rgba(34,211,238,.35)] sm:text-6xl">
              AI <span className="text-cyan-300">TYPING</span> LAB
            </h1>
            <p className="mt-3 text-sm tracking-wide text-slate-400">
              단어를 수집하고 · 그래프를 구축하고 · 문장을 추론하라
            </p>
          </header>

          <LabPanel className="bg-[#03111d]/45 px-4 py-3 backdrop-blur-[2px]">
            {lexiconStatus === "loading" || statsLoading ? (
              <p className="text-sm text-cyan-200/80">학습 사전 동기화 중…</p>
            ) : lexiconStatus === "error" ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-rose-300">사전 로드 실패: {lexiconError}</p>
                <LabButton size="sm" onClick={() => void loadLexiconForProgress(mastery)}>다시 시도</LabButton>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <HudMetric label="LEVEL" value={`Lv.${progress.unlockedBand}`} accent="cyan" />
                <HudMetric label="MASTERED" value={String(progress.masteredTotal)} accent="emerald" />
                <HudMetric
                  label="NEXT UNLOCK"
                  value={progress.nextBand != null ? `${progress.remainingToUnlock}` : "MAX"}
                  accent="amber"
                  hint={progress.nextBand != null ? `${progress.bandMastered}/${progress.unlockNeed}` : "ALL CLEAR"}
                />
              </div>
            )}
          </LabPanel>

          <div className="grid gap-3 md:grid-cols-2">
            <MissionCard
              icon={Beaker}
              badge="SOLO"
              title="개인 학습"
              description="해금된 난이도만 출제. 숙련하면 다음 난이도가 열립니다."
              accent="cyan"
              disabled={lexiconBusy}
              onClick={() => void startLearning()}
            />
            <MissionCard
              icon={Swords}
              badge="PVP"
              title="실시간 경쟁"
              description={`빠른 매칭 2인전 · 사용 가능 단어 ${competitionPoolIds.length}개`}
              accent="blue"
              disabled={!canCompete}
              onClick={() => {
                setPhase("matchmaking");
                void competition.joinQueue();
              }}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <LabButton variant="ghost" disabled={statsLoading} onClick={() => void openLexicon()} className="justify-between">
              <span className="inline-flex items-center gap-2"><BookOpen className="size-4" /> 단어 도감</span>
              <ChevronRight className="size-4 opacity-50" />
            </LabButton>
            <LabButton variant="ghost" onClick={() => void loadRanking()} className="justify-between">
              <span className="inline-flex items-center gap-2"><Trophy className="size-4" /> 경쟁 랭킹</span>
              <ChevronRight className="size-4 opacity-50" />
            </LabButton>
          </div>
        </div>
      </Shell>
    );
  }

  /* ── Lexicon ── */
  if (phase === "lexicon") {
    return (
      <Shell onExit={() => setPhase("menu")} compact status={statusLabel} title="WORD CODEX" background="start">
        <LexiconCatalog words={[...WORDS]} mastery={mastery} />
      </Shell>
    );
  }

  /* ── Matchmaking ── */
  if (phase === "matchmaking") {
    return (
      <Shell
        onExit={() => { void competition.leave(); setPhase("menu"); }}
        status={statusLabel}
        title="MATCHMAKING"
      >
        <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-6 px-4 text-center">
          <div className="relative grid size-36 place-items-center">
            <span className="absolute inset-0 animate-ping rounded-full border border-cyan-400/30" />
            <span className="absolute inset-3 animate-pulse rounded-full border border-cyan-300/40" />
            <span className="absolute inset-8 rounded-full border border-dashed border-cyan-200/30" />
            <Swords className="relative size-12 text-cyan-300" />
          </div>
          <LabPanel className="w-full p-5">
            <p className="text-[10px] font-black tracking-[0.35em] text-cyan-300/70">SCANNING OPPONENTS</p>
            <h2 className="mt-2 text-2xl font-black italic">
              {competition.phase === "queued" ? "상대 찾는 중…" : "매칭 중…"}
            </h2>
            <p className="mt-2 text-sm text-slate-400">숙련 풀 {masteredIds.length}단어 · 빠른 매칭 2인전</p>
            {competition.error && <p className="mt-3 text-sm text-rose-300">{competition.error}</p>}
            {competition.phase === "queued" && (
              <LabButton className="mt-4 w-full" onClick={() => void competition.startTestMatch()}>
                TEST-07과 테스트 시작
              </LabButton>
            )}
          </LabPanel>
          <LabButton
            variant="ghost"
            onClick={() => { void competition.cancel(); setPhase("menu"); }}
          >
            매칭 취소
          </LabButton>
        </div>
      </Shell>
    );
  }

  /* ── Countdown ── */
  if (phase === "countdown" && game) {
    return (
      <Shell onExit={backToMenu} background="game" status={statusLabel} title={playMode === "competition" ? "COMPETITION" : "RESEARCH"}>
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4">
          <p className="text-[11px] font-black tracking-[0.4em] text-cyan-300/70">
            {playMode === "competition" ? "DUEL PROTOCOL" : "RESEARCH PROTOCOL"}
          </p>
          <div className="relative grid size-44 place-items-center">
            <span className="absolute inset-0 rounded-full border border-cyan-400/25" />
            <span className="absolute inset-4 rounded-full border border-dashed border-cyan-300/20" />
            <p className="font-mono text-8xl font-black tabular-nums text-cyan-300 drop-shadow-[0_0_30px_rgba(34,211,238,.45)] motion-safe:animate-pulse">
              {countdown > 0 ? countdown : "GO"}
            </p>
          </div>
          {playMode === "competition" && competition.opponent && (
            <LabPanel className="px-5 py-3 text-sm">
              vs <b className="text-cyan-200">{competition.opponent.name}</b>
            </LabPanel>
          )}
        </div>
      </Shell>
    );
  }

  /* ── Playing ── */
  if (phase === "playing" && game && live) {
    const secs = Math.ceil(live.remain / 1000);
    const urgent = secs <= 10;
    const sessionHitTotal = Object.values(game.sessionHits).reduce((a, b) => a + b, 0);
    const progressPct = (() => {
      if (playMode !== "learning") return Math.min(100, live.density * 100);
      const ids = Object.keys(game.sessionHits);
      if (ids.length === 0) return 0;
      let sum = 0;
      for (const id of ids) {
        const target = masteryTarget(WORD_BY_ID[id]?.difficulty ?? 1);
        const total = (mastery[id] ?? 0) + (game.sessionHits[id] ?? 0);
        sum += Math.min(1, total / target);
      }
      return Math.round((sum / ids.length) * 100);
    })();
    return (
      <Shell
        onExit={() => setExitConfirm(true)}
        compact
        background="game"
        status={statusLabel}
        title="LIVE SESSION"
      >
        {exitConfirm && (
          <ExitConfirmDialog
            competition={playMode === "competition"}
            onCancel={() => {
              setExitConfirm(false);
              window.setTimeout(() => inputRef.current?.focus(), 0);
            }}
            onConfirm={confirmExit}
          />
        )}
        <div className="mx-auto grid min-h-[calc(100vh-54px)] max-w-6xl content-center gap-3 px-3 pb-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-3">
            <LabPanel className="flex flex-wrap items-center gap-3 px-3 py-2.5 sm:px-4">
              <div className="flex items-center gap-2">
                <Timer className={cn("size-5", urgent && "text-rose-400")} />
                <span className={cn(
                  "font-mono text-2xl font-black tabular-nums",
                  urgent ? "text-rose-400" : "text-cyan-200",
                )}>
                  {String(Math.floor(secs / 60)).padStart(2, "0")}:{String(secs % 60).padStart(2, "0")}
                </span>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
                <Chip label="ACC" value={`${live.accuracy}%`} />
                <Chip label="COMBO" value={String(game.combo)} accent="amber" />
                <Chip label="DATA" value={String(live.size)} accent="emerald" />
              </div>
              {playMode === "competition" && competition.opponent && (
                <div className="w-full border-t border-cyan-300/10 pt-2 text-xs text-slate-300 sm:w-auto sm:border-0 sm:pt-0">
                  vs <b>{competition.opponent.name}</b>
                  <span className="text-slate-500"> · {competition.opponent.datasetSize}단어</span>
                  {!competition.opponent.online && <span className="text-rose-300"> · 이탈</span>}
                </div>
              )}
            </LabPanel>

            <LabPanel className="p-2.5 sm:p-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-[10px] font-black tracking-[0.25em] text-cyan-300/60">WORD BOARD</span>
                <span className="text-[10px] text-slate-500">{game.slots.filter((s) => !s.refillAt).length}/25 ACTIVE</span>
              </div>
              {playMode === "competition" ? (
                <ScatteredWordBoard slots={game.slots} seed={seed} />
              ) : (
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 sm:gap-2">
                  {game.slots.map((slot) => {
                    const def = slot.wordId ? WORD_BY_ID[slot.wordId] : null;
                    const empty = Boolean(slot.refillAt);
                    return (
                      <div
                        key={slot.id}
                        className={cn(
                          "relative flex min-h-[3.5rem] flex-col items-center justify-center overflow-hidden border px-1.5 py-1.5 text-center transition sm:min-h-16",
                          empty
                            ? "border-transparent bg-slate-950/35 text-transparent"
                            : "border-cyan-300/20 bg-[#03111d]/90 text-zinc-100 shadow-[inset_0_1px_rgba(255,255,255,.04)]",
                        )}
                      >
                        {!empty && <CornerMarks />}
                        <span className="text-sm font-bold tracking-wide">{empty ? "·" : slot.word}</span>
                        {def && !empty && (
                          <span className="mt-0.5 max-w-full truncate text-[10px] text-slate-500">{def.meaningKo}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </LabPanel>

            <form onSubmit={onSubmitWord} className="sticky bottom-3 z-20">
              <div className="relative">
                <Target className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-cyan-400/70" />
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="단어를 입력하고 Enter…"
                  className="w-full border border-cyan-300/45 bg-[#01070d]/95 py-4 pl-11 pr-5 font-mono text-lg text-white shadow-[0_0_28px_rgba(34,211,238,.12)] outline-none ring-cyan-300/25 placeholder:text-slate-600 focus:ring-2"
                />
              </div>
            </form>

            <LabPanel className="p-3 text-sm">
              <p className="mb-2 text-[10px] font-black tracking-[0.25em] text-cyan-300/60">RECENT LOOT</p>
              <div className="flex flex-wrap gap-1.5">
                {game.lastAcquired.length === 0 ? (
                  <span className="text-slate-600">아직 없음</span>
                ) : (
                  game.lastAcquired.map((w, i) => (
                    <span key={`${w}-${i}`} className="border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                      {w}
                    </span>
                  ))
                )}
              </div>
            </LabPanel>
          </div>

          <aside className="flex h-full flex-col gap-3 lg:sticky lg:top-3">
            <LabPanel className="space-y-1 p-4 text-sm">
              <p className="mb-2 text-[10px] font-black tracking-[0.25em] text-cyan-300/60">TELEMETRY</p>
              {playMode === "learning" ? (
                <>
                  <HudRow label="Hits" value={String(game.correctAttempts)} />
                  <HudRow label="Progress" value={`${progressPct}%`} />
                  <HudRow label="Acquired" value={String(live.size)} />
                  <HudRow label="Tracked" value={String(Object.keys(game.sessionHits).length)} />
                </>
              ) : (
                <>
                  <HudRow label="Dataset" value={String(live.size)} />
                  <HudRow label="Density" value={`${Math.round(live.density * 100)}%`} />
                  <HudRow label="Coverage" value={`${Math.round(live.coverage * 100)}%`} />
                  {competition.opponent && (
                    <HudRow label="상대 예상" value={String(competition.opponent.totalPreview)} />
                  )}
                </>
              )}
              <div className="mt-3 h-1.5 overflow-hidden bg-slate-900">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all"
                  style={{ width: `${playMode === "learning" ? progressPct : Math.min(100, live.density * 100)}%` }}
                />
              </div>
              {playMode === "learning" && (
                <p className="pt-2 text-[10px] text-slate-500">
                  정타 {sessionHitTotal}회 누적 중 · 목표 도달 시 획득
                </p>
              )}
            </LabPanel>
            <DataCollecting
              accuracy={live.accuracy}
              density={playMode === "learning" ? progressPct / 100 : live.density}
              datasetSize={live.size}
            />
            <NeuralActivity
              accuracy={live.accuracy}
              density={playMode === "learning" ? progressPct / 100 : live.density}
            />
          </aside>
        </div>
      </Shell>
    );
  }

  /* ── Training ── */
  if (phase === "training") {
    const steps = ["Dataset 분석", "Knowledge Graph 구성", "문장 추론 생성"];
    return (
      <Shell onExit={backToMenu} background="game" status={statusLabel} title="MODEL TRAINING">
        <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
          <Brain className="size-14 text-cyan-300 motion-safe:animate-pulse" />
          <h2 className="text-3xl font-black italic">Training Model…</h2>
          <LabPanel className="w-full space-y-2 p-4 text-left">
            {steps.map((label, i) => (
              <div
                key={label}
                className={cn(
                  "flex items-center gap-3 border px-3 py-3 text-sm",
                  i < trainingStep
                    ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                    : i === trainingStep
                      ? "border-cyan-300/40 bg-cyan-950/40 text-white"
                      : "border-slate-800 text-slate-600",
                )}
              >
                <span className="font-mono text-xs">{i < trainingStep ? "OK" : i === trainingStep ? ">>" : "--"}</span>
                {label}
                {i === trainingStep && <Radio className="ml-auto size-3.5 animate-pulse text-cyan-300" />}
              </div>
            ))}
          </LabPanel>
        </div>
      </Shell>
    );
  }

  /* ── Ranking ── */
  if (phase === "ranking") {
    const top3 = ranking.slice(0, 3);
    const rest = ranking.slice(3);
    return (
      <Shell onExit={() => setPhase("menu")} status={statusLabel} title="LEADERBOARD">
        <div className="mx-auto max-w-xl space-y-4 px-4 py-8">
          <header className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black tracking-[0.3em] text-amber-300/70">COMPETITION</p>
              <h2 className="text-3xl font-black italic">경쟁 랭킹</h2>
            </div>
          </header>

          {rankingLoading ? (
            <LabPanel className="p-8 text-center text-sm text-slate-400">불러오는 중…</LabPanel>
          ) : ranking.length === 0 ? (
            <LabPanel className="p-8 text-center text-sm text-slate-400">아직 기록이 없습니다.</LabPanel>
          ) : (
            <>
              {top3.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {[top3[1], top3[0], top3[2]].map((row, visualIndex) => {
                    if (!row) return <div key={`empty-${visualIndex}`} />;
                    const rank = ranking.indexOf(row) + 1;
                    return (
                      <LabPanel
                        key={row.id}
                        className={cn(
                          "flex flex-col items-center px-2 py-4 text-center",
                          rank === 1 && "border-amber-300/40 bg-amber-500/10",
                          row.isMe && "ring-1 ring-cyan-300/40",
                        )}
                      >
                        <span className={cn(
                          "font-mono text-xs font-black",
                          rank === 1 ? "text-amber-300" : rank === 2 ? "text-slate-200" : "text-orange-300",
                        )}>
                          #{rank}
                        </span>
                        <p className="mt-2 w-full truncate text-sm font-bold">{row.display_name}</p>
                        <p className="mt-1 font-mono text-lg font-black text-cyan-200">{row.total_score}</p>
                        <p className="text-[10px] text-slate-500">{row.grade}</p>
                      </LabPanel>
                    );
                  })}
                </div>
              )}
              <div className="space-y-1.5">
                {rest.map((row, i) => (
                  <LabPanel
                    key={row.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5",
                      row.isMe && "border-cyan-400/40 bg-cyan-500/10",
                    )}
                  >
                    <span className="w-7 text-center font-mono text-xs text-slate-500">{i + 4}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {row.display_name}{row.isMe ? " (나)" : ""}
                    </span>
                    <span className="font-mono text-xs text-slate-400">{row.grade}</span>
                    <span className="font-mono text-sm font-bold text-cyan-300">{row.total_score}</span>
                  </LabPanel>
                ))}
              </div>
            </>
          )}
        </div>
      </Shell>
    );
  }

  /* ── Result ── */
  if (phase === "result" && result) {
    const s = result.score;
    const isLearning = result.mode === "learning";
    const lootIds = newlyMastered.length > 0 ? newlyMastered : result.dataset;

    if (isLearning) {
      return (
        <Shell onExit={backToMenu} status={statusLabel} title="LEARNING REPORT">
          <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black tracking-[0.3em] text-emerald-300/70">SESSION COMPLETE</p>
                <h2 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-3xl font-black italic">
                  <span>
                    학습완료 <span className="text-emerald-400">{lootIds.length}</span>
                  </span>
                  <span className="font-mono text-sm font-normal not-italic text-slate-400">
                    ACC {result.accuracy}% · {displayName}
                  </span>
                </h2>
              </div>
              <LabButton onClick={() => void startLearning()}>
                <RotateCcw className="size-4" /> 다시하기
              </LabButton>
            </div>

            {saveError && saveError !== "saved" && (
              <LabPanel className="border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                저장 실패: {saveError} {saving ? "(재시도 중…)" : ""}
              </LabPanel>
            )}
            {saveError === "saved" && (
              <p className="text-xs text-emerald-400">숙련도가 저장되었습니다. (게임 간 누적)</p>
            )}

            <LabPanel className="p-4">
              <h3 className="mb-2 flex items-center gap-2 font-semibold">
                <Zap className="size-4 text-emerald-400" /> 이번 세션 획득 ({lootIds.length})
              </h3>
              <p className="mb-3 text-xs text-slate-500">
                정타는 게임마다 누적됩니다. 난이도별 3~7회에 도달하면 획득됩니다.
              </p>
              {lootIds.length === 0 ? (
                <p className="text-sm text-slate-500">아직 목표 횟수에 도달한 단어가 없습니다.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {lootIds.map((id) => (
                    <span key={id} className="border border-cyan-300/15 bg-slate-950/70 px-2 py-1 text-sm" title={WORD_BY_ID[id]?.meaningKo}>
                      {WORD_BY_ID[id]?.word}
                      <span className="ml-1 text-[10px] text-slate-500">{WORD_BY_ID[id]?.meaningKo}</span>
                    </span>
                  ))}
                </div>
              )}
            </LabPanel>
          </div>
        </Shell>
      );
    }

    return (
      <Shell onExit={backToMenu} status={statusLabel} title="COMPETITION REPORT">
        <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black tracking-[0.3em] text-cyan-300/70">FINAL GRADE</p>
              <h2 className="text-4xl font-black italic">
                Grade <span className="text-cyan-300 drop-shadow-[0_0_18px_rgba(34,211,238,.35)]">{s.grade}</span>
              </h2>
              <p className="mt-1 font-mono text-slate-400">Total {s.total} · {displayName}</p>
            </div>
            <LabButton onClick={() => void retryCompetition()}>
              <RotateCcw className="size-4" /> 다시하기
            </LabButton>
          </div>

          {saveError && saveError !== "saved" && (
            <LabPanel className="border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              저장 실패: {saveError} {saving ? "(재시도 중…)" : ""}
            </LabPanel>
          )}
          {saveError === "saved" && (
            <p className="text-xs text-emerald-400">결과가 저장되었습니다.</p>
          )}

          {competition.opponent && (
            <LabPanel className="px-4 py-3 text-sm">
              상대 <b className="text-cyan-200">{competition.opponent.name}</b>
              <span className="text-slate-500"> · Dataset {competition.opponent.datasetSize} · 예상 {competition.opponent.totalPreview}</span>
            </LabPanel>
          )}

          <div className="grid gap-2 sm:grid-cols-5">
            <ScoreCard label="Accuracy" value={s.accuracy} weight="20%" />
            <ScoreCard label="Dataset" value={s.dataset} weight="20%" />
            <ScoreCard label="Density" value={s.density} weight="25%" />
            <ScoreCard label="Coverage" value={s.coverage} weight="15%" />
            <ScoreCard label="Inference" value={s.inference} weight="20%" />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <LabPanel className="p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <Zap className="size-4 text-cyan-300" /> Dataset ({result.datasetWords.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {result.dataset.map((id) => (
                  <span key={id} className="border border-cyan-300/15 bg-slate-950/70 px-2 py-0.5 text-sm" title={WORD_BY_ID[id]?.meaningKo}>
                    {WORD_BY_ID[id]?.word}
                  </span>
                ))}
              </div>
            </LabPanel>
            <LabPanel className="p-4">
              <h3 className="mb-3 font-semibold">Generated Sentences</h3>
              {result.sentences.length === 0 ? (
                <p className="text-sm text-slate-500">학습 데이터 부족 — 문장을 생성하지 못했습니다.</p>
              ) : (
                <ul className="space-y-1.5 text-sm text-slate-300">
                  {result.sentences.map((snt) => (
                    <li key={snt.text} className="border border-cyan-300/10 bg-slate-950/60 px-3 py-2 font-mono">
                      {snt.text}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-slate-500">
                Inference Success {Math.round(result.inferenceSuccess * 100)}%
              </p>
            </LabPanel>
          </div>

          {competition.opponent && (
            <LabPanel className="p-4">
              <h3 className="mb-3 font-semibold">
                상대 생성 문장 · <span className="text-cyan-200">{competition.opponent.name}</span>
              </h3>
              {opponentSentences.length === 0 ? (
                <p className="text-sm text-slate-500">상대 학습 데이터 부족 — 문장을 생성하지 못했습니다.</p>
              ) : (
                <ul className="space-y-1.5 text-sm text-slate-300">
                  {opponentSentences.map((snt) => (
                    <li key={snt.text} className="border border-cyan-300/10 bg-slate-950/60 px-3 py-2 font-mono">
                      {snt.text}
                    </li>
                  ))}
                </ul>
              )}
            </LabPanel>
          )}

          <LabPanel className="p-4">
            <h3 className="mb-3 font-semibold">Knowledge Graph</h3>
            <KnowledgeGraph ids={result.dataset} edges={result.edges} />
          </LabPanel>
        </div>
      </Shell>
    );
  }

  return null;
}

/* ── Shared Lab HUD ── */

function Shell({
  children,
  onExit,
  compact,
  background = "start",
  status = "STANDBY",
  title = "AI TYPING LAB",
}: {
  children: React.ReactNode;
  onExit: () => void;
  compact?: boolean;
  background?: "start" | "game";
  status?: string;
  title?: string;
}) {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#010810] text-white">
      <div
        className="pointer-events-none fixed inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('/typing-ai-lab/${background === "game" ? "panel" : "background"}.png')`,
        }}
      />
      <div className={cn(
        "pointer-events-none fixed inset-0",
        background === "game"
          ? "bg-[linear-gradient(180deg,rgba(1,8,16,.72),rgba(1,8,16,.86))]"
          : "bg-[radial-gradient(circle_at_center,rgba(1,8,16,.18),rgba(1,8,16,.78))]",
      )} />
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.07]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,.55) 3px)",
        }}
      />

      <div className={cn("relative z-10", compact ? "pt-2" : "pt-3")}>
        <div className="mx-auto mb-3 flex max-w-6xl items-center gap-3 px-3">
          <LabButton variant="ghost" size="sm" onClick={onExit} className="shrink-0">
            <ArrowLeft className="size-4" /> BACK
          </LabButton>
          <div className="hidden min-w-0 flex-1 items-center gap-3 sm:flex">
            <span className="h-px flex-1 bg-gradient-to-r from-cyan-300/40 to-transparent" />
            <span className="truncate text-[10px] font-black tracking-[0.28em] text-cyan-200/70">{title}</span>
            <span className="h-px flex-1 bg-gradient-to-l from-cyan-300/40 to-transparent" />
          </div>
          <div className="ml-auto flex items-center gap-2 border border-cyan-300/20 bg-cyan-950/30 px-2.5 py-1 text-[9px] font-black tracking-[0.2em] text-cyan-200 backdrop-blur-sm">
            <span className="size-1.5 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]" />
            {status}
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}

function LabPanel({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative border border-cyan-300/15 bg-[#03111d]/78 shadow-[0_12px_40px_rgba(0,0,0,.35)] backdrop-blur-xl",
        className,
      )}
      {...props}
    >
      <CornerMarks />
      {children}
    </div>
  );
}

function CornerMarks() {
  return (
    <>
      <span className="pointer-events-none absolute left-0 top-0 h-2 w-2 border-l border-t border-cyan-300/50" />
      <span className="pointer-events-none absolute right-0 top-0 h-2 w-2 border-r border-t border-cyan-300/50" />
      <span className="pointer-events-none absolute bottom-0 left-0 h-2 w-2 border-b border-l border-cyan-300/50" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-2 w-2 border-b border-r border-cyan-300/50" />
    </>
  );
}

function ExitConfirmDialog({
  competition,
  onCancel,
  onConfirm,
}: {
  competition: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
      <LabPanel className="w-full max-w-sm p-5 shadow-[0_0_40px_rgba(34,211,238,.12)]" role="alertdialog" aria-modal="true" aria-labelledby="exit-confirm-title">
        <p className="text-[10px] font-black tracking-[0.28em] text-cyan-300/70">SESSION EXIT</p>
        <h2 id="exit-confirm-title" className="mt-2 text-xl font-black italic">
          종료하시겠습니까?
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          {competition
            ? "진행 중인 경쟁이 중단되고 상대에게 이탈로 표시됩니다."
            : "진행 중인 학습 세션이 저장되지 않고 종료됩니다."}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <LabButton variant="ghost" onClick={onCancel}>계속하기</LabButton>
          <LabButton onClick={onConfirm}>종료</LabButton>
        </div>
      </LabPanel>
    </div>
  );
}

function LabButton({
  children,
  onClick,
  disabled,
  className,
  variant = "primary",
  size = "md",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  variant?: "primary" | "ghost";
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 border font-black italic tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm",
        variant === "primary"
          ? "border-cyan-300/50 bg-cyan-500/20 text-cyan-50 hover:bg-cyan-400/25 hover:shadow-[0_0_20px_rgba(34,211,238,.18)]"
          : "border-cyan-300/20 bg-slate-950/40 text-slate-300 hover:border-cyan-300/40 hover:bg-cyan-950/40 hover:text-cyan-100",
        className,
      )}
    >
      {children}
    </button>
  );
}

function MissionCard({
  icon: Icon,
  badge,
  title,
  description,
  accent,
  disabled,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  badge: string;
  title: string;
  description: string;
  accent: "cyan" | "blue";
  disabled?: boolean;
  onClick: () => void;
}) {
  const cyan = accent === "cyan";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden border p-5 text-left shadow-xl backdrop-blur-[2px] transition",
        disabled
          ? "border-slate-700/70 bg-[#03111d]/30 text-slate-500"
          : cyan
            ? "border-cyan-300/25 bg-[#03111d]/55 hover:-translate-y-0.5 hover:border-cyan-300/60 hover:bg-[#03111d]/65 hover:shadow-[0_0_34px_rgba(34,211,238,.14)]"
            : "border-blue-300/25 bg-[#03111d]/55 hover:-translate-y-0.5 hover:border-blue-300/60 hover:bg-[#03111d]/65 hover:shadow-[0_0_34px_rgba(59,130,246,.14)]",
      )}
    >
      <CornerMarks />
      <span className="absolute -right-2 -top-3 text-7xl font-black italic text-white/[0.03]">{badge}</span>
      <div className="flex items-start justify-between gap-3">
        <span className={cn(
          "grid size-12 place-items-center border",
          disabled ? "border-slate-700 text-slate-600" : cyan ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-300" : "border-blue-300/40 bg-blue-400/10 text-blue-300",
        )}>
          <Icon className="size-6 transition group-hover:scale-110" />
        </span>
        <span className={cn(
          "border px-2 py-0.5 text-[9px] font-black tracking-[0.2em]",
          disabled ? "border-slate-700 text-slate-600" : cyan ? "border-cyan-300/30 text-cyan-200" : "border-blue-300/30 text-blue-200",
        )}>
          {badge}
        </span>
      </div>
      <h2 className="mt-4 text-xl font-black italic">{title}</h2>
      <p className={cn("mt-1 text-sm", disabled ? "text-slate-600" : "text-slate-400")}>{description}</p>
      <div className="mt-4 flex items-center gap-1 text-xs font-black tracking-wider text-white/40 transition group-hover:text-cyan-200/80">
        ENGAGE <ChevronRight className="size-4 transition group-hover:translate-x-1" />
      </div>
    </button>
  );
}

function HudMetric({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: string;
  accent: "cyan" | "emerald" | "amber";
  hint?: string;
}) {
  const color =
    accent === "cyan" ? "text-cyan-300"
      : accent === "emerald" ? "text-emerald-300"
        : "text-amber-300";
  return (
    <div>
      <p className="text-[10px] font-black tracking-[0.22em] text-slate-500">{label}</p>
      <p className={cn("mt-0.5 font-mono text-xl font-black", color)}>{value}</p>
      {hint && <p className="text-[10px] text-slate-500">{hint}</p>}
    </div>
  );
}

function Chip({
  label,
  value,
  accent = "cyan",
}: {
  label: string;
  value: string;
  accent?: "cyan" | "amber" | "emerald";
}) {
  const color =
    accent === "amber" ? "text-amber-300 border-amber-300/25 bg-amber-500/10"
      : accent === "emerald" ? "text-emerald-300 border-emerald-300/25 bg-emerald-500/10"
        : "text-cyan-200 border-cyan-300/25 bg-cyan-500/10";
  return (
    <span className={cn("inline-flex items-center gap-1.5 border px-2 py-1 font-mono", color)}>
      <span className="text-[9px] font-black tracking-wider opacity-70">{label}</span>
      <b>{value}</b>
    </span>
  );
}

function ScatteredWordBoard({ slots, seed }: { slots: Slot[]; seed: number }) {
  const active = slots.filter((s) => !s.refillAt && s.word);
  return (
    <div className="relative min-h-[22rem] overflow-hidden border border-cyan-300/10 bg-[#010810]/55 sm:min-h-[24rem]">
      {active.map((slot) => {
        const h = hashStr(`${seed}:${slot.id}:${slot.word}`);
        const left = 4 + (h % 78);
        const top = 8 + ((h >>> 8) % 76);
        const size = 0.8 + ((h >>> 16) % 5) * 0.08;
        const rot = ((h >>> 20) % 11) - 5;
        return (
          <span
            key={slot.id}
            className="absolute font-bold tracking-wide text-cyan-300/20 transition-opacity"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              fontSize: `${size}rem`,
              transform: `translate(-50%, -50%) rotate(${rot}deg)`,
            }}
          >
            {slot.word}
          </span>
        );
      })}
    </div>
  );
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function DataCollecting({
  accuracy,
  density,
  datasetSize,
}: {
  accuracy: number;
  density: number;
  datasetSize: number;
}) {
  return (
    <LabPanel className="flex min-h-36 flex-col p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-black tracking-[0.25em] text-cyan-300/60">
          DATA PIPELINE
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[9px] text-cyan-300">
          <span className="size-1.5 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_7px_#67e8f9]" />
          COLLECTING
        </span>
      </div>
      <div className="relative min-h-24 flex-1 overflow-hidden border border-cyan-300/10 bg-[#010810]/75">
        <svg viewBox="0 0 240 80" preserveAspectRatio="none" className="size-full" aria-hidden="true">
          <defs>
            <linearGradient id="collect-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity=".22" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="collect-scan" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
              <stop offset="50%" stopColor="#67e8f9" stopOpacity=".75" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[20, 40, 60].map((y) => (
            <line key={y} x1="0" y1={y} x2="240" y2={y} stroke="#164e63" strokeOpacity=".28" />
          ))}
          <g>
            <path
              d="M0 48 L18 42 L36 55 L54 30 L72 50 L90 28 L108 46 L126 34 L144 52 L162 26 L180 44 L198 32 L216 48 L234 38 L252 55 L270 30 L288 50 L306 28 L324 46 L342 34 L360 52 L378 26 L396 44 L414 32 L432 48 L450 38 L468 55 L480 48 L480 80 L0 80 Z"
              fill="url(#collect-fill)"
            />
            <path
              d="M0 48 L18 42 L36 55 L54 30 L72 50 L90 28 L108 46 L126 34 L144 52 L162 26 L180 44 L198 32 L216 48 L234 38 L252 55 L270 30 L288 50 L306 28 L324 46 L342 34 L360 52 L378 26 L396 44 L414 32 L432 48 L450 38 L468 55 L480 48"
              fill="none"
              stroke="#67e8f9"
              strokeWidth="1.4"
            />
            <animateTransform
              attributeName="transform"
              type="translate"
              from="0 0"
              to="-240 0"
              dur="5s"
              repeatCount="indefinite"
            />
          </g>
          <g>
            <path
              d="M0 58 C20 48 40 68 60 52 S100 40 120 56 S160 62 180 44 S220 38 240 58 C260 48 280 68 300 52 S340 40 360 56 S400 62 420 44 S460 38 480 58"
              fill="none"
              stroke="#34d399"
              strokeWidth="1"
              strokeOpacity=".7"
              strokeDasharray="3 5"
            />
            <animateTransform
              attributeName="transform"
              type="translate"
              from="0 0"
              to="-240 0"
              dur="7s"
              repeatCount="indefinite"
            />
          </g>
          <rect x="-24" y="0" width="24" height="80" fill="url(#collect-scan)" opacity=".3">
            <animate attributeName="x" from="-24" to="240" dur="2.4s" repeatCount="indefinite" />
          </rect>
        </svg>
        <div className="pointer-events-none absolute inset-x-2 bottom-1 flex justify-between font-mono text-[8px] text-cyan-200/45">
          <span>AI 학습 중…</span>
          <span>DATA {datasetSize} · FIT {accuracy}% · DEN {Math.round(density * 100)}%</span>
        </div>
      </div>
    </LabPanel>
  );
}

function NeuralActivity({ accuracy, density }: { accuracy: number; density: number }) {
  return (
    <LabPanel className="flex min-h-48 flex-1 flex-col p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-black tracking-[0.25em] text-cyan-300/60">
          NEURAL ACTIVITY
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[9px] text-emerald-300">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_7px_#6ee7b7]" />
          LEARNING
        </span>
      </div>
      <div className="relative min-h-36 flex-1 overflow-hidden border border-cyan-300/10 bg-[#010810]/75">
        <svg
          viewBox="0 0 240 120"
          preserveAspectRatio="none"
          className="size-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity=".26" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="scan-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
              <stop offset="50%" stopColor="#67e8f9" stopOpacity=".8" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[24, 48, 72, 96].map((y) => (
            <line key={y} x1="0" y1={y} x2="240" y2={y} stroke="#164e63" strokeOpacity=".28" />
          ))}
          {[40, 80, 120, 160, 200].map((x) => (
            <line key={x} x1={x} y1="0" x2={x} y2="120" stroke="#164e63" strokeOpacity=".18" />
          ))}
          <g>
            <path
              d="M0 68 L20 55 L40 72 L60 44 L80 61 L100 35 L120 57 L140 42 L160 65 L180 31 L200 50 L220 39 L240 68 L260 55 L280 72 L300 44 L320 61 L340 35 L360 57 L380 42 L400 65 L420 31 L440 50 L460 39 L480 68 L480 120 L0 120 Z"
              fill="url(#activity-fill)"
            />
            <path
              d="M0 68 L20 55 L40 72 L60 44 L80 61 L100 35 L120 57 L140 42 L160 65 L180 31 L200 50 L220 39 L240 68 L260 55 L280 72 L300 44 L320 61 L340 35 L360 57 L380 42 L400 65 L420 31 L440 50 L460 39 L480 68"
              fill="none"
              stroke="#67e8f9"
              strokeWidth="1.5"
            />
            <animateTransform
              attributeName="transform"
              type="translate"
              from="0 0"
              to="-240 0"
              dur="6s"
              repeatCount="indefinite"
            />
          </g>
          <g>
            <path
              d="M0 84 C18 67 34 91 54 76 S86 54 108 74 S142 82 162 62 S198 46 218 64 S228 74 240 84 C258 67 274 91 294 76 S326 54 348 74 S382 82 402 62 S438 46 458 64 S468 74 480 84"
              fill="none"
              stroke="#34d399"
              strokeWidth="1"
              strokeOpacity=".75"
              strokeDasharray="4 4"
            />
            <animateTransform
              attributeName="transform"
              type="translate"
              from="0 0"
              to="-240 0"
              dur="8s"
              repeatCount="indefinite"
            />
          </g>
          <rect x="-28" y="0" width="28" height="120" fill="url(#scan-line)" opacity=".25">
            <animate attributeName="x" from="-28" to="240" dur="3s" repeatCount="indefinite" />
          </rect>
        </svg>
        <div className="pointer-events-none absolute inset-x-2 bottom-1 flex justify-between font-mono text-[8px] text-cyan-200/45">
          <span>FIT {accuracy}%</span>
          <span>DENSITY {Math.round(density * 100)}%</span>
        </div>
      </div>
    </LabPanel>
  );
}

function HudRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-cyan-300/10 py-1.5">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono font-semibold text-cyan-300">{value}</span>
    </div>
  );
}

function ScoreCard({ label, value, weight }: { label: string; value: number; weight: string }) {
  return (
    <LabPanel className="p-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-xl font-bold text-white">{value}</p>
      <div className="mx-auto mt-2 h-1 w-full max-w-20 overflow-hidden bg-slate-900">
        <div className="h-full bg-cyan-400" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-slate-600">× {weight}</p>
    </LabPanel>
  );
}
