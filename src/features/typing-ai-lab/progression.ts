import {
  WORDS,
  WORD_BY_ID,
  masteryTarget,
  type WordDef,
} from "./content";

export const MIN_BAND = 1;
export const MAX_BAND = 5;
/** Absolute mastered count in current band to unlock next. */
export const UNLOCK_ABS = 40;
/** Fraction of current band that must be mastered to unlock next. */
export const UNLOCK_RATIO = 0.4;

export interface ProgressionSnapshot {
  unlockedBand: number;
  masteredTotal: number;
  bandWordCount: number;
  bandMastered: number;
  unlockNeed: number;
  remainingToUnlock: number;
  nextBand: number | null;
}

function isMastered(word: WordDef, mastery: Record<string, number>): boolean {
  return (mastery[word.id] ?? 0) >= masteryTarget(word.difficulty);
}

export function wordsInBand(band: number, words: WordDef[] = WORDS): WordDef[] {
  return words.filter((w) => w.difficulty === band);
}

export function countMasteredInBand(
  band: number,
  mastery: Record<string, number>,
  words: WordDef[] = WORDS,
): number {
  return wordsInBand(band, words).filter((w) => isMastered(w, mastery)).length;
}

/**
 * Sequential unlock: start at band 1. Unlock band N+1 when band N has
 * mastered >= UNLOCK_ABS OR mastered / bandSize >= UNLOCK_RATIO.
 */
export function unlockedBand(
  mastery: Record<string, number>,
  words: WordDef[] = WORDS,
): number {
  let band = MIN_BAND;
  while (band < MAX_BAND) {
    const inBand = wordsInBand(band, words);
    if (inBand.length === 0) break;
    const mastered = inBand.filter((w) => isMastered(w, mastery)).length;
    const needAbs = UNLOCK_ABS;
    const needRatio = Math.ceil(inBand.length * UNLOCK_RATIO);
    if (mastered >= needAbs || mastered / inBand.length >= UNLOCK_RATIO) {
      band += 1;
      continue;
    }
    break;
  }
  return band;
}

/** Learning pool: difficulty <= unlocked and not yet mastered. */
export function learningPoolIds(
  mastery: Record<string, number>,
  words: WordDef[] = WORDS,
): string[] {
  const band = unlockedBand(mastery, words);
  return words
    .filter((w) => w.difficulty <= band && !isMastered(w, mastery))
    .map((w) => w.id);
}

export function progressionSnapshot(
  mastery: Record<string, number>,
  words: WordDef[] = WORDS,
): ProgressionSnapshot {
  const unlocked = unlockedBand(mastery, words);
  const inBand = wordsInBand(unlocked, words);
  const bandMastered = inBand.filter((w) => isMastered(w, mastery)).length;
  const masteredTotal = words.filter((w) => isMastered(w, mastery)).length;
  const unlockAbsNeed = UNLOCK_ABS;
  const unlockRatioNeed = Math.ceil(inBand.length * UNLOCK_RATIO);
  // Remaining until either condition can fire (min of the two targets).
  const unlockNeed = Math.min(unlockAbsNeed, unlockRatioNeed);
  const remainingToUnlock =
    unlocked >= MAX_BAND ? 0 : Math.max(0, unlockNeed - bandMastered);
  return {
    unlockedBand: unlocked,
    masteredTotal,
    bandWordCount: inBand.length,
    bandMastered,
    unlockNeed,
    remainingToUnlock,
    nextBand: unlocked >= MAX_BAND ? null : unlocked + 1,
  };
}

/** Highest difficulty among known word ids (for competition lexicon load). */
export function requiredBandForIds(ids: string[]): number {
  let max = MIN_BAND;
  for (const id of ids) {
    const d = WORD_BY_ID[id]?.difficulty ?? MIN_BAND;
    if (d > max) max = d;
  }
  return Math.min(MAX_BAND, max);
}
