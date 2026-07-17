import type { RaceResult, StorageAdapter, TypingRecord, UserProfile } from './types.js';

const STORAGE_KEY = 'tajarace_data';

interface StoredData {
  users: UserProfile[];
  records: TypingRecord[];
  raceResults: RaceResult[];
}

function loadData(): StoredData {
  if (typeof localStorage === 'undefined') {
    return { users: [], records: [], raceResults: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { users: [], records: [], raceResults: [] };
    return JSON.parse(raw) as StoredData;
  } catch {
    return { users: [], records: [], raceResults: [] };
  }
}

export function createLocalStorageAdapter(storageKey = STORAGE_KEY): StorageAdapter {
  function read(): StoredData {
    if (storageKey !== STORAGE_KEY) {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) return JSON.parse(raw) as StoredData;
      } catch { /* fall through */ }
    }
    return loadData();
  }

  function write(data: StoredData): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(storageKey, JSON.stringify(data));
  }

  return {
    async getUser(userId) {
      const data = read();
      return data.users.find((u) => u.id === userId) ?? null;
    },

    async saveUser(user) {
      const data = read();
      const idx = data.users.findIndex((u) => u.id === user.id);
      if (idx >= 0) data.users[idx] = user;
      else data.users.push(user);
      write(data);
    },

    async getRecords(userId, limit = 50) {
      const data = read();
      return data.records
        .filter((r) => r.userId === userId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit);
    },

    async saveRecord(record) {
      const data = read();
      data.records.push(record);
      write(data);
    },

    async getBestRecord(userId, contentId) {
      const data = read();
      const userRecords = data.records.filter(
        (r) => r.userId === userId && r.contentId === contentId,
      );
      if (userRecords.length === 0) return null;
      return userRecords.reduce((best, r) => (r.wpm > best.wpm ? r : best));
    },

    async getClassRecords(classId, limit = 50) {
      const data = read();
      const classUserIds = new Set(
        data.users.filter((u) => u.classId === classId).map((u) => u.id),
      );
      return data.records
        .filter((r) => classUserIds.has(r.userId))
        .sort((a, b) => b.wpm - a.wpm)
        .slice(0, limit);
    },

    async getLeaderboard(limit = 10) {
      const data = read();
      return [...data.users]
        .sort((a, b) => b.points - a.points)
        .slice(0, limit);
    },

    async saveRaceResult(result) {
      const data = read();
      data.raceResults.push(result);
      write(data);
    },

    async addPoints(userId, points) {
      const data = read();
      const user = data.users.find((u) => u.id === userId);
      if (user) {
        user.points += points;
        write(data);
      }
    },
  };
}
