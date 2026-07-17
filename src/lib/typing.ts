export interface TypingResult {
  /** 한컴타자 스타일 분당 타수 (정타 글자 수 / 분) */
  taja: number;
  accuracy: number;
  completed: number;
}

export interface TypingRankingEntry {
  id: string;
  name: string;
  taja: number;
  isMe?: boolean;
}

/** 영문 WPM → 분당 타수 (글자 5개 = 1단어 관례) */
export function wpmToTaja(wpm: number): number {
  return Math.round(wpm * 5);
}

export function mergeTypingRanking(entries: TypingRankingEntry[]): TypingRankingEntry[] {
  const best = new Map<string, TypingRankingEntry>();
  for (const entry of entries) {
    const previous = best.get(entry.id);
    if (!previous || entry.taja > previous.taja) best.set(entry.id, entry);
  }
  return [...best.values()].sort((a, b) => b.taja - a.taja);
}

export function calculateTypingResult(
  correct: number,
  total: number,
  elapsedMs: number,
  completed: number,
): TypingResult {
  const minutes = elapsedMs / 60_000;
  return {
    taja: minutes > 0 ? Math.round(correct / minutes) : 0,
    accuracy: total > 0 ? Math.round((correct / total) * 100) : 100,
    completed,
  };
}

/** 현재 커서부터 줄 들여쓰기(선행 공백/탭) 전체를 반환. Tab 한 번으로 채울 때 사용. */
export function remainingLineIndent(text: string, cursorIndex: number): string {
  if (cursorIndex < 0 || cursorIndex >= text.length) return "";
  const lineStart = text.lastIndexOf("\n", cursorIndex - 1) + 1;
  const typedOnLine = text.slice(lineStart, cursorIndex);
  if (/[^\t ]/.test(typedOnLine)) return "";
  const match = text.slice(cursorIndex).match(/^[ \t]+/);
  return match?.[0] ?? "";
}
