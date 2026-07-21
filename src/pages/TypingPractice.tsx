import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Atom, BookOpenText, Braces, CheckCircle2, ChevronRight, CodeXml, Database,
  FileCode2, FileType2, Flag, FlaskConical, Gauge, Ghost, History, Keyboard, Moon, Palette,
  Radio, RefreshCw, RotateCcw, Target, Terminal, Timer, Trophy, Zap,
} from "lucide-react";
import AppShell, { STUDENT_MENU } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import TypingAILab from "@/features/typing-ai-lab/TypingAILab";
import { useAuth } from "@/hooks/useAuth";
import {
  calculateTypingResult,
  mergeTypingRanking,
  remainingLineIndent,
  wpmToTaja,
  type TypingRankingEntry,
  type TypingResult,
} from "@/lib/typing";
import {
  TYPING_MODE_LABEL,
  listTypingPracticeLogs,
  saveTypingPracticeLog,
  type TypingPracticeLogView,
} from "@/lib/typing-logs";
import type { TypingPracticeMode } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { createContentProvider } from "@tajarace/content";
import {
  DEFAULT_RACE_LAPS,
  RACE_DISTANCE_CHARS,
  createGhostRaceController,
  createRealtimeRaceController,
  setActiveTrackId,
  type GhostRaceController,
  type RaceParticipant,
  type RaceState,
  type RealtimeRaceController,
  type TrackDefinition,
} from "@tajarace/racing";
import { createLocalStorageAdapter, type TypingRecord } from "@tajarace/storage";
import { F1Track } from "@tajarace/ui";
import { defaultTrackId, trackRegistry } from "@/vendor/tajarace/tracks";
import {
  CATEGORY_META,
  ShuffleBag,
  categoryFileName,
  filterByUnit,
  isCodeCategory,
  loadCategoryItems,
  type PracticeCategory,
  type PracticeContentItem,
  type ProseUnit,
} from "@/features/typing-practice/content";
import ProseTypingPane from "@/features/typing-practice/ProseTypingPane";
import CodeTypingPane from "@/features/typing-practice/CodeTypingPane";

type Mode = "home" | "racing" | "practice" | "ai-lab";
type RaceType = "live" | "ghost";
type Category = PracticeCategory;

const SESSION_MS = 5 * 60 * 1000;
const raceContentProvider = createContentProvider();
const raceStorage = createLocalStorageAdapter("flowpy:tajarace");

function applyTabIndent(
  text: string,
  cursorIndex: number,
  enter: (chunk: string) => void,
) {
  const indent = remainingLineIndent(text, cursorIndex);
  enter(indent || "\t");
}

interface GhostOption {
  id: string;
  name: string;
  wpm: number;
  accuracy: number;
  contentIndex: number;
}

const GHOSTS: GhostOption[] = [
  { id: "ghost-speed", name: "SpeedKing", wpm: 85, accuracy: 97, contentIndex: 0 },
  { id: "ghost-master", name: "TypeMaster", wpm: 72, accuracy: 95, contentIndex: 1 },
  { id: "ghost-rookie", name: "KeyRacer", wpm: 58, accuracy: 92, contentIndex: 2 },
];

function loadTypingRanking(myId: string, myName: string): TypingRankingEntry[] {
  const entries: TypingRankingEntry[] = [];

  try {
    const data = JSON.parse(localStorage.getItem("flowpy:tajarace") ?? "{}") as {
      raceResults?: Array<{ userId: string; wpm: number }>;
    };
    for (const result of data.raceResults ?? []) {
      if (result.userId !== myId && result.userId.startsWith("bot-")) continue;
      entries.push({
        id: result.userId,
        name: result.userId === myId ? myName : result.userId,
        taja: wpmToTaja(result.wpm),
        isMe: result.userId === myId,
      });
    }
  } catch {
    // 손상된 로컬 기록은 무시하고 기본 랭킹을 표시한다.
  }

  const practiceBest = Math.max(
    0,
    ...CATEGORIES.map(({ id }) => Number(localStorage.getItem(`flowpy:typing-best-taja:${myId}:${id}`) ?? 0)),
  );
  if (practiceBest > 0) {
    entries.push({ id: myId, name: myName, taja: practiceBest, isMe: true });
  }
  return mergeTypingRanking(entries).slice(0, 10);
}

function createGhostData(ghost: GhostOption) {
  const content = raceContentProvider.getByCategory("english")[ghost.contentIndex]!;
  const pool = raceContentProvider.getByCategory("english");
  const snippets = Array.from(
    { length: 100 },
    (_, index) => pool[(ghost.contentIndex + index) % pool.length]!.text,
  );
  const snippetEnds: number[] = [];
  let cursor = 0;
  for (const snippet of snippets) {
    cursor += snippet.length;
    snippetEnds.push(cursor);
    cursor += 1;
  }
  const text = snippets.join(" ");
  const elapsedMs = (RACE_DISTANCE_CHARS / 5 / ghost.wpm) * 60_000;
  const keystrokeTimeline = Array.from({ length: RACE_DISTANCE_CHARS + 1 }, (_, index) => ({
    index,
    elapsedMs: (index / RACE_DISTANCE_CHARS) * elapsedMs,
    wpm: ghost.wpm + Math.sin(index / 8) * 3,
    progress: index / RACE_DISTANCE_CHARS,
  }));
  const record: TypingRecord = {
    id: `seed-${ghost.id}`,
    userId: ghost.name,
    contentId: content.id,
    category: "english",
    wpm: ghost.wpm,
    accuracy: ghost.accuracy,
    elapsedMs,
    createdAt: 0,
    keystrokeTimeline,
  };
  return { content, text, snippetEnds, record, keystrokeTimeline };
}

function getRaceSnippetView(
  fullText: string,
  cursor: number,
  statuses: readonly ("correct" | "incorrect" | "pending")[],
  snippetEnds: number[],
) {
  const foundIndex = snippetEnds.findIndex((end) => cursor <= end);
  const index = foundIndex === -1 ? snippetEnds.length - 1 : foundIndex;
  const end = snippetEnds[index] ?? fullText.length;
  const start = index === 0 ? 0 : (snippetEnds[index - 1] ?? -1) + 1;
  return {
    number: index + 1,
    text: fullText.slice(start, end),
    typedLength: Math.min(end - start, Math.max(0, cursor - start)),
    statuses: statuses.slice(start, end),
  };
}

const CATEGORIES = CATEGORY_META;
const PRACTICE_CATEGORY_ICON: Record<Category, typeof Keyboard> = {
  english: BookOpenText,
  python: FileCode2,
  lua: Moon,
  javascript: Braces,
  html: CodeXml,
  typescript: FileType2,
  sql: Database,
  react: Atom,
  css: Palette,
  shell: Terminal,
};
const PRACTICE_CATEGORY_LOGO: Partial<Record<Category, {
  src: string;
  cutout?: "dark" | "light";
}>> = {
  python: { src: "/code-typing/python-logo-only.svg" },
  lua: { src: "/code-typing/Lua-Logo.svg", cutout: "light" },
  javascript: { src: "/code-typing/javaScript_logo.svg", cutout: "dark" },
  html: { src: "/code-typing/HTML5_logo.svg", cutout: "light" },
  typescript: { src: "/code-typing/Typescript_logo.svg", cutout: "light" },
  sql: { src: "/code-typing/Sql_data_base_with_logo.svg" },
  react: { src: "/code-typing/React-icon.svg" },
  css: { src: "/code-typing/CSS3_logo_and_wordmark.svg", cutout: "light" },
};

export default function TypingPractice() {
  const { user, role, profile } = useAuth();
  const [mode, setMode] = useState<Mode>("home");
  const menu = role === "student" ? STUDENT_MENU : undefined;
  const homePath = role === "student" ? "/student" : "/dashboard";
  const myName = profile?.display_name || user?.user_metadata?.display_name || "나";
  const myId = user?.id ?? "guest";
  const ranking = mode === "home" ? loadTypingRanking(myId, myName) : [];
  const logStudentCompletion = useCallback(
    (practiceMode: TypingPracticeMode, taja: number, won = false, matchId?: string) => {
      if (role !== "student" || !user?.id) return;
      void saveTypingPracticeLog(practiceMode, taja, won, matchId).catch(() => undefined);
    },
    [role, user?.id],
  );

  if (mode === "racing") {
    return (
      <RaceMode
        myId={myId}
        myName={myName}
        onComplete={logStudentCompletion}
        onExit={() => setMode("home")}
      />
    );
  }

  if (mode === "ai-lab") {
    return (
      <TypingAILab
        userId={myId}
        displayName={myName}
        onComplete={logStudentCompletion}
        onExit={() => setMode("home")}
      />
    );
  }

  if (mode === "practice") {
    return (
      <PracticeMode
        userId={myId}
        onComplete={logStudentCompletion}
        onExit={() => setMode("home")}
      />
    );
  }

  return (
    <AppShell menu={menu} homePath={homePath}>
      <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
        <header>
          <div className="flex items-center gap-2">
            <Keyboard className="size-6 text-primary" />
            <h1 className="text-2xl font-bold">타자 연습</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">레이싱으로 겨루거나, 연습으로 타수를 키워 보세요.</p>
        </header>

        <TypingModeHome ranking={ranking} onSelect={setMode} />
        {role === "teacher" && <TeacherTypingLogs />}
      </div>
    </AppShell>
  );
}

