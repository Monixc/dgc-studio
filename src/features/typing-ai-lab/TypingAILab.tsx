import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Beaker, BookOpen, Brain, FlaskConical, RotateCcw, Swords, Timer, Trophy, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  applySessionHits,
  listTypingAiLabRanking,
  listWordStats,
  saveTypingAiLabResult,
  type TypingAiLabRankingRow,
} from "@/lib/typing-ai-lab";
import { WORDS, WORD_BY_ID, ensureLexicon, isLexiconReady, lexiconLoadedBand } from "./content";
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
  graphMetrics,
  refillSlots,
  remainingMs,
  submitInput,
  type GameState,
  type LabPlayMode,
  type SessionResult,
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

export default function TypingAILab({
  userId,
  displayName,
  onExit,
}: {
  userId: string;
  displayName: string;
  onExit: () => void;
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
  const inputRef = useRef<HTMLInputElement>(null);
  const rngRef = useRef<() => number>(() => Math.random());
  const finishedRef = useRef(false);
  const savedRef = useRef(false);
  const progressTick = useRef(0);

  const competition = useTypingAiCompetition({
    userId,
    displayName,
    poolIds: masteredIds,
  });

  const progress = useMemo(() => {
    void lexiconVersion;
    return progressionSnapshot(mastery);
  }, [mastery, lexiconVersion]);

  const refreshStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const rows = await listWordStats(userId);
      const counts: Record<string, number> = {};
      const mastered: string[] = [];
      for (const r of rows) {
        counts[r.word_id] = r.correct_count;
        if (r.mastered_at) mastered.push(r.word_id);
      }
      setMastery(counts);
      setMasteredIds(mastered);
    } catch {
      // 로컬 플레이 가능
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
    setPhase("menu");
  }, []);

  const learningMasteryCounts = useMemo(() => {
    // 세션 중 목표 도달한 단어도 즉시 제외되도록 DB 누적 + 이번 세션 합산
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

  // 매칭 → countdown 진입
  useEffect(() => {
    if (phase !== "matchmaking") return;
    if (competition.phase === "countdown" && competition.match) {
      const pool =
        competition.myPool.length >= MIN_COMPETITION_WORDS
          ? competition.myPool
          : masteredIds;
      void startCompetitionPlay(Number(competition.match.seed), pool);
    }
    if (competition.phase === "abandoned") {
      setPhase("menu");
    }
  }, [competition.phase, competition.match, competition.myPool, masteredIds, phase, startCompetitionPlay]);

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
    const session = finishSession(state);
    setResult(session);
    // 학습은 Training/문장생성 단계 없이 바로 결과
    if (state.mode === "learning") {
      setPhase("result");
      return;
    }
    setTrainingStep(0);
    setPhase("training");
  }, []);

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

  // 결과 저장 + 숙련 반영
  useEffect(() => {
    if (phase !== "result" || !result || savedRef.current) return;
    let cancelled = false;
    setSaving(true);
    void (async () => {
      try {
        if (result.mode === "learning") {
          const applied = await applySessionHits(result.sessionHits);
          if (!cancelled) {
            setNewlyMastered(
              applied.filter((r) => r.newly_mastered).map((r) => r.word_id),
            );
            await refreshStats();
          }
        }
        const saved = await saveTypingAiLabResult(userId, result);
        if (result.mode === "competition" && competition.match) {
          await competition.complete({
            totalScore: result.score.total,
            grade: result.score.grade,
            datasetSize: result.dataset.length,
            resultId: saved.id,
          });
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

  // 경쟁 중 진행률 브로드캐스트
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

  if (phase === "menu") {
    const lexiconBusy = lexiconStatus !== "ready" || statsLoading;
    return (
      <Shell onExit={onExit}>
        <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
          <div className="text-center">
            <span className="inline-flex rounded-2xl bg-emerald-500/15 p-4 text-emerald-300">
              <FlaskConical className="size-10" />
            </span>
            <h1 className="mt-4 text-3xl font-bold">AI 타이핑 연구소</h1>
            <p className="mt-2 text-sm text-zinc-400">
              개인 학습으로 단어를 숙련하고, 실시간 경쟁으로 연구 실력을 겨루세요.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-300">
            {lexiconStatus === "loading" || statsLoading ? (
              <p>학습 사전 불러오는 중…</p>
            ) : lexiconStatus === "error" ? (
              <div className="space-y-2">
                <p className="text-rose-400">사전 로드 실패: {lexiconError}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void loadLexiconForProgress(mastery)}
                >
                  다시 시도
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  학습 수준 <b className="text-emerald-300">Lv.{progress.unlockedBand}</b>
                </span>
                <span>
                  전체 숙련 <b className="text-white">{progress.masteredTotal}</b>
                </span>
                {progress.nextBand != null ? (
                  <span>
                    다음 난이도까지{" "}
                    <b className="text-amber-300">{progress.remainingToUnlock}</b>개 숙련
                    <span className="text-zinc-500">
                      {" "}
                      (Lv.{progress.unlockedBand}: {progress.bandMastered}/{progress.unlockNeed})
                    </span>
                  </span>
                ) : (
                  <span className="text-emerald-400">최고 난이도 해금 완료</span>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              disabled={lexiconBusy}
              onClick={() => void startLearning()}
              className={cn(
                "rounded-2xl border p-5 text-left transition",
                lexiconBusy
                  ? "border-zinc-800 bg-zinc-900/40 text-zinc-600"
                  : "border-zinc-700 bg-zinc-900/80 hover:border-emerald-500/50",
              )}
            >
              <Beaker className="size-6 text-emerald-400" />
              <h2 className="mt-3 font-bold">개인 학습</h2>
              <p className="mt-1 text-sm text-zinc-400">
                해금된 난이도만 출제. 숙련하면 다음 난이도가 열립니다.
              </p>
            </button>
            <button
              type="button"
              disabled={
                masteredIds.length < MIN_COMPETITION_WORDS || statsLoading || lexiconBusy
              }
              onClick={() => {
                setPhase("matchmaking");
                void competition.joinQueue();
              }}
              className={cn(
                "rounded-2xl border p-5 text-left transition",
                masteredIds.length < MIN_COMPETITION_WORDS || lexiconBusy
                  ? "border-zinc-800 bg-zinc-900/40 text-zinc-600"
                  : "border-zinc-700 bg-zinc-900/80 hover:border-amber-500/50",
              )}
            >
              <Swords className="size-6 text-amber-400" />
              <h2 className="mt-3 font-bold">실시간 경쟁</h2>
              <p className="mt-1 text-sm text-zinc-400">
                빠른 매칭 2인전. 숙련 단어 {masteredIds.length}/{MIN_COMPETITION_WORDS}
              </p>
            </button>
          </div>

          <div className="flex justify-center gap-2">
            <Button
              variant="secondary"
              disabled={statsLoading}
              onClick={() => void openLexicon()}
            >
              <BookOpen className="size-4" /> 단어 도감
            </Button>
            <Button variant="secondary" onClick={() => void loadRanking()}>
              <Trophy className="size-4" /> 경쟁 랭킹
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  if (phase === "lexicon") {
    return (
      <Shell onExit={() => setPhase("menu")} compact>
        <LexiconCatalog words={[...WORDS]} mastery={mastery} />
      </Shell>
    );
  }

  if (phase === "matchmaking") {
    return (
      <Shell onExit={() => { void competition.leave(); setPhase("menu"); }}>
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
          <Swords className="size-12 text-amber-400 motion-safe:animate-pulse" />
          <h2 className="text-2xl font-bold">
            {competition.phase === "queued" ? "상대 찾는 중…" : "매칭 중…"}
          </h2>
          {competition.error && <p className="text-sm text-rose-400">{competition.error}</p>}
          <Button variant="secondary" onClick={() => { void competition.cancel(); setPhase("menu"); }}>
            취소
          </Button>
        </div>
      </Shell>
    );
  }

  if (phase === "countdown" && game) {
    return (
      <Shell onExit={onExit}>
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4">
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">
            {playMode === "competition" ? "Competition" : "Research"}
          </p>
          <p className="text-8xl font-black text-emerald-400 tabular-nums motion-safe:animate-pulse">
            {countdown > 0 ? countdown : "GO"}
          </p>
          {playMode === "competition" && competition.opponent && (
            <p className="text-sm text-zinc-400">vs {competition.opponent.name}</p>
          )}
        </div>
      </Shell>
    );
  }

  if (phase === "playing" && game && live) {
    const secs = Math.ceil(live.remain / 1000);
    return (
      <Shell
        onExit={() => {
          if (playMode === "competition") void competition.leave();
          onExit();
        }}
        compact
      >
        <div className="mx-auto grid max-w-6xl gap-4 px-3 py-4 lg:grid-cols-[1fr_240px]">
          <div className="space-y-4">
            <header className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 py-3">
              <Timer className={cn("size-5", secs <= 10 && "text-rose-400")} />
              <span className={cn("font-mono text-2xl font-bold tabular-nums", secs <= 10 && "text-rose-400")}>
                {String(Math.floor(secs / 60)).padStart(2, "0")}:{String(secs % 60).padStart(2, "0")}
              </span>
              <span className="ml-auto text-sm text-zinc-400">
                정확도 <b className="text-white">{live.accuracy}%</b>
              </span>
              <span className="text-sm text-zinc-400">
                Combo <b className="text-amber-300">{game.combo}</b>
              </span>
              {playMode === "competition" && competition.opponent && (
                <span className="text-sm text-amber-200/80">
                  vs {competition.opponent.name} · {competition.opponent.datasetSize}단어
                  {!competition.opponent.online && " (이탈)"}
                </span>
              )}
            </header>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {game.slots.map((slot) => {
                const def = slot.wordId ? WORD_BY_ID[slot.wordId] : null;
                return (
                  <div
                    key={slot.id}
                    className={cn(
                      "flex min-h-16 flex-col items-center justify-center rounded-xl border px-2 py-1.5 text-center transition",
                      slot.refillAt
                        ? "border-transparent bg-zinc-900/40 text-transparent"
                        : "border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-emerald-500/50",
                    )}
                  >
                    <span className="text-sm font-semibold">{slot.refillAt ? "·" : slot.word}</span>
                    {playMode === "learning" && def && !slot.refillAt && (
                      <span className="mt-0.5 text-[10px] text-zinc-500">{def.meaningKo}</span>
                    )}
                  </div>
                );
              })}
            </div>

            <form onSubmit={onSubmitWord} className="sticky bottom-3">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="단어를 입력하고 Enter…"
                className="w-full rounded-2xl border border-emerald-500/40 bg-zinc-950 px-5 py-4 font-mono text-lg text-white outline-none ring-emerald-400/30 focus:ring-2"
              />
            </form>
          </div>

          <aside className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm">
            <HudRow label="Dataset" value={String(live.size)} />
            <HudRow label="Density" value={`${Math.round(live.density * 100)}%`} />
            <HudRow label="Coverage" value={`${Math.round(live.coverage * 100)}%`} />
            {playMode === "competition" && competition.opponent && (
              <HudRow label="상대 예상" value={String(competition.opponent.totalPreview)} />
            )}
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">최근 획득</p>
              <div className="flex flex-wrap gap-1.5">
                {game.lastAcquired.length === 0 ? (
                  <span className="text-zinc-600">아직 없음</span>
                ) : (
                  game.lastAcquired.map((w, i) => (
                    <span key={`${w}-${i}`} className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
                      {w}
                    </span>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </Shell>
    );
  }

  if (phase === "training") {
    const steps = ["Dataset 분석", "Knowledge Graph 구성", "문장 추론 생성"];
    return (
      <Shell onExit={onExit}>
        <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-20 text-center">
          <Brain className="size-12 text-emerald-400 motion-safe:animate-pulse" />
          <h2 className="text-2xl font-bold">Training Model…</h2>
          <ul className="w-full space-y-2 text-left">
            {steps.map((label, i) => (
              <li
                key={label}
                className={cn(
                  "rounded-xl border px-4 py-3 text-sm",
                  i < trainingStep
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : i === trainingStep
                      ? "border-zinc-600 bg-zinc-900 text-white"
                      : "border-zinc-800 text-zinc-600",
                )}
              >
                {i < trainingStep ? "✓ " : i === trainingStep ? "→ " : "· "}
                {label}
              </li>
            ))}
          </ul>
        </div>
      </Shell>
    );
  }

  if (phase === "ranking") {
    return (
      <Shell onExit={onExit}>
        <div className="mx-auto max-w-lg space-y-4 px-4 py-10">
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-amber-300" />
            <h2 className="text-xl font-bold">경쟁 랭킹</h2>
          </div>
          {rankingLoading ? (
            <p className="text-sm text-zinc-500">불러오는 중…</p>
          ) : ranking.length === 0 ? (
            <p className="text-sm text-zinc-500">아직 기록이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {ranking.map((row, i) => (
                <div
                  key={row.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                    row.isMe ? "border-emerald-500/50 bg-emerald-500/10" : "border-zinc-800 bg-zinc-900/60",
                  )}
                >
                  <span className="w-6 text-center text-xs text-zinc-500">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {row.display_name}{row.isMe ? " (나)" : ""}
                  </span>
                  <span className="font-mono text-xs text-zinc-400">{row.grade}</span>
                  <span className="font-mono text-sm font-bold text-emerald-300">{row.total_score}</span>
                </div>
              ))}
            </div>
          )}
          <Button onClick={resetRun}>메뉴로</Button>
        </div>
      </Shell>
    );
  }

  if (phase === "result" && result) {
    const s = result.score;
    const isLearning = result.mode === "learning";

    if (isLearning) {
      return (
        <Shell onExit={onExit}>
          <div className="mx-auto max-w-2xl space-y-5 px-4 py-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Learning Report</p>
                <h2 className="text-3xl font-black">
                  숙련 완료 <span className="text-emerald-400">{result.dataset.length}</span>
                </h2>
                <p className="mt-1 font-mono text-zinc-400">
                  정확도 {result.accuracy}% · 목표 횟수 도달 시 획득 · {displayName}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={resetRun}><RotateCcw className="size-4" /> 메뉴</Button>
                <Button variant="ghost" onClick={onExit}>나가기</Button>
              </div>
            </div>

            {saveError && saveError !== "saved" && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                저장 실패: {saveError} {saving ? "(재시도 중…)" : ""}
              </div>
            )}
            {saveError === "saved" && (
              <p className="text-xs text-emerald-400">숙련도가 저장되었습니다.</p>
            )}

            {newlyMastered.length > 0 && result.dataset.length === 0 && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="text-sm font-semibold text-emerald-200">새로 숙련된 단어</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {newlyMastered.map((id) => (
                    <span key={id} className="rounded-md bg-zinc-900 px-2 py-0.5 text-sm">
                      {WORD_BY_ID[id]?.word} · {WORD_BY_ID[id]?.meaningKo}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <Zap className="size-4 text-emerald-400" />{" "}
                이번 세션 획득 ({Math.max(result.dataset.length, newlyMastered.length)})
              </h3>
              <p className="mb-3 text-xs text-zinc-500">
                난이도별 3~7회 정타 후 숙련·획득됩니다. 한 번 입력만으로는 획득되지 않습니다.
              </p>
              {(newlyMastered.length > 0 ? newlyMastered : result.dataset).length === 0 ? (
                <p className="text-sm text-zinc-500">아직 목표 횟수에 도달한 단어가 없습니다.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(newlyMastered.length > 0 ? newlyMastered : result.dataset).map((id) => (
                    <span
                      key={id}
                      className="rounded-md bg-zinc-800 px-2 py-1 text-sm"
                      title={WORD_BY_ID[id]?.meaningKo}
                    >
                      {WORD_BY_ID[id]?.word}
                      <span className="ml-1 text-[10px] text-zinc-500">{WORD_BY_ID[id]?.meaningKo}</span>
                    </span>
                  ))}
                </div>
              )}
            </section>
          </div>
        </Shell>
      );
    }

    return (
      <Shell onExit={onExit}>
        <div className="mx-auto max-w-4xl space-y-5 px-4 py-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500">Competition Report</p>
              <h2 className="text-3xl font-black">
                Grade <span className="text-emerald-400">{s.grade}</span>
              </h2>
              <p className="mt-1 font-mono text-zinc-400">Total {s.total} · {displayName}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void loadRanking()}>
                <Trophy className="size-4" /> 랭킹
              </Button>
              <Button onClick={resetRun}><RotateCcw className="size-4" /> 메뉴</Button>
              <Button variant="ghost" onClick={onExit}>나가기</Button>
            </div>
          </div>

          {saveError && saveError !== "saved" && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              저장 실패: {saveError} {saving ? "(재시도 중…)" : ""}
            </div>
          )}
          {saveError === "saved" && (
            <p className="text-xs text-emerald-400">결과가 저장되었습니다.</p>
          )}

          {competition.opponent && (
            <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4 text-sm">
              상대 {competition.opponent.name} · Dataset {competition.opponent.datasetSize} · 예상 {competition.opponent.totalPreview}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-5">
            <ScoreCard label="Accuracy" value={s.accuracy} weight="20%" />
            <ScoreCard label="Dataset" value={s.dataset} weight="20%" />
            <ScoreCard label="Density" value={s.density} weight="25%" />
            <ScoreCard label="Coverage" value={s.coverage} weight="15%" />
            <ScoreCard label="Inference" value={s.inference} weight="20%" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <Zap className="size-4 text-emerald-400" /> Dataset ({result.datasetWords.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {result.dataset.map((id) => (
                  <span key={id} className="rounded-md bg-zinc-800 px-2 py-0.5 text-sm" title={WORD_BY_ID[id]?.meaningKo}>
                    {WORD_BY_ID[id]?.word}
                  </span>
                ))}
              </div>
            </section>
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
              <h3 className="mb-3 font-semibold">Generated Sentences</h3>
              {result.sentences.length === 0 ? (
                <p className="text-sm text-zinc-500">학습 데이터 부족 — 문장을 생성하지 못했습니다.</p>
              ) : (
                <ul className="space-y-1.5 text-sm text-zinc-300">
                  {result.sentences.map((snt) => (
                    <li key={snt.text} className="rounded-lg bg-zinc-950/60 px-3 py-2 font-mono">
                      {snt.text}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-zinc-500">
                Inference Success {Math.round(result.inferenceSuccess * 100)}%
              </p>
            </section>
          </div>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h3 className="mb-3 font-semibold">Knowledge Graph</h3>
            <KnowledgeGraph ids={result.dataset} edges={result.edges} />
          </section>
        </div>
      </Shell>
    );
  }

  return null;
}

function Shell({
  children,
  onExit,
  compact,
}: {
  children: React.ReactNode;
  onExit: () => void;
  compact?: boolean;
}) {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-zinc-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.12),_transparent_55%)]" />
      <div className={cn("relative", compact ? "pt-2" : "pt-3")}>
        <div className="mx-auto flex max-w-6xl items-center px-3">
          <Button variant="ghost" className="text-zinc-400 hover:text-white" onClick={onExit}>
            <ArrowLeft className="size-4" /> BACK
          </Button>
        </div>
        {children}
      </div>
    </main>
  );
}

function HudRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-800/80 py-1.5">
      <span className="text-zinc-500">{label}</span>
      <span className="font-mono font-semibold text-emerald-300">{value}</span>
    </div>
  );
}

function ScoreCard({ label, value, weight }: { label: string; value: number; weight: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 font-mono text-xl font-bold text-white">{value}</p>
      <p className="text-[10px] text-zinc-600">× {weight}</p>
    </div>
  );
}
