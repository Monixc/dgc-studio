import type {
  ClassStats,
  RaceResult,
  StorageAdapter,
  TypingRecord,
  UserProfile,
} from './types.js';

export function createMemoryStorageAdapter(): StorageAdapter {
  const users = new Map<string, UserProfile>();
  const records: TypingRecord[] = [];
  const raceResults: RaceResult[] = [];

  return {
    async getUser(userId) {
      return users.get(userId) ?? null;
    },

    async saveUser(user) {
      users.set(user.id, user);
    },

    async getRecords(userId, limit = 50) {
      return records
        .filter((r) => r.userId === userId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit);
    },

    async saveRecord(record) {
      records.push(record);
    },

    async getBestRecord(userId, contentId) {
      const userRecords = records.filter(
        (r) => r.userId === userId && r.contentId === contentId,
      );
      if (userRecords.length === 0) return null;
      return userRecords.reduce((best, r) => (r.wpm > best.wpm ? r : best));
    },

    async getClassRecords(classId, limit = 50) {
      const classUserIds = new Set(
        [...users.values()].filter((u) => u.classId === classId).map((u) => u.id),
      );
      return records
        .filter((r) => classUserIds.has(r.userId))
        .sort((a, b) => b.wpm - a.wpm)
        .slice(0, limit);
    },

    async getLeaderboard(limit = 10) {
      return [...users.values()]
        .sort((a, b) => b.points - a.points)
        .slice(0, limit);
    },

    async saveRaceResult(result) {
      raceResults.push(result);
    },

    async addPoints(userId, points) {
      const user = users.get(userId);
      if (user) {
        user.points += points;
        users.set(userId, user);
      }
    },
  };
}

export function getClassStats(
  _adapter: StorageAdapter,
  classId: string,
  records: TypingRecord[],
  users: UserProfile[],
): ClassStats {
  const classUsers = users.filter((u) => u.classId === classId);
  const classUserIds = new Set(classUsers.map((u) => u.id));
  const classRecords = records.filter((r) => classUserIds.has(r.userId));

  if (classRecords.length === 0) {
    return { classId, averageWpm: 0, averageAccuracy: 0, memberCount: classUsers.length };
  }

  const averageWpm =
    classRecords.reduce((sum, r) => sum + r.wpm, 0) / classRecords.length;
  const averageAccuracy =
    classRecords.reduce((sum, r) => sum + r.accuracy, 0) / classRecords.length;

  return {
    classId,
    averageWpm: Math.round(averageWpm),
    averageAccuracy: Math.round(averageAccuracy * 10) / 10,
    memberCount: classUsers.length,
  };
}
