/** 타이핑 세션 상태 */
export type SessionStatus = 'idle' | 'active' | 'paused' | 'finished';

/** 문자별 상태 */
export type CharStatus = 'pending' | 'correct' | 'incorrect';

/** 타이핑 통계 */
export interface TypingStats {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  correctChars: number;
  incorrectChars: number;
  totalTyped: number;
  elapsedMs: number;
  progress: number;
}

/** 타이핑 이벤트 */
export type TypingEvent =
  | { type: 'start' }
  | { type: 'keystroke'; char: string; correct: boolean; index: number }
  | { type: 'backspace'; index: number }
  | { type: 'finish'; stats: TypingStats }
  | { type: 'pause' }
  | { type: 'resume' };

export type TypingEventListener = (event: TypingEvent) => void;

/** 타이핑 세션 옵션 */
export interface TypingSessionOptions {
  text: string;
  /** WPM 계산 시 단어당 문자 수 (기본 5) */
  charsPerWord?: number;
}

/** 이 미만 경과 시간에선 분모가 0에 가까워 WPM이 폭증하므로 신뢰하지 않는다. */
const MIN_RELIABLE_MS = 2_000;
/** 사람이 낼 수 있는 상한(약 300WPM)을 넘는 값은 조작/버그로 간주해 자른다. */
const MAX_WPM = 300;

/** WPM/정확도 계산 유틸 */
export function calculateWpm(correctChars: number, elapsedMs: number, charsPerWord = 5): number {
  if (elapsedMs < MIN_RELIABLE_MS) return 0;
  const minutes = elapsedMs / 60000;
  return Math.min(MAX_WPM, Math.round((correctChars / charsPerWord) / minutes));
}

export function calculateRawWpm(totalTyped: number, elapsedMs: number, charsPerWord = 5): number {
  if (elapsedMs < MIN_RELIABLE_MS) return 0;
  const minutes = elapsedMs / 60000;
  return Math.min(MAX_WPM, Math.round((totalTyped / charsPerWord) / minutes));
}

export function calculateAccuracy(correct: number, total: number): number {
  if (total <= 0) return 100;
  return Math.round((correct / total) * 1000) / 10;
}

/** WPM → 레이스 속도 (0~1 정규화, 최대 WPM 기준) */
export function wpmToRaceSpeed(wpm: number, maxWpm = 120): number {
  return Math.min(1, Math.max(0, wpm / maxWpm));
}

/** 레이스 진행률 (0~1) */
export function calculateProgress(typedIndex: number, textLength: number): number {
  if (textLength <= 0) return 0;
  return Math.min(1, typedIndex / textLength);
}