function TypingModeHome({
  ranking,
  onSelect,
}: {
  ranking: TypingRankingEntry[];
  onSelect: (mode: Mode) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(250px,1fr)]">
      <section className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onSelect("racing")}
          className="group flex min-h-52 flex-col justify-between rounded-2xl bg-cover bg-center p-6 text-left text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:col-span-2"
          style={{ backgroundImage: "linear-gradient(rgb(9 9 11 / 55%), rgb(9 9 11 / 82%)), url('/racing/typing-racing-hero.png')" }}
        >
          <div className="flex items-start justify-between">
            <span className="rounded-xl bg-white/10 p-3"><Flag className="size-6" /></span>
            <ChevronRight className="size-5 text-white/50 transition group-hover:translate-x-1" />
          </div>
          <div>
            <h2 className="text-xl font-bold">레이싱</h2>
            <p className="mt-2 text-sm text-white/65">라이브·고스트로 트랙에서 타수 경쟁</p>
          </div>
        </button>

        <ModeCard
          icon={FlaskConical}
          title="AI 타이핑 연구소"
          description="단어 Dataset으로 Graph·문장 추론 연구"
          backgroundImage="/typing-ai-lab/background.png"
          onClick={() => onSelect("ai-lab")}
        />
        <ModeCard
          icon={Keyboard}
          title="일반 연습"
          description="문학 영타·9종 코드 5분 집중 연습"
          onClick={() => onSelect("practice")}
        />
      </section>

      <aside className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Gauge className="size-5 text-primary" />
          <h2 className="font-semibold">타자 속도 랭킹</h2>
        </div>
        <div className="space-y-2">
          {ranking.map((entry, index) => (
            <div
              key={entry.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                entry.isMe && "border-primary bg-primary/5",
              )}
            >
              <span className="w-5 text-center text-xs font-semibold text-muted-foreground">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {entry.name}{entry.isMe ? " (나)" : ""}
              </span>
              <span className="font-mono text-sm font-bold text-primary">{entry.taja}</span>
              <span className="text-[10px] text-muted-foreground">타</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function ModeCard({
  icon: Icon,
  title,
  description,
  backgroundImage,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  backgroundImage?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex min-h-44 flex-col justify-between rounded-2xl border bg-card bg-cover bg-center p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md",
        backgroundImage && "border-cyan-300/25 text-white",
      )}
      style={backgroundImage ? {
        backgroundImage: `linear-gradient(rgb(1 8 16 / 38%), rgb(1 8 16 / 88%)), url('${backgroundImage}')`,
      } : undefined}
    >
      <div className="flex items-start justify-between">
        <span className={cn(
          "rounded-xl bg-primary/10 p-3 text-primary",
          backgroundImage && "border border-cyan-200/20 bg-cyan-300/15 text-cyan-100 backdrop-blur-sm",
        )}><Icon className="size-5" /></span>
        <ChevronRight className={cn(
          "size-5 text-muted-foreground transition group-hover:translate-x-1",
          backgroundImage && "text-white/60",
        )} />
      </div>
      <div>
        <h2 className="font-bold">{title}</h2>
        <p className={cn("mt-1 text-sm text-muted-foreground", backgroundImage && "text-white/70")}>
          {description}
        </p>
      </div>
    </button>
  );
}

function TeacherTypingLogs() {
  const [logs, setLogs] = useState<TypingPracticeLogView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setLogs(await listTypingPracticeLogs());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  return (
    <section className="mt-5 rounded-2xl border bg-card p-5 shadow-sm">
      <header className="mb-4 flex items-center gap-2">
        <History className="size-5 text-primary" />
        <div>
          <h2 className="font-semibold">학생 타자 연습 완료 로그</h2>
          <p className="text-xs text-muted-foreground">최근 완료 기록 100건</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto"
          onClick={() => void load()}
          disabled={loading}
          aria-label="로그 새로고침"
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
        </Button>
      </header>

      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          로그를 불러오지 못했습니다. DB 마이그레이션 적용 여부를 확인하세요.
        </p>
      ) : loading && logs.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">로그 불러오는 중…</p>
      ) : logs.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">아직 완료 기록이 없습니다.</p>
      ) : (
        <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-3 py-2.5 text-sm"
            >
              <span className="font-semibold">[{log.student_name}]</span>
              <span>
                {TYPING_MODE_LABEL[log.mode]} 연습 완료
                {" - "}
                타수 <b>{log.taja.toLocaleString()}타</b>
                {" · "}
                포인트 획득 <b>{log.points}P</b>
              </span>
              <time className="ml-auto text-xs text-muted-foreground" dateTime={log.completed_at}>
                {new Date(log.completed_at).toLocaleString("ko-KR", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Race ── */

function RaceMode({
  myId,
  myName,
  onComplete,
  onExit,
}: {
  myId: string;
  myName: string;
  onComplete: (mode: TypingPracticeMode, taja: number, won?: boolean) => void;
  onExit: () => void;
}) {
  const [seed, setSeed] = useState(0);
  const [trackId, setTrackId] = useState(defaultTrackId);
  const [raceType, setRaceType] = useState<RaceType | null>(null);
  const [inRace, setInRace] = useState(false);
  const tracks = trackRegistry.list();
  const track = trackRegistry.get(trackId);
  const trackIndex = tracks.findIndex((item) => item.id === trackId);

  const moveTrack = (direction: -1 | 1) => {
    const nextIndex = (trackIndex + direction + tracks.length) % tracks.length;
    setTrackId(tracks[nextIndex]!.id);
  };

  useEffect(() => {
    setActiveTrackId(trackId);
  }, [trackId]);

  useEffect(() => {
    setInRace(false);
  }, [raceType, seed, trackId]);

  if (!raceType) {
    return (
      <main className="relative flex min-h-screen overflow-hidden bg-zinc-950 text-white">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/racing/typing-racing-hero.png')" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.78)_0%,rgba(0,0,0,.16)_42%,rgba(0,0,0,.88)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(0,0,0,.62)_100%)]" />

        <button
          type="button"
          onClick={onExit}
          className="group absolute left-4 top-4 z-20 flex items-center gap-2 border border-red-500/60 bg-black/35 px-5 py-2 text-sm font-black italic text-white/80 backdrop-blur-sm transition hover:bg-white/10 hover:text-white md:left-8 md:top-8"
        >
          <ArrowLeft className="size-4" />
          BACK
        </button>

        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-20 md:px-10 md:py-14">
          <header className="text-center">
            <div className="mb-3 flex items-center justify-center gap-3 text-xs font-black uppercase tracking-[0.45em] text-white/50">
              <span className="h-px w-10 bg-white/30" />
              <Zap className="size-4" />
              Select game mode
              <span className="h-px w-10 bg-white/30" />
            </div>
            <h1 className="-skew-x-6 text-5xl font-black italic tracking-tighter drop-shadow-[0_4px_20px_rgba(0,0,0,.9)] sm:text-7xl md:text-8xl">
              TYPING <span className="text-white/70">RACING</span>
            </h1>
            <p className="mt-3 text-sm font-medium tracking-[0.3em] text-white/55">
              키보드가 곧 엔진이다
            </p>
          </header>

          <div className="ml-auto mt-5 hidden items-center gap-3 text-[10px] font-bold tracking-[0.22em] text-white/50 md:flex">
            <span className="size-1.5 animate-pulse rounded-full bg-white/70 shadow-[0_0_10px_rgba(255,255,255,.5)]" />
            RACING SYSTEM ONLINE
            <span className="h-px w-20 bg-gradient-to-r from-white/40 to-transparent" />
          </div>

          <section className="mt-auto grid w-full gap-3 sm:mx-auto sm:max-w-xl md:mb-5 md:ml-auto md:mr-0 md:max-w-md">
            <RaceModeCard
              icon={Radio}
              eyebrow="MULTIPLAYER"
              title="라이브 모드"
              description="봇 레이서들과 펼치는 3랩 실시간 승부"
              accent="red"
              onClick={() => setRaceType("live")}
            />
            <RaceModeCard
              icon={Ghost}
              eyebrow="TIME ATTACK"
              title="고스트 모드"
              description="기록된 라이벌의 고스트와 펼치는 1:1 대결"
              accent="blue"
              onClick={() => setRaceType("ghost")}
            />
          </section>
        </div>
      </main>
    );
  }

  const ghostMode = raceType === "ghost";

  return (
    <main className="relative h-screen overflow-y-auto bg-zinc-950">
      <div
        className="fixed inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: "url('/racing/typing-racing-hero.png')" }}
      />
      <div className="fixed inset-0 bg-zinc-950/80" />
      <div className="relative z-10 mx-auto max-w-5xl space-y-4 p-4 pb-12 md:p-6">
        {inRace ? (
          <div className={cn(
            "flex items-center justify-between border bg-black/50 px-4 py-2 text-white",
            ghostMode ? "border-cyan-400/30" : "border-red-500/30",
          )}>
            <span className={cn(
              "text-[9px] font-black tracking-[0.28em]",
              ghostMode ? "text-cyan-300" : "text-red-400",
            )}>TRACK</span>
            <span className="text-sm font-black italic tracking-wide">{track.name}</span>
            <span className="font-mono text-[10px] font-bold text-white/40">
              {String(trackIndex + 1).padStart(2, "0")} / {String(tracks.length).padStart(2, "0")}
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <button
                type="button"
                className={cn(
                  "group relative flex items-center gap-2 border bg-black/40 px-5 py-2 text-sm font-black italic text-white transition hover:bg-white/10",
                  ghostMode ? "border-cyan-400/60" : "border-red-500/60",
                )}
                onClick={() => setRaceType(null)}
              >
                <ArrowLeft className="size-4" /> BACK
              </button>
              <span className="text-sm font-black italic tracking-wider text-white">
                TYPING <span className="text-red-500">RACING</span>
              </span>
            </div>
            <div className="flex h-[50px] items-stretch bg-black/25 text-white shadow-xl backdrop-blur-md">
              <button
                type="button"
                onClick={() => moveTrack(-1)}
                aria-label="이전 트랙"
                className={cn(
                  "grid w-14 shrink-0 place-items-center border bg-zinc-950/90 transition hover:text-white",
                  ghostMode
                    ? "border-cyan-400/60 text-cyan-300 hover:bg-cyan-700"
                    : "border-red-500/60 text-red-400 hover:bg-red-600",
                )}
              >
                <ChevronRight className="size-5 rotate-180" />
              </button>
              <div className={cn(
                "relative flex min-w-0 flex-1 items-center justify-between gap-3 border-y bg-black/45 px-5 py-2",
                ghostMode ? "border-cyan-400/45" : "border-red-500/45",
              )}>
                <div className="min-w-0">
                  <span className={cn(
                    "block text-[9px] font-black italic tracking-[0.25em]",
                    ghostMode ? "text-cyan-300" : "text-red-400",
                  )}>SELECT TRACK</span>
                  <span className="block truncate text-sm font-black italic tracking-wide">{track.name}</span>
                </div>
                <span className="shrink-0 font-mono text-xs font-bold text-white/40">
                  {String(trackIndex + 1).padStart(2, "0")} / {String(tracks.length).padStart(2, "0")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => moveTrack(1)}
                aria-label="다음 트랙"
                className={cn(
                  "grid w-14 shrink-0 place-items-center border bg-zinc-950/90 transition hover:text-white",
                  ghostMode
                    ? "border-cyan-400/60 text-cyan-300 hover:bg-cyan-700"
                    : "border-red-500/60 text-red-400 hover:bg-red-600",
                )}
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          </>
        )}
        {raceType === "live" ? (
          <RaceRound
            key={seed}
            myId={myId}
            myName={myName}
            track={track}
            onComplete={onComplete}
            onRematch={() => setSeed((n) => n + 1)}
            onExit={() => {
              setInRace(false);
              setRaceType(null);
            }}
            onInRaceChange={setInRace}
          />
        ) : (
          <GhostRace
            key={trackId}
            myId={myId}
            myName={myName}
            track={track}
            onComplete={onComplete}
            onExit={() => {
              setInRace(false);
              setRaceType(null);
            }}
            onInRaceChange={setInRace}
          />
        )}
      </div>
    </main>
  );
}

function RaceModeCard({
  icon: Icon,
  eyebrow,
  title,
  description,
  accent,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  description: string;
  accent: "red" | "blue";
  onClick: () => void;
}) {
  const red = accent === "red";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden border bg-black/30 p-4 text-left backdrop-blur-[2px] transition duration-300 hover:-translate-x-2 hover:bg-black/70 hover:shadow-[0_0_35px_rgba(255,255,255,.12)] sm:p-5",
        red ? "border-red-500/65" : "border-cyan-400/60",
      )}
    >
      <span className="absolute right-7 top-1 text-6xl font-black italic text-white opacity-[0.05]">
        {red ? "S" : "A"}
      </span>
      <div className="flex items-center gap-4">
        <span className={cn(
          "relative grid size-16 shrink-0 place-items-center border bg-black/35 text-white/70",
          red ? "border-red-500/65" : "border-cyan-400/60",
        )}>
          <Icon className="size-7 transition group-hover:scale-110" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="border border-white/20 bg-white/5 px-2 py-0.5 text-[9px] font-black tracking-[0.2em] text-white/70">
              {red ? "LIVE" : "GHOST"}
            </span>
            <span className="border border-white/15 bg-black/25 px-2 py-0.5 text-[9px] font-bold tracking-wider text-white/55">
              {red ? "3 LAPS" : "1 VS 1"}
            </span>
          </div>
          <span className="mt-2 block text-[9px] font-black tracking-[0.28em] text-white/45">{eyebrow}</span>
          <h2 className="mt-1 text-2xl font-black italic text-white">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/55">{description}</p>
        </div>
        <div className="flex items-center">
          <span className="text-xl font-black tracking-[-0.2em] text-white/45">
            ›››
          </span>
          <ChevronRight className="size-5 text-white/35 transition group-hover:translate-x-1 group-hover:text-white" />
        </div>
      </div>
    </button>
  );
}

