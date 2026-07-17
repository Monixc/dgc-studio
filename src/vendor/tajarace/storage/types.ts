import type { TypingStats } from '@tajarace/core';

export interface UserProfile {
  id: string;
  name: string;
  classId?: string;
  points: number;
}

export interface TypingRecord {
  id: string;
  userId: string;
  contentId: string;
  category: string;
  wpm: number;
  accuracy: number;
  elapsedMs: number;
  createdAt: number;
  /** 고스트 레이스용 키 입력 타임라인 */
  keystrokeTimeline?: KeystrokeSnapshot[];
}

/** 고스트 리플레이용 스냅샷 */
export interface KeystrokeSnapshot {
  index: number;
  elapsedMs: number;
  wpm: number;
  progress: number;
}

export interface RaceResult {
  id: string;
  userId: string;
  mode: 'realtime' | 'ghost';
  rank: number;
  wpm: number;
  accuracy: number;
  pointsEarned: number;
  createdAt: number;
}

export interface ClassStats {
  classId: string;
  averageWpm: number;
  averageAccuracy: number;
  memberCount: number;
}

export interface StorageAdapter {
  getUser(userId: string): Promise<UserProfile | null>;
  saveUser(user: UserProfile): Promise<void>;
  getRecords(userId: string, limit?: number): Promise<TypingRecord[]>;
  saveRecord(record: TypingRecord): Promise<void>;
  getBestRecord(userId: string, contentId: string): Promise<TypingRecord | null>;
  getClassRecords(classId: string, limit?: number): Promise<TypingRecord[]>;
  getLeaderboard(limit?: number): Promise<UserProfile[]>;
  saveRaceResult(result: RaceResult): Promise<void>;
  addPoints(userId: string, points: number): Promise<void>;
}

export function createRecordFromStats(
  userId: string,
  contentId: string,
  category: string,
  stats: TypingStats,
  timeline?: KeystrokeSnapshot[],
): Omit<TypingRecord, 'id' | 'createdAt'> {
  return {
    userId,
    contentId,
    category,
    wpm: stats.wpm,
    accuracy: stats.accuracy,
    elapsedMs: stats.elapsedMs,
    keystrokeTimeline: timeline,
  };
}

/** 순위별 포인트 계산 */
export function calculateRacePoints(rank: number, totalPlayers: number): number {
  const base = Math.max(1, totalPlayers - rank + 1);
  return rank === 1 ? base * 3 : rank === 2 ? base * 2 : base;
}

export { createLocalStorageAdapter } from './local-storage.js';
export { createMemoryStorageAdapter } from './memory-storage.js';
