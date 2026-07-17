import { wpmToRaceSpeed, type TypingStats } from '@tajarace/core';
import type { KeystrokeSnapshot } from '@tajarace/storage';

export const DEFAULT_RACE_LAPS = 3;
/** 레이스 진행 계산에 사용하는 고정 거리. 스니펫 길이와 무관하다. */
export const RACE_DISTANCE_CHARS = 300;

/** 레이스 참가자 */
export interface RaceParticipant {
  id: string;
  name: string;
  progress: number;
  wpm: number;
  speed: number;
  rank: number;
  isReady: boolean;
  isGhost?: boolean;
  isFinished: boolean;
  /** 레이스 시작 후 결승선을 통과한 시각(ms). 실제 골인 순위 판정용. */
  finishedAt?: number;
  stats?: TypingStats;
}

/** 로비 상태 */
export type LobbyStatus = 'waiting' | 'countdown' | 'racing' | 'finished';

/** 레이스 모드 */
export type RaceMode = 'realtime' | 'ghost';

/** F1 트랙 위치 (0~1 랩 진행률 기준) */
export interface TrackPosition {
  x: number;
  y: number;
  angle: number;
}

/** 레이스 상태 */
export interface RaceState {
  mode: RaceMode;
  status: LobbyStatus;
  text: string;
  /** 결합된 입력 스트림에서 각 스니펫 마지막 문자 다음의 커서 위치. */
  snippetEnds: number[];
  contentId: string;
  participants: RaceParticipant[];
  countdown: number;
  myParticipantId: string;
  winnerId: string | null;
}

export type RaceEvent =
  | { type: 'lobby-update'; state: RaceState }
  | { type: 'countdown'; seconds: number }
  | { type: 'race-start' }
  | { type: 'position-update'; participants: RaceParticipant[] }
  | { type: 'race-finish'; rankings: RaceParticipant[]; pointsMap: Record<string, number> };

export type RaceEventListener = (event: RaceEvent) => void;

export { progressToTrackPosition } from './track-layout.js';

/** 고스트 진행률 보간 */
export function interpolateGhostProgress(
  timeline: KeystrokeSnapshot[],
  elapsedMs: number,
): { progress: number; wpm: number } {
  if (timeline.length === 0) return { progress: 0, wpm: 0 };

  let prev = timeline[0]!;
  if (elapsedMs <= prev.elapsedMs) {
    return { progress: prev.progress, wpm: prev.wpm };
  }

  for (let i = 1; i < timeline.length; i++) {
    const curr = timeline[i]!;
    if (elapsedMs <= curr.elapsedMs) {
      const ratio =
        (elapsedMs - prev.elapsedMs) / (curr.elapsedMs - prev.elapsedMs);
      return {
        progress: prev.progress + (curr.progress - prev.progress) * ratio,
        wpm: prev.wpm + (curr.wpm - prev.wpm) * ratio,
      };
    }
    prev = curr;
  }

  const last = timeline[timeline.length - 1]!;
  return { progress: last.progress, wpm: last.wpm };
}

export function updateParticipantFromStats(
  participant: RaceParticipant,
  stats: TypingStats,
  visualProgress?: number,
): RaceParticipant {
  const progress = visualProgress ?? stats.progress;
  const isFinished = progress >= 1;
  return {
    ...participant,
    progress,
    wpm: stats.wpm,
    speed: wpmToRaceSpeed(stats.wpm),
    isFinished,
    finishedAt: participant.finishedAt ?? (isFinished ? stats.elapsedMs : undefined),
    stats,
  };
}

export function rankParticipants(participants: RaceParticipant[]): RaceParticipant[] {
  return [...participants]
    .sort((a, b) => {
      if (a.isFinished && !b.isFinished) return -1;
      if (!a.isFinished && b.isFinished) return 1;
      if (a.isFinished && b.isFinished) {
        return (a.finishedAt ?? Infinity) - (b.finishedAt ?? Infinity);
      }
      return b.progress - a.progress;
    })
    .map((p, i) => ({ ...p, rank: i + 1 }));
}