function RaceRound({
  myId, myName, track, onComplete, onRematch, onExit, onInRaceChange,
}: {
  myId: string;
  myName: string;
  track: TrackDefinition;
  onComplete: (mode: TypingPracticeMode, taja: number, won?: boolean) => void;
  onRematch: () => void;
  onExit: () => void;
  onInRaceChange: (inRace: boolean) => void;
}) {
  const controller = useMemo<RealtimeRaceController>(
    () => createRealtimeRaceController({
      contentProvider: raceContentProvider,
      storage: raceStorage,
      myId,
      myName,
      botParticipants: [
        { id: "bot-1", name: "Bot_Alpha", targetWpm: 55 },
        { id: "bot-2", name: "Bot_Beta", targetWpm: 70 },
        { id: "bot-3", name: "Bot_Gamma", targetWpm: 45 },
      ],
    }),
    [myId, myName],
  );
  const [state, setState] = useState<RaceState>(() => controller.getState());
  const [pointsMap, setPointsMap] = useState<Record<string, number>>({});
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const completionLoggedRef = useRef(false);

  useEffect(() => {
    void raceStorage.getUser(myId).then((existing) =>
      raceStorage.saveUser(existing ?? { id: myId, name: myName, points: 0 }),
    );
    controller.joinLobby();
    setState({ ...controller.getState() });

    const unsub = controller.subscribe((event) => {
      if (event.type === "lobby-update") setState({ ...event.state });
      if (event.type === "countdown" || event.type === "race-start") {
        setState({ ...controller.getState() });
      }
      if (event.type === "position-update") {
        setState((previous) => ({ ...previous, participants: event.participants }));
      }
      if (event.type === "race-finish") {
        setState({ ...controller.getState() });
        setPointsMap(event.pointsMap);
        if (!completionLoggedRef.current) {
          completionLoggedRef.current = true;
          const mine = event.rankings.find((participant) => participant.id === myId);
          onComplete(
            "race_live",
            wpmToTaja(mine?.wpm ?? 0),
            mine?.rank === 1 || event.rankings[0]?.id === myId,
          );
        }
      }
    });

    return () => {
      unsub();
      controller.destroy();
    };
  }, [controller, myId, myName, onComplete]);

  useEffect(() => {
    onInRaceChange(state.status !== "waiting");
  }, [onInRaceChange, state.status]);

  useEffect(() => {
    if (state.status === "racing") inputRef.current?.focus();
  }, [state.status]);

  const session = controller.getSession();
  const stats = session?.getStats();
  const me = state.participants.find((participant) => participant.id === myId);
  const isReady = me?.isReady ?? false;
  const canStart = state.participants.every((participant) => participant.isReady);
  const cursor = session?.getCursorIndex() ?? 0;
  const statuses = session?.getCharStatuses() ?? [];
  const snippetView = getRaceSnippetView(state.text, cursor, statuses, state.snippetEnds);
  const currentLap = me?.isFinished
    ? DEFAULT_RACE_LAPS
    : Math.min(DEFAULT_RACE_LAPS, Math.floor((me?.progress ?? 0) * DEFAULT_RACE_LAPS) + 1);
  const showHud = state.status === "racing" || state.status === "finished";
  const awaitingSnippet = state.status === "racing" && Boolean(me?.isFinished);
  const inputComplete = awaitingSnippet && state.snippetEnds.includes(cursor);

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (state.status !== "racing" || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "Backspace") {
      event.preventDefault();
      controller.handleBackspace();
    } else if (event.key === "Enter") {
      event.preventDefault();
      controller.handleInput("\n");
    } else if (event.key === "Tab") {
      event.preventDefault();
      applyTabIndent(session?.text ?? "", cursor, (chunk) => {
        for (const char of chunk) controller.handleInput(char);
      });
    } else if (event.key.length === 1) {
      event.preventDefault();
      controller.handleInput(event.key);
    }
  };

  return (
    <div className="space-y-4">
      <RaceTrackPanel
        track={track}
        participants={state.participants}
        myId={myId}
        label={state.status === "waiting" ? "TRACK PREVIEW" : "LIVE RACE"}
        hud={showHud ? {
          taja: wpmToTaja(stats?.wpm ?? me?.wpm ?? 0),
          speed: Math.round((me?.speed ?? 0) * 120),
          accuracy: stats?.accuracy ?? 100,
          lap: `${currentLap}/${DEFAULT_RACE_LAPS}`,
          rank: `${me?.rank ?? "-"}`,
        } : undefined}
      />

      {state.status === "waiting" && (
        <section className="border border-red-500/30 bg-black/55 p-4 text-white shadow-[0_0_28px_rgba(0,0,0,.45)] backdrop-blur-md">
          <header className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
            <div>
              <span className="text-[9px] font-black tracking-[0.24em] text-red-400">MULTIPLAYER LOBBY</span>
              <h2 className="text-base font-black italic">출발 대기</h2>
            </div>
            <div className="flex items-center gap-2 text-[9px] font-bold tracking-wider text-white/50">
              <span className="size-1.5 animate-pulse rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
              WAITING
            </div>
          </header>
          <div className="mb-3 grid grid-cols-2 gap-2">
            {[...state.participants].sort((a, b) => a.rank - b.rank).map((participant) => (
              <div
                key={participant.id}
                className={cn(
                  "relative flex min-w-0 items-center gap-2 border bg-white/[0.035] px-2.5 py-2",
                  participant.id === myId ? "border-red-500/50" : "border-white/10",
                )}
              >
                <span className={cn(
                  "grid size-7 shrink-0 place-items-center border text-[10px] font-black italic",
                  participant.id === myId
                    ? "border-red-500/60 bg-red-600/20 text-red-300"
                    : "border-white/15 bg-black/30 text-white/55",
                )}>
                  P{participant.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold">
                    {participant.name}{participant.id === myId ? " · ME" : ""}
                  </p>
                  <span className={cn(
                    "flex items-center gap-1 text-[9px] font-black tracking-wider",
                    participant.isReady ? "text-emerald-400" : "text-amber-400/70",
                  )}>
                    <span className={cn(
                      "size-1.5 rounded-full",
                      participant.isReady ? "bg-emerald-400" : "animate-pulse bg-amber-400",
                    )} />
                    {participant.isReady ? "READY" : "STANDBY"}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => controller.setReady(!isReady)}
              className={cn(
                "border px-4 py-2.5 text-sm font-black italic tracking-wide transition",
                isReady
                  ? "border-white/25 bg-black/35 text-white/70 hover:bg-white/10"
                  : "border-red-500/65 bg-red-700/80 text-white shadow-[0_0_18px_rgba(239,68,68,.25)] hover:bg-red-600",
              )}
            >
              {isReady ? "CANCEL" : "READY"}
            </button>
            <button
              type="button"
              onClick={() => controller.startRace()}
              disabled={!canStart}
              className="border border-red-400 bg-gradient-to-r from-red-700 to-red-500 px-4 py-2.5 text-sm font-black italic tracking-wide text-white shadow-[0_0_20px_rgba(239,68,68,.3)] transition hover:brightness-125 disabled:cursor-not-allowed disabled:border-white/10 disabled:from-zinc-900 disabled:to-zinc-800 disabled:text-white/25 disabled:shadow-none"
            >
              START ››
            </button>
          </div>
        </section>
      )}

      {state.status === "countdown" && (
        <section className="border border-red-500/40 bg-black/70 py-10 text-center text-white">
          <span className="text-[9px] font-black tracking-[0.35em] text-red-400">GET READY</span>
          <div className="mt-2 font-mono text-7xl font-black italic text-red-500">
            {state.countdown > 0 ? state.countdown : "GO!"}
          </div>
        </section>
      )}

      {(state.status === "racing" || state.status === "finished") && (
        <TypingPane
          variant="game"
          text={snippetView.text}
          title={`SNIPPET ${snippetView.number}`}
          typedLength={snippetView.typedLength}
          statuses={snippetView.statuses}
          inputRef={inputRef}
          onKeyDown={onKeyDown}
          disabled={state.status === "finished" || inputComplete}
          hint={
            inputComplete
              ? "입력 완료 · 다른 주자 대기 중"
              : awaitingSnippet
              ? "결승선 통과 · 현재 스니펫을 완료하세요"
              : state.status === "racing" ? "입력 중" : "레이스 종료"
          }
        />
      )}

      {state.status === "finished" && (
        <section className="border border-red-500/30 bg-black/55 p-5 text-white">
          <header className="mb-4 border-b border-white/10 pb-3">
            <span className="text-[9px] font-black tracking-[0.28em] text-red-400">RACE COMPLETE</span>
            <h2 className="text-xl font-black italic">레이스 결과</h2>
          </header>
          <div className="space-y-2">
            {state.participants.map((participant) => (
              <div
                key={participant.id}
                className={cn(
                  "flex items-center justify-between border bg-white/[0.025] px-3 py-2 text-sm",
                  participant.id === myId ? "border-red-500/45" : "border-white/10",
                )}
              >
                <div className="flex items-center gap-2">
                  <RankBadge rank={participant.rank} />
                  <span className={participant.id === myId ? "font-semibold" : ""}>
                    {participant.name}{participant.id === myId ? " (나)" : ""}
                  </span>
                </div>
                <div className="text-right font-mono">
                  <div>{wpmToTaja(participant.wpm)}타</div>
                  {pointsMap[participant.id] !== undefined && (
                    <div className="text-xs text-amber-400">+{pointsMap[participant.id]} pts</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onExit}
              className="flex items-center justify-center gap-2 border border-white/20 bg-black/45 px-4 py-3 text-sm font-black italic tracking-wide text-white/70 transition hover:border-white/40 hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="size-4" /> 종료하기
            </button>
            <button
              type="button"
              onClick={onRematch}
              className="flex items-center justify-center gap-2 border border-red-400 bg-gradient-to-r from-red-700 to-red-500 px-4 py-3 text-sm font-black italic tracking-wide text-white shadow-[0_0_20px_rgba(239,68,68,.25)] transition hover:brightness-125"
            >
              <RotateCcw className="size-4" /> 다시 레이스
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function GhostRace({
  myId,
  myName,
  track,
  onComplete,
  onExit,
  onInRaceChange,
}: {
  myId: string;
  myName: string;
  track: TrackDefinition;
  onComplete: (mode: TypingPracticeMode, taja: number, won?: boolean) => void;
  onExit: () => void;
  onInRaceChange: (inRace: boolean) => void;
}) {
  const [selected, setSelected] = useState<GhostOption | null>(null);
  const [roundSeed, setRoundSeed] = useState(0);

  useEffect(() => {
    onInRaceChange(!!selected);
  }, [onInRaceChange, selected]);

  if (!selected) {
    return (
      <div className="space-y-4">
        <RaceTrackPanel
          track={track}
          participants={[]}
          myId={myId}
          label="GHOST TRACK PREVIEW"
          footerText="SELECT A RIVAL"
          accent="cyan"
        />
        <section className="border border-cyan-400/30 bg-black/55 p-4 text-white shadow-[0_0_30px_rgba(34,211,238,.1)] backdrop-blur-md md:p-5">
          <header className="flex items-end justify-between border-b border-white/10 pb-3">
            <div>
              <span className="text-[9px] font-black tracking-[0.26em] text-cyan-300">GHOST DATABASE</span>
              <h2 className="mt-0.5 text-xl font-black italic">라이벌 선택</h2>
              <p className="mt-1 text-xs text-white/45">저장된 3랩 기록과 1:1로 경쟁합니다.</p>
            </div>
            <div className="hidden items-center gap-2 text-[9px] font-bold tracking-wider text-cyan-300/65 sm:flex">
              <span className="size-1.5 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]" />
              {GHOSTS.length} RECORDS FOUND
            </div>
          </header>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {GHOSTS.map((ghost, index) => (
              <button
                key={ghost.id}
                type="button"
                onClick={() => setSelected(ghost)}
                className="group relative overflow-hidden border border-white/10 bg-white/[0.035] p-3 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/70 hover:bg-cyan-400/10 hover:shadow-[0_0_20px_rgba(34,211,238,.12)]"
              >
                <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center border border-cyan-400/35 bg-cyan-400/10 text-cyan-300">
                    <Ghost className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-black tracking-[0.2em] text-white/30">
                      GHOST {String(index + 1).padStart(2, "0")}
                    </span>
                    <p className="truncate text-sm font-black italic">{ghost.name}</p>
                  </div>
                  <ChevronRight className="mt-3 size-4 text-white/25 transition group-hover:translate-x-1 group-hover:text-cyan-300" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  <span className="border border-cyan-400/20 bg-black/30 px-2 py-1.5">
                    <span className="block text-[8px] font-bold tracking-wider text-white/35">SPEED</span>
                    <span className="font-mono text-sm font-black text-cyan-200">{wpmToTaja(ghost.wpm)}타</span>
                  </span>
                  <span className="border border-cyan-400/20 bg-black/30 px-2 py-1.5">
                    <span className="block text-[8px] font-bold tracking-wider text-white/35">ACCURACY</span>
                    <span className="font-mono text-sm font-black text-cyan-200">{ghost.accuracy}%</span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <GhostRaceRound
      key={`${selected.id}-${roundSeed}`}
      myId={myId}
      myName={myName}
      ghost={selected}
      track={track}
      onComplete={onComplete}
      onExit={onExit}
      onRematch={() => setRoundSeed((seed) => seed + 1)}
    />
  );
}

function GhostRaceRound({
  myId,
  myName,
  ghost,
  track,
  onComplete,
  onExit,
  onRematch,
}: {
  myId: string;
  myName: string;
  ghost: GhostOption;
  track: TrackDefinition;
  onComplete: (mode: TypingPracticeMode, taja: number, won?: boolean) => void;
  onExit: () => void;
  onRematch: () => void;
}) {
  const data = useMemo(() => createGhostData(ghost), [ghost]);
  const controller = useMemo<GhostRaceController>(
    () => createGhostRaceController({
      storage: raceStorage,
      myId,
      myName,
      ghostUserId: ghost.id,
      contentId: data.content.id,
      text: data.text,
      snippetEnds: data.snippetEnds,
      ghostTimeline: data.keystrokeTimeline,
      ghostRecord: data.record,
    }),
    [data, ghost.id, myId, myName],
  );
  const [state, setState] = useState<RaceState>(() => controller.getState());
  const [pointsMap, setPointsMap] = useState<Record<string, number>>({});
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const completionLoggedRef = useRef(false);

  useEffect(() => {
    void raceStorage.getUser(myId).then((existing) =>
      raceStorage.saveUser(existing ?? { id: myId, name: myName, points: 0 }),
    );
    const unsub = controller.subscribe((event) => {
      if (event.type === "lobby-update" || event.type === "countdown" || event.type === "race-start") {
        setState({ ...controller.getState() });
      }
      if (event.type === "position-update") {
        setState((previous) => ({ ...previous, participants: event.participants }));
      }
      if (event.type === "race-finish") {
        setState({ ...controller.getState() });
        setPointsMap(event.pointsMap);
        if (!completionLoggedRef.current) {
          completionLoggedRef.current = true;
          const mine = event.rankings.find((participant) => participant.id === myId);
          onComplete("race_ghost", wpmToTaja(mine?.wpm ?? 0));
        }
      }
    });
    controller.startRace();
    return () => {
      unsub();
      controller.destroy();
    };
  }, [controller, myId, myName, onComplete]);

  useEffect(() => {
    if (state.status === "racing") inputRef.current?.focus();
  }, [state.status]);

  const session = controller.getSession();
  const stats = session?.getStats();
  const me = state.participants.find((participant) => participant.id === myId);
  const cursor = session?.getCursorIndex() ?? 0;
  const statuses = session?.getCharStatuses() ?? [];
  const snippetView = getRaceSnippetView(state.text, cursor, statuses, state.snippetEnds);
  const currentLap = me?.isFinished
    ? DEFAULT_RACE_LAPS
    : Math.min(DEFAULT_RACE_LAPS, Math.floor((me?.progress ?? 0) * DEFAULT_RACE_LAPS) + 1);
  const showHud = state.status === "racing" || state.status === "finished";
  const awaitingSnippet = state.status === "racing" && Boolean(me?.isFinished);
  const inputComplete = awaitingSnippet && state.snippetEnds.includes(cursor);

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (state.status !== "racing" || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "Backspace") {
      event.preventDefault();
      controller.handleBackspace();
    } else if (event.key === "Enter") {
      event.preventDefault();
      controller.handleInput("\n");
    } else if (event.key === "Tab") {
      event.preventDefault();
      applyTabIndent(session?.text ?? "", cursor, (chunk) => {
        for (const char of chunk) controller.handleInput(char);
      });
    } else if (event.key.length === 1) {
      event.preventDefault();
      controller.handleInput(event.key);
    }
  };

  return (
    <div className="space-y-4">
      <RaceTrackPanel
        track={track}
        participants={state.participants}
        myId={myId}
        label="GHOST RACE"
        accent="cyan"
        hud={showHud ? {
          taja: wpmToTaja(stats?.wpm ?? me?.wpm ?? 0),
          speed: Math.round((me?.speed ?? 0) * 120),
          accuracy: stats?.accuracy ?? 100,
          lap: `${currentLap}/${DEFAULT_RACE_LAPS}`,
          rank: `${me?.rank ?? "-"}`,
        } : undefined}
      />

      {state.status === "countdown" && (
        <section className="border border-cyan-400/40 bg-black/70 py-10 text-center text-white">
          <span className="text-[9px] font-black tracking-[0.35em] text-cyan-300">GET READY</span>
          <div className="mt-2 font-mono text-7xl font-black italic text-cyan-300">
            {state.countdown > 0 ? state.countdown : "GO!"}
          </div>
        </section>
      )}

      {(state.status === "racing" || state.status === "finished") && (
        <TypingPane
          variant="game"
          text={snippetView.text}
          title={`SNIPPET ${snippetView.number}`}
          typedLength={snippetView.typedLength}
          statuses={snippetView.statuses}
          inputRef={inputRef}
          onKeyDown={onKeyDown}
          disabled={state.status === "finished" || inputComplete}
          hint={
            inputComplete
              ? "입력 완료 · 고스트 대기 중"
              : awaitingSnippet
              ? "결승선 통과 · 현재 스니펫을 완료하세요"
              : state.status === "racing" ? `👻 ${ghost.name}` : "레이스 종료"
          }
        />
      )}

      {state.status === "finished" && (
        <section className="border border-cyan-400/30 bg-black/55 p-5 text-white">
          <header className="mb-4 border-b border-white/10 pb-3">
            <span className="text-[9px] font-black tracking-[0.28em] text-cyan-300">RACE COMPLETE</span>
            <h2 className="text-xl font-black italic">고스트 레이스 결과</h2>
          </header>
          <div className="space-y-2">
            {[...state.participants].sort((a, b) => a.rank - b.rank).map((participant) => (
              <div
                key={participant.id}
                className={cn(
                  "flex items-center justify-between border bg-white/[0.025] px-3 py-2 text-sm",
                  participant.id === myId ? "border-cyan-400/45" : "border-white/10",
                )}
              >
                <div className="flex items-center gap-2">
                  <RankBadge rank={participant.rank} />
                  <span className={participant.id === myId ? "font-semibold" : ""}>
                    {participant.name}{participant.id === myId ? " (나)" : ""}
                  </span>
                </div>
                <div className="text-right font-mono">
                  <div>{wpmToTaja(participant.wpm)}타</div>
                  {pointsMap[participant.id] !== undefined && (
                    <div className="text-xs text-amber-400">+{pointsMap[participant.id]} pts</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onExit}
              className="flex items-center justify-center gap-2 border border-white/20 bg-black/45 px-4 py-3 text-sm font-black italic tracking-wide text-white/70 transition hover:border-white/40 hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="size-4" /> 종료하기
            </button>
            <button
              type="button"
              onClick={onRematch}
              className="flex items-center justify-center gap-2 border border-cyan-300 bg-gradient-to-r from-cyan-800 to-cyan-500 px-4 py-3 text-sm font-black italic tracking-wide text-white shadow-[0_0_20px_rgba(34,211,238,.2)] transition hover:brightness-125"
            >
              <RotateCcw className="size-4" /> 다시 레이스
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const cls =
    rank === 1 ? "border-amber-400/70 bg-amber-400/10 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,.15)]" :
    rank === 2 ? "border-zinc-300/50 bg-zinc-300/10 text-zinc-200" :
    rank === 3 ? "border-orange-400/60 bg-orange-400/10 text-orange-300" :
    "border-white/15 bg-white/5 text-white/45";
  const label = rank === 1 ? "1ST" : rank === 2 ? "2ND" : rank === 3 ? "3RD" : `${rank}TH`;
  return (
    <span className={cn(
      "inline-flex min-w-12 justify-center border px-2 py-1 font-mono text-[10px] font-black italic tracking-wider",
      cls,
    )}>
      {label}
    </span>
  );
}

/* ── Practice ── */

function CategoryLogoWatermark({ category }: { category: Category }) {
  const logo = PRACTICE_CATEGORY_LOGO[category];
  if (!logo) {
    const Icon = PRACTICE_CATEGORY_ICON[category];
    return (
      <Icon className="pointer-events-none absolute right-3 top-1/2 size-24 -translate-y-1/2 text-white opacity-15 transition group-hover:scale-105 group-hover:opacity-25" />
    );
  }

  if (!logo.cutout) {
    return (
      <img
        src={logo.src}
        alt=""
        aria-hidden
        className="pointer-events-none absolute -right-2 top-1/2 size-28 -translate-y-1/2 object-contain opacity-20 brightness-0 invert transition group-hover:scale-105 group-hover:opacity-30"
      />
    );
  }

  const maskId = `typing-logo-${category}`;
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden
      className="pointer-events-none absolute -right-2 top-1/2 size-28 -translate-y-1/2 opacity-20 transition group-hover:scale-105 group-hover:opacity-30"
    >
      <mask
        id={maskId}
        x="0"
        y="0"
        width="100"
        height="100"
        maskUnits="userSpaceOnUse"
        style={{ maskType: "luminance" }}
      >
        <image
          href={logo.src}
          width="100"
          height="100"
          preserveAspectRatio="xMidYMid meet"
          style={logo.cutout === "light" ? { filter: "invert(1)" } : undefined}
        />
      </mask>
      <rect width="100" height="100" fill="white" mask={`url(#${maskId})`} />
    </svg>
  );
}

function PracticeCategoryMenu({
  onSelect,
  onExit,
}: {
  onSelect: (category: Category) => void;
  onExit: () => void;
}) {
  const prose = CATEGORIES.find((item) => item.id === "english")!;
  const codeOrder: Category[] = [
    "python", "javascript", "typescript", "react", "html",
    "css", "sql", "lua", "shell",
  ];
  const code = codeOrder.map((id) => CATEGORIES.find((item) => item.id === id)!);
  const cardTone: Record<Category, string> = {
    english: "bg-[#f4c95d] text-[#342500] hover:bg-[#ffd86b]",
    python: "bg-[#3776ab] text-white hover:bg-[#4384b9]",
    lua: "bg-[#000080] text-white hover:bg-[#11119a]",
    javascript: "bg-[#f7df1e] text-[#211f0b] hover:bg-[#ffe640]",
    html: "bg-[#e34f26] text-white hover:bg-[#ed5b35]",
    typescript: "bg-[#3178c6] text-white hover:bg-[#3f87d5]",
    sql: "bg-[#e76f00] text-white hover:bg-[#f27a0b]",
    react: "bg-[#61dafb] text-[#172126] hover:bg-[#7ee2fc]",
    css: "bg-[#264de4] text-white hover:bg-[#345bed]",
    shell: "bg-[#4eaa25] text-white hover:bg-[#5ab932]",
  };
  const cardLayout: Partial<Record<Category, string>> = {
    python: "sm:col-span-3 sm:row-span-2",
    javascript: "sm:col-span-3",
    typescript: "sm:col-span-3",
    react: "sm:col-span-2 sm:row-span-2",
    html: "sm:col-span-2",
    css: "sm:col-span-2",
    sql: "sm:col-span-2",
    lua: "sm:col-span-2",
    shell: "sm:col-span-6",
  };
  const cardGroup: Partial<Record<Category, string>> = {
    python: "GENERAL PURPOSE",
    lua: "SCRIPTING",
    javascript: "WEB CORE",
    html: "WEB STRUCTURE",
    typescript: "TYPED WEB",
    sql: "DATA",
    react: "UI COMPONENT",
    css: "UI STYLE",
    shell: "AUTOMATION & CLI",
  };

  return (
    <main className="min-h-screen bg-[#090d14] px-3 py-4 font-sans text-zinc-100 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-zinc-700/80 bg-[#0d1117] shadow-[0_24px_80px_rgba(0,0,0,.4)]">
        <div className="flex h-11 items-center gap-3 border-b border-zinc-800 bg-[#161b22] px-4">
          <div className="flex gap-1.5" aria-hidden>
            <span className="size-3 rounded-full bg-[#ff5f56]" />
            <span className="size-3 rounded-full bg-[#ffbd2e]" />
            <span className="size-3 rounded-full bg-[#27c93f]" />
          </div>
          <span className="rounded-t-md border border-b-0 border-zinc-700/80 bg-[#0d1117] px-4 py-2 text-xs text-zinc-400">
            typing-practice.menu
          </span>
          <button
            type="button"
            onClick={onExit}
            className="ml-auto inline-flex items-center gap-2 text-xs text-zinc-500 transition hover:text-white"
          >
            <ArrowLeft className="size-4" /> 돌아가기
          </button>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          <header className="mb-6">
            <p className="text-[10px] font-bold tracking-[0.24em] text-sky-400">TYPING PRACTICE</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">연습할 콘텐츠를 선택하세요</h1>
          </header>

          <button
            type="button"
            onClick={() => onSelect(prose.id)}
            className={cn(
              "group relative flex min-h-44 w-full overflow-hidden rounded-2xl p-6 text-left transition sm:min-h-52 sm:p-8",
              cardTone.english,
            )}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,.35),transparent_42%)]" />
            <span
              aria-hidden
              className="pointer-events-none absolute -right-3 top-1/2 -translate-y-1/2 text-[7rem] font-black leading-none tracking-[-0.08em] text-white/20 transition group-hover:scale-105 sm:right-5 sm:text-[10rem]"
            >
              ABC
            </span>
            <div className="relative flex w-full items-end justify-between gap-6">
              <div>
                <p className="text-[10px] font-bold tracking-[0.22em] opacity-55">PUBLIC DOMAIN LITERATURE</p>
                <h2 className="mt-1 text-3xl font-black sm:text-4xl">영문 타자</h2>
                <p className="mt-2 max-w-xl text-sm opacity-60">고전 문학 11,000여 문장과 문단으로 자연스럽게 영문 타자를 연습합니다.</p>
              </div>
              <ChevronRight className="size-7 shrink-0 opacity-35 transition group-hover:translate-x-1 group-hover:opacity-80" />
            </div>
          </button>

          <div className="mb-3 mt-7 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[0.22em] text-sky-400/60">CODE TRAINING</p>
              <h2 className="mt-1 text-lg font-bold">코드 타자</h2>
            </div>
            <span className="text-xs text-zinc-600">언어별 300개 이상 스니펫</span>
          </div>

          <div className="grid grid-flow-row-dense grid-cols-2 gap-3 sm:auto-rows-[8rem] sm:grid-cols-6">
            {code.map((item) => {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    "group relative flex min-h-32 flex-col justify-between overflow-hidden rounded-xl p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg",
                    cardTone[item.id],
                    cardLayout[item.id],
                  )}
                >
                  <CategoryLogoWatermark category={item.id} />
                  <div className="relative z-10 flex items-start justify-between">
                    <span className="text-[9px] font-bold tracking-[0.16em] opacity-60">{cardGroup[item.id]}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider opacity-50">{item.extension}</span>
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-sm font-black">{item.label}</h3>
                    <p className="mt-1 text-xs opacity-70">{item.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}

function PracticeMode({
  userId,
  onComplete,
  onExit,
}: {
  userId: string;
  onComplete: (mode: TypingPracticeMode, taja: number, won?: boolean) => void;
  onExit: () => void;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const completionLoggedRef = useRef(false);
  const bagRef = useRef(new ShuffleBag());
  const forceReloadRef = useRef(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [proseUnit, setProseUnit] = useState<ProseUnit | "all">("sentence");
  const [snippet, setSnippet] = useState<PracticeContentItem | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [poolSize, setPoolSize] = useState(0);
  const [typed, setTyped] = useState("");
  const [correctBefore, setCorrectBefore] = useState(0);
  const [totalBefore, setTotalBefore] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [result, setResult] = useState<TypingResult | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const statuses = useMemo(() => {
    if (!snippet) return [] as Array<"correct" | "incorrect" | "pending">;
    return [...snippet.text].map((char, i) => {
      if (i >= typed.length) return "pending" as const;
      return typed[i] === char ? "correct" as const : "incorrect" as const;
    });
  }, [snippet, typed]);
  const currentCorrect = statuses.filter((s) => s === "correct").length;
  const stats = calculateTypingResult(correctBefore + currentCorrect, totalBefore + typed.length, elapsedMs, completed);
  const remainingMs = Math.max(0, SESSION_MS - elapsedMs);
  const bestKey = category ? `flowpy:typing-best-taja:${userId}:${category}` : "";
  const best = bestKey ? Number(localStorage.getItem(bestKey) ?? 0) : 0;
  const categoryMeta = CATEGORIES.find((c) => c.id === category) ?? null;

  const drawNext = useCallback(() => {
    const next = bagRef.current.next();
    setSnippet(next);
    setTyped("");
  }, []);

  const loadPool = useCallback(async (nextCategory: Category, unit: ProseUnit | "all", force = false) => {
    setLoadState("loading");
    setLoadError(null);
    setSnippet(null);
    try {
      const items = await loadCategoryItems(nextCategory, force);
      const filtered = nextCategory === "english" ? filterByUnit(items, unit) : items;
      bagRef.current.setPool(filtered);
      setPoolSize(filtered.length);
      const first = bagRef.current.next();
      if (!first) throw new Error("콘텐츠가 비어 있습니다");
      setSnippet(first);
      setLoadState("ready");
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } catch (err) {
      setLoadState("error");
      setLoadError(err instanceof Error ? err.message : "콘텐츠를 불러오지 못했습니다");
    }
  }, []);

  useEffect(() => {
    if (!category) return;
    const force = forceReloadRef.current;
    forceReloadRef.current = false;
    void loadPool(category, proseUnit, force);
  }, [category, proseUnit, retryTick, loadPool]);

  const finishSession = (finalElapsedMs = elapsedMs) => {
    const finalResult = calculateTypingResult(correctBefore + currentCorrect, totalBefore + typed.length, finalElapsedMs, completed);
    setElapsedMs(finalElapsedMs);
    setResult(finalResult);
    setStartedAt(null);
    if (finalResult.taja > best) localStorage.setItem(bestKey, String(finalResult.taja));
    if (!completionLoggedRef.current) {
      completionLoggedRef.current = true;
      onComplete(category === "english" ? "practice_english" : "practice_code", finalResult.taja);
    }
  };

  useEffect(() => {
    if (startedAt === null || result) return;
    const tick = () => {
      const nextElapsed = Date.now() - startedAt;
      setElapsedMs(Math.min(nextElapsed, SESSION_MS));
      if (nextElapsed >= SESSION_MS) finishSession(SESSION_MS);
    };
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
  });

  const resetSession = (nextCategory: Category | null = category) => {
    setCategory(nextCategory);
    setTyped("");
    setCorrectBefore(0);
    setTotalBefore(0);
    setCompleted(0);
    setStartedAt(null);
    setElapsedMs(0);
    setResult(null);
    completionLoggedRef.current = false;
    if (nextCategory) window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const enterText = (text: string) => {
    if (!snippet || result || typed.length >= snippet.text.length) return;
    if (startedAt === null) setStartedAt(Date.now());
    const nextTyped = (typed + text).slice(0, snippet.text.length);
    if (nextTyped.length < snippet.text.length) {
      setTyped(nextTyped);
      return;
    }
    const correct = [...nextTyped].reduce((n, c, i) => n + Number(c === snippet.text[i]), 0);
    setCorrectBefore((v) => v + correct);
    setTotalBefore((v) => v + nextTyped.length);
    setCompleted((v) => v + 1);
    drawNext();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!snippet || event.metaKey || event.ctrlKey || event.altKey || result) return;
    if (event.key === "Backspace") {
      event.preventDefault();
      setTyped((v) => v.slice(0, -1));
    } else if (event.key === "Tab") {
      event.preventDefault();
      applyTabIndent(snippet.text, typed.length, enterText);
    } else if (event.key === "Enter") {
      event.preventDefault();
      enterText("\n");
    } else if (event.key.length === 1) {
      event.preventDefault();
      enterText(event.key);
    }
  };

  if (!category) {
    return (
      <PracticeCategoryMenu
        onExit={onExit}
        onSelect={(nextCategory) => resetSession(nextCategory)}
      />
    );
  }

  const codeMode = isCodeCategory(category);
  const ActiveCategoryIcon = PRACTICE_CATEGORY_ICON[category];

  if (result) {
    return (
      <main className={cn(
        "flex min-h-screen items-center justify-center p-4",
        codeMode
          ? "bg-[#080b10] text-zinc-100"
          : "bg-[#ece5d8] text-amber-950 dark:bg-[#100e0b] dark:text-amber-50",
      )}>
        <section className={cn(
          "w-full max-w-2xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,.25)]",
          codeMode
            ? "rounded-xl bg-[#0d1117]"
            : "relative border border-amber-950/20 bg-[radial-gradient(circle_at_top,#fffaf0_0%,#f4ead7_68%,#eadbc2_100%)] font-serif shadow-[0_24px_80px_rgba(69,26,3,.2)] dark:border-amber-100/15 dark:bg-[radial-gradient(circle_at_top,#211c14_0%,#17130e_72%)]",
        )}>
          {!codeMode && (
            <div className="pointer-events-none absolute inset-3 border border-amber-950/10 dark:border-amber-100/10" aria-hidden />
          )}
          {codeMode && (
            <div className="relative flex h-9 items-center bg-[#161b22] px-3">
              <div className="flex gap-1.5" aria-hidden>
                <span className="size-2.5 rounded-full bg-[#ff5f56]" />
                <span className="size-2.5 rounded-full bg-[#ffbd2e]" />
                <span className="size-2.5 rounded-full bg-[#27c93f]" />
              </div>
              <span className="pointer-events-none absolute inset-x-24 text-center text-[11px] text-zinc-500">
                flow-typing — report
              </span>
            </div>
          )}
          <div className={cn("p-6 sm:p-8", codeMode ? "font-mono" : "text-center")}>
            {codeMode ? (
              <div className="text-left text-sm">
                <p className="text-zinc-300">
                  <span className="mr-2 text-emerald-400">$</span>
                  flow-typing report --latest
                </p>
                <p className="mt-4 text-emerald-400">
                  <span className="mr-2">✓</span>
                  Session completed successfully
                </p>
                <p className="mt-1 text-zinc-500">
                  language: <span className="text-sky-400">{categoryMeta?.label}</span>
                </p>
              </div>
            ) : (
              <>
                <p className="text-[9px] font-bold tracking-[0.32em] text-amber-900/45 dark:text-amber-100/35">
                  TYPEWRITER&apos;S PRACTICE RECORD
                </p>
                <div className="mx-auto mt-4 flex max-w-sm items-center gap-4 text-amber-900/45 dark:text-amber-100/40">
                  <span className="h-px flex-1 bg-current" />
                  <ActiveCategoryIcon className="size-6" />
                  <span className="h-px flex-1 bg-current" />
                </div>
                <h2 className="mt-3 text-3xl font-bold tracking-tight">연습 완료</h2>
                <p className="mt-2 text-xs italic text-amber-900/50 dark:text-amber-100/40">
                  {categoryMeta?.label} 연습 기록을 한 장의 문서로 남겼습니다.
                </p>
              </>
            )}
            <div className={cn(
              "mx-auto max-w-2xl",
              codeMode
                ? "mt-5 divide-y divide-zinc-800 border-y border-zinc-800"
                : "mt-7 grid grid-cols-3 divide-x divide-amber-950/15 border-y border-amber-950/20 dark:divide-amber-100/15 dark:border-amber-100/20",
            )}>
              <ResultStat tone={codeMode ? "code" : "prose"} label={codeMode ? "average_taja" : "평균 타수"} value={`${result.taja}타`} />
              <ResultStat tone={codeMode ? "code" : "prose"} label={codeMode ? "accuracy" : "정확도"} value={`${result.accuracy}%`} />
              <ResultStat tone={codeMode ? "code" : "prose"} label={codeMode ? "completed_snippets" : "완료 스니펫"} value={result.completed} />
            </div>
            <div className={cn("mt-6 flex gap-2", codeMode ? "justify-start" : "justify-center")}>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "rounded-lg",
                  codeMode
                    ? "border-zinc-700 bg-[#161b22] text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    : "rounded-none border-amber-950/20 bg-transparent font-sans text-amber-950 shadow-none hover:bg-amber-950/10 hover:text-amber-950 dark:border-amber-100/20 dark:text-amber-50 dark:hover:bg-amber-100/10 dark:hover:text-white",
                )}
                onClick={() => setCategory(null)}
              >
                <ArrowLeft /> 연습 선택
              </Button>
              <Button
                type="button"
                className={cn(
                  "rounded-lg",
                  codeMode
                    ? "bg-sky-600 text-white hover:bg-sky-500"
                    : "rounded-none bg-amber-950 font-sans text-amber-50 shadow-none hover:bg-amber-900 dark:bg-amber-100 dark:text-amber-950 dark:hover:bg-white",
                )}
                onClick={() => resetSession()}
              >
                <RotateCcw /> 다시 연습
              </Button>
            </div>
          </div>
          {codeMode && (
            <div className="flex h-6 items-center justify-between bg-sky-700 px-3 text-[10px] text-sky-50">
              <span>session complete</span>
              <span>{result.taja} taja · {result.accuracy}% accuracy</span>
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className={cn(
      "min-h-screen",
      codeMode
        ? "bg-[#080b10] text-zinc-100"
        : "bg-[#ece5d8] text-amber-950 dark:bg-[#100e0b] dark:text-amber-50",
    )}>
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className={cn(
          "flex flex-wrap items-center justify-between gap-3 border-b pb-3",
          codeMode ? "border-zinc-800" : "border-amber-900/15 dark:border-amber-100/10",
        )}>
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={cn(
              "inline-flex items-center gap-2 text-sm transition",
              codeMode ? "text-zinc-400 hover:text-white" : "text-amber-900/60 hover:text-amber-950 dark:text-amber-100/50 dark:hover:text-white",
            )}
          >
            <ArrowLeft className="size-4" /> 연습 선택
          </button>
          <div className="flex items-center gap-2">
            <ActiveCategoryIcon className="size-5" />
            <div>
              <h1 className="text-sm font-bold">{categoryMeta?.label} 타자 연습</h1>
              <p className={cn("text-[10px]", codeMode ? "text-zinc-500" : "text-amber-900/45 dark:text-amber-100/35")}>
                {poolSize.toLocaleString()}개 연습 데이터
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onExit}
            className={cn(
              "text-xs transition",
              codeMode ? "text-zinc-500 hover:text-white" : "text-amber-900/45 hover:text-amber-950 dark:text-amber-100/35 dark:hover:text-white",
            )}
          >
            타자 연습 종료
          </button>
        </header>

        {category === "english" && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-amber-900/50 dark:text-amber-100/40">연습 단위</span>
            {([
              ["sentence", "문장"],
              ["paragraph", "짧은 문단"],
              ["all", "전체"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                disabled={startedAt !== null}
                onClick={() => setProseUnit(id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-60",
                  proseUnit === id
                    ? "border-amber-800/35 bg-amber-900/10 font-semibold text-amber-950 dark:border-amber-100/30 dark:bg-amber-100/10 dark:text-amber-50"
                    : "border-amber-900/15 text-amber-900/55 hover:border-amber-900/35 dark:border-amber-100/10 dark:text-amber-100/45",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className={cn(
          "overflow-hidden shadow-sm",
          codeMode ? "rounded-xl bg-[#0d1117]" : "rounded-2xl bg-[#f6f0e4] dark:bg-[#1a1712]",
        )}>
          {codeMode && (
            <div className="flex h-8 items-center gap-2 bg-[#161b22] px-3">
              <span className="size-2 rounded-full bg-[#ff5f56]" />
              <span className="size-2 rounded-full bg-[#ffbd2e]" />
              <span className="size-2 rounded-full bg-[#27c93f]" />
              <span className="ml-2 text-[10px] text-zinc-500">session.telemetry</span>
            </div>
          )}
          <section className={cn(
            "grid grid-cols-2 overflow-hidden sm:grid-cols-5",
            !codeMode && "divide-x divide-amber-900/10 dark:divide-amber-100/10",
          )}>
            <Stat tone={codeMode ? "code" : "prose"} icon={Timer} label="남은 시간" value={formatTime(remainingMs)} />
            <Stat tone={codeMode ? "code" : "prose"} icon={Gauge} label="타수" value={`${stats.taja}타`} />
            <Stat tone={codeMode ? "code" : "prose"} icon={Target} label="정확도" value={`${stats.accuracy}%`} />
            <Stat tone={codeMode ? "code" : "prose"} icon={CheckCircle2} label="완료" value={`${completed}개`} />
            <Stat tone={codeMode ? "code" : "prose"} icon={Trophy} label="최고 기록" value={`${best}타`} className="col-span-2 sm:col-span-1" />
          </section>
        </div>

        {loadState === "loading" && (
          <div className={cn(
            "flex flex-col items-center justify-center gap-3 border py-16 text-sm",
            codeMode ? "border-zinc-800 bg-[#0d1117] text-zinc-500" : "border-amber-900/15 bg-[#f6f0e4] text-amber-900/50 dark:border-amber-100/10 dark:bg-[#1a1712]",
          )}>
            <RefreshCw className="size-6 animate-spin" />
            {categoryMeta?.label} 콘텐츠 불러오는 중…
          </div>
        )}

        {loadState === "error" && (
          <div className="border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-destructive">{loadError ?? "콘텐츠를 불러오지 못했습니다"}</p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => {
                forceReloadRef.current = true;
                setRetryTick((n) => n + 1);
              }}
            >
              <RefreshCw /> 다시 시도
            </Button>
          </div>
        )}

        {loadState === "ready" && snippet && (
          codeMode ? (
            <CodeTypingPane
              text={snippet.text}
              fileName={categoryFileName(snippet)}
              language={categoryMeta?.language ?? category}
              typedLength={typed.length}
              statuses={statuses}
              inputRef={inputRef}
              onKeyDown={handleKeyDown}
              hint={startedAt === null ? "입력하면 시작" : "입력 중"}
              source={snippet.source}
              license={snippet.license}
            />
          ) : (
            <ProseTypingPane
              text={snippet.text}
              title={snippet.title}
              author={snippet.author}
              source={snippet.source}
              typedLength={typed.length}
              statuses={statuses}
              inputRef={inputRef}
              onKeyDown={handleKeyDown}
              hint={startedAt === null ? "첫 글자를 입력하면 시작됩니다" : "입력 중"}
            />
          )
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            className={cn(
              "rounded-lg shadow-none",
              codeMode
                ? "border-zinc-700 bg-[#161b22] text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
                : "border-amber-900/15 bg-[#f6f0e4] text-amber-900 hover:bg-amber-900/10 hover:text-amber-950 dark:border-amber-100/15 dark:bg-[#1a1712] dark:text-amber-100 dark:hover:bg-amber-100/10 dark:hover:text-white",
            )}
            onClick={() => {
              resetSession();
              if (loadState === "ready") drawNext();
            }}
          >
            <RotateCcw /> 처음부터
          </Button>
          {startedAt !== null && (
            <Button
              className={cn(
                "rounded-lg shadow-none",
                codeMode
                  ? "bg-sky-600 text-white hover:bg-sky-500"
                  : "bg-amber-900 text-amber-50 hover:bg-amber-800 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100",
              )}
              onClick={() => finishSession()}
            >
              연습 종료
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}

/* ── Shared race / typing display ── */

function RaceTrackPanel({
  track,
  participants,
  myId,
  label,
  hud,
  footerText = "WAITING FOR START",
  accent = "red",
}: {
  track: TrackDefinition;
  participants: RaceParticipant[];
  myId: string;
  label: string;
  hud?: { taja: number; speed: number; accuracy: number; lap: string; rank: string };
  footerText?: string;
  accent?: "red" | "cyan";
}) {
  const cyan = accent === "cyan";
  return (
    <div className={cn(
      "relative h-[clamp(210px,40vh,420px)] w-full overflow-hidden border bg-zinc-950 [&_.tj-f1-track]:!h-full",
      cyan
        ? "border-cyan-400/35 shadow-[0_0_30px_rgba(34,211,238,.1)]"
        : "border-red-500/35 shadow-[0_0_30px_rgba(239,68,68,.12)]",
    )}>
      <F1Track
        participants={participants}
        track={track}
        assetBaseUrl="/racing/"
        laps={DEFAULT_RACE_LAPS}
        myParticipantId={myId}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/85 to-transparent p-3 pb-8">
        <div>
          <span className={cn(
            "border px-2 py-1 text-[9px] font-black tracking-[0.2em]",
            cyan
              ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-200"
              : "border-red-500/60 bg-red-600/25 text-red-300",
          )}>
            {label}
          </span>
          <p className="mt-2 text-sm font-black italic tracking-wide text-white drop-shadow-md">{track.name}</p>
        </div>
        <div className="flex gap-1.5">
          <span className="border border-white/25 bg-black/55 px-2 py-1 text-[9px] font-bold tracking-wider text-white/80">
            {DEFAULT_RACE_LAPS} LAPS
          </span>
          {participants.length > 0 && (
            <span className="border border-emerald-400/40 bg-black/55 px-2 py-1 text-[9px] font-bold text-emerald-300">
              {participants.length} RACERS
            </span>
          )}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-2.5 pt-10">
        {hud ? (
          <div className="grid grid-cols-5 gap-1.5">
            {[
              { label: "타수", value: `${hud.taja}` },
              { label: "차속", value: `${hud.speed}` },
              { label: "정확", value: `${hud.accuracy}%` },
              { label: "랩", value: hud.lap },
              { label: "순위", value: hud.rank },
            ].map((item) => (
              <div key={item.label} className="border border-white/15 bg-black/55 px-1.5 py-1 text-center">
                <div className="text-[8px] font-bold tracking-wider text-white/40">{item.label}</div>
                <div className="font-mono text-xs font-black text-white">{item.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-end justify-between">
            <span className="text-[9px] font-bold tracking-[0.22em] text-white/50">{footerText}</span>
            <span className={cn(
              "text-sm font-black tracking-[-0.18em]",
              cyan ? "text-cyan-300" : "text-red-500",
            )}>›››››</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TypingPane({
  text,
  title,
  typedLength,
  statuses,
  inputRef,
  onKeyDown,
  disabled,
  hint,
  variant = "default",
}: {
  text: string;
  title?: string;
  typedLength: number;
  statuses: readonly ("correct" | "incorrect" | "pending")[];
  inputRef: React.RefObject<HTMLTextAreaElement>;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
  hint?: string;
  variant?: "default" | "game";
}) {
  const game = variant === "game";
  return (
    <section
      className={cn(
        "relative cursor-text text-zinc-100 shadow-sm",
        game
          ? "border border-red-500/35 bg-black/70 p-4 backdrop-blur-sm md:p-5"
          : "rounded-2xl border bg-zinc-950 p-5 md:p-7",
      )}
      onClick={() => !disabled && inputRef.current?.focus()}
    >
      <div className={cn(
        "mb-4 flex items-center justify-between gap-3",
        game ? "text-[10px] font-black tracking-[0.2em] text-red-400/80" : "text-xs text-zinc-400",
      )}>
        <span>{title ?? "레이스 텍스트"}</span>
        <span className={game ? "text-white/45" : undefined}>{hint}</span>
      </div>
      <div className={cn(
        "whitespace-pre-wrap break-words font-mono",
        game ? "min-h-24 text-base leading-7 md:text-lg md:leading-8" : "min-h-32 text-lg leading-9 md:text-xl",
      )}>
        {[...text].map((char, index) => {
          const status = statuses[index] ?? "pending";
          const isCursor = index === typedLength && !disabled;
          return (
            <span
              key={index}
              className={cn(
                "relative",
                status === "correct" && "text-emerald-400",
                status === "incorrect" && "bg-red-500/25 text-red-400",
                status === "pending" && "text-zinc-500",
                isCursor && (game ? "rounded-sm bg-red-500/25 text-zinc-300" : "rounded-sm bg-primary/30 text-zinc-400"),
              )}
            >
              {char === "\n" ? <><span className="select-none text-zinc-600">↵</span><br /></> : char === " " ? "\u00A0" : char}
              {isCursor && (
                <span className={cn(
                  "absolute bottom-0 left-0 h-0.5 w-full animate-pulse",
                  game ? "bg-red-500" : "bg-primary",
                )} />
              )}
            </span>
          );
        })}
      </div>
      <textarea
        ref={inputRef}
        value=""
        aria-label="타자 입력"
        autoFocus
        disabled={disabled}
        onChange={() => undefined}
        onKeyDown={onKeyDown}
        onPaste={(e) => e.preventDefault()}
        className="absolute size-px opacity-0"
      />
      <div className={cn("mt-4 overflow-hidden", game ? "h-1 bg-white/10" : "h-1.5 rounded-full bg-zinc-800")}>
        <div
          className={cn("h-full transition-[width]", game ? "bg-red-500" : "rounded-full bg-primary")}
          style={{ width: `${text.length ? (typedLength / text.length) * 100 : 0}%` }}
        />
      </div>
    </section>
  );
}

function Stat({
  icon: Icon, label, value, className, tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  className?: string;
  tone?: "default" | "code" | "prose";
}) {
  return (
    <div className={cn(
      "flex items-center gap-3 p-3",
      tone === "code" && "bg-transparent",
      tone === "prose" && "bg-transparent",
      className,
    )}>
      <Icon className={cn(
        "size-5",
        tone === "default" && "text-primary",
        tone === "code" && "text-sky-400",
        tone === "prose" && "text-amber-800 dark:text-amber-200",
      )} />
      <div>
        <div className={cn(
          "text-xs",
          tone === "default" && "text-muted-foreground",
          tone === "code" && "text-zinc-500",
          tone === "prose" && "text-amber-900/50 dark:text-amber-100/40",
        )}>{label}</div>
        <div className={cn(
          "font-mono text-lg font-bold",
          tone === "code" && "text-zinc-100",
          tone === "prose" && "text-amber-950 dark:text-amber-50",
        )}>{value}</div>
      </div>
    </div>
  );
}

function ResultStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "code" | "prose";
}) {
  return (
    <div className={cn(
      tone === "code" ? "flex items-center justify-between py-3 text-left" : "p-4",
      tone === "code"
        ? "text-zinc-100"
        : "bg-transparent",
    )}>
      <div className={cn(
        "text-xs",
        tone === "code" ? "text-zinc-500" : "text-amber-900/45 dark:text-amber-100/35",
      )}>
        {tone === "code" && <span className="mr-2 text-sky-500">&gt;</span>}
        {label}
      </div>
      <div className={cn(
        "font-mono text-2xl font-bold",
        tone === "code" ? "text-emerald-400" : "mt-1 text-amber-950 dark:text-amber-50",
      )}>{value}</div>
    </div>
  );
}

function formatTime(ms: number) {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
