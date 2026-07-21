import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, ChevronDown, Lock, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { masteryTarget, type Pos, type WordDef } from "./content";

export type CatalogStatus = "all" | "acquired" | "mastered" | "unacquired";

export interface CatalogFilters {
  query: string;
  difficulty: number | null;
  pos: Pos | null;
  status: CatalogStatus;
}

export function filterCatalogWords(
  words: WordDef[],
  mastery: Record<string, number>,
  filters: CatalogFilters,
): WordDef[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return words.filter((word) => {
    const count = mastery[word.id] ?? 0;
    const mastered = count >= masteryTarget(word.difficulty);
    if (
      query &&
      !word.word.toLocaleLowerCase().includes(query) &&
      !word.meaningKo.includes(query)
    ) {
      return false;
    }
    if (filters.difficulty != null && word.difficulty !== filters.difficulty) return false;
    if (filters.pos != null && word.pos !== filters.pos) return false;
    if (filters.status === "acquired" && (count === 0 || mastered)) return false;
    if (filters.status === "mastered" && !mastered) return false;
    if (filters.status === "unacquired" && count > 0) return false;
    return true;
  });
}

const PAGE_SIZE = 60;
const POS_LABEL: Record<Pos, string> = {
  noun: "명사",
  verb: "동사",
  adj: "형용사",
};

