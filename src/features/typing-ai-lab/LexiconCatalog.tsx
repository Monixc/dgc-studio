import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    if (filters.status === "acquired" && count === 0) return false;
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

  const acquiredCount = useMemo(
    () => words.filter((word) => (mastery[word.id] ?? 0) > 0).length,
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

  useEffect(() => setPage(1), [query, difficulty, pos, status]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 pb-12 pt-5">
      <header className="rounded-3xl border border-emerald-500/20 bg-zinc-900/80 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-300">
              <BookOpen className="size-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em]">Word Codex</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold">단어 도감</h1>
            <p className="mt-1 text-sm text-zinc-400">
              전체 데이터셋을 확인하고 획득·숙련 상태를 모아보세요.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <Stat value={words.length} label="전체" />
            <Stat value={acquiredCount} label="획득" color="text-amber-300" />
            <Stat value={masteredCount} label="숙련" color="text-emerald-300" />
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all"
            style={{ width: `${words.length ? (acquiredCount / words.length) * 100 : 0}%` }}
          />
        </div>
      </header>

      <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="영어 또는 한국어 뜻 검색"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-500"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <FilterSelect
            ariaLabel="획득 상태"
            value={status}
            onChange={(value) => setStatus(value as CatalogStatus)}
            options={[
              ["all", "전체 상태"],
              ["acquired", "내가 획득"],
              ["mastered", "숙련 완료"],
              ["unacquired", "미획득"],
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
          <span className="ml-auto self-center text-xs text-zinc-500">
            {filtered.length.toLocaleString()}개
          </span>
        </div>
      </section>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 py-16 text-center text-sm text-zinc-500">
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
                  "relative overflow-hidden rounded-2xl border bg-zinc-900/75 p-4",
                  mastered
                    ? "border-emerald-500/35"
                    : acquired
                      ? "border-amber-500/30"
                      : "border-zinc-800",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate font-mono text-lg font-bold text-zinc-100">
                      {word.word}
                    </h2>
                    <p className="truncate text-sm text-zinc-400">{word.meaningKo}</p>
                  </div>
                  <StatusBadge acquired={acquired} mastered={mastered} />
                </div>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-zinc-500">
                  <span>Lv.{word.difficulty}</span>
                  <span>·</span>
                  <span>{POS_LABEL[word.pos]}</span>
                  <span className="ml-auto font-mono">
                    {Math.min(count, target)}/{target}
                  </span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      mastered ? "bg-emerald-400" : "bg-amber-400",
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
          <Button
            variant="secondary"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            이전
          </Button>
          <span className="text-sm text-zinc-400">
            {page} / {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
          >
            다음
          </Button>
        </nav>
      )}
    </div>
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
    <div className="min-w-16 rounded-xl bg-zinc-950/70 px-2 py-2">
      <p className={cn("font-mono text-base font-bold", color)}>{value.toLocaleString()}</p>
      <p className="text-zinc-600">{label}</p>
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
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 outline-none focus:border-emerald-500"
    >
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
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
      <span title="숙련 완료" className="rounded-full bg-emerald-500/15 p-1.5 text-emerald-300">
        <Check className="size-3.5" />
      </span>
    );
  }
  if (acquired) {
    return (
      <span title="획득" className="rounded-full bg-amber-500/15 p-1.5 text-amber-300">
        <Sparkles className="size-3.5" />
      </span>
    );
  }
  return <span className="size-6 rounded-full border border-zinc-700" title="미획득" />;
}
