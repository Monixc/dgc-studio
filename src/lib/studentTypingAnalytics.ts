import type { TypingPracticeLog, TypingPracticeMode } from "@/integrations/supabase/types";

export interface DailyTypingBest {
  key: string;
  label: string;
  taja: number;
  mode: TypingPracticeMode | null;
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dailyTypingBests(
  logs: TypingPracticeLog[],
  days = 30,
  today = new Date(),
): DailyTypingBest[] {
  const bestByDay = new Map<string, TypingPracticeLog>();
  for (const log of logs) {
    const key = localDateKey(new Date(log.completed_at));
    const previous = bestByDay.get(key);
    if (!previous || log.taja > previous.taja) bestByDay.set(key, log);
  }

  const dayLabel = new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" });
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (days - 1 - index));
    const key = localDateKey(date);
    const best = bestByDay.get(key);
    return {
      key,
      label: dayLabel.format(date),
      taja: best?.taja ?? 0,
      mode: best?.mode ?? null,
    };
  });
}