export default function LexiconCatalog({
  words,
  mastery,
}: {
  words: WordDef[];
  mastery: Record<string, number>;
}) {
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const [status, setStatus] = useState<CatalogStatus>("all");
  const [page, setPage] = useState(1);

  const learningCount = useMemo(
    () => words.filter((word) => {
      const count = mastery[word.id] ?? 0;
      return count > 0 && count < masteryTarget(word.difficulty);
    }).length,
    [words, mastery],
  );
  const masteredCount = useMemo(
    () =>
      words.filter(
        (word) => (mastery[word.id] ?? 0) >= masteryTarget(word.difficulty),
      ).length,
    [words, mastery],
  );
  const filtered = useMemo(
    () =>
      filterCatalogWords(words, mastery, {
        query,
        difficulty,
        pos,
        status,
      }).sort(
        (a, b) =>
          a.difficulty - b.difficulty ||
          a.word.localeCompare(b.word),
      ),
    [words, mastery, query, difficulty, pos, status],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const collectPct = words.length ? (acquiredCount / words.length) * 100 : 0;

  useEffect(() => setPage(1), [query, difficulty, pos, status]);

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 pb-12 pt-4">
      <header className="relative overflow-hidden border border-cyan-300/20 bg-[#03111d]/80 p-5 shadow-xl backdrop-blur-xl">
        <Corner />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-cyan-300">
              <BookOpen className="size-5" />
              <span className="text-[10px] font-black uppercase tracking-[0.28em]">Word Codex</span>
            </div>
            <h1 className="mt-2 text-3xl font-black italic">단어 도감</h1>
            <p className="mt-1 text-sm text-slate-400">
              수집한 데이터셋의 학습 중·숙련 완료 상태를 확인하세요.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <Stat value={words.length} label="전체" />
            <Stat value={learningCount} label="학습 중" color="text-amber-300" />
            <Stat value={masteredCount} label="숙련 완료" color="text-emerald-300" />
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-[10px] font-black tracking-wider text-slate-500">
            <span>COLLECTION</span>
            <span className="font-mono text-cyan-300">{collectPct.toFixed(1)}%</span>
          </div>
          <div className="h-2 overflow-hidden bg-slate-950">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-cyan-400 transition-all"
              style={{ width: `${collectPct}%` }}
            />
          </div>
        </div>
      </header>

      <section className="relative space-y-3 border border-cyan-300/15 bg-[#03111d]/75 p-4 backdrop-blur-xl">
        <Corner />
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cyan-400/60" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="영어 또는 한국어 뜻 검색"
            className="w-full border border-cyan-300/20 bg-slate-950/80 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-cyan-300/50 focus:ring-1 focus:ring-cyan-300/30"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <FilterSelect
            ariaLabel="학습 상태"
            value={status}
            onChange={(value) => setStatus(value as CatalogStatus)}
            options={[
              ["all", "전체 상태"],
              ["acquired", "학습 중"],
              ["mastered", "숙련 완료"],
              ["unacquired", "미학습"],
            ]}
          />
          <FilterSelect
            ariaLabel="난이도"
            value={difficulty?.toString() ?? "all"}
            onChange={(value) => setDifficulty(value === "all" ? null : Number(value))}
            options={[
              ["all", "전체 난이도"],
              ...[1, 2, 3, 4, 5].map((level) => [String(level), `Lv.${level}`]),
            ]}
          />
          <FilterSelect
            ariaLabel="품사"
            value={pos ?? "all"}
            onChange={(value) => setPos(value === "all" ? null : (value as Pos))}
            options={[
              ["all", "전체 품사"],
              ["noun", "명사"],
              ["verb", "동사"],
              ["adj", "형용사"],
            ]}
          />
          <span className="ml-auto self-center font-mono text-xs text-slate-500">
            {filtered.length.toLocaleString()}건
          </span>
        </div>
      </section>

      {visible.length === 0 ? (
        <div className="border border-dashed border-cyan-300/20 py-16 text-center text-sm text-slate-500">
          조건에 맞는 단어가 없습니다.
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((word) => {
            const count = mastery[word.id] ?? 0;
            const target = masteryTarget(word.difficulty);
            const mastered = count >= target;
            const acquired = count > 0;
            return (
              <article
                key={word.id}
                className={cn(
                  "relative overflow-hidden border bg-[#03111d]/80 p-4 backdrop-blur-md",
                  mastered
                    ? "border-emerald-400/40 shadow-[0_0_18px_rgba(52,211,153,.08)]"
                    : acquired
                      ? "border-amber-400/35"
                      : "border-cyan-300/10 opacity-80",
                )}
              >
                <Corner />
                {!acquired && (
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,transparent_40%,rgba(1,8,16,.55))]" />
                )}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className={cn(
                      "truncate font-mono text-lg font-bold",
                      acquired ? "text-zinc-100" : "text-slate-500",
                    )}>
                      {acquired ? word.word : "????"}
                    </h2>
                    <p className="truncate text-sm text-slate-400">
                      {acquired ? word.meaningKo : "미학습 데이터"}
                    </p>
                  </div>
                  <StatusBadge acquired={acquired} mastered={mastered} />
                </div>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="border border-cyan-300/15 px-1.5 py-0.5 font-mono">Lv.{word.difficulty}</span>
                  <span>{POS_LABEL[word.pos]}</span>
                  <span className="ml-auto font-mono">
                    {Math.min(count, target)}/{target}
                  </span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden bg-slate-950">
                  <div
                    className={cn(
                      "h-full",
                      mastered ? "bg-emerald-400" : acquired ? "bg-amber-400" : "bg-slate-700",
                    )}
                    style={{ width: `${Math.min(100, (count / target) * 100)}%` }}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-3" aria-label="도감 페이지">
          <PagerButton disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            이전
          </PagerButton>
          <span className="font-mono text-sm text-slate-400">
            {page} / {totalPages}
          </span>
          <PagerButton
            disabled={page === totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
          >
            다음
          </PagerButton>
        </nav>
      )}
    </div>
  );
}

function Corner() {
  return (
    <>
      <span className="pointer-events-none absolute left-0 top-0 h-2 w-2 border-l border-t border-cyan-300/45" />
      <span className="pointer-events-none absolute right-0 top-0 h-2 w-2 border-r border-t border-cyan-300/45" />
      <span className="pointer-events-none absolute bottom-0 left-0 h-2 w-2 border-b border-l border-cyan-300/45" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-2 w-2 border-b border-r border-cyan-300/45" />
    </>
  );
}

function Stat({
  value,
  label,
  color = "text-white",
}: {
  value: number;
  label: string;
  color?: string;
}) {
  return (
    <div className="min-w-16 border border-cyan-300/15 bg-slate-950/70 px-2 py-2">
      <p className={cn("font-mono text-base font-bold", color)}>{value.toLocaleString()}</p>
      <p className="text-slate-600">{label}</p>
    </div>
  );
}

function FilterSelect({
  ariaLabel,
  value,
  onChange,
  options,
}: {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <label className="relative inline-block">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="appearance-none border border-cyan-300/20 bg-slate-950 py-2 pl-3 pr-9 text-xs text-slate-300 outline-none focus:border-cyan-300/50"
      >
        {options.map(([optionValue, label]) => (
          <option key={optionValue} value={optionValue}>
            {label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-cyan-300/60" />
    </label>
  );
}

function PagerButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="border border-cyan-300/25 bg-cyan-950/30 px-3 py-1.5 text-xs font-black italic tracking-wide text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function StatusBadge({
  acquired,
  mastered,
}: {
  acquired: boolean;
  mastered: boolean;
}) {
  if (mastered) {
    return (
      <span title="숙련 완료" className="border border-emerald-400/30 bg-emerald-500/15 p-1.5 text-emerald-300">
        <Check className="size-3.5" />
      </span>
    );
  }
  if (acquired) {
    return (
      <span title="학습 중" className="border border-amber-400/30 bg-amber-500/15 p-1.5 text-amber-300">
        <Sparkles className="size-3.5" />
      </span>
    );
  }
  return (
    <span title="미학습" className="border border-slate-700 bg-slate-950/60 p-1.5 text-slate-500">
      <Lock className="size-3.5" />
    </span>
  );
}
